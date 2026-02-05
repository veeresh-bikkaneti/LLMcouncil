"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClient = void 0;
const constants_1 = require("./constants");
class LLMClient {
    constructor(config) {
        this.apiConfig = null;
        this.apiConfig = config;
    }
    async analyzeWithAgent(agentType, text, onProgress) {
        if (!this.apiConfig) {
            throw new Error('API configuration not set');
        }
        onProgress?.('Thinking...');
        const prompt = constants_1.AGENT_PROMPTS[agentType](text);
        try {
            const response = await this.callLLMAPI(prompt);
            onProgress?.('Complete');
            return response;
        }
        catch (error) {
            onProgress?.('Error');
            throw error;
        }
    }
    async synthesizeConsensus(analyses) {
        if (!this.apiConfig) {
            throw new Error('API configuration not set');
        }
        const prompt = constants_1.AGENT_PROMPTS.chairperson(analyses);
        return await this.callLLMAPI(prompt);
    }
    async callLLMAPI(prompt) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), constants_1.CONFIG.AGENT_TIMEOUT);
        try {
            if (this.apiConfig.provider === 'openai') {
                return await this.callOpenAI(prompt, controller.signal);
            }
            else if (this.apiConfig.provider === 'anthropic') {
                return await this.callAnthropic(prompt, controller.signal);
            }
            else {
                throw new Error(`Unsupported provider: ${this.apiConfig.provider}`);
            }
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    async callOpenAI(prompt, signal) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiConfig.apiKey}`,
            },
            body: JSON.stringify({
                model: this.apiConfig.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
            }),
            signal,
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
        }
        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    }
    async callAnthropic(prompt, signal) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiConfig.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this.apiConfig.model,
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }],
            }),
            signal,
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
        }
        const data = await response.json();
        return data.content[0]?.text || '';
    }
    updateConfig(config) {
        this.apiConfig = config;
    }
}
exports.LLMClient = LLMClient;
//# sourceMappingURL=llmClient.js.map