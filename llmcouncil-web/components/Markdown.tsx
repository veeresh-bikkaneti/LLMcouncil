import React from 'react';

const parseInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="text-slate-100 italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-violet-400 font-mono text-[11px]">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('[') && part.includes('](')) {
        const match = part.match(/\[(.*?)\]\((.*?)\)/);
        if (match) {
            return <a key={i} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 underline underline-offset-4 decoration-violet-500/30 transition-all">{match[1]}</a>;
        }
    }
    return part;
  });
};

export const Markdown: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/);

  return (
    <div className="text-slate-300 text-sm leading-relaxed space-y-4 font-medium">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
          const lang = match?.[1] || '';
          const code = match?.[2] || '';
          return (
            <pre key={i} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 overflow-x-auto my-6 font-mono text-[11px] text-violet-300 shadow-inner">
              {lang && <div className="text-[9px] text-slate-600 uppercase mb-3 font-black tracking-widest border-b border-slate-800 pb-2">{lang}</div>}
              <code className="block leading-relaxed">{code.trim()}</code>
            </pre>
          );
        }

        const lines = part.split('\n');
        const renderedElements: React.ReactNode[] = [];
        let currentList: React.ReactNode[] = [];
        let inTable = false;
        let tableRows: string[][] = [];

        const flushList = () => {
          if (currentList.length > 0) {
            renderedElements.push(<ul key={`list-${renderedElements.length}`} className="list-disc pl-6 space-y-2 marker:text-violet-500 my-5">{currentList}</ul>);
            currentList = [];
          }
        };

        const flushTable = () => {
          if (inTable && tableRows.length > 0) {
            const headerRow = tableRows[0];
            const dataRows = tableRows.slice(1).filter(row => !row.every(c => c.trim().match(/^[-:|]+$/)));
            
            renderedElements.push(
              <div key={`table-${renderedElements.length}`} className="overflow-x-auto my-8 rounded-2xl border border-slate-800 shadow-2xl bg-slate-900/20">
                <table className="w-full border-collapse text-[12px]">
                  <thead className="bg-slate-900/80 border-b border-slate-800">
                    <tr>
                      {headerRow.map((cell, idx) => (
                        <th key={idx} className="p-4 text-left font-black uppercase tracking-[0.1em] text-violet-400 whitespace-nowrap">{cell.trim()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {dataRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-violet-500/[0.03] transition-colors">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-4 text-slate-400 font-medium">{parseInline(cell.trim())}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
            inTable = false;
            tableRows = [];
          }
        };

        lines.forEach((line, lIdx) => {
          const trimmed = line.trim();

          if (trimmed.startsWith('#')) {
            flushList();
            flushTable();
            const level = (trimmed.match(/^#+/) || ['#'])[0].length;
            const content = trimmed.replace(/^#+\s*/, '');
            const sizes = ['', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs'];
            renderedElements.push(
              <h4 key={lIdx} className={`${sizes[level] || 'text-base'} font-black text-white uppercase tracking-tight mt-10 mb-5 border-b border-slate-800/50 pb-3 flex items-center gap-3`}>
                <span className="w-1.5 h-1.5 bg-violet-600 rounded-full" />
                {parseInline(content)}
              </h4>
            );
            return;
          }

          if (trimmed.match(/^([-*]|\d+\.)\s+/)) {
            flushTable();
            currentList.push(<li key={lIdx} className="pl-1 text-slate-300">{parseInline(trimmed.replace(/^([-*]|\d+\.)\s+/, ''))}</li>);
            return;
          }

          if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            flushList();
            inTable = true;
            tableRows.push(trimmed.split('|').filter((s, i, arr) => i > 0 && i < arr.length - 1));
            return;
          }

          if (trimmed.match(/^[-*_]{3,}$/)) {
            flushList();
            flushTable();
            renderedElements.push(<hr key={lIdx} className="border-slate-800/50 my-10" />);
            return;
          }

          if (trimmed === '') {
            flushList();
            flushTable();
          } else {
            if (!inTable) {
              flushList();
              renderedElements.push(<p key={lIdx} className="my-4 leading-relaxed">{parseInline(line)}</p>);
            }
          }
        });

        flushList();
        flushTable();

        return renderedElements;
      })}
    </div>
  );
};