"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouncilOrchestrator = void 0;
const agents_1 = require("../types/agents");
const constants_1 = require("../constants");
class CouncilOrchestrator {
    constructor(lmClient) {
        this.lmClient = lmClient;
    }
    async runCouncil(query, onProgress) {
        const startTime = Date.now();
        const agents = [agents_1.AgentRole.Vision, agents_1.AgentRole.Technical, agents_1.AgentRole.Empathy];
        // Execute agents in parallel
        const analyses = await Promise.all(agents.map(async (agent) => {
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
                    status: 'done',
                    modelName: 'copilot-gpt-4'
                };
            }
            catch (error) {
                if (onProgress) {
                    onProgress(agent, 'error');
                }
                return {
                    role: agent,
                    prompt: query,
                    analysis: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    status: 'error'
                };
            }
        }));
        const successfulAnalyses = analyses.filter(a => a.status === 'done');
        if (successfulAnalyses.length === 0) {
            throw new Error(constants_1.CONFIG.ALL_AGENTS_FAILED);
        }
        // Synthesize consensus
        if (onProgress) {
            onProgress(agents_1.AgentRole.Chairperson, 'thinking');
        }
        const consensus = await this.synthesizeConsensus(query, successfulAnalyses);
        if (onProgress) {
            onProgress(agents_1.AgentRole.Chairperson, 'done');
        }
        const processingTime = Date.now() - startTime;
        return {
            comprehensiveAnswer: consensus,
            agentOutputs: analyses,
            consensusRate: this.calculateConsensusRate(successfulAnalyses),
            processingTime
        };
    }
    async synthesizeConsensus(query, analyses) {
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
        return await this.lmClient.analyzeWithAgent(agents_1.AgentRole.Chairperson, synthesisPrompt);
    }
    calculateConsensusRate(analyses) {
        if (analyses.length < 2)
            return 1.0;
        // Heuristic: Lower variance in response lengths suggests agreement
        // TODO: Replace with semantic similarity (e.g., cosine similarity of embeddings)
        const lengths = analyses.map(a => a.analysis.length);
        const avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
        const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
        const stdDev = Math.sqrt(variance);
        const consensusRate = Math.max(0, 1 - (stdDev / avgLength));
        return Math.min(1.0, consensusRate);
    }
    cancel() {
        this.lmClient.cancel();
    }
}
exports.CouncilOrchestrator = CouncilOrchestrator;
//# sourceMappingURL=councilOrchestrator.js.map