import { useEffect, useRef, useState } from "react";
import { Eye, Gavel, HeartPulse, Library, Square } from "lucide-react";
import { Mascot } from "page-mascot";
import { runBrowserHearing } from "@/lib/council/browserHearing";
import {
  type Brief,
  type CrossNote,
  type Docket,
  type HearingMode,
  type Packet,
  type Ruling,
  type SeatId,
  SEATS,
  linksIn,
  seatById,
  toolLabel,
  toMarkdown,
} from "@/lib/council/protocol";

const HISTORY_KEY = "llmcouncil.docket.v1";

const PRESETS = [
  {
    label: "LLMcouncil repo",
    text: "Read https://github.com/veeresh-bikkaneti/LLMcouncil and name the orchestration bugs worth fixing first. Do not tell me to install anything.",
  },
  {
    label: "Greyed-out login",
    text: "The login button is greyed out and I can't access my account. I reset my password twice. Chrome, latest. There is no error message.",
  },
  {
    label: "Ship or wait",
    text: "We can ship the council panel this week with one model wearing three hats, or wait two weeks to call three providers. Traffic is internal only. What should we do?",
  },
] as const;

const ICONS = {
  lens: Eye,
  stacks: Library,
  pulse: HeartPulse,
} as const;

type Phase = "idle" | "sources" | "sealed" | "cross" | "ruling" | "done";

type Session = {
  phase: Phase;
  mode: HearingMode;
  question: string;
  briefs: Partial<Record<SeatId, Brief>>;
  notes: Partial<Record<SeatId, CrossNote>>;
  ruling: Ruling | null;
  agreement: number | null;
  packet: Packet | null;
  error: string | null;
  at: number | null;
};

const EMPTY: Session = {
  phase: "idle",
  mode: "quick",
  question: "",
  briefs: {},
  notes: {},
  ruling: null,
  agreement: null,
  packet: null,
  error: null,
  at: null,
};

