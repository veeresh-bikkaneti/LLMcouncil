import * as vscode from 'vscode';
import { registerAnalyzeSelection } from './commands/analyzeSelection';
import { registerOpenPanel } from './commands/openPanel';
import { LanguageModelClient } from './services/languageModelClient';
import { CouncilOrchestrator } from './services/councilOrchestrator';

export function activate(context: vscode.ExtensionContext) {
    console.log('LLM Council extension activated');

    const lmClient = new LanguageModelClient();
    const orchestrator = new CouncilOrchestrator(lmClient);

    registerAnalyzeSelection(context, orchestrator);
    registerOpenPanel(context, orchestrator);

    const hasShownWelcome = context.globalState.get<boolean>('hasShownWelcome');
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            'LLM Council extension activated! Use Ctrl+Shift+L to analyze selected text.',
            'Got it'
        ).then(() => {
            context.globalState.update('hasShownWelcome', true);
        });
    }
}

export function deactivate() {
    console.log('LLM Council extension deactivated');
}
