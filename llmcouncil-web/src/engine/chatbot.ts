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
 * Curated set of small, browser-friendly instruct models. All are quantized (q4f16_1)
 * builds from the WebLLM prebuilt model list, chosen to keep the initial download in
 * the few-hundred-MB to ~1GB range so they are practical to fetch and cache in-browser.
 */
export const AVAILABLE_MODELS: EngineModelOption[] = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Qwen2.5 0.5B (fastest)', sizeLabel: '~0.75 GB' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 1B', sizeLabel: '~0.9 GB' },
  { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', label: 'SmolLM2 1.7B', sizeLabel: '~1.3 GB' },
];

export const DEFAULT_MODEL_ID = AVAILABLE_MODELS[0].id;

export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as unknown as { gpu?: unknown }).gpu;
}

const CONFIDENCE_TAG_RE = /Confidence Level:\s*\[?\s*(High|Medium|Low)\s*\]?\.?\s*$/i;

/**
 * Generic JavaScript orchestrator around a small (~0.5B-1.7B parameter) in-browser
 * model. The model is deliberately NEVER given tool-calling autonomy -- it is too
 * small to reliably drive tools. Instead this class runs the retrieval step itself
 * (executeWebSearch), formats the results into a restricted system prompt, and uses
 * the model purely as a grounded text synthesizer that must cite its sources.
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

  isReady(): boolean {
    return this.engine !== null;
  }

  /**
   * Boots the in-browser engine, streaming coarse download/compile progress (the
   * ~750MB-1.3GB model weights are cached by the browser after the first run).
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

    const confidenceMatch = fullText.match(CONFIDENCE_TAG_RE);
    const confidence = (confidenceMatch ? confidenceMatch[1] : null) as ConfidenceLevel | null;
    const answer = confidenceMatch ? fullText.slice(0, confidenceMatch.index).trim() : fullText.trim();

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
