import { useState, useEffect, useCallback } from 'react'
import { api, generateClientRequestId } from '../lib/api'
import type { ChatSession, Message, Issue } from '../types/api'

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
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        setSession(null)
        setMessages([])
        setSubject('')
      } else {
        setError(err instanceof Error ? err : new Error('Erro ao carregar conversa'))
      }
    } finally {
      setLoading(false)
    }
  }, [companyId, agentRef])

  const createNewSession = useCallback(
    async (newSubject?: string) => {
      if (!companyId || !agentRef) return
      try {
        setLoading(true)
        const data = await api.createChat(companyId, {
          agentRef,
          subject: newSubject,
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

  const sendMessage = useCallback(
    async (content: string) => {
      if (!session || !content.trim()) return

      const clientRequestId = generateClientRequestId()
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
        setSession(response.session)

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
      const data = await api.getChatSession(companyId, agentRef)
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

  const sendMessageWithRetry = useCallback(
    async (content: string, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          await sendMessage(content)
          return
        } catch (err) {
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
    createNewSession,
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

  useEffect(() => {
    fetchIssues()
  }, [fetchIssues])

  return { issues, loading, error, refetch: fetchIssues }
}

interface UseApprovalsOptions {
  companyId: string
}

export function useApprovals({ companyId }: UseApprovalsOptions) {
  const [approvals, setApprovals] = useState<any[]>([])
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
    async (data: { title: string; description: string; approverAgentId: string; metadata?: Record<string, unknown> }) => {
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
      setApprovals((prev) =>
        prev.map((a) => (a.id === approvalId ? approval : a))
      )
      return approval
    },
    []
  )

  useEffect(() => {
    fetchApprovals()
  }, [fetchApprovals])

  return { approvals, loading, error, refetch: fetchApprovals, createApproval, updateApproval }
}