import { useState, useEffect, useCallback } from 'react'
import { api, generateClientRequestId } from '../lib/api'
import type { ChatSession, Message, Issue, Approval } from '../types/api'

interface UseChatOptions {
  companyId: string
  agentRef: string
  onNewMessage?: (message: Message) => void
}

export function useChat({ companyId, agentRef, onNewMessage }: UseChatOptions) {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [subject, setSubject] = useState('')

  const fetchSession = useCallback(async () => {
    if (!companyId || !agentRef) return
    try {
      setLoading(true)
      const data = await api.getChatSession(companyId, agentRef)
      setSession(data.session)
      setMessages(data.messages)
      setSubject(data.session.subject)
      setError(null)
      if (data.session?.id) {
        api.markIssueRead(data.session.id).catch(() => {})
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        setSession(null)
        setMessages([])
        setSubject('')
        setError(null)
      } else {
        setError(err instanceof Error ? err : new Error('Erro ao carregar conversa'))
      }
    } finally {
      setLoading(false)
    }
  }, [companyId, agentRef])

  const selectSessionById = useCallback(
    async (issueId: string) => {
      if (!issueId) return
      try {
        setLoading(true)
        const data = await api.getSessionByIssueId(issueId, agentRef, companyId)
        setSession(data.session)
        setMessages(data.messages)
        setSubject(data.session.subject)
        setError(null)
        api.markIssueRead(issueId).catch(() => {})
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao abrir conversa'))
      } finally {
        setLoading(false)
      }
    },
    [agentRef, companyId]
  )

  const createNewSession = useCallback(
    async (newSubject?: string, projectId?: string | null) => {
      if (!companyId || !agentRef) return
      try {
        setLoading(true)
        const data = await api.createChat(companyId, {
          agentRef,
          subject: newSubject,
          projectId,
        })
        setSession(data.session)
        setMessages([])
        setSubject(data.session.subject)
        setError(null)
        return data.session
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao criar nova conversa'))
        throw err
      } finally {
        setLoading(false)
      }
    },
    [companyId, agentRef]
  )

  const updateSessionProject = useCallback(
    async (projectId: string | null) => {
      if (!session?.id) return
      const updated = await api.updateIssue(session.id, { projectId })
      setSession((prev) => (prev ? { ...prev, projectId: updated.projectId ?? null } : prev))
      return updated
    },
    [session?.id]
  )

  const sendMessage = useCallback(
    async (content: string, providedRequestId?: string) => {
      if (!session || !content.trim()) return

      const clientRequestId = providedRequestId || generateClientRequestId()
      const optimisticMessage: Message = {
        id: `temp-${clientRequestId}`,
        sessionId: session.id,
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
        clientRequestId,
      }

      setMessages((prev) => [...prev, optimisticMessage])
      setSending(true)
      setError(null)

      try {
        const response = await api.sendMessage(session.id, {
          content: content.trim(),
          clientRequestId,
        })

        setMessages((prev) =>
          prev.map((msg) =>
            msg.clientRequestId === clientRequestId
              ? { ...response.message, clientRequestId }
              : msg
          )
        )

        if (onNewMessage) {
          onNewMessage(response.message)
        }
      } catch (err) {
        setMessages((prev) =>
          prev.filter((msg) => msg.clientRequestId !== clientRequestId)
        )
        setError(err instanceof Error ? err : new Error('Erro ao enviar mensagem'))
        throw err
      } finally {
        setSending(false)
      }
    },
    [session, onNewMessage]
  )

  const refreshSession = useCallback(async () => {
    if (!companyId || !agentRef || !session) return
    try {
      const data = await api.getSessionByIssueId(session.id, agentRef, companyId)
      setMessages(data.messages)
      setSession(data.session)
      setSubject(data.session.subject)
    } catch (err) {
      console.error('Failed to refresh session:', err)
    }
  }, [companyId, agentRef, session])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  // Auto-refresh silencioso a cada 6s enquanto há conversa aberta
  useEffect(() => {
    if (!session?.id) return
    const timer = setInterval(() => {
      refreshSession()
    }, 6000)
    return () => clearInterval(timer)
  }, [session?.id, refreshSession])

  const sendMessageWithRetry = useCallback(
    async (content: string, retries = 3) => {
      const clientRequestId = generateClientRequestId()
      for (let i = 0; i < retries; i++) {
        try {
          await sendMessage(content, clientRequestId)
          return
        } catch (err) {
          const status = (err as { status?: number } | null)?.status
          if (status && status >= 400 && status < 500) throw err
          if (i === retries - 1) throw err
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
        }
      }
    },
    [sendMessage]
  )

  return {
    session,
    messages,
    loading,
    sending,
    error,
    subject,
    fetchSession,
    selectSessionById,
    createNewSession,
    updateSessionProject,
    sendMessage: sendMessageWithRetry,
    refreshSession,
    setSubject,
  }
}

