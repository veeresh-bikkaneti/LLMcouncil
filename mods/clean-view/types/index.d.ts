export type Step = {
  id: string
  label: string
  status: 'pending' | 'active' | 'done'
  /** `todo` steps come from the model's own todo list, `auto` ones from tool activity. */
  source: 'todo' | 'auto'
}

declare module 'claude-code' {
  interface PluginState {
    'clean-view': { steps: Step[]; isOn: boolean }
  }
}
