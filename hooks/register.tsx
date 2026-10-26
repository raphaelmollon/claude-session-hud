import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Hud, HudLimit } from '../types'
import {
  bar,
  compactGain,
  gitCounts,
  modelLabel,
  planLabel,
  remaining,
  remoteOn,
  shortPath,
  tokens,
  tone,
} from './format'

const EMPTY: Hud = {
  tokens: null,
  window: null,
  percent: null,
  compactGain: null,
  limits: [],
  model: null,
  effort: null,
  plan: null,
  version: null,
  cwd: null,
  git: null,
  remote: false,
}

const LIMIT_LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
}

const CONTEXT_CELLS = 20
const LIMIT_CELLS = 8

const REFRESH_MS = 30_000

const hud = atom({ plugin: 'session-hud', key: 'hud' } as const, EMPTY)

const safe = async <T,>(call: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await call()
  } catch {
    return undefined
  }
}

const patch = async ($: EngineInterface, part: Partial<Hud>) => {
  const now = await read($, hud)

  if (JSON.stringify({ ...now, ...part }) !== JSON.stringify(now)) {
    await update($, hud, current => ({ ...current, ...part }))
  }
}

const refreshUsage = async ($: EngineInterface, withBreakdown: boolean) => {
  const usage = await safe(() =>
    $.session.usage(withBreakdown ? { breakdown: 'summary' } : undefined),
  )

  if (usage === undefined) {
    return
  }

  const { context, rateLimits } = usage
  const { breakdown } = context
  const used = context.tokens ?? breakdown?.totalTokens ?? null
  const part: Partial<Hud> = {
    tokens: used,
    window: context.window,
    percent:
      context.percent ??
      (used === null ? null : Math.round((used / context.window) * 100)),
    limits: rateLimits.map(
      (limit): HudLimit => ({
        kind: limit.kind,
        percent: limit.percentUsed,
        resetsAt: limit.resetsAt ?? null,
      }),
    ),
  }

  if (breakdown !== undefined) {
    part.compactGain = compactGain(breakdown.categories)
  }

  await patch($, part)
}

const refreshGit = async ($: EngineInterface) => {
  const cwd = await safe(() => $.session.cwd())
  const status = await safe(() =>
    $.process.run(['git', 'status', '--porcelain=v2', '--branch'], {
      cwd,
      env: { GIT_OPTIONAL_LOCKS: '0' },
      timeoutMs: 10_000,
    }),
  )

  await patch($, {
    cwd: cwd ?? null,
    git: status?.exitCode === 0 ? gitCounts(status.stdout) : null,
  })
}

const refreshBasics = async ($: EngineInterface) => {
  const [model, version] = await Promise.all([
    safe(() => $.session.model()),
    safe(() => $.session.version()),
  ])
  const part: Partial<Hud> = {
    model: model ?? null,
    version: version?.base ?? version?.version ?? null,
  }

  if ((await read($, hud)).effort === null) {
    const settings = await safe(() => $.settings.read())
    const fromEnv = await safe(() => $.env.get('CLAUDE_CODE_EFFORT_LEVEL'))
    const configured = fromEnv ?? settings?.effortLevel

    if (typeof configured === 'string' && configured !== '') {
      part.effort = configured
    }
  }

  await patch($, part)
}

const refreshPlan = async ($: EngineInterface) => {
  if ((await read($, hud)).plan !== null) {
    return
  }

  // An npm install is a .cmd shim on Windows, which no argv starts unaided.
  const commands = [
    ['claude', 'auth', 'status'],
    ['cmd', '/c', 'claude', 'auth', 'status'],
  ]

  for (const argv of commands) {
    const ran = await safe(() => $.process.run(argv, { timeoutMs: 20_000 }))
    const plan = ran?.exitCode === 0 ? planLabel(ran.stdout) : null

    if (plan !== null) {
      await patch($, { plan })

      return
    }
  }
}

