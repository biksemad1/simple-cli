import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow, OutFile, Usage } from '../types'
import { VEJLEDNING } from './vejledning'

const PANE = 'overblik'
const TITLE = 'Overblik'

const files = atom({ plugin: 'overblik', key: 'files' } as const, [], { shape: 'files-1' })
const agents = atom({ plugin: 'overblik', key: 'agents' } as const, [], { shape: 'agents-1' })
const usage = atom({ plugin: 'overblik', key: 'usage' } as const, null, { shape: 'usage-1' })

const WRITERS = new Set(['Write', 'Edit', 'NotebookEdit'])

const STATUS_DA: Record<string, string> = {
  pending: 'venter',
  running: 'kører',
  waiting: 'venter',
  idle: 'inaktiv',
  completed: 'færdig',
  failed: 'fejlede',
  killed: 'stoppet',
}

const LIMIT_DA: Record<string, string> = {
  five_hour: '5 timer',
  seven_day: '7 dage',
  spend_limit: 'Budget',
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] || path
}

function bar(percent: number, width = 12): string {
  const p = Math.max(0, Math.min(100, percent))
  const full = Math.round((p / 100) * width)
  return '█'.repeat(full) + '░'.repeat(width - full)
}

function levelColor(percent: number): string {
  if (percent >= 85) return 'red'
  if (percent >= 65) return 'yellow'
  return 'green'
}

function kroner(usd: number): string {
  // Omtrentlig kurs; kun til orientering.
  return `${(usd * 6.9).toFixed(2).replace('.', ',')} kr`
}

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

async function openPath($: EngineInterface, path: string) {
  try {
    // Windows: åbn med standardprogrammet (HTML i browseren, .py i editoren osv.)
    const r = await $.process.run(['cmd.exe', '/c', 'start', '', path])
    if (r.exitCode === 0) return
  } catch {
    // ikke Windows, prøv nedenfor
  }
  try {
    await $.process.run(['open', path])
  } catch {
    try {
      await $.process.run(['xdg-open', path])
    } catch {
      $.ui.toast(`Kunne ikke åbne ${baseName(path)}`)
    }
  }
}

async function refresh($: EngineInterface) {
  try {
    const u = await $.session.usage()
    const next: Usage = {
      percent: u.context.percent ?? null,
      tokens: u.context.tokens ?? null,
      window: u.context.window,
      usd: u.cost?.usd ?? null,
      limits: u.rateLimits.map(l => ({ kind: l.kind, percentUsed: l.percentUsed })),
    }
    const prev = await read($, usage)
    if (JSON.stringify(prev) !== JSON.stringify(next)) {
      await update($, usage, () => next)
    }
  } catch {
    // ingen tal endnu
  }
  try {
    const list = await $.agent.list()
    const rows: AgentRow[] = list
      .filter(a => !a.teammateId)
      .map(a => ({ id: a.id, description: a.description, status: a.status }))
    const prev = await read($, agents)
    if (JSON.stringify(prev) !== JSON.stringify(rows)) {
      await update($, agents, () => rows)
    }
  } catch {
    // ingen agenter
  }
}

