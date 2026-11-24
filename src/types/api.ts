export interface Agent {
  id: string
  name: string
  role: string
  description: string
  avatar?: string
  ref: string
}

export interface ChatSession {
  id: string
  agentId: string
  agentRef: string
  subject: string
  createdAt: string
  updatedAt: string
  messageCount: number
  lastMessage?: Message
}

export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  clientRequestId?: string
  metadata?: Record<string, unknown>
}

export interface Issue {
  id: string
  title: string
  status: 'open' | 'in_progress' | 'review' | 'done' | 'cancelled'
  assigneeAgentId?: string
  assigneeAgentName?: string
  assigneeAgentRef?: string
  createdAt: string
  updatedAt: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
}

export interface Approval {
  id: string
  title: string
  description: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  requestedBy: string
  requestedByName: string
  approverAgentId?: string
  approverAgentName?: string
  createdAt: string
  updatedAt: string
  decidedAt?: string
  metadata?: Record<string, unknown>
}

export interface Company {
  id: string
  name: string
  slug: string
}

export interface SessionData {
  user: {
    id: string
    name: string
    email: string
    avatar?: string
  }
  company: Company
  boardBootstrap: {
    agents: Agent[]
    currentAgent?: Agent
  }
}

export interface ChatResponse {
  session: ChatSession
  messages: Message[]
}

export interface SendMessageRequest {
  content: string
  clientRequestId: string
}

export interface SendMessageResponse {
  message: Message
  session: ChatSession
}

export interface CreateChatRequest {
  agentRef: string
  subject?: string
}

export interface CreateChatResponse {
  session: ChatSession
}

export interface ListChatsResponse {
  sessions: ChatSession[]
}

export interface ListAgentsResponse {
  agents: Agent[]
}

export interface ListIssuesResponse {
  issues: Issue[]
}

export interface ListApprovalsResponse {
  approvals: Approval[]
}

export interface CreateApprovalRequest {
  title: string
  description: string
  approverAgentId: string
  metadata?: Record<string, unknown>
}

export interface UpdateApprovalRequest {
  status: 'approved' | 'rejected'
  comment?: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
  status: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}