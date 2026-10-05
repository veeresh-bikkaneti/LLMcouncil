# LLM Council

Ask one question, get several perspectives, read one answer. Everything runs on your
own machine: no cloud models, no API keys, no accounts, no server of ours.

**Council mode** sends your question to three differently-prompted members (Factualist,
Analyst, Skeptic) at the same time, then a Chairperson merges their answers into one
streamed verdict. **Quick mode** is a single streamed answer.

## Run it

You need Node 20+ and a local model server. [Ollama](https://ollama.com/download) is the
easiest:

```bash
ollama pull llama3.2          # ~2 GB; any chat model works
cd llmcouncil-web
npm install
npm run dev                   # http://localhost:3000
```

The page finds Ollama on `localhost:11434`, lists your installed models and picks one.
Any server with an OpenAI-compatible `/v1/chat/completions` endpoint works too
(llama.cpp's `llama-server`, LM Studio, vLLM): change the URL in Settings.

**No install?** Choose *In this browser* in Settings. It runs a small model on your GPU
with WebGPU (desktop Chrome/Edge). It needs a one-time 1–2 GB download and runs the
council members one after another, so it is the slow path.

## Why it is fast

- The model runs natively in Ollama/llama.cpp, not inside a browser tab.
- Council members run in parallel (Ollama serves concurrent requests; tune with
  `OLLAMA_NUM_PARALLEL`, or `-np 3` for `llama-server`). One loaded model plays every seat.
- Every answer streams, and each generation has a token cap, so a council run costs
  at most three short answers plus one merge.
- Nothing is fetched at startup: no CDN scripts, fonts or search calls. The main bundle
  is ~70 kB gzipped; the browser-model runtime loads only if you pick that backend.
- Web lookups are opt-in (below) instead of running before every question.

## Optional: Wikipedia grounding

Settings → *Ground answers in Wikipedia* adds one keyless Wikipedia lookup per question
and passes the excerpts to the models as citable sources. Only your question text, with
emails, phone numbers, SSNs and dates of birth removed, is sent. Off by default.

## Hosting the page elsewhere

If you serve the built page from another origin (e.g. GitHub Pages), allow it in Ollama:

```bash
OLLAMA_ORIGINS="https://<you>.github.io" ollama serve
```

Browsers may ask permission to reach a local network address. Safari blocks plain-HTTP
local servers from HTTPS pages; use `npm run dev` or `npm run preview` there.

## Development

```bash
npm test          # unit tests (streaming, think-tag filter, council orchestration)
npm run typecheck
npm run build
```

```
src/lib/backends/   openai.ts (Ollama & friends), webllm.ts (in-browser)
src/lib/council.ts  quick + council orchestration
src/lib/prompts.ts  personas and chair prompt
src/lib/search.ts   optional Wikipedia lookup
src/components/     SeatCard, SettingsDialog, Markdown
```
