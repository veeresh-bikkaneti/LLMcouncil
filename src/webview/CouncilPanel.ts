import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AgentRole, ConsensusReport } from '../types/agents';
import { CONFIG } from '../constants';

export class CouncilPanel {
  public static currentPanel: CouncilPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel = panel;
    this.panel.webview.html = this.getHtmlContent(context);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'export':
            this.exportToMarkdown(message.data);
            break;
        }
      },
      null,
      this.disposables
    );
  }

  public static createOrShow(context: vscode.ExtensionContext): CouncilPanel {
    if (CouncilPanel.currentPanel) {
      CouncilPanel.currentPanel.panel.reveal(vscode.ViewColumn.Two);
      return CouncilPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'llmCouncil',
      CONFIG.PANEL_TITLE,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    CouncilPanel.currentPanel = new CouncilPanel(panel, context);
    return CouncilPanel.currentPanel;
  }

  public updateAgentStatus(agent: AgentRole, status: string): void {
    this.panel.webview.postMessage({
      command: 'updateAgent',
      agent,
      status
    });
  }

  public updateResults(report: ConsensusReport): void {
    this.panel.webview.postMessage({
      command: 'updateResults',
      report
    });
  }

  public showError(error: string): void {
    this.panel.webview.postMessage({
      command: 'showError',
      error
    });
  }

  private async exportToMarkdown(data: ConsensusReport): Promise<void> {
    const content = this.formatReportAsMarkdown(data);
    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  }

  private formatReportAsMarkdown(report: ConsensusReport): string {
    let md = '# LLM Council Analysis Report\n\n';
    md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    md += `**Processing Time:** ${(report.processingTime! / CONFIG.MS_TO_SECONDS).toFixed(1)}s\n\n`;
    md += `**Consensus Rate:** ${(report.consensusRate! * 100).toFixed(0)}%\n\n`;
    md += '---\n\n';

    md += '## Agent Perspectives\n\n';
    report.agentOutputs.forEach(agent => {
      md += `### ${agent.role}\n\n`;
      md += `**Status:** ${agent.status}\n\n`;
      md += agent.analysis + '\n\n';
      md += '---\n\n';
    });

    md += '## Final Consensus\n\n';
    md += report.comprehensiveAnswer + '\n';

    return md;
  }

  private getHtmlContent(context: vscode.ExtensionContext): string {
    const templatePath = path.join(context.extensionPath, 'src', 'webview', 'panel-template.html');
    return fs.readFileSync(templatePath, 'utf8');
  }

  private dispose(): void {
    CouncilPanel.currentPanel = undefined;
    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
