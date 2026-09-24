import { GoogleGenAI, Type } from "@google/genai";
import { AgentRole, type AgentAnalysis, type TokenUsage, type ModelQuota, type AnswerMode, type ConsensusReport } from '../types';
import { sanitizePII } from '../src/engine/sanitize';
import { CONFIDENCE_RULE, formatSources, GROUNDING_RULES, localInputBudgetChars, parseGroundedOutput, promptCost, truncate } from '../src/engine/grounding';
import type { SearchResult } from '../src/engine/types';
import { cancelScope, currentEpoch } from '../src/engine/cancellation';
import { getDeviceProfile } from '../src/engine/models';

// Only non-empty when the deployment was built with GEMINI_API_KEY set; Vite compiles
// this to a literal `undefined` otherwise.
export const BUILTIN_GEMINI_KEY: string = process.env.API_KEY || '';

export interface LocalRunHooks {
  /** Grounding sources, retrieved once per question and shared by every local seat. */
  sources?: SearchResult[];
  onProgress?: (text: string, fraction?: number) => void;
}

interface AgentResult {
  text: string;
  usage?: TokenUsage;
  /** The model actually used, if it differs from the one the seat was set to (see
   *  engineManager's step-down ladder). Only ever set for webllm results. */
  resolvedModelId?: string;
}

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

