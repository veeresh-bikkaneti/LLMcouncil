import {
  CreateMLCEngine,
  type ChatCompletionMessageParam,
  type InitProgressReport,
  type MLCEngineInterface,
} from '@mlc-ai/web-llm';
import { executeWebSearch } from './search';
import { sanitizePII } from './sanitize';
import type {
  EngineModelOption,
  SearchResult,
  SendMessageResult,
  WebLLMChatbotOptions,
  ConfidenceLevel,
} from './types';

/**
 * Curated, capability-labeled tiers of real WebLLM prebuilt models (exact ids and
 * VRAM figures from mlc-ai/web-llm's prebuiltAppConfig). Unlike a single tiny model,
 * this lets a user pick a model that actually reasons, follows multi-step
 * instructions, and summarizes well -- comparable in spirit to what a cloud-backed
 * assistant (or Chrome's in-browser AI Mode) provides -- while still offering a
 * fast/low-VRAM tier for modest hardware. Regardless of tier, EVERY model here is
 * driven by the same JS orchestrator (see sendMessage below): none of them are ever
 * given native tool-calling autonomy over search, so answers stay reliably grounded
 * and citation-checked even when a model's own weights technically support function
 * calling (noted on the Hermes entries below for transparency).
 */
export const AVAILABLE_MODELS: EngineModelOption[] = [
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 1.5B',
    tier: 'fast',
    capabilities: ['fast', 'summarizing'],
    sizeLabel: '~1.6 GB',
    vramLabel: '~2 GB VRAM',
    description: 'Best for low-power laptops and quick lookups. Limited multi-step reasoning.',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 3B',
    tier: 'fast',
    capabilities: ['fast', 'reasoning'],
    sizeLabel: '~2.3 GB',
    vramLabel: '~3 GB VRAM',
    description: 'Noticeably better understanding than 1.5B, still runs on integrated GPUs.',
  },
  {
    id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 7B Instruct',
    tier: 'balanced',
    capabilities: ['reasoning', 'summarizing', 'understanding'],
    sizeLabel: '~5.1 GB',
    vramLabel: '~6 GB VRAM',
    description:
      'Strong general-purpose reasoning and long-context summarization -- the closest local match to a cloud-grade assistant.',
    recommended: true,
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    label: 'Phi-3.5 Mini',
    tier: 'balanced',
    capabilities: ['reasoning', 'fast'],
    sizeLabel: '~3.7 GB',
    vramLabel: '~4 GB VRAM',
    description: 'Compact but reasoning-tuned; a good middle ground on mid-range GPUs.',
  },
  {
    id: 'DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC',
    label: 'DeepSeek R1 Distill 8B',
    tier: 'deep',
    capabilities: ['chain-of-thought', 'summarizing'],
    sizeLabel: '~5.0 GB',
    vramLabel: '~7 GB VRAM',
    description: 'Shows its work step-by-step before answering. Best for multi-step or analytical questions.',
  },
  {
    id: 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC',
    label: 'Hermes 3 · Llama 3.1 8B',
    tier: 'deep',
    capabilities: ['tool-calling', 'reasoning'],
    sizeLabel: '~4.9 GB',
    vramLabel: '~6 GB VRAM',
    description: 'Natively supports structured function calling -- reserved for future tool-use features.',
  },
];

export const DEFAULT_MODEL_ID = AVAILABLE_MODELS.find((m) => m.recommended)?.id ?? AVAILABLE_MODELS[0].id;

export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as unknown as { gpu?: unknown }).gpu;
}

// Tolerant of markdown emphasis wrapping (models routinely bold this line despite
// instructions not to) and trailing punctuation, while still anchoring to the end of
// the reply so it only strips the actual trailing confidence line, not a mid-answer
// mention of the word "confidence".
const CONFIDENCE_TAG_RE = /[\s*_]*Confidence Level[\s*_]*:[\s*_]*\[?\s*(High|Medium|Low)\s*\]?[\s*_.]*$/i;

// Some reasoning-tuned models (e.g. DeepSeek-R1 distills) emit a raw <think>...</think>
// block ahead of their real answer. Strip it from the final rendered/parsed text so it
// doesn't dump unformatted chain-of-thought into the "Grounded Answer" card.
const THINK_BLOCK_RE = /<think>[\s\S]*?<\/think>/gi;

/**
 * Generic JavaScript orchestrator around small-to-mid-size (~1.5B-8B parameter)
 * in-browser models. Models are deliberately NEVER given tool-calling autonomy -- even
 * the larger tiers here are not trusted to drive tools reliably. Instead this class
 * runs the retrieval step itself (executeWebSearch), formats the results into a
 * restricted system prompt, and uses the model purely as a grounded text synthesizer
 * that must cite its sources.
 */
export class WebLLMChatbot {
  private engine: MLCEngineInterface | null = null;
  private readonly modelId: string;
  private readonly searchApiKey?: string;
  private readonly searchProvider: WebLLMChatbotOptions['searchProvider'];
  private readonly maxSources: number;

