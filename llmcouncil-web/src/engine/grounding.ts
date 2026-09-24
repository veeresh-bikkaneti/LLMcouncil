import { sanitizePII } from './sanitize';
import type { ConfidenceLevel, SearchResult } from './types';

// Tolerant of markdown emphasis wrapping (models routinely bold this line despite
// instructions not to) and trailing punctuation, while still anchoring to the end of
// the reply so it only strips the actual trailing confidence line.
const CONFIDENCE_TAG_RE = /[\s*_]*Confidence Level[\s*_]*:[\s*_]*\[?\s*(High|Medium|Low)\s*\]?[\s*_.]*$/i;

// Reasoning-tuned models (e.g. DeepSeek-R1 distills) can emit a raw <think> block
// ahead of their real answer; it must never reach the rendered answer.
const THINK_BLOCK_RE = /<think>[\s\S]*?<\/think>/gi;

// Every WebLLM model this app ships has a 4096-token context window (per
// prebuiltAppConfig). Prompt plus reply must fit in it, or WebLLM throws
// ContextWindowSizeExceededError instead of answering.
const LOCAL_CONTEXT_TOKENS = 4096;
// Deliberately pessimistic for English (~4 chars/token is typical), so the estimate
// errs toward cutting a little too much rather than overflowing.
const CHARS_PER_TOKEN = 3.5;
// Fixed instructions around the variable content (rules, persona, wrapper text,
// chat template), with headroom for text that tokenizes worse than English.
const PROMPT_OVERHEAD_TOKENS = 700;

// 3.5 chars/token only holds for ASCII text. CJK and other non-Latin scripts run
// closer to one token per character (or worse), so each non-ASCII character is
// charged as a whole token's worth of budget.
const NON_ASCII_COST = CHARS_PER_TOKEN;

function charCost(code: number): number {
  return code < 128 ? 1 : NON_ASCII_COST;
}

/** A text's size in budget units: ASCII chars count 1, non-ASCII chars a full token. */
export function promptCost(text: string): number {
  let cost = 0;
  for (let i = 0; i < text.length; i++) cost += charCost(text.charCodeAt(i));
  return cost;
}

/** Budget units (see promptCost) of variable prompt content that fit alongside a reply of `maxTokens`. */
export function localInputBudgetChars(maxTokens: number): number {
  return Math.floor((LOCAL_CONTEXT_TOKENS - maxTokens - PROMPT_OVERHEAD_TOKENS) * CHARS_PER_TOKEN);
}

/** Cuts `text` so its promptCost fits `maxCost`, marking the cut with an ellipsis. */
export function truncate(text: string, maxCost: number): string {
  if (promptCost(text) <= maxCost) return text;
  const limit = maxCost - NON_ASCII_COST; // room for the ellipsis
  let cost = 0;
  let end = 0;
  while (end < text.length) {
    const next = cost + charCost(text.charCodeAt(end));
    if (next > limit) break;
    cost = next;
    end++;
  }
  // Don't split a surrogate pair.
  if (end > 0 && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
  return `${text.slice(0, end).trimEnd()}…`;
}

/** Formats sources for a prompt, splitting `maxTotalChars` evenly across them. */
export function formatSources(sources: SearchResult[], maxTotalChars = Infinity): string {
  if (!sources.length) return '(No sources were retrieved for this query. Say so plainly instead of guessing.)';
  const perSource = maxTotalChars / sources.length;
  return sources
    .map((s) => {
      const header = `[${s.id}] ${s.title}\nURL: ${s.url}\nEXCERPT: `;
      return header + truncate(s.content, Math.max(80, Math.floor(perSource - promptCost(header))));
    })
    .join('\n\n');
}

export const GROUNDING_RULES = [
  'You do not have tools and cannot browse; all evidence you may use has already been ' +
    'retrieved for you and is listed in SOURCES.',
  'VERIFICATION: Base every factual claim ONLY on SOURCES. Ignore your own pre-trained ' +
    'knowledge. If the sources do not answer the question, say so plainly instead of inventing an answer.',
  'CITATIONS: Every sentence that states a fact must end with an inline bracket citation ' +
    'matching a source id, e.g. "Paris is the capital of France [1]." Never cite an id that is not listed.',
  'Never output personal data such as Social Security numbers, phone numbers, dates of birth, ' +
    'or home addresses even if present in a source; replace any such value with [REDACTED].',
].join('\n');

export const CONFIDENCE_RULE = [
  'End your ENTIRE reply with exactly one final line of the form:',
  'Confidence Level: [High/Medium/Low]',
  'Use High only when the sources fully and unambiguously answer the query, Medium when they ' +
    'partially cover it, Low when they conflict, are off-topic, or are missing.',
].join('\n');

export interface ParsedGroundedOutput {
  answer: string;
  confidence: ConfidenceLevel | null;
}

/** Strips reasoning traces and the confidence line, and scrubs PII from what's left. */
export function parseGroundedOutput(rawText: string): ParsedGroundedOutput {
  const withoutThinking = rawText.replace(THINK_BLOCK_RE, '').trim();
  const match = withoutThinking.match(CONFIDENCE_TAG_RE);
  const confidence = (match ? match[1] : null) as ConfidenceLevel | null;
  const body = match ? withoutThinking.slice(0, match.index).trim() : withoutThinking;
  // The model's own output is never trusted with PII: it can copy it out of a source
  // or hallucinate it, regardless of what the prompt asked.
  return { answer: sanitizePII(body), confidence };
}
