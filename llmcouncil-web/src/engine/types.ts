// Shared types for the client-side WebLLM engine (browser-only, no cloud dependency).

export interface SearchResult {
  /** Stable, 1-indexed identifier used for inline citation matching, e.g. "[1]". */
  id: number;
  title: string;
  url: string;
  /** Trimmed, plain-text excerpt used as grounding context for the model. */
  content: string;
  /** Which connector produced this result, surfaced in the grounding inspection panel. */
  source: 'tavily' | 'brave' | 'wikipedia' | 'duckduckgo';
}

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export type SearchProvider = 'auto' | 'tavily' | 'brave' | 'wikipedia';
// duckduckgo isn't user-selectable: it's only ever an automatic fallback alongside
// Wikipedia when there's no search key, not a provider someone opts into.

export interface SearchOptions {
  /** Optional cloud search API key (Tavily or Brave). Omit to use the keyless Wikipedia fallback. */
  apiKey?: string;
  provider?: SearchProvider;
  maxResults?: number;
}

export type ModelCapability =
  | 'reasoning'
  | 'chain-of-thought'
  | 'tool-calling'
  | 'fast'
  | 'summarizing'
  | 'understanding';

export type ModelTier = 'fast' | 'balanced' | 'deep';

export interface EngineModelOption {
  id: string;
  label: string;
  tier: ModelTier;
  capabilities: ModelCapability[];
  /** Approximate download size, shown to the user before they commit to a download. */
  sizeLabel: string;
  /** Approximate WebGPU VRAM needed to run this model at a usable speed. */
  vramLabel: string;
  /** GPU memory the q4f16 build needs, in MB (prebuiltAppConfig's vram_required_MB). */
  vramMB: number;
  /** The same for the q4f32 build, loaded instead on GPUs without shader-f16. */
  vramF32MB: number;
  description: string;
  recommended?: boolean;
}
