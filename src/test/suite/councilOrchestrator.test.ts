import * as assert from 'assert';
import * as sinon from 'sinon';
import { CouncilOrchestrator } from '../../services/councilOrchestrator';
import { LanguageModelClient } from '../../services/languageModelClient';
import { AgentRole, AgentAnalysis } from '../../types/agents';
import { CONFIG } from '../../constants';
import { MOCK_VISION_RESPONSE, MOCK_TECHNICAL_RESPONSE, MOCK_EMPATHY_RESPONSE } from '../fixtures/mockResponses';

suite('CouncilOrchestrator Unit Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockLmClient: sinon.SinonStubbedInstance<LanguageModelClient>;
    let orchestrator: CouncilOrchestrator;

    setup(() => {
        sandbox = sinon.createSandbox();
        mockLmClient = sandbox.createStubInstance(LanguageModelClient);
        orchestrator = new CouncilOrchestrator(mockLmClient as any);
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('runCouncil', () => {
        test('should return complete report when all agents succeed', async () => {
            // Arrange
            mockLmClient.analyzeWithAgent
                .withArgs(AgentRole.Vision, sinon.match.any).resolves(MOCK_VISION_RESPONSE)
                .withArgs(AgentRole.Technical, sinon.match.any).resolves(MOCK_TECHNICAL_RESPONSE)
                .withArgs(AgentRole.Empathy, sinon.match.any).resolves(MOCK_EMPATHY_RESPONSE)
                .withArgs(AgentRole.Chairperson, sinon.match.any).resolves('Final consensus');

            // Act
            const result = await orchestrator.runCouncil('test query');

            // Assert
            assert.strictEqual(result.agentOutputs.length, 3);
            assert.strictEqual(result.agentOutputs.filter(a => a.status === 'done').length, 3);
            assert.ok(result.comprehensiveAnswer);
            assert.ok(result.processingTime);
            assert.ok(typeof result.consensusRate === 'number');
        });

        test('should continue when one agent fails', async () => {
            // Arrange
            mockLmClient.analyzeWithAgent
                .withArgs(AgentRole.Vision, sinon.match.any).resolves(MOCK_VISION_RESPONSE)
                .withArgs(AgentRole.Technical, sinon.match.any).rejects(new Error('API timeout'))
                .withArgs(AgentRole.Empathy, sinon.match.any).resolves(MOCK_EMPATHY_RESPONSE)
                .withArgs(AgentRole.Chairperson, sinon.match.any).resolves('Final consensus');

            // Act
            const result = await orchestrator.runCouncil('test query');

            // Assert
            const doneAgents = result.agentOutputs.filter(a => a.status === 'done');
            const errorAgents = result.agentOutputs.filter(a => a.status === 'error');

            assert.strictEqual(doneAgents.length, 2);
            assert.strictEqual(errorAgents.length, 1);
            assert.ok(result.comprehensiveAnswer);
        });

        test('should throw error when all agents fail', async () => {
            // Arrange
            mockLmClient.analyzeWithAgent.rejects(new Error('Complete failure'));

            // Act & Assert
            await assert.rejects(
                () => orchestrator.runCouncil('test query'),
                { message: CONFIG.ALL_AGENTS_FAILED }
            );
        });

        test('should call progress callback for each agent', async () => {
            // Arrange
            mockLmClient.analyzeWithAgent.resolves('Test response');
            const progressSpy = sandbox.spy();

            // Act
            await orchestrator.runCouncil('test query', progressSpy);

            // Assert
            // Should be called for: Vision thinking, Vision done, Technical thinking, Technical done, 
            // Empathy thinking, Empathy done, Chairperson thinking, Chairperson done = 8 times
            assert.ok(progressSpy.callCount >= 8);

            // Verify thinking status called for each agent
            assert.ok(progressSpy.calledWith(AgentRole.Vision, 'thinking'));
            assert.ok(progressSpy.calledWith(AgentRole.Technical, 'thinking'));
            assert.ok(progressSpy.calledWith(AgentRole.Empathy, 'thinking'));
            assert.ok(progressSpy.calledWith(AgentRole.Chairperson, 'thinking'));
        });

        test('should measure processing time accurately', async () => {
            // Arrange
            mockLmClient.analyzeWithAgent.resolves('Test response');
            const startTime = Date.now();

            // Act
            const result = await orchestrator.runCouncil('test query');

            // Assert
            const endTime = Date.now();
            const expectedTime = endTime - startTime;

            assert.ok(result.processingTime);
            assert.ok(result.processingTime <= expectedTime + 100); // 100ms tolerance
        });
    });

    suite('calculateConsensusRate', () => {
        test('should return 1.0 for single analysis', () => {
            // Arrange
            const analyses = [
                { role: AgentRole.Vision, analysis: 'test', prompt: 'q', status: 'done' as const }
            ];

            // Act
            const rate = (orchestrator as any).calculateConsensusRate(analyses);

            // Assert
            assert.strictEqual(rate, 1.0);
        });

        test('should return high consensus for similar length responses', () => {
            // Arrange
            const analyses = [
                { role: AgentRole.Vision, analysis: 'a'.repeat(100), prompt: 'q', status: 'done' as const },
                { role: AgentRole.Technical, analysis: 'b'.repeat(105), prompt: 'q', status: 'done' as const },
                { role: AgentRole.Empathy, analysis: 'c'.repeat(98), prompt: 'q', status: 'done' as const }
            ];

            // Act
            const rate = (orchestrator as any).calculateConsensusRate(analyses);

            // Assert
            assert.ok(rate > 0.8, `Consensus rate ${rate} should be > 0.8`);
        });

        test('should return lower consensus for different length responses', () => {
            // Arrange
            const analyses = [
                { role: AgentRole.Vision, analysis: 'a'.repeat(50), prompt: 'q', status: 'done' as const },
                { role: AgentRole.Technical, analysis: 'b'.repeat(500), prompt: 'q', status: 'done' as const },
                { role: AgentRole.Empathy, analysis: 'c'.repeat(100), prompt: 'q', status: 'done' as const }
            ];

            // Act
            const rate = (orchestrator as any).calculateConsensusRate(analyses);

            // Assert
            assert.ok(rate < 0.8, `Consensus rate ${rate} should be < 0.8`);
        });
    });

    suite('cancel', () => {
        test('should cancel language model client', () => {
            // Act
            orchestrator.cancel();

            // Assert
            assert.ok(mockLmClient.cancel.calledOnce);
        });
    });
});
