import { forwardRef } from 'react';
import { BROWSER_MODELS } from '../lib/backends/webllm';
import type { Settings } from '../lib/settings';

export type ServerState = { status: 'checking' | 'down' } | { status: 'ok'; models: string[] };

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  server: ServerState;
  recheck: () => void;
}

const field =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';

export const SettingsDialog = forwardRef<HTMLDialogElement, Props>(function SettingsDialog(
  { settings, update, server, recheck },
  ref
) {
  return (
    <dialog
      ref={ref}
      aria-labelledby="settings-title"
      // light dismiss where supported; Esc always works
      {...{ closedby: 'any' }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <form method="dialog" className="space-y-5">
        <h2 id="settings-title" className="text-lg font-semibold">
          Settings
        </h2>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Where the model runs</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="backend" className="mt-1" checked={settings.backend === 'server'} onChange={() => update({ backend: 'server' })} />
            <span>
              <strong>Local server</strong> — Ollama, llama.cpp or LM Studio. Fastest; members run in parallel.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="backend" className="mt-1" checked={settings.backend === 'browser'} onChange={() => update({ backend: 'browser' })} />
            <span>
              <strong>In this browser</strong> — nothing to install, but needs WebGPU and a one-time download. Slower.
            </span>
          </label>
        </fieldset>

        {settings.backend === 'server' ? (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Server URL</span>
              <input className={field} value={settings.serverUrl} onChange={(e) => update({ serverUrl: e.target.value })} onBlur={recheck} inputMode="url" spellCheck={false} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Model</span>
              {server.status === 'ok' ? (
                <select className={field} value={settings.serverModel} onChange={(e) => update({ serverModel: e.target.value })}>
                  {server.models.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input className={field} value={settings.serverModel} onChange={(e) => update({ serverModel: e.target.value })} placeholder="e.g. llama3.2:3b" spellCheck={false} />
              )}
            </label>
            <p className="text-xs text-zinc-500" role="status">
              {server.status === 'checking' && 'Checking…'}
              {server.status === 'ok' && `Connected — ${server.models.length} model(s) found.`}
              {server.status === 'down' && (
                <>
                  Not reachable. Start it with <code>ollama serve</code>, then{' '}
                  <button type="button" onClick={recheck} className="underline">
                    retry
                  </button>
                  .
                </>
              )}
            </p>
          </div>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Browser model</span>
            <select className={field} value={settings.browserModel} onChange={(e) => update({ browserModel: e.target.value })}>
              {BROWSER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={settings.grounding} onChange={(e) => update({ grounding: e.target.checked })} />
          <span>
            <strong>Ground answers in Wikipedia</strong> — adds a lookup before each question and cited sources. Only your
            question text (personal data removed) is sent to Wikipedia. Off by default; fully offline otherwise.
          </span>
        </label>

        <div className="flex justify-end">
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">Done</button>
        </div>
      </form>
    </dialog>
  );
});
