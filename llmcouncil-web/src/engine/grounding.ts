import { sanitizePII } from './sanitize';
import type { ConfidenceLevel, SearchResult } from './types';

// Tolerant of markdown emphasis wrapping (models routinely bold this line despite
// instructions not to) and trailing punctuation, while still anchoring to the end of
// the reply so it only strips the actual trailing confidence line.
const CONFIDENCE_TAG_RE = /[\s*_]*Confidence Level[\s*_]*:[\s*_]*\[?\s*(High|Medium|Low)\s*\]?[\s*_.]*$/i;

// Reasoning-tuned models (e.g. DeepSeek-R1 distills) can emit a raw <think> block
// ahead of their real answer; it must never reach the rendered answer.
const THINK_BLOCK_RE = /<think>[\s\S]*?<\/think>/gi;

export function formatSources(sources: SearchResult[]): string {
  return sources.length
    ? sources.map((s) => `[${s.id}] ${s.title}\nURL: ${s.url}\nEXCERPT: ${s.content}`).join('\n\n')
    : '(No sources were retrieved for this query. Say so plainly instead of guessing.)';
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
