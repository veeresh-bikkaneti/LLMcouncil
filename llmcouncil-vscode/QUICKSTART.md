# Quick Start: Testing the Extension

## 1. Launch Extension Development Host

1. **Open the extension folder:**
   ```bash
   code c:\Users\veere\source\repos\LLMCouncil\llmcouncil-vscode
   ```

2. **Press `F5`** - This launches a new VS Code window with your extension loaded

3. **Verify activation:**
   - Look for welcome message: "LLM Council extension activated!"
   - Open Console (Help → Toggle Developer Tools) to see logs

## 2. Test Basic Functionality

1. **Open any file** in the Extension Development Host window
2. **Select some text** (e.g., a function, comment, or paragraph)
3. **Press `Ctrl+Shift+L`** (Windows) or `Cmd+Shift+L`(Mac)
4. **Watch the magic happen:**
   - Council panel opens
   - Agents analyze in parallel
   - Results appear in real-time

## 3. Alternative Ways to Trigger

-**Context Menu:** Right-click selected text → "LLMCouncil: Analyze Selection"
- **Command Palette:** `Ctrl+Shift+P` → "LLMCouncil: Analyze Selection"

## Troubleshooting

**If you see "No language models available":**
- Ensure GitHub Copilot extension is installed
- Check if Copilot is authenticated (bottom status bar)
- Try signing out and back into Copilot

**If compilation fails:**
```bash
cd llmcouncil-vscode
npm install
npm run compile
```

**To rebuild and relaunch:**
- Stop Extension Development Host (close window)
- Press `F5` again in main VS Code window

## Next: Package for Distribution

Once testing is successful:
```bash
cd llmcouncil-vscode
npm install -g @vscode/vsce
vsce package
```

Installs as: `llmcouncil-vscode-0.1.0.vsix`
