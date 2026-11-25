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

function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\[(?:0|1|4|3\d|9\d)(?:;\d+)*m/g, '')
}

function shortenPaperclipPaths(text: string): string {
  return text.replace(
    /\/paperclip\/instances\/[^/\s]+\/projects\/[0-9a-f-]+\/[0-9a-f-]+\//gi,
    ''
  )
}

function cleanLogString(text: string): string {
  return shortenPaperclipPaths(stripAnsi(text))
}

function truncateLogText(text: string, max = 500): string {
  const clean = cleanLogString(text).trim()
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
  const rawLines = raw.split('\n').filter((line) => line.trim().length > 0)
  const assembled: Array<{ ts: string; stream: string; text: string }> = []
  const streamBuffers: Record<string, string> = {}
  const streamTimestamps: Record<string, string> = {}

  for (const rawLine of rawLines) {
    let parsedOuter = false
    try {
      const outer = JSON.parse(rawLine) as Record<string, unknown>
      if (outer && typeof outer === 'object' && typeof outer.chunk === 'string') {
        parsedOuter = true
        const stream = typeof outer.stream === 'string' ? outer.stream : 'stdout'
        const ts =
          typeof outer.ts === 'string' || typeof outer.ts === 'number'
            ? formatLogTime(outer.ts)
            : streamTimestamps[stream] || ''
        const prevBuf = streamBuffers[stream] ?? ''
        if (prevBuf.trim().startsWith('{')) {
          try {
            JSON.parse(prevBuf.trim())
            assembled.push({ ts: streamTimestamps[stream] || ts, stream, text: prevBuf.trim() })
            streamBuffers[stream] = ''
          } catch {
            // Keep incomplete buffer so the next chunk completes it
          }
        }
        if (ts) streamTimestamps[stream] = ts

        const combined = (streamBuffers[stream] ?? '') + outer.chunk
        const parts = combined.split('\n')
        const tail = parts.pop() ?? ''
        for (const p of parts) {
          if (p.trim()) {
            assembled.push({ ts: streamTimestamps[stream] || ts, stream, text: p })
          }
        }
        if (tail.trim().startsWith('{')) {
          try {
            JSON.parse(tail.trim())
            assembled.push({ ts: streamTimestamps[stream] || ts, stream, text: tail.trim() })
            streamBuffers[stream] = ''
          } catch {
            streamBuffers[stream] = tail
          }
        } else {
          streamBuffers[stream] = tail
        }
      } else if (outer && typeof outer === 'object' && typeof outer.type === 'string') {
        parsedOuter = true
        assembled.push({
          ts:
            typeof outer.ts === 'string' || typeof outer.ts === 'number'
              ? formatLogTime(outer.ts)
              : '',
          stream: typeof outer.stream === 'string' ? outer.stream : 'stdout',
          text: rawLine,
        })
      }
    } catch {
      // Fall through to partial / plain handling
    }

    if (!parsedOuter) {
      const trimmed = rawLine.trim()
      if (trimmed.startsWith('{"ts":') || trimmed.startsWith('{"type":')) {
        // Truncated JSON record at chunk boundary
        const cmdMatch = trimmed.match(/"command":"([^"\\]*(?:\\.[^"\\]*)*)"/)
        if (cmdMatch) {
          const cmd = cleanLogString(cmdMatch[1].replace(/\\"/g, '"')).replace(/^cd\s+[^\s&]+\s*&&\s*/i, '')
          assembled.push({
            ts: '',
            stream: 'stdout',
            text: JSON.stringify({
              type: 'tool_use',
              part: {
                tool: 'bash',
                state: { status: 'running', input: { command: cmd } },
              },
            }),
          })
        }
      } else {
        assembled.push({ ts: '', stream: 'stdout', text: rawLine })
      }
    }
  }

  for (const [stream, rem] of Object.entries(streamBuffers)) {
    if (rem.trim()) {
      assembled.push({ ts: streamTimestamps[stream] || '', stream, text: rem })
    }
  }

  const entries: FormattedRunLogEntry[] = []

  assembled.forEach(({ ts, stream, text }, idx) => {
    const trimmedChunk = cleanLogString(text).trim()
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
        kind: 'info',
        title: cleanLogString(trimmedChunk.replace(/^\[paperclip\]\s*/i, '')),
      })
      return
    }

    // Inner JSON event (OpenCode / Claude / Paperclip stream)
    try {
      const inner = JSON.parse(text.trim()) as Record<string, any>
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
          const cleanedCmd = cleanLogString(rawCmd).replace(/^cd\s+[^\s&]+\s*&&\s*/i, '')
          const detailRaw = status === 'error' ? state.error : state.output
          entries.push({
            id: `log-${idx}`,
            time: eventTime,
            kind: status === 'error' ? 'error' : 'tool',
            status,
            title: `Comando: ${truncateLogText(cleanedCmd || 'bash', 160)}`,
            detail: typeof detailRaw === 'string' && detailRaw.trim() ? truncateLogText(detailRaw) : undefined,
          })
          return
        }

        if (toolName === 'read' || toolName === 'edit' || toolName === 'write') {
          const filePath = cleanLogString(String(input.filePath || input.path || state.title || ''))
          const verb = toolName === 'read' ? 'Leu arquivo' : toolName === 'write' ? 'Criou arquivo' : 'Editou arquivo'
          entries.push({
            id: `log-${idx}`,
            time: eventTime,
            kind: status === 'error' ? 'error' : 'tool',
            status,
            title: `${verb}: ${filePath || '(sem caminho)'}`,
            detail: status === 'error' && state.error ? cleanLogString(String(state.error)) : undefined,
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

        if (toolName === 'todowrite' || toolName === 'todoread') {
          let todos: Array<{ content?: string; status?: string }> = []
          if (Array.isArray(input.todos)) {
            todos = input.todos
          } else if (typeof state.output === 'string' && state.output.trim().startsWith('[')) {
            try {
              const parsedTodos = JSON.parse(state.output)
              if (Array.isArray(parsedTodos)) todos = parsedTodos
            } catch {
              // Ignore malformed todo JSON
            }
          }
          const completedCount = todos.filter((t) => t?.status === 'completed').length
          const lines = todos
            .map((t) => {
              const content = cleanLogString(String(t?.content || '')).trim()
              if (!content) return ''
              if (t?.status === 'completed') return `✓ ${content}`
              if (t?.status === 'in_progress') return `⏳ ${content}`
              if (t?.status === 'cancelled') return `✕ ${content}`
              return `○ ${content}`
            })
            .filter(Boolean)

          entries.push({
            id: `log-${idx}`,
            time: eventTime,
            kind: status === 'error' ? 'error' : 'tool',
            status,
            title:
              todos.length > 0
                ? `Plano de tarefas (${completedCount}/${todos.length} concluída(s))`
                : 'Plano de tarefas atualizado',
            detail: lines.length > 0 ? truncateLogText(lines.join('\n'), 1200) : undefined,
          })
          return
        }

        if (toolName === 'task') {
          const desc = cleanLogString(String(input.description || input.title || '')).trim()
          const detailRaw =
            status === 'error'
              ? state.error
              : typeof state.output === 'string' && state.output.trim()
                ? state.output
                : typeof input.prompt === 'string' && input.prompt.trim()
                  ? input.prompt
                  : ''
          entries.push({
            id: `log-${idx}`,
            time: eventTime,
            kind: status === 'error' ? 'error' : 'tool',
            status,
            title: desc
              ? `Subagente interno (OpenCode): ${truncateLogText(desc, 140)}`
              : 'Subagente interno (OpenCode)',
            detail: detailRaw ? truncateLogText(String(detailRaw)) : undefined,
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
                ? truncateLogText(state.output)
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
          detail: cleanLogString(String(inner.error?.message || inner.error || trimmedChunk)),
        })
        return
      }
    } catch {
      // Chunk is plain text or partial non-JSON remainder
    }

    if (trimmedChunk.startsWith('{"type":') || trimmedChunk.startsWith('{"ts":')) {
      return
    }

    entries.push({
      id: `log-${idx}`,
      time: ts,
      kind: stream === 'stderr' ? 'error' : 'info',
      title: truncateLogText(trimmedChunk, 400),
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