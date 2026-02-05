import * as vscode from 'vscode';
import { CouncilOrchestrator } from '../services/councilOrchestrator';
import { CouncilPanel } from '../webview/CouncilPanel';

const MESSAGES = {
    NO_ACTIVE_EDITOR: 'No active editor',
    NO_TEXT_SELECTED: 'No text selected. Please select text to analyze.',
    ANALYSIS_CANCELLED: 'Council analysis cancelled',
    TITLE: 'LLM Council',
    INITIALIZING: 'Initializing council...'
} as const;

export function registerAnalyzeSelection(
    context: vscode.ExtensionContext,
    orchestrator: CouncilOrchestrator
): void {
    const command = vscode.commands.registerCommand(
        'llmcouncil.analyzeSelection',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage(MESSAGES.NO_ACTIVE_EDITOR);
                return;
            }

            const selection = editor.document.getText(editor.selection);
            if (!selection.trim()) {
                vscode.window.showWarningMessage(MESSAGES.NO_TEXT_SELECTED);
                return;
            }

            const panel = CouncilPanel.createOrShow(context);

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: MESSAGES.TITLE,
                    cancellable: true
                },
                async (progress, token) => {
                    progress.report({ message: MESSAGES.INITIALIZING });

                    token.onCancellationRequested(() => {
                        orchestrator.cancel();
                        vscode.window.showInformationMessage(MESSAGES.ANALYSIS_CANCELLED);
                    });

                    try {
                        const result = await orchestrator.runCouncil(
                            selection,
                            (agent, status) => {
                                progress.report({ message: `${agent}: ${status}` });
                                panel.updateAgentStatus(agent, status);
                            }
                        );

                        panel.updateResults(result);
                        progress.report({ message: 'Analysis complete!' });

                        const processingTimeSeconds = (result.processingTime! / 1000).toFixed(1);
                        vscode.window.showInformationMessage(
                            `Council analysis complete! Processed in ${processingTimeSeconds}s`
                        );
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        vscode.window.showErrorMessage(`Council analysis failed: ${errorMessage}`);
                        panel.showError(errorMessage);
                    }
                }
            );
        }
    );

    context.subscriptions.push(command);
}
