import type { Backend, ChatOptions } from './backends/types';
import { AbortedError } from './backends/types';
import { CHAIR_SYSTEM, PERSONAS, QUICK_SYSTEM, chairPrompt, withSources, type Persona } from './prompts';
import type { Source } from './search';

export type Status = 'idle' | 'working' | 'done' | 'error';

export interface Seat {
  status: Status;
  text: string;
  error?: string;
}

export interface CouncilEvents {
  onMember?: (persona: Persona, seat: Seat) => void;
  onChair?: (seat: Seat) => void;
  onProgress?: ChatOptions['onProgress'];
}

export interface RunOptions {
  backend: Backend;
  model: string;
  question: string;
  sources?: Source[];
  signal?: AbortSignal;
  personas?: Persona[];
  /** Per-generation token caps: bounds how long a run can take. */
  memberTokens?: number;
  chairTokens?: number;
}

export interface CouncilResult {
  members: Array<{ persona: Persona; seat: Seat }>;
  chair: Seat;
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** One streamed generation reported as a Seat. Rethrows only cancellation. */
async function runSeat(
  system: string,
  user: string,
  o: RunOptions,
  maxTokens: number,
  events: CouncilEvents,
  report: (seat: Seat) => void
): Promise<Seat> {
  let text = '';
  report({ status: 'working', text });
  try {
    const final = await o.backend.chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      {
        model: o.model,
        signal: o.signal,
        maxTokens,
        onProgress: events.onProgress,
        onToken: (d) => {
          text += d;
          report({ status: 'working', text });
        },
      }
    );
    const seat: Seat = { status: 'done', text: final };
    report(seat);
    return seat;
  } catch (e) {
    if (e instanceof AbortedError || o.signal?.aborted) throw new AbortedError();
    const seat: Seat = { status: 'error', text, error: errorText(e) };
    report(seat);
    return seat;
  }
}

/** Quick mode: one model, one streamed answer. */
export function runQuick(o: RunOptions, events: CouncilEvents = {}): Promise<Seat> {
  return runSeat(withSources(QUICK_SYSTEM, o.sources ?? []), o.question, o, o.chairTokens ?? 700, events, (s) =>
    events.onChair?.(s)
  );
}

/**
 * Council mode: every persona answers the question (in parallel when the backend can
 * take concurrent requests), then the chair merges the answers into one streamed
 * verdict. A failed member is skipped; the run only fails if nobody answered.
 */
export async function runCouncil(o: RunOptions, events: CouncilEvents = {}): Promise<CouncilResult> {
  const personas = o.personas ?? PERSONAS;
  const memberTokens = o.memberTokens ?? 350;
  const sources = o.sources ?? [];

  const runMember = (p: Persona) =>
    runSeat(withSources(p.system, sources), o.question, o, memberTokens, events, (s) => events.onMember?.(p, s));

  let seats: Seat[];
  if (o.backend.parallel) {
    seats = await Promise.all(personas.map(runMember));
  } else {
    seats = [];
    for (const p of personas) seats.push(await runMember(p));
  }
  const members = personas.map((persona, i) => ({ persona, seat: seats[i] }));

  const answered = members.filter((m) => m.seat.status === 'done' && m.seat.text);
  if (!answered.length) {
    const chair: Seat = {
      status: 'error',
      text: '',
      error: members.find((m) => m.seat.error)?.seat.error ?? 'No council member produced an answer.',
    };
    events.onChair?.(chair);
    return { members, chair };
  }

  // A lone survivor needs no arbitration.
  if (answered.length === 1) {
    const chair: Seat = { status: 'done', text: answered[0].seat.text };
    events.onChair?.(chair);
    return { members, chair };
  }

  const chair = await runSeat(
    CHAIR_SYSTEM,
    chairPrompt(o.question, answered.map((m) => ({ name: m.persona.name, text: m.seat.text }))),
    o,
    o.chairTokens ?? 600,
    events,
    (s) => events.onChair?.(s)
  );
  return { members, chair };
}