const callAnthropic = async (model: ModelQuota, prompt: string): Promise<AgentResult> => {
  const url = `${model.baseUrl || 'https://api.anthropic.com/v1'}/messages`;

  if (!model.apiKey) throw new Error(`Anthropic key required for ${model.label}.`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': model.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
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

const callOpenAICompatible = async (model: ModelQuota, prompt: string): Promise<AgentResult> => {
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

const geminiClient = (model: ModelQuota): GoogleGenAI => {
  const apiKey = model.apiKey || BUILTIN_GEMINI_KEY;
  if (!apiKey) {
    throw new Error(`${model.label} needs a Gemini API key. Add one in the Model Hub, or pick an in-browser model.`);
  }
  return new GoogleGenAI({ apiKey });
};

// On-device and synchronous. This used to be a Gemini call, which meant sending the
// raw, unscrubbed query to a cloud API in order to "protect" it.
export const sanitizeText = (query: string): { text: string } => ({ text: sanitizePII(query) });

const getAgentPrompt = (role: AgentRole, query: string): string => {
  switch (role) {
    case AgentRole.Model1: return `Direct, data-driven precision analysis for: "${query}"`;
    case AgentRole.Model2: return `Deep step-by-step reasoning and implications for: "${query}"`;
    default: return query;
  }
};

const LOCAL_PERSONA: Partial<Record<AgentRole, string>> = {
  [AgentRole.Model1]: 'You are Model 1 on an LLM council, the Factualist: give a direct, precise, data-driven answer.',
  [AgentRole.Model2]: 'You are Model 2 on an LLM council, the Analyst: reason step by step through the question and its implications.',
};

// Small in-browser models ramble without a cap, and the Council runs three of these
// generations back to back on one engine.
// Phones run a 2048-token window, so replies are capped lower there.
const LOCAL_MAX_TOKENS: Record<AnswerMode, number> = getDeviceProfile().constrained
  ? { simple: 256, complex: 400 }
  : { simple: 320, complex: 900 };

/** Stops the Council's in-browser generations, including any not yet started. */
export const cancelLocalGenerations = (): void => cancelScope('council');

/** Budgets for variable prompt content so a local prompt plus reply fits the model's context. */
const localBudget = (query: string, mode: AnswerMode) => {
  const total = localInputBudgetChars(LOCAL_MAX_TOKENS[mode]);
  // A huge pasted query must not crowd out everything else.
  const trimmedQuery = truncate(query, Math.floor(total * 0.25));
  return { query: trimmedQuery, remaining: total - promptCost(trimmedQuery) };
};

const runLocal = async (
  model: ModelQuota,
  systemPrompt: string,
  userPrompt: string,
  mode: AnswerMode,
  hooks?: LocalRunHooks
): Promise<{ text: string; resolvedModelId: string }> => {
  // Captured before the import: on a cold cache the engine chunk can take a while to
  // arrive, and an abort in the meantime must still cancel this generation.
  const epoch = currentEpoch('council');
  // Dynamic import keeps the ~6MB WebLLM runtime out of the main bundle until an
  // in-browser model is actually used.
  const { generate } = await import('../src/engine/engineManager');
  let resolvedModelId = model.id;
  const text = await generate(
    model.id,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      scope: 'council',
      epoch,
      temperature: 0,
      maxTokens: LOCAL_MAX_TOKENS[mode],
      onProgress: hooks?.onProgress,
      onModelResolved: (id) => { resolvedModelId = id; },
    }
  );
  return { text, resolvedModelId };
};

export const analyzeWithAgent = async (
  role: AgentRole,
  query: string,
  model: ModelQuota,
  mode: AnswerMode,
  hooks?: LocalRunHooks
): Promise<AgentResult> => {
  if (model.providerType === 'webllm') {
    const budget = localBudget(query, mode);
    const systemPrompt = [
      LOCAL_PERSONA[role] ?? 'You are a member of an LLM council.',
      GROUNDING_RULES,
      `SOURCES:\n${formatSources(hooks?.sources ?? [], budget.remaining)}`,
    ].join('\n\n');
    const { text: raw, resolvedModelId } = await runLocal(model, systemPrompt, budget.query, mode, hooks);
    const { answer } = parseGroundedOutput(raw);
    if (!answer) throw new Error(`${model.label} returned an empty answer.`);
    return { text: answer, resolvedModelId: resolvedModelId !== model.id ? resolvedModelId : undefined };
  }

  const prompt = getAgentPrompt(role, query);
  let result: AgentResult;

  if (model.providerType === 'native-gemini') {
    const ai = geminiClient(model);
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
    result = { text: response.text, usage: extractUsage(response) };
  } else if (model.providerType === 'anthropic') {
    result = await callAnthropic(model, prompt);
  } else {
    result = await callOpenAICompatible(model, prompt);
  }

  return { ...result, text: sanitizePII(result.text) };
};

export const synthesizeConsensus = async (
  query: string,
  analyses: AgentAnalysis[],
  mode: AnswerMode,
  chairModel: ModelQuota,
  hooks?: LocalRunHooks
): Promise<{ report: ConsensusReport; usage?: TokenUsage; resolvedModelId?: string }> => {
  const perspectives = analyses.map(a => `## [${a.role} (${a.modelName})]\n${a.analysis}`).join('\n\n');
  const instruction = `Arbitrate and synthesize these multi-agent deliberations into a single superior consensus for: "${query}"`;

  if (chairModel.providerType === 'webllm') {
    // The Chairperson sees the sources AND every member's answer, which easily
    // overflows a 4096-token window untrimmed. Split the budget between them.
    const budget = localBudget(query, mode);
    const sourceChars = Math.floor(budget.remaining * 0.4);
    const perPerspective = Math.floor((budget.remaining - sourceChars) / Math.max(1, analyses.length));
    const localPerspectives = analyses
      .map(a => `## [${a.role} (${a.modelName})]\n${truncate(a.analysis, perPerspective)}`)
      .join('\n\n');
    const systemPrompt = [
      "You are the Chairperson of an LLM council. Reconcile the members' perspectives into one answer, " +
        'resolving any disagreement in favour of what the sources support.',
      GROUNDING_RULES,
      CONFIDENCE_RULE,
      `SOURCES:\n${formatSources(hooks?.sources ?? [], sourceChars)}`,
    ].join('\n\n');
    const localInstruction = `Arbitrate and synthesize these multi-agent deliberations into a single superior consensus for: "${budget.query}"`;
    const { text: raw, resolvedModelId } = await runLocal(chairModel, systemPrompt, `${localInstruction}\n\n${localPerspectives}`, mode, hooks);
    const { answer, confidence } = parseGroundedOutput(raw);
    if (!answer) throw new Error(`${chairModel.label} returned an empty synthesis.`);
    return {
      report: { comprehensiveAnswer: answer, confidence },
      resolvedModelId: resolvedModelId !== chairModel.id ? resolvedModelId : undefined,
    };
  }

  if (chairModel.providerType === 'native-gemini') {
    const ai = geminiClient(chairModel);
    const thinkingBudget = mode === 'complex' ? 32768 : 0;
    const response = await ai.models.generateContent({
      model: chairModel.id,
      contents: `${instruction}\n\n${perspectives}`,
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

    let parsed: ConsensusReport;
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      throw new Error('Arbitration failed: invalid synthesis format.');
    }
    if (!parsed.comprehensiveAnswer) throw new Error('Arbitration failed: empty synthesis.');
    return {
      report: { comprehensiveAnswer: sanitizePII(parsed.comprehensiveAnswer) },
      usage: extractUsage(response),
    };
  }

  const result = chairModel.providerType === 'anthropic'
    ? await callAnthropic(chairModel, `${instruction}\n\n${perspectives}`)
    : await callOpenAICompatible(chairModel, `${instruction}\n\n${perspectives}`);
  return { report: { comprehensiveAnswer: sanitizePII(result.text) }, usage: result.usage };
};