  constructor(options: WebLLMChatbotOptions = {}) {
    this.modelId = options.modelId || DEFAULT_MODEL_ID;
    this.searchApiKey = options.searchApiKey;
    this.searchProvider = options.searchProvider || 'auto';
    this.maxSources = options.maxSources ?? 5;
  }

  getModelId(): string {
    return this.modelId;
  }

  /**
   * Boots the in-browser engine, streaming coarse download/compile progress (weights
   * range from ~1.6GB to ~5.1GB depending on the selected tier, and are cached by the
   * browser after the first run).
   */
  async init(onProgress: (progressText: string, fraction?: number) => void): Promise<void> {
    if (!isWebGPUSupported()) {
      throw new Error(
        'WebGPU is not available in this browser. Use a recent desktop Chrome/Edge build, ' +
          'or plug in a cloud API key elsewhere in the app instead.'
      );
    }

    this.engine = await CreateMLCEngine(this.modelId, {
      initProgressCallback: (report: InitProgressReport) => {
        onProgress(report.text, report.progress);
      },
    });
  }

  /**
   * Runtime retrieval connector. Sanitizes the query before it ever leaves the
   * browser, then delegates to whichever search backend is configured (a cloud key
   * if the user supplied one, otherwise the keyless Wikipedia fallback).
   */
  async executeWebSearch(query: string): Promise<SearchResult[]> {
    const safeQuery = sanitizePII(query.trim());
    const rawResults = await executeWebSearch(safeQuery, {
      apiKey: this.searchApiKey,
      provider: this.searchProvider,
      maxResults: this.maxSources,
    });

    // Defense in depth: scrub PII out of retrieved content/titles too, in case a
    // source itself happens to surface personal data.
    return rawResults.map((r) => ({
      ...r,
      title: sanitizePII(r.title),
      content: sanitizePII(r.content),
    }));
  }

  private buildSystemPrompt(sources: SearchResult[]): string {
    const sourceBlock = sources.length
      ? sources.map((s) => `[${s.id}] ${s.title}\nURL: ${s.url}\nEXCERPT: ${s.content}`).join('\n\n')
      : '(No sources were retrieved for this query. Say so plainly instead of guessing.)';

    return [
      'You are a strict fact-grounding rewriter. You do not have tools and cannot browse; ' +
        'all evidence you may use has already been retrieved for you and is listed below.',
      '',
      'CONSTRAINT 1 (VERIFICATION): Base every factual claim ONLY on the SOURCES block below. ' +
        'Ignore your own pre-trained knowledge and any bias it may carry. If the sources do not ' +
        'answer the question, state that plainly instead of inventing an answer.',
      '',
      'CONSTRAINT 2 (CITATIONS): Every sentence that states a fact must end with an inline bracket ' +
        'citation matching a source id from the list, e.g. "Paris is the capital of France [1]." ' +
        'Never cite a source id that is not listed. Never state a fact with no citation.',
      '',
      'CONSTRAINT 3 (CONFIDENCE): End your ENTIRE reply with exactly one final line of the form:',
      'Confidence Level: [High/Medium/Low]',
      'Use High only when the sources fully and unambiguously answer the query. Use Medium when ' +
        'sources partially cover it or leave gaps. Use Low when sources conflict, are off-topic, ' +
        'or are missing.',
      '',
      'Never output personal data such as Social Security numbers, phone numbers, dates of birth, ' +
        'or home addresses even if present in a source; replace any such value with [REDACTED].',
      '',
      `SOURCES:\n${sourceBlock}`,
    ].join('\n');
  }

  /**
   * Runs the full orchestrator pipeline for one turn: search -> ground -> synthesize.
   * The model is called with temperature locked at 0.0 for deterministic, literal output.
   */
  async sendMessage(userQuery: string, onToken: (delta: string) => void): Promise<SendMessageResult> {
    if (!this.engine) {
      throw new Error('Engine not initialized. Call init() before sendMessage().');
    }

    const safeQuery = sanitizePII(userQuery.trim());
    const sources = await this.executeWebSearch(safeQuery);
    const systemPrompt = this.buildSystemPrompt(sources);

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: safeQuery },
    ];

    const stream = await this.engine.chat.completions.create({
      messages,
      temperature: 0.0,
      stream: true,
    });

    let fullText = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        onToken(delta);
      }
    }

    const withoutThinking = fullText.replace(THINK_BLOCK_RE, '').trim();
    const confidenceMatch = withoutThinking.match(CONFIDENCE_TAG_RE);
    const confidence = (confidenceMatch ? confidenceMatch[1] : null) as ConfidenceLevel | null;
    const rawAnswer = confidenceMatch ? withoutThinking.slice(0, confidenceMatch.index).trim() : withoutThinking;
    // The model's own output is never trusted with PII, even though the prompt asks it
    // not to include any: it can hallucinate or copy PII straight out of a source.
    const answer = sanitizePII(rawAnswer);

    return { fullText, answer, sources, confidence };
  }

  /** Releases WebGPU/WASM resources. Always call this on unmount/model switch. */
  async dispose(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch {
        // best-effort cleanup
      }
    }
    this.engine = null;
  }
}
