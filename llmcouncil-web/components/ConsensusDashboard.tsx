import React from 'react';
import { ConsensusReport, AgentAnalysis, type TokenUsage } from '../types';
import { BrainCircuitIcon, ChairpersonIcon, DownloadIcon } from './icons';
import { Markdown } from './Markdown';
import { sanitizePII } from '../src/engine/sanitize';
import type { SearchResult } from '../src/engine/types';

interface ConsensusDashboardProps {
  /** 'council' shows the full Chairperson/arbitration framing; 'quick' shows this as
   *  a single model's direct, grounded answer, since there's no one else to arbitrate. */
  variant: 'quick' | 'council';
  consensus: ConsensusReport | null;
  chairpersonStatus: AgentAnalysis['status'];
  chairpersonUsage?: TokenUsage;
  originalQuery: string;
  agentAnalyses: AgentAnalysis[];
  chairModelLabel: string;
  sources: SearchResult[];
}

const CONFIDENCE_STYLE: Record<'High' | 'Medium' | 'Low', string> = {
  High: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
  Medium: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
  Low: 'text-rose-400 border-rose-500/30 bg-rose-500/5',
};

const STATUS_LABEL: Record<'quick' | 'council', Record<AgentAnalysis['status'], string>> = {
  council: {
    idle: 'Waiting for Council',
    thinking: 'Synthesizing',
    done: 'Consensus Reached',
    error: 'Arbitration Failed',
  },
  quick: {
    idle: 'Waiting for Question',
    thinking: 'Answering',
    done: 'Answered',
    error: 'Answer Failed',
  },
};

const STATUS_STYLE: Record<AgentAnalysis['status'], string> = {
  idle: 'text-slate-500 border-slate-800 bg-slate-900/50',
  thinking: 'text-violet-400 border-violet-500/30 bg-violet-500/5',
  done: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
  error: 'text-amber-500 border-amber-500/30 bg-amber-500/5',
};

