import {
  CreateMLCEngine,
  prebuiltAppConfig,
  type ChatCompletionMessageParam,
  type InitProgressReport,
  type MLCEngineInterface,
} from '@mlc-ai/web-llm';
import { AVAILABLE_MODELS, fitsDevice, getDeviceProfile, isWebGPUSupported, localContextTokens, nextSmaller } from './models';
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

// What a GPU reset looks like from here: WebLLM disposes everything when the device
// is lost, so an in-flight readback fails with "Buffer was unmapped before mapping
// was resolved", later calls fail on disposed tensors, and a loss while idle leaves
// the engine unloaded (ModelNotLoadedError on the next request).
const GPU_LOSS_RE =
  /mapAsync|unmapped before mapping|device (?:was |is )?lost|DeviceLostError|Instance\.dispose|destroyed|already been disposed|ModelNotLoaded|Model not loaded/i;

function isGpuLoss(e: unknown): boolean {
  const err = e as Error;
  return err?.name === 'DeviceLostError' || GPU_LOSS_RE.test(err?.message || String(e));
}

/** Thrown by the pre-download device-memory check; distinct from other load failures
 *  so the caller knows retrying with a *smaller* model is the sensible response. */
export class DeviceTooSmallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceTooSmallError';
  }
}

/** Whether trying a smaller model is a reasonable response to this failure. A plain
 *  network/fetch error or "no GPU adapter at all" isn't -- a smaller download or a
 *  smaller model doesn't fix either of those. */
function isStepDownWorthy(e: unknown): boolean {
  const detail = (e as Error)?.message || String(e);
  return e instanceof DeviceTooSmallError || isGpuLoss(e) || /out of memory/i.test(detail);
}

const gpuLostMessage = (retried: boolean) =>
  `The GPU dropped the model mid-answer${retried ? " and a retry didn't help" : ''}. On phones this usually ` +
  'means memory pressure or a GPU timeout: close other tabs and apps, try Simple mode, or use the same model ' +
  'in more seats.';

interface GpuAdapterLike {
  features: { has(feature: string): boolean };
}

/**
 * The model build to actually load for `modelId` on this GPU. The q4f16 builds need
 * the shader-f16 WebGPU feature, which many phone GPUs lack; those get the q4f32
 * build of the same model instead of an error.
 */
async function resolveBuild(modelId: string): Promise<{ id: string; vramMB?: number }> {
  const gpu = (navigator as unknown as {
    gpu: { requestAdapter(opts?: { powerPreference?: string }): Promise<GpuAdapterLike | null> };
  }).gpu;
  // The same adapter WebLLM itself will request, so the feature check is about the
  // GPU the model actually runs on (dual-GPU laptops).
  const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) {
    throw new Error(
      'This browser exposes WebGPU but no usable GPU adapter, so in-browser models cannot run here. ' +
        'Connect a cloud model with your own API key in the Model Hub instead.'
    );
  }
  let id = modelId;
  if (!adapter.features.has('shader-f16') && id.includes('-q4f16_1-')) {
    const f32 = id.replace('-q4f16_1-', '-q4f32_1-');
    if (prebuiltAppConfig.model_list.some((m) => m.model_id === f32)) id = f32;
  }
  return { id, vramMB: prebuiltAppConfig.model_list.find((m) => m.model_id === id)?.vram_required_MB };
}

async function discardEngine(): Promise<void> {
  if (!engine) return;
  const old = engine;
  engine = null;
  engineModelId = null;
  try {
    await old.unload();
  } catch {
    // best-effort; the reference is dropped either way
  }
}

/** One attempt to load exactly `modelId`. Throws DeviceTooSmallError for the static
 *  pre-download check so the caller can decide whether stepping down makes sense. */
