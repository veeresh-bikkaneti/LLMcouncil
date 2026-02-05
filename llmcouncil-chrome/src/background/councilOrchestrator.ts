import type { AgentAnalysis, Analysis } from '../types/agents';
import { AGENTS } from '../types/agents';
import { LLMClient } from './llmClient';

export class CouncilOrchestrator {
    private llmClient: LLMClient;

    constructor(llmClient: LLMClient) {
        this.llmClient = llmClient;
    }

    async runCouncil(
        text: string,
        onProgress?: (agentId: string, status: string) => void
    ): Promise<Analysis> {
        const analysisId = `analysis-${Date.now()}`;
        const timestamp = Date.now();

        // Initialize agent outputs
        const agentOutputs: AgentAnalysis[] = AGENTS.map(agent => ({
            agent,
            status: 'idle' as const,
            response: '',
        }));

        // Run agents in parallel
        const analysisPromises = AGENTS.map(async (agent, index) => {
            try {
                agentOutputs[index].status = 'thinking';
                onProgress?.(agent.id, 'thinking');

                const response = await this.llmClient.analyzeWithAgent(
                    agent.id,
                    text,
                    (status) => onProgress?.(agent.id, status.toLowerCase())
                );

                agentOutputs[index].response = response;
                agentOutputs[index].status = 'done';
                onProgress?.(agent.id, 'done');

                return response;
            } catch (error) {
                agentOutputs[index].status = 'error';
                agentOutputs[index].error = error instanceof Error ? error.message : 'Unknown error';
                onProgress?.(agent.id, 'error');
                throw error;
            }
        });

        try {
            // Wait for all agents
            const responses = await Promise.all(analysisPromises);

            // Synthesize consensus
            const consensus = await this.llmClient.synthesizeConsensus(responses);

            // Calculate consensus rate (simplified - count successful agents)
            const successfulAgents = agentOutputs.filter(a => a.status === 'done').length;
            const consensusRate = (successfulAgents / AGENTS.length) * 100;

            return {
                id: analysisId,
                timestamp,
                query: text,
                agentOutputs,
                consensus,
                consensusRate,
                url: '', // Will be set by caller with current page URL
            };
        } catch (error) {
            // Even if some agents fail, return partial results
            const consensus = 'Some agents failed. Partial analysis available.';
            const successfulAgents = agentOutputs.filter(a => a.status === 'done').length;
            const consensusRate = (successfulAgents / AGENTS.length) * 100;

            return {
                id: analysisId,
                timestamp,
                query: text,
                agentOutputs,
                consensus,
                consensusRate,
                url: '',
            };
        }
    }

    exportToMarkdown(analysis: Analysis): string {
        const date = new Date(analysis.timestamp).toLocaleString();

        let markdown = `# LLM Council Analysis\n\n`;
        markdown += `**Date:** ${date}\n`;
        markdown += `**Source:** ${analysis.url || 'Unknown'}\n`;
        markdown += `**Consensus Rate:** ${analysis.consensusRate.toFixed(0)}%\n\n`;
        markdown += `## Query\n\n${analysis.query}\n\n`;
        markdown += `---\n\n`;

        // Agent analyses
        analysis.agentOutputs.forEach(output => {
            markdown += `## ${output.agent.emoji} ${output.agent.name}\n\n`;

            if (output.status === 'done') {
                markdown += `${output.response}\n\n`;
            } else if (output.status === 'error') {
                markdown += `❌ Error: ${output.error}\n\n`;
            } else {
                markdown += `⏳ ${output.status}\n\n`;
            }

            markdown += `---\n\n`;
        });

        // Consensus
        markdown += `## 🎯 Chairperson Verdict\n\n`;
        markdown += `${analysis.consensus}\n\n`;

        return markdown;
    }
}
