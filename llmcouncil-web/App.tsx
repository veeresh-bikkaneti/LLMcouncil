import React, { useState, useCallback, useRef, useEffect, Suspense, lazy } from 'react';
import { AgentRole, type AgentAnalysis, type ConsensusReport, type ModelQuota, type AnswerMode } from './types';
import { analyzeWithAgent, cancelLocalGenerations, synthesizeConsensus, sanitizeText, type LocalRunHooks } from './services/inferenceService';
import InputPanel, { INITIAL_MODELS, isSelectableModel } from './components/TicketInputForm';
import CouncilView from './components/CouncilView';
import ConsensusDashboard from './components/ConsensusDashboard';
import ModeSwitcher, { type AppMode } from './components/ModeSwitcher';
import { LogoIcon } from './components/icons';
import { DEFAULT_COUNCIL_SEATS, isWebGPUSupported } from './src/engine/models';
import { executeWebSearch } from './src/engine/search';
import { sanitizePII } from './src/engine/sanitize';
import type { SearchResult } from './src/engine/types';
import { currentEpoch } from './src/engine/cancellation';

// Lazy-loaded so the @mlc-ai/web-llm engine (and its WASM/model download machinery)
// is only pulled into the bundle when the user actually switches to Local Assistant mode.
const GroundedAssistant = lazy(() => import('./components/GroundedAssistant'));

// v4: earlier builds saved Gemini defaults here, which a keyless deployment can't run.
// v5: earlier builds put one model in every seat; the defaults now mix three families.
// v6: the Council dropped from 4 models (3 members + a chair reusing one of them) to
// 3: two members deliberate, a third, dedicated model gives the Final Arbitration.
const STORAGE_KEY = 'llm_council_selections_v6';
const MODE_STORAGE_KEY = 'llm_council_mode_v1';
// Shared with the Local Assistant, so one optional Tavily/Brave key serves both modes.
const SEARCH_KEY_STORAGE = 'llm_council_local_search_key_v1';
const PRIVACY_FILTER_ID = 'on-device-pii-filter';

const COUNCIL_ROLES = [AgentRole.Model1, AgentRole.Model2];

const defaultSelections = (): Record<AgentRole, string> => ({
  [AgentRole.Privacy]: PRIVACY_FILTER_ID,
  [AgentRole.Model1]: DEFAULT_COUNCIL_SEATS.members[0],
  [AgentRole.Model2]: DEFAULT_COUNCIL_SEATS.members[1],
  [AgentRole.Chairperson]: DEFAULT_COUNCIL_SEATS.chair,
});

/** Keeps saved seat choices only while they still point at a selectable model. */
const loadSelections = (registry: ModelQuota[]): Record<AgentRole, string> => {
  const defaults = defaultSelections();
  let saved: Partial<Record<AgentRole, string>> = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    // corrupt entry: fall back to defaults
  }
  const selectable = new Set(registry.filter(isSelectableModel).map(m => m.id));
  for (const role of [...COUNCIL_ROLES, AgentRole.Chairperson]) {
    const id = saved[role];
    if (id && selectable.has(id)) defaults[role] = id;
  }
  return defaults;
};

const retrieveSources = async (query: string): Promise<SearchResult[]> => {
  const results = await executeWebSearch(query, {
    apiKey: localStorage.getItem(SEARCH_KEY_STORAGE)?.trim() || undefined,
    maxResults: 5,
  });
  return results.map(r => ({ ...r, title: sanitizePII(r.title), content: sanitizePII(r.content) }));
};

interface EngineProgress {
  text: string;
  fraction?: number;
}

