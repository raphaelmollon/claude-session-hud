import { expect, test } from 'claude-code/testing'

import {
  bar,
  compactGain,
  gitCounts,
  modelLabel,
  planLabel,
  remaining,
  remoteOn,
  tokens,
} from '../hooks/format'

const BAND = {
  plugin: 'session-hud',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
  } as never,
} as const

test('formats bars, tokens and delays', () => {
  expect(bar(50, 16, '50%', '84k/200k ')).toEqual({
    filled: ' 50%   8',
    empty: '4k/200k ',
  })
  expect(bar(1, 8, '1%').filled).toBe(' ')
  expect(bar(0, 4, '0%')).toEqual({ filled: '', empty: ' 0% ' })
  expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(modelLabel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(modelLabel('Opus 5.5')).toBe('Opus 5.5')
  expect(tokens(84_400)).toBe('84k')
  expect(tokens(1_200_000)).toBe('1.2M')
  expect(remaining(134 * 60_000)).toBe('in 2h 14m')
  expect(remaining((3 * 1440 + 5) * 60_000)).toBe('in 3d 0h 5m')
  expect(remaining(0)).toBe('now')
})

test('reads git, the plan and the compaction gain', () => {
  const status = '# branch.oid abc\n# branch.ab +2 -0\n1 .M N... a.ts\n? b.ts\n'
  expect(gitCounts(status)).toEqual({ changed: 2, ahead: 2 })
  expect(gitCounts('# branch.oid abc\n')).toEqual({ changed: 0, ahead: null })
  expect(planLabel('{"loggedIn":true,"subscriptionType":"max"}')).toBe('Max')
  expect(planLabel('{"loggedIn":true}')).toBe('API')
  expect(planLabel('not json')).toBe(null)
  expect(
    compactGain([
      { name: 'System prompt', tokens: 4000, kind: 'used' },
      { name: 'Messages', tokens: 60_000, kind: 'used' },
      { name: 'Free space', tokens: 100_000, kind: 'free' },
    ]),
  ).toBe(60_000)
})

test('reads Remote Control from the session registry', () => {
  const on = '{"sessionId":"a","bridgeSessionId":"session_01"}'
  expect(remoteOn([on], 'a')).toBe(true)
  expect(remoteOn(['{"sessionId":"a"}', 'not json'], 'a')).toBe(false)
  expect(remoteOn([on], 'b')).toBe(false)
  expect(remoteOn([], 'a')).toBe(false)
})

test('the band shows context, limits and the basics', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: 'a' }))
  on('fs.list', () => ({ value: [
    { name: '1.json', kind: 'file', size: 1, mtimeMs: 0, isLink: false },
  ] }))
  on('fs.read', () => ({
    value: '{"sessionId":"a","bridgeSessionId":"session_01"}',
  }))
  on('session.usage', () => ({ value: {
    startedAt: 0,
    context: {
      tokens: 84_000,
      window: 200_000,
      percent: 42,
      breakdown: {
        totalTokens: 84_000,
        categories: [{ name: 'Messages', tokens: 60_000, kind: 'used' }],
      } as never,
    },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 23, resetsAt: '1970-01-01T02:14:00Z' },
      { kind: 'seven_day', percentUsed: 61 },
    ],
  } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.version', () => ({ value: { version: '2.1.289', base: '2.1.289' } }))
  on('session.cwd', () => ({ value: 'E:\\tools\\claude_mods' }))
  on('settings.read', () => ({ value: { effortLevel: 'high' } }))
  on('env.get', (_, e) => ({
    value: e.name === 'CLAUDE_CONFIG_DIR' ? '/config' : undefined,
  }))
  on('clock.now', () => ({ value: 0 }))
  on('process.run', (_, e) => ({ value: {
    exitCode: 0,
    stdout:
      e.argv[0] === 'git'
        ? '# branch.ab +2 -0\n1 .M N... a.ts\n'
        : '{"loggedIn":true,"subscriptionType":"max"}',
    stderr: '',
    isStdoutTruncated: false,
    isStderrTruncated: false,
  } }))

  await $.session.start({
    cwd: 'E:\\tools\\claude_mods',
    surface: 'terminal',
    isInteractive: true,
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const found = await ui.findAll({ type: 'Text' })
    const line = found.map(one => one.text).join('')
    expect(line).toContain('Ctx  42%')
    expect(line).toContain('84k/200k')
    expect(line).toContain('/compact to free 60k')
    expect(line).toContain('5h  23%')
    expect(line).toContain('reset in 2h 14m')
    expect(line).toContain('7d  61%')
    expect(await ui.find({ type: 'Text', text: '/rc' })).toBeDefined()
    // The plan is read in the background, so it may not be in yet.
    expect(line).toContain('Opus 5.5 · high · ')
    expect(line).toContain(
      'v2.1.289 · E:\\tools\\claude_mods · 1 to commit · 2 to push',
    )
    await ui.unmount()
  }
})

test('outside a repository and before any reading, the band says so', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: {
    startedAt: 0,
    context: { window: 200_000 },
    rateLimits: [],
  } }))
  on('process.run', () => ({ value: {
    exitCode: 128,
    stdout: '',
    stderr: 'fatal: not a git repository',
    isStdoutTruncated: false,
    isStderrTruncated: false,
  } }))

  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'n/a' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '5h/7d n/a' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /no git/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '/off' })).toBeDefined()
  await ui.unmount()
})
