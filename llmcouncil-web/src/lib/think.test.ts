import { describe, expect, it } from 'vitest';
import { ThinkFilter } from './think';

const run = (chunks: string[]) => {
  const f = new ThinkFilter();
  return chunks.map((c) => f.push(c)).join('') + f.flush();
};

describe('ThinkFilter', () => {
  it('passes plain text through', () => {
    expect(run(['Hello ', 'world'])).toBe('Hello world');
  });
  it('strips a think block and the whitespace after it', () => {
    expect(run(['<think>hmm</think>\n\nAnswer'])).toBe('Answer');
  });
  it('handles tags split across chunks', () => {
    expect(run(['<thi', 'nk>secret</th', 'ink>Done'])).toBe('Done');
  });
  it('does not swallow a lone "<"', () => {
    expect(run(['a < b'])).toBe('a < b');
  });
  it('drops an unterminated think block', () => {
    expect(run(['Hi <think>never ends'])).toBe('Hi ');
  });
});
