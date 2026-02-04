import React, { useState, useCallback } from 'react';
import { AgentRole, type AgentAnalysis, type ConsensusReport } from './types';
import { analyzeWithAgent, synthesizeConsensus, sanitizeText } from './services/geminiService';
import InputPanel from './components/TicketInputForm';
import CouncilView from './components/CouncilView';
import ConsensusDashboard from './components/ConsensusDashboard';
import { LogoIcon } from './components/icons';

const App: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [useAutomation, setUseAutomation] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const initialAgentState: AgentAnalysis[] = [
    { role: AgentRole.Privacy, prompt: '', analysis: '', status: 'idle' },
    { role: AgentRole.Model1, prompt: '', analysis: '', status: 'idle' },
    { role: AgentRole.Model2, prompt: '', analysis: '', status: 'idle' },
    { role: AgentRole.Model3, prompt: '', analysis: '', status: 'idle' },
    { role: AgentRole.Chairperson, prompt: '', analysis: '', status: 'idle' },
  ];

  const [agentAnalyses, setAgentAnalyses] = useState<AgentAnalysis[]>(initialAgentState);
  const [consensus, setConsensus] = useState<ConsensusReport | null>(null);

  const resetState = () => {
    if (useAutomation) {
      setAgentAnalyses(initialAgentState);
    } else {
        const keptAnalyses = agentAnalyses.map(a => ({
            ...a,
            status: 'idle' as const,
            analysis: a.role === AgentRole.Chairperson ? '' : a.analysis,
        }));
        setAgentAnalyses(keptAnalyses);
    }
    setConsensus(null);
    setError(null);
  };

  const getAgent = (role: AgentRole) => agentAnalyses.find(a => a.role === role)!;
  
  const updateAgent = (role: AgentRole, updates: Partial<AgentAnalysis>) => {
    setAgentAnalyses(prev => prev.map(agent => 
      agent.role === role ? { ...agent, ...updates } : agent
    ));
  };
  
  const handleAnalysisChange = (role: AgentRole, newAnalysis: string) => {
    setAgentAnalyses(prev => prev.map(agent =>
        agent.role === role ? { ...agent, analysis: newAnalysis, status: 'idle' } : agent
    ));
  };

  const handleSubmit = useCallback(async () => {
    if (isLoading || !query.trim()) return;
    
    setIsLoading(true);
    resetState();

    try {
      // 1. Privacy Shield Sanitization
      updateAgent(AgentRole.Privacy, { status: 'thinking', prompt: query });
      const sanitizedQuery = await sanitizeText(query);
      updateAgent(AgentRole.Privacy, { status: 'done', analysis: 'Query sanitized successfully.' });

      const councilRoles = [AgentRole.Model1, AgentRole.Model2, AgentRole.Model3];

      // Set sanitized prompt for all agents
      councilRoles.forEach(role => updateAgent(role, { prompt: sanitizedQuery }));
      
      const councilPromises: Promise<{role: AgentRole, result: string} | {role: AgentRole, error: Error}>[] = [];

      if (useAutomation) {
        // 2. AUTOMATED: Run API calls for all models
        councilRoles.forEach(role => {
          updateAgent(role, { status: 'thinking' });
          const promise = analyzeWithAgent(role, sanitizedQuery, false)
            .then(result => ({ role, result }))
            .catch(err => ({ role, error: err as Error }));
          councilPromises.push(promise);
        });
      } else {
        // 2. MANUAL: Mark agents with existing text as 'done'
        councilRoles.forEach(role => {
          const agent = getAgent(role);
          if (agent.analysis.trim()) {
            updateAgent(role, { status: 'done' });
          } else {
             updateAgent(role, { status: 'error', analysis: 'No manual input provided for this model.' });
          }
        });
      }
      
      if (useAutomation) {
        const councilResults = await Promise.all(councilPromises);
        let hasError = false;
        
        // FIX: Create the next state array from the results to avoid using stale state.
        // This resolves a race condition where multiple `updateAgent` calls would not reflect
        // the latest state before proceeding to the synthesis step.
        const updatedAnalysesFromResults = agentAnalyses.map(agent => {
          const result = councilResults.find(item => item.role === agent.role);
          if (result) {
            if ('error' in result) {
              hasError = true;
              return { ...agent, status: 'error' as const, analysis: `Analysis failed: ${result.error.message}` };
            } else {
              return { ...agent, status: 'done' as const, analysis: result.result };
            }
          }
          return agent;
        });

        setAgentAnalyses(updatedAnalysesFromResults);

        if (hasError) throw new Error("One or more council members failed.");

        const councilAnalysesForSynthesis = updatedAnalysesFromResults.filter(a => councilRoles.includes(a.role));
        const councilIsDone = councilAnalysesForSynthesis.every(a => a.status === 'done' && a.analysis.trim());

        if (councilIsDone) {
            updateAgent(AgentRole.Chairperson, { status: 'thinking' });
            const finalAnalysisText = await synthesizeConsensus(sanitizedQuery, councilAnalysesForSynthesis, false);
            
            const parsedConsensus: ConsensusReport = JSON.parse(finalAnalysisText);
            setConsensus(parsedConsensus);
            updateAgent(AgentRole.Chairperson, { status: 'done' });
        } else {
            throw new Error("Not all model responses are available for synthesis.");
        }
      } else {
         // 3. Chairperson Synthesis (for manual mode)
        const councilAnalysesForSynthesis = agentAnalyses.filter(a => councilRoles.includes(a.role));
        const councilIsDone = councilAnalysesForSynthesis.every(a => a.status === 'done' && a.analysis.trim());

        if (councilIsDone) {
          updateAgent(AgentRole.Chairperson, { status: 'thinking' });
          const finalAnalysisText = await synthesizeConsensus(sanitizedQuery, councilAnalysesForSynthesis, false);
          
          const parsedConsensus: ConsensusReport = JSON.parse(finalAnalysisText);
          setConsensus(parsedConsensus);
          updateAgent(AgentRole.Chairperson, { status: 'done' });
        } else {
          throw new Error("Not all model responses are available for synthesis.");
        }
      }
    } catch (err) {
      setError((err as Error).message);
      updateAgent(AgentRole.Chairperson, { status: 'error', analysis: (err as Error).message });
      console.error(err);
    }

    setIsLoading(false);
  }, [query, isLoading, useAutomation, agentAnalyses]);

  return (
    <div className="min-h-screen font-sans flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <LogoIcon className="w-12 h-12 text-violet-400" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">LLMCouncil</h1>
              <p className="text-sm sm:text-base text-slate-400">Multi-Model Answer Synthesis</p>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-8">
            <InputPanel 
              query={query}
              setQuery={setQuery}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              useAutomation={useAutomation}
              setUseAutomation={setUseAutomation}
            />
            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
          </div>

          <div className="lg:col-span-3 flex flex-col gap-8">
            <CouncilView 
              agentAnalyses={agentAnalyses.filter(a => a.role !== AgentRole.Chairperson)} 
              onAnalysisChange={handleAnalysisChange}
            />
            <ConsensusDashboard 
              consensus={consensus} 
              chairpersonStatus={getAgent(AgentRole.Chairperson).status}
            />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
