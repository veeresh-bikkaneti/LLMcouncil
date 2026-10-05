import { useEffect, useState } from 'react';

export type BackendKind = 'server' | 'browser';
export type Mode = 'quick' | 'council';

export interface Settings {
  backend: BackendKind;
  serverUrl: string;
  serverModel: string;
  browserModel: string;
  mode: Mode;
  grounding: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  backend: 'server',
  serverUrl: 'http://localhost:11434',
  serverModel: '',
  browserModel: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  mode: 'council',
  grounding: false,
};

const KEY = 'llmcouncil.settings.v1';

export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // private mode: settings just won't persist
    }
  }, [settings]);
  return [settings, (patch) => setSettings((s) => ({ ...s, ...patch }))];
}
