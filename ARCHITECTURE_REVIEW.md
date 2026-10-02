# LLMCouncil Architecture, Performance, and Reliability Review

**Repository:** `veeresh-bikkaneti/LLMcouncil`  
**Commit reviewed:** `40d3fb6` (`Merge Universal Council and Local Assistant into one screen with a Quick/Council toggle`)  
**Review date:** 2026-09-28

## Executive verdict

The project is a promising **client-side prototype**, not a single coherent production application yet. The main reason it feels slow, flaky, and brittle is not merely model size: the repository contains **three overlapping products and two competing architectures**:

1. `llmcouncil-web/`: current product, direct browser-to-provider calls plus WebLLM.
2. Root `src/` and `llmcouncil-vscode/`: duplicated VS Code implementations.
3. `server/`: a separate Express/Postgres product branch that the web app does not use.

The fastest path is to make the web app the only primary product, keep the server optional until a real backend requirement exists, and make council deliberation **one local model with multiple short personas plus deterministic aggregation**.

> **Recommendation:** optimize for a reliable single-answer product first, then offer Council as an explicitly slower, higher-confidence mode. Do not make a four-pass local council the default experience.

## What I ran locally

| Area | Command/result | Finding |
|---|---|---|
| Web app | `llmcouncil-web: npm ci && npm run build` | **Pass**. Vite build completes in ~3.4s. |
| Web dev server | `npm run dev -- --host 0.0.0.0 --port 4173` | **Pass**. Vite serves HTTP 200 locally. |
| Backend | `server: npm ci && npm run build` | **Pass**. TypeScript compiles. |
| Backend health | `GET /health` with invalid DB URL | **Pass, but misleading**. Returns 200 while DB connection is refused. |
| Backend analytics | `GET /api/analytics` | **Fail**. Returns 404; route is not implemented. |
| Backend login | `POST /auth/login {}` | **Critical fail**. Returns `{"token":"fake-jwt-token"}` without validation/authentication. |
| Backend smoke test | `node server/test-api.js` without starting server | **Fail**. All checks fail with `fetch failed`; test does not start or provision its dependency. |
| Chrome extension clean install | `npm ci` | **Fail**. `package.json` and lockfile are out of sync. |
| VS Code extension clean install | `npm ci` | **Fail**. `package.json` and lockfile are out of sync. |
| Root clean install | `npm ci` | **Fail**. Root manifest and lockfile are out of sync. |

The web build also reports `/index.css doesn't exist at build time` and produces a 6.0 MB uncompressed WebLLM chunk. The app is technically code-split, but the local-model download/runtime experience is still inherently large.

## Why it is slow

### 1. Local Council is serial, and it swaps models

The current web code correctly recognizes that one WebLLM engine cannot safely run concurrent generations:

- `llmcouncil-web/App.tsx:224-243` explicitly loops over council seats with `await`.
- `llmcouncil-web/src/engine/engineManager.ts:15-36` has one global engine and one queue.
- `llmcouncil-web/src/engine/engineManager.ts:112-149` unloads the existing model before loading another.
- `llmcouncil-web/src/engine/models.ts:239-245` defaults to **three distinct local models**: Qwen 1.5B, SmolLM2 1.7B, and Llama 3.2 3B.

So a Council request is approximately:

1. Retrieve grounding sources.
2. Load/generate member 1.
3. Unload member 1 and load/generate member 2.
4. Unload member 2 and load/generate the chair.
5. Render the result.

Even when weights are browser-cached, model swaps and three full prefill/decode passes are expensive. On a first run, each model can require a multi-GB download. The current UI presents this as a council of independent agents, but the hardware path is a single serialized engine.

### 2. Default answer mode is `complex`

`llmcouncil-web/App.tsx:85` initializes `answerMode` to `complex`. Cloud Gemini paths can request thinking budgets up to 32,768 tokens in `inferenceService.ts:237-243`; Quick mode can request 900 output tokens locally. That is excessive for triage and magnifies latency variance.

Use a short, bounded default:

- Simple/fast: 256–400 output tokens.
- Standard: 500–700 output tokens.
- Deep: explicit opt-in, with a hard timeout.

### 3. Retrieval is on the critical path

