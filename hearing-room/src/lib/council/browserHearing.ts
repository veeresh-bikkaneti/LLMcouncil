import type { Wllama } from "@wllama/wllama";
import {
  type Brief,
  type CrossNote,
  type HearingMode,
  type Packet,
  type Ruling,
  type SeatId,
  SEATS,
  agreementScore,
  formatPacket,
  isSeatId,
  linksIn,
  seatById,
} from "./protocol.ts";

const MODEL_REPO = "bartowski/SmolLM2-135M-Instruct-GGUF";
const MODEL_FILE = "SmolLM2-135M-Instruct-Q4_K_M.gguf";

type TinyPipe = Wllama;

type Progress = {
  loaded?: number;
  total?: number;
};

let model: TinyPipe | null = null;
let loading: Promise<TinyPipe> | null = null;
let retriedLoad = false;

export function tinyIsWarm(): boolean {
  return model != null;
}

function errorText(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return `The model stopped (${typeof error}: ${String(error)}).`;
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === "object") {
    const row = error as { message?: unknown; name?: unknown; reason?: unknown };
    if (typeof row.message === "string" && row.message.trim()) return row.message.trim();
    const bits = [row.name, row.reason].filter((item) => typeof item === "string" && item.trim()) as string[];
    if (bits.length > 0) return bits.join(": ");
    try {
      const dumped = JSON.stringify(error);
      if (dumped && dumped !== "{}" && dumped !== "null") return `The model stopped: ${dumped.slice(0, 180)}`;
    } catch {
      // circular or unserializable
    }
    return `The model stopped (${Object.prototype.toString.call(error)}).`;
  }
  if (error == null) return "The model stopped. No reason was given.";
  return "The seat failed before it could write.";
}

export function completionFrom(full: string, prompt: string): string {
  const bare = (value: string) => value.replace(/<\|im_start\|>/g, "").replace(/<\|im_end\|>/g, "").trim();
  const decoded = bare(full);
  const cue = bare(prompt);
  if (!decoded || !cue || !decoded.startsWith(cue)) return "";
  return decoded.slice(cue.length).trim();
}

function readObject(text: string): Record<string, unknown> | null {
  let last: Record<string, unknown> | null = null;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    const end = balancedEnd(text, i);
    if (end < 0) continue;
    const parsed = parseLoose(text.slice(i, end + 1));
    if (parsed) last = normalizeKeys(parsed);
    i = end;
  }
  return last;
}

function balancedEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseLoose(slice: string): Record<string, unknown> | null {
  const attempts = [slice, slice.replace(/,\s*([}\]])/g, "$1")];
  for (const candidate of attempts) {
    try {
      const value = JSON.parse(candidate) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      return value as Record<string, unknown>;
    } catch {
      // try the trailing-comma repair next
    }
  }
  return null;
}

const KEY_ALIAS: Record<string, string> = {
  answer: "answer",
  stance: "stance",
  claims: "claims",
  confidence: "confidence",
  unknowns: "unknowns",
  verdict: "verdict",
  actions: "actions",
  dissent: "dissent",
  openquestions: "openQuestions",
  open_questions: "openQuestions",
  chairconfidence: "chairConfidence",
  chair_confidence: "chairConfidence",
  objections: "objections",
  agreements: "agreements",
  vote: "vote",
  revisedconfidence: "revisedConfidence",
  revised_confidence: "revisedConfidence",
  target: "target",
  point: "point",
};

function normalizeKeys(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const folded = key.toLowerCase().replace(/-/g, "_");
    out[KEY_ALIAS[folded] ?? key] = item;
  }
  return out;
}

function proseOutside(text: string): string {
  const stripped = text.replace(/```json|```/gi, " ");
  let out = "";
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === "{") {
      const end = balancedEnd(stripped, i);
      if (end >= 0) {
        i = end;
        continue;
      }
    }
    out += stripped[i] ?? "";
  }
  return clip(out, 700);
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const scaled = value > 0 && value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(100, Math.round(scaled)));
  }
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (!match) return 50;
    const n = Number(match[0]);
    if (!Number.isFinite(n)) return 50;
    const scaled = n > 0 && n <= 1 ? n * 100 : n;
    return Math.max(0, Math.min(100, Math.round(scaled)));
  }
  return 50;
}

