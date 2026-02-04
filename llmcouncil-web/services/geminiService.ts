import { GoogleGenAI, Type } from "@google/genai";
import { AgentRole, type AgentAnalysis, type TokenUsage } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const extractUsage = (response: any): TokenUsage | undefined => {
  if (response.usageMetadata) {
    return {
      promptTokens: response.usageMetadata.promptTokenCount,
      candidatesTokens: response.usageMetadata.candidatesTokenCount,
      totalTokens: response.usageMetadata.totalTokenCount
    };
  }
  return undefined;
};

export const sanitizeText = async (query: string): Promise<{ text: string, usage?: TokenUsage }> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Sanitize the following text by removing or replacing any Personally Identifiable Information (PII) like names, emails, phones, or addresses with [REDACTED]. Return ONLY the sanitized text. If no PII found, return original. Text: "${query}"`
  });
  return { text: response.text || query, usage: extractUsage(response) };
};

const getAgentPrompt = (role: AgentRole, query: string): string => {
  switch (role) {
    case AgentRole.Model1:
      return `You are Model 1: The Factualist. Provide a direct, data-driven answer to: "${query}"`;
    case AgentRole.Model2:
      return `You are Model 2: The Analytical Explainer. Break down the reasoning step-by-step for: "${query}"`;
    case AgentRole.Model3:
      return `You are Model 3: The Creative Strategist. Offer a unique, "outside-the-box" perspective on: "${query}"`;
    default:
      return query;
  }
};

export const analyzeWithAgent = async (role: AgentRole, query: string, modelName: string): Promise<{ text: string, usage?: TokenUsage }> => {
  const prompt = getAgentPrompt(role, query);
  const isPro = modelName.includes('pro');
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: isPro ? { thinkingConfig: { thinkingBudget: 16000 } } : {}
  });

  if (!response.text) throw new Error(`Agent ${role} failed.`);
  return { text: response.text, usage: extractUsage(response) };
};

export const synthesizeConsensus = async (query: string, analyses: AgentAnalysis[]): Promise<{ text: string, usage?: TokenUsage }> => {
  const perspectives = analyses.map(a => `## [${a.role} Perspective (Model: ${a.modelName})]\n${a.analysis}`).join('\n\n');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Reconcile and synthesize these perspectives for the query: "${query}"\n\n${perspectives}`,
    config: {
      thinkingConfig: { thinkingBudget: 24000 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          comprehensiveAnswer: { type: Type.STRING },
        },
        required: ['comprehensiveAnswer'],
      }
    },
  });
  
  return { text: response.text || "{}", usage: extractUsage(response) };
};