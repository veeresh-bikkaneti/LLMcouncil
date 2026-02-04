# LLM Council - VS Code Extension

Multi-agent AI analysis directly in VS Code using GitHub Copilot's authentication.

## Features

- 🤖 **Parallel Agent Execution** - Vision, Technical, and Empathy agents analyze simultaneously
- 🔐 **GitHub Copilot Integration** - Uses existing Copilot authentication
- ⚡ **Fast Results** - Parallel execution provides comprehensive analysis in seconds
- 📊 **Live Updates** - Real-time progress tracking for each agent
- 📝 **Export to Markdown** - Save analysis reports

## Usage

**Analyze Selected Text:**
- Select text → Press `Ctrl+Shift+L` (Windows/Linux) or `Cmd+Shift+L` (Mac)
- Or right-click → "LLMCouncil: Analyze Selection"

**Open Council Panel:**
- Command Palette → "LLMCouncil: Open Council Panel"

## Requirements

- **GitHub Copilot** extension (for automatic authentication)
- OR manually configure API keys in VS Code Settings

## Extension Settings

- `llmcouncil.preferredModel` - Preferred language model (default: auto)
- `llmcouncil.enableParallelExecution` - Enable parallel execution (default: true)

## Installation

### From VSIX
```bash
code --install-extension llmcouncil-vscode-0.1.0.vsix
```

### Development
```bash
cd llmcouncil-vscode
npm install
npm run compile
```
Press `F5` to launch Extension Development Host

## How It Works

**Agent Roles:**
- **Vision Agent** - Analyzes visual aspects, UI/UX issues
- **Technical Librarian** - Searches for technical solutions
- **Empathy Analyst** - Assesses user sentiment and urgency
- **Chairperson** - Synthesizes all perspectives into final verdict

**Architecture:**
- Uses VS Code Language Model API (`vscode.lm`)
- Automatically detects GitHub Copilot models
- Falls back to manual API keys if needed
- Parallel execution for speed

## License

MIT