export const register: Register = (on, options) => {
  let cwd = ''

  // Dansk vejledning til Claude (som en CLAUDE.md). Kan slås fra i /config.
  if (options.begynderhjaelp !== false) {
    on('prompt.compose', async ($, e, next) => {
      const r = await next(e)

      return {
        sections: [...r.sections, { id: 'overblik:vejledning', text: VEJLEDNING, scope: 'session' }],
      }
    }).catch(($, e, next) => next(e))
  }

  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    await $.command.register({
      name: 'overblik',
      description: 'Vis overblikspanelet (hukommelse, forbrug, opgaver, filer)',
    })
    void $.ui.open({ id: PANE, title: TITLE, columns: 38 })
    $.clock.every(3000, () => refresh($))
    void refresh($)

    return next(e)
  })

  on('command.run', { command: 'overblik' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE, columns: 38 })
    await refresh($)

    return { text: 'Overblik åbnet.' }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (WRITERS.has(e.tool) && ran.deny === undefined && ran.isError !== true) {
      const path = (e as { file_path?: string; notebook_path?: string }).file_path
        ?? (e as { notebook_path?: string }).notebook_path
      if (path) {
        const at = await $.clock.now()
        const file: OutFile = { path, name: baseName(path), at }
        await update($, files, list =>
          [file, ...list.filter(f => f.path !== path)].slice(0, 30),
        )
      }
    }
    void refresh($)

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    await refresh($)

    return r
  })

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    void refresh($)

    return r
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const u = await read($, usage)
    const agentList = await read($, agents)
    const fileList = await read($, files)
    const width = Math.max(20, (e.props as { bodyColumns?: number }).bodyColumns ?? 36)
    const nameWidth = Math.max(8, width - 10)
    const pct = u?.percent ?? 0

    const running = agentList.filter(a => a.status === 'running' || a.status === 'pending' || a.status === 'waiting')
    const done = agentList.filter(a => !running.includes(a)).slice(-4)
    const shownAgents = [...running, ...done]

    return (
      <Box flexDirection="column">
        <Text bold>HUKOMMELSE</Text>
        <Text>
          <Text color={levelColor(pct)}>{bar(pct)}</Text> {u?.percent != null ? `${u.percent} % brugt` : '–'}
        </Text>
        {pct < 65 && <Text dimColor>Hvor meget Claude kan huske af samtalen</Text>}
        {pct >= 65 && pct < 85 && <Text color="yellow">Samtalen er ved at være lang</Text>}
        {pct >= 85 && <Text color="red">Næsten fuld – tryk Ryd op i samtalen</Text>}

        <Box marginTop={1} flexDirection="column">
          <Text bold>FORBRUG</Text>
          {u?.usd != null && <Text>Session: {kroner(u.usd)} (ca.)</Text>}
          {(u?.limits ?? []).map(l => (
            <Text>
              {(LIMIT_DA[l.kind] ?? l.kind).padEnd(8)}{' '}
              <Text color={levelColor(l.percentUsed)}>{bar(l.percentUsed, 8)}</Text> {l.percentUsed}%
            </Text>
          ))}
          {u == null && <Text dimColor>Vises efter første svar</Text>}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Button
            key="compact"
            label="Ryd op i samtalen"
            onPress={async () => {
              $.ui.toast('Rydder op – Claude beholder det vigtigste…')
              try {
                const r = await $.session.compact()
                $.ui.toast(r && 'skip' in r && r.skip ? 'Der var ikke noget at rydde op i' : 'Færdig – samtalen fylder mindre nu')
              } catch {
                $.ui.toast('Vent til Claude er færdig med at svare, og prøv igen')
              }
              void refresh($)
            }}
          />
          <Text dimColor>Pakker samtalen sammen, så den fylder mindre</Text>
          <Box marginTop={1}>
            <Button
              key="clear"
              label="Ny samtale"
              onPress={async () => {
                const r = await $.prompt.fill({ text: '/clear' })
                $.ui.toast(r.isFilled ? 'Tryk Enter for at starte en ny samtale' : 'Skriv /clear og tryk Enter for en ny samtale')
              }}
            />
          </Box>
          <Text dimColor>Starter forfra – filerne bliver liggende</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>CLAUDE ARBEJDER PÅ</Text>
          {shownAgents.length === 0 && <Text dimColor>Ingen ekstra opgaver lige nu</Text>}
          {shownAgents.map(a => {
            const isRunning = running.includes(a)
            return (
              <Text dimColor={!isRunning}>
                <Text color={isRunning ? 'cyan' : a.status === 'failed' ? 'red' : 'green'}>
                  {isRunning ? '●' : a.status === 'failed' ? '✗' : '✓'}
                </Text>{' '}
                {shorten(a.description || 'Opgave', nameWidth)} ({STATUS_DA[a.status] ?? a.status})
              </Text>
            )
          })}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>FILER CLAUDE HAR LAVET</Text>
          {fileList.length === 0 && <Text dimColor>Ingen endnu – de dukker op her</Text>}
          {fileList.slice(0, 8).map(f => (
            <Box>
              <Button key={`open-${f.path}`} label="Åbn" onPress={() => openPath($, f.path)} />
              <Text> {shorten(f.name, nameWidth)}</Text>
            </Box>
          ))}
          {cwd !== '' && (
            <Box marginTop={1}>
              <Button key="folder" label="Åbn mappen" onPress={() => openPath($, cwd)} />
            </Box>
          )}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>TIPS</Text>
          <Text dimColor>• Træk en fil ind i vinduet for at vise den til Claude</Text>
          <Text dimColor>• Kopiér et billede og tryk Alt+V</Text>
          <Text dimColor>• Tryk Esc for at stoppe Claude</Text>
        </Box>
      </Box>
    )
  })
}
