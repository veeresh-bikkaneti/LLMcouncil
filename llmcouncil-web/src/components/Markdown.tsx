import { Fragment, type ReactNode } from 'react';

// A deliberately small renderer: paragraphs, headings, lists, fenced code, **bold**,
// *italic*, `code` and http(s) links. It builds React elements (never raw HTML), so
// model output cannot inject markup.

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return (
        <code key={i} className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-[0.85em] dark:bg-zinc-800">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link)
      return (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline dark:text-violet-400">
          {link[1]}
        </a>
      );
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  | { t: 'code'; text: string }
  | { t: 'ul' | 'ol'; items: string[] };

function parse(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
      blocks.push({ t: 'code', text: body.join('\n') });
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push({ t: 'h', text: line.replace(/^#+\s*/, '') });
    } else if (/^\s*([-*•]|\d+[.)])\s/.test(line)) {
      const kind = /^\s*\d/.test(line) ? 'ol' : 'ul';
      const items: string[] = [];
      for (; i < lines.length && /^\s*([-*•]|\d+[.)])\s/.test(lines[i]); i++) items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
      i--;
      blocks.push({ t: kind, items });
    } else if (line.trim()) {
      const last = blocks[blocks.length - 1];
      if (last?.t === 'p') last.text += `\n${line}`;
      else blocks.push({ t: 'p', text: line });
    }
  }
  return blocks;
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parse(text).map((b, i) => {
        switch (b.t) {
          case 'h':
            return (
              <p key={i} className="font-semibold">
                {inline(b.text)}
              </p>
            );
          case 'code':
            return (
              <pre key={i} className="overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-900">
                {b.text}
              </pre>
            );
          case 'ul':
          case 'ol': {
            const List = b.t;
            return (
              <List key={i} className={`${b.t === 'ul' ? 'list-disc' : 'list-decimal'} space-y-1 pl-5`}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </List>
            );
          }
          default:
            return (
              <p key={i} className="whitespace-pre-wrap">
                {inline(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
