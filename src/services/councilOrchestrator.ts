import * as vscode from 'vscode';
import { LanguageModelClient } from './languageModelClient';
import { AgentRole, AgentAnalysis, ConsensusReport } from '../types/agents';
import { CONFIG } from '../constants';

export class CouncilOrchestrator {
    constructor(private lmClient: LanguageModelClient) { }

    async runCouncil(
        query: string,
        onProgress?: (agent: AgentRole, status: string) => void
    ): Promise<ConsensusReport> {
        const startTime = Date.now();
        const agents: AgentRole[] = [AgentRole.Vision, AgentRole.Technical, AgentRole.Empathy];

        // Execute agents in parallel
        const analyses = await Promise.all(
            agents.map(async (agent) => {
                if (onProgress) {
                    onProgress(agent, 'thinking');
                }

                try {
                    const analysis = await this.lmClient.analyzeWithAgent(agent, query);

                    if (onProgress) {
                        onProgress(agent, 'done');
                    }

                    return {
                        role: agent,
                        prompt: query,
                        analysis,
                        status: 'done' as const,
                        modelName: 'copilot-gpt-4'
                    };
                } catch (error) {
                    if (onProgress) {
                        onProgress(agent, 'error');
                    }

                    return {
                        role: agent,
                        prompt: query,
                        analysis: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        status: 'error' as const
                    };
                }
            })
        );

        const successfulAnalyses = analyses.filter(a => a.status === 'done');

        if (successfulAnalyses.length === 0) {
            throw new Error(CONFIG.ALL_AGENTS_FAILED);
        }

        // Synthesize consensus
        if (onProgress) {
            onProgress(AgentRole.Chairperson, 'thinking');
        }

        const consensus = await this.synthesizeConsensus(query, successfulAnalyses);

        if (onProgress) {
            onProgress(AgentRole.Chairperson, 'done');
        }

        const processingTime = Date.now() - startTime;

        return {
            comprehensiveAnswer: consensus,
            agentOutputs: analyses,
            consensusRate: this.calculateConsensusRate(successfulAnalyses),
            processingTime
        };
    }

    private async synthesizeConsensus(
        query: string,
        analyses: AgentAnalysis[]
    ): Promise<string> {
        const agentSummaries = analyses
            .map(a => `**${a.role}:**\n${a.analysis}`)
            .join('\n\n---\n\n');

        const synthesisPrompt = `As the Chairperson, review these agent analyses and synthesize a comprehensive verdict:

Original Query: "${query}"

${agentSummaries}

Provide a comprehensive answer that:
1. Resolves any conflicts between agents
2. Assigns priority level (1-10)
3. Identifies root cause
4. Recommends specific actions
5. Calculates consensus rate`;

        return await this.lmClient.analyzeWithAgent(AgentRole.Chairperson, synthesisPrompt);
    }

    private calculateConsensusRate(analyses: AgentAnalysis[]): number {
        if (analyses.length < 2) return 1.0;

        // Heuristic: Lower variance in response lengths suggests agreement
        // TODO: Replace with semantic similarity (e.g., cosine similarity of embeddings)
        const lengths = analyses.map(a => a.analysis.length);
        const avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
        const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
        const stdDev = Math.sqrt(variance);

        const consensusRate = Math.max(0, 1 - (stdDev / avgLength));
        return Math.min(1.0, consensusRate);
    }

    cancel(): void {
        this.lmClient.cancel();
    }
}
