import React from 'react';
import { ConsensusReport, AgentAnalysis, type TokenUsage } from '../types';
import { ChairpersonIcon, DownloadIcon } from './icons';
import { Markdown } from './Markdown';

interface ConsensusDashboardProps {
  consensus: ConsensusReport | null;
  chairpersonStatus: AgentAnalysis['status'];
  chairpersonUsage?: TokenUsage;
  originalQuery: string;
  agentAnalyses: AgentAnalysis[];
}

const ConsensusDashboard: React.FC<ConsensusDashboardProps> = ({ consensus, chairpersonStatus, chairpersonUsage, originalQuery, agentAnalyses }) => {
  const modelName = 'gemini-3-pro-preview';

  const handleDownload = () => {
    if (!consensus) return;
    
    let reportText = `LLM COUNCIL: DELIBERATION REPORT\n`;
    reportText += `===============================\n\n`;
    reportText += `ORIGINAL SIGNAL:\n"${originalQuery}"\n\n`;
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
    reportText += `Model: ${modelName}\n`;
    reportText += `Synthesis:\n${consensus.comprehensiveAnswer}\n\n`;
    
    if (chairpersonUsage) {
        reportText += `Arbitration Cost: ${chairpersonUsage.totalTokens} Tokens\n`;
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
           <p className="italic text-sm font-medium">Awaiting Council Perspectives for Final Arbitration...</p>
        </div>
      );
    }
    if (chairpersonStatus === 'thinking') {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 bg-slate-900/20 rounded-[2rem] border border-violet-500/20">
          <div className="relative mb-10">
            <div className="animate-ping absolute inset-0 rounded-full h-20 w-20 bg-violet-500/20"></div>
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-slate-800 border-t-violet-500"></div>
          </div>
          <span className="font-black uppercase tracking-[0.4em] text-xs text-violet-400 animate-pulse">Orchestrating Consensus</span>
        </div>
      );
    }
    if (chairpersonStatus === 'error') {
        return (
            <div className="bg-red-950/30 p-12 rounded-[2rem] border border-red-800/40 text-red-300 text-center">
                <p className="font-black uppercase tracking-widest text-sm mb-3">Arbitration Protocol Failed</p>
                <p className="text-sm opacity-70">The Chairperson was unable to reconcile model differences.</p>
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
                <Markdown text={consensus.comprehensiveAnswer} />
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
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center">
            <div className="p-4 bg-violet-500/10 rounded-2xl mr-6 border border-violet-500/20 shadow-inner">
                <ChairpersonIcon className="w-9 h-9 text-violet-400" />
            </div>
            <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Final Arbitration</h2>
                <div className="flex items-center gap-5 mt-1.5">
                  <p className="text-[10px] text-slate-500 font-mono font-bold tracking-[0.2em] uppercase">
                      {modelName}
                  </p>
                  {chairpersonUsage && (
                    <div className="flex items-center gap-2.5 border-l border-slate-800 pl-4">
                       <span className="text-[10px] text-slate-600 font-black uppercase tracking-tighter">Arbitration Cost:</span>
                       <span className="text-[11px] text-violet-400 font-mono font-bold">{chairpersonUsage.totalTokens} Tokens</span>
                    </div>
                  )}
                </div>
            </div>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

export default ConsensusDashboard;