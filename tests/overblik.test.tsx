import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'overblik',
  component: 'Pane',
  requestId: 'overblik',
  props: {
    title: 'Overblik',
    isFocused: false,
    bodyColumns: 36,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('panelet viser en skrevet fil og knapperne, i terminal og desktop', async ($, on) => {
  on('command.register', () => ({ value: { command: 'overblik' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 62000, window: 200000, percent: 31 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 40 }],
      cost: { usd: 0.5 },
    },
  }))
  on('agent.list', () => ({ value: [] }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))

  await $.session.start({ cwd: 'C:/proj', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Write', file_path: 'C:/proj/rapport.html', content: '<h1>x</h1>' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /rapport\.html/ }))?.text).toContain('rapport.html')
    expect(await ui.find({ type: 'Button', key: 'compact' })).toBeTruthy()
    expect(await ui.find({ type: 'Button', key: 'clear' })).toBeTruthy()
    await ui.unmount()
  }
})

test('panelet bruger danske, ikke-tekniske ord', async ($, on) => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /HUKOMMELSE/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /CLAUDE ARBEJDER PÅ/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /tokens|KONTEKST|AGENTER/ })).toBeFalsy()
  await ui.unmount()
})

test('den danske vejledning lægges sidst i systemprompten', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'x', scope: 'shared' }] }))
  const r = await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] })
  const last = r.sections[r.sections.length - 1]
  expect(last?.id).toBe('overblik:vejledning')
  expect(last?.text).toContain('simpleste løsning')
})

test('vejledningen kan slås fra', { options: { begynderhjaelp: false } }, async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'x', scope: 'shared' }] }))
  const r = await $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: [], tools: [], outputStyle: null, traits: [] })
  expect(r.sections.map(s => s.id)).toEqual(['intro'])
})
