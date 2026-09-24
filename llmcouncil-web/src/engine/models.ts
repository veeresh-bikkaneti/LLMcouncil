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
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 1.5B',
    tier: 'fast',
    capabilities: ['fast', 'summarizing'],
    sizeLabel: '~1.6 GB',
    vramLabel: '~2 GB VRAM',
    description: 'Best for low-power laptops and quick lookups. Limited multi-step reasoning.',
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 3B',
    tier: 'fast',
    capabilities: ['fast', 'reasoning'],
    sizeLabel: '~2.3 GB',
    vramLabel: '~3 GB VRAM',
    description: 'Noticeably better understanding than 1.5B, still runs on integrated GPUs.',
  },
  {
    id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 7B Instruct',
    tier: 'balanced',
    capabilities: ['reasoning', 'summarizing', 'understanding'],
    sizeLabel: '~5.1 GB',
    vramLabel: '~6 GB VRAM',
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
    description: 'Compact but reasoning-tuned; a good middle ground on mid-range GPUs.',
  },
  {
    id: 'DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC',
    label: 'DeepSeek R1 Distill 8B',
    tier: 'deep',
    capabilities: ['chain-of-thought', 'summarizing'],
    sizeLabel: '~5.0 GB',
    vramLabel: '~7 GB VRAM',
    description: 'Shows its work step-by-step before answering. Best for multi-step or analytical questions.',
  },
  {
    id: 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC',
    label: 'Hermes 3 · Llama 3.1 8B',
    tier: 'deep',
    capabilities: ['tool-calling', 'reasoning'],
    sizeLabel: '~4.9 GB',
    vramLabel: '~6 GB VRAM',
    description: 'Natively supports structured function calling -- reserved for future tool-use features.',
  },
];

export const DEFAULT_MODEL_ID = AVAILABLE_MODELS.find((m) => m.recommended)?.id ?? AVAILABLE_MODELS[0].id;

// The Council makes four sequential generations per question (three members plus
// the Chairperson) on one shared in-browser engine, so it defaults to a faster model
// than the single-pass Local Assistant does. All seats share it: one download.
export const DEFAULT_COUNCIL_MODEL_ID = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';

export function isWebGPUSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as unknown as { gpu?: unknown }).gpu;
}
