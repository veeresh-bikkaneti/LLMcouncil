"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const types_1 = require("./types");
const api_1 = require("./services/api");
const TicketInputForm_1 = __importDefault(require("./components/TicketInputForm"));
const CouncilView_1 = __importDefault(require("./components/CouncilView"));
const ConsensusDashboard_1 = __importDefault(require("./components/ConsensusDashboard"));
const icons_1 = require("./components/icons");
const App = () => {
    const [query, setQuery] = (0, react_1.useState)('');
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const initialAgentState = [
        { role: types_1.AgentRole.Model1, prompt: '', analysis: '', status: 'idle' },
        { role: types_1.AgentRole.Model2, prompt: '', analysis: '', status: 'idle' },
        { role: types_1.AgentRole.Model3, prompt: '', analysis: '', status: 'idle' },
        { role: types_1.AgentRole.Chairperson, prompt: '', analysis: '', status: 'idle' },
    ];
    const [agentAnalyses, setAgentAnalyses] = (0, react_1.useState)(initialAgentState);
    const [consensus, setConsensus] = (0, react_1.useState)(null);
    const resetState = () => {
        setAgentAnalyses(initialAgentState);
        setConsensus(null);
        setError(null);
    };
    const updateAgent = (role, updates) => {
        setAgentAnalyses(prev => prev.map(agent => agent.role === role ? { ...agent, ...updates } : agent));
    };
    const handleSubmit = (0, react_1.useCallback)(async () => {
        if (isLoading || !query.trim())
            return;
        setIsLoading(true);
        resetState();
        try {
            // Set all agents to thinking state
            setAgentAnalyses(prev => prev.map(agent => ({
                ...agent,
                prompt: query,
                status: 'thinking'
            })));
            // Submit to backend
            console.log('Submitting query to backend...');
            const { reportId } = await (0, api_1.submitTicket)(query);
            console.log('Analysis started, reportId:', reportId);
            // Poll for results
            let attempts = 0;
            const maxAttempts = 20; // 20 attempts * 3 seconds = 60 seconds max
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
                const result = await (0, api_1.pollResults)(reportId);
                console.log(`Poll attempt ${attempts + 1}:`, result.status);
                if (result.status === 'complete' && result.report) {
                    const report = result.report;
                    // Update agents with actual backend data if available
                    if (report.agentOutputs && report.agentOutputs.length > 0) {
                        const updatedAgents = agentAnalyses.map(agent => {
                            const backendAgent = report.agentOutputs.find((a) => a.agent_name === agent.role.toLowerCase());
                            if (backendAgent) {
                                return {
                                    ...agent,
                                    status: 'done',
                                    analysis: JSON.stringify(backendAgent.response_json, null, 2)
                                };
                            }
                            return { ...agent, status: 'done' };
                        });
                        setAgentAnalyses(updatedAgents);
                    }
                    else {
                        // Mark all as done even without detailed responses
                        setAgentAnalyses(prev => prev.map(a => ({ ...a, status: 'done' })));
                    }
                    // Set consensus from backend
                    const backendConsensus = {
                        priority: report.priority_score || 5,
                        rootCause: report.root_cause || 'Analysis complete',
                        recommendation: report.recommended_action || 'See report for details',
                        confidenceScore: report.consensus_rate || 0.5,
                        tokensUsed: report.total_tokens_used || 0
                    };
                    setConsensus(backendConsensus);
                    updateAgent(types_1.AgentRole.Chairperson, { status: 'done' });
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
        }
        catch (err) {
            console.error('Analysis error:', err);
            setError(err.message);
            setAgentAnalyses(prev => prev.map(a => ({
                ...a,
                status: 'error',
                analysis: err.message
            })));
        }
        setIsLoading(false);
    }, [query, isLoading, agentAnalyses]);
    return (<div className="min-h-screen font-sans flex flex-col items-center p-4 sm:p-6 md:p-8">
            <div className="w-full max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <icons_1.LogoIcon className="w-12 h-12 text-violet-400"/>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">LLMCouncil</h1>
                            <p className="text-sm sm:text-base text-slate-400">Multi-Agent AI Analysis</p>
                        </div>
                    </div>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        <TicketInputForm_1.default query={query} setQuery={setQuery} handleSubmit={handleSubmit} isLoading={isLoading} useAutomation={true} setUseAutomation={() => { }}/>
                        {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
                    </div>

                    <div className="lg:col-span-3 flex flex-col gap-8">
                        <CouncilView_1.default agentAnalyses={agentAnalyses.filter(a => a.role !== types_1.AgentRole.Chairperson)} onAnalysisChange={() => { }}/>
                        <ConsensusDashboard_1.default consensus={consensus} chairpersonStatus={agentAnalyses.find(a => a.role === types_1.AgentRole.Chairperson)?.status || 'idle'}/>
                    </div>
                </main>
            </div>
        </div>);
};
exports.default = App;
//# sourceMappingURL=App-backend.js.map