import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OpenAICompatBackend } from './lib/backends/openai';
import { AbortedError, type Backend } from './lib/backends/types';
import { WebLLMBackend, hasWebGPU } from './lib/backends/webllm';
import { runCouncil, runQuick, type Seat } from './lib/council';
import { sanitizePII } from './lib/pii';
import { PERSONAS } from './lib/prompts';
import { searchWikipedia, type Source } from './lib/search';
import { useSettings, type Mode } from './lib/settings';
import { SeatCard } from './components/SeatCard';
import { SettingsDialog, type ServerState } from './components/SettingsDialog';

const IDLE: Seat = { status: 'idle', text: '' };
const emptyMembers = (): Record<string, Seat> => Object.fromEntries(PERSONAS.map((p) => [p.id, IDLE]));

// One engine for the whole page: loading weights is the expensive part.
const browserBackend = new WebLLMBackend();

export default function App() {
  const [settings, update] = useSettings();
  const [server, setServer] = useState<ServerState>({ status: 'checking' });
  const [question, setQuestion] = useState('');
  const [running, setRunning] = useState(false);
  const [members, setMembers] = useState(emptyMembers);
  const [chair, setChair] = useState<Seat>(IDLE);
  const [sources, setSources] = useState<Source[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ text: string; fraction?: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const backend: Backend = useMemo(
    () => (settings.backend === 'server' ? new OpenAICompatBackend(settings.serverUrl) : browserBackend),
    [settings.backend, settings.serverUrl]
  );
  const model = settings.backend === 'server' ? settings.serverModel : settings.browserModel;

  const recheck = useCallback(() => {
    if (settings.backend !== 'server') return;
    const ac = new AbortController();
    setServer({ status: 'checking' });
    backend
      .listModels(ac.signal)
      .then((models) => {
        setServer({ status: 'ok', models });
        if (models.length && !models.includes(settings.serverModel)) update({ serverModel: models[0] });
      })
      .catch(() => !ac.signal.aborted && setServer({ status: 'down' }));
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, settings.backend]);

  useEffect(() => recheck(), [recheck]);

  const ask = async () => {
    const q = question.trim();
    if (!q || running) return;
    if (!model) {
      setNotice('Pick a model first (Settings).');
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true);
    setNotice(null);
    setMembers(emptyMembers());
    setChair(IDLE);
    setSources([]);
    setProgress(null);

    try {
      let found: Source[] = [];
      if (settings.grounding) {
        try {
          found = await searchWikipedia(sanitizePII(q), ac.signal);
          setSources(found);
        } catch (e) {
          if (ac.signal.aborted) throw new AbortedError();
          setNotice('Wikipedia lookup failed, answering without sources.');
        }
      }
      const events = {
        onProgress: (text: string, fraction?: number) => setProgress(fraction !== undefined && fraction >= 1 ? null : { text, fraction }),
        onChair: setChair,
        onMember: (p: { id: string }, seat: Seat) => setMembers((m) => ({ ...m, [p.id]: seat })),
      };
      const run = { backend, model, question: q, sources: found, signal: ac.signal };
      const result = settings.mode === 'quick' ? await runQuick(run, events) : (await runCouncil(run, events)).chair;
      if (result.status === 'error') setNotice(result.error ?? 'Something went wrong.');
    } catch (e) {
      if (!(e instanceof AbortedError)) setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      // A stopped run leaves its partial text, but nothing may keep looking busy.
      const settle = (s: Seat): Seat => (s.status === 'working' ? { ...s, status: 'idle' } : s);
      setMembers((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, settle(v)])));
      setChair(settle);
      setProgress(null);
      setRunning(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const setMode = (mode: Mode) => !running && update({ mode });
  const notReady = settings.backend === 'server' && server.status === 'down';

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">LLM Council</h1>
          <p className="text-sm text-zinc-500">Several perspectives, one answer. Runs on your machine.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Mode" className="flex rounded-lg border border-zinc-300 p-0.5 text-sm dark:border-zinc-700">
            {(['quick', 'council'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={settings.mode === m}
                disabled={running}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 capitalize disabled:opacity-50 ${
                  settings.mode === m ? 'bg-violet-600 text-white' : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Settings
          </button>
        </div>
      </header>

      <p className="flex items-center gap-2 text-xs text-zinc-500" role="status">
        <span className={`size-2 rounded-full ${notReady ? 'bg-rose-500' : server.status === 'checking' && settings.backend === 'server' ? 'bg-amber-400' : 'bg-emerald-500'}`} aria-hidden />
        {settings.backend === 'server' ? (notReady ? 'Local server not found' : `Local server · ${model || 'no model'}`) : `In-browser · ${model}${hasWebGPU() ? '' : ' (no WebGPU in this browser)'}`}
      </p>

      {notReady && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-medium">No local model server found at {settings.serverUrl}.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Install <a className="underline" href="https://ollama.com/download" target="_blank" rel="noreferrer">Ollama</a> and run{' '}
              <code>ollama pull llama3.2</code>
            </li>
            <li>Reload this page — it connects automatically.</li>
          </ol>
          <p className="mt-2">
            No install?{' '}
            <button type="button" className="underline" onClick={() => update({ backend: 'browser' })}>
              Use an in-browser model
            </button>{' '}
            instead.
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
        className="space-y-3"
      >
        <label htmlFor="q" className="sr-only">
          Your question
        </label>
        <textarea
          id="q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void ask();
            }
          }}
          rows={3}
          placeholder="Ask anything…  (Ctrl/⌘ + Enter to send)"
          className="auto-grow w-full resize-none rounded-xl border border-zinc-300 bg-white p-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex items-center gap-3">
          {running ? (
            <button type="button" onClick={stop} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!question.trim()} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40">
              {settings.mode === 'council' ? 'Ask the council' : 'Ask'}
            </button>
          )}
          {settings.grounding && <span className="text-xs text-zinc-500">Wikipedia grounding on</span>}
        </div>
      </form>

      {progress && (
        <div role="status" className="rounded-xl border border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800">
          <div className="mb-1 flex justify-between">
            <span>Loading the in-browser model (cached after the first time)</span>
            {progress.fraction !== undefined && <span>{Math.round(progress.fraction * 100)}%</span>}
          </div>
          <progress className="h-1.5 w-full" value={progress.fraction ?? 0} max={1} />
          <p className="mt-1 truncate font-mono">{progress.text}</p>
        </div>
      )}

      {notice && (
        <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {notice}
        </p>
      )}

      <main className="space-y-4">
        <SeatCard
          featured
          title={settings.mode === 'council' ? "Council's verdict" : 'Answer'}
          subtitle={settings.mode === 'council' ? 'synthesized from all members' : undefined}
          seat={chair}
          placeholder="Your answer will appear here."
        />
        {settings.mode === 'council' && (
          <div className="grid gap-3 md:grid-cols-3">
            {PERSONAS.map((p) => (
              <SeatCard key={p.id} title={p.name} subtitle={p.tagline} seat={members[p.id]} placeholder="Waiting for a question." />
            ))}
          </div>
        )}
        {sources.length > 0 && (
          <details className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <summary className="cursor-pointer font-medium">Sources ({sources.length})</summary>
            <ol className="mt-2 space-y-1 pl-5">
              {sources.map((s) => (
                <li key={s.id} className="list-decimal">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline dark:text-violet-400">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        )}
      </main>

      <SettingsDialog ref={dialogRef} settings={settings} update={update} server={server} recheck={() => recheck()} />
    </div>
  );
}
