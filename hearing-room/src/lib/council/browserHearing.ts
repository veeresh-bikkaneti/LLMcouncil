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

const MODEL = "onnx-community/SmolLM2-360M-Instruct-ONNX";

type Ids = {
  dims: number[];
  slice: (...parts: Array<number | [number | null, number | null] | null>) => Ids;
};

type TinyPipe = {
  tokenizer: {
    (text: string, options: { add_special_tokens: boolean; padding: boolean; truncation: boolean }): {
      input_ids: Ids;
      attention_mask?: unknown;
    };
    apply_chat_template: (
      messages: { role: string; content: string }[],
      options: { tokenize: false; add_generation_prompt: boolean },
    ) => string;
    batch_decode: (ids: Ids, options: { skip_special_tokens: boolean }) => string[];
  };
  model: {
    generate: (inputs: Record<string, unknown>) => Promise<Ids | { sequences: Ids }>;
  };
};

type Progress = {
  status?: string;
  file?: string;
  name?: string;
  loaded?: number;
  total?: number;
};

let model: TinyPipe | null = null;
let loading: Promise<TinyPipe> | null = null;

export function tinyIsWarm(): boolean {
  return model != null;
}

/** Keep only the new words. Special tokens are already gone in a normal decode. */
export function completionFrom(full: string, prompt: string): string {
  const bare = (value: string) => value.replace(/<\|im_start\|>/g, "").replace(/<\|im_end\|>/g, "").trim();
  const decoded = bare(full);
  const cue = bare(prompt);
  if (!decoded || !cue || !decoded.startsWith(cue)) return "";
  return decoded.slice(cue.length).trim();
}

function asIds(output: Ids | { sequences: Ids }): Ids {
  if (output && typeof output === "object" && "sequences" in output) return output.sequences;
  return output;
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

async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu || !("requestAdapter" in gpu)) return false;
  try {
    return (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}

async function loadTiny(onStatus: (text: string) => void, device: "webgpu" | "wasm", dtype: "q4f16" | "q4"): Promise<TinyPipe> {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  const wasm = env.backends.onnx.wasm as { numThreads?: number };
  wasm.numThreads = 1;
  const files = new Map<string, { loaded: number; total: number }>();
  const pipe = await pipeline("text-generation", MODEL, {
    device,
    dtype,
    progress_callback: (info: Progress) => {
      if (info.status !== "progress") return;
      const file = info.file || info.name;
      if (!file || !info.total) return;
      files.set(file, { loaded: info.loaded ?? 0, total: info.total });
      let loaded = 0;
      let total = 0;
      for (const item of files.values()) {
        loaded += item.loaded;
        total += item.total;
      }
      const pct = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      onStatus(`Loading the small model… ${pct}%. It stays cached in this browser.`);
    },
  });
  return pipe as unknown as TinyPipe;
}

export function cpuFallbackAfterGpuError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (
    /failed to fetch|networkerror|network error|load failed|failed to load resource|offline|timed out|timeout|404|403|enotfound/.test(
      message,
    )
  ) {
    return false;
  }
  return /webgpu|gpu|device|shader|adapter|out of memory|oom|f16/.test(message);
}

async function ensureTiny(onStatus: (text: string) => void): Promise<TinyPipe> {
  if (model) {
    onStatus("Small model is already loaded in this tab.");
    return model;
  }
  if (!loading) {
    loading = (async () => {
      const gpu = await hasWebGpu();
      try {
        return await loadTiny(onStatus, gpu ? "webgpu" : "wasm", gpu ? "q4f16" : "q4");
      } catch (error) {
        if (!gpu || !cpuFallbackAfterGpuError(error)) throw error;
        onStatus("This GPU could not start the model. Loading the CPU copy…");
        return await loadTiny(onStatus, "wasm", "q4");
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

async function ask(system: string, user: string, tokens: number, onStatus: (text: string) => void): Promise<string> {
  const pipe = await ensureTiny(onStatus);
  const room = Math.max(0, 1800 - JSON_CUE.length - 1);
  const content = `${user.slice(0, room)}\n${JSON_CUE}`;
  const prompt = pipe.tokenizer.apply_chat_template(
    [
      { role: "system", content: system },
      { role: "user", content },
    ],
    { tokenize: false, add_generation_prompt: true },
  );
  const encoded = pipe.tokenizer(prompt, {
    add_special_tokens: false,
    padding: true,
    truncation: true,
  });
  const promptLen = encoded.input_ids.dims.at(-1) ?? 0;
  const sequences = asIds(
    await pipe.model.generate({
      ...encoded,
      max_new_tokens: tokens,
      do_sample: false,
    }),
  );
  const seqLen = sequences.dims.at(-1) ?? 0;
  const fresh = promptLen > 0 && promptLen < seqLen ? sequences.slice(null, [promptLen, null]) : sequences;
  let text = pipe.tokenizer.batch_decode(fresh, { skip_special_tokens: true }).join("").trim();
  if (!text) {
    const whole = pipe.tokenizer.batch_decode(sequences, { skip_special_tokens: true }).join("");
    text = completionFrom(whole, prompt);
  }
  if (!text) throw new Error("The model loaded but wrote nothing. Press Convene again.");
  return text.slice(0, 1600);
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

async function openPacket(question: string): Promise<Packet> {
  const link = linksIn(question)[0];
  if (!link) return { summary: "", sources: [], tools: [] };
  const repo = parseGithub(link);
  if (!repo) {
    return {
      summary: "Only a public GitHub link is opened in the browser. Other sites stay closed.",
      sources: [],
      tools: [],
    };
  }
  try {
    return await openGithub(repo.owner, repo.repo, repo.path);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The repo did not open.";
    return { summary: message, sources: [], tools: [] };
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
  const message = error instanceof Error ? error.message : "The seat did not answer.";
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
          error: error instanceof Error ? error.message.slice(0, 200) : "Cross-exam failed.",
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
      verdict: error instanceof Error ? error.message : "The chair did not answer.",
      actions: ["Press Convene again."],
      dissent: "",
      openQuestions: [],
      chairConfidence: 0,
    };
  }
  return { stopped: false, packet, briefs, notes, ruling, agreement };
}