function loadHistory(): Docket[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Docket[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveHistory(docket: Docket) {
  const next = [docket, ...loadHistory().filter((item) => item.id !== docket.id)].slice(0, 6);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function Chamber() {
  const [draft, setDraft] = useState<string>(PRESETS[0].text);
  const [mode, setMode] = useState<HearingMode>("quick");
  const [session, setSession] = useState<Session>(EMPTY);
  const [history, setHistory] = useState<Docket[]>([]);
  const [live, setLive] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const running =
    session.phase === "sources" ||
    session.phase === "sealed" ||
    session.phase === "cross" ||
    session.phase === "ruling";

  async function convene(nextMode: HearingMode) {
    const question = draft.trim();
    if (question.length < 8 || running) return;
    stopRef.current = false;
    setViewingRecord(false);
    setLive(null);
    setMode(nextMode);
    const openLinks = linksIn(question).length > 0;
    setSession({
      ...EMPTY,
      phase: openLinks ? "sources" : "sealed",
      mode: nextMode,
      question,
    });

    try {
      const result = await runBrowserHearing({
        question,
        mode: nextMode,
        stopped: () => stopRef.current,
        onStatus: (text) => {
          setLive(text);
          if (text.startsWith("Lens") || text.startsWith("Stacks") || text.startsWith("Pulse") || text.startsWith("Loading") || text.startsWith("Small model") || text.startsWith("This GPU")) {
            setSession((current) => ({ ...current, phase: text.includes("cross-examining") ? "cross" : "sealed" }));
          }
          if (text.startsWith("The chair")) {
            setSession((current) => ({ ...current, phase: "ruling" }));
          }
        },
        onPacket: (packet) => {
          setSession((current) => ({ ...current, phase: "sealed", packet }));
        },
        onBrief: (brief) => {
          setSession((current) => ({
            ...current,
            phase: "sealed",
            briefs: { ...current.briefs, [brief.seatId]: brief },
          }));
        },
        onNote: (note) => {
          setSession((current) => ({
            ...current,
            phase: "cross",
            notes: { ...current.notes, [note.seatId]: note },
          }));
        },
      });
      if (result.stopped || stopRef.current) {
        setLive(null);
        setSession((current) => ({ ...current, phase: "idle" }));
        return;
      }
      const docket: Docket = {
        id: `docket-${Date.now()}`,
        at: Date.now(),
        question,
        mode: nextMode,
        briefs: result.briefs,
        notes: result.notes,
        ruling: result.ruling,
        agreement: result.agreement,
        packet: result.packet,
      };
      setHistory(saveHistory(docket));
      setLive(null);
      setSession({
        phase: "done",
        mode: nextMode,
        question,
        briefs: Object.fromEntries(result.briefs.map((brief) => [brief.seatId, brief])),
        notes: Object.fromEntries(result.notes.map((note) => [note.seatId, note])),
        ruling: result.ruling,
        agreement: result.agreement,
        packet: result.packet,
        error: null,
        at: docket.at,
      });
    } catch (error) {
      setLive(null);
      setSession((current) => ({
        ...current,
        phase: "idle",
        error: error instanceof Error ? error.message : "The hearing stopped.",
      }));
    }
  }

  function stop() {
    stopRef.current = true;
  }

  function openRecord(docket: Docket) {
    setViewingRecord(true);
    setDraft(docket.question);
    setMode(docket.mode);
    setSession({
      phase: "done",
      mode: docket.mode,
      question: docket.question,
      briefs: Object.fromEntries(docket.briefs.map((brief) => [brief.seatId, brief])),
      notes: Object.fromEntries(docket.notes.map((note) => [note.seatId, note])),
      ruling: docket.ruling,
      agreement: docket.agreement,
      packet: docket.packet ?? null,
      error: null,
      at: docket.at,
    });
  }

  function download() {
    if (!session.ruling || !session.at) return;
    const docket: Docket = {
      id: "export",
      at: session.at,
      question: session.question,
      mode: session.mode,
      briefs: SEATS.map((seat) => session.briefs[seat.id]).filter((brief): brief is Brief => !!brief),
      notes: SEATS.map((seat) => session.notes[seat.id]).filter((note): note is CrossNote => !!note),
      ruling: session.ruling,
      agreement: session.agreement,
      packet: session.packet,
    };
    const blob = new Blob([toMarkdown(docket)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "llm-council.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  const phaseIndex = session.phase === "sealed" ? 0 : session.phase === "cross" ? 1 : session.phase === "ruling" || session.phase === "done" ? 2 : -1;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="rise d1 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="font-mono text-xs tracking-[0.22em] text-accent uppercase">Hearing room</p>
          <h1 className="mt-2 text-balance font-display text-5xl leading-none font-semibold text-fg sm:text-6xl">
            <span className="mr-3 font-mono text-sm font-normal tracking-[0.18em] text-muted">LLM</span>
            <span className="italic">Council</span>
          </h1>
          <p className="mt-4 max-w-lg text-pretty text-lg text-muted">
            Paste a GitHub link. No key. A small model runs in this browser.
          </p>
          <p className="mt-2 max-w-lg font-mono text-xs tracking-wide text-muted">
            It loads the first time you convene, then stays cached and loaded while this tab is open.
          </p>
        </div>
        <Mascot
          directions={`${import.meta.env.BASE_URL}mascots/owl-directions.webp`}
          reactions={`${import.meta.env.BASE_URL}mascots/owl-reactions.webp`}
          size={168}
          label="Council clerk"
          className="shrink-0"
        />
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <section className="rise d2 rounded-card border border-line bg-surface p-4 sm:p-5">
          <label htmlFor="matter" className="font-mono text-xs tracking-[0.16em] text-muted uppercase">
            GitHub link or question
          </label>
          <textarea
            id="matter"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={8}
            maxLength={4000}
            disabled={running}
            placeholder="https://github.com/you/repo — or a question in plain words"
            className="mt-3 w-full resize-y rounded-xl border border-line bg-bg px-3 py-3 text-base text-fg outline-none transition placeholder:text-muted/70 focus:border-accent disabled:opacity-60"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                disabled={running}
                onClick={() => setDraft(preset.text)}
                className="min-h-11 rounded-full border border-line px-3 text-sm text-muted transition hover:border-accent hover:text-fg active:scale-[0.96] disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <button
              type="button"
              disabled={running || draft.trim().length < 8}
              onClick={() => void convene("quick")}
              className="min-h-11 rounded-xl bg-accent px-4 text-base font-semibold text-ink transition active:scale-[0.96] disabled:opacity-50"
            >
              Convene
            </button>
            <button
              type="button"
              disabled={running || draft.trim().length < 8}
              onClick={() => void convene("full")}
              className="min-h-11 rounded-xl border border-accent px-4 text-base text-fg transition hover:bg-raised active:scale-[0.96] disabled:opacity-50"
            >
              Full hearing
            </button>
          </div>
          <p className="mt-3 text-sm text-pretty text-muted">
            The repo is opened in the browser. Seats share one small model. Full hearing is slower. Nothing runs until you press.
          </p>
          {live ? (
            <p className="mt-3 text-sm text-accent" role="status">
              {live}
            </p>
          ) : null}
          {running ? (
            <button
              type="button"
              onClick={stop}
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-accent"
            >
              <Square className="size-3.5 fill-current" aria-hidden />
              Stop before the next phase
            </button>
          ) : null}
          {session.error ? (
            <p className="mt-3 text-sm text-accent" role="alert">
              {session.error}
            </p>
          ) : null}
        </section>

        <section className="flex min-w-0 flex-col gap-4" aria-live="polite">
          <ol className="rise d3 grid grid-cols-3 gap-2">
            {[
              { n: "01", label: "Sealed" },
              { n: "02", label: session.mode === "quick" && phaseIndex >= 2 ? "Skipped" : "Cross-exam" },
              { n: "03", label: "Ruling" },
            ].map((step, index) => {
              const active = phaseIndex === index;
              const done = phaseIndex > index;
              return (
                <li
                  key={step.n}
                  className={
                    "rounded-xl border px-3 py-3 " +
                    (active
                      ? "border-accent bg-surface"
                      : done
                        ? "border-line bg-surface"
                        : "border-line/70 bg-transparent")
                  }
                >
                  <p className="font-mono text-xs text-accent tabular-nums">{step.n}</p>
                  <p className={"mt-1 text-sm " + (active || done ? "text-fg" : "text-muted")}>{step.label}</p>
                </li>
              );
            })}
          </ol>

          {session.phase === "sources" ? (
            <p className="thinking rounded-card border border-line bg-surface px-5 py-6 text-fg">
              {live ?? "Opening the repo."}
            </p>
          ) : session.packet && (session.packet.summary || session.packet.tools.length > 0) ? (
            <article className="rounded-card border border-line bg-surface p-4">
              <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">Clerk</p>
              {session.packet.summary ? (
                <p className="mt-2 text-sm text-pretty text-fg">{session.packet.summary}</p>
              ) : null}
              {session.packet.tools.length > 0 ? (
                <ul className="mt-3 space-y-1 font-mono text-xs text-muted">
                  {session.packet.tools.map((tool) => (
                    <li key={`${tool.name}-${tool.detail}`}>{toolLabel(tool)}</li>
                  ))}
                </ul>
              ) : null}
              {session.packet.sources.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {session.packet.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        {source.title || source.url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {SEATS.map((seat, index) => (
              <SeatCard
                key={seat.id}
                seatId={seat.id}
                delay={index}
                brief={session.briefs[seat.id]}
                note={session.notes[seat.id]}
                thinking={
                  (session.phase === "sealed" && !session.briefs[seat.id]) ||
                  (session.phase === "cross" &&
                    session.briefs[seat.id]?.status === "done" &&
                    !session.notes[seat.id])
                }
              />
            ))}
          </div>

          {session.ruling ? (
            <RulingSheet
              ruling={session.ruling}
              agreement={session.agreement}
              onRecord={viewingRecord}
              onDownload={download}
            />
          ) : session.phase === "ruling" ? (
            <p className="thinking rounded-card border border-line bg-surface px-5 py-6 font-display text-xl italic text-muted">
              The chair is reading only what was filed.
            </p>
          ) : null}
        </section>
      </div>

      {history.length > 0 ? (
        <section className="rise d4 mt-10">
          <h2 className="font-mono text-xs tracking-[0.16em] text-muted uppercase">On the record</h2>
          <ul className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {history.map((docket) => (
              <li key={docket.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => openRecord(docket)}
                  className="min-h-11 max-w-64 rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:border-accent active:scale-[0.96]"
                >
                  <p className="truncate text-sm text-fg">{docket.question}</p>
                  <p className="mt-1 font-mono text-xs text-muted tabular-nums">
                    {docket.mode === "full" ? "Full" : "Quick"}
                    {docket.agreement === null ? "" : ` · ${docket.agreement}%`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function SeatCard({
  seatId,
  brief,
  note,
  thinking,
  delay,
}: {
  seatId: SeatId;
  brief?: Brief;
  note?: CrossNote;
  thinking: boolean;
  delay: number;
}) {
  const seat = seatById(seatId);
  const Icon = ICONS[seatId];
  return (
    <article
      className={
        "rise rounded-card flex min-h-52 flex-col border border-line bg-surface p-4 " +
        (thinking ? "thinking " : "") +
        (delay === 0 ? "d2" : delay === 1 ? "d3" : "d4")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.16em] text-accent uppercase">{seat.office}</p>
          <h2 className="font-display text-2xl leading-tight font-semibold text-fg">{seat.name}</h2>
          <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">In this tab</p>
        </div>
        <Icon className="size-5 text-muted" aria-hidden />
      </div>
      {!brief ? (
        <p className="mt-4 text-sm text-pretty text-muted">{seat.mandate}</p>
      ) : brief.status === "error" ? (
        <p className="mt-4 text-sm text-accent">{brief.error}</p>
      ) : (
        <div className="mt-4 flex flex-1 flex-col gap-3">
          <p className="font-display text-base text-pretty text-fg italic">{brief.stance}</p>
          <p className="text-sm text-pretty text-muted">{brief.answer}</p>
          {brief.claims.length > 0 ? (
            <ol className="space-y-1.5 text-sm text-fg">
              {brief.claims.map((claim) => (
                <li key={claim} className="border-l border-accent pl-2">
                  {claim}
                </li>
              ))}
            </ol>
          ) : null}
          <p className="mt-auto font-mono text-xs text-muted tabular-nums">Confidence {brief.confidence}</p>
          {brief.tools && brief.tools.length > 0 ? (
            <ul className="space-y-1 font-mono text-xs text-muted">
              {brief.tools.map((tool) => (
                <li key={`${tool.name}-${tool.detail}`}>{toolLabel(tool)}</li>
              ))}
            </ul>
          ) : null}
          {note?.status === "done" ? (
            <p className="text-sm text-muted">
              Votes <span className="text-fg">{seatById(note.vote).name}</span>
              {note.objections.length > 0
                ? ` · objects to ${note.objections.map((item) => seatById(item.target).name).join(", ")}`
                : ""}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}

function RulingSheet({
  ruling,
  agreement,
  onRecord,
  onDownload,
}: {
  ruling: Ruling;
  agreement: number | null;
  onRecord: boolean;
  onDownload: () => void;
}) {
  return (
    <article className="rise rounded-card bg-paper p-5 text-ink sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Gavel className="size-5" aria-hidden />
          <h2 className="font-display text-3xl italic font-semibold">Ruling</h2>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="min-h-11 rounded-full border border-ink/20 px-4 text-sm transition hover:bg-ink/5 active:scale-[0.96]"
        >
          Save markdown
        </button>
      </div>
      {onRecord ? (
        <p className="mt-2 font-mono text-xs tracking-[0.14em] uppercase opacity-70">From the record</p>
      ) : null}
      <p className="mt-4 text-pretty text-lg leading-relaxed">{ruling.verdict}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div>
          <p className="font-mono text-xs tracking-[0.14em] uppercase opacity-70">Agreement</p>
          <p className="font-display text-4xl font-semibold tabular-nums">
            {agreement === null ? "—" : agreement}
            {agreement === null ? null : <span className="text-xl">%</span>}
          </p>
        </div>
        <div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${agreement ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-sm leading-relaxed opacity-80">
            Shared wording across claims
            {agreement === null ? " needs two filed briefs" : ""}. Not a count of seats that replied. Chair’s own
            confidence is {ruling.chairConfidence}.
          </p>
        </div>
      </div>

      {ruling.actions.length > 0 ? (
        <ol className="mt-6 space-y-2">
          {ruling.actions.map((action, index) => (
            <li key={action} className="flex gap-3 text-base">
              <span className="font-mono text-sm tabular-nums opacity-60">{index + 1}</span>
              <span>{action}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-6 border-t border-ink/15 pt-4">
        <p className="font-mono text-xs tracking-[0.14em] uppercase opacity-70">Dissent kept</p>
        <p className="mt-2 text-pretty">{ruling.dissent}</p>
        {ruling.openQuestions.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm opacity-80">
            {ruling.openQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
