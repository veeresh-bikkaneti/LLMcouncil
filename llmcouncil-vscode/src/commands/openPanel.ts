import * as vscode from 'vscode';
import { CouncilOrchestrator } from '../services/councilOrchestrator';
import { CouncilPanel } from '../webview/CouncilPanel';

export function registerOpenPanel(
    context: vscode.ExtensionContext,
    orchestrator: CouncilOrchestrator
): void {
    const command = vscode.commands.registerCommand(
        'llmcouncil.openPanel',
        () => {
            CouncilPanel.createOrShow(context);
        }
    );

    context.subscriptions.push(command);
}
