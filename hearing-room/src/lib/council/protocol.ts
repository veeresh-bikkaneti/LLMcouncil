export const SEAT_IDS = ["lens", "stacks", "pulse"] as const;
export type SeatId = (typeof SEAT_IDS)[number];

export type HearingMode = "quick" | "full";

export type Seat = {
  id: SeatId;
  name: string;
  office: string;
  mandate: string;
  temperature: number;
};

export const SEATS: Seat[] = [
  {
    id: "lens",
    name: "Lens",
    office: "Vision",
    mandate: "What a person sees, taps, and misreads.",
    temperature: 0.45,
  },
  {
    id: "stacks",
    name: "Stacks",
    office: "Librarian",
    mandate: "Opens the repo or the page, searches once if a fact is missing.",
    temperature: 0.15,
  },
  {
    id: "pulse",
    name: "Pulse",
    office: "Empathy",
    mandate: "Who is stuck, how urgent it feels, what would help.",
    temperature: 0.8,
  },
];

export type ToolName = "web_search" | "read_page" | "read_github";

export type ToolUse = {
  name: ToolName;
  detail: string;
};

export type SourceRef = {
  title: string;
  url: string;
};

export type Packet = {
  summary: string;
  sources: SourceRef[];
  tools: ToolUse[];
};

export type Brief = {
  seatId: SeatId;
  status: "done" | "error";
  stance: string;
  answer: string;
  claims: string[];
  confidence: number;
  unknowns: string[];
  tools?: ToolUse[];
  engine?: "browser" | "chrome" | "hosted";
  error?: string;
};

export type Objection = {
  target: SeatId;
  point: string;
};

export type CrossNote = {
  seatId: SeatId;
  status: "done" | "error";
  objections: Objection[];
  agreements: string[];
  vote: SeatId;
  revisedConfidence: number;
  error?: string;
};

export type Ruling = {
  verdict: string;
  actions: string[];
  dissent: string;
  openQuestions: string[];
  chairConfidence: number;
};

export type Docket = {
  id: string;
  at: number;
  question: string;
  mode: HearingMode;
  briefs: Brief[];
  notes: CrossNote[];
  ruling: Ruling;
  agreement: number | null;
  packet?: Packet | null;
};

