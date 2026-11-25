import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) {
    return 'Agora'
  }
  if (diffMins < 60) {
    return `${diffMins}min`
  }
  if (diffHours < 24) {
    return `${diffHours}h`
  }
  if (diffDays < 7) {
    return `${diffDays}d`
  }

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getInitials(name: string): string {
  const particles = new Set(['da', 'de', 'do', 'dos', 'das', 'e'])
  return name
    .split(' ')
    .filter((part) => !particles.has(part.toLowerCase()))
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getAgentColor(agentRef: string): string {
  let hash = 0
  for (let i = 0; i < agentRef.length; i++) {
    hash = agentRef.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 50%)`
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  return fn().catch((error) => {
    if (retries <= 0) throw error
    return sleep(delay).then(() => retry(fn, retries - 1, delay * 2))
  })
}

export interface FormattedRunLogEntry {
  id: string
  time: string
  kind: 'info' | 'tool' | 'text' | 'reasoning' | 'step' | 'error'
  title: string
  detail?: string
  status?: string
}

function shortenPaperclipPaths(text: string): string {
  return text.replace(
    /\/paperclip\/instances\/[^/\s]+\/projects\/[0-9a-f-]+\/[0-9a-f-]+\//gi,
    ''
  )
}

function truncateLogText(text: string, max = 500): string {
  const clean = text.trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trimEnd()}\n... (saída resumida, veja JSON bruto para detalhes)`
}

function formatLogTime(ts?: string | number): string {
  if (!ts) return ''
  const date = typeof ts === 'number' ? new Date(ts) : new Date(ts)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function parseRunLog(raw: string): FormattedRunLogEntry[] {
  if (!raw || !raw.trim()) return []
  const lines = raw.split('\n').filter((line) => line.trim().length > 0)
  const entries: FormattedRunLogEntry[] = []

  lines.forEach((line, idx) => {
    let ts = ''
    let stream = 'stdout'
    let chunkText = line

    try {
      const outer = JSON.parse(line) as Record<string, unknown>
      if (outer && typeof outer === 'object' && ('chunk' in outer || 'ts' in outer || 'type' in outer)) {
        if (typeof outer.ts === 'string' || typeof outer.ts === 'number') {
          ts = formatLogTime(outer.ts)
        }
        if (typeof outer.stream === 'string') {
          stream = outer.stream
        }
        if (typeof outer.chunk === 'string') {
          chunkText = outer.chunk
        } else if (typeof outer.type === 'string') {
          chunkText = line
        }
      }
    } catch {
      // Plain text line
    }

    const trimmedChunk = chunkText.trim()
    if (!trimmedChunk) return

    // Skill injection / Paperclip setup lines
    const skillMatch = trimmedChunk.match(/^\[paperclip\]\s+Injected OpenCode skill\s+"([^"]+)"/i)
    if (skillMatch) {
      entries.push({
        id: `log-${idx}`,
        time: ts,
        kind: 'info',
        title: `Skill carregada: ${skillMatch[1]}`,
      })
      return
    }

    if (trimmedChunk.startsWith('[paperclip]')) {
      entries.push({
        id: `log-${idx}`,
        time: ts,
        kind: stream === 'stderr' ? 'info' : 'info',
        title: shortenPaperclipPaths(trimmedChunk.replace(/^\[paperclip\]\s*/i, '')),
      })
      return
    }

    // Inner JSON event (OpenCode / Claude / Paperclip stream)
    try {
      const inner = JSON.parse(trimmedChunk) as Record<string, any>
      const eventTime = ts || formatLogTime(inner.timestamp)
      const part = inner.part ?? {}

      if (inner.type === 'step_start') {
        return
      }

      if (inner.type === 'step_finish') {
        const tokens = part.tokens
        if (tokens && typeof tokens === 'object') {
          const total = Number(tokens.total ?? 0).toLocaleString('pt-BR')
          const input = Number(tokens.input ?? 0).toLocaleString('pt-BR')
          const cached = Number(tokens.cache?.read ?? 0).toLocaleString('pt-BR')
          const output = Number(tokens.output ?? 0).toLocaleString('pt-BR')
          entries.push({
            id: `log-${idx}`,
            time: eventTime,
            kind: 'step',
            title: 'Passo concluído',
            detail: `${total} tokens (entrada: ${input}, cache: ${cached}, saída: ${output})`,
          })
        } else {
          entries.push({
            id: `log-${idx}`,
            time: eventTime,
            kind: 'step',
            title: 'Passo concluído',
          })
        }
        return
      }

      if (inner.type === 'tool_use') {
        const toolName = String(part.tool || 'ferramenta')
        const state = part.state ?? {}
        const status = typeof state.status === 'string' ? state.status : undefined
        const input = state.input ?? {}

        if (toolName === 'bash') {
          const rawCmd = String(input.command || part.title || state.title || '')
          const cleanedCmd = shortenPaperclipPaths(rawCmd).replace(/^cd\s+[^\s&]+\s*&&\s*/i, '')
          const detailRaw = status === 'error' ? state.error : state.output
          entries.push({
            id: `log-${idx}`,
            time: eventTime,
            kind: status === 'error' ? 'error' : 'tool',
            status,
            title: `Comando: ${truncateLogText(cleanedCmd || 'bash', 160)}`,
            detail: typeof detailRaw === 'string' && detailRaw.trim() ? truncateLogText(shortenPaperclipPaths(detailRaw)) : undefined,
          })
          return
        }

        if (toolName === 'read' || toolName === 'edit' || toolName === 'write') {
          const filePath = shortenPaperclipPaths(String(input.filePath || input.path || state.title || ''))
          const verb = toolName === 'read' ? 'Leu arquivo' : toolName === 'write' ? 'Criou arquivo' : 'Editou arquivo'
          entries.push({
            id: `log-${idx}`,
            time: eventTime,
            kind: status === 'error' ? 'error' : 'tool',
            status,
            title: `${verb}: ${filePath || '(sem caminho)'}`,
            detail: status === 'error' && state.error ? shortenPaperclipPaths(String(state.error)) : undefined,
          })
          return
        }

        if (toolName === 'glob' || toolName === 'grep') {
          const pattern = String(input.pattern || input.query || '')
          const count = state.metadata?.count
          entries.push({
            id: `log-${idx}`,
            time: eventTime,
            kind: status === 'error' ? 'error' : 'tool',
            status,
            title: `Buscou (${toolName}): ${pattern}`,
            detail: typeof count === 'number' ? `${count} resultado(s)` : undefined,
          })
          return
        }

        const inputSummary =
          typeof input.title === 'string'
            ? input.title
            : typeof input.url === 'string'
              ? input.url
              : ''
        entries.push({
          id: `log-${idx}`,
          time: eventTime,
          kind: status === 'error' ? 'error' : 'tool',
          status,
          title: inputSummary ? `${toolName}: ${inputSummary}` : `Ferramenta: ${toolName}`,
          detail:
            status === 'error' && state.error
              ? truncateLogText(String(state.error))
              : typeof state.output === 'string' && state.output.trim()
                ? truncateLogText(shortenPaperclipPaths(state.output))
                : undefined,
        })
        return
      }

      if (inner.type === 'text' && typeof part.text === 'string') {
        entries.push({
          id: `log-${idx}`,
          time: eventTime,
          kind: 'text',
          title: 'Resposta gerada',
          detail: truncateLogText(part.text, 800),
        })
        return
      }

      if (inner.type === 'reasoning' && typeof part.text === 'string') {
        entries.push({
          id: `log-${idx}`,
          time: eventTime,
          kind: 'reasoning',
          title: 'Raciocínio',
          detail: truncateLogText(part.text, 500),
        })
        return
      }

      if (inner.type === 'error' || inner.error) {
        entries.push({
          id: `log-${idx}`,
          time: eventTime,
          kind: 'error',
          title: 'Erro na execução',
          detail: String(inner.error?.message || inner.error || trimmedChunk),
        })
        return
      }
    } catch {
      // Chunk is plain text
    }

    entries.push({
      id: `log-${idx}`,
      time: ts,
      kind: stream === 'stderr' ? 'error' : 'info',
      title: truncateLogText(shortenPaperclipPaths(trimmedChunk), 400),
    })
  })

  return entries
}

export function formatRunLogText(entries: FormattedRunLogEntry[]): string {
  return entries
    .map((e) => {
      const prefix = e.time ? `[${e.time}] ` : ''
      const body = e.detail ? `\n  ${e.detail.replace(/\n/g, '\n  ')}` : ''
      return `${prefix}${e.title}${body}`
    })
    .join('\n')
}