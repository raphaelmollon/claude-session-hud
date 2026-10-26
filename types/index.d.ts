export type HudLimit = {
  kind: string
  percent: number
  resetsAt: string | null
}

export type HudGit = {
  changed: number
  ahead: number | null
}

export type Hud = {
  tokens: number | null
  window: number | null
  percent: number | null
  compactGain: number | null
  limits: HudLimit[]
  model: string | null
  effort: string | null
  plan: string | null
  version: string | null
  cwd: string | null
  git: HudGit | null
  remote: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'session-hud': { hud: Hud }
  }
}