const STOP = new Set([
  "that", "this", "with", "from", "have", "they", "their", "them", "what",
  "when", "where", "which", "would", "could", "should", "about", "into",
  "your", "than", "then", "been", "were", "will", "just", "also", "only",
  "user", "users", "page", "code",
]);

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (word.length > 3 && !STOP.has(word)) out.add(word);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const token of a) if (b.has(token)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function linksIn(text: string): string[] {
  const found = text.match(/https:\/\/[^\s<>"']+/g) ?? [];
  return [...new Set(found.map((link) => link.replace(/[),.;]+$/, "")))].slice(0, 3);
}

export function formatPacket(packet: Packet): string {
  const lines = [packet.summary];
  if (packet.sources.length > 0) {
    lines.push("Sources:");
    for (const source of packet.sources) lines.push(`- ${source.title} ${source.url}`);
  }
  return lines.filter(Boolean).join("\n").slice(0, 6000);
}

export function toolLabel(tool: ToolUse): string {
  if (tool.name === "web_search") return `Searched · ${tool.detail}`;
  if (tool.name === "read_github") return `Read repo · ${tool.detail}`;
  return `Opened · ${tool.detail}`;
}

export function seatById(id: SeatId): Seat {
  const seat = SEATS.find((item) => item.id === id);
  if (!seat) throw new Error(`Unknown seat ${id}`);
  return seat;
}

export function isSeatId(value: string): value is SeatId {
  return (SEAT_IDS as readonly string[]).includes(value);
}

/** Agreement from shared claim wording, not from how many seats stayed up. */
export function agreementScore(briefs: Brief[], notes: CrossNote[]): number | null {
  const done = briefs.filter((brief) => brief.status === "done" && brief.claims.length > 0);
  if (done.length < 2) return null;

  const bags = done.map((brief) => tokens(brief.claims.join(" ")));
  let pairs = 0;
  let sum = 0;
  for (let i = 0; i < bags.length; i++) {
    for (let j = i + 1; j < bags.length; j++) {
      sum += jaccard(bags[i]!, bags[j]!);
      pairs++;
    }
  }
  const overlap = pairs === 0 ? 0 : sum / pairs;

  const votes = notes.filter((note) => note.status === "done");
  let voteShare = overlap;
  if (votes.length > 0) {
    const counts = new Map<string, number>();
    for (const note of votes) counts.set(note.vote, (counts.get(note.vote) ?? 0) + 1);
    voteShare = Math.max(...counts.values()) / votes.length;
  }

  const objections = votes.reduce((n, note) => n + note.objections.length, 0);
  const drag = Math.min(0.12, objections * 0.02);
  const blended = votes.length > 0 ? overlap * 0.7 + voteShare * 0.3 - drag : overlap;
  return Math.max(0, Math.min(100, Math.round(blended * 100)));
}

export function toMarkdown(docket: Docket): string {
  const when = new Date(docket.at).toLocaleString();
  const lines = [
    `# LLM Council`,
    ``,
    `**When:** ${when}`,
    `**Hearing:** ${docket.mode === "full" ? "Full" : "Quick"}`,
    `**Agreement:** ${docket.agreement === null ? "not measured (fewer than two briefs)" : `${docket.agreement}% claim overlap`}`,
    ``,
    `## Matter`,
    ``,
    docket.question,
    ``,
  ];

  if (docket.packet && (docket.packet.summary || docket.packet.tools.length > 0)) {
    lines.push(`## Clerk`, ``);
    if (docket.packet.summary) lines.push(docket.packet.summary, ``);
    for (const tool of docket.packet.tools) lines.push(`- ${toolLabel(tool)}`);
    for (const source of docket.packet.sources) lines.push(`- ${source.title}: ${source.url}`);
    lines.push(``);
  }

  for (const brief of docket.briefs) {
    const seat = seatById(brief.seatId);
    lines.push(`## ${seat.name} · ${seat.office}`, ``);
    if (brief.status === "error") {
      lines.push(`Seat failed: ${brief.error ?? "unknown"}`, ``);
      continue;
    }
    lines.push(brief.stance, ``, brief.answer, ``);
    if (brief.tools && brief.tools.length > 0) {
      lines.push(`Tools:`, ``);
      for (const tool of brief.tools) lines.push(`- ${toolLabel(tool)}`);
      lines.push(``);
    }
    lines.push(`Claims:`, ``);
    for (const claim of brief.claims) lines.push(`- ${claim}`);
    lines.push(``, `Confidence: ${brief.confidence}`, ``);
  }

  if (docket.notes.length > 0) {
    lines.push(`## Cross-examination`, ``);
    for (const note of docket.notes) {
      const seat = seatById(note.seatId);
      if (note.status === "error") {
        lines.push(`- ${seat.name} did not cross-examine: ${note.error ?? "unknown"}`);
        continue;
      }
      lines.push(`- ${seat.name} votes for ${seatById(note.vote).name}`);
      for (const objection of note.objections) {
        lines.push(`  - Objects to ${seatById(objection.target).name}: ${objection.point}`);
      }
    }
    lines.push(``);
  }

  lines.push(
    `## Ruling`,
    ``,
    docket.ruling.verdict,
    ``,
    `Chair confidence: ${docket.ruling.chairConfidence}`,
    ``,
    `### Actions`,
    ``,
  );
  docket.ruling.actions.forEach((action, index) => {
    lines.push(`${index + 1}. ${action}`);
  });
  lines.push(``, `### Dissent`, ``, docket.ruling.dissent, ``);
  if (docket.ruling.openQuestions.length > 0) {
    lines.push(`### Still open`, ``);
    for (const question of docket.ruling.openQuestions) lines.push(`- ${question}`);
    lines.push(``);
  }
  return lines.join("\n");
}
