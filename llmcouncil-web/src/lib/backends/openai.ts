import { AbortedError, type Backend, type ChatMessage, type ChatOptions } from './types';
import { ThinkFilter } from '../think';

/**
 * Any local server that speaks the OpenAI chat API: Ollama, llama.cpp's llama-server,
 * LM Studio, vLLM... Nothing here ever leaves the machine unless the user points the
 * URL somewhere else.
 */
export class OpenAICompatBackend implements Backend {
  readonly parallel = true;
  private readonly base: string;

  constructor(baseUrl: string, private readonly fetchFn: typeof fetch = (...a) => fetch(...a)) {
    this.base = baseUrl.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const res = await this.fetchFn(`${this.base}/v1/models`, { signal });
    if (!res.ok) throw new Error(`Model list failed: HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    return (data.data ?? []).map((m) => m.id).sort();
  }

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: opts.signal,
        body: JSON.stringify({
          model: opts.model,
          messages,
          stream: true,
          temperature: opts.temperature ?? 0.3,
          ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        }),
      });
    } catch (e) {
      if (opts.signal?.aborted) throw new AbortedError();
      throw new Error(`Cannot reach the model server at ${this.base}. Is it running?`);
    }
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Model server error ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }

    const filter = new ThinkFilter();
    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let pending = '';
    let text = '';
    const emit = (raw: string) => {
      const visible = filter.push(raw);
      if (visible) {
        text += visible;
        opts.onToken?.(visible);
      }
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) {
          const payload = line.startsWith('data:') ? line.slice(5).trim() : '';
          if (!payload || payload === '[DONE]') continue;
          try {
            const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
            if (delta) emit(delta);
          } catch {
            // keep-alive or partial frame
          }
        }
      }
    } catch (e) {
      if (opts.signal?.aborted) throw new AbortedError();
      throw e;
    }
    const tail = filter.flush();
    if (tail) {
      text += tail;
      opts.onToken?.(tail);
    }
    return text.trim();
  }
}