const refreshRemote = async ($: EngineInterface) => {
  const [id, configDir, profile, home] = await Promise.all([
    safe(() => $.session.id()),
    safe(() => $.env.get('CLAUDE_CONFIG_DIR')),
    safe(() => $.env.get('USERPROFILE')),
    safe(() => $.env.get('HOME')),
  ])
  const root = configDir ?? (profile ?? home)?.concat('/.claude')

  if (id === undefined || root === undefined) {
    return
  }

  const dir = `${root}/sessions`
  const files = (await safe(() => $.fs.list(dir))) ?? []
  const entries = await Promise.all(
    files
      .filter(file => file.kind === 'file' && file.name.endsWith('.json'))
      .map(file => safe(() => $.fs.read(`${dir}/${file.name}`))),
  )

  await patch($, {
    remote: remoteOn(
      entries.filter(text => text !== undefined),
      id,
    ),
  })
}

const refreshAll = ($: EngineInterface) =>
  Promise.all([
    refreshUsage($, true),
    refreshGit($),
    refreshBasics($),
    refreshRemote($),
  ])

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refreshAll($)
    void refreshPlan($)

    try {
      $.clock.every(REFRESH_MS, () => {
        void refreshUsage($, false)
        void refreshGit($)
        void refreshRemote($)
      })
    } catch {
      // No timer: the band still follows every turn and measurement.
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await refreshUsage($, true)

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      await patch($, {
        model: e.model,
        effort: e.effort === undefined ? null : String(e.effort),
      })
    }

    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    if (e.agentId === undefined) {
      await refreshAll($)
    }

    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const state = await read($, hud)
    const now = (await safe(() => $.clock.now())) ?? Date.now()
    const { Box, Text } = $.ui.resolve(e)

    const meter = (percent: number, width: number, right = '') => {
      const cells = bar(percent, width, `${Math.round(percent)}%`, right)

      return (
        <Box>
          <Text color={tone(percent)} inverse>
            {cells.filled}
          </Text>
          <Text dimColor inverse>
            {cells.empty}
          </Text>
        </Box>
      )
    }

    const gain = state.compactGain
    const limits = state.limits.filter(limit => limit.kind in LIMIT_LABELS)
    const git =
      state.git === null
        ? 'no git'
        : `${state.git.changed} to commit · ${
            state.git.ahead === null ? 'no upstream' : `${state.git.ahead} to push`
          }`
    const basics = [
      state.model === null ? '' : modelLabel(state.model),
      state.effort ?? '',
      state.plan ?? '',
      state.version === null ? '' : `v${state.version}`,
      state.cwd === null ? '' : shortPath(state.cwd),
      git,
    ].filter(part => part !== '')

    return (
      <Box flexWrap="wrap" columnGap={2}>
        <Box>
          <Text bold>Ctx </Text>
          {state.percent === null ? (
            <Text dimColor>n/a</Text>
          ) : (
            meter(
              state.percent,
              CONTEXT_CELLS,
              `${tokens(state.tokens ?? 0)}/${tokens(state.window ?? 0)} `,
            )
          )}
          {gain !== null && gain > 0 && (
            <Text dimColor> /compact to free {tokens(gain)}</Text>
          )}
        </Box>
        {limits.length === 0 ? (
          <Text dimColor>5h/7d n/a</Text>
        ) : (
          limits.map(limit => (
            <Box>
              <Text bold>{LIMIT_LABELS[limit.kind]} </Text>
              {meter(limit.percent, LIMIT_CELLS)}
              {limit.resetsAt !== null && (
                <Text dimColor>
                  {' '}
                  reset {remaining(Date.parse(limit.resetsAt) - now)}
                </Text>
              )}
            </Box>
          ))
        )}
        <Text color={state.remote ? 'success' : 'error'} bold>
          {state.remote ? '/rc' : '/off'}
        </Text>
        <Text dimColor>{basics.join(' · ')}</Text>
      </Box>
    )
  })
}
