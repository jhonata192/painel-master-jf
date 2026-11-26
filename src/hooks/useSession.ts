import { useState, useEffect, useCallback, useRef } from 'react'
import { api, PaperclipApiError } from '../lib/api'
import type { SessionData, Agent, Company, SidebarBadges } from '../types/api'

const ACTIVE_COMPANY_KEY = 'painel_active_company_id'

export function useSession() {
  const [session, setSession] = useState<SessionData | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_COMPANY_KEY) || ''
    } catch {
      return ''
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const hasLoadedRef = useRef(false)
  const activeCompanyIdRef = useRef(activeCompanyId)
  activeCompanyIdRef.current = activeCompanyId

  const fetchSession = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) setLoading(true)
      const raw = await api.getSession()
      const [companyList, isAdmin] = await Promise.all([
        api.listCompanies().catch(() => [] as Company[]),
        api
          .listAdminUsers('')
          .then(() => true)
          .catch(() => false),
      ])

      setCompanies(companyList)

      const selectedCompany =
        companyList.find((c) => c.id === activeCompanyIdRef.current) ||
        companyList[0] ||
        null

      if (selectedCompany && selectedCompany.id !== activeCompanyIdRef.current) {
        setActiveCompanyId(selectedCompany.id)
        try {
          localStorage.setItem(ACTIVE_COMPANY_KEY, selectedCompany.id)
        } catch {
          // ignore storage errors
        }
      }

      const adapted: SessionData = {
        ...(raw as any),
        user: {
          id: (raw as any).user?.id ?? '',
          name: (raw as any).user?.name ?? 'Usuário',
          email: (raw as any).user?.email ?? '',
          avatar: (raw as any).user?.image ?? null,
          isInstanceAdmin: isAdmin,
        },
        company: selectedCompany as Company,
      }
      hasLoadedRef.current = true
      setSession(adapted)
      setError(null)
    } catch (err) {
      if (err instanceof PaperclipApiError && err.status === 401) {
        hasLoadedRef.current = false
        setSession(null)
        setCompanies([])
        setError(null)
      } else {
        setError(err instanceof Error ? err : new Error('Erro ao carregar sessão'))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const switchCompany = useCallback((companyId: string) => {
    setActiveCompanyId(companyId)
    try {
      localStorage.setItem(ACTIVE_COMPANY_KEY, companyId)
    } catch {
      // ignore storage errors
    }
  }, [])

  const signOut = useCallback(async () => {
    await api.signOut().catch(() => {})
    hasLoadedRef.current = false
    setSession(null)
    setCompanies([])
    setActiveCompanyId('')
    try {
      localStorage.removeItem(ACTIVE_COMPANY_KEY)
    } catch {
      // ignore storage errors
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  useEffect(() => {
    setSession((prev) => {
      if (!prev) return prev
      const nextCompany = companies.find((c) => c.id === activeCompanyId)
      if (!nextCompany || (prev.company?.id === nextCompany.id && prev.company?.name === nextCompany.name)) {
        return prev
      }
      return { ...prev, company: nextCompany }
    })
  }, [activeCompanyId, companies])

  return {
    session,
    companies,
    switchCompany,
    signOut,
    loading,
    error,
    refetch: fetchSession,
  }
}

export function useAgents(companyId: string | undefined) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const hasLoadedRef = useRef(false)

  const fetchAgents = useCallback(async () => {
    if (!companyId) return
    const isInitial = !hasLoadedRef.current
    try {
      if (isInitial) setLoading(true)
      const data = await api.getAgents(companyId)
      setAgents(data)
      setError(null)
      hasLoadedRef.current = true
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar agentes'))
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    hasLoadedRef.current = false
    fetchAgents()
    const timer = setInterval(fetchAgents, 8000)
    return () => clearInterval(timer)
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
