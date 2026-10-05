import { describe, expect, it } from 'vitest';
import { OpenAICompatBackend } from './openai';
import { AbortedError } from './types';

const sse = (frames: string[]) => {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const f of frames) c.enqueue(enc.encode(f));
      c.close();
    },
  });
};
const frame = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

describe('OpenAICompatBackend', () => {
  it('normalises the base URL and lists models', async () => {
    let url = '';
    const b = new OpenAICompatBackend('http://localhost:11434/v1/', async (u) => {
      url = String(u);
      return new Response(JSON.stringify({ data: [{ id: 'b' }, { id: 'a' }] }));
    });
    expect(await b.listModels()).toEqual(['a', 'b']);
    expect(url).toBe('http://localhost:11434/v1/models');
  });

  it('streams tokens, tolerating frames split mid-line and think blocks', async () => {
    const whole = frame('<think>x</think>Hel') + frame('lo') + 'data: [DONE]\n\n';
    const b = new OpenAICompatBackend('http://x', async () =>
      new Response(sse([whole.slice(0, 20), whole.slice(20)]))
    );
    const tokens: string[] = [];
    const text = await b.chat([{ role: 'user', content: 'hi' }], { model: 'm', onToken: (t) => tokens.push(t) });
    expect(text).toBe('Hello');
    expect(tokens.join('')).toBe('Hello');
  });

  it('reports an unreachable server clearly', async () => {
    const b = new OpenAICompatBackend('http://x', async () => {
      throw new TypeError('fetch failed');
    });
    await expect(b.chat([], { model: 'm' })).rejects.toThrow(/Cannot reach the model server/);
  });

  it('maps a cancelled request to AbortedError', async () => {
    const ac = new AbortController();
    const b = new OpenAICompatBackend('http://x', async () => {
      ac.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    await expect(b.chat([], { model: 'm', signal: ac.signal })).rejects.toBeInstanceOf(AbortedError);
  });
});
