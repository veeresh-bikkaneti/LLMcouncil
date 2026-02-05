import React from 'react';
import { AgentRole, type AgentAnalysis, type ModelQuota } from '../types';
import { Model1Icon, Model2Icon, Model3Icon, ShieldIcon, InfoIcon } from './icons';
import { INITIAL_MODELS as AVAILABLE_MODELS } from './TicketInputForm';
import { Markdown } from './Markdown';

interface AgentCardProps {
  agent: AgentAnalysis;
  onAnalysisChange: (role: AgentRole, text: string) => void;
  useAutomation: boolean;
  requestCounts: Record<string, number>;
}

const ModelTooltip: React.FC<{ model: ModelQuota }> = ({ model }) => (
  <div className="absolute left-0 sm:left-full ml-0 sm:ml-4 top-full sm:top-0 mt-3 sm:mt-0 w-72 p-5 bg-slate-900 border border-slate-700 rounded-[1.5rem] shadow-2xl z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 backdrop-blur-2xl ring-1 ring-white/10">
    <div className="flex justify-between items-center mb-3">
      <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">{model.providerId}</span>
      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full ${model.isFree ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
        {model.isFree ? 'FREE' : 'PAID'}
      </span>
    </div>
    <p className="text-[11px] text-slate-300 leading-relaxed mb-4">{model.description}</p>
    <a href={model.pricingUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] text-violet-400 hover:text-violet-300 font-black uppercase tracking-widest pointer-events-auto transition-colors border-t border-slate-800 pt-3 block">
      Documentation &rarr;
    </a>
  </div>
);

const getAgentIcon = (role: AgentRole) => {
  const cls = "w-6 h-6 flex-shrink-0";
  switch (role) {
    case AgentRole.Privacy: return <ShieldIcon className={`${cls} text-emerald-400`} />;
    case AgentRole.Model1: return <Model1Icon className={`${cls} text-cyan-400`} />;
    case AgentRole.Model2: return <Model2Icon className={`${cls} text-amber-400`} />;
    case AgentRole.Model3: return <Model3Icon className={`${cls} text-rose-400`} />;
    default: return null;
  }
};

const AgentCard: React.FC<AgentCardProps> = ({ agent, onAnalysisChange, useAutomation, requestCounts }) => {
  const isThinking = agent.status === 'thinking';
  const isDone = agent.status === 'done';
  const isError = agent.status === 'error';
  const quota = AVAILABLE_MODELS.find(m => m.id === agent.modelName);
  const spent = requestCounts[agent.modelName] || 0;
  const limit = quota?.rpmLimit || 1;
  const remaining = Math.max(0, limit - spent);
  const progress = Math.min(100, (spent / limit) * 100);

  return (
    <div className={`p-6 sm:p-10 rounded-[2.5rem] border transition-all duration-500 ${isThinking ? 'border-violet-500/40 bg-violet-950/10 shadow-[0_0_50px_rgba(139,92,246,0.06)]' : isError ? 'border-amber-500/20 bg-amber-950/5' : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700'}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/50 flex-shrink-0 shadow-inner">
            {getAgentIcon(agent.role)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <h3 className="font-black text-slate-100 uppercase text-sm tracking-tight truncate">{agent.role}</h3>
              {quota?.isFree && (
                <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-black tracking-widest border border-emerald-500/20">FREE ACCESS</span>
              )}
            </div>
            <div className="flex items-center gap-2 group relative">
                <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest truncate max-w-[180px]">{agent.modelName}</p>
                <InfoIcon className="w-3.5 h-3.5 text-slate-800 hover:text-violet-400 cursor-help transition-colors" />
                {quota && <ModelTooltip model={quota} />}
            </div>
          </div>
        </div>
        <div className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest border flex-shrink-0 ${isThinking ? 'text-violet-400 border-violet-500/30 bg-violet-500/5 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : isError ? 'text-amber-500 border-amber-500/30 bg-amber-500/5' : 'text-slate-500 border-slate-800 bg-slate-900/50'}`}>
          {agent.status}
        </div>
      </div>

      <div className="sm:pl-20 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {agent.usage && isDone && (
            <div className="p-5 bg-slate-950/50 border border-slate-800/60 rounded-2xl shadow-inner">
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] block mb-2">Resource Utilization</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-mono font-bold text-violet-400 leading-none">{agent.usage.totalTokens.toLocaleString()}</span>
                <span className="text-[9px] text-slate-700 font-black uppercase tracking-widest">Spent Tokens</span>
              </div>
            </div>
          )}
          {useAutomation && (
            <div className="p-5 bg-slate-950/50 border border-slate-800/60 rounded-2xl space-y-4 shadow-inner">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-widest leading-none">
                <span className="text-slate-600">Model Quota: {spent}/{limit}</span>
                <span className={remaining < 2 ? 'text-amber-500' : 'text-emerald-500'}>{remaining} remaining</span>
              </div>
              <div className="h-2 bg-slate-900/80 rounded-full overflow-hidden p-0.5 border border-slate-800/50">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(var(--tw-color),0.4)] ${remaining < 2 ? 'bg-amber-500' : 'bg-violet-600'}`} 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>
          )}
        </div>

        {isThinking ? (
          <div className="flex items-center gap-6 py-12 px-10 bg-slate-950/40 rounded-[2rem] border border-slate-800/40 border-dashed animate-pulse">
            <div className="flex gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-bounce" />
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-bounce delay-150" />
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-bounce delay-300" />
            </div>
            <span className="text-[12px] text-violet-400 font-black uppercase tracking-[0.4em]">Parallel Deliberation in progress</span>
          </div>
        ) : isError ? (
          <div className="bg-amber-500/[0.04] p-10 rounded-[2rem] border border-amber-500/20 shadow-inner">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-amber-500/10 rounded-xl"><InfoIcon className="w-5 h-5 text-amber-500" /></div>
              <span className="font-black uppercase text-[11px] tracking-[0.2em] text-amber-500">Authentication Protocol Interrupted</span>
            </div>
            <p className="text-amber-200/60 text-sm font-medium leading-relaxed italic pr-4">{agent.analysis || "Authorization required. Establish a link via the Model Hub or import a secure vault."}</p>
          </div>
        ) : isDone ? (
          <div className="bg-slate-950/70 p-10 rounded-[2rem] border border-slate-800/50 shadow-inner group-hover:border-slate-700/50 transition-all">
            <Markdown text={agent.analysis} />
          </div>
        ) : (
          <div className="relative">
            <textarea
                value={agent.analysis}
                onChange={(e) => onAnalysisChange(agent.role, e.target.value)}
                disabled={useAutomation || agent.role === AgentRole.Privacy}
                placeholder={useAutomation ? "Synchronizing with mission profile..." : "Inject specific manual deliberation..."}
                className="w-full h-40 bg-slate-950/40 border border-slate-800/60 rounded-[1.5rem] p-8 text-sm text-slate-400 focus:border-violet-500/50 outline-none resize-none transition-all font-medium placeholder:text-slate-800 shadow-inner"
            />
            {!useAutomation && (
                <div className="absolute bottom-5 right-5 text-[9px] text-slate-700 font-black uppercase tracking-widest pointer-events-none bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800">Manual Deliberation Active</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentCard;