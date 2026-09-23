import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  WebLLMChatbot,
  isWebGPUSupported,
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
} from '../src/engine/chatbot';
import type { ConfidenceLevel, EngineModelOption, ModelCapability, ModelTier, SearchResult } from '../src/engine/types';
import GroundingDrawer from './GroundingDrawer';
import {
  AlertTriangleIcon,
  ChevronRightIcon,
  CpuIcon,
  GlobeIcon,
  PaperAirplaneIcon,
  ShieldIcon,
} from './icons';

const SEARCH_KEY_STORAGE = 'llm_council_local_search_key_v1';

type EngineStatus = 'setup' | 'loading' | 'ready' | 'error';

interface Turn {
  id: string;
  query: string;
  answer: string;
  sources: SearchResult[];
  confidence: ConfidenceLevel | null;
  isStreaming: boolean;
  error?: string;
}

const CONFIDENCE_TEXT: Record<ConfidenceLevel, string> = {
  High: 'text-emerald-300',
  Medium: 'text-amber-300',
  Low: 'text-rose-300',
};

const CONFIDENCE_DOT: Record<ConfidenceLevel, string> = {
  High: 'bg-emerald-400',
  Medium: 'bg-amber-400',
  Low: 'bg-rose-400',
};

const CAPABILITY_LABEL: Record<ModelCapability, string> = {
  reasoning: 'Reasoning',
  'chain-of-thought': 'Chain-of-Thought',
  'tool-calling': 'Tool-Calling',
  fast: 'Fast',
  summarizing: 'Summarizing',
  understanding: 'Understanding',
};

const CAPABILITY_TEXT: Record<ModelCapability, string> = {
  reasoning: 'text-violet-300',
  'chain-of-thought': 'text-violet-300',
  'tool-calling': 'text-amber-300',
  fast: 'text-emerald-300',
  summarizing: 'text-slate-400',
  understanding: 'text-slate-400',
};

const CAPABILITY_DOT: Record<ModelCapability, string> = {
  reasoning: 'bg-violet-400',
  'chain-of-thought': 'bg-violet-400',
  'tool-calling': 'bg-amber-400',
  fast: 'bg-emerald-400',
  summarizing: 'bg-slate-500',
  understanding: 'bg-slate-500',
};

const TIER_LABEL: Record<ModelTier, string> = {
  fast: 'Fast & Light',
  balanced: 'Balanced Reasoning',
  deep: 'Deep Reasoning & Tools',
};

const TIER_COLOR: Record<ModelTier, string> = {
  fast: 'text-emerald-400',
  balanced: 'text-violet-400',
  deep: 'text-amber-400',
};

