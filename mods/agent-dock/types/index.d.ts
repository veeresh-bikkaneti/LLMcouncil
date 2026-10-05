export type Card = {
  id: string
  agentId: string
  title: string
  status: 'queued' | 'running' | 'done' | 'failed'
  /** Tool calls the helper has made so far. */
  steps: number
  /** What it is doing now, from its latest tool call. */
  activity: string
  /** Its final answer once done. */
  answer: string
  startedAt: number
  endedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'agent-dock': { cards: Card[]; tick: number }
  }
}