function asStrings(value: unknown, maxItems: number, maxLen: number): string[] {
  const list = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  return list
    .map((item) => {
      if (typeof item === "string") return clip(item, maxLen);
      if (item && typeof item === "object" && "text" in item) return clip((item as { text?: unknown }).text, maxLen);
      return "";
    })
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function clipField(value: unknown, max: number): string {
  if (typeof value === "string") return clip(value, max);
  if (Array.isArray(value)) return clip(value.map((item) => clip(item, max)).filter(Boolean).join(" "), max);
  return "";
}

function asSeat(value: unknown): SeatId | null {
  const raw = clip(value, 20).toLowerCase();
  return isSeatId(raw) ? raw : null;
}

function objectionsFrom(value: unknown, self: SeatId): { target: SeatId; point: string }[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const out: { target: SeatId; point: string }[] = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      const match = /^(lens|stacks|pulse)\s*[:\-]\s*(.+)$/i.exec(entry);
      const target = match ? asSeat(match[1]) : null;
      const point = match ? clip(match[2], 180) : "";
      if (!target || target === self || !point) continue;
      out.push({ target, point });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const row = normalizeKeys(entry as Record<string, unknown>);
    const target = asSeat(row.target);
    const point = clipField(row.point, 180);
    if (!target || target === self || !point) continue;
    out.push({ target, point });
  }
  return out.slice(0, 2);
}

async function clearModelCache(): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => /wllama|transformers/i.test(key)).map((key) => caches.delete(key)));
  } catch {
    // the cache is optional
  }
}

function reportDownload(info: Progress, onStatus: (text: string) => void) {
  const loaded = info.loaded ?? 0;
  const total = info.total ?? 0;
  if (total > 0) {
    const pct = Math.min(100, Math.round((loaded / total) * 100));
    onStatus(`Downloading the free model… ${pct}%. About 105 MB, once. This browser keeps it.`);
    return;
  }
  if (loaded > 0) {
    onStatus(`Downloading the free model… ${Math.max(1, Math.round(loaded / 1_000_000))} MB. This browser keeps it.`);
  }
}

async function loadTiny(onStatus: (text: string) => void, useCache: boolean): Promise<TinyPipe> {
  const { Wllama } = await import("@wllama/wllama");
  const wasmUrl = (await import("./wllamaWasm.ts")).default;
  const href = new URL(wasmUrl, window.location.href).href;
  const engine = new Wllama(
    { default: href },
    { suppressNativeLog: true, allowOffline: useCache },
  );
  onStatus("Downloading the free model… About 105 MB, once. This browser keeps it.");
  await engine.loadModelFromHF(
    { repo: MODEL_REPO, file: MODEL_FILE },
    {
      n_ctx: 1024,
      n_batch: 128,
      n_ubatch: 128,
      n_threads: 1,
      n_gpu_layers: 0,
      cache_type_k: "q8_0",
      cache_type_v: "q8_0",
      warmup: false,
      useCache,
      progressCallback: (info) => reportDownload(info, onStatus),
    },
  );
  if (!engine.isModelLoaded()) throw new Error("The model file loaded, but the runtime did not start.");
  return engine;
}

export function cpuFallbackAfterGpuError(error: unknown): boolean {
  const message = errorText(error).toLowerCase();
  if (
    /failed to fetch|networkerror|network error|load failed|failed to load resource|offline|timed out|timeout|404|403|enotfound/.test(
      message,
    )
  ) {
    return false;
  }
  if (message.includes("no reason was given")) return true;
  return /webgpu|gpu|device|shader|adapter|out of memory|oom|f16/.test(message);
}

export function gpuWriteFailed(error: unknown): boolean {
  const message = errorText(error).toLowerCase();
  if (
    /failed to fetch|networkerror|network error|load failed|offline|timed out|timeout|404|403|enotfound/.test(message)
  ) {
    return false;
  }
  if (message.includes("wrote nothing")) return false;
  return true;
}

function blankFailure(error: unknown): boolean {
  const message = errorText(error).toLowerCase();
  if (/failed to fetch|networkerror|network error|offline|timed out|timeout|404|403|enotfound/.test(message)) return false;
  return message.includes("no reason was given");
}

