// Lightweight, client-side PII scrubber. Applied to every user query and every
// retrieved grounding source before it reaches the model, the network, or the UI --
// so personal data (SSNs, phone numbers, dates of birth, emails) is never forwarded
// to a search connector or echoed back in a response.

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
// Bare 9-digit SSNs (no dashes) are common enough in casual typing to be worth the
// false-positive risk on other 9-digit numbers -- SSN is the one PII type called out
// explicitly and unconditionally, so we err on the side of over-redacting here.
const SSN_PLAIN_RE = /\b\d{9}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}\b/g;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const DOB_RE = /\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](\d{4}|\d{2})\b/g;
// Deliberately NOT matching textual dates ("January 5, 1990") or general international
// phone formats here: those patterns collide too often with ordinary factual content
// (historical dates, article publish dates) in retrieved sources and model answers,
// and over-redacting there would break legitimate answers. Numeric MM/DD/YYYY and
// US-style phone numbers are the low-collateral-damage subset we can safely blanket.

export function sanitizePII(input: string): string {
  if (!input) return input;
  return input
    .replace(SSN_RE, '[REDACTED-SSN]')
    .replace(SSN_PLAIN_RE, '[REDACTED-SSN]')
    .replace(EMAIL_RE, '[REDACTED-EMAIL]')
    .replace(DOB_RE, '[REDACTED-DATE]')
    .replace(PHONE_RE, '[REDACTED-PHONE]');
}
