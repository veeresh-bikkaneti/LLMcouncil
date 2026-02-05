"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeConsensus = exports.analyzeWithAgent = exports.sanitizeText = void 0;
const genai_1 = require("@google/genai");
const types_1 = require("../types");
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.API_KEY });
const extractUsage = (response) => {
    if (response.usageMetadata) {
        return {
            promptTokens: response.usageMetadata.promptTokenCount,
            candidatesTokens: response.usageMetadata.candidatesTokenCount,
            totalTokens: response.usageMetadata.totalTokenCount
        };
    }
    return undefined;
};
const sanitizeText = async (query) => {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Sanitize the following text by removing or replacing any Personally Identifiable Information (PII) like names, emails, phones, or addresses with [REDACTED]. Return ONLY the sanitized text. If no PII found, return original. Text: "${query}"`
    });
    return { text: response.text || query, usage: extractUsage(response) };
};
exports.sanitizeText = sanitizeText;
const getAgentPrompt = (role, query) => {
    switch (role) {
        case types_1.AgentRole.Model1:
            return `You are Model 1: The Factualist. Provide a direct, data-driven answer to: "${query}"`;
        case types_1.AgentRole.Model2:
            return `You are Model 2: The Analytical Explainer. Break down the reasoning step-by-step for: "${query}"`;
        case types_1.AgentRole.Model3:
            return `You are Model 3: The Creative Strategist. Offer a unique, "outside-the-box" perspective on: "${query}"`;
        default:
            return query;
    }
};
const analyzeWithAgent = async (role, query, modelName) => {
    const prompt = getAgentPrompt(role, query);
    const isPro = modelName.includes('pro');
    const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: isPro ? { thinkingConfig: { thinkingBudget: 16000 } } : {}
    });
    if (!response.text)
        throw new Error(`Agent ${role} failed.`);
    return { text: response.text, usage: extractUsage(response) };
};
exports.analyzeWithAgent = analyzeWithAgent;
const synthesizeConsensus = async (query, analyses) => {
    const perspectives = analyses.map(a => `## [${a.role} Perspective (Model: ${a.modelName})]\n${a.analysis}`).join('\n\n');
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Reconcile and synthesize these perspectives for the query: "${query}"\n\n${perspectives}`,
        config: {
            thinkingConfig: { thinkingBudget: 24000 },
            responseMimeType: 'application/json',
            responseSchema: {
                type: genai_1.Type.OBJECT,
                properties: {
                    comprehensiveAnswer: { type: genai_1.Type.STRING },
                },
                required: ['comprehensiveAnswer'],
            }
        },
    });
    return { text: response.text || "{}", usage: extractUsage(response) };
};
exports.synthesizeConsensus = synthesizeConsensus;
//# sourceMappingURL=geminiService.js.map