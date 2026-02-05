# LLM Council - Detailed Usage Guide

This guide provides step-by-step technical illustrations on how to use the LLM Council extension effectively.

## 🏗️ Core Workflow: "The Council Analysis"

The primary feature of this extension is the **Multi-Agent Analysis**. It takes your code or text and runs it through three parallel AI agents, then synthesizes a final verdict.

### Step 1: Selection

**Action**: Highlight the text you want analyzed.

> [!TIP]
> **What to select?**
> - A function you want reviewed.
> - An error message from your terminal.
> - A user complaint string.
> - A confusing block of documentation.

```typescript
// Example: Select the following function in your editor
function calculateTotal(items) {
    return items.reduce((acc, item) => acc + item.price, 0);
}
```

### Step 2: Trigger the Council

**Action**: Use one of the following methods to start the analysis.

**Option A: Right-Click Context Menu**
1. Right-click on your selection.
2. Click **"LLMCouncil: Analyze Selection"**.
   *(It usually appears near the top of the menu)*

**Option B: Keyboard Shortcut**
- **Windows/Linux**: Press `Ctrl` + `Shift` + `L`
- **Mac**: Press `Cmd` + `Shift` + `L`

### Step 3: The Council Panel (Visual Guide)

Once triggered, a new panel will open to the side. Here is a technical breakdown of what you will see:

```text
+---------------------------------------------------------------+
|  🤖 LLM Council Analysis                                      |
+---------------------------------------------------------------+
|                                                               |
|  +---------------------------------------------------------+  |
|  | [Vision Agent]                            [ THINKING...]|  | <-- Status Indicator
|  +---------------------------------------------------------+  |     (Updates in Real-Time)
|  |                                                         |  |
|  |  "I am analyzing the visual structure..."               |  | <-- Live Streaming Output
|  |                                                         |  |
|  +---------------------------------------------------------+  |
|                                                               |
|  +---------------------------------------------------------+  |
|  | [Technical Librarian]                     [ DONE      ] |  |
|  +---------------------------------------------------------+  |
|  |                                                         |  |
|  |  "Here is the documentation for Array.reduce..."        |  |
|  |                                                         |  |
|  +---------------------------------------------------------+  |
|                                                               |
|  +---------------------------------------------------------+  |
|  | [Empathy Analyst]                         [ WAITING   ] |  |
|  +---------------------------------------------------------+  |
|  |                                                         |  |
|  |  (Waiting for stream to start...)                       |  |
|  |                                                         |  |
|  +---------------------------------------------------------+  |
|                                                               |
|  =========================================================    |
|                                                               |
|  📋 FINAL CONSENSUS                                           |
|  ------------------                                           |
|  Processing Time: 2.4s | Consensus Rate: 98%                  |
|                                                               |
|  "The council recommends refactoring line 2..."               | <-- The Final Verdict
|                                                               |
|  [ Export to Markdown ]                                       |
|                                                               |
+---------------------------------------------------------------+
```

### Step 4: Understanding the Agents

Each agent has a specific "Personality" and "Technical Focus":

| Agent Role | Icon | Focus Area | Technical Output |
| :--- | :--- | :--- | :--- |
| **Vision Agent** | 👁️ | UI/Visuals | Identifies layout shifts, color contrast issues, and responsiveness problems. |
| **Technical Librarian** | 📚 | Documentation | Looks for deprecated methods, suggests library updates, and cites documentation. |
| **Empathy Analyst** | ❤️ | User Experience | Analyzes tone, frustration potential, and accessibility barriers. |
| **Chairperson** | 🎯 | Synthesis | **THE DECIDER**. Ignores noise and gives you the final code fix or strategy. |

---

## 🛠️ Advanced Usage: The "Open Panel" Mode

If you want to use the council like a Chatbot without selecting text first:

1. Open Command Palette (`Ctrl`+`Shift`+`P`).
2. Type `LLMCouncil: Open Council Panel`.
3. The panel opens empty.
4. You can now paste text directly, or simply keep it open as a sidecar while you work.

---

## ❓ Troubleshooting (Technical)

### Issue: "No language models available"
**Explanation**: This extension relies on the **VS Code Language Model API**, which typically uses GitHub Copilot as the provider.
**Fix**:
1. Ensure you have the **GitHub Copilot Chat** extension installed.
2. Ensure you are signed into GitHub in VS Code.
3. Verify: Click the "Copilot" icon in the bottom right status bar. It should say "Ready".

### Issue: "Authentication Failed"
**Fix**:
1. Run `Developer: Reload Window` from the Command Palette.
2. VS Code may prompt you to allow "LLMCouncil" to access the Language Model. **Click Allow**.
