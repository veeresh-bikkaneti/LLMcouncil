import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './sidepanel.css';

interface AgentStatus {
    role: string;
    status: 'idle' | 'thinking' | 'done' | 'error';
    analysis?: string;
}

interface AnalysisReport {
    comprehensiveAnswer: string;
    agentOutputs: AgentStatus[];
    consensusRate?: number;
    processingTime?: number;
}

function SidePanel() {
    const [agents, setAgents] = useState<AgentStatus[]>([]);
    const [report, setReport] = useState<AnalysisReport | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Listen for messages from background
        chrome.runtime.onMessage.addListener((message: any) => {
            if (message.type === 'ANALYSIS_PROGRESS') {
                updateAgentStatus(message.agentId, message.status);
            } else if (message.type === 'ANALYSIS_RESULT') {
                if (message.error) {
                    setError(message.error);
                } else {
                    setReport(message.analysis);
                }
            }
        });
    }, []);

    const updateAgentStatus = (agentId: string, status: string) => {
        setAgents(prev => {
            const existing = prev.find(a => a.role === agentId);
            if (existing) {
                return prev.map(a => a.role === agentId ? { ...a, status: status as any } : a);
            }
            return [...prev, { role: agentId, status: status as any }];
        });
    };

    const analyzeSelectedText = async () => {
        // Get active tab and send analyze request
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTED_TEXT' });
        }
    };

    if (error) {
        return (
            <div className="sidepanel-container">
                <div className="error-state">
                    <h2>❌ Analysis Failed</h2>
                    <p>{error}</p>
                    <button onClick={() => setError(null)}>Try Again</button>
                </div>
            </div>
        );
    }

    return (
        <div className="sidepanel-container">
            <header className="panel-header">
                <h1>🤖 LLM Council</h1>
                <button className="analyze-btn" onClick={analyzeSelectedText}>
                    Analyze Selection
                </button>
            </header>

            {agents.length === 0 && !report ? (
                <div className="empty-state">
                    <p>Select text on the page and click "Analyze Selection"</p>
                    <p className="hint">or right-click → "Analyze with LLM Council"</p>
                </div>
            ) : (
                <div className="analysis-content">
                    {agents.map(agent => (
                        <div key={agent.role} className="agent-card">
                            <div className="agent-header">
                                <span className="agent-name">{agent.role}</span>
                                <span className={`status status-${agent.status}`}>
                                    {agent.status === 'thinking' && <span className="spinner"></span>}
                                    {agent.status.toUpperCase()}
                                </span>
                            </div>
                            {agent.analysis && (
                                <div className="agent-analysis">{agent.analysis}</div>
                            )}
                        </div>
                    ))}

                    {report && (
                        <div className="consensus-section">
                            <h2>📋 Final Consensus</h2>
                            <div className="consensus-meta">
                                <span>Time: {((report.processingTime || 0) / 1000).toFixed(1)}s</span>
                                <span>Consensus: {((report.consensusRate || 0) * 100).toFixed(0)}%</span>
                            </div>
                            <div className="consensus-content">
                                {report.comprehensiveAnswer}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <SidePanel />
    </React.StrictMode>
);