async function ensureTiny(onStatus: (text: string) => void): Promise<TinyPipe> {
  if (model) return model;
  if (!loading) {
    loading = (async () => {
      try {
        return await loadTiny(onStatus, true);
      } catch (error) {
        if (retriedLoad || !blankFailure(error)) throw new Error(errorText(error));
        retriedLoad = true;
        onStatus("The saved copy looked broken. Downloading the free model again…");
        await clearModelCache();
        return await loadTiny(onStatus, false);
      }
    })().then((pipe) => {
      model = pipe;
      loading = null;
      return pipe;
    });
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

const JSON_CUE = "Do not repeat the sample. JSON for the matter above. Start with {";

async function complete(pipe: TinyPipe, system: string, user: string, tokens: number): Promise<string> {
  const room = Math.max(0, 1800 - JSON_CUE.length - 1);
  const content = `${user.slice(0, room)}\n${JSON_CUE}`;
  let text = "";
  try {
    const response = await pipe.createChatCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      max_tokens: tokens,
      temperature: 0,
      top_k: 1,
    });
    text = (response.choices[0]?.message.content ?? "").trim();
  } catch (error) {
    throw new Error(errorText(error));
  }
  if (!text) throw new Error("The model loaded but wrote nothing.");
  return text.slice(0, 1600);
}

async function ask(system: string, user: string, tokens: number, onStatus: (text: string) => void): Promise<string> {
  const pipe = await ensureTiny(onStatus);
  return complete(pipe, system, user, tokens);
}

