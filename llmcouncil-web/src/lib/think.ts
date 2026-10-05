/**
 * Reasoning models (DeepSeek-R1 distills, Qwen3, ...) emit a <think>…</think> block
 * before the real answer. This strips it from a token stream, even when a tag is
 * split across chunks.
 */
const OPEN = '<think>';
const CLOSE = '</think>';

export class ThinkFilter {
  private buf = '';
  private inThink = false;

  /** Feed a raw chunk; returns the text that is safe to show. */
  push(chunk: string): string {
    this.buf += chunk;
    let out = '';
    for (;;) {
      if (this.inThink) {
        const end = this.buf.indexOf(CLOSE);
        if (end === -1) {
          // Keep a possible partial closing tag; drop everything before it.
          this.buf = this.buf.slice(Math.max(0, this.buf.length - (CLOSE.length - 1)));
          return out;
        }
        this.buf = this.buf.slice(end + CLOSE.length).replace(/^\s+/, '');
        this.inThink = false;
      } else {
        const start = this.buf.indexOf(OPEN);
        if (start === -1) {
          // Hold back a trailing fragment that could still become "<think>".
          const hold = partialSuffix(this.buf, OPEN);
          out += this.buf.slice(0, this.buf.length - hold);
          this.buf = this.buf.slice(this.buf.length - hold);
          return out;
        }
        out += this.buf.slice(0, start);
        this.buf = this.buf.slice(start + OPEN.length);
        this.inThink = true;
      }
    }
  }

  /** Call once the stream ends to release any held-back text. */
  flush(): string {
    const rest = this.inThink ? '' : this.buf;
    this.buf = '';
    this.inThink = false;
    return rest;
  }
}

function partialSuffix(text: string, tag: string): number {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
    if (text.endsWith(tag.slice(0, n))) return n;
  }
  return 0;
}
