import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { AbortedError, type Backend, type ChatMessage, type ChatOptions } from './types';
import { ThinkFilter } from '../think';

/** Small, well-tested WebLLM builds. Sizes are the one-time browser download. */
export const BROWSER_MODELS = [
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B (~0.9 GB, fastest)' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 1.5B (~1.6 GB)' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B (~2.3 GB, best quality)' },
] as const;

export const hasWebGPU = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator;

/**
 * Zero-install fallback: runs the model on the user's GPU inside the page. One engine
 * can only run one request at a time, so council members run back to back, and the
 * ~6 MB runtime is only fetched the first time this backend is used.
 */
export class WebLLMBackend implements Backend {
  readonly parallel = false;
  private engine: MLCEngineInterface | null = null;
  private loaded: string | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  async listModels(): Promise<string[]> {
    return BROWSER_MODELS.map((m) => m.id);
  }

  chat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
    const run = this.queue.then(() => this.generate(messages, opts));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async ensure(model: string, opts: ChatOptions): Promise<MLCEngineInterface> {
    if (this.engine && this.loaded === model) return this.engine;
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
    await this.engine?.unload().catch(() => undefined);
    this.engine = null;
    this.loaded = null;
    this.engine = await CreateMLCEngine(model, {
      initProgressCallback: (r) => opts.onProgress?.(r.text, r.progress),
    });
    this.loaded = model;
    return this.engine;
  }

  private async generate(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
    if (opts.signal?.aborted) throw new AbortedError();
    if (!hasWebGPU()) throw new Error('This browser has no WebGPU. Use desktop Chrome or Edge, or run Ollama.');
    const engine = await this.ensure(opts.model, opts);
    if (opts.signal?.aborted) throw new AbortedError();

    const onAbort = () => engine.interruptGenerate();
    opts.signal?.addEventListener('abort', onAbort);
    const filter = new ThinkFilter();
    let text = '';
    try {
      const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        temperature: opts.temperature ?? 0.3,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      });
      // Always drain: abandoning the stream would leave the engine locked.
      for await (const chunk of stream) {
        if (opts.signal?.aborted) continue;
        const visible = filter.push(chunk.choices[0]?.delta?.content ?? '');
        if (visible) {
          text += visible;
          opts.onToken?.(visible);
        }
      }
    } catch (e) {
      // A lost GPU context poisons the engine; drop it so the next call reloads.
      this.engine = null;
      this.loaded = null;
      throw e;
    } finally {
      opts.signal?.removeEventListener('abort', onAbort);
    }
    if (opts.signal?.aborted) throw new AbortedError();
    return (text + filter.flush()).trim();
  }
}
