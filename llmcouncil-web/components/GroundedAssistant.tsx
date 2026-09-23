import React, { useEffect, useRef, useState } from 'react';
import {
  WebLLMChatbot,
  isWebGPUSupported,
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
} from '../src/engine/chatbot';
import type { ConfidenceLevel, SearchResult } from '../src/engine/types';
import { Markdown } from './Markdown';
import GroundingDrawer from './GroundingDrawer';
import { AlertTriangleIcon, CpuIcon, GlobeIcon, PaperAirplaneIcon, ShieldIcon } from './icons';

const SEARCH_KEY_STORAGE = 'llm_council_local_search_key_v1';

type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: SearchResult[];
  confidence?: ConfidenceLevel | null;
  isStreaming?: boolean;
}

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  High: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Low: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const GroundedAssistant: React.FC = () => {
  const [webgpuOk] = useState<boolean>(() => isWebGPUSupported());
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [progressText, setProgressText] = useState('');
  const [progressFraction, setProgressFraction] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [searchApiKey, setSearchApiKey] = useState<string>(() => localStorage.getItem(SEARCH_KEY_STORAGE) || '');
  const [showConfig, setShowConfig] = useState(true);

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSources, setDrawerSources] = useState<SearchResult[]>([]);
  const [drawerQuery, setDrawerQuery] = useState<string | null>(null);

  const botRef = useRef<WebLLMChatbot | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      botRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SEARCH_KEY_STORAGE, searchApiKey);
  }, [searchApiKey]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleLoadModel = async () => {
    if (!webgpuOk) return;
    setStatus('loading');
    setError(null);
    setProgressFraction(0);
    setProgressText('Preparing engine…');
    setShowConfig(false);

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
      setStatus('ready');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  };

  const handleSend = async () => {
    const query = input.trim();
    if (!query || !botRef.current || isStreaming || status !== 'ready') return;

    setInput('');
    const userTurn: ChatTurn = { id: uid(), role: 'user', text: query };
    const assistantId = uid();
    setMessages((prev) => [...prev, userTurn, { id: assistantId, role: 'assistant', text: '', isStreaming: true }]);
    setIsStreaming(true);

    try {
      const { answer, sources, confidence } = await botRef.current.sendMessage(query, (delta) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + delta } : m))
        );
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, text: answer, sources, confidence, isStreaming: false } : m))
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, text: `Error: ${(e as Error).message}`, isStreaming: false } : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const openDrawerFor = (turn: ChatTurn) => {
    const relatedUser = [...messages].reverse().find((m, idx, arr) => {
      const turnIdx = arr.findIndex((t) => t.id === turn.id);
      return m.role === 'user' && arr.indexOf(m) < turnIdx;
    });
    setDrawerSources(turn.sources || []);
    setDrawerQuery(relatedUser?.text ?? null);
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

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl backdrop-blur-xl flex flex-col gap-6 min-h-[640px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CpuIcon className="w-5 h-5 text-emerald-500" />
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">Local Assistant</h2>
            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">
              Runs entirely in your browser · No API key required
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowConfig((v) => !v)}
          className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-violet-400 transition-colors px-3 py-1.5 rounded-lg border border-slate-800 hover:border-violet-500/30"
        >
          {showConfig ? 'Hide Setup' : 'Setup'}
        </button>
      </div>

      {showConfig && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-3xl p-6 space-y-5 animate-fade-in">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Model (downloads once, cached by the browser)</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={status === 'loading'}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-200 outline-none focus:border-emerald-500/50 transition-all"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900">
                  {m.label} — {m.sizeLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <GlobeIcon className="w-3 h-3" /> Search API Key (optional — Tavily)
            </label>
            <input
              type="password"
              value={searchApiKey}
              onChange={(e) => setSearchApiKey(e.target.value)}
              placeholder="Leave blank to use free Wikipedia grounding"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-[11px] text-violet-300 font-mono outline-none focus:border-emerald-500/50 transition-all"
            />
            <p className="text-[9px] text-slate-600 leading-relaxed flex items-start gap-1.5 ml-1">
              <ShieldIcon className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-600" />
              Without a key, grounding falls back to Wikipedia's free public API — the app fully works
              with zero configuration. Your key never leaves the browser except to call the search API directly.
            </p>
          </div>

          <button
            onClick={handleLoadModel}
            disabled={status === 'loading'}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[11px] shadow-xl active:scale-95 transition-all"
          >
            {status === 'ready' ? 'Reload Model' : status === 'loading' ? 'Loading…' : 'Load Model'}
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Downloading & compiling…</span>
            <span>{Math.round(progressFraction * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-600 to-violet-600 transition-all duration-300"
              style={{ width: `${Math.max(2, progressFraction * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-600 font-mono truncate">{progressText}</p>
        </div>
      )}

      {status === 'error' && error && (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 text-[11px] text-rose-400">
          {error}
        </div>
      )}

      <div ref={transcriptRef} className="flex-grow overflow-y-auto custom-scrollbar space-y-5 pr-1 min-h-[240px]">
        {messages.length === 0 && status === 'ready' && (
          <div className="text-center text-[11px] text-slate-600 italic py-12">
            Ask something grounded in current information — every claim will cite its source.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-3xl p-5 shadow-lg ${
                m.role === 'user'
                  ? 'bg-violet-600/20 border border-violet-500/20 text-slate-100'
                  : 'bg-slate-950/70 border border-slate-800'
              }`}
            >
              {m.role === 'assistant' ? (
                <>
                  <Markdown text={m.text || (m.isStreaming ? '…' : '')} />
                  {!m.isStreaming && (
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-800/60">
                      {m.confidence && (
                        <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${CONFIDENCE_STYLES[m.confidence]}`}>
                          Confidence: {m.confidence}
                        </span>
                      )}
                      <button
                        onClick={() => openDrawerFor(m)}
                        className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                      >
                        <GlobeIcon className="w-3 h-3" />
                        Inspect {m.sources?.length || 0} source{m.sources?.length === 1 ? '' : 's'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-100 leading-relaxed">{m.text}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={status === 'ready' ? 'Ask a grounded question…' : 'Load the model to start chatting…'}
          disabled={status !== 'ready' || isStreaming}
          rows={2}
          className="flex-grow bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 focus:ring-2 focus:ring-emerald-500/40 outline-none resize-none transition-all shadow-inner placeholder:text-slate-700 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={status !== 'ready' || isStreaming || !input.trim()}
          className="px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition-all active:scale-95 flex items-center justify-center shadow-xl"
        >
          <PaperAirplaneIcon className="w-5 h-5 rotate-45" />
        </button>
      </div>

      <GroundingDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sources={drawerSources}
        query={drawerQuery}
      />
    </div>
  );
};

export default GroundedAssistant;
