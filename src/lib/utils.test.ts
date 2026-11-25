import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  cn,
  formatTimestamp,
  formatTime,
  getInitials,
  getAgentColor,
  debounce,
  throttle,
  sleep,
  retry,
  parseRunLog,
  formatRunLogText,
} from './utils'

describe('utils', () => {
  describe('cn', () => {
    it('combines class names', () => {
      expect(cn('a', 'b', 'c')).toBe('a b c')
    })

    it('handles conditional classes', () => {
      expect(cn('base', true && 'active', false && 'inactive')).toBe('base active')
    })

    it('handles object syntax', () => {
      expect(cn({ active: true, disabled: false })).toBe('active')
    })
  })

  describe('formatTimestamp', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-11-24T12:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns "Agora" for very recent timestamps', () => {
      const now = new Date('2026-11-24T12:00:00Z').toISOString()
      expect(formatTimestamp(now)).toBe('Agora')
    })

    it('returns minutes for recent timestamps', () => {
      const fiveMinsAgo = new Date('2026-11-24T11:55:00Z').toISOString()
      expect(formatTimestamp(fiveMinsAgo)).toBe('5min')
    })

    it('returns hours for older timestamps', () => {
      const twoHoursAgo = new Date('2026-11-24T10:00:00Z').toISOString()
      expect(formatTimestamp(twoHoursAgo)).toBe('2h')
    })

    it('returns days for older timestamps', () => {
      const threeDaysAgo = new Date('2026-11-21T12:00:00Z').toISOString()
      expect(formatTimestamp(threeDaysAgo)).toBe('3d')
    })

    it('returns formatted date for very old timestamps', () => {
      const oldDate = new Date('2026-10-01T12:00:00Z').toISOString()
      expect(formatTimestamp(oldDate)).toBe('01/10/2026')
    })
  })

  describe('formatTime', () => {
    it('formats time correctly', () => {
      const date = new Date('2026-11-24T14:30:00Z').toISOString()
      expect(formatTime(date)).toMatch(/^\d{2}:\d{2}$/)
    })
  })

  describe('getInitials', () => {
    it('returns initials from full name', () => {
      expect(getInitials('João Silva')).toBe('JS')
      expect(getInitials('Maria da Silva')).toBe('MS')
      expect(getInitials('Ana')).toBe('A')
    })

    it('handles extra spaces', () => {
      expect(getInitials('  João   Silva  ')).toBe('JS')
    })

    it('limits to 2 characters', () => {
      expect(getInitials('João Silva Santos')).toBe('JS')
    })
  })

  describe('getAgentColor', () => {
    it('returns consistent color for same agent', () => {
      const color1 = getAgentColor('agent-1')
      const color2 = getAgentColor('agent-1')
      expect(color1).toBe(color2)
    })

    it('returns different colors for different agents', () => {
      const color1 = getAgentColor('agent-1')
      const color2 = getAgentColor('agent-2')
      expect(color1).not.toBe(color2)
    })

    it('returns valid hsl color', () => {
      const color = getAgentColor('agent-1')
      expect(color).toMatch(/^hsl\(\d+,\s*\d+%,\s*\d+%\)$/)
    })
  })

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('delays function execution', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced('arg1')
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledWith('arg1')
    })

    it('only calls last invocation', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced('arg1')
      debounced('arg2')
      debounced('arg3')

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('arg3')
    })
  })

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('limits function calls', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled('arg1')
      throttled('arg2')
      throttled('arg3')

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('arg1')

      vi.advanceTimersByTime(100)
      throttled('arg4')
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('sleep', () => {
    it('resolves after specified time', async () => {
      const start = Date.now()
      await sleep(50)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(40)
    })
  })

  describe('retry', () => {
    it('retries failed function', async () => {
      let attempts = 0
      const fn = vi.fn().mockImplementation(() => {
        attempts++
        if (attempts < 3) return Promise.reject(new Error('fail'))
        return Promise.resolve('success')
      })

      const result = await retry(fn, 3, 10)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('throws after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      await expect(retry(fn, 2, 10)).rejects.toThrow('fail')
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe('parseRunLog', () => {
    it('parses Paperclip/OpenCode NDJSON into intuitive readable entries', () => {
      const raw = [
        JSON.stringify({
          ts: '2026-11-25T12:28:38.217Z',
          stream: 'stderr',
          chunk: '[paperclip] Injected OpenCode skill "paperclipai/paperclip/paperclip" into /tmp/x/.claude/skills\n',
        }),
        JSON.stringify({
          ts: '2026-11-25T12:29:00.559Z',
          stream: 'stdout',
          chunk: JSON.stringify({ type: 'step_start', timestamp: 1795609740558 }),
        }),
        JSON.stringify({
          ts: '2026-11-25T12:29:04.480Z',
          stream: 'stdout',
          chunk: JSON.stringify({
            type: 'tool_use',
            part: {
              tool: 'bash',
              state: {
                status: 'completed',
                input: {
                  command:
                    'cd /paperclip/instances/default/projects/c65f4f1a-7314-4d4d-8194-bccea4a950c9/300dadda-f9d8-4e94-804c-3e26a33604cf/acessilia-ufg && git status',
                },
                output: 'On branch main',
              },
            },
          }),
        }),
        JSON.stringify({
          ts: '2026-11-25T12:30:08.270Z',
          stream: 'stdout',
          chunk: JSON.stringify({
            type: 'step_finish',
            part: { tokens: { total: 10608, input: 1697, output: 121, cache: { read: 8768 } } },
          }),
        }),
      ].join('\n')

      const entries = parseRunLog(raw)
      expect(entries.map((e) => e.title)).toEqual([
        'Skill carregada: paperclipai/paperclip/paperclip',
        'Comando: git status',
        'Passo concluído',
      ])
      expect(entries[1].detail).toContain('On branch main')
      expect(entries[2].detail).toContain('10.608 tokens')
      expect(formatRunLogText(entries)).toContain('Comando: git status')
    })

    it('reassembles split stdout chunks, strips ANSI codes, and ignores trailing partial NDJSON', () => {
      const fullInner = JSON.stringify({
        type: 'tool_use',
        part: {
          tool: 'bash',
          state: {
            status: 'completed',
            input: { command: 'cd acessilia-ufg && git diff main' },
            output: 'diff --git a/src/app.js b/src/app.js',
          },
        },
      }) + '\n'
      const half1 = fullInner.slice(0, 60)
      const half2 = fullInner.slice(60)

      const raw = [
        JSON.stringify({
          ts: '2026-11-25T12:17:49.000Z',
          stream: 'stderr',
          chunk: '[91m[1mError: [0mSession not found\n',
        }),
        JSON.stringify({ ts: '2026-11-25T12:18:37.000Z', stream: 'stdout', chunk: half1 }),
        JSON.stringify({ ts: '2026-11-25T12:18:37.100Z', stream: 'stdout', chunk: half2 }),
        '{"ts":"2026-11-25T15:19:11.042Z","stream":"stdout","chunk":"{\"type\":\"tool_use\",\"part\":{\"tool\":\"bash\",\"state\":{\"input\":{\"command\":\"cd acessilia-ufg && npm test\"',
      ].join('\n')

      const entries = parseRunLog(raw)
      expect(entries[0].title).toBe('Error: Session not found')
      expect(entries[1].title).toBe('Comando: git diff main')
      expect(entries[1].detail).toContain('diff --git')
      expect(entries[2].title).toBe('Comando: npm test')
    })

    it('formats todowrite checklists into readable task items instead of raw JSON', () => {
      const raw = JSON.stringify({
        ts: '2026-11-25T16:35:05.000Z',
        stream: 'stdout',
        chunk:
          JSON.stringify({
            type: 'tool_use',
            part: {
              tool: 'todowrite',
              state: {
                status: 'completed',
                input: {
                  todos: [
                    { content: 'Update courses.ejs modal', status: 'completed', priority: 'high' },
                    { content: 'Update classes.ejs modal', status: 'in_progress', priority: 'high' },
                    { content: 'Run tests', status: 'pending', priority: 'medium' },
                  ],
                },
              },
            },
          }) + '\n',
      })

      const entries = parseRunLog(raw)
      expect(entries).toHaveLength(1)
      expect(entries[0].title).toBe('Plano de tarefas (1/3 concluída(s))')
      expect(entries[0].detail).toContain('✓ Update courses.ejs modal')
      expect(entries[0].detail).toContain('⏳ Update classes.ejs modal')
      expect(entries[0].detail).toContain('○ Run tests')
    })

    it('labels internal OpenCode task calls clearly as Subagente interno (OpenCode)', () => {
      const raw = JSON.stringify({
        ts: '2026-11-25T16:47:52.000Z',
        stream: 'stdout',
        chunk:
          JSON.stringify({
            type: 'tool_use',
            part: {
              tool: 'task',
              state: {
                status: 'completed',
                input: {
                  description: 'RH: Avaliar contratação',
                  prompt: 'Como Camila...',
                },
                output: 'Parecer gerado internamente.',
              },
            },
          }) + '\n',
      })

      const entries = parseRunLog(raw)
      expect(entries).toHaveLength(1)
      expect(entries[0].title).toBe('Subagente interno (OpenCode): RH: Avaliar contratação')
      expect(entries[0].detail).toBe('Parecer gerado internamente.')
    })
  })
})