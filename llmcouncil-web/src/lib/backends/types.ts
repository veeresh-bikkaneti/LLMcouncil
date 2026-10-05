export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model: string;
  signal?: AbortSignal;
  /** Called with each visible text delta as it streams in. */
  onToken?: (delta: string) => void;
  /** Loading progress for backends that have to fetch weights first. */
  onProgress?: (text: string, fraction?: number) => void;
  maxTokens?: number;
  temperature?: number;
}

export interface Backend {
  /** Whether several chat() calls may be in flight at once. */
  readonly parallel: boolean;
  chat(messages: ChatMessage[], opts: ChatOptions): Promise<string>;
  listModels(signal?: AbortSignal): Promise<string[]>;
}

export class AbortedError extends Error {
  constructor() {
    super('Cancelled.');
    this.name = 'AbortedError';
  }
}
