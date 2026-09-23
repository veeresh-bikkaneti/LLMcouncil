import React from 'react';
import { BrainCircuitIcon, CpuIcon } from './icons';

export type AppMode = 'council' | 'local';

interface ModeSwitcherProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

const ModeSwitcher: React.FC<ModeSwitcherProps> = ({ mode, onChange }) => {
  return (
    <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
      <button
        onClick={() => onChange('council')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
          mode === 'council' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <BrainCircuitIcon className="w-3.5 h-3.5" />
        Universal Council
      </button>
      <button
        onClick={() => onChange('local')}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
          mode === 'local' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <CpuIcon className="w-3.5 h-3.5" />
        Local Assistant
      </button>
    </div>
  );
};

export default ModeSwitcher;
