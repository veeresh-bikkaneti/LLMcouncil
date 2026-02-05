import { GoogleGenAI, Type } from "@google/genai";
import { AgentRole, type AgentAnalysis, type TokenUsage, type ModelQuota, type AnswerMode } from '../types';

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

const callAnthropic = async (model: ModelQuota, prompt: string): Promise<{ text: string, usage?: TokenUsage }> => {
  const url = `${model.baseUrl || 'https://api.anthropic.com/v1'}/messages`;
  
  if (!model.apiKey) throw new Error(`Anthropic key required for ${model.label}.`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': model.apiKey,
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true'
    },
    body: JSON.stringify({
      model: model.id,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Anthropic Error: ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.content[0].text,
    usage: data.usage ? {
      promptTokens: data.usage.input_tokens,
      candidatesTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens
    } : undefined
  };
};

const callOpenAICompatible = async (model: ModelQuota, prompt: string): Promise<{ text: string, usage?: TokenUsage }> => {
  const url = `${model.baseUrl || 'https://api.openai.com/v1'}/chat/completions`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (model.apiKey) {
    headers['Authorization'] = `Bearer ${model.apiKey}`;
  } else if (model.requiresKey) {
    throw new Error(`Authentication required for ${model.label}. Link a Vault or Connect via Hub.`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model.id,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { message: 'Inference link failure' } }));
    throw new Error(err.error?.message || `HTTP ${response.status} from ${model.providerId}`);
  }

  const data = await response.json();
  return {
    text: data.choices[0].message.content,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      candidatesTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens
    } : undefined
  };
};

export const sanitizeText = async (query: string): Promise<{ text: string, usage?: TokenUsage }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Sanitize this user input for PII (names, emails, phones). Redact sensitive info but keep intent intact. Return ONLY the sanitized version: "${query}"`
  });
  return { text: response.text || query, usage: extractUsage(response) };
};

const getAgentPrompt = (role: AgentRole, query: string): string => {
  switch (role) {
    case AgentRole.Model1: return `Direct, data-driven precision analysis for: "${query}"`;
    case AgentRole.Model2: return `Deep step-by-step reasoning and implications for: "${query}"`;
    case AgentRole.Model3: return `Creative multi-perspective strategic view on: "${query}"`;
    default: return query;
  }
};

export const analyzeWithAgent = async (role: AgentRole, query: string, model: ModelQuota, mode: AnswerMode): Promise<{ text: string, usage?: TokenUsage }> => {
  const prompt = getAgentPrompt(role, query);
  
  if (model.providerType === 'native-gemini') {
    const apiKey = model.apiKey || process.env.API_KEY!;
    const ai = new GoogleGenAI({ apiKey });
    const isPro = model.id.includes('pro');
    const isFlash = model.id.includes('flash');
    
    // Configure thinking budget based on answer mode
    let thinkingBudget = 0;
    if (mode === 'complex') {
        if (isPro) thinkingBudget = 32768;
        else if (isFlash) thinkingBudget = 24576;
        else thinkingBudget = 16000; // Generic fallback for other gemini models
    }

    const response = await ai.models.generateContent({
      model: model.id,
      contents: prompt,
      config: thinkingBudget > 0 ? { thinkingConfig: { thinkingBudget } } : {}
    });
    if (!response.text) throw new Error(`Agent ${role} link interrupted.`);
    return { text: response.text, usage: extractUsage(response) };
  } else if (model.providerType === 'anthropic') {
    return await callAnthropic(model, prompt);
  } else {
    return await callOpenAICompatible(model, prompt);
  }
};

export const synthesizeConsensus = async (query: string, analyses: AgentAnalysis[], mode: AnswerMode): Promise<{ text: string, usage?: TokenUsage }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
  const perspectives = analyses.map(a => `## [${a.role} (${a.modelName})]\n${a.analysis}`).join('\n\n');
  
  const thinkingBudget = mode === 'complex' ? 32768 : 0;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Arbitrate and synthesize these multi-agent deliberations into a single superior consensus for: "${query}"\n\n${perspectives}`,
    config: {
      thinkingConfig: thinkingBudget > 0 ? { thinkingBudget } : undefined,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: { comprehensiveAnswer: { type: Type.STRING } },
        required: ['comprehensiveAnswer'],
      }
    },
  });
  
  return { text: response.text || "{}", usage: extractUsage(response) };
};