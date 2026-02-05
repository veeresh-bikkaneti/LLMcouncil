export interface AgentType {
    id: 'vision' | 'technical' | 'empathy';
    name: string;
    emoji: string;
    role: string;
}

export interface AgentAnalysis {
    agent: AgentType;
    status: 'idle' | 'thinking' | 'done' | 'error';
    response: string;
    error?: string;
}

export interface Analysis {
    id: string;
    timestamp: number;
    query: string;
    agentOutputs: AgentAnalysis[];
    consensus: string;
    consensusRate: number;
    url: string;
}

export interface APIConfig {
    provider: 'openai' | 'anthropic' | 'gemini';
    apiKey: string;
    model: string;
}

export interface StorageSchema {
    apiConfig?: APIConfig;
    analysisHistory: Analysis[];
    settings: {
        theme: 'light' | 'dark';
        autoOpen: boolean;
        enableHistory: boolean;
    };
}

export const AGENTS: AgentType[] = [
    {
        id: 'vision',
        name: 'Vision Agent',
        emoji: '👁️',
        role: 'Analyzes visual aspects, UI/UX issues'
    },
    {
        id: 'technical',
        name: 'Technical Librarian',
        emoji: '📚',
        role: 'Searches for technical solutions'
    },
    {
        id: 'empathy',
        name: 'Empathy Analyst',
        emoji: '❤️',
        role: 'Assesses user sentiment and urgency'
    }
];
