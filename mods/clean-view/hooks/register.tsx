import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Step } from '../types'

const stepsRef = { plugin: 'clean-view', key: 'steps' } as const
const isOnRef = { plugin: 'clean-view', key: 'isOn' } as const
const steps = atom(stepsRef, [])
const isOn = atom(isOnRef, true)

const GROUPS: Record<string, string> = {
  Read: 'Reading the codebase',
  Glob: 'Reading the codebase',
  Grep: 'Reading the codebase',
  Edit: 'Editing files',
  Write: 'Editing files',
  NotebookEdit: 'Editing files',
  Bash: 'Running commands',
  WebFetch: 'Searching the web',
  WebSearch: 'Searching the web',
  Agent: 'Delegating to a subagent',
}

const FENCE = /```[^\n]*\n([\s\S]*?)```/g
const OPEN_FENCE = /```[^\n]*\n[\s\S]*$/

const lines = (code: string) => code.replace(/\n$/, '').split('\n').length

export const hideCode = (text: string) =>
  text
    .replace(FENCE, (_, code: string) => `▸ code hidden (${lines(code)} lines)`)
    .replace(OPEN_FENCE, '▸ code hidden…')

const mark = (step: Step) =>
  step.status === 'done' ? '✓' : step.status === 'active' ? '▸' : '○'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'clean-view',
      description: 'Toggle Clean View: hide tool calls and raw code, show a progress checklist',
    })

    return next(e)
  })

  on('command.run', { command: 'clean-view' }, async $ => {
    await update($, isOn, was => !was)
    const { value = true } = await $.state.get(isOnRef)

    return { text: value ? 'Clean View on.' : 'Clean View off.' }
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, steps, list => {
      const isTodoOpen = list.some(s => s.source === 'todo' && s.status !== 'done')

      return isTodoOpen ? list.filter(s => s.source === 'todo') : []
    })

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'TodoWrite') {
      const todos = e.todos.map((todo, i): Step => ({
        id: `todo-${i}`,
        label: (todo.status === 'in_progress' ? todo.activeForm : todo.content) ?? '',
        status: todo.status === 'in_progress' ? 'active' : todo.status === 'completed' ? 'done' : 'pending',
        source: 'todo',
      }))
      await update($, steps, () => todos)
    } else if (GROUPS[String(e.tool)] !== undefined) {
      const label = GROUPS[String(e.tool)] ?? 'Working'
      await update($, steps, list => {
        if (list.some(s => s.source === 'todo')) return list
        const last = list[list.length - 1]
        if (last !== undefined && last.label === label) return list
        const closed = list.map((s): Step => ({ ...s, status: 'done' }))

        const step: Step = { id: e.tool_use_id, label, status: 'active', source: 'auto' }

        return [...closed, step]
      })
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await update($, steps, list =>
      list.map((s): Step => (s.source === 'auto' ? { ...s, status: 'done' } : s)),
    )

    return next(e)
  })

  // Tool rows are hidden; a failed call leaves one dim line. The detail stays in the
  // stored transcript, and `/clean-view` turns the whole mod off.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const { Box, Text } = $.ui.resolve(e)

    if (e.props.isErrored) {
      return <Text color="red" dimColor>✗ {e.props.tool} failed</Text>
    }

    return <Box display="none" height={0} />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const { Box } = $.ui.resolve(e)

    return <Box display="none" height={0} />
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const { Box } = $.ui.resolve(e)

    return <Box display="none" height={0} />
  })

  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)
    const { Box } = $.ui.resolve(e)

    return <Box display="none" height={0} />
  })

  // Replies: fenced code becomes a one-line stub; the stored message is untouched.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!(await read($, isOn))) return next(e)

    return next({ ...e, props: { ...e.props, text: hideCode(e.props.text) } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, steps)
    if (e.props.hasSurvey || list.length === 0 || !(await read($, isOn))) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const done = list.filter(s => s.status === 'done').length
    const room = Math.max(1, e.props.maxRows - 1)
    const activeAt = list.findIndex(s => s.status === 'active')
    const from = Math.max(0, Math.min(list.length - room, (activeAt < 0 ? list.length : activeAt) - 1))

    return (
      <Box flexDirection="column">
        <Text dimColor>Progress {done}/{list.length}</Text>
        {list.slice(from, from + room).map(s => (
          <Text
            dimColor={s.status !== 'active'}
            bold={s.status === 'active'}
            wrap="truncate-end"
          >
            {mark(s)} {s.label}
          </Text>
        ))}
      </Box>
    )
  })
}
