import {
  CreateMLCEngine,
  type ChatCompletionMessageParam,
  type InitProgressReport,
  type MLCEngineInterface,
} from '@mlc-ai/web-llm';
import { isWebGPUSupported } from './models';

export type ProgressFn = (text: string, fraction?: number) => void;

// One engine for the whole app. Each model is a multi-GB WebGPU allocation, so the
// Council's seats and the Local Assistant share a single loaded model; asking for a
// different one unloads the current one first, so two never coexist.
let engine: MLCEngineInterface | null = null;
let engineModelId: string | null = null;

// Every load and generation runs through this chain. WebLLM engines don't handle
// concurrent requests, and a model swap must never happen mid-generation.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function ensureEngine(modelId: string, onProgress?: ProgressFn): Promise<MLCEngineInterface> {
  if (engine && engineModelId === modelId) return engine;
  if (!isWebGPUSupported()) {
    throw new Error(
      'WebGPU is not available in this browser, so in-browser models cannot run. Use a recent ' +
        'desktop Chrome or Edge, or connect a cloud model with your own API key in the Model Hub.'
    );
  }

  if (engine) {
    try {
      await engine.unload();
    } catch {
      // best-effort; the reference is dropped either way
    }
    engine = null;
    engineModelId = null;
  }

  try {
    engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (report: InitProgressReport) => onProgress?.(report.text, report.progress),
    });
  } catch (e) {
    const detail = (e as Error).message || String(e);
    if (/fetch/i.test(detail)) {
      throw new Error(
        `Could not download the model weights (${detail}). Check your internet connection, ` +
          'or pick a smaller model if this one is too large for your connection.'
      );
    }
    throw e;
  }
  engineModelId = modelId;
  return engine;
}

/** Loads (or reuses) a model without generating anything. */
export function loadModel(modelId: string, onProgress?: ProgressFn): Promise<void> {
  return enqueue(async () => {
    await ensureEngine(modelId, onProgress);
  });
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  onToken?: (delta: string) => void;
  onProgress?: ProgressFn;
}

/** Loads the model if needed, then streams one completion. Returns the full text. */
export function generate(
  modelId: string,
  messages: ChatCompletionMessageParam[],
  opts: GenerateOptions = {}
): Promise<string> {
  return enqueue(async () => {
    const active = await ensureEngine(modelId, opts.onProgress);
    const stream = await active.chat.completions.create({
      messages,
      temperature: opts.temperature ?? 0,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      stream: true,
    });

    let text = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        text += delta;
        opts.onToken?.(delta);
      }
    }
    return text;
  });
}
