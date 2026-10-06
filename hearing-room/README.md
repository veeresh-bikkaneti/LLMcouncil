# Hearing room

Paste a public GitHub URL. Press Convene. No API key. No clone. No laptop setup.

1. `cd hearing-room && npm install` (about 2 minutes).
2. `npm run dev` and open the page.
3. Leave the sample repo, or paste another public GitHub link.
4. Press **Convene**. Quick is three seats and a chair. Full adds a cross-exam and takes longer.
5. The first visit downloads the model. Later visits in that browser reuse the cache. The model stays loaded until you close the tab.

## Model

One model: `onnx-community/SmolLM2-360M-Instruct-ONNX`.

| Path | Weights | Tokenizer |
| --- | ---: | ---: |
| WebGPU, when the browser can start an adapter | 272,353,302 bytes (`q4f16`) | 3,522,656 bytes |
| CPU / WASM, one thread | 386,495,938 bytes (`q4`) | same tokenizer |

A failed download does not start the second file. A GPU device failure may fall back to the CPU file. Seats, cross-exam, and the chair share that one session, one after another.

The repo text is read in the browser from the public GitHub API. Other websites are not opened. Agreement is computed from the claims, not from how many seats returned.

The VS Code extension, the Chrome extension, and `llmcouncil-web` are separate and were not replaced.