export function parseGithub(raw: string): { owner: string; repo: string; path?: string } | null {
  try {
    const url = new URL(raw);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0] ?? "";
    const repo = (parts[1] ?? "").replace(/\.git$/, "");
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
    if ((parts[2] === "blob" || parts[2] === "tree") && parts.length > 4) {
      const path = parts.slice(4).join("/");
      if (path.includes("..")) return { owner, repo };
      return { owner, repo, path };
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

async function githubGet(path: string, raw = false): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    signal: AbortSignal.timeout(8_000),
    headers: {
      Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

async function openGithub(owner: string, repo: string, path?: string): Promise<Packet> {
  const base = `/repos/${owner}/${repo}`;
  const repoRes = await githubGet(base);
  if (repoRes.status === 404) {
    return { summary: "That repository is missing or private.", sources: [], tools: [] };
  }
  if (!repoRes.ok) {
    return { summary: `GitHub returned ${repoRes.status}.`, sources: [], tools: [] };
  }
  const meta = (await repoRes.json()) as { description?: string };
  const readmeRes = await githubGet(`${base}/readme`, true);
  const readme = readmeRes.ok ? (await readmeRes.text()).slice(0, 700) : "";
  let file = "";
  const wanted = path && !path.includes("..") ? path : "";
  let picked = wanted;
  if (!picked) {
    const treeRes = await githubGet(`${base}/git/trees/HEAD?recursive=1`);
    if (treeRes.ok) {
      const tree = (await treeRes.json()) as { tree?: { path?: string; type?: string }[] };
      const blobs = (tree.tree ?? [])
        .filter((item) => item.type === "blob" && typeof item.path === "string")
        .map((item) => item.path as string);
      picked =
        blobs.find((item) => /orchestr|agents\.ts|constants\.ts/i.test(item) && !item.includes("node_modules")) ?? "";
    }
  }
  if (picked && !/\.(png|jpg|jpeg|gif|webp|vsix|lock|map)$/i.test(picked)) {
    const fileRes = await githubGet(`${base}/contents/${picked.split("/").map(encodeURIComponent).join("/")}`, true);
    if (fileRes.ok) file = `${picked}\n${(await fileRes.text()).slice(0, 700)}`;
  }
  const summary = [meta.description ?? "", readme, file].filter(Boolean).join("\n").slice(0, 1400);
  return {
    summary: summary || "The repo opened, but there was no readable text.",
    sources: [{ title: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` }],
    tools: [{ name: "read_github", detail: `${owner}/${repo}${picked ? `/${picked}` : ""}` }],
  };
}

async function openWeb(question: string): Promise<Packet> {
  const q = question.replace(/\s+/g, " ").trim().slice(0, 160);
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&utf8=1&format=json&origin=*&srlimit=1`;
  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(8_000) });
  if (!searchRes.ok) {
    return { summary: `Lookup returned ${searchRes.status}.`, sources: [], tools: [{ name: "web_search", detail: "wikipedia" }] };
  }
  const search = (await searchRes.json()) as { query?: { search?: { title?: string; snippet?: string }[] } };
  const hit = search.query?.search?.[0];
  if (!hit?.title) {
    return { summary: "No public page matched that question.", sources: [], tools: [{ name: "web_search", detail: q }] };
  }
  const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(hit.title)}&format=json&origin=*`;
  const pageRes = await fetch(pageUrl, { signal: AbortSignal.timeout(8_000) });
  let extract = (hit.snippet ?? "").replace(/<[^>]+>/g, "");
  if (pageRes.ok) {
    const page = (await pageRes.json()) as { query?: { pages?: Record<string, { extract?: string }> } };
    const first = Object.values(page.query?.pages ?? {})[0];
    if (first?.extract) extract = first.extract;
  }
  const slug = encodeURIComponent(hit.title.replace(/ /g, "_"));
  return {
    summary: extract.slice(0, 1400) || "The page had no readable text.",
    sources: [{ title: hit.title, url: `https://en.wikipedia.org/wiki/${slug}` }],
    tools: [{ name: "web_search", detail: hit.title }],
  };
}

async function openPacket(question: string): Promise<Packet> {
  const link = linksIn(question)[0];
  if (link) {
    const repo = parseGithub(link);
    if (repo) {
      try {
        return await openGithub(repo.owner, repo.repo, repo.path);
      } catch (error) {
        return { summary: errorText(error), sources: [], tools: [] };
      }
    }
  }
  try {
    return await openWeb(question);
  } catch (error) {
    return { summary: errorText(error), sources: [], tools: [] };
  }
}

const SEAT_SYSTEM: Record<SeatId, string> = {
  lens: `You are Lens. What a person misreads. JSON only. No markdown. Each string under 8 words.
{"stance":"Button looks like a title.","answer":"A tired person will not tap it.","claims":["Label is a heading.","No empty state.","Next step is hidden."],"confidence":55,"unknowns":["Which screen."]}`,
  stacks: `You are Stacks. The defect and the smallest fix. JSON only. No markdown. Each string under 8 words.
{"stance":"Null check is missing.","answer":"Guard the empty list.","claims":["Empty list crashes the loop.","Add one guard.","Retest the empty path."],"confidence":55,"unknowns":["Which function."]}`,
  pulse: `You are Pulse. Who is blocked and how urgent. JSON only. No markdown. Each string under 8 words.
{"stance":"The user is stuck.","answer":"They cannot see the next step.","claims":["The user is blocked.","It feels urgent.","Name the next step."],"confidence":55,"unknowns":["Who is blocked."]}`,
};

const CROSS_SYSTEM: Record<SeatId, string> = {
  lens: `You are Lens. JSON only. No markdown. One objection. target and vote are lens, stacks, or pulse.
{"objections":[{"target":"stacks","point":"No defect shown."}],"agreements":["User is blocked."],"vote":"lens","revisedConfidence":50}`,
  stacks: `You are Stacks. JSON only. No markdown. One objection. target and vote are lens, stacks, or pulse.
{"objections":[{"target":"lens","point":"No misread is shown."}],"agreements":["A fix is named."],"vote":"stacks","revisedConfidence":50}`,
  pulse: `You are Pulse. JSON only. No markdown. One objection. target and vote are lens, stacks, or pulse.
{"objections":[{"target":"stacks","point":"A defect is not who is stuck."}],"agreements":["The user is blocked."],"vote":"pulse","revisedConfidence":50}`,
};

const CHAIR_SYSTEM = `You are the Chair. Use only the filed claims. JSON only. No markdown. Each string under 8 words.
{"verdict":"The label blocks the user.","actions":["Rename the control.","Add an empty state."],"dissent":"Stacks wanted a code fix.","openQuestions":["Which screen."],"chairConfidence":55}`;

export function briefFrom(seatId: SeatId, text: string): Brief {
  const json = readObject(text);
  if (!json) {
    const answer = proseOutside(text) || clip(text, 700);
    return {
      seatId,
      status: answer ? "done" : "error",
      stance: answer ? "Unstructured brief." : "",
      answer: answer || "",
      claims: [],
      confidence: answer ? 40 : 0,
      unknowns: answer ? ["Brief was not valid JSON."] : [],
      engine: "browser",
      error: answer ? undefined : "The seat did not answer.",
    };
  }
  const answer = clipField(json.answer, 500) || proseOutside(text) || "No answer filed.";
  return {
    seatId,
    status: "done",
    stance: clipField(json.stance, 220) || "No stance filed.",
    answer,
    claims: asStrings(json.claims, 3, 160),
    confidence: asNumber(json.confidence),
    unknowns: asStrings(json.unknowns, 2, 160),
    engine: "browser",
  };
}

function errorBrief(seatId: SeatId, error: unknown): Brief {
  const message = errorText(error);
  return {
    seatId,
    status: "error",
    stance: "",
    answer: "",
    claims: [],
    confidence: 0,
    unknowns: [],
    engine: "browser",
    error: message.slice(0, 280),
  };
}

export async function runBrowserHearing(opts: {
  question: string;
  mode: HearingMode;
  stopped: () => boolean;
  onStatus: (text: string) => void;
  onPacket: (packet: Packet) => void;
  onBrief: (brief: Brief) => void;
  onNote: (note: CrossNote) => void;
}): Promise<
  | { stopped: true }
  | { stopped: false; packet: Packet; briefs: Brief[]; notes: CrossNote[]; ruling: Ruling; agreement: number | null }
> {
  const links = linksIn(opts.question);
  opts.onStatus(links.length ? "Opening the GitHub repo…" : "No link to open.");
  const packet = await openPacket(opts.question);
  if (opts.stopped()) return { stopped: true };
  opts.onPacket(packet);

  const record = formatPacket(packet);
  const matter = `Matter:\n${opts.question.slice(0, 900)}${record ? `\n\nRecord:\n${record}` : ""}`;
  const briefs: Brief[] = [];

  for (const seat of SEATS) {
    if (opts.stopped()) return { stopped: true };
    opts.onStatus(`${seat.name} is writing…`);
    try {
      const text = await ask(SEAT_SYSTEM[seat.id], matter, 96, opts.onStatus);
      const brief = briefFrom(seat.id, text);
      briefs.push(brief);
      opts.onBrief(brief);
    } catch (error) {
      const brief = errorBrief(seat.id, error);
      briefs.push(brief);
      opts.onBrief(brief);
    }
  }

  if (opts.stopped()) return { stopped: true };
  const usable = briefs.filter((brief) => brief.status === "done");
  if (usable.length === 0) {
    throw new Error(briefs[0]?.error ?? "Every seat failed.");
  }

  const notes: CrossNote[] = [];
  if (opts.mode === "full") {
    for (const brief of usable) {
      if (opts.stopped()) return { stopped: true };
      const seat = seatById(brief.seatId);
      opts.onStatus(`${seat.name} is cross-examining…`);
      const peers = usable.filter((item) => item.seatId !== brief.seatId);
      const peerText = peers
        .map((item) => `${item.seatId}: ${item.claims.join("; ") || item.stance}`)
        .join("\n");
      try {
        const text = await ask(
          CROSS_SYSTEM[brief.seatId],
          `Your claims: ${brief.claims.join("; ")}\nOthers:\n${peerText}`,
          100,
          opts.onStatus,
        );
        const json = readObject(text);
        const vote = asSeat(json?.vote) ?? brief.seatId;
        const note: CrossNote = {
          seatId: brief.seatId,
          status: json ? "done" : "error",
          objections: objectionsFrom(json?.objections, brief.seatId),
          agreements: asStrings(json?.agreements, 2, 160),
          vote,
          revisedConfidence: json ? asNumber(json.revisedConfidence) : 0,
          error: json ? undefined : "Cross-exam was not readable.",
        };
        notes.push(note);
        opts.onNote(note);
      } catch (error) {
        const note: CrossNote = {
          seatId: brief.seatId,
          status: "error",
          objections: [],
          agreements: [],
          vote: brief.seatId,
          revisedConfidence: 0,
          error: errorText(error).slice(0, 200),
        };
        notes.push(note);
        opts.onNote(note);
      }
    }
  }

  if (opts.stopped()) return { stopped: true };
  opts.onStatus("The chair is writing the ruling…");
  const agreement = agreementScore(briefs, notes);
  const filed = usable
    .map((brief) => `${brief.seatId} (${brief.confidence}): ${brief.claims.join("; ") || brief.answer}`)
    .join("\n");
  let ruling: Ruling;
  try {
    const text = await ask(
      CHAIR_SYSTEM,
      `${matter.slice(0, 900)}\n\n${agreement === null ? "Agreement was not measured." : `Agreement ${agreement}%.`}\n${filed}`,
      96,
      opts.onStatus,
    );
    const json = readObject(text);
    ruling = json
      ? {
          verdict: clipField(json.verdict, 600) || proseOutside(text) || "The chair did not file a verdict.",
          actions: asStrings(json.actions, 3, 180),
          dissent: clipField(json.dissent, 300),
          openQuestions: asStrings(json.openQuestions, 2, 180),
          chairConfidence: asNumber(json.chairConfidence),
        }
      : {
          verdict: clip(text, 600) || "The ruling could not be read.",
          actions: [],
          dissent: "The ruling was unstructured.",
          openQuestions: [],
          chairConfidence: 40,
        };
  } catch (error) {
    ruling = {
      verdict: errorText(error),
      actions: ["Press Convene again."],
      dissent: "",
      openQuestions: [],
      chairConfidence: 0,
    };
  }
  return { stopped: false, packet, briefs, notes, ruling, agreement };
}