`App.tsx:175-183` performs retrieval before local generation. This is reasonable for grounded answers, but it adds a network dependency to a nominally local mode. Wikipedia/DuckDuckGo failures or slow responses can make WebLLM appear flaky.

Add a visible retrieval timeout (for example 3 seconds), return an empty source set on timeout, and let the local answer proceed with a clear “not grounded” label.

### 4. The first-use cost is not treated as a product state

The UI is asking a new visitor to wait for a model download while also presenting multiple seats and a chair. This creates a poor first impression even if warm-cache performance is acceptable.

The product should expose explicit states:

- **Ready:** model already cached.
- **Preparing:** downloading X MB / Y GB.
- **Warm:** engine loaded.
- **Answering:** token generation.
- **Fallback:** smaller model selected or cloud provider used.

Prefetch only the selected/default model after the page is idle; do not prefetch three council models.

## Why it is flaky

### 1. GPU/WebGPU is an unstable execution substrate

The engine has thoughtful handling for device loss (`engineManager.ts:39-49`, `313-321`), but browser GPU resets, background-tab suspension, memory pressure, and model swaps remain real failure modes. Retrying a model after a GPU loss can still repeat a multi-GB operation.

Mitigations:

- Default to one small model (`Qwen2.5 1.5B` or `Llama 3.2 1B`) for first use.
- Do not load a chair model after every local member response.
- Make “use cloud model” an explicit fallback, not a hidden recovery attempt.
- Persist the resolved model and avoid rediscovering step-downs repeatedly.
- Add timing telemetry for download, load, first token, total generation, and GPU-loss count.

### 2. Context budget is conservative and lossy

`models.ts:178-183` sets desktop context to 4096 tokens and `grounding.ts` reserves `PROMPT_OVERHEAD_TOKENS = 700`. `inferenceService.ts:163-167` then limits the user query to 25% of the remaining budget. The chair additionally truncates each perspective.

This prevents crashes but can produce answers that look nonsensical because the query, sources, and member outputs are competing for a small window. Use measured token budgeting:

- Reserve a fixed output budget.
- Tokenize or estimate each section independently.
- Truncate sources first, then member outputs, and **never truncate the user’s core query** unless it exceeds a hard maximum.
- Keep the council input to structured claims, not full verbose member essays.

### 3. Failure boundaries are inconsistent

The web council catches member failures and continues, but the backend starts successfully while its database is unavailable (`server/src/index.ts:18-24`). This produces a false healthy service. Health should distinguish:

- `/health/live`: process is alive.
- `/health/ready`: required dependencies are available.

The backend should either fail readiness or run in a clearly named stateless mode. Never return a production-looking successful login when auth is not implemented.

### 4. The VS Code branch claims parallel execution but is a different implementation

The root and `llmcouncil-vscode` orchestrators are byte-for-byte duplicates. Their comments say “Execute agents in parallel” and use `Promise.all`, while the web implementation deliberately serializes local seats. This is a product-contract problem: different clients have different execution semantics, model assumptions, and failure behavior.

Choose one shared orchestration contract and have adapters implement it. At minimum, rename the setting to reflect reality:

- `parallelExecution` only for independent remote calls.
- `serializedLocalExecution` for one WebLLM engine.

## Why it is brittle

### 1. Three products and two source trees

The repository has `llmcouncil-web`, `src`, `llmcouncil-vscode`, `llmcouncil-chrome`, and `server`. `src` and `llmcouncil-vscode/src` contain duplicate TypeScript and compiled JavaScript. This guarantees drift and doubles the testing surface.

Recommended ownership:

```text
apps/web/                 primary product
packages/council-core/    roles, orchestration contract, merge logic, provider interface
packages/provider-client/ WebLLM + OpenAI-compatible + Gemini adapters
apps/vscode/              thin adapter, only if actively maintained
apps/chrome/              thin adapter, only if actively maintained
services/proxy/           optional later; no database initially
```

If VS Code and Chrome are not immediate launch targets, archive them from the main build rather than deleting history immediately.

### 2. The backend is a dead architecture branch

The web app imports `services/inferenceService.ts` directly and does not use `services/api.ts` for inference. The server has its own routes, agents, orchestration, database assumptions, and old product vocabulary. Maintaining both paths makes every bug ambiguous.

