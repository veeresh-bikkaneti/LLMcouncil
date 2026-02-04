import * as vscode from 'vscode';
import { AgentRole } from '../types/agents';
import { CONFIG, AGENT_PROMPTS } from '../constants';

export class LanguageModelClient {
    private cancellationTokenSource?: vscode.CancellationTokenSource;

    async selectModel(): Promise<vscode.LanguageModelChat | null> {
        // Try multiple strategies: Copilot → Any GPT-4 → Any model
        const strategies = [
            () => vscode.lm.selectChatModels({ vendor: CONFIG.PREFERRED_VENDOR, family: CONFIG.PREFERRED_FAMILY }),
            () => vscode.lm.selectChatModels({ family: CONFIG.PREFERRED_FAMILY }),
            () => vscode.lm.selectChatModels()
        ];

        try {
            for (const strategy of strategies) {
                const models = await strategy();
                if (models.length > 0) return models[0];
            }

            this.showError(CONFIG.NO_MODELS_ERROR);
            return null;
        } catch (error) {
            this.showError('Failed to select language model', error);
            return null;
        }
    }

    async analyzeWithAgent(
        agent: AgentRole,
        query: string,
        onProgress?: (chunk: string) => void
    ): Promise<string> {
        const model = await this.selectModel();
        if (!model) {
            throw new Error(CONFIG.NO_MODELS_ERROR);
        }

        const systemPrompt = this.getAgentPrompt(agent);
        const messages = [
            vscode.LanguageModelChatMessage.User(`${systemPrompt}\n\nQuery: ${query}`)
        ];

        this.cancellationTokenSource = new vscode.CancellationTokenSource();

        try {
            const response = await model.sendRequest(
                messages,
                {},
                this.cancellationTokenSource.token
            );

            let result = '';
            for await (const chunk of response.text) {
                result += chunk;
                if (onProgress) {
                    onProgress(chunk);
                }
            }

            return result;
        } catch (error) {
            if (error instanceof vscode.CancellationError) {
                throw new Error(CONFIG.ANALYSIS_CANCELLED);
            }
            throw error;
        }
    }

    cancel(): void {
        this.cancellationTokenSource?.cancel();
    }

    private getAgentPrompt(agent: AgentRole): string {
        const prompts: Record<AgentRole, string> = {
            [AgentRole.Vision]: AGENT_PROMPTS.VISION,
            [AgentRole.Technical]: AGENT_PROMPTS.TECHNICAL,
            [AgentRole.Empathy]: AGENT_PROMPTS.EMPATHY,
            [AgentRole.Chairperson]: AGENT_PROMPTS.CHAIRPERSON
        };

        return prompts[agent];
    }

    private formatError(error: unknown): string {
        return error instanceof Error ? error.message : 'Unknown error';
    }

    private showError(context: string, error?: unknown): void {
        const message = error ? `${context}: ${this.formatError(error)}` : context;
        console.error(message, error);
        vscode.window.showErrorMessage(message);
    }
}
