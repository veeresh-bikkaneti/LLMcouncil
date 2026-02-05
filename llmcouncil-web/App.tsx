import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AgentRole, type AgentAnalysis, type ConsensusReport, type ModelQuota, type AnswerMode } from './types';
import { analyzeWithAgent, synthesizeConsensus, sanitizeText } from './services/inferenceService';
import InputPanel, { INITIAL_MODELS } from './components/TicketInputForm';
import CouncilView from './components/CouncilView';
import ConsensusDashboard from './components/ConsensusDashboard';
import { LogoIcon } from './components/icons';

const STORAGE_KEY = 'llm_council_selections_v3';

const App: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [useAutomation, setUseAutomation] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [requestCounts, setRequestCounts] = useState<Record<string, number>>({});
  const [registry, setRegistry] = useState<ModelQuota[]>(INITIAL_MODELS);
  const [answerMode, setAnswerMode] = useState<AnswerMode>('complex');
  const isCancelledRef = useRef(false);

  // Initialize from localStorage or strictly defined defaults per user requirement
  const [selectedModelIds, setSelectedModelIds] = useState<Record<AgentRole, string>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load selections", e);
      }
    }
    return {
      [AgentRole.Privacy]: 'gemini-3-flash-preview',
      [AgentRole.Model1]: 'gemini-3-flash-preview',
      [AgentRole.Model2]: 'deepseek-r1',
      [AgentRole.Model3]: 'gemini-3-pro-preview',
      [AgentRole.Chairperson]: 'gemini-3-pro-preview',
    };
  });

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
    isCancelledRef.current = false;

    try {
      const { text: cleanQuery } = await sanitizeText(query);
      if (isCancelledRef.current) return;
      updateAgent(AgentRole.Privacy, { status: 'done', analysis: 'Signal Scrubbed & Sanitized.' });

      const councilRoles = [AgentRole.Model1, AgentRole.Model2, AgentRole.Model3];
      const promises = councilRoles.map(async (role) => {
        const modelId = selectedModelIds[role];
        const model = registry.find(m => m.id === modelId)!;
        updateAgent(role, { status: 'thinking' });
        
        try {
          const { text, usage } = await analyzeWithAgent(role, cleanQuery, model, answerMode);
          return { role, analysis: text, usage, status: 'done' as const, modelName: modelId, providerType: model.providerType, prompt: cleanQuery };
        } catch (e) {
          return { role, analysis: (e as Error).message, status: 'error' as const, modelName: modelId, providerType: model.providerType, prompt: cleanQuery };
        }
      });

      const results = await Promise.all(promises);
      if (isCancelledRef.current) return;

      setAgentAnalyses(prev => prev.map(agent => {
        const res = results.find(r => r.role === agent.role);
        return res ? { ...agent, ...res } : agent;
      }));

      const successfulResults = results.filter(r => r.status === 'done') as unknown as AgentAnalysis[];
      
      if (successfulResults.length > 0) {
        updateAgent(AgentRole.Chairperson, { status: 'thinking' });
        const { text: synthesis, usage } = await synthesizeConsensus(cleanQuery, successfulResults, answerMode);
        if (isCancelledRef.current) return;
        
        try {
          const parsed = JSON.parse(synthesis);
          setConsensus(parsed);
          updateAgent(AgentRole.Chairperson, { status: 'done', usage });
        } catch (e) {
          updateAgent(AgentRole.Chairperson, { status: 'error', analysis: 'Arbitration failed: Invalid synthesis format.' });
        }
      } else {
        setError("Council consensus failed: No valid models were reachable.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [query, selectedModelIds, registry, answerMode]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 sm:p-12 flex justify-center selection:bg-violet-500/30">
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 backdrop-blur-md bg-slate-950/70 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-4 text-center">Terminate Operation?</h3>
            <p className="text-xs text-slate-500 mb-8 leading-relaxed text-center px-4">Deliberation will be terminated immediately. Credentials remain safe.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-4 text-[11px] font-black uppercase bg-slate-800 rounded-xl text-slate-300 transition-all hover:bg-slate-700">Continue</button>
              <button onClick={() => { isCancelledRef.current = true; setIsLoading(false); setShowCancelConfirm(false); }} className="flex-1 py-4 text-[11px] font-black uppercase bg-rose-600 rounded-xl text-white transition-all hover:bg-rose-500">Abort Run</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-7xl">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-16 gap-8">
          <div className="flex items-center gap-6">
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-4 rounded-[2rem] border border-white/10 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
               <LogoIcon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-1">LLMCouncil</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.6em] ml-1">Universal Wrapper Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="hidden sm:flex items-center gap-3 bg-slate-900/60 px-6 py-2.5 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gateway Ready</span>
             </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-5 gap-16">
          <div className="lg:col-span-2">
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
            />
          </div>
          <div className="lg:col-span-3 space-y-20">
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
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;