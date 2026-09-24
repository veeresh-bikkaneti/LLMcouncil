<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1r719HFJ86ufWnnaX-uNFWuCMeYcqUkO6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. (Optional) Set `GEMINI_API_KEY` in [.env.local](.env.local) to bake a Gemini key into
   the build. Without it, Gemini models stay hidden until a user connects their own key.
3. Run the app:
   `npm run dev`

## No cloud API key required

Both modes run entirely client-side via [`@mlc-ai/web-llm`](https://github.com/mlc-ai/web-llm)
and WebGPU — no server, no account, no key. Six quantized instruct models are available,
from a "Fast & Light" tier (Qwen2.5 1.5B / Llama 3.2 3B, ~1.6-2.3GB) up to 7-8B models
(~5GB). Weights download once and are cached by the browser; both modes share a single
loaded model, so switching between them doesn't load a second one.

- **Universal Council**: three council members and a Chairperson, all on in-browser models
  by default (Llama 3.2 3B, one shared download — the Council makes four passes per
  question, so it defaults to a faster model). The Privacy Shield scrubs PII on-device.
  Any seat can be switched to a cloud model (Gemini, OpenAI, Anthropic, xAI, DeepSeek...)
  once you connect your own key in the Model Hub — keys stay in your browser.
- **Local Assistant**: a single grounded question-and-answer view (default: Qwen2.5 7B
  Instruct, ~5.1GB) — pick a Fast tier model first on modest hardware or metered connections.

In-browser models never rely on LLM-native function calling, regardless of tier —
even the larger models here aren't trusted to drive tools reliably. Instead a plain
JavaScript orchestrator (`src/engine/chatbot.ts`) runs the retrieval step itself before
the model ever sees the query:

1. `executeWebSearch(query)` (`src/engine/search.ts`) fetches grounding sources — using
   your own Tavily/Brave API key if you supply one in the Local Assistant setup panel,
   or falling back to Wikipedia's free, keyless public API when you don't.
2. The results are formatted into an array of `{ id, title, url, content }` sources and
   injected into a locked-down system prompt.
3. The model runs at `temperature: 0.0` and is instructed to only rely on those sources,
   cite every factual claim inline (`[1]`, `[2]`, ...), and end its answer with a
   `Confidence Level: [High/Medium/Low]` tag reflecting how well the sources actually
   covered the question.
4. A collapsible **Grounding Inspection** drawer lets you audit the raw sources behind
   any answer.

Requirements: a browser with WebGPU (recent desktop Chrome/Edge). The model weights
(~1.6GB to ~5.1GB depending on which tier you pick) download once and are cached by
the browser afterwards.

User input and retrieved source text are also scrubbed of common PII patterns (SSNs,
phone numbers, dates of birth, emails) client-side, before they are sent to any search
API or shown in the UI (`src/engine/sanitize.ts`).
