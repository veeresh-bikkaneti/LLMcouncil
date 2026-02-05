"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageModelClient = void 0;
const vscode = __importStar(require("vscode"));
const agents_1 = require("../types/agents");
const constants_1 = require("../constants");
class LanguageModelClient {
    async selectModel() {
        // Try multiple strategies: Copilot → Any GPT-4 → Any model
        const strategies = [
            () => vscode.lm.selectChatModels({ vendor: constants_1.CONFIG.PREFERRED_VENDOR, family: constants_1.CONFIG.PREFERRED_FAMILY }),
            () => vscode.lm.selectChatModels({ family: constants_1.CONFIG.PREFERRED_FAMILY }),
            () => vscode.lm.selectChatModels()
        ];
        try {
            for (const strategy of strategies) {
                const models = await strategy();
                if (models.length > 0)
                    return models[0];
            }
            this.showError(constants_1.CONFIG.NO_MODELS_ERROR);
            return null;
        }
        catch (error) {
            this.showError('Failed to select language model', error);
            return null;
        }
    }
    async analyzeWithAgent(agent, query, onProgress) {
        const model = await this.selectModel();
        if (!model) {
            throw new Error(constants_1.CONFIG.NO_MODELS_ERROR);
        }
        const systemPrompt = this.getAgentPrompt(agent);
        const messages = [
            vscode.LanguageModelChatMessage.User(`${systemPrompt}\n\nQuery: ${query}`)
        ];
        this.cancellationTokenSource = new vscode.CancellationTokenSource();
        try {
            const response = await model.sendRequest(messages, {}, this.cancellationTokenSource.token);
            let result = '';
            for await (const chunk of response.text) {
                result += chunk;
                if (onProgress) {
                    onProgress(chunk);
                }
            }
            return result;
        }
        catch (error) {
            if (error instanceof vscode.CancellationError) {
                throw new Error(constants_1.CONFIG.ANALYSIS_CANCELLED);
            }
            throw error;
        }
    }
    cancel() {
        this.cancellationTokenSource?.cancel();
    }
    getAgentPrompt(agent) {
        const prompts = {
            [agents_1.AgentRole.Vision]: constants_1.AGENT_PROMPTS.VISION,
            [agents_1.AgentRole.Technical]: constants_1.AGENT_PROMPTS.TECHNICAL,
            [agents_1.AgentRole.Empathy]: constants_1.AGENT_PROMPTS.EMPATHY,
            [agents_1.AgentRole.Chairperson]: constants_1.AGENT_PROMPTS.CHAIRPERSON
        };
        return prompts[agent];
    }
    formatError(error) {
        return error instanceof Error ? error.message : 'Unknown error';
    }
    showError(context, error) {
        const message = error ? `${context}: ${this.formatError(error)}` : context;
        console.error(message, error);
        vscode.window.showErrorMessage(message);
    }
}
exports.LanguageModelClient = LanguageModelClient;
//# sourceMappingURL=languageModelClient.js.map