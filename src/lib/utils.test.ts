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
})