const ConsensusDashboard: React.FC<ConsensusDashboardProps> = ({ variant, consensus, chairpersonStatus, chairpersonUsage, originalQuery, agentAnalyses, chairModelLabel, sources }) => {
  const modelName = chairModelLabel;

  const handleDownload = () => {
    if (!consensus) return;

    let reportText = variant === 'quick' ? `LLM COUNCIL: QUICK ANSWER\n` : `LLM COUNCIL: DELIBERATION REPORT\n`;
    reportText += `===============================\n\n`;
    reportText += `ORIGINAL SIGNAL:\n"${sanitizePII(originalQuery)}"\n\n`;

    if (variant === 'council') {
      reportText += `-------------------------------\n`;
      reportText += `COUNCIL PERSPECTIVES:\n`;

      agentAnalyses.forEach(agent => {
          if (agent.role !== 'Chairperson') {
              reportText += `\n[${agent.role.toUpperCase()}]\n`;
              reportText += `Model: ${agent.modelName}\n`;
              reportText += `Analysis:\n${agent.analysis}\n`;
              if (agent.usage) {
                  reportText += `Tokens: ${agent.usage.totalTokens}\n`;
              }
          }
      });

      reportText += `\n-------------------------------\n`;
      reportText += `FINAL ARBITRATION:\n`;
    }
    reportText += `Model: ${modelName}\n`;
    reportText += `${variant === 'quick' ? 'Answer' : 'Synthesis'}:\n${consensus.comprehensiveAnswer}\n\n`;
    if (consensus.confidence) {
        reportText += `Confidence: ${consensus.confidence}\n`;
    }
    if (sources.length) {
        reportText += `\nSOURCES:\n${sources.map(src => `[${src.id}] ${src.title} - ${src.url}`).join('\n')}\n`;
    }
    
    if (chairpersonUsage) {
        reportText += `${variant === 'quick' ? 'Cost' : 'Arbitration Cost'}: ${chairpersonUsage.totalTokens} Tokens\n`;
    }
    
    reportText += `\nGenerated at: ${new Date().toLocaleString()}\n`;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `council-report-${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
    
  const renderContent = () => {
    if (chairpersonStatus === 'idle') {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-600 border border-dashed border-slate-800 rounded-[2rem] bg-slate-900/10">
           <p className="italic text-sm font-medium">
             {variant === 'quick' ? 'Awaiting your question...' : 'Awaiting Council Perspectives for Final Arbitration...'}
           </p>
        </div>
      );
    }
    if (chairpersonStatus === 'thinking') {
      return (
        <div className="flex flex-col items-center gap-10 py-16 px-10 text-slate-400 bg-slate-900/20 rounded-[2rem] border border-violet-500/20">
          <div className="relative">
            <div className="animate-ping absolute inset-0 rounded-full h-20 w-20 bg-violet-500/20"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-slate-800 border-t-violet-500"></div>
          </div>
          <span className="font-black uppercase tracking-[0.4em] text-xs text-violet-400 animate-pulse">
            {variant === 'quick' ? 'Reading Sources' : 'Orchestrating Consensus'}
          </span>
          <div className="w-full max-w-md flex flex-col gap-3">
            <div className="shimmer-line" style={{ width: '96%' }} />
            <div className="shimmer-line" style={{ width: '82%' }} />
          </div>
        </div>
      );
    }
    if (chairpersonStatus === 'error') {
        return (
            <div className="bg-red-950/30 p-12 rounded-[2rem] border border-red-800/40 text-red-300 text-center">
                <p className="font-black uppercase tracking-widest text-sm mb-3">
                  {variant === 'quick' ? 'Answer Failed' : 'Arbitration Protocol Failed'}
                </p>
                <p className="text-sm opacity-70">
                  {variant === 'quick' ? 'The model was unable to answer.' : 'The Chairperson was unable to reconcile model differences.'}
                </p>
            </div>
        );
    }
    if (consensus) {
      return (
        <div className="bg-slate-950/70 p-10 rounded-[2.5rem] border border-slate-800/80 shadow-[0_0_50px_rgba(0,0,0,0.3)] animate-fade-in relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-all duration-700">
                <ChairpersonIcon className="w-56 h-56" />
            </div>
            <div className="relative z-10">
                {consensus.confidence && (
                  <span className={`inline-block mb-6 text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border ${CONFIDENCE_STYLE[consensus.confidence]}`}>
                    Confidence: {consensus.confidence}
                  </span>
                )}
                <Markdown text={consensus.comprehensiveAnswer} />
                {sources.length > 0 && (
                  <div className="mt-10 pt-6 border-t border-slate-800/60 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3">Grounding Sources</p>
                    {sources.map(src => (
                      <a
                        key={src.id}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-baseline gap-3 text-[12px] text-slate-400 hover:text-violet-300 transition-colors"
                      >
                        <span className="text-violet-400 font-black">[{src.id}]</span>
                        <span className="truncate">{src.title}</span>
                        <span className="text-[9px] uppercase tracking-widest text-slate-700 flex-shrink-0">{src.source}</span>
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-12 flex justify-end">
                  <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-6 py-3 bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-600/20 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl"
                  >
                    <DownloadIcon className="w-4 h-4" /> Export Report
                  </button>
                </div>
            </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-[2.5rem] shadow-2xl p-10 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-12 flex-wrap gap-6">
        <div className="flex items-center">
            <div className="p-4 bg-violet-500/10 rounded-2xl mr-6 border border-violet-500/20 shadow-inner">
                {variant === 'quick' ? <BrainCircuitIcon className="w-9 h-9 text-violet-400" /> : <ChairpersonIcon className="w-9 h-9 text-violet-400" />}
            </div>
            <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">{variant === 'quick' ? 'Quick Answer' : 'Final Arbitration'}</h2>
                <div className="flex items-center gap-5 mt-1.5">
                  <p className="text-[10px] text-slate-500 font-mono font-bold tracking-[0.2em] uppercase">
                      {modelName}
                  </p>
                  {chairpersonUsage && (
                    <div className="flex items-center gap-2.5 border-l border-slate-800 pl-4">
                       <span className="text-[10px] text-slate-600 font-black uppercase tracking-tighter">{variant === 'quick' ? 'Cost:' : 'Arbitration Cost:'}</span>
                       <span className="text-[11px] text-violet-400 font-mono font-bold">{chairpersonUsage.totalTokens} Tokens</span>
                    </div>
                  )}
                </div>
            </div>
        </div>
        <div className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest border flex-shrink-0 ${STATUS_STYLE[chairpersonStatus]}`}>
          {STATUS_LABEL[variant][chairpersonStatus]}
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default ConsensusDashboard;