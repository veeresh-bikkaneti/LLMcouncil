# LLM Council

A council of **local** LLMs: several perspectives answered in parallel, merged into one
verdict. No cloud models, no API keys.

The app lives in [`llmcouncil-web/`](llmcouncil-web/README.md).

```bash
ollama pull llama3.2
cd llmcouncil-web && npm install && npm run dev
```

> **Legacy code.** `server/`, `llmcouncil-chrome/`, `llmcouncil-vscode/`, the root `src/`
> and the old design docs belong to the previous cloud-based version (Anthropic, OpenAI
> and Copilot APIs). They are no longer maintained and are safe to delete.
