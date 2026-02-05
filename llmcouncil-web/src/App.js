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
const geminiService_1 = require("./services/geminiService");
const TicketInputForm_1 = __importDefault(require("./components/TicketInputForm"));
const CouncilView_1 = __importDefault(require("./components/CouncilView"));
const ConsensusDashboard_1 = __importDefault(require("./components/ConsensusDashboard"));
const icons_1 = require("./components/icons");
const App = () => {
    const [query, setQuery] = (0, react_1.useState)('');
    const [useAutomation, setUseAutomation] = (0, react_1.useState)(true);
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const initialAgentState = [
        { role: types_1.AgentRole.Privacy, prompt: '', analysis: '', status: 'idle' },
        { role: types_1.AgentRole.Model1, prompt: '', analysis: '', status: 'idle' },
        { role: types_1.AgentRole.Model2, prompt: '', analysis: '', status: 'idle' },
        { role: types_1.AgentRole.Model3, prompt: '', analysis: '', status: 'idle' },
        { role: types_1.AgentRole.Chairperson, prompt: '', analysis: '', status: 'idle' },
    ];
    const [agentAnalyses, setAgentAnalyses] = (0, react_1.useState)(initialAgentState);
    const [consensus, setConsensus] = (0, react_1.useState)(null);
    const resetState = () => {
        if (useAutomation) {
            setAgentAnalyses(initialAgentState);
        }
        else {
            const keptAnalyses = agentAnalyses.map(a => ({
                ...a,
                status: 'idle',
                analysis: a.role === types_1.AgentRole.Chairperson ? '' : a.analysis,
            }));
            setAgentAnalyses(keptAnalyses);
        }
        setConsensus(null);
        setError(null);
    };
    const getAgent = (role) => agentAnalyses.find(a => a.role === role);
    const updateAgent = (role, updates) => {
        setAgentAnalyses(prev => prev.map(agent => agent.role === role ? { ...agent, ...updates } : agent));
    };
    const handleAnalysisChange = (role, newAnalysis) => {
        setAgentAnalyses(prev => prev.map(agent => agent.role === role ? { ...agent, analysis: newAnalysis, status: 'idle' } : agent));
    };
    const handleSubmit = (0, react_1.useCallback)(async () => {
        if (isLoading || !query.trim())
            return;
        setIsLoading(true);
        resetState();
        try {
            // 1. Privacy Shield Sanitization
            updateAgent(types_1.AgentRole.Privacy, { status: 'thinking', prompt: query });
            const sanitizedQuery = await (0, geminiService_1.sanitizeText)(query);
            updateAgent(types_1.AgentRole.Privacy, { status: 'done', analysis: 'Query sanitized successfully.' });
            const councilRoles = [types_1.AgentRole.Model1, types_1.AgentRole.Model2, types_1.AgentRole.Model3];
            // Set sanitized prompt for all agents
            councilRoles.forEach(role => updateAgent(role, { prompt: sanitizedQuery }));
            const councilPromises = [];
            if (useAutomation) {
                // 2. AUTOMATED: Run API calls for all models
                councilRoles.forEach(role => {
                    updateAgent(role, { status: 'thinking' });
                    const promise = (0, geminiService_1.analyzeWithAgent)(role, sanitizedQuery, false)
                        .then(result => ({ role, result }))
                        .catch(err => ({ role, error: err }));
                    councilPromises.push(promise);
                });
            }
            else {
                // 2. MANUAL: Mark agents with existing text as 'done'
                councilRoles.forEach(role => {
                    const agent = getAgent(role);
                    if (agent.analysis.trim()) {
                        updateAgent(role, { status: 'done' });
                    }
                    else {
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
                            return { ...agent, status: 'error', analysis: `Analysis failed: ${result.error.message}` };
                        }
                        else {
                            return { ...agent, status: 'done', analysis: result.result };
                        }
                    }
                    return agent;
                });
                setAgentAnalyses(updatedAnalysesFromResults);
                if (hasError)
                    throw new Error("One or more council members failed.");
                const councilAnalysesForSynthesis = updatedAnalysesFromResults.filter(a => councilRoles.includes(a.role));
                const councilIsDone = councilAnalysesForSynthesis.every(a => a.status === 'done' && a.analysis.trim());
                if (councilIsDone) {
                    updateAgent(types_1.AgentRole.Chairperson, { status: 'thinking' });
                    const finalAnalysisText = await (0, geminiService_1.synthesizeConsensus)(sanitizedQuery, councilAnalysesForSynthesis, false);
                    const parsedConsensus = JSON.parse(finalAnalysisText);
                    setConsensus(parsedConsensus);
                    updateAgent(types_1.AgentRole.Chairperson, { status: 'done' });
                }
                else {
                    throw new Error("Not all model responses are available for synthesis.");
                }
            }
            else {
                // 3. Chairperson Synthesis (for manual mode)
                const councilAnalysesForSynthesis = agentAnalyses.filter(a => councilRoles.includes(a.role));
                const councilIsDone = councilAnalysesForSynthesis.every(a => a.status === 'done' && a.analysis.trim());
                if (councilIsDone) {
                    updateAgent(types_1.AgentRole.Chairperson, { status: 'thinking' });
                    const finalAnalysisText = await (0, geminiService_1.synthesizeConsensus)(sanitizedQuery, councilAnalysesForSynthesis, false);
                    const parsedConsensus = JSON.parse(finalAnalysisText);
                    setConsensus(parsedConsensus);
                    updateAgent(types_1.AgentRole.Chairperson, { status: 'done' });
                }
                else {
                    throw new Error("Not all model responses are available for synthesis.");
                }
            }
        }
        catch (err) {
            setError(err.message);
            updateAgent(types_1.AgentRole.Chairperson, { status: 'error', analysis: err.message });
            console.error(err);
        }
        setIsLoading(false);
    }, [query, isLoading, useAutomation, agentAnalyses]);
    return (<div className="min-h-screen font-sans flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <icons_1.LogoIcon className="w-12 h-12 text-violet-400"/>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">LLMCouncil</h1>
              <p className="text-sm sm:text-base text-slate-400">Multi-Model Answer Synthesis</p>
            </div>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-8">
            <TicketInputForm_1.default query={query} setQuery={setQuery} handleSubmit={handleSubmit} isLoading={isLoading} useAutomation={useAutomation} setUseAutomation={setUseAutomation}/>
            {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
          </div>

          <div className="lg:col-span-3 flex flex-col gap-8">
            <CouncilView_1.default agentAnalyses={agentAnalyses.filter(a => a.role !== types_1.AgentRole.Chairperson)} onAnalysisChange={handleAnalysisChange}/>
            <ConsensusDashboard_1.default consensus={consensus} chairpersonStatus={getAgent(types_1.AgentRole.Chairperson).status}/>
          </div>
        </main>
      </div>
    </div>);
};
exports.default = App;
//# sourceMappingURL=App.js.map