const SOURCE_AVATAR: Record<SearchResult['source'], { letter: string; classes: string }> = {
  wikipedia: { letter: 'W', classes: 'bg-emerald-500/15 text-emerald-300' },
  tavily: { letter: 'T', classes: 'bg-violet-500/15 text-violet-300' },
  brave: { letter: 'B', classes: 'bg-amber-500/15 text-amber-300' },
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const CITATION_RE = /(\[\d+\])/g;

const DotTag: React.FC<{ text: string; dot: string; label: string }> = ({ text, dot, label }) => (
  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wide whitespace-nowrap ${text}`}>
    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
    {label}
  </span>
);

/** Renders grounded answer text, turning inline "[n]" citation markers into superscript badges. */
const CitedText: React.FC<{ text: string }> = ({ text }) => {
  const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
  return (
    <>
      {paragraphs.map((para, pIdx) => (
        <p key={pIdx} className="text-[15.5px] leading-[1.8] text-slate-200 my-0 max-w-[62ch]">
          {para.split(CITATION_RE).map((part, i) =>
            CITATION_RE.test(part) ? (
              <sup key={i} className="text-violet-300 font-extrabold text-[11px] mx-0.5">
                {part.replace(/[[\]]/g, '')}
              </sup>
            ) : (
              <React.Fragment key={i}>{part}</React.Fragment>
            )
          )}
        </p>
      ))}
    </>
  );
};

const ModelCard: React.FC<{ model: EngineModelOption; selected: boolean; onSelect: () => void }> = ({
  model,
  selected,
  onSelect,
}) => (
  <button
    onClick={onSelect}
    className={`relative text-left w-full rounded-[1.375rem] p-6 flex flex-col gap-4 transition-all bg-gradient-to-b to-transparent ${
      selected
        ? '-translate-y-1.5 from-violet-500/10 bg-[#0d0b18] border border-violet-500/45 shadow-[0_0_0_1px_rgba(139,92,246,0.15),0_24px_48px_-20px_rgba(124,58,237,0.45)]'
        : 'from-white/[0.035] bg-[#0b0d15] border border-white/[0.08] shadow-[0_20px_36px_-26px_rgba(0,0,0,0.7)] hover:border-white/20'
    }`}
  >
    {model.recommended && (
      <span className="absolute -top-3 right-6 bg-gradient-to-b from-violet-400 to-violet-600 text-white text-[9px] font-extrabold uppercase tracking-widest px-3.5 py-1.5 rounded-full shadow-[0_8px_16px_-6px_rgba(124,58,237,0.7)]">
        Recommended
      </span>
    )}
    <div>
      <div className="text-[16px] font-bold text-white">{model.label}</div>
      <div className="font-mono text-[10.5px] text-slate-500 mt-1 tracking-wide">
        {model.sizeLabel.replace('~', '')} · {model.vramLabel.replace('~', '')}
      </div>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {model.capabilities.map((c) => (
        <DotTag key={c} text={CAPABILITY_TEXT[c]} dot={CAPABILITY_DOT[c]} label={CAPABILITY_LABEL[c]} />
      ))}
    </div>
    <p className="text-[12.5px] text-slate-500 leading-relaxed">{model.description}</p>
    <div
      className={`mt-1 text-center py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-widest ${
        selected
          ? 'bg-gradient-to-b from-violet-400 to-violet-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]'
          : 'border border-white/10 text-slate-300'
      }`}
    >
      {selected ? 'Selected' : 'Select'}
    </div>
  </button>
);

const SourceChip: React.FC<{ source: SearchResult }> = ({ source }) => {
  const avatar = SOURCE_AVATAR[source.source];
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 w-[260px] hover:border-violet-500/30 transition-colors flex-shrink-0"
    >
      <span className={`w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center flex-shrink-0 ${avatar.classes}`}>
        {avatar.letter}
      </span>
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-slate-200 truncate">{source.title}</div>
        <div className="font-mono text-[9.5px] text-slate-600 truncate">
          {source.id} · {source.source}
        </div>
      </div>
    </a>
  );
};

const AnswerCard: React.FC<{ turn: Turn; accent?: boolean; onViewSources: () => void }> = ({ turn, onViewSources }) => (
  <div className="bg-gradient-to-b from-white/[0.03] to-transparent bg-[#0b0d15] border border-white/[0.08] border-l-[3px] border-l-violet-500 rounded-[1.5rem] p-7 sm:p-8 flex flex-col gap-5 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.8)]">
    <div className="flex items-center justify-between">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-500">Grounded Answer</span>
      {turn.confidence && <DotTag text={CONFIDENCE_TEXT[turn.confidence]} dot={CONFIDENCE_DOT[turn.confidence]} label={`Confidence · ${turn.confidence}`} />}
    </div>

    {turn.error ? (
      <p className="text-[13px] text-rose-400">{turn.error}</p>
    ) : (
      <div className="space-y-3">
        <CitedText text={turn.answer || (turn.isStreaming ? '…' : '')} />
      </div>
    )}

    {!turn.isStreaming && turn.sources.length > 0 && (
      <>
        <div className="h-px bg-white/[0.08]" />
        <div className="flex gap-3.5 overflow-x-auto pb-1 custom-scrollbar">
          {turn.sources.slice(0, 4).map((s) => (
            <SourceChip key={s.id} source={s} />
          ))}
        </div>
        <div className="flex justify-end">
          <button
            onClick={onViewSources}
            className="text-[10.5px] font-bold uppercase tracking-widest text-slate-500 hover:text-violet-400 transition-colors"
          >
            View all {turn.sources.length} source{turn.sources.length === 1 ? '' : 's'} →
          </button>
        </div>
      </>
    )}
  </div>
);

const GroundedAssistant: React.FC = () => {
  const [webgpuOk] = useState<boolean>(() => isWebGPUSupported());
  const [status, setStatus] = useState<EngineStatus>('setup');
  const [progressText, setProgressText] = useState('');
  const [progressFraction, setProgressFraction] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [searchApiKey, setSearchApiKey] = useState<string>(() => localStorage.getItem(SEARCH_KEY_STORAGE) || '');

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSources, setDrawerSources] = useState<SearchResult[]>([]);
  const [drawerQuery, setDrawerQuery] = useState<string | null>(null);

  const botRef = useRef<WebLLMChatbot | null>(null);
  const selectedModel = useMemo(() => AVAILABLE_MODELS.find((m) => m.id === modelId) ?? AVAILABLE_MODELS[0], [modelId]);

  useEffect(() => {
    return () => {
      botRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SEARCH_KEY_STORAGE, searchApiKey);
  }, [searchApiKey]);

  const handleLoadModel = async () => {
    if (!webgpuOk) return;
    setStatus('loading');
    setError(null);
    setProgressFraction(0);
    setProgressText('Preparing engine…');

    await botRef.current?.dispose();

    const bot = new WebLLMChatbot({
      modelId,
      searchApiKey: searchApiKey.trim() || undefined,
    });

    try {
      await bot.init((text, fraction) => {
        setProgressText(text);
        if (typeof fraction === 'number') setProgressFraction(fraction);
      });
      botRef.current = bot;
      setTurns([]);
      setStatus('ready');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  };

  const handleChangeModel = async () => {
    await botRef.current?.dispose();
    botRef.current = null;
    setTurns([]);
    setStatus('setup');
  };

  const handleSend = async () => {
    const query = input.trim();
    if (!query || !botRef.current || isStreaming || status !== 'ready') return;

    setInput('');
    const turnId = uid();
    setTurns((prev) => [...prev, { id: turnId, query, answer: '', sources: [], confidence: null, isStreaming: true }]);
    setExpandedTurnId(turnId);
    setIsStreaming(true);

    try {
      const { answer, sources, confidence } = await botRef.current.sendMessage(query, (delta) => {
        setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, answer: t.answer + delta } : t)));
      });
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, answer, sources, confidence, isStreaming: false } : t)));
    } catch (e) {
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, isStreaming: false, error: (e as Error).message } : t))
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const openDrawerFor = (turn: Turn) => {
    setDrawerSources(turn.sources);
    setDrawerQuery(turn.query);
    setDrawerOpen(true);
  };

  if (!webgpuOk) {
    return (
      <div className="bg-slate-900/90 border border-amber-500/20 rounded-[2.5rem] p-10 shadow-2xl backdrop-blur-xl text-center space-y-4">
        <AlertTriangleIcon className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-xl font-black text-white uppercase tracking-tight">WebGPU Unavailable</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          This browser doesn't expose WebGPU, so the in-browser model can't run. Use a recent desktop
          build of Chrome or Edge, or switch back to the <b className="text-slate-200">Universal Council</b>{' '}
          mode and connect a cloud API key instead.
        </p>
      </div>
    );
  }

  // ---- Setup screen: pick a model, no chat UI at all ----
  if (status !== 'ready') {
    const tiers: ModelTier[] = ['fast', 'balanced', 'deep'];
    return (
      <div
        className="relative bg-slate-900/90 bg-[radial-gradient(1100px_circle_at_10%_-10%,rgba(139,92,246,0.14),transparent_58%),radial-gradient(900px_circle_at_95%_5%,rgba(16,185,129,0.08),transparent_55%)] border border-slate-800 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl backdrop-blur-xl flex flex-col gap-12 overflow-hidden"
      >
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="max-w-xl space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-400">Local Assistant · Setup</span>
            <h2 className="text-4xl font-extrabold text-white tracking-tight leading-[1.05]">Choose an on-device model</h2>
            <p className="text-[13.5px] text-slate-500 leading-relaxed">
              Runs entirely in this browser via WebGPU. Bigger models reason and summarize better, closer to
              what you'd get from Chrome's in-browser AI Mode — pick one that fits your hardware. No cloud API
              key is required for any tier.
            </p>
          </div>
          <div className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.09] rounded-full pl-4 pr-5 py-2.5 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.18)]" />
            <span className="text-[11px] font-bold tracking-wide text-slate-200">WebGPU Supported</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div key={tier} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2.5">
                <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${TIER_COLOR[tier]}`}>{TIER_LABEL[tier]}</span>
                <div className="h-px bg-gradient-to-r from-white/15 to-transparent" />
              </div>
              {AVAILABLE_MODELS.filter((m) => m.tier === tier).map((m) => (
                <ModelCard key={m.id} model={m} selected={modelId === m.id} onSelect={() => setModelId(m.id)} />
              ))}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-7 bg-white/[0.025] border border-white/[0.07] rounded-[1.5rem] p-7">
          <div className="space-y-2">
            <span className="text-[10.5px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <GlobeIcon className="w-3.5 h-3.5" /> Web grounding
            </span>
            <p className="text-[12.5px] text-slate-500 leading-relaxed">
              Every answer is grounded in sources retrieved before the model runs — never invented, never browsed
              by the model itself. Bring your own Tavily/Brave key for live web search, or use the free, keyless
              Wikipedia fallback with zero setup.
            </p>
          </div>
          <div className="flex flex-col justify-center gap-2">
            <input
              type="password"
              value={searchApiKey}
              onChange={(e) => setSearchApiKey(e.target.value)}
              placeholder="Optional: Tavily/Brave API key"
              className="w-full bg-[#05060a] border border-white/[0.08] rounded-xl p-3.5 text-[11.5px] text-violet-300 font-mono outline-none focus:border-emerald-500/50 transition-all"
            />
            <span className="text-[10px] text-slate-600">Leave blank to use the free Wikipedia fallback.</span>
          </div>
        </div>

        {status === 'loading' && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-3">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span>Downloading &amp; compiling…</span>
              <span>{Math.round(progressFraction * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-violet-500 transition-all duration-300"
                style={{ width: `${Math.max(2, progressFraction * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-600 font-mono truncate">{progressText}</p>
          </div>
        )}

        {status === 'error' && error && (
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 text-[11px] text-rose-400">{error}</div>
        )}

        <div className="flex items-center justify-between gap-6 flex-wrap">
          <p className="text-[10.5px] text-slate-600 leading-relaxed max-w-lg">
            SSNs, phone numbers, dates of birth and emails are scrubbed from your messages and from retrieved
            sources on-device, before anything leaves the browser.
          </p>
          <button
            onClick={handleLoadModel}
            disabled={status === 'loading'}
            className="px-9 py-4 bg-gradient-to-b from-violet-400 to-violet-600 disabled:opacity-50 text-white font-extrabold rounded-2xl uppercase tracking-[0.14em] text-[11px] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_16px_32px_-12px_rgba(124,58,237,0.55)] active:scale-95 transition-all flex-shrink-0"
          >
            {status === 'loading' ? 'Loading…' : `Load ${selectedModel.label} →`}
          </button>
        </div>
      </div>
    );
  }

  // ---- Assistant screen: search-bar + grounded answer cards, not a chat thread ----
  const latestTurn = turns[turns.length - 1];
  const olderTurns = turns.slice(0, -1);

  return (
    <div className="relative bg-slate-900/90 bg-[radial-gradient(1000px_circle_at_85%_-10%,rgba(139,92,246,0.10),transparent_55%)] border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col gap-6 min-h-[640px]">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-[12px] font-bold text-slate-500">
              <CpuIcon className="w-3.5 h-3.5" /> Local Assistant
            </span>
            <span className="w-px h-3.5 bg-white/10" />
            <div className="flex items-center gap-3">
              <span className="text-[12.5px] font-bold text-white">{selectedModel.label}</span>
              {selectedModel.capabilities.slice(0, 2).map((c) => (
                <DotTag key={c} text={CAPABILITY_TEXT[c]} dot={CAPABILITY_DOT[c]} label={CAPABILITY_LABEL[c]} />
              ))}
              <button onClick={handleChangeModel} className="text-[11px] font-bold text-violet-400 hover:text-violet-300 transition-colors">
                Change
              </button>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <DotTag
              text="text-emerald-300"
              dot="bg-emerald-400"
              label={`Grounding · ${searchApiKey ? 'Cloud Search' : 'Wikipedia (free)'}`}
            />
            <button className="px-4 py-2 rounded-lg border border-white/[0.1] bg-white/[0.02] text-slate-300 text-[11px] font-bold flex items-center gap-1.5">
              <ShieldIcon className="w-3 h-3" /> View sources
            </button>
          </div>
        </div>
        <div className="h-px bg-white/[0.08]" />
      </div>

      {/* Search-style query bar */}
      <div className="flex items-center gap-3 bg-white/[0.035] border border-violet-500/35 shadow-[0_0_0_3px_rgba(124,58,237,0.10)] rounded-full pl-6 pr-2 py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={turns.length === 0 ? 'Ask a grounded question…' : 'Ask a follow-up…'}
          disabled={isStreaming}
          className="flex-grow bg-transparent text-[14px] text-slate-100 placeholder:text-slate-600 outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          aria-label="Ask"
          className="w-11 h-11 rounded-full bg-gradient-to-b from-violet-400 to-violet-600 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-all active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
        >
          <PaperAirplaneIcon className="w-4 h-4 rotate-45" />
        </button>
      </div>

      {turns.length === 0 ? (
        <div className="text-center text-[11px] text-slate-600 italic py-16">
          Ask something grounded in current information — every claim will cite its source.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {latestTurn && <AnswerCard turn={latestTurn} onViewSources={() => openDrawerFor(latestTurn)} />}

          {olderTurns.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-widest text-slate-600 mb-2">Earlier in this session</span>
              {[...olderTurns].reverse().map((t) => (
                <div key={t.id} className="flex flex-col">
                  <button
                    onClick={() => setExpandedTurnId(expandedTurnId === t.id ? null : t.id)}
                    className="flex items-center gap-4 px-1.5 py-3.5 hover:bg-white/[0.02] rounded-xl transition-colors text-left w-full"
                  >
                    {t.confidence && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CONFIDENCE_DOT[t.confidence]}`} />}
                    <span className="flex-grow text-[13.5px] text-slate-300 truncate">{t.query}</span>
                    {t.confidence && <span className={`text-[10px] font-bold ${CONFIDENCE_TEXT[t.confidence]}`}>{t.confidence}</span>}
                    <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-600 flex-shrink-0 transition-transform ${expandedTurnId === t.id ? 'rotate-90' : ''}`} />
                  </button>
                  <div className="h-px bg-white/[0.06]" />
                  {expandedTurnId === t.id && <div className="pt-4"><AnswerCard turn={t} onViewSources={() => openDrawerFor(t)} /></div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <GroundingDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} sources={drawerSources} query={drawerQuery} />
    </div>
  );
};

export default GroundedAssistant;
