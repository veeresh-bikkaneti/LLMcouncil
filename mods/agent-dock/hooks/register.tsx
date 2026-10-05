import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Card } from '../types'

const PANE = 'agent-dock'
const TOOL = 'mcp__agent-dock__dispatch'
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const cards = atom({ plugin: 'agent-dock', key: 'cards' } as const, [])
const tick = atom({ plugin: 'agent-dock', key: 'tick' } as const, 0)

type Task = { title: string; prompt: string }

export const parseTasks = (raw: unknown): Task[] =>
  (Array.isArray(raw) ? raw : []).flatMap((t): Task[] => {
    const one = (t ?? {}) as Record<string, unknown>
    const prompt = typeof one.prompt === 'string' ? one.prompt.trim() : ''
    const title = typeof one.title === 'string' ? one.title.trim() : ''

    return prompt === '' ? [] : [{ title: title === '' ? prompt.slice(0, 40) : title, prompt }]
  })

export const describeCall = (tool: string, e: Record<string, unknown>) => {
  const file = (e.file_path ?? e.path ?? e.pattern ?? e.command ?? e.url ?? e.query) as unknown
  const arg = typeof file === 'string' ? file.split('\n')[0]?.slice(-48) ?? '' : ''

  return arg === '' ? tool : `${tool} ${arg}`
}

export const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))

  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

const glyph = (c: Card, n: number) =>
  c.status === 'running' ? (FRAMES[n % FRAMES.length] ?? '…') : c.status === 'done' ? '✓' : c.status === 'failed' ? '✗' : '○'

type Job = { id: string; prompt: string; title: string }

// Starts queued jobs while fewer than `max` helpers run.
async function pump($: EngineInterface, waiting: Job[], max: number) {
  const running = (await read($, cards)).filter(c => c.status === 'running').length
  for (let slot = running; slot < max && waiting.length > 0; slot++) {
    const job = waiting.shift()
    if (job === undefined) break
    const { agentId, deny } = await $.agent.spawn({ prompt: job.prompt, description: job.title })
    const now = await $.clock.now()
    await update($, cards, list =>
      list.map((c): Card =>
        c.id !== job.id
          ? c
          : agentId === undefined
            ? { ...c, status: 'failed', activity: deny ?? 'could not start', endedAt: now }
            : { ...c, agentId, status: 'running', startedAt: now },
      ),
    )
  }
}