async function loadOnce(modelId: string, onProgress?: ProgressFn): Promise<MLCEngineInterface> {
  const build = await resolveBuild(modelId);
  // Checked before anything is downloaded or allocated: exceeding the device's GPU
  // memory kills the whole tab, which no error handler can recover from.
  const { maxVramMB } = getDeviceProfile();
  if (build.vramMB !== undefined && build.vramMB > maxVramMB) {
    const label = AVAILABLE_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
    throw new DeviceTooSmallError(
      `${label} needs about ${(build.vramMB / 1024).toFixed(1)} GB of GPU memory, more than this device can give a browser tab.`
    );
  }

  await discardEngine();

  try {
    const loaded = await CreateMLCEngine(
      build.id,
      { initProgressCallback: (report: InitProgressReport) => onProgress?.(report.text, report.progress) },
      // Only ever shrinks the window (on phones); the prompt budgets follow the same value.
      { context_window_size: localContextTokens() }
    );
    engine = loaded;
    engineModelId = modelId;
    return loaded;
  } catch (e) {
    const detail = (e as Error).message || String(e);
    if (isGpuLoss(e) || /out of memory/i.test(detail)) {
      throw new DeviceTooSmallError('The GPU ran out of memory loading this model.');
    }
    if (/fetch/i.test(detail)) {
      throw new Error(
        `Could not download the model weights (${detail}). Check your internet connection, ` +
          'or pick a smaller model if this one is too large for your connection.'
      );
    }
    throw e;
  }
}

/**
 * Loads `modelId`, stepping down to progressively smaller models on a
 * capability-related failure (declared-too-big, or the GPU actually rejecting or
 * losing it under load) until one loads or nothing smaller is left to try. Which
 * model actually ends up loaded can differ from what was asked for; `onResolved`
 * reports it so the caller can reflect that in the UI instead of silently
 * mismatching what's shown against what's really running.
 */
async function ensureEngine(
  modelId: string,
  onProgress?: ProgressFn,
  onResolved?: (resolvedModelId: string) => void
): Promise<MLCEngineInterface> {
  if (engine && engineModelId === modelId) {
    onResolved?.(modelId);
    return engine;
  }
  if (!isWebGPUSupported()) {
    throw new Error(
      'WebGPU is not available in this browser, so in-browser models cannot run. Use a recent ' +
        'desktop Chrome or Edge, or connect a cloud model with your own API key in the Model Hub.'
    );
  }

  const tried = new Set<string>();
  let candidateId = modelId;
  for (;;) {
    tried.add(candidateId);
    try {
      const loaded = await loadOnce(candidateId, onProgress);
      onResolved?.(candidateId);
      return loaded;
    } catch (e) {
      if (!isStepDownWorthy(e)) throw e;
      const next = nextSmaller(candidateId, tried);
      if (!next) {
        const label = AVAILABLE_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
        throw new Error(
          `No in-browser model that fits this device could be loaded (started from ${label}). ` +
            'Add your own API key for a cloud model in the Model Hub instead.'
        );
      }
      const fromLabel = AVAILABLE_MODELS.find((m) => m.id === candidateId)?.label ?? candidateId;
      onProgress?.(`${fromLabel} didn't work on this device -- trying ${next.label} instead...`, 0);
      candidateId = next.id;
    }
  }
}

/** Loads (or reuses) a model without generating anything. Resolves to the model id
 *  actually loaded, which can be smaller than `modelId` (see ensureEngine). */
export function loadModel(modelId: string, onProgress?: ProgressFn): Promise<string> {
  return enqueue(async () => {
    let resolved = modelId;
    await ensureEngine(modelId, onProgress, (id) => {
      resolved = id;
    });
    return resolved;
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
  /** Called once with the model actually loaded, which can differ from `modelId`
   *  passed to generate() if that one didn't fit this device (see ensureEngine). */
  onModelResolved?: (resolvedModelId: string) => void;
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
    // One retry after a GPU reset: the model is reloaded (from the browser cache) and
    // the whole request runs again. Not when tokens were already streamed to the UI,
    // which would show the start of the answer twice.
    for (let attempt = 0; ; attempt++) {
      if (cancelled()) throw new GenerationCancelledError();
      const active = await ensureEngine(modelId, opts.onProgress, opts.onModelResolved);
      // A model download can take minutes; the run may have been aborted meanwhile.
      if (cancelled()) throw new GenerationCancelledError();

      let streamed = false;
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
            if (opts.onToken) {
              streamed = true;
              opts.onToken(delta);
            }
          }
        }
        // An interrupted stream ends early but normally; its partial text is not an answer.
        if (cancelled()) throw new GenerationCancelledError();
        return text;
      } catch (e) {
        if (e instanceof GenerationCancelledError) throw e;
        // The GPU can be lost after loading (Android does this to background tabs, and
        // under memory pressure); WebLLM then disposes the model, and reusing the cached
        // engine would fail every request until a page reload. Drop it either way.
        await discardEngine();
        if (!isGpuLoss(e)) throw e;
        if (attempt === 0 && !streamed) continue;
        throw new Error(gpuLostMessage(attempt > 0));
      } finally {
        activeScope = null;
      }
    }
  });
}
