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
exports.CouncilPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const constants_1 = require("../constants");
class CouncilPanel {
    constructor(panel, context) {
        this.disposables = [];
        this.panel = panel;
        this.panel.webview.html = this.getHtmlContent(context);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'export':
                    this.exportToMarkdown(message.data);
                    break;
            }
        }, null, this.disposables);
    }
    static createOrShow(context) {
        if (CouncilPanel.currentPanel) {
            CouncilPanel.currentPanel.panel.reveal(vscode.ViewColumn.Two);
            return CouncilPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel('llmCouncil', constants_1.CONFIG.PANEL_TITLE, vscode.ViewColumn.Two, {
            enableScripts: true,
            retainContextWhenHidden: true
        });
        CouncilPanel.currentPanel = new CouncilPanel(panel, context);
        return CouncilPanel.currentPanel;
    }
    updateAgentStatus(agent, status) {
        this.panel.webview.postMessage({
            command: 'updateAgent',
            agent,
            status
        });
    }
    updateResults(report) {
        this.panel.webview.postMessage({
            command: 'updateResults',
            report
        });
    }
    showError(error) {
        this.panel.webview.postMessage({
            command: 'showError',
            error
        });
    }
    async exportToMarkdown(data) {
        const content = this.formatReportAsMarkdown(data);
        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }
    formatReportAsMarkdown(report) {
        let md = '# LLM Council Analysis Report\n\n';
        md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
        md += `**Processing Time:** ${(report.processingTime / constants_1.CONFIG.MS_TO_SECONDS).toFixed(1)}s\n\n`;
        md += `**Consensus Rate:** ${(report.consensusRate * 100).toFixed(0)}%\n\n`;
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
    getHtmlContent(context) {
        const templatePath = path.join(context.extensionPath, 'media', 'panel-template.html');
        return fs.readFileSync(templatePath, 'utf8');
    }
    dispose() {
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
exports.CouncilPanel = CouncilPanel;
//# sourceMappingURL=CouncilPanel.js.map