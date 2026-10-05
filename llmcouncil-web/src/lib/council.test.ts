import { describe, expect, it } from 'vitest';
import type { Backend, ChatMessage, ChatOptions } from './backends/types';
import { AbortedError } from './backends/types';
import { runCouncil, runQuick } from './council';

function fake(parallel: boolean, reply: (m: ChatMessage[]) => string | Error, log: string[] = []): Backend {
  let active = 0;
  let peak = 0;
  const b: Backend & { peak: () => number } = {
    parallel,
    peak: () => peak,
    listModels: async () => ['m'],
    async chat(messages: ChatMessage[], opts: ChatOptions) {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      if (opts.signal?.aborted) throw new AbortedError();
      const out = reply(messages);
      log.push(messages[0].content.slice(0, 24));
      if (out instanceof Error) throw out;
      opts.onToken?.(out);
      return out;
    },
  };
  return b;
}

const base = { model: 'm', question: 'Why is the sky blue?' };

describe('runCouncil', () => {
  it('runs members in parallel on a parallel backend, then the chair sees every answer', async () => {
    const backend = fake(true, (m) => (m[0].content.includes('Chairperson') ? 'FINAL' : `answer:${m[0].content.slice(11, 20)}`));
    const chairInputs: string[] = [];
    const res = await runCouncil({ ...base, backend }, { onChair: (s) => s.status === 'working' && chairInputs.push('x') });
    expect((backend as any).peak()).toBe(3);
    expect(res.chair).toEqual({ status: 'done', text: 'FINAL' });
    expect(res.members.every((m) => m.seat.status === 'done')).toBe(true);
  });

  it('runs members one at a time on a serial backend', async () => {
    const backend = fake(false, () => 'ok');
    await runCouncil({ ...base, backend });
    expect((backend as any).peak()).toBe(1);
  });

  it('survives a failing member and arbitrates the rest', async () => {
    let n = 0;
    const backend = fake(true, (m) => {
      if (m[0].content.includes('Chairperson')) return 'FINAL';
      return n++ === 0 ? new Error('boom') : 'fine';
    });
    const res = await runCouncil({ ...base, backend });
    expect(res.members.filter((m) => m.seat.status === 'error')).toHaveLength(1);
    expect(res.chair.text).toBe('FINAL');
  });

  it('skips the chair when only one member answered', async () => {
    let n = 0;
    const log: string[] = [];
    const backend = fake(true, () => (n++ === 0 ? 'only' : new Error('boom')), log);
    const res = await runCouncil({ ...base, backend });
    expect(res.chair).toEqual({ status: 'done', text: 'only' });
    expect(log.some((l) => l.includes('Chairperson'))).toBe(false);
  });

  it('fails with the underlying error when nobody answers', async () => {
    const res = await runCouncil({ ...base, backend: fake(true, () => new Error('server down')) });
    expect(res.chair.status).toBe('error');
    expect(res.chair.error).toBe('server down');
  });

  it('propagates cancellation instead of reporting seat errors', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(runCouncil({ ...base, backend: fake(true, () => 'x'), signal: ac.signal })).rejects.toBeInstanceOf(AbortedError);
  });

  it('puts grounding sources in the prompts', async () => {
    const seen: string[] = [];
    const backend = fake(true, (m) => (seen.push(m[0].content), 'ok'));
    await runQuick({ ...base, backend, sources: [{ id: 1, title: 'Sky', url: 'u', content: 'Rayleigh scattering' }] });
    expect(seen[0]).toContain('[1] Sky');
  });
});