export const register: Register = (on, options) => {
  const maxParallel = Math.max(1, Number(options.maxParallel) || 3)
  const waiting: Job[] = []
  let seq = 0

  const summary = (list: Card[]) =>
    list
      .map(c => `### ${c.title} (${c.status})\n${c.answer === '' ? '(no answer)' : c.answer}`)
      .join('\n\n')

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'dispatch',
      description:
        'Split a job into independent subtasks and run each on its own background helper agent. ' +
        'Each helper gets only its prompt, so make every prompt self-contained. ' +
        'Returns at once; when all helpers finish, their answers arrive as a new message. ' +
        'Progress shows live in the Agent Dock side pane.',
      inputSchema: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            minItems: 1,
            maxItems: 8,
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Short card title, a few words' },
                prompt: { type: 'string', description: 'Full self-contained instructions for the helper' },
              },
              required: ['title', 'prompt'],
            },
          },
        },
        required: ['tasks'],
      },
    })
    await $.command.register({
      name: 'dock',
      description: 'Agent Dock: open the pane, or give a job to split across helper agents',
      argumentHint: '[job to split]',
    })

    // A timer keeps elapsed time and the spinner moving while any card runs.
    $.clock.every(1000, () => {
      void read($, cards).then(list => {
        if (list.some(c => c.status === 'running')) return update($, tick, n => n + 1)
      })
    })

    return next(e)
  })

  // Serves the model's dispatch call. Children's own tool calls step past this hook
  // (the spawning hook is skipped), so the observer below is a separate hook.
  on('tool.call', { tool: TOOL }, async ($, e) => {
    const tasks = parseTasks(e.tasks)
    if (tasks.length === 0) return { deny: 'agent-dock: tasks needs at least one { title, prompt }.' }

    for (const task of tasks) {
      const id = `c${(seq += 1)}`
      const card: Card = {
        id, agentId: '', title: task.title, status: 'queued',
        steps: 0, activity: 'waiting for a slot', answer: '', startedAt: 0, endedAt: 0,
      }
      await update($, cards, list => [...list, card])
      waiting.push({ id, title: task.title, prompt: task.prompt })
    }
    await $.ui.open({ id: PANE, title: 'Agent Dock' })
    void pump($, waiting, maxParallel)

    return {
      result: {},
      text: `Dispatched ${tasks.length} helper agent(s) to the Agent Dock. Do not repeat their work; their answers will arrive in a follow-up message.`,
    }
  })

  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId !== undefined) {
      const activity = describeCall(String(e.tool), e as Record<string, unknown>)
      await update($, cards, list =>
        list.map((c): Card => (c.agentId === agentId ? { ...c, steps: c.steps + 1, activity } : c)),
      )
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId === undefined) return next(e)
    const now = await $.clock.now()
    const isOurs = (await read($, cards)).some(c => c.agentId === agentId)
    if (!isOurs) return next(e)

    const status = e.reason === 'answer' ? 'done' : 'failed'
    const after = await update($, cards, list =>
      list.map((c): Card =>
        c.agentId === agentId
          ? { ...c, status, endedAt: now, activity: status === 'done' ? 'finished' : `ended: ${e.reason}`, answer: e.answer.trim() }
          : c,
      ),
    )
    await pump($, waiting, maxParallel)

    if (waiting.length === 0 && after.every(c => c.status === 'done' || c.status === 'failed')) {
      const batch = after.filter(c => c.answer !== '' || c.status === 'failed')
      void $.prompt.submit({ text: `Agent Dock: all ${after.length} helper agents finished.\n\n${summary(batch)}` })
    }

    return next(e)
  })

  on('command.run', { command: 'dock' }, async ($, e) => {
    await $.ui.open({ id: PANE, title: 'Agent Dock' })
    const job = e.args.trim()
    if (job === '') return { text: 'Agent Dock opened.' }

    void $.prompt.submit({
      text:
        `Split this job into 2-6 independent subtasks and run them in parallel by calling ${TOOL} once. ` +
        `Make each prompt self-contained.\n\nJob: ${job}`,
    })

    return { text: 'Asking Claude to split the job across helper agents…' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, cards)
    const n = await read($, tick)
    const now = await $.clock.now()
    const done = list.filter(c => c.status === 'done' || c.status === 'failed').length
    const wide = Math.max(20, e.props.bodyColumns - 4)

    if (list.length === 0) {
      return <Text dimColor>No helpers yet. Ask Claude to split a job, or run /dock &lt;job&gt;.</Text>
    }

    return (
      <Box flexDirection="column">
        <Text bold>{done}/{list.length} finished</Text>
        {list.map(c => (
          <Box
            key={c.id}
            flexDirection="column"
            borderStyle="round"
            borderColor={c.status === 'failed' ? 'red' : c.status === 'done' ? 'green' : undefined}
            borderDimColor={c.status === 'queued'}
            paddingX={1}
          >
            <Text bold wrap="truncate-end">
              {glyph(c, n)} {c.title}
              {c.startedAt > 0 ? `  ${clock((c.endedAt > 0 ? c.endedAt : now) - c.startedAt)}` : ''}
            </Text>
            <Text dimColor wrap="truncate-end">
              {c.status === 'done' ? c.answer.split('\n')[0]?.slice(0, wide) ?? '' : c.activity}
            </Text>
            <Text dimColor>{c.steps} tool call{c.steps === 1 ? '' : 's'}</Text>
          </Box>
        ))}
        {done > 0 && (
          <Button
            key="clear"
            label="Clear finished"
            onPress={() => update($, cards, l => l.filter(c => c.status === 'queued' || c.status === 'running'))}
          />
        )}
      </Box>
    )
  })
}
