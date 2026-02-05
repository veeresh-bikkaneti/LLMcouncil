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
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const councilOrchestrator_1 = require("../../services/councilOrchestrator");
const languageModelClient_1 = require("../../services/languageModelClient");
const agents_1 = require("../../types/agents");
const constants_1 = require("../../constants");
const mockResponses_1 = require("../fixtures/mockResponses");
suite('CouncilOrchestrator Unit Tests', () => {
    let sandbox;
    let mockLmClient;
    let orchestrator;
    setup(() => {
        sandbox = sinon.createSandbox();
        mockLmClient = sandbox.createStubInstance(languageModelClient_1.LanguageModelClient);
        orchestrator = new councilOrchestrator_1.CouncilOrchestrator(mockLmClient);
    });
    teardown(() => {
        sandbox.restore();
    });
    suite('runCouncil', () => {
        test('should return complete report when all agents succeed', async () => {
            // Arrange
            mockLmClient.analyzeWithAgent
                .withArgs(agents_1.AgentRole.Vision, sinon.match.any).resolves(mockResponses_1.MOCK_VISION_RESPONSE)
                .withArgs(agents_1.AgentRole.Technical, sinon.match.any).resolves(mockResponses_1.MOCK_TECHNICAL_RESPONSE)
                .withArgs(agents_1.AgentRole.Empathy, sinon.match.any).resolves(mockResponses_1.MOCK_EMPATHY_RESPONSE)
                .withArgs(agents_1.AgentRole.Chairperson, sinon.match.any).resolves('Final consensus');
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
                .withArgs(agents_1.AgentRole.Vision, sinon.match.any).resolves(mockResponses_1.MOCK_VISION_RESPONSE)
                .withArgs(agents_1.AgentRole.Technical, sinon.match.any).rejects(new Error('API timeout'))
                .withArgs(agents_1.AgentRole.Empathy, sinon.match.any).resolves(mockResponses_1.MOCK_EMPATHY_RESPONSE)
                .withArgs(agents_1.AgentRole.Chairperson, sinon.match.any).resolves('Final consensus');
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
            await assert.rejects(() => orchestrator.runCouncil('test query'), { message: constants_1.CONFIG.ALL_AGENTS_FAILED });
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
            assert.ok(progressSpy.calledWith(agents_1.AgentRole.Vision, 'thinking'));
            assert.ok(progressSpy.calledWith(agents_1.AgentRole.Technical, 'thinking'));
            assert.ok(progressSpy.calledWith(agents_1.AgentRole.Empathy, 'thinking'));
            assert.ok(progressSpy.calledWith(agents_1.AgentRole.Chairperson, 'thinking'));
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
                { role: agents_1.AgentRole.Vision, analysis: 'test', prompt: 'q', status: 'done' }
            ];
            // Act
            const rate = orchestrator.calculateConsensusRate(analyses);
            // Assert
            assert.strictEqual(rate, 1.0);
        });
        test('should return high consensus for similar length responses', () => {
            // Arrange
            const analyses = [
                { role: agents_1.AgentRole.Vision, analysis: 'a'.repeat(100), prompt: 'q', status: 'done' },
                { role: agents_1.AgentRole.Technical, analysis: 'b'.repeat(105), prompt: 'q', status: 'done' },
                { role: agents_1.AgentRole.Empathy, analysis: 'c'.repeat(98), prompt: 'q', status: 'done' }
            ];
            // Act
            const rate = orchestrator.calculateConsensusRate(analyses);
            // Assert
            assert.ok(rate > 0.8, `Consensus rate ${rate} should be > 0.8`);
        });
        test('should return lower consensus for different length responses', () => {
            // Arrange
            const analyses = [
                { role: agents_1.AgentRole.Vision, analysis: 'a'.repeat(50), prompt: 'q', status: 'done' },
                { role: agents_1.AgentRole.Technical, analysis: 'b'.repeat(500), prompt: 'q', status: 'done' },
                { role: agents_1.AgentRole.Empathy, analysis: 'c'.repeat(100), prompt: 'q', status: 'done' }
            ];
            // Act
            const rate = orchestrator.calculateConsensusRate(analyses);
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
//# sourceMappingURL=councilOrchestrator.test.js.map