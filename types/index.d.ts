export type OutFile = { path: string; name: string; at: number }

export type AgentRow = { id: string; description: string; status: string }

export type Usage = {
  percent: number | null
  tokens: number | null
  window: number
  usd: number | null
  limits: { kind: string; percentUsed: number }[]
}

declare module 'claude-code' {
  interface PluginState {
    overblik: {
      files: Shaped<OutFile[]>
      agents: Shaped<AgentRow[]>
      usage: Shaped<Usage | null>
    }
  }
}
