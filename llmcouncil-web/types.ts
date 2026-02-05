export enum AgentRole {
  Privacy = 'Privacy Shield',
  Model1 = 'Model 1',
  Model2 = 'Model 2',
  Model3 = 'Model 3',
  Chairperson = 'Chairperson'
}

export type ProviderType = 'native-gemini' | 'openai-compatible' | 'anthropic';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type AnswerMode = 'simple' | 'complex';

export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface AgentAnalysis {
  role: AgentRole;
  prompt: string;
  analysis: string;
  status: 'idle' | 'thinking' | 'done' | 'error';
  modelName: string;
  providerType: ProviderType;
  usage?: TokenUsage;
}

export interface ConsensusReport {
  comprehensiveAnswer: string;
}

export interface ProviderMetadata {
  id: string;
  name: string;
  baseUrl: string;
  logo: string;
  authType: 'api-key' | 'oauth2' | 'native';
  docUrl: string;
  isLocal?: boolean;
}

export type ModelCategory = 'All' | 'Pro' | 'Reasoning' | 'Coding' | 'Writing' | 'Speed' | 'Local';

export interface ModelQuota {
  id: string;
  label: string;
  isFree: boolean;
  rpmLimit: number;
  description: string;
  providerId: string;
  providerType: ProviderType;
  baseUrl?: string;
  apiKey?: string; 
  pricingUrl: string;
  tags?: string[];
  category: ModelCategory[];
  requiresKey?: boolean;
  connectionStatus?: ConnectionStatus;
  isSystemModel?: boolean;
  isPinned?: boolean;
  isNew?: boolean;
  tokenMetric?: number;
}