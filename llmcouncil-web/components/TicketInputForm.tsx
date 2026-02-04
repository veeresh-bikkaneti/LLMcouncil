import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AgentRole, type ModelQuota, type ConnectionStatus, type ProviderMetadata, type ModelCategory, type AnswerMode } from '../types';
import { BrainCircuitIcon, PaperAirplaneIcon, ShieldIcon, InfoIcon, CloseIcon, DownloadIcon } from './icons';

export const PROVIDERS: ProviderMetadata[] = [
  { id: 'google', name: 'Google AI Studio', baseUrl: '', logo: 'G', authType: 'native', docUrl: 'https://aistudio.google.dev' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', logo: 'O', authType: 'oauth2', docUrl: 'https://platform.openai.com' },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', logo: 'A', authType: 'api-key', docUrl: 'https://console.anthropic.com' },
  { id: 'xai', name: 'xAI (Grok)', baseUrl: 'https://api.x.ai/v1', logo: 'X', authType: 'api-key', docUrl: 'https://x.ai/api' },
  { id: 'moonshot', name: 'Moonshot AI', baseUrl: 'https://api.moonshot.cn/v1', logo: 'K', authType: 'api-key', docUrl: 'https://platform.moonshot.cn' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', logo: 'D', authType: 'api-key', docUrl: 'https://platform.deepseek.com' },
  { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', logo: '🦙', authType: 'native', docUrl: 'https://ollama.com', isLocal: true },
  { id: 'lmstudio', name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', logo: '💻', authType: 'native', docUrl: 'https://lmstudio.ai', isLocal: true },
];

export const INITIAL_MODELS: ModelQuota[] = [
  { 
    id: 'gemini-3-pro-preview', 
    label: 'Gemini 3 Pro', 
    isFree: false, 
    rpmLimit: 2, 
    description: 'Premier reasoning and long-context synthesis.',
    providerId: 'google',
    providerType: 'native-gemini',
    pricingUrl: 'https://ai.google.dev/pricing',
    connectionStatus: 'connected',
    isSystemModel: true,
    category: ['Pro', 'Reasoning'],
    isNew: true,
    tokenMetric: 30,
    tags: ['native', 'thinking']
  },
  { 
    id: 'gemini-3-flash-preview', 
    label: 'Gemini 3 Flash', 
    isFree: true, 
    rpmLimit: 15, 
    description: 'Ultra-fast model optimized for real-time triage.',
    providerId: 'google',
    providerType: 'native-gemini',
    pricingUrl: 'https://ai.google.dev/pricing',
    connectionStatus: 'connected',
    isSystemModel: true,
    category: ['Speed', 'Reasoning'],
    tokenMetric: 5,
    tags: ['native', 'fast']
  },
  { 
    id: 'deepseek-r1', 
    label: 'DeepSeek R1', 
    isFree: true, 
    rpmLimit: 10, 
    description: 'SOTA open-weights reasoning model.',
    providerId: 'deepseek',
    providerType: 'openai-compatible',
    pricingUrl: 'https://deepseek.ai',
    requiresKey: true,
    connectionStatus: 'disconnected',
    category: ['Reasoning', 'Speed'],
    tokenMetric: 5,
    tags: ['thinking', 'logic']
  },
  { 
    id: 'gpt-5.2-preview', 
    label: 'GPT-5.2', 
    isFree: false, 
    rpmLimit: 5, 
    description: 'Next-gen reasoning with multi-modal reasoning chains.',
    providerId: 'openai',
    providerType: 'openai-compatible',
    pricingUrl: 'https://openai.com/pricing',
    requiresKey: true,
    connectionStatus: 'disconnected',
    category: ['Pro', 'Reasoning'],
    isNew: true,
    tokenMetric: 300,
    tags: ['cutting-edge', 'high-cost']
  },
  { 
    id: 'claude-4.5-opus', 
    label: 'Claude 4.5 Opus', 
    isFree: false, 
    rpmLimit: 5, 
    description: 'Superior logic and human-like synthesis.',
    providerId: 'anthropic',
    providerType: 'anthropic',
    pricingUrl: 'https://anthropic.com/pricing',
    requiresKey: true,
    connectionStatus: 'disconnected',
    category: ['Pro', 'Writing'],
    isNew: true,
    tokenMetric: 150,
    tags: ['nuance', 'long-context']
  },
  { 
    id: 'grok-4-preview', 
    label: 'Grok 4', 
    isFree: false, 
    rpmLimit: 10, 
    description: 'Real-time X-integrated intelligence.',
    providerId: 'xai',
    providerType: 'openai-compatible',
    pricingUrl: 'https://x.ai/api',
    requiresKey: true,
    connectionStatus: 'disconnected',
    category: ['Speed', 'Pro'],
    isNew: true,
    tokenMetric: 60,
    tags: ['fast', 'real-time']
  },
  { 
    id: 'kimi-k2', 
    label: 'Kimi K2', 
    isFree: true, 
    rpmLimit: 15, 
    description: 'Long-context optimization specialist.',
    providerId: 'moonshot',
    providerType: 'openai-compatible',
    pricingUrl: 'https://kimi.moonshot.ai',
    requiresKey: true,
    connectionStatus: 'disconnected',
    category: ['Writing', 'Speed'],
    tokenMetric: 5,
    tags: ['efficient']
  },
  { 
    id: 'llama3-70b', 
    label: 'Llama 3 70B (Local)', 
    isFree: true, 
    rpmLimit: 100, 
    description: 'Local private inference via Ollama/LMStudio.',
    providerId: 'ollama',
    providerType: 'openai-compatible',
    baseUrl: 'http://localhost:11434/v1',
    pricingUrl: 'https://ollama.com',
    connectionStatus: 'disconnected',
    category: ['Local', 'Pro'],
    tokenMetric: 1,
    tags: ['local', 'privacy']
  }
];

const CATEGORIES: ModelCategory[] = ['All', 'Pro', 'Reasoning', 'Coding', 'Writing', 'Speed', 'Local'];

const ModelInfoTooltip: React.FC<{ model: ModelQuota; provider?: ProviderMetadata }> = ({ model, provider }) => (
  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-72 p-5 bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl z-[200] opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-300 transform translate-y-2 group-hover/info:translate-y-0 backdrop-blur-2xl ring-1 ring-white/10">
    <div className="flex justify-between items-center mb-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-[10px] font-black text-violet-400">
          {provider?.logo}
        </div>
        <span className="text-[11px] font-black text-white uppercase tracking-widest">{provider?.name}</span>
      </div>
      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${model.isFree ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
        {model.isFree ? 'FREE TIER' : 'PAID LINK'}
      </span>
    </div>
    <p className="text-[11px] text-slate-400 leading-relaxed mb-4">{model.description}</p>
    {model.tags && (
      <div className="flex flex-wrap gap-1.5 mb-4">
        {model.tags.map(t => (
          <span key={t} className="text-[8px] font-bold text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50 uppercase">#{t}</span>
        ))}
      </div>
    )}
    <a href={model.pricingUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-violet-400 hover:text-violet-300 font-black uppercase tracking-widest pointer-events-auto block border-t border-slate-800 pt-3 transition-colors">
      View Integration Docs &rarr;
    </a>
  </div>
);

interface InputPanelProps {
  query: string;
  setQuery: (q: string) => void;
  handleSubmit: () => void;
  handleCancel: () => void;
  isLoading: boolean;
  useAutomation: boolean;
  setUseAutomation: (v: boolean) => void;
  selectedModels: Record<AgentRole, string>;
  onModelChange: (role: AgentRole, model: string) => void;
  requestCounts: Record<string, number>;
  onShowCancel: () => void;
  answerMode: AnswerMode;
  setAnswerMode: (m: AnswerMode) => void;
}

const InputPanel: React.FC<InputPanelProps> = ({
  query, setQuery, handleSubmit, handleCancel, isLoading, useAutomation, setUseAutomation, selectedModels, onModelChange, requestCounts, onShowCancel, answerMode, setAnswerMode
}) => {
  const [activeTab, setActiveTab] = useState<'mission' | 'hub'>('mission');
  const [registry, setRegistry] = useState<ModelQuota[]>(INITIAL_MODELS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ModelCategory>('All');
  const [showMegaMenu, setShowMegaMenu] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean, provider?: ProviderMetadata, modelId?: string }>({ open: false });
  const [customEndpointModal, setCustomEndpointModal] = useState<{ open: boolean, provider?: ProviderMetadata, isExisting?: boolean, targetModelId?: string }>({ open: false });
  const [keyInput, setKeyInput] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkLocalStatus = async () => {
      const updatedRegistry = await Promise.all(registry.map(async (m) => {
        const provider = PROVIDERS.find(p => p.id === m.providerId);
        if (provider?.isLocal) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            await fetch(m.baseUrl || '', { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
            clearTimeout(timeoutId);
            return { ...m, connectionStatus: 'connected' as ConnectionStatus };
          } catch (err) {
            return { ...m, connectionStatus: 'error' as ConnectionStatus };
          }
        }
        return m;
      }));
      
      const hasChanged = updatedRegistry.some((m, i) => m.connectionStatus !== registry[i].connectionStatus);
      if (hasChanged) {
        setRegistry(updatedRegistry);
      }
    };

    if (activeTab === 'hub') {
      checkLocalStatus();
      const interval = setInterval(checkLocalStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab, registry]);

  const filteredModels = useMemo(() => {
    return registry.filter(m => {
      const searchTerms = [
        m.label,
        m.providerId,
        m.description,
        ...(m.tags || []),
        ...(m.category || [])
      ].join(' ').toLowerCase();
      
      const matchesSearch = searchTerms.includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || m.category.includes(activeCategory);
      return matchesSearch && matchesCategory;
    });
  }, [registry, searchQuery, activeCategory]);

  const updateModelStatus = (id: string, status: ConnectionStatus, key?: string) => {
    setRegistry(prev => prev.map(m => m.id === id ? { ...m, connectionStatus: status, apiKey: key || m.apiKey } : m));
  };

  const handleConnect = async (model: ModelQuota) => {
    const provider = PROVIDERS.find(p => p.id === model.providerId);
    if (!provider) return;

    if (provider.isLocal) {
      setCustomUrl(model.baseUrl || provider.baseUrl || '');
      setCustomModelId(model.id);
      setCustomEndpointModal({ open: true, provider, isExisting: true, targetModelId: model.id });
      return;
    }

    if (provider.id === 'google' && (window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      updateModelStatus(model.id, 'connected');
    } else if (provider.authType === 'native') {
      updateModelStatus(model.id, 'connected');
    } else {
      setAuthModal({ open: true, provider, modelId: model.id });
    }
  };

  const saveEndpoint = () => {
    const provider = customEndpointModal.provider;
    if (!provider) return;
    
    if (customEndpointModal.isExisting && customEndpointModal.targetModelId) {
      setRegistry(prev => prev.map(m => m.id === customEndpointModal.targetModelId ? {
        ...m,
        baseUrl: customUrl,
        connectionStatus: 'connecting'
      } : m));
    } else {
      const newId = customModelId || `${provider.id}-${Date.now()}`;
      setRegistry([...registry, {
        id: newId,
        label: `${provider.name} Custom`,
        isFree: provider.isLocal || false,
        rpmLimit: 60,
        description: `Custom endpoint pointed to ${customUrl}`,
        providerId: provider.id,
        providerType: provider.id === 'anthropic' ? 'anthropic' : (provider.id === 'google' ? 'native-gemini' : 'openai-compatible'),
        baseUrl: customUrl || provider.baseUrl,
        pricingUrl: provider.docUrl,
        requiresKey: !provider.isLocal,
        connectionStatus: 'disconnected',
        category: provider.isLocal ? ['Local'] : ['Pro'],
        tags: ['custom', provider.isLocal ? 'local' : 'remote'],
        tokenMetric: 1
      }]);
    }
    setCustomEndpointModal({ open: false });
    setCustomUrl('');
    setCustomModelId('');
  };

  return (
    <div className="flex flex-col gap-6 sticky top-8">
      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex bg-slate-900/60 p-1 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-md">
          <button onClick={() => setActiveTab('mission')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === 'mission' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Mission</button>
          <button onClick={() => setActiveTab('hub')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === 'hub' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Model Hub</button>
        </div>
        
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                const json = JSON.parse(event.target?.result as string);
                setRegistry(prev => prev.map(m => {
                  const key = json[m.providerId] || json[m.id];
                  return key ? { ...m, apiKey: key, connectionStatus: 'connected' } : m;
                }));
              } catch (err) { alert("Invalid Vault JSON."); }
            };
            reader.readAsText(file);
          }} className="hidden" accept=".json" />
          <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-emerald-500 hover:border-emerald-500/50 transition-all shadow-md" title="Link Vault"><ShieldIcon className="w-5 h-5" /></button>
          <button onClick={() => setShowMegaMenu(!showMegaMenu)} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-violet-500 hover:border-violet-500/50 transition-all shadow-md" title="Add Endpoint"><BrainCircuitIcon className="w-5 h-5" /></button>
        </div>
      </div>

      {showMegaMenu && (
        <div className="absolute top-20 right-0 w-80 bg-slate-900 border border-slate-700/50 rounded-[2rem] p-6 shadow-2xl z-[100] animate-fade-in backdrop-blur-2xl ring-1 ring-white/10">
          <div className="flex justify-between items-center mb-6 px-1">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connect Instance</h3>
            <button onClick={() => setShowMegaMenu(false)} className="text-slate-600 hover:text-white"><CloseIcon className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => { setCustomUrl(p.baseUrl || ''); setCustomEndpointModal({ open: true, provider: p }); setShowMegaMenu(false); }} className="flex items-center gap-2.5 p-3 bg-slate-950/50 border border-slate-800 rounded-xl hover:bg-violet-500/10 hover:border-violet-500/30 transition-all text-left group">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-black text-[10px] text-violet-400 group-hover:bg-violet-600/20">{p.logo}</div>
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-white truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'mission' ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl animate-fade-in backdrop-blur-xl space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PaperAirplaneIcon className="w-5 h-5 text-violet-500 rotate-45" />
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Council Signal</h2>
            </div>
            
            {/* Answer Mode Toggle */}
            <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800 shadow-inner">
              <button 
                onClick={() => setAnswerMode('simple')} 
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${answerMode === 'simple' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:text-slate-400'}`}
              >
                Simple
              </button>
              <button 
                onClick={() => setAnswerMode('complex')} 
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${answerMode === 'complex' ? 'bg-violet-600/20 text-violet-400 border border-violet-500/20 shadow-md' : 'text-slate-600 hover:text-slate-400'}`}
              >
                Complex
              </button>
            </div>
          </div>
          
          <textarea
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Input objective for parallel deliberation..."
            className="w-full h-44 bg-slate-950/80 border border-slate-800 rounded-3xl p-6 text-sm text-slate-100 focus:ring-2 focus:ring-violet-500/50 outline-none resize-none transition-all shadow-inner placeholder:text-slate-800"
            disabled={isLoading}
          />
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              {[AgentRole.Model1, AgentRole.Model2, AgentRole.Model3].map(role => (
                <div key={role} className="space-y-2">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{role} Specialist</label>
                   <select 
                      value={selectedModels[role]} 
                      onChange={(e) => onModelChange(role, e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-200 outline-none focus:border-violet-500/50 appearance-none transition-all"
                   >
                     {registry.filter(m => m.connectionStatus === 'connected' || m.isSystemModel).map(m => (
                       <option key={m.id} value={m.id} className="bg-slate-900">{m.label} ({m.providerId})</option>
                     ))}
                   </select>
                </div>
              ))}
            </div>
            <button onClick={handleSubmit} disabled={isLoading || !query.trim()} className="w-full py-4.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-black rounded-[1.5rem] transition-all uppercase tracking-[0.2em] text-[11px] shadow-xl active:scale-95">
              {isLoading ? 'Signal Processing...' : 'Invoke Universal Council'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl animate-fade-in backdrop-blur-xl flex flex-col gap-6 h-[80vh] min-h-[500px]">
          <div className="space-y-4 flex-shrink-0">
            <div className="relative">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search models, tags, descriptions..." className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl py-3 px-6 pl-12 text-sm text-slate-200 focus:ring-2 focus:ring-violet-500/50 outline-none shadow-inner" />
              <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${activeCategory === cat ? 'bg-white text-slate-900 border-white' : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:border-slate-700'}`}>{cat}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar flex-grow">
            {filteredModels.map(m => {
              const provider = PROVIDERS.find(p => p.id === m.providerId);
              const statusColor = m.connectionStatus === 'connected' ? 'emerald' : m.connectionStatus === 'error' ? 'rose' : 'slate';
              return (
                <div key={m.id} className={`p-4 rounded-2xl border transition-all relative group flex flex-col gap-3 ${m.connectionStatus === 'connected' ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.02)]' : 'bg-slate-950/60 border-slate-800 hover:border-violet-500/30'}`}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-xs font-black text-violet-400 border border-slate-800 flex-shrink-0 group-hover:border-violet-500/40 transition-colors">{provider?.logo || 'M'}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-black text-slate-100 uppercase tracking-tight truncate">{m.label}</span>
                          {m.isNew && <span className="text-[7px] bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-black uppercase">New</span>}
                        </div>
                        <span className="text-[9px] text-slate-600 font-mono tracking-widest block uppercase truncate">{m.providerId}</span>
                      </div>
                    </div>
                    <div className="relative group/info flex-shrink-0">
                      <div className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-help"><InfoIcon className="w-4 h-4 text-slate-600 group-hover/info:text-violet-400" /></div>
                      <ModelInfoTooltip model={m} provider={provider} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800/40">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full bg-${statusColor}-500 shadow-[0_0_8px_rgba(var(--tw-${statusColor}-500-rgb),0.5)]`} />
                      <span className={`text-[9px] font-black uppercase text-${statusColor}-500 tracking-widest`}>{m.connectionStatus || 'disconnected'}</span>
                      <span className="text-slate-800/30">|</span>
                      <div className="text-[9px] font-bold text-slate-600 flex items-center gap-1.5"><svg className="w-2.5 h-2.5 text-amber-500" viewBox="0 0 24 24" fill="currentColor"><path d="M13 10V3L4 14H11V21L20 10H13Z"/></svg>{m.tokenMetric || 1}</div>
                    </div>
                    {m.connectionStatus !== 'connected' && (
                      <button onClick={(e) => { e.stopPropagation(); handleConnect(m); }} className="text-[9px] font-black uppercase text-violet-400 hover:text-white transition-all px-3 py-1 bg-violet-600/10 rounded-lg border border-violet-500/20 active:scale-95">Establish Link</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FIXED: Non-blocking Smaller Modal Container */}
      {(customEndpointModal.open || authModal.open) && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[300] w-[90%] max-w-sm pointer-events-none flex items-center justify-center animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/50 rounded-[2rem] p-6 sm:p-8 w-full shadow-[0_0_100px_rgba(0,0,0,0.8)] relative ring-1 ring-white/10 pointer-events-auto">
            <button onClick={() => { setCustomEndpointModal({ open: false }); setAuthModal({ open: false }); }} className="absolute top-6 right-6 text-slate-500 hover:text-white"><CloseIcon className="w-4 h-4" /></button>
            
            {customEndpointModal.open && (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-xl font-black text-violet-400 shadow-inner">{customEndpointModal.provider?.logo}</div>
                  <div><h3 className="text-lg font-black text-white uppercase tracking-tight">Endpoint Config</h3><p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">{customEndpointModal.provider?.name}</p></div>
                </div>
                <div className="space-y-4">
                  {customEndpointModal.provider?.isLocal && (
                    <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                      <p className="text-[9px] text-slate-400 leading-relaxed italic">For <b>Ollama</b>, start with <code className="text-violet-400">OLLAMA_ORIGINS="*"</code>.</p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1 tracking-widest">Base URL</label>
                    <input type="text" value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder={customEndpointModal.provider?.baseUrl || "http://..."} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-[12px] text-slate-100 outline-none focus:ring-1 focus:ring-violet-500/40 transition-all" />
                  </div>
                  {!customEndpointModal.isExisting && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase ml-1 tracking-widest">Model ID</label>
                      <input type="text" value={customModelId} onChange={e => setCustomModelId(e.target.value)} placeholder="llama3, etc." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-[12px] text-slate-100 outline-none focus:ring-1 focus:ring-violet-500/40 transition-all" />
                    </div>
                  )}
                  <button onClick={saveEndpoint} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg uppercase tracking-[0.1em] text-[10px] shadow-lg active:scale-95 transition-all">Verify & Link</button>
                </div>
              </>
            )}

            {authModal.open && (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-xl font-black text-violet-400 shadow-inner">{authModal.provider?.logo}</div>
                  <div><h3 className="text-lg font-black text-white uppercase tracking-tight">Authorize</h3><p className="text-[9px] text-slate-500 uppercase tracking-widest font-black">{authModal.provider?.name}</p></div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1 tracking-widest">API Key / Token</label>
                    <input type="password" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="sk-..." className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-[12px] text-violet-400 font-mono outline-none focus:ring-1 focus:ring-violet-500/40 transition-all shadow-inner" />
                  </div>
                  <button onClick={() => { if (authModal.modelId && keyInput) { updateModelStatus(authModal.modelId, 'connected', keyInput); setKeyInput(''); setAuthModal({ open: false }); } }} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-lg uppercase tracking-[0.2em] text-[10px] shadow-lg active:scale-95 transition-all">Establish Link</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InputPanel;