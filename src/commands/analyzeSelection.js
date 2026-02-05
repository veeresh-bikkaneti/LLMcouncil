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
exports.registerAnalyzeSelection = registerAnalyzeSelection;
const vscode = __importStar(require("vscode"));
const CouncilPanel_1 = require("../webview/CouncilPanel");
const MESSAGES = {
    NO_ACTIVE_EDITOR: 'No active editor',
    NO_TEXT_SELECTED: 'No text selected. Please select text to analyze.',
    ANALYSIS_CANCELLED: 'Council analysis cancelled',
    TITLE: 'LLM Council',
    INITIALIZING: 'Initializing council...'
};
function registerAnalyzeSelection(context, orchestrator) {
    const command = vscode.commands.registerCommand('llmcouncil.analyzeSelection', async () => {
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
        const panel = CouncilPanel_1.CouncilPanel.createOrShow(context);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: MESSAGES.TITLE,
            cancellable: true
        }, async (progress, token) => {
            progress.report({ message: MESSAGES.INITIALIZING });
            token.onCancellationRequested(() => {
                orchestrator.cancel();
                vscode.window.showInformationMessage(MESSAGES.ANALYSIS_CANCELLED);
            });
            try {
                const result = await orchestrator.runCouncil(selection, (agent, status) => {
                    progress.report({ message: `${agent}: ${status}` });
                    panel.updateAgentStatus(agent, status);
                });
                panel.updateResults(result);
                progress.report({ message: 'Analysis complete!' });
                const processingTimeSeconds = (result.processingTime / 1000).toFixed(1);
                vscode.window.showInformationMessage(`Council analysis complete! Processed in ${processingTimeSeconds}s`);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Council analysis failed: ${errorMessage}`);
                panel.showError(errorMessage);
            }
        });
    });
    context.subscriptions.push(command);
}
//# sourceMappingURL=analyzeSelection.js.map