import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import type { SessionData, Agent, Company, SidebarBadges } from '../types/api'

const DEFAULT_COMPANY_ID = 'c65f4f1a-7314-4d4d-8194-bccea4a950c9'

export function useSession() {
  const [session, setSession] = useState<SessionData | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => {
    try {
      return localStorage.getItem('painel_active_company_id') || DEFAULT_COMPANY_ID
    } catch {
      return DEFAULT_COMPANY_ID
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true)
      const [raw, companyList] = await Promise.all([
        api.getSession(),
        api.listCompanies().catch(() => [] as Company[]),
      ])

      const resolvedCompanies =
        companyList.length > 0
          ? companyList
          : [{ id: DEFAULT_COMPANY_ID, name: 'Master JF Soluções Digitais' }]

      setCompanies(resolvedCompanies)

      const selectedCompany =
        resolvedCompanies.find((c) => c.id === activeCompanyId) ||
        resolvedCompanies[0]

      const adapted: SessionData = {
        ...(raw as any),
        user: {
          id: (raw as any).user?.id ?? '',
          name: (raw as any).user?.name ?? 'Usuário',
          email: (raw as any).user?.email ?? '',
          avatar: (raw as any).user?.image ?? null,
        },
        company: selectedCompany,
      }
      setSession(adapted)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar sessão'))
    } finally {
      setLoading(false)
    }
  }, [activeCompanyId])

  const switchCompany = useCallback((companyId: string) => {
    setActiveCompanyId(companyId)
    try {
      localStorage.setItem('painel_active_company_id', companyId)
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  return {
    session,
    companies,
    switchCompany,
    loading,
    error,
    refetch: fetchSession,
  }
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

export function useSidebarBadges(companyId: string | undefined) {
  const [badges, setBadges] = useState<SidebarBadges>({
    inbox: 0,
    approvals: 0,
    failedRuns: 0,
    joinRequests: 0,
    unreadIssueIds: [],
  })

  const refetch = useCallback(async () => {
    if (!companyId) return
    try {
      const data = await api.getSidebarBadges(companyId)
      setBadges(data)
    } catch {
      // silent
    }
  }, [companyId])

  useEffect(() => {
    refetch()
    const id = setInterval(refetch, 15000)
    return () => clearInterval(id)
  }, [refetch])

  return { badges, refetch }
}
