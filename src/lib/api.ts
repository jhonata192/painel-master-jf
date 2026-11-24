import type {
  Agent,
  ChatSession,
  Issue,
  Approval,
  SessionData,
  ChatResponse,
  SendMessageRequest,
  SendMessageResponse,
  CreateChatRequest,
  CreateChatResponse,
  ListChatsResponse,
  ListAgentsResponse,
  ListIssuesResponse,
  ListApprovalsResponse,
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
      credentials: 'include',
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

  async getAgents(companyId: string): Promise<Agent[]> {
    const response = await this.request<ListAgentsResponse>(
      `/companies/${companyId}/agents`
    )
    return response.agents
  }

  async getChats(companyId: string, agentRef: string): Promise<ChatSession[]> {
    const response = await this.request<ListChatsResponse>(
      `/companies/${companyId}/chats/${agentRef}`
    )
    return response.sessions
  }

  async getChatSession(
    companyId: string,
    agentRef: string
  ): Promise<ChatResponse> {
    return this.request<ChatResponse>(
      `/companies/${companyId}/chats/${agentRef}`
    )
  }

  async createChat(
    companyId: string,
    data: CreateChatRequest
  ): Promise<CreateChatResponse> {
    return this.request<CreateChatResponse>(
      `/companies/${companyId}/chats/${data.agentRef}`,
      {
        method: 'POST',
        body: JSON.stringify({ subject: data.subject }),
      }
    )
  }

  async sendMessage(
    issueId: string,
    data: SendMessageRequest
  ): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>(`/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getIssues(companyId: string): Promise<Issue[]> {
    const response = await this.request<ListIssuesResponse>(
      `/companies/${companyId}/issues`
    )
    return response.issues
  }

  async getApprovals(companyId: string): Promise<Approval[]> {
    const response = await this.request<ListApprovalsResponse>(
      `/companies/${companyId}/approvals`
    )
    return response.approvals
  }

  async createApproval(
    companyId: string,
    data: CreateApprovalRequest
  ): Promise<Approval> {
    return this.request<Approval>(`/companies/${companyId}/approvals`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateApproval(
    approvalId: string,
    data: UpdateApprovalRequest
  ): Promise<Approval> {
    return this.request<Approval>(`/approvals/${approvalId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }
}

export const api = new ApiClient()

export function generateClientRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}