interface UseChatsOptions {
  companyId: string
  agentRef: string
}

export function useChats({ companyId, agentRef }: UseChatsOptions) {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchChats = useCallback(async () => {
    if (!companyId || !agentRef) return
    try {
      setLoading(true)
      const data = await api.getChats(companyId, agentRef)
      setChats(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar histórico'))
    } finally {
      setLoading(false)
    }
  }, [companyId, agentRef])

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  return { chats, loading, error, refetch: fetchChats }
}

interface UseIssuesOptions {
  companyId: string
  agentId?: string
}

export function useIssues({ companyId, agentId }: UseIssuesOptions) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchIssues = useCallback(async () => {
    if (!companyId) return
    try {
      setLoading(true)
      let data = await api.getIssues(companyId)
      if (agentId) {
        data = data.filter((issue) => issue.assigneeAgentId === agentId)
      }
      setIssues(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar tarefas'))
    } finally {
      setLoading(false)
    }
  }, [companyId, agentId])

  const updateIssue = useCallback(
    async (
      issueId: string,
      data: {
        status?: string
        priority?: string
        title?: string
        description?: string
        assigneeAgentId?: string | null
        projectId?: string | null
        goalId?: string | null
        labelIds?: string[]
      }
    ) => {
      const updated = await api.updateIssue(issueId, data)
      setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...i, ...updated } : i)))
      return updated
    },
    []
  )

  const createIssue = useCallback(
    async (data: {
      title: string
      description?: string
      status?: string
      priority?: string
      assigneeAgentId?: string | null
      projectId?: string | null
      goalId?: string | null
      labelIds?: string[]
    }) => {
      if (!companyId) throw new Error('Company ID required')
      const created = await api.createIssue(companyId, data)
      setIssues((prev) => [created, ...prev])
      return created
    },
    [companyId]
  )

  const deleteIssue = useCallback(async (issueId: string) => {
    await api.deleteIssue(issueId)
    setIssues((prev) => prev.filter((i) => i.id !== issueId))
  }, [])

  useEffect(() => {
    fetchIssues()
  }, [fetchIssues])

  return { issues, loading, error, refetch: fetchIssues, updateIssue, createIssue, deleteIssue }
}

interface UseApprovalsOptions {
  companyId: string
}

export function useApprovals({ companyId }: UseApprovalsOptions) {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchApprovals = useCallback(async () => {
    if (!companyId) return
    try {
      setLoading(true)
      const data = await api.getApprovals(companyId)
      setApprovals(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar aprovações'))
    } finally {
      setLoading(false)
    }
  }, [companyId])

  const createApproval = useCallback(
    async (data: { title: string; description: string; approverAgentId?: string; type?: string; metadata?: Record<string, unknown> }) => {
      if (!companyId) throw new Error('Company ID required')
      const approval = await api.createApproval(companyId, data)
      setApprovals((prev) => [approval, ...prev])
      return approval
    },
    [companyId]
  )

  const updateApproval = useCallback(
    async (approvalId: string, data: { status: 'approved' | 'rejected'; comment?: string }) => {
      const approval = await api.updateApproval(approvalId, data)
      setApprovals((prev) => prev.map((a) => (a.id === approvalId ? approval : a)))
      return approval
    },
    []
  )

  const actApproval = useCallback(
    async (
      approvalId: string,
      action: 'approve' | 'reject' | 'request_revision' | 'cancel' | 'resubmit',
      note?: string
    ) => {
      let updated: Approval
      if (action === 'approve') updated = await api.approveApproval(approvalId, note)
      else if (action === 'reject') updated = await api.rejectApproval(approvalId, note)
      else if (action === 'request_revision') updated = await api.requestApprovalRevision(approvalId, note)
      else if (action === 'cancel') updated = await api.cancelApproval(approvalId, note)
      else updated = await api.resubmitApproval(approvalId)
      setApprovals((prev) => prev.map((a) => (a.id === approvalId ? updated : a)))
      return updated
    },
    []
  )

  useEffect(() => {
    fetchApprovals()
  }, [fetchApprovals])

  return { approvals, loading, error, refetch: fetchApprovals, createApproval, updateApproval, actApproval }
}
