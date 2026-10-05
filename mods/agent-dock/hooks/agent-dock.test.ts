import { expect, mock, test } from 'claude-code/testing'

import { clock, describeCall, parseTasks } from './register'

test('tasks are parsed and a bare prompt gets a title', () => {
  expect(parseTasks([{ title: ' A ', prompt: ' do a ' }, { prompt: 'do b' }, { title: 'x' }, null])).toEqual([
    { title: 'A', prompt: 'do a' },
    { title: 'do b', prompt: 'do b' },
  ])
  expect(parseTasks('nope')).toEqual([])
})

test('a call is described by its first argument', () => {
  expect(describeCall('Read', { file_path: '/a/b.ts' })).toBe('Read /a/b.ts')
  expect(describeCall('TodoWrite', {})).toBe('TodoWrite')
})

test('elapsed time reads as seconds then minutes', () => {
  expect(clock(4200)).toBe('4s')
  expect(clock(75_000)).toBe('1m 15s')
})

// The test engine's stand-in for agent.spawn cannot set agentId (core alone does), so the
// cards here land as 'could not start'; the card and pane wiring is what this checks.
test('dispatch starts helpers and the pane shows a card for each', async ($, on) => {
  mock.clock(on)
  let n = 0
  on('agent.spawn', () => ({ model: 'm', agentId: `a${(n += 1)}` }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  const ran = await $.tool.call({
    tool: 'mcp__agent-dock__dispatch',
    tasks: [
      { title: 'Docs', prompt: 'write docs' },
      { title: 'Tests', prompt: 'write tests' },
    ],
  } as never)
  expect(ran.deny).toBeUndefined()

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'agent-dock',
      surface,
      component: 'Pane',
      requestId: 'agent-dock',
      props: { title: 'Agent Dock', isFocused: false, bodyColumns: 60, placement: 'dock' } as never,
    })
    expect(await ui.find({ type: 'Text', text: /Docs/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Tests/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\/2 finished/ })).toBeDefined()
    await ui.unmount()
  }
})

test('an empty dispatch is refused', async ($, on) => {
  on('agent.spawn', () => ({ model: 'm', agentId: 'a' }) as never)
  const ran = await $.tool.call({ tool: 'mcp__agent-dock__dispatch', tasks: [] } as never)
  expect(ran.deny).toMatch(/at least one/)
})