const App: React.FC = () => {
  // Default to Local Assistant: the whole point of that mode is that it works with
  // zero cloud API key, so that's what a first-time visitor should land on.
  const [mode, setMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    return saved === 'council' || saved === 'local' ? saved : 'local';
  });
  const [query, setQuery] = useState<string>('');
  const [useAutomation, setUseAutomation] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [requestCounts, setRequestCounts] = useState<Record<string, number>>({});
  const [registry, setRegistry] = useState<ModelQuota[]>(INITIAL_MODELS);
  const [answerMode, setAnswerMode] = useState<AnswerMode>('complex');
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [engineProgress, setEngineProgress] = useState<EngineProgress | null>(null);
  // Each run takes a new id; a run whose id is no longer current (aborted, or
  // superseded by a newer run) must not touch state, so its late results can never
  // overwrite a newer run's.
  const runIdRef = useRef(0);

  const [selectedModelIds, setSelectedModelIds] = useState<Record<AgentRole, string>>(() => loadSelections(INITIAL_MODELS));

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedModelIds));
  }, [selectedModelIds]);

  const [agentAnalyses, setAgentAnalyses] = useState<AgentAnalysis[]>([]);

  useEffect(() => {
    const newState: AgentAnalysis[] = Object.values(AgentRole).map(role => {
      const modelId = selectedModelIds[role];
      const model = registry.find(m => m.id === modelId) || registry[0];
      return {
        role,
        prompt: '',
        analysis: '',
        status: 'idle',
        modelName: modelId,
        providerType: model.providerType
      };
    });
    setAgentAnalyses(newState);
  }, [selectedModelIds, registry]);

  const [consensus, setConsensus] = useState<ConsensusReport | null>(null);

  const handleModelChange = (role: AgentRole, modelId: string) => {
    setSelectedModelIds(prev => ({ ...prev, [role]: modelId }));
  };

  const updateAgent = (role: AgentRole, updates: Partial<AgentAnalysis>) => {
    setAgentAnalyses(prev => prev.map(a => a.role === role ? { ...a, ...updates } : a));
  };

  const handleSubmit = useCallback(async () => {
    if (isLoading || !query.trim()) return;
    setIsLoading(true);
    setError(null);
    setConsensus(null);
    setSources([]);
    setEngineProgress(null);
    setAgentAnalyses(prev => prev.map(a => ({ ...a, status: 'idle', analysis: '', usage: undefined })));
    const runId = ++runIdRef.current;
    const isStale = () => runIdRef.current !== runId;
    // Captured now, before any await lets an abort click race in, and reused by
    // every seat: seats run sequentially (see below), so if each one captured this
    // itself, an abort during an earlier seat would go undetected by a later one.
    const runEpoch = currentEpoch('council');

    try {
      const { text: cleanQuery } = sanitizeText(query);
      updateAgent(AgentRole.Privacy, { status: 'done', analysis: 'PII scrubbed on-device before anything left the browser.' });

      const modelFor = (role: AgentRole) => registry.find(m => m.id === selectedModelIds[role] && isSelectableModel(m));
      const seats = [...COUNCIL_ROLES, AgentRole.Chairperson];
      const missing = seats.filter(role => !modelFor(role));
      if (missing.length) {
        throw new Error(`No usable model is selected for: ${missing.join(', ')}. Pick one for every seat.`);
      }
      const usesLocal = seats.some(role => modelFor(role)!.providerType === 'webllm');
      if (usesLocal && !isWebGPUSupported()) {
        throw new Error(
          "This browser has no WebGPU, so in-browser models can't run. Use desktop Chrome or Edge, " +
            'or connect a cloud model with your own API key in the Model Hub.'
        );
      }

      // Retrieval runs once per question and is shared by every in-browser seat, which
      // is held to citing it. Cloud seats keep answering from their own knowledge.
      let grounding: SearchResult[] = [];
      if (usesLocal) {
        grounding = await retrieveSources(cleanQuery);
        if (isStale()) return;
        setSources(grounding);
      }
      const hooks: LocalRunHooks = {
        sources: grounding,
        runEpoch,
        onProgress: (text, fraction) => {
          if (!isStale()) setEngineProgress(fraction !== undefined && fraction >= 1 ? null : { text, fraction });
        },
      };

      // One shared engine backs every seat, so they can never truly run at once --
      // engineManager's queue already serializes them. Awaiting one seat before
      // starting the next (rather than Promise.all) makes that explicit, and gives
      // each seat's step-down ladder (if it needs one) the models earlier seats
      // already resolved to, so it can never converge on one of them.
      const usedModelIds = new Set<string>();
      const results: Array<Partial<AgentAnalysis> & { role: AgentRole }> = [];
      for (const role of COUNCIL_ROLES) {
        const model = modelFor(role)!;
        updateAgent(role, { status: 'thinking', modelName: model.id, providerType: model.providerType });
        try {
          const { text, usage, resolvedModelId } = await analyzeWithAgent(role, cleanQuery, model, answerMode, hooks, usedModelIds);
          // The seat may have run on a smaller model than selected, if the chosen
          // one didn't fit this device (see engineManager's step-down ladder).
          const finalModelId = resolvedModelId ?? model.id;
          usedModelIds.add(finalModelId);
          results.push({ role, analysis: text, usage, status: 'done', modelName: finalModelId, providerType: model.providerType, prompt: cleanQuery });
        } catch (e) {
          results.push({ role, analysis: (e as Error).message, status: 'error', modelName: model.id, providerType: model.providerType, prompt: cleanQuery });
        }
      }
      if (isStale()) return;
      setEngineProgress(null);

      setAgentAnalyses(prev => prev.map(agent => {
        const res = results.find(r => r.role === agent.role);
        return res ? { ...agent, ...res } : agent;
      }));
      // Selections follow what actually ran, so the pickers stop offering a model
      // this device can't load, and the next run starts from what already worked
      // instead of re-discovering it through the same step-downs again.
      setSelectedModelIds(prev => {
        const next = { ...prev };
        let changed = false;
        for (const r of results) {
          if (r.modelName && r.modelName !== prev[r.role]) { next[r.role] = r.modelName; changed = true; }
        }
        return changed ? next : prev;
      });

      const successfulResults = results.filter(r => r.status === 'done') as unknown as AgentAnalysis[];
      if (successfulResults.length === 0) {
        setError('Council consensus failed: no council member produced an answer. See each seat below for why.');
        return;
      }

      const chairModel = modelFor(AgentRole.Chairperson)!;
      updateAgent(AgentRole.Chairperson, { status: 'thinking', modelName: chairModel.id, providerType: chairModel.providerType });
      try {
        const { report, usage, resolvedModelId } = await synthesizeConsensus(cleanQuery, successfulResults, answerMode, chairModel, hooks);
        if (isStale()) return;
        setConsensus(report);
        updateAgent(AgentRole.Chairperson, { status: 'done', usage, ...(resolvedModelId ? { modelName: resolvedModelId } : {}) });
        if (resolvedModelId && resolvedModelId !== chairModel.id) {
          setSelectedModelIds(prev => ({ ...prev, [AgentRole.Chairperson]: resolvedModelId }));
        }
      } catch (e) {
        if (isStale()) return;
        const message = (e as Error).message;
        updateAgent(AgentRole.Chairperson, { status: 'error', analysis: message });
        setError(`Chairperson: ${message}`);
      }
    } catch (e) {
      if (!isStale()) setError((e as Error).message);
    } finally {
      if (!isStale()) {
        setEngineProgress(null);
        setIsLoading(false);
      }
    }
  }, [query, selectedModelIds, registry, answerMode, isLoading]);

  const handleAbort = () => {
    runIdRef.current++;
    cancelLocalGenerations();
    setIsLoading(false);
    setEngineProgress(null);
    setShowCancelConfirm(false);
    setAgentAnalyses(prev => prev.map(a => (a.status === 'thinking' ? { ...a, status: 'idle' } : a)));
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 sm:p-12 flex justify-center overflow-x-clip selection:bg-violet-500/30">
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 backdrop-blur-md bg-slate-950/70 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4 text-center">Terminate Operation?</h3>
            <p className="text-xs text-slate-500 mb-8 leading-relaxed text-center px-4">Deliberation will be terminated immediately. Credentials remain safe.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-4 text-[11px] font-black uppercase bg-slate-800 rounded-xl text-slate-300 transition-all hover:bg-slate-700">Continue</button>
              <button onClick={handleAbort} className="flex-1 py-4 text-[11px] font-black uppercase bg-rose-600 rounded-xl text-white transition-all hover:bg-rose-500">Abort Run</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl min-w-0">
        <header className="flex flex-col lg:flex-row justify-between items-center mb-12 sm:mb-16 gap-8">
          <div className="flex items-center gap-6">
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-4 rounded-[2rem] border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
               <LogoIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-1">LLMCouncil</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.6em] ml-1">Universal Wrapper Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-6 flex-wrap justify-center">
             <ModeSwitcher mode={mode} onChange={setMode} />
             <div className="hidden lg:flex items-center gap-3 bg-slate-900/60 px-6 py-2.5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gateway Ready</span>
             </div>
          </div>
        </header>

        {mode === 'council' ? (
          <main className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            <div className="lg:col-span-2 min-w-0">
              <InputPanel
                query={query} setQuery={setQuery}
                handleSubmit={handleSubmit} handleCancel={() => {}}
                isLoading={isLoading} useAutomation={useAutomation} setUseAutomation={setUseAutomation}
                selectedModels={selectedModelIds}
                onModelChange={handleModelChange}
                requestCounts={requestCounts}
                onShowCancel={() => setShowCancelConfirm(true)}
                answerMode={answerMode}
                setAnswerMode={setAnswerMode}
                registry={registry}
                setRegistry={setRegistry}
              />
            </div>
            <div className="lg:col-span-3 space-y-20 min-w-0">
              {error && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-[2rem] p-8 flex items-start gap-4">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-rose-400 mb-1.5">Signal Failed</p>
                    <p className="text-sm text-rose-200/70 leading-relaxed">{error}</p>
                  </div>
                </div>
              )}
              {engineProgress && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-8 space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Loading in-browser model — downloaded once, then cached</span>
                    {engineProgress.fraction !== undefined && <span>{Math.round(engineProgress.fraction * 100)}%</span>}
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-violet-500 transition-all duration-300"
                      style={{ width: `${Math.max(2, (engineProgress.fraction ?? 0) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 font-mono truncate">{engineProgress.text}</p>
                </div>
              )}
              <CouncilView
                agentAnalyses={agentAnalyses.filter(a => a.role !== AgentRole.Chairperson)}
                onAnalysisChange={(role, text) => updateAgent(role, { analysis: text })}
                useAutomation={useAutomation}
                requestCounts={requestCounts}
              />
              <ConsensusDashboard
                consensus={consensus}
                chairpersonStatus={agentAnalyses.find(a => a.role === AgentRole.Chairperson)?.status || 'idle'}
                chairpersonUsage={agentAnalyses.find(a => a.role === AgentRole.Chairperson)?.usage}
                originalQuery={query}
                agentAnalyses={agentAnalyses}
                chairModelLabel={(() => {
                  // Reflects the model that actually ran once resolved (see the
                  // step-down ladder), falling back to the selected one beforehand.
                  const chairId = agentAnalyses.find(a => a.role === AgentRole.Chairperson)?.modelName ?? selectedModelIds[AgentRole.Chairperson];
                  return registry.find(m => m.id === chairId)?.label ?? chairId;
                })()}
                sources={sources}
              />
            </div>
          </main>
        ) : (
          <main className="max-w-3xl mx-auto">
            <Suspense
              fallback={
                <div className="text-center text-[11px] text-slate-500 uppercase tracking-widest font-black py-24">
                  Loading Local Assistant…
                </div>
              }
            >
              <GroundedAssistant />
            </Suspense>
          </main>
        )}
      </div>
    </div>
  );
};

export default App;