import { executeWebSearch } from './search';
import { sanitizePII } from './sanitize';
import { generate, loadModel, type ProgressFn } from './engineManager';
import { CONFIDENCE_RULE, formatSources, GROUNDING_RULES, localInputBudgetChars, parseGroundedOutput, truncate } from './grounding';
import { DEFAULT_MODEL_ID } from './models';
import type { SearchResult, SendMessageResult, WebLLMChatbotOptions } from './types';

export { AVAILABLE_MODELS, DEFAULT_MODEL_ID, isWebGPUSupported } from './models';

const MAX_REPLY_TOKENS = 900;

/**
 * Generic JavaScript orchestrator around in-browser models. The model is never given
 * tool-calling control: this class runs retrieval itself (executeWebSearch), formats
 * the results into a restricted system prompt, and uses the model purely as a
 * grounded text synthesizer that must cite its sources. The engine itself lives in
 * engineManager and is shared with the Council.
 */
export class WebLLMChatbot {
  private readonly modelId: string;
  private readonly searchApiKey?: string;
  private readonly searchProvider: WebLLMChatbotOptions['searchProvider'];
  private readonly maxSources: number;
  private ready = false;

  constructor(options: WebLLMChatbotOptions = {}) {
    this.modelId = options.modelId || DEFAULT_MODEL_ID;
    this.searchApiKey = options.searchApiKey;
    this.searchProvider = options.searchProvider || 'auto';
    this.maxSources = options.maxSources ?? 5;
  }

  getModelId(): string {
    return this.modelId;
  }

  /** Downloads (first run only; the browser caches weights) and compiles the model. */
  async init(onProgress: ProgressFn): Promise<void> {
    await loadModel(this.modelId, onProgress);
    this.ready = true;
  }

  /** Sanitizes the query before it leaves the browser, and scrubs what comes back. */
  async executeWebSearch(query: string): Promise<SearchResult[]> {
    const rawResults = await executeWebSearch(sanitizePII(query.trim()), {
      apiKey: this.searchApiKey,
      provider: this.searchProvider,
      maxResults: this.maxSources,
    });
    return rawResults.map((r) => ({ ...r, title: sanitizePII(r.title), content: sanitizePII(r.content) }));
  }

  /** One turn of the orchestrator: search -> ground -> synthesize, at temperature 0. */
  async sendMessage(userQuery: string, onToken: (delta: string) => void): Promise<SendMessageResult> {
    if (!this.ready) {
      throw new Error('Engine not initialized. Call init() before sendMessage().');
    }

    const safeQuery = sanitizePII(userQuery.trim());
    const sources = await this.executeWebSearch(safeQuery);
    // Prompt plus reply must fit the model's 4096-token context window.
    const budget = localInputBudgetChars(MAX_REPLY_TOKENS);
    const promptQuery = truncate(safeQuery, Math.floor(budget * 0.25));
    const systemPrompt = [
      'You are a strict fact-grounding rewriter.',
      GROUNDING_RULES,
      CONFIDENCE_RULE,
      `SOURCES:\n${formatSources(sources, budget - promptQuery.length)}`,
    ].join('\n\n');

    const fullText = await generate(
      this.modelId,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptQuery },
      ],
      { temperature: 0, maxTokens: MAX_REPLY_TOKENS, onToken }
    );

    const { answer, confidence } = parseGroundedOutput(fullText);
    return { fullText, answer, sources, confidence };
  }

  /**
   * The shared engine stays loaded (the Council may reuse it); loading a different
   * model later swaps it out, so there is nothing to release here.
   */
  async dispose(): Promise<void> {
    this.ready = false;
  }
}
