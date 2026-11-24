import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import type { SessionData, Agent } from '../types/api'

export function useSession() {
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getSession()
      setSession(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar sessão'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  return { session, loading, error, refetch: fetchSession }
}

export function useAgents(companyId: string | undefined) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchAgents = useCallback(async () => {
    if (!companyId) return
    try {
      setLoading(true)
      const data = await api.getAgents(companyId)
      setAgents(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar agentes'))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  return { agents, loading, error, refetch: fetchAgents }
}