Do not move to the backend merely because a production spec says so. Move only when you need one or more of:

- server-side provider keys,
- shared team history/analytics,
- durable jobs,
- rate limiting and abuse controls,
- enterprise data policies.

Until then, keep the web app stateless and local/BYOK.

### 3. Fake and dead features reduce trust

Verified examples:

- `server/src/routes/auth.ts:6` returns `fake-jwt-token`.
- `llmcouncil-web/services/api.ts:62` calls `/api/analytics`, but the server returns 404.
- `llmcouncil-web/App.tsx:83` defines `requestCounts`, but no update path was found; quota badges are not authoritative.
- `llmcouncil-web/App.tsx:355` passes `handleCancel={() => {}}`.
- `AgentCard.tsx:136-137` presents automation as “Synchronizing with mission profile…” while no real automation workflow is connected.
- Privacy is a deterministic regex sanitizer (`sanitizePII`), not an AI seat. It should be displayed as a preprocessing step.
- `ImageEditorView.tsx` is empty.
- `src/services/councilOrchestrator.ts:107` admits that consensus rate is computed from response-length variance, which is not semantic agreement.

Either implement these with tests or remove them from the UI and docs. A smaller honest product is more credible than a dashboard full of simulated state.

### 4. Dependency reproducibility is broken

All three npm installation surfaces have stale lockfiles. This blocks clean CI and new contributors before application tests even start. Fix manifests first:

```bash
npm install --package-lock-only   # in root and each maintained app
npm ci
```

Then pin Node/npm versions with `.nvmrc` or `packageManager`, and run the same matrix in CI.

## Recommended target architecture

### Product tiers

| Tier | Default use | Model source | Key required | Latency goal |
|---|---|---|---|---|
| **Local Quick** | default for everyone | one WebLLM model | no | warm: 2–10s; first use: download-dependent |
| **Local Council** | opt-in deeper review | one WebLLM model, 2–3 prompt personas | no | warm: 10–30s |
| **Free Cloud** | fast path when user supplies a free key | one OpenAI-compatible provider | user key | roughly seconds, provider-dependent |
| **BYOK** | power users | OpenAI/Anthropic/Gemini/etc. | user key | provider-dependent |

Do not promise a universal `<15s` target for a first-time browser download. Measure warm and cold paths separately.

### Core flow

```text
sanitize input
  -> optional retrieval with timeout
  -> choose one model/provider
  -> quick answer OR 2 short personas
  -> deterministic merge / structured claim ranking
  -> render citations, confidence, and timing
```

### Deterministic chair

Replace the local chair LLM by default. Ask each persona for a compact structured response:

```ts
interface Perspective {
  role: string;
  claims: Array<{ text: string; confidence: number; evidenceIds: string[] }>;
  risks: string[];
  actions: string[];
}
```

Merge in JavaScript:

1. Normalize and deduplicate claims.
2. Group claims by lexical similarity / IDs / optional embeddings later.
3. Rank by number of supporting perspectives and confidence.
4. Preserve disagreement explicitly.
5. Produce a final answer and priority using deterministic rules.

Keep an LLM chair as an opt-in “polished synthesis” mode for cloud users or high-value workflows. This removes one full generation from the critical path and makes outputs testable.

### One provider dispatcher

Create one function:

```ts
callProvider({ provider, model, apiKey, messages, signal }): Promise<ProviderResult>
```

All Gemini, Anthropic, OpenAI-compatible, GitHub Models, Groq, and local adapters should conform to it. Add:

- timeout and abort signal,
- normalized error types,
- usage extraction,
- retry only for safe transient failures,
- provider/model capability metadata.

Do not copy provider dispatch into every seat function.

## Free-model strategy

### Do not push model weights to GitHub

GitHub repositories, Releases, and LFS are not a reliable model CDN for browser range requests and multi-GB artifacts. WebLLM’s prebuilt model distribution and browser cache are the right mechanism for local weights.

### Use an OpenAI-compatible free-cloud adapter

The current `callOpenAICompatible` function is close to the right abstraction. Add a provider registry entry for a free/low-cost compatible endpoint only after verifying its current availability, rate limits, model IDs, and acceptable browser CORS behavior. If the endpoint requires a secret, do not embed a shared secret in the client; use BYOK or a small serverless proxy with strict quotas.

