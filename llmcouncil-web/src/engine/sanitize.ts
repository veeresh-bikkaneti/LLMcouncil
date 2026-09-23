// Lightweight, client-side PII scrubber. Applied to every user query and every
// retrieved grounding source before it reaches the model, the network, or the UI --
// so personal data (SSNs, phone numbers, dates of birth, emails) is never forwarded
// to a search connector or echoed back in a response.

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b/g;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const DOB_RE = /\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](\d{4}|\d{2})\b/g;

export function sanitizePII(input: string): string {
  if (!input) return input;
  return input
    .replace(SSN_RE, '[REDACTED-SSN]')
    .replace(EMAIL_RE, '[REDACTED-EMAIL]')
    .replace(DOB_RE, '[REDACTED-DATE]')
    .replace(PHONE_RE, '[REDACTED-PHONE]');
}
