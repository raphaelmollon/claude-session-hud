import type { HudGit } from '../types'

export const clamp = (n: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, n))

/**
 * A bar of `width` cells with text written inside it: `left` at its start,
 * `right` at its end, cut where the filled part stops so each half is drawn
 * in its own colors.
 */
export const bar = (
  percent: number,
  width: number,
  left = '',
  right = '',
): { filled: string; empty: string } => {
  const room = Math.max(0, width - left.length - right.length - 1)
  const text = ` ${left}${' '.repeat(room)}${right}`.padEnd(width).slice(0, width)
  const cells = clamp(Math.round((percent / 100) * width), 0, width)
  const filled = percent > 0 ? Math.max(1, cells) : 0

  return { filled: text.slice(0, filled), empty: text.slice(filled) }
}

export const tone = (percent: number): string => {
  if (percent >= 85) {
    return 'error'
  }

  return percent >= 60 ? 'warning' : 'success'
}

export const tokens = (n: number): string => {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }

  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

export const remaining = (ms: number): string => {
  const minutes = Math.round(ms / 60_000)

  if (minutes <= 0) {
    return 'now'
  }

  const days = Math.floor(minutes / 1440)
  const hours = Math.floor(minutes / 60) % 24
  const parts = [
    days > 0 ? `${days}d` : '',
    days > 0 || hours > 0 ? `${hours}h` : '',
    `${minutes % 60}m`,
  ]

  return `in ${parts.filter(part => part !== '').join(' ')}`
}

/** `claude-opus-5-5` reads as `Opus 5.5`; anything else is left as given. */
export const modelLabel = (model: string): string => {
  const id = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/i.exec(
    model.trim(),
  )

  if (id === null) {
    return model
  }

  const [, name = '', major = '', minor, isLong] = id
  const version = minor === undefined ? major : `${major}.${minor}`

  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${version}${
    isLong === undefined ? '' : ' 1M'
  }`
}

export const shortPath = (path: string, max = 28): string =>
  path.length <= max ? path : `…${path.slice(path.length - max + 1)}`

/** Reads `git status --porcelain=v2 --branch`. */
export const gitCounts = (stdout: string): HudGit => {
  const lines = stdout.split('\n').filter(line => line.trim() !== '')
  const ahead = /^# branch\.ab \+(\d+) -\d+/m.exec(stdout)?.[1]

  return {
    changed: lines.filter(line => !line.startsWith('#')).length,
    ahead: ahead === undefined ? null : Number(ahead),
  }
}

/** Reads the JSON `claude auth status` prints. */
export const planLabel = (stdout: string): string | null => {
  let status: unknown

  try {
    status = JSON.parse(stdout)
  } catch {
    return null
  }

  if (typeof status !== 'object' || status === null) {
    return null
  }

  const { loggedIn, subscriptionType } = status as Record<string, unknown>

  if (loggedIn !== true) {
    return null
  }

  if (typeof subscriptionType !== 'string' || subscriptionType === '') {
    return 'API'
  }

  return subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)
}

/**
 * Whether the session is on Remote Control, read from the registry entries
 * under `sessions/` in the config directory: the session's own entry carries
 * a `bridgeSessionId` while the bridge is up.
 */
export const remoteOn = (entries: readonly string[], sessionId: string): boolean =>
  entries.some(text => {
    let entry: unknown

    try {
      entry = JSON.parse(text)
    } catch {
      return false
    }

    if (typeof entry !== 'object' || entry === null) {
      return false
    }

    const { sessionId: id, bridgeSessionId } = entry as Record<string, unknown>

    return (
      id === sessionId && typeof bridgeSessionId === 'string' && bridgeSessionId !== ''
    )
  })

/**
 * What a compaction could free at most: the conversation's own tokens, which
 * the summary replaces. The system prompt, tools and memory files stay.
 */
export const compactGain = (
  categories: readonly { name: string; tokens: number; kind: string }[],
): number | null => {
  const messages = categories.find(
    row => row.kind === 'used' && /^messages/i.test(row.name),
  )

  return messages === undefined ? null : messages.tokens
}