Suggested behavior:

1. Default: local WebLLM, no key.
2. If user adds a compatible free-tier key: use one remote model for Quick mode.
3. If user selects Council: run two short perspectives and deterministic merge.
4. If a provider errors or rate-limits: fall back to local Quick, not a chain of hidden provider retries.

### GitHub Models specifically

Treat GitHub Models as an optional OpenAI-compatible provider, not as a replacement for local models and not as a key baked into the app. Keep the endpoint/model IDs configurable in the provider registry and document that users supply their own token. Verify current availability and browser CORS before shipping it as a default.

## Prioritized execution plan

### P0: Make the repository trustworthy

1. Decide the primary product: `llmcouncil-web`.
2. Regenerate all maintained lockfiles and add CI clean-install checks.
3. Remove or hide fake login, analytics, automation, quota, image-editing, and export claims until real.
4. Add a real test command for the web app; currently it has no test script.
5. Add `/health/live` and `/health/ready` if the backend remains in the repo.

### P1: Cut latency without changing the product promise

1. Make Quick/local single-model mode the default.
2. Set default mode to simple/standard, not complex.
3. Prefetch one selected model after idle.
4. Add retrieval timeout and source-size budgets.
5. Add timings to the UI and logs: retrieval, download, load, first token, generation, merge.

### P2: Simplify Council

1. Keep two personas on one model.
2. Require compact structured outputs.
3. Implement deterministic merge.
4. Keep LLM chair behind an explicit “polished synthesis” toggle.
5. Test cancellation, GPU loss, empty output, provider timeout, and partial council failure.

### P3: Add free cloud and BYOK cleanly

1. Extract `callProvider`.
2. Add provider capability metadata.
3. Add one OpenAI-compatible free-tier provider behind user-supplied credentials.
4. Add aborts, timeouts, normalized errors, and bounded retries.
5. Add optional serverless proxy only when shared keys/quotas are actually needed.

### P4: Consolidate clients

Share `packages/council-core` between web, VS Code, and Chrome. If a client cannot consume the shared contract, archive it rather than maintain another fork.

## Acceptance criteria for the next milestone

- `npm ci` succeeds in every maintained package.
- Web Quick mode works without a cloud key and without retrieval blocking the answer.
- Warm local Quick answer reports first-token and total latency.
- Council uses one model and two personas by default.
- Deterministic merge has unit tests and exposes disagreement.
- Cancel stops work without late state updates.
- GPU loss falls back to a smaller model or cloud path with a user-visible explanation.
- No UI claims authentication, analytics, quotas, automation, image editing, or export unless the feature is implemented end-to-end.
- Backend is either removed from the launch path or has real auth, readiness checks, route tests, and a documented role.

## Bottom line

The attached feedback is substantially right about the direction—**cut serial LLM work, do not host weights on GitHub, and eliminate dead features**—but the current repository is already partially optimized in the web branch, so the next win is not blindly “parallelize.” A single WebLLM engine cannot run local seats in parallel. The practical design is:

> **one model + short personas + deterministic merge + explicit cloud/BYOK adapter + honest product surface.**

That gives you a fast free path, keeps privacy/local execution, and leaves room for higher-quality cloud models without forcing every user to download or run three models per question.


## Architect peer review

A senior architect peer reviewed the single-model/local-merge direction and **approved it with required changes**. The peer confirmed that the dominant issue is repeated model reload/compile work: browser weight caching reduces network downloads, but it does not keep the WebLLM engine resident or avoid GPU graph initialization. The plan is therefore sound, but the following safeguards are required before calling it production-quality.

### Required architecture safeguards

