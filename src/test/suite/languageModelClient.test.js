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
const vscode = __importStar(require("vscode"));
const languageModelClient_1 = require("../../services/languageModelClient");
const agents_1 = require("../../types/agents");
const constants_1 = require("../../constants");
suite('LanguageModelClient Unit Tests', () => {
    let sandbox;
    let client;
    setup(() => {
        sandbox = sinon.createSandbox();
        client = new languageModelClient_1.LanguageModelClient();
    });
    teardown(() => {
        sandbox.restore();
    });
    suite('selectModel', () => {
        test('should return Copilot model when available', async () => {
            // Arrange
            const mockModel = { id: 'copilot-gpt-4', vendor: 'copilot' };
            const selectStub = sandbox.stub(vscode.lm, 'selectChatModels').resolves([mockModel]);
            // Act
            const result = await client.selectModel();
            // Assert
            assert.strictEqual(result, mockModel);
            assert.ok(selectStub.calledWith({ vendor: constants_1.CONFIG.PREFERRED_VENDOR, family: constants_1.CONFIG.PREFERRED_FAMILY }));
        });
        test('should fallback to GPT-4 when Copilot unavailable', async () => {
            // Arrange
            const mockModel = { id: 'gpt-4', family: 'gpt-4' };
            const selectStub = sandbox.stub(vscode.lm, 'selectChatModels');
            selectStub.onFirstCall().resolves([]);
            selectStub.onSecondCall().resolves([mockModel]);
            // Act
            const result = await client.selectModel();
            // Assert
            assert.strictEqual(result, mockModel);
            assert.strictEqual(selectStub.callCount, 2);
        });
        test('should fallback to any model when GPT-4 unavailable', async () => {
            // Arrange
            const mockModel = { id: 'claude-3', family: 'claude' };
            const selectStub = sandbox.stub(vscode.lm, 'selectChatModels');
            selectStub.onFirstCall().resolves([]);
            selectStub.onSecondCall().resolves([]);
            selectStub.onThirdCall().resolves([mockModel]);
            // Act
            const result = await client.selectModel();
            // Assert
            assert.strictEqual(result, mockModel);
            assert.strictEqual(selectStub.callCount, 3);
        });
        test('should return null and show error when no models available', async () => {
            // Arrange
            const selectStub = sandbox.stub(vscode.lm, 'selectChatModels').resolves([]);
            const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            // Act
            const result = await client.selectModel();
            // Assert
            assert.strictEqual(result, null);
            assert.ok(errorStub.calledWith(constants_1.CONFIG.NO_MODELS_ERROR));
        });
        test('should handle API errors gracefully', async () => {
            // Arrange
            const error = new Error('API connection failed');
            sandbox.stub(vscode.lm, 'selectChatModels').rejects(error);
            const errorStub = sandbox.stub(vscode.window, 'showErrorMessage');
            // Act
            const result = await client.selectModel();
            // Assert
            assert.strictEqual(result, null);
            assert.ok(errorStub.calledOnce);
        });
    });
    suite('analyzeWithAgent', () => {
        test('should return agent response on success', async () => {
            // Arrange
            const mockResponse = 'Test analysis complete';
            const mockModel = {
                sendRequest: sandbox.stub().resolves({
                    text: (async function* () {
                        yield mockResponse;
                    })()
                })
            };
            sandbox.stub(vscode.lm, 'selectChatModels').resolves([mockModel]);
            // Act
            const result = await client.analyzeWithAgent(agents_1.AgentRole.Vision, 'test query');
            // Assert
            assert.strictEqual(result, mockResponse);
        });
        test('should throw error when no model available', async () => {
            // Arrange
            sandbox.stub(vscode.lm, 'selectChatModels').resolves([]);
            sandbox.stub(vscode.window, 'showErrorMessage');
            // Act & Assert
            await assert.rejects(() => client.analyzeWithAgent(agents_1.AgentRole.Vision, 'test query'), { message: constants_1.CONFIG.NO_MODELS_ERROR });
        });
        test('should handle cancellation correctly', async () => {
            // Arrange
            const mockModel = {
                sendRequest: sandbox.stub().rejects(new vscode.CancellationError())
            };
            sandbox.stub(vscode.lm, 'selectChatModels').resolves([mockModel]);
            // Act & Assert
            await assert.rejects(() => client.analyzeWithAgent(agents_1.AgentRole.Vision, 'test query'), { message: constants_1.CONFIG.ANALYSIS_CANCELLED });
        });
        test('should call progress callback with chunks', async () => {
            // Arrange
            const chunks = ['chunk1', 'chunk2', 'chunk3'];
            const mockModel = {
                sendRequest: sandbox.stub().resolves({
                    text: (async function* () {
                        for (const chunk of chunks) {
                            yield chunk;
                        }
                    })()
                })
            };
            sandbox.stub(vscode.lm, 'selectChatModels').resolves([mockModel]);
            const progressSpy = sandbox.spy();
            // Act
            await client.analyzeWithAgent(agents_1.AgentRole.Vision, 'test query', progressSpy);
            // Assert
            assert.strictEqual(progressSpy.callCount, chunks.length);
            chunks.forEach((chunk, i) => {
                assert.ok(progressSpy.getCall(i).calledWith(chunk));
            });
        });
    });
    suite('cancel', () => {
        test('should cancel ongoing analysis', () => {
            // Arrange
            const cancelTokenStub = { cancel: sandbox.stub() };
            client.cancellationTokenSource = cancelTokenStub;
            // Act
            client.cancel();
            // Assert
            assert.ok(cancelTokenStub.cancel.calledOnce);
        });
    });
});
//# sourceMappingURL=languageModelClient.test.js.map