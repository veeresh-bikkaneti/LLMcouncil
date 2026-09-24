// Cancellation state for in-browser generations. Deliberately tiny and free of any
// WebLLM import, so the UI can cancel a run before the lazily loaded engine chunk
// has even arrived.

/** Each caller of the shared engine cancels independently of the others. */
export type CancelScope = 'council' | 'assistant';

const epochs: Record<CancelScope, number> = { council: 0, assistant: 0 };
let interruptHook: ((scope: CancelScope) => void) | null = null;

/** Captured when work starts; a generation refuses to run once its scope has moved on. */
export function currentEpoch(scope: CancelScope): number {
  return epochs[scope];
}

/** Cancels everything in `scope` that has started or is queued, and nothing else. */
export function cancelScope(scope: CancelScope): void {
  epochs[scope]++;
  interruptHook?.(scope);
}

/** Registered by the engine once it loads, to stop a generation that is streaming. */
export function setInterruptHook(hook: (scope: CancelScope) => void): void {
  interruptHook = hook;
}

export class GenerationCancelledError extends Error {
  constructor() {
    super('Generation cancelled.');
    this.name = 'GenerationCancelledError';
  }
}
