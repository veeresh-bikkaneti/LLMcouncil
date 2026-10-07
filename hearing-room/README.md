# Hearing room

Paste a public GitHub URL. Press Convene. No API key. No clone. No laptop setup.

1. `cd hearing-room && npm install` (about 2 minutes).
2. `npm run dev` and open the page.
3. Leave the sample repo, or paste another public GitHub link.
4. Press **Convene**. Quick is three seats and a chair. Full adds a cross-exam and takes longer.
5. The first visit downloads the model. Later visits in that browser reuse the cache. The model stays loaded until you close the tab.

## Model

One free model, no key and no account: `bartowski/SmolLM2-135M-Instruct-GGUF` file `SmolLM2-135M-Instruct-Q4_K_M.gguf` (about 105 MB).

It runs on one CPU thread beside the page. GitHub Pages cannot turn on shared memory, so the GPU copy is not used. The first Convene downloads it once. Later visits in that browser reuse the cache. It stays loaded until the tab closes.

A public GitHub link is read from the GitHub API. A question with no link is looked up on Wikipedia. Agreement is computed from the claims, not from how many seats returned.

The VS Code extension, the Chrome extension, and `llmcouncil-web` are separate and were not replaced.
