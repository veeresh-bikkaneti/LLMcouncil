# LLM Council - VS Code Extension

Multi-agent AI analysis system that brings collaborative intelligence to your VS Code editor.

## 📦 Installation

### Step 1: Download the Extension

Download `llmcouncil-vscode-0.1.0.vsix` from your distribution source (email, cloud storage, or GitHub releases).

### Step 2: Install in VS Code

**Option A: Command Line**
```bash
code --install-extension llmcouncil-vscode-0.1.0.vsix
```

**Option B: VS Code UI**
1. Open VS Code
2. Click Extensions icon (or press `Ctrl+Shift+X`)
3. Click "..." menu → "Install from VSIX..."
4. Select `llmcouncil-vscode-0.1.0.vsix`
5. Click "Install" and reload VS Code

### Step 3: Verify Installation

1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type "LLMCouncil"
3. You should see: "LLMCouncil: Analyze Selection" and "LLMCouncil: Open Council Panel"

✅ **Installation complete!**

---

## 🚀 Quick Start

### Method 1: Analyze Selected Text (Recommended)

1. **Select any text** in your editor (code, error message, user feedback, etc.)
2. **Right-click** → Select "LLMCouncil: Analyze Selection"  
   OR  
   Press **`Ctrl+Shift+L`** (Windows/Linux) / **`Cmd+Shift+L`** (Mac)
3. **Wait** for the council panel to open
4. **View** real-time analysis from 3 AI agents
5. **Read** the final consensus from the Chairperson

### Method 2: Open Panel First

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "LLMCouncil: Open Council Panel"
3. Enter your query in the panel

---

## 💡 Usage Examples

### Example 1: Debug an Error

```javascript
// Select this error message and press Ctrl+Shift+L
TypeError: Cannot read property 'map' of undefined
  at Component.render (App.js:42)
```

**Council provides:**
- Vision Agent: UI impact analysis
- Technical Librarian: Fix suggestions with documentation
- Empathy Analyst: User frustration assessment
- Chairperson: Prioritized solution

### Example 2: Code Review

```python
# Select your code and get multi-perspective review
def process_data(items):
    return [x*2 for x in items]
```

### Example 3: User Feedback Analysis

```
Select user complaint text:
"The login button is greyed out and I can't access my account!"
```

Get instant multi-agent analysis with solutions.

---

## 🤖 How It Works

**Council Members:**
- **👁️ Vision Agent** - Analyzes UI/UX, visual issues, user interface problems
- **📚 Technical Librarian** - Searches documentation, provides code solutions
- **❤️ Empathy Analyst** - Assesses user sentiment, urgency, frustration levels
- **🎯 Chairperson** - Synthesizes all perspectives into actionable verdict

**Process:**
1. All 3 agents analyze your query **in parallel** (faster results!)
2. Each agent provides specialized insights
3. Chairperson combines perspectives
4. You get comprehensive, multi-angle analysis in **seconds**

---

## ⚙️ Requirements

### Required
- **VS Code** version 1.85.0 or higher
- **GitHub Copilot** extension (for automatic authentication)

### Optional
- Manual API key configuration (if not using Copilot)

---

## 🎨 Features

- ✅ **Parallel Execution** - All agents run simultaneously for speed
- ✅ **Live Progress Tracking** - See each agent's status in real-time
- ✅ **Export to Markdown** - Save analysis reports for documentation
- ✅ **Cancellation Support** - Stop analysis anytime
- ✅ **Error Resilient** - Continues even if one agent fails
- ✅ **Clean UI** - Modern, responsive webview panel

---

## 📋 Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|--------|---------------|-----|
| Analyze Selection | `Ctrl+Shift+L` | `Cmd+Shift+L` |
| Command Palette | `Ctrl+Shift+P` | `Cmd+Shift+P` |

---

## ⚙️ Extension Settings

This extension contributes the following settings:

- `llmcouncil.preferredModel`: Preferred language model  
  - Options: `auto`, `gpt-4`, `claude`, `gemini`
  - Default: `auto` (uses GitHub Copilot)

- `llmcouncil.enableParallelExecution`: Run agents in parallel  
  - Default: `true` (recommended for speed)

**To configure:**
1. File → Preferences → Settings (or `Ctrl+,`)
2. Search for "LLMCouncil"
3. Adjust settings as needed

---

## 🔧 Troubleshooting

### "No language models available"

**Solution:**
1. Install GitHub Copilot extension
2. Sign in to GitHub Copilot
3. Verify Copilot is active (check status bar)

### Extension not showing in menu

**Solution:**
1. Reload VS Code (Developer: Reload Window)
2. Check if extension is enabled in Extensions panel
3. Reinstall from VSIX if needed

### Panel doesn't open

**Solution:**
1. Check VS Code output panel for errors
2. Ensure text is selected before invoking
3. Try "LLMCouncil: Open Council Panel" from command palette

---

## 📖 Additional Resources

- **Quick Start Guide:** See `QUICKSTART.md` for detailed walkthrough
- **Publishing Info:** See `PUBLISHING.md` for distribution options
- **License:** MIT (see `LICENSE.txt`)

---

## 👨‍💻 For Developers

### Build from Source

```bash
git clone https://github.com/veeresh-bikkaneti/LLMcouncil.git
cd llmcouncil-vscode
npm install
npm run compile
```

Press `F5` to launch Extension Development Host

### Run Tests

```bash
npm test
```

---

## 📝 License

MIT License - Copyright (c) 2024 RUN Technology Consulting Services LLC

---

## 🆘 Support

For issues or questions:
- Check troubleshooting section above
- Review `QUICKSTART.md` for detailed instructions
- Contact your administrator

---

**Version:** 0.1.0  
**Publisher:** RUNTechnologyConsultingServicesLLC
