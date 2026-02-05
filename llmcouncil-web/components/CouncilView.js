"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const AgentCard_1 = __importDefault(require("./AgentCard"));
const CouncilView = ({ agentAnalyses, onAnalysisChange, useAutomation, requestCounts }) => {
    return (<div className="bg-slate-900/60 border border-slate-800/50 rounded-[2.5rem] shadow-2xl p-8 backdrop-blur-md">
      <div className='mb-8 px-2'>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-1">Deliberation Stream</h2>
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Parallel model insights with resource monitoring</p>
      </div>
      <div className="space-y-8">
        {agentAnalyses.map((agent) => (<AgentCard_1.default key={agent.role} agent={agent} onAnalysisChange={onAnalysisChange} useAutomation={useAutomation} requestCounts={requestCounts}/>))}
      </div>
    </div>);
};
exports.default = CouncilView;
//# sourceMappingURL=CouncilView.js.map