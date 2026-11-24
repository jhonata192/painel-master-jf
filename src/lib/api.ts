import type {
  Agent,
  Approval,
  SessionData,
  SendMessageRequest,
  SendMessageResponse,
  CreateApprovalRequest,
  UpdateApprovalRequest,
  ApiError,
} from '../types/api'

const API_BASE = '/api'

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const error: ApiError = {
        code: errorData.code || 'API_ERROR',
        message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        details: errorData.details,
        status: response.status,
      }
      throw error
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  async getSession(): Promise<SessionData> {
    return this.request<SessionData>('/auth/get-session')
  }

  // Paperclip retorna lista direta de agentes
  async getAgents(companyId: string): Promise<Agent[]> {
    const data = await this.request<Agent[] | { agents?: Agent[] }>(
      `/companies/${companyId}/agents`
    )
    const list = Array.isArray(data) ? data : (data as any).agents ?? []
    return list.map((a: any) => ({
      id: a.id,
      name: a.name,
      role: a.role ?? '',
      title: a.title ?? '',
      description: a.title ?? a.role ?? '',
      avatar: a.avatarUrl ?? null,
      icon: a.icon ?? null,
      status: a.status ?? 'idle',
      ref: a.urlKey ?? a.id,
    }))
  }

  async getIssues(companyId: string): Promise<any[]> {
    const data = await this.request<any>(
      `/companies/${companyId}/issues?limit=50`
    )
    const list = Array.isArray(data) ? data : data.issues ?? data.items ?? []
    return list.map((i: any) => ({
      id: i.id,
      title: i.title ?? '(sem título)',
      status: i.status ?? 'open',
      priority: i.priority ?? 'medium',
      assigneeAgentId: i.assigneeAgentId ?? null,
      description: i.description ?? null,
      createdAt: i.createdAt ?? '',
      updatedAt: i.updatedAt ?? '',
    }))
  }

  async getApprovals(_companyId: string): Promise<Approval[]> {
    return []
  }

  // Chat: cria uma issue de chat com o agente (conversa no Paperclip)
  async createChat(companyId: string, data: { agentRef: string; subject?: string }): Promise<any> {
    const result = await this.request<any>(`/companies/${companyId}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title: data.subject || 'Nova conversa',
        description: '',
        status: 'todo',
        assigneeAgentId: data.agentRef, // agentRef aqui é na verdade o agentId
        priority: 'medium',
      }),
    })
    return {
      session: {
        id: result.id,
        agentId: data.agentRef,
        agentRef: data.agentRef,
        subject: result.title ?? data.subject ?? 'Nova conversa',
        createdAt: result.createdAt ?? '',
        updatedAt: result.updatedAt ?? '',
        messageCount: 0,
      },
    }
  }

  // Chat: obtém sessão de chat (issue) existente
  async getChatSession(companyId: string, agentRef: string): Promise<any> {
    // Busca issues recentes atribuídas ao agente
    const issues = await this.request<any>(
      `/companies/${companyId}/issues?assigneeAgentId=${agentRef}&limit=10`
    )
    const list = Array.isArray(issues) ? issues : issues.issues ?? issues.items ?? []
    const latest = list[0]
    if (!latest) {
      throw new Error('404: Nenhuma conversa encontrada')
    }
    // Busca comentários da issue
    const comments = await this.request<any>(`/issues/${latest.id}/comments`).catch(() => [])
    const msgs = Array.isArray(comments) ? comments : comments.comments ?? comments.items ?? []
    return {
      session: {
        id: latest.id,
        agentId: agentRef,
        agentRef,
        subject: latest.title ?? 'Conversa',
        createdAt: latest.createdAt ?? '',
        updatedAt: latest.updatedAt ?? '',
        messageCount: msgs.length,
      },
      messages: msgs.map((c: any) => ({
        id: c.id,
        sessionId: latest.id,
        role: c.authorAgentId ? 'assistant' : 'user',
        content: c.body ?? '',
        timestamp: c.createdAt ?? '',
      })),
    }
  }

  // Chat: histórico de issues/conversas do agente
  async getChats(companyId: string, agentRef: string): Promise<any[]> {
    const data = await this.request<any>(
      `/companies/${companyId}/issues?assigneeAgentId=${agentRef}&limit=20`
    )
    const list = Array.isArray(data) ? data : data.issues ?? data.items ?? []
    return list.map((i: any) => ({
      id: i.id,
      agentId: agentRef,
      agentRef,
      subject: i.title ?? 'Conversa',
      createdAt: i.createdAt ?? '',
      updatedAt: i.updatedAt ?? '',
      messageCount: 0,
    }))
  }

  async sendMessage(issueId: string, data: SendMessageRequest): Promise<SendMessageResponse> {
    const comment = await this.request<any>(`/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: data.content }),
    })
    return {
      message: {
        id: comment.id ?? `msg-${Date.now()}`,
        sessionId: issueId,
        role: 'user',
        content: data.content,
        timestamp: comment.createdAt ?? new Date().toISOString(),
        clientRequestId: data.clientRequestId,
      },
      session: {
        id: issueId,
        agentId: '',
        agentRef: '',
        subject: '',
        createdAt: '',
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      },
    }
  }

  async createApproval(_companyId: string, _data: CreateApprovalRequest): Promise<Approval> {
    throw new Error('Não implementado')
  }

  async updateApproval(_approvalId: string, _data: UpdateApprovalRequest): Promise<Approval> {
    throw new Error('Não implementado')
  }
}

export const api = new ApiClient()

export function generateClientRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}
