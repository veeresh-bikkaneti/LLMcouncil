import { expect, test } from 'claude-code/testing'

import { hideCode } from './register'

test('fenced code becomes a one-line stub', () => {
  const text = 'Here:\n```ts\nconst a = 1\nconst b = 2\n```\nDone.'

  expect(hideCode(text)).toBe('Here:\n▸ code hidden (2 lines)\nDone.')
})

test('a fence still streaming is cut at its opening', () => {
  expect(hideCode('Start\n```py\nprint(1)')).toBe('Start\n▸ code hidden…')
})

test('a failed tool call leaves one line, a good one nothing', async $ => {
  const ROW = {
    tool_use_id: 't1',
    tool: 'Bash',
    input: { command: 'ls' },
    isRunning: false,
    isErrored: false,
    isInterrupted: false,
  }

  for (const surface of ['terminal', 'desktop'] as const) {
    const ok = await $.ui.mount({ plugin: 'clean-view', surface, component: 'ToolUse', props: ROW })
    expect(await ok.find({ type: 'Text' })).toBeUndefined()
    await ok.unmount()

    const bad = await $.ui.mount({
      plugin: 'clean-view',
      surface,
      component: 'ToolUse',
      props: { ...ROW, isErrored: true },
    })
    expect(await bad.find({ type: 'Text', text: /Bash failed/ })).toBeDefined()
    await bad.unmount()
  }
})

test('the band lists the model todo list as a checklist', async ($, on) => {
  on('tool.call', () => ({ result: {}, text: 'ok' }) as never)
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Plan', status: 'completed', activeForm: 'Planning' },
      { content: 'Build', status: 'in_progress', activeForm: 'Building' },
      { content: 'Ship', status: 'pending', activeForm: 'Shipping' },
    ],
  } as never)

  const ui = await $.ui.mount({
    plugin: 'clean-view',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80 } as never,
  })
  expect(await ui.find({ type: 'Text', text: /Progress 1\/3/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /✓ Plan/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /▸ Building/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /○ Ship/ })).toBeDefined()
  await ui.unmount()
})
