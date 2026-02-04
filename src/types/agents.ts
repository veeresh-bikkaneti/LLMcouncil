export enum AgentRole {
    Vision = 'Vision Agent',
    Technical = 'Technical Librarian',
    Empathy = 'Empathy Analyst',
    Chairperson = 'Chairperson'
}

export interface AgentAnalysis {
    role: AgentRole;
    prompt: string;
    analysis: string;
    status: 'idle' | 'thinking' | 'done' | 'error';
    modelName?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface ConsensusReport {
    comprehensiveAnswer: string;
    agentOutputs: AgentAnalysis[];
    consensusRate?: number;
    processingTime?: number;
}

export interface ModelConfig {
    id: string;
    vendor: string;
    family: string;
    maxTokens: number;
}
