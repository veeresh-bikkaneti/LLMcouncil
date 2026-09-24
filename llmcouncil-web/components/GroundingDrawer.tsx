import React from 'react';
import type { SearchResult } from '../src/engine/types';
import { CloseIcon, GlobeIcon } from './icons';

interface GroundingDrawerProps {
  open: boolean;
  onClose: () => void;
  sources: SearchResult[];
  query: string | null;
}

const SOURCE_BADGE_COLOR: Record<SearchResult['source'], string> = {
  tavily: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  brave: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  wikipedia: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  duckduckgo: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

/**
 * Collapsible side drawer exposing the raw metadata and source articles pulled by
 * executeWebSearch for the active prompt -- lets the user audit exactly what the
 * model was grounded on before trusting its citations.
 */
const GroundingDrawer: React.FC<GroundingDrawerProps> = ({ open, onClose, sources, query }) => {
  return (
    <div
      className={`fixed inset-y-0 right-0 z-[250] w-full sm:w-[420px] bg-slate-950/95 border-l border-slate-800 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-800/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <GlobeIcon className="w-5 h-5 text-emerald-500" />
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">Grounding Inspection</h3>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Raw retrieval evidence</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4">
          {query && (
            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2">
              Query: <span className="text-slate-400 normal-case font-medium">"{query}"</span>
            </div>
          )}

          {sources.length === 0 ? (
            <div className="text-xs text-slate-600 italic p-4 border border-dashed border-slate-800 rounded-2xl text-center">
              No sources retrieved for this turn yet.
            </div>
          ) : (
            sources.map((s) => (
              <div key={s.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-800 text-[10px] font-black text-white">
                      {s.id}
                    </span>
                    <span className="text-[12px] font-bold text-slate-100 truncate">{s.title}</span>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${SOURCE_BADGE_COLOR[s.source]}`}>
                    {s.source}
                  </span>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-violet-400 hover:text-violet-300 underline underline-offset-2 decoration-violet-500/30 break-all block"
                >
                  {s.url}
                </a>
                <p className="text-[11px] text-slate-400 leading-relaxed">{s.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GroundingDrawer;
