import {
  CreateMLCEngine,
  type ChatCompletionMessageParam,
  type InitProgressReport,
  type MLCEngineInterface,
} from '@mlc-ai/web-llm';
import { isWebGPUSupported } from './models';
import { currentEpoch, GenerationCancelledError, setInterruptHook, type CancelScope } from './cancellation';

export { GenerationCancelledError } from './cancellation';

export type ProgressFn = (text: string, fraction?: number) => void;

// One engine for the whole app. Each model is a multi-GB WebGPU allocation, so the
// Council's seats and the Local Assistant share a single loaded model; asking for a
// different one unloads the current one first, so two never coexist.
let engine: MLCEngineInterface | null = null;
let engineModelId: string | null = null;

// Every load and generation runs through this chain. WebLLM engines don't handle
// concurrent requests, and a model swap must never happen mid-generation.
let queue: Promise<unknown> = Promise.resolve();

// Whose generation is streaming right now. interruptGenerate() stops whatever the
// engine is doing, so a cancel may only use it on its own scope's generation.
let activeScope: CancelScope | null = null;

setInterruptHook((scope) => {
  if (activeScope === scope) engine?.interruptGenerate();
});

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
  /** Which caller this is; cancelScope() on it drops this generation. */
  scope: CancelScope;
  /** The scope's epoch when the caller's work began. Defaults to now. */
  epoch?: number;
  temperature?: number;
  maxTokens?: number;
  onToken?: (delta: string) => void;
  onProgress?: ProgressFn;
}

/** Loads the model if needed, then streams one completion. Returns the full text. */
export function generate(
  modelId: string,
  messages: ChatCompletionMessageParam[],
  opts: GenerateOptions
): Promise<string> {
  const { scope } = opts;
  const epoch = opts.epoch ?? currentEpoch(scope);
  const cancelled = () => currentEpoch(scope) !== epoch;
  return enqueue(async () => {
    if (cancelled()) throw new GenerationCancelledError();
    const active = await ensureEngine(modelId, opts.onProgress);
    // A model download can take minutes; the run may have been aborted meanwhile.
    if (cancelled()) throw new GenerationCancelledError();

    activeScope = scope;
    try {
      const stream = await active.chat.completions.create({
        messages,
        temperature: opts.temperature ?? 0,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        stream: true,
      });

      let text = '';
      let interrupted = false;
      for await (const chunk of stream) {
        // Checked per chunk as well: an interrupt that lands before the stream's
        // first step is reset by WebLLM, so it can't be relied on alone. Never break
        // out of the loop, though: WebLLM releases its engine lock only when the
        // stream runs to completion, so abandoning it would deadlock the engine.
        if (cancelled()) {
          if (!interrupted) {
            interrupted = true;
            active.interruptGenerate();
          }
          continue;
        }
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          text += delta;
          opts.onToken?.(delta);
        }
      }
      // An interrupted stream ends early but normally; its partial text is not an answer.
      if (cancelled()) throw new GenerationCancelledError();
      return text;
    } finally {
      activeScope = null;
    }
  });
}
