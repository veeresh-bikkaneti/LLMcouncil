import type { EngineModelOption } from './types';

// This module must stay free of any @mlc-ai/web-llm import: the Council's model
// picker lives in the main bundle, and importing the engine here would pull the
// ~6MB WebLLM runtime into it instead of its own lazily-loaded chunk.

/**
 * Curated, capability-labeled tiers of real WebLLM prebuilt models (exact ids and
 * VRAM figures from mlc-ai/web-llm's prebuiltAppConfig). Every model here is driven
 * by the same JS orchestrator: none of them are ever given native tool-calling
 * control over search, even where the weights support it (noted on Hermes below).
 */
export const AVAILABLE_MODELS: EngineModelOption[] = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 1B',
    tier: 'fast',
    capabilities: ['fast', 'summarizing'],
    sizeLabel: 'under 1 GB',
    vramLabel: '~0.9 GB VRAM',
    vramMB: 879,
    vramF32MB: 1129,
    description: 'Phone-sized. Runs on recent Android phones and small laptops; answers are brief and simple.',
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 0.5B',
    tier: 'fast',
    capabilities: ['fast'],
    sizeLabel: 'under 1 GB',
    vramLabel: '~1 GB VRAM',
    vramMB: 945,
    vramF32MB: 1060,
    description: 'The lightest option, for older phones. Good for short factual lookups only.',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 1.5B',
    tier: 'fast',
    capabilities: ['fast', 'summarizing'],
    sizeLabel: '~1.6 GB',
    vramLabel: '~2 GB VRAM',
    vramMB: 1630,
    vramF32MB: 1889,
    description: 'Best for low-power laptops and quick lookups. Limited multi-step reasoning.',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 3B',
    tier: 'fast',
    capabilities: ['fast', 'reasoning'],
    sizeLabel: '~2.3 GB',
    vramLabel: '~3 GB VRAM',
    vramMB: 2264,
    vramF32MB: 2952,
    description: 'Noticeably better understanding than 1.5B, still runs on integrated GPUs.',
  },
  {
    id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 7B Instruct',
    tier: 'balanced',
    capabilities: ['reasoning', 'summarizing', 'understanding'],
    sizeLabel: '~5.1 GB',
    vramLabel: '~6 GB VRAM',
    vramMB: 5107,
    vramF32MB: 5900,
    description:
      'Strong general-purpose reasoning and long-context summarization -- the closest local match to a cloud-grade assistant.',
    recommended: true,
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    label: 'Phi-3.5 Mini',
    tier: 'balanced',
    capabilities: ['reasoning', 'fast'],
    sizeLabel: '~3.7 GB',
    vramLabel: '~4 GB VRAM',
    vramMB: 3672,
    vramF32MB: 5483,
    description: 'Compact but reasoning-tuned; a good middle ground on mid-range GPUs.',
  },
  {
    id: 'DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC',
    label: 'DeepSeek R1 Distill 8B',
    tier: 'deep',
    capabilities: ['chain-of-thought', 'summarizing'],
    sizeLabel: '~5.0 GB',
    vramLabel: '~7 GB VRAM',
    vramMB: 5001,
    vramF32MB: 6101,
    description: 'Shows its work step-by-step before answering. Best for multi-step or analytical questions.',
  },
  {
    id: 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC',
    label: 'Hermes 3 · Llama 3.1 8B',
    tier: 'deep',
    capabilities: ['tool-calling', 'reasoning'],
    sizeLabel: '~4.9 GB',
    vramLabel: '~6 GB VRAM',
    vramMB: 4876,
    vramF32MB: 5779,
    description: 'Natively supports structured function calling -- reserved for future tool-use features.',
  },
];

export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as unknown as { gpu?: unknown }).gpu;
}

export interface DeviceProfile {
  /** Phone, tablet, or low-memory machine: large models would crash the tab. */
  constrained: boolean;
  /** Largest model (GPU memory, MB) this device is allowed to load. */
  maxVramMB: number;
}

// A browser tab that exceeds the GPU memory the OS will give it is killed outright;
// nothing in the page can catch that. Phones hit it far below their total RAM, so
// on constrained devices we refuse to load anything over this instead of crashing.
const MOBILE_MAX_VRAM_MB = 1700;
// Just enough for the two phone-sized models' q4f32 builds.
const LOW_MEMORY_MAX_VRAM_MB = 1150;

let deviceProfile: DeviceProfile | null = null;

export function getDeviceProfile(): DeviceProfile {
  if (deviceProfile) return deviceProfile;
  if (typeof navigator === 'undefined') return { constrained: false, maxVramMB: Infinity };
  const nav = navigator as Navigator & {
    userAgentData?: { mobile?: boolean; platform?: string };
    deviceMemory?: number;
  };
  const ua = nav.userAgent || '';
  const mobile =
    nav.userAgentData?.mobile === true ||
    nav.userAgentData?.platform === 'Android' ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    // "Desktop site" mode on Android and iPadOS reports a Linux or Mac user agent;
    // a touch screen gives it away. (A touchscreen Linux laptop also matches, and
    // just gets the conservative limit.)
    (nav.maxTouchPoints > 1 && /Macintosh|X11|Linux x86_64/.test(ua) && !/CrOS/.test(ua));
  // navigator.deviceMemory is Chromium-only and capped at 8 (GB).
  const memoryGB = nav.deviceMemory;
  let maxVramMB = Infinity;
  if (mobile) maxVramMB = MOBILE_MAX_VRAM_MB;
  if (memoryGB !== undefined && memoryGB <= 4) maxVramMB = Math.min(maxVramMB, MOBILE_MAX_VRAM_MB);
  if (memoryGB !== undefined && memoryGB <= 2) maxVramMB = LOW_MEMORY_MAX_VRAM_MB;
  deviceProfile = { constrained: maxVramMB !== Infinity, maxVramMB };
  return deviceProfile;
}

/**
 * Whether this device can load `model` without risking the tab being killed. Judged
 * on the larger q4f32 build: whether the GPU has shader-f16 (and so gets the smaller
 * q4f16 build) is only known asynchronously, at load time.
 */
export function fitsDevice(model: EngineModelOption): boolean {
  return Math.max(model.vramMB, model.vramF32MB) <= getDeviceProfile().maxVramMB;
}

const MOBILE_DEFAULT_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

/** `preferred` if it fits this device, else the phone-sized default, else the smallest model. */
function pickForDevice(preferred: string): string {
  for (const id of [preferred, MOBILE_DEFAULT_ID]) {
    const model = AVAILABLE_MODELS.find((m) => m.id === id);
    if (model && fitsDevice(model)) return id;
  }
  return [...AVAILABLE_MODELS].sort((a, b) => a.vramF32MB - b.vramF32MB)[0].id;
}

export const DEFAULT_MODEL_ID = pickForDevice(
  AVAILABLE_MODELS.find((m) => m.recommended)?.id ?? AVAILABLE_MODELS[0].id
);

// The Council makes four sequential generations per question (three members plus
// the Chairperson) on one shared in-browser engine, so it defaults to a faster model
// than the single-pass Local Assistant does. All seats share it: one download.
export const DEFAULT_COUNCIL_MODEL_ID = pickForDevice('Llama-3.2-3B-Instruct-q4f16_1-MLC');