1. **Singleton and queue contract:** exactly one engine per page/tab, with a FIFO queue and no overlapping generation. The current engine manager already has a shared engine and queue; this should receive explicit tests for concurrent submissions, React rerenders, navigation, and stale requests.
2. **Explicit model configuration:** model ID, quantization, context size, sampling defaults, and WebLLM version must be treated as a versioned runtime configuration. A model change is an explicit user action, not a persona-level side effect.
3. **Versioned preference migration:** the localStorage key bump is useful, but it must be treated as preference migration only. Model weights live in WebLLM-managed browser storage, not localStorage. Preserve custom personas, tolerate malformed data, and provide reset behavior.
4. **Bounded persona protocol:** both personas must receive the same question/evidence, have bounded output/time budgets, and handle cancellation and partial failure consistently.
5. **Pure deterministic merge:** the merge must have stable ordering, normalization, duplicate removal, disagreement preservation, a length cap, and golden tests. It must not depend on response timing, locale, randomness, or wall-clock time.
6. **No silent cloud fallback:** local mode must work without keys, subscriptions, or an account after assets are cached. A cloud provider may be explicit opt-in only; local failures must not silently transmit user data remotely.
7. **Capability/storage UX:** detect WebGPU absence, storage quota/eviction, GPU loss, model download failure, tab suspension, and OOM/context failures. Expose clear initializing/downloading/compiling/queued/generating/merging/complete/failed states.
8. **Privacy-preserving observability:** measure model/config version, persona/merge version, download/cache hit, queue wait, first token, total latency, cancellation, GPU loss, and failure type without logging prompts or responses by default.

### PBR: priority, benefit, risk

| Priority | Work item | Benefit | Main risk if skipped |
|---|---|---|---|
| **P0** | Keep one default model, migrate stale seat preferences, remove local chair generation | Eliminates repeated model swaps and one full local inference pass | Demo remains slow and appears to redownload models every question |
| **P0** | Add singleton/queue/concurrency tests | Proves the engine cannot be initialized twice or interleaved | GPU corruption, cross-question contamination, leaked promises |
| **P0** | Guarantee local-only mode and no silent cloud fallback | Preserves the zero-subscription showcase promise | User data may unexpectedly leave the browser |
| **P0** | Add visible lifecycle states and actionable errors | Makes first-run download/compile latency understandable | Users interpret normal model initialization as a broken app |
| **P1** | Add pure merge golden tests and versioned merge output | Makes consensus behavior testable and repeatable | Quality regressions or fabricated agreement go unnoticed |
| **P1** | Add retrieval timeout, source budgets, and offline continuation | Separates network flakiness from local inference | A free retrieval endpoint blocks an otherwise local answer |
| **P1** | Add performance telemetry and cold/warm benchmarks | Produces credible showcase evidence | Claims about speed cannot be verified across devices |
| **P1** | Add storage/WebGPU/OOM capability checks | Improves behavior across Chrome, Edge, mobile, and low-memory hardware | Tabs crash or repeatedly retry impossible loads |
| **P2** | Move heavy engine work to a Web Worker if UI responsiveness requires it | Keeps React responsive during initialization and generation | Main thread stalls on lower-end devices |
| **P2** | Add explicit one-persona degraded mode | Gives users a fast fallback without abandoning the council | Two generations remain too slow on phones or weak GPUs |
| **P2** | Consolidate duplicated Web/Chrome/VS Code orchestration into a shared package | Reduces drift and test duplication | Fixes land in one client but not another |
| **P3** | Optional free-cloud/BYOK adapter | Demonstrates extensibility without weakening the local demo | Provider complexity distracts from the core showcase |
| **P3** | Optional backend/proxy only when shared keys, history, or abuse controls are needed | Enables future multi-user features | Current dead backend branch continues to create confusion |

### Architect acceptance gates

The next release should not be called complete until it can demonstrate:

- One WebLLM engine and one default model per page/tab.
- No model reload caused by a normal Council question.
- FIFO behavior for multiple submissions and no overlapping generations.
- Cached restart behavior distinguished from first-run download/compile behavior.
- Local-only end-to-end operation with network disabled after model assets are cached.
- Deterministic merge output independent of persona completion order.
- Golden tests for both-persona, one-failed-persona, empty-output, duplicate-output, and disagreement cases.
- Visible cancellation that prevents late state updates.
- Explicit model switching with queue drain/cancel and progress reporting.
- Tests for malformed localStorage, repeated migration, reset, and preservation of user persona settings.
- Performance measurements for cold start, cache hit, queue wait, first token, total latency, peak memory, and cache eviction.

### Scope note

The current patch addresses the highest-impact P0 latency problem. It does **not** yet claim all acceptance gates above are implemented. The next engineering step should be tests and instrumentation, not adding more providers or more model seats.
