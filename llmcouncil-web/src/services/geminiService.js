"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeConsensus = exports.analyzeWithAgent = exports.sanitizeText = void 0;
const genai_1 = require("@google/genai");
const types_1 = require("../types");
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.API_KEY });
const getModelConfig = (useThinkingMode) => {
    if (useThinkingMode) {
        return {
            model: 'gemini-3-pro-preview',
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
            }
        };
    }
    return {
        model: 'gemini-3-flash-preview',
        config: {}
    };
};
const sanitizeText = async (query) => {
    const { model, config } = getModelConfig(false); // Use the faster model for sanitization
    const prompt = `Sanitize the following text by removing or replacing any Personally Identifiable Information (PII) such as names, email addresses, phone numbers, and physical addresses with placeholders like [REDACTED_NAME] or [REDACTED_EMAIL]. Return only the sanitized text, and nothing else. If no PII is found, return the original text. Text: "${query}"`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
    });
    if (!response.text) {
        // Fallback to original query if sanitization fails
        return query;
    }
    return response.text;
};
exports.sanitizeText = sanitizeText;
const getAgentPrompt = (role, query) => {
    switch (role) {
        case types_1.AgentRole.Model1:
            return `You are an AI assistant tasked with providing a direct, factual, and concise answer to the user's query. Get straight to the point. User query: "${query}"`;
        case types_1.AgentRole.Model2:
            return `You are an AI assistant tasked with providing a detailed and explanatory answer. Break down complex topics into easy-to-understand parts and provide context. User query: "${query}"`;
        case types_1.AgentRole.Model3:
            return `You are an AI assistant tasked with providing a creative and alternative perspective. Think outside the box and offer unique insights or analogies related to the user's query. User query: "${query}"`;
        default:
            throw new Error("Unknown agent role for analysis");
    }
};
const analyzeWithAgent = async (role, query, useThinkingMode) => {
    const { model, config } = getModelConfig(useThinkingMode);
    const prompt = getAgentPrompt(role, query);
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
    });
    if (!response.text) {
        throw new Error(`Agent ${role} returned an empty response.`);
    }
    return response.text;
};
exports.analyzeWithAgent = analyzeWithAgent;
const synthesizeConsensus = async (query, analyses, useThinkingMode) => {
    const { model, config } = getModelConfig(useThinkingMode);
    const model1Response = analyses.find(a => a.role === types_1.AgentRole.Model1)?.analysis || "N/A";
    const model2Response = analyses.find(a => a.role === types_1.AgentRole.Model2)?.analysis || "N/A";
    const model3Response = analyses.find(a => a.role === types_1.AgentRole.Model3)?.analysis || "N/A";
    const prompt = `You are The Chairperson, a master AI synthesizer. Your task is to analyze an original query and three different AI model responses to it. Your goal is to create a single, superior, and comprehensive answer.

---
ORIGINAL USER QUERY:
"${query}"
---
MODEL RESPONSES:
- Response from Model 1 (Direct & Factual): ${model1Response}
- Response from Model 2 (Detailed & Explanatory): ${model2Response}
- Response from Model 3 (Creative & Alternative): ${model3Response}
---
INSTRUCTIONS:
Synthesize the provided responses into a single, cohesive, and comprehensive final answer. Identify the strongest points from each model, resolve any contradictions, and present the information in a well-structured and easy-to-read format. Return a single, valid JSON object that adheres to the provided schema. Do not add any text, markdown formatting, or comments before or after the JSON object.`;
    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            ...config,
            responseMimeType: 'application/json',
            responseSchema: {
                type: genai_1.Type.OBJECT,
                properties: {
                    comprehensiveAnswer: {
                        type: genai_1.Type.STRING,
                        description: 'The final, synthesized answer.'
                    },
                },
                required: ['comprehensiveAnswer'],
            }
        },
    });
    if (!response.text) {
        throw new Error("Chairperson returned an empty response.");
    }
    // FIX: Removed regex to strip markdown fences. The prompt instructs the model to return raw JSON,
    // making this client-side cleaning unnecessary and inconsistent with the prompt's constraints.
    const cleanedText = response.text.trim();
    return cleanedText;
};
exports.synthesizeConsensus = synthesizeConsensus;
//# sourceMappingURL=geminiService.js.map