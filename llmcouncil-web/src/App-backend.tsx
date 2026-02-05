import React, { useState, useCallback } from 'react';
import { AgentRole, type AgentAnalysis, type ConsensusReport } from './types';
import { submitTicket, pollResults } from './services/api';
import InputPanel from './components/TicketInputForm';
import CouncilView from './components/CouncilView';
import ConsensusDashboard from './components/ConsensusDashboard';
import { LogoIcon } from './components/icons';

const App: React.FC = () => {
    const [query, setQuery] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const initialAgentState: AgentAnalysis[] = [
        { role: AgentRole.Model1, prompt: '', analysis: '', status: 'idle' },
        { role: AgentRole.Model2, prompt: '', analysis: '', status: 'idle' },
        { role: AgentRole.Model3, prompt: '', analysis: '', status: 'idle' },
        { role: AgentRole.Chairperson, prompt: '', analysis: '', status: 'idle' },
    ];

    const [agentAnalyses, setAgentAnalyses] = useState<AgentAnalysis[]>(initialAgentState);
    const [consensus, setConsensus] = useState<ConsensusReport | null>(null);

    const resetState = () => {
        setAgentAnalyses(initialAgentState);
        setConsensus(null);
        setError(null);
    };

    const updateAgent = (role: AgentRole, updates: Partial<AgentAnalysis>) => {
        setAgentAnalyses(prev => prev.map(agent =>
            agent.role === role ? { ...agent, ...updates } : agent
        ));
    };

    const handleSubmit = useCallback(async () => {
        if (isLoading || !query.trim()) return;

        setIsLoading(true);
        resetState();

        try {
            // Set all agents to thinking state
            setAgentAnalyses(prev => prev.map(agent => ({
                ...agent,
                prompt: query,
                status: 'thinking' as const
            })));

            // Submit to backend
            console.log('Submitting query to backend...');
            const { reportId } = await submitTicket(query);
            console.log('Analysis started, reportId:', reportId);

            // Poll for results
            let attempts = 0;
            const maxAttempts = 20; // 20 attempts * 3 seconds = 60 seconds max

            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

                const result = await pollResults(reportId);
                console.log(`Poll attempt ${attempts + 1}:`, result.status);

                if (result.status === 'complete' && result.report) {
                    const report = result.report;

                    // Update agents with actual backend data if available
                    if (report.agentOutputs && report.agentOutputs.length > 0) {
                        const updatedAgents = agentAnalyses.map(agent => {
                            const backendAgent = report.agentOutputs.find((a: any) =>
                                a.agent_name === agent.role.toLowerCase()
                            );

                            if (backendAgent) {
                                return {
                                    ...agent,
                                    status: 'done' as const,
                                    analysis: JSON.stringify(backendAgent.response_json, null, 2)
                                };
                            }
                            return { ...agent, status: 'done' as const };
                        });
                        setAgentAnalyses(updatedAgents);
                    } else {
                        // Mark all as done even without detailed responses
                        setAgentAnalyses(prev => prev.map(a => ({ ...a, status: 'done' as const })));
                    }

                    // Set consensus from backend
                    const backendConsensus: ConsensusReport = {
                        priority: report.priority_score || 5,
                        rootCause: report.root_cause || 'Analysis complete',
                        recommendation: report.recommended_action || 'See report for details',
                        confidenceScore: report.consensus_rate || 0.5,
                        tokensUsed: report.total_tokens_used || 0
                    };

                    setConsensus(backendConsensus);
                    updateAgent(AgentRole.Chairperson, { status: 'done' });
                    break;
                }

                if (result.status === 'error') {
                    throw new Error(result.report?.error_message || 'Analysis failed');
                }

                attempts++;
            }

            if (attempts >= maxAttempts) {
                throw new Error('Analysis timeout - still processing after 60 seconds');
            }

        } catch (err) {
            console.error('Analysis error:', err);
            setError((err as Error).message);
            setAgentAnalyses(prev => prev.map(a => ({
                ...a,
                status: 'error' as const,
                analysis: (err as Error).message
            })));
        }

        setIsLoading(false);
    }, [query, isLoading, agentAnalyses]);

    return (
        <div className="min-h-screen font-sans flex flex-col items-center p-4 sm:p-6 md:p-8">
            <div className="w-full max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <LogoIcon className="w-12 h-12 text-violet-400" />
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">LLMCouncil</h1>
                            <p className="text-sm sm:text-base text-slate-400">Multi-Agent AI Analysis</p>
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
                            useAutomation={true}
                            setUseAutomation={() => { }}
                        />
                        {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
                    </div>

                    <div className="lg:col-span-3 flex flex-col gap-8">
                        <CouncilView
                            agentAnalyses={agentAnalyses.filter(a => a.role !== AgentRole.Chairperson)}
                            onAnalysisChange={() => { }}
                        />
                        <ConsensusDashboard
                            consensus={consensus}
                            chairpersonStatus={agentAnalyses.find(a => a.role === AgentRole.Chairperson)?.status || 'idle'}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default App;
