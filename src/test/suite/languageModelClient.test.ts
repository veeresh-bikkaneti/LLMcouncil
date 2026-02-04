import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { LanguageModelClient } from '../../services/languageModelClient';
import { AgentRole } from '../../types/agents';
import { CONFIG } from '../../constants';

suite('LanguageModelClient Unit Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let client: LanguageModelClient;

    setup(() => {
        sandbox = sinon.createSandbox();
        client = new LanguageModelClient();
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('selectModel', () => {
        test('should return Copilot model when available', async () => {
            // Arrange
            const mockModel = { id: 'copilot-gpt-4', vendor: 'copilot' };
            const selectStub = sandbox.stub(vscode.lm, 'selectChatModels').resolves([mockModel] as any);

            // Act
            const result = await client.selectModel();

            // Assert
            assert.strictEqual(result, mockModel);
            assert.ok(selectStub.calledWith({ vendor: CONFIG.PREFERRED_VENDOR, family: CONFIG.PREFERRED_FAMILY }));
        });

        test('should fallback to GPT-4 when Copilot unavailable', async () => {
            // Arrange
            const mockModel = { id: 'gpt-4', family: 'gpt-4' };
            const selectStub = sandbox.stub(vscode.lm, 'selectChatModels');
            selectStub.onFirstCall().resolves([]);
            selectStub.onSecondCall().resolves([mockModel] as any);

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
            selectStub.onThirdCall().resolves([mockModel] as any);

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
            assert.ok(errorStub.calledWith(CONFIG.NO_MODELS_ERROR));
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
            sandbox.stub(vscode.lm, 'selectChatModels').resolves([mockModel] as any);

            // Act
            const result = await client.analyzeWithAgent(AgentRole.Vision, 'test query');

            // Assert
            assert.strictEqual(result, mockResponse);
        });

        test('should throw error when no model available', async () => {
            // Arrange
            sandbox.stub(vscode.lm, 'selectChatModels').resolves([]);
            sandbox.stub(vscode.window, 'showErrorMessage');

            // Act & Assert
            await assert.rejects(
                () => client.analyzeWithAgent(AgentRole.Vision, 'test query'),
                { message: CONFIG.NO_MODELS_ERROR }
            );
        });

        test('should handle cancellation correctly', async () => {
            // Arrange
            const mockModel = {
                sendRequest: sandbox.stub().rejects(new vscode.CancellationError())
            };
            sandbox.stub(vscode.lm, 'selectChatModels').resolves([mockModel] as any);

            // Act & Assert
            await assert.rejects(
                () => client.analyzeWithAgent(AgentRole.Vision, 'test query'),
                { message: CONFIG.ANALYSIS_CANCELLED }
            );
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
            sandbox.stub(vscode.lm, 'selectChatModels').resolves([mockModel] as any);
            const progressSpy = sandbox.spy();

            // Act
            await client.analyzeWithAgent(AgentRole.Vision, 'test query', progressSpy);

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
            (client as any).cancellationTokenSource = cancelTokenStub;

            // Act
            client.cancel();

            // Assert
            assert.ok(cancelTokenStub.cancel.calledOnce);
        });
    });
});
