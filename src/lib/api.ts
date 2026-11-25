import type {
  ActivityEvent,
  Agent,
  AgentApiKey,
  AiConnection,
  AiConnectionsResponse,
  ApiError,
  Approval,
  ApprovalComment,
  AttentionFeed,
  BudgetOverview,
  ChatSession,
  Company,
  CompanySecret,
  CompanySkill,
  CostByAgent,
  CostByProject,
  CostByProvider,
  CostsSummary,
  CreateApprovalRequest,
  DashboardSummary,
  DecisionItem,
  Goal,
  HealthStatus,
  HeartbeatRun,
  Issue,
  IssueAttachment,
  IssueComment,
  IssueDocument,
  IssueLabel,
  Message,
  OrgNode,
  Project,
  ProjectWorkspace,
  Routine,
  RoutineRun,
  SearchHit,
  SendMessageRequest,
  SendMessageResponse,
  SessionData,
  SidebarBadges,
  UpdateApprovalRequest,
} from '../types/api'

const API_BASE = '/api'

export class PaperclipApiError extends Error {
  code: string
  status: number
  details?: Record<string, unknown>

  constructor(params: ApiError) {
    super(params.message)
    this.name = 'PaperclipApiError'
    this.code = params.code
    this.status = params.status
    this.details = params.details
  }
}

function mapAgent(a: any): Agent {
  return {
    id: a.id,
    name: a.name,
    role: a.role ?? '',
    title: a.title ?? '',
    description: a.title ?? a.role ?? '',
    avatar: a.avatarUrl ?? a.avatar ?? undefined,
    icon: a.icon ?? undefined,
    status: a.status ?? 'idle',
    ref: a.urlKey ?? a.id,
    urlKey: a.urlKey ?? undefined,
    adapterType: a.adapterType ?? undefined,
    adapterConfig: a.adapterConfig ?? undefined,
    runtimeConfig: a.runtimeConfig ?? undefined,
    reportsTo: a.reportsTo ?? null,
    capabilities: a.capabilities ?? null,
    budgetMonthlyCents: a.budgetMonthlyCents ?? 0,
    spentMonthlyCents: a.spentMonthlyCents ?? 0,
    pauseReason: a.pauseReason ?? null,
    errorReason: a.errorReason ?? null,
    lastHeartbeatAt: a.lastHeartbeatAt ?? null,
    permissions: a.permissions ?? undefined,
  }
}

function mapIssue(i: any): Issue {
  return {
    id: i.id,
    identifier: i.identifier ?? undefined,
    issueNumber: i.issueNumber ?? undefined,
    title: i.title ?? '(sem título)',
    status: i.status ?? 'todo',
    priority: i.priority ?? 'medium',
    assigneeAgentId: i.assigneeAgentId ?? null,
    assigneeUserId: i.assigneeUserId ?? null,
    projectId: i.projectId ?? null,
    goalId: i.goalId ?? null,
    parentId: i.parentId ?? null,
    visibility: i.visibility ?? 'open',
    description: i.description ?? null,
    labels: Array.isArray(i.labels) ? i.labels : [],
    labelIds: Array.isArray(i.labelIds) ? i.labelIds : [],
    executionRunId: i.executionRunId ?? null,
    createdAt: i.createdAt ?? '',
    updatedAt: i.updatedAt ?? '',
  }
}

function mapApproval(a: any): Approval {
  const payload = a.payload && typeof a.payload === 'object' ? a.payload : {}
  const title =
    a.title ??
    payload.title ??
    payload.name ??
    (a.type ? `Aprovação: ${String(a.type).replace(/_/g, ' ')}` : 'Solicitação de aprovação')
  const description =
    a.description ??
    payload.description ??
    payload.summary ??
    (Object.keys(payload).length > 0 ? JSON.stringify(payload, null, 2) : '')
  return {
    id: a.id,
    companyId: a.companyId,
    type: a.type ?? 'generic',
    title: String(title),
    description: String(description),
    status: a.status ?? 'pending',
    requestedBy: a.requestedByAgentId ?? a.requestedByUserId ?? a.requestedBy ?? '',
    requestedByName: a.requestedByName ?? '',
    requestedByAgentId: a.requestedByAgentId ?? null,
    requestedByUserId: a.requestedByUserId ?? null,
    approverAgentId: a.approverAgentId ?? undefined,
    approverAgentName: a.approverAgentName ?? undefined,
    payload,
    decisionNote: a.decisionNote ?? null,
    decidedByUserId: a.decidedByUserId ?? null,
    createdAt: a.createdAt ?? '',
    updatedAt: a.updatedAt ?? '',
    decidedAt: a.decidedAt ?? null,
    metadata: a.metadata ?? payload,
  }
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    const headers: Record<string, string> = isFormData
      ? { ...(options.headers as Record<string, string> | undefined) }
      : { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new PaperclipApiError({
        code: errorData.code || 'API_ERROR',
        message: errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        details: errorData.details,
        status: response.status,
      })
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  // ─── Health, Auth & Companies ──────────────────────────────────────────────
  async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health')
  }

  async getSession(): Promise<SessionData> {
    return this.request<SessionData>('/auth/get-session')
  }

  async listCompanies(): Promise<Company[]> {
    return this.request<Company[]>('/companies')
  }

  async getCompany(companyId: string): Promise<Company> {
    return this.request<Company>(`/companies/${companyId}`)
  }

  async createCompany(data: { name: string; description?: string; issuePrefix?: string; budgetMonthlyCents?: number }): Promise<Company> {
    return this.request<Company>('/companies', { method: 'POST', body: JSON.stringify(data) })
  }

  async updateCompany(companyId: string, data: Partial<Company>): Promise<Company> {
    return this.request<Company>(`/companies/${companyId}`, { method: 'PATCH', body: JSON.stringify(data) })
  }

  async archiveCompany(companyId: string): Promise<Company> {
    return this.request<Company>(`/companies/${companyId}/archive`, { method: 'POST', body: '{}' })
  }

  async getSidebarBadges(companyId: string): Promise<SidebarBadges> {
    return this.request<SidebarBadges>(`/companies/${companyId}/sidebar-badges`)
  }

  async search(companyId: string, q: string, limit = 20): Promise<{ results: SearchHit[] }> {
    const raw = await this.request<any>(`/companies/${companyId}/search?q=${encodeURIComponent(q)}&limit=${limit}`)
    return { results: Array.isArray(raw?.results) ? raw.results : [] }
  }

  // ─── Dashboard, Attention & Decisions ──────────────────────────────────────
  async getDashboard(companyId: string): Promise<DashboardSummary> {
    return this.request<DashboardSummary>(`/companies/${companyId}/dashboard`)
  }

  async getAttention(companyId: string, view?: string): Promise<AttentionFeed> {
    const qs = view ? `?view=${encodeURIComponent(view)}` : ''
    return this.request<AttentionFeed>(`/companies/${companyId}/attention${qs}`)
  }

  async claimAttention(companyId: string, sourceKind: string, sourceId: string): Promise<unknown> {
    return this.request(`/companies/${companyId}/attention/${encodeURIComponent(sourceKind)}/${encodeURIComponent(sourceId)}/claim`, {
      method: 'POST',
      body: '{}',
    })
  }

  async closeAttention(companyId: string, sourceKind: string, sourceId: string, note?: string): Promise<unknown> {
    return this.request(`/companies/${companyId}/attention/${encodeURIComponent(sourceKind)}/${encodeURIComponent(sourceId)}/close`, {
      method: 'POST',
      body: JSON.stringify(note ? { note } : {}),
    })
  }

  async listDecisions(companyId: string, status?: string): Promise<DecisionItem[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    return this.request<DecisionItem[]>(`/companies/${companyId}/decisions${qs}`)
  }

  async decideDecision(decisionId: string, optionId: string, inputValues?: Record<string, string>): Promise<unknown> {
    return this.request(`/decisions/${decisionId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ optionId, ...(inputValues ? { inputValues } : {}) }),
    })
  }

  async dismissDecision(decisionId: string, reason?: string): Promise<unknown> {
    return this.request(`/decisions/${decisionId}/dismiss`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    })
  }

  // ─── Agents & Org ──────────────────────────────────────────────────────────
  async getAgents(companyId: string): Promise<Agent[]> {
    const data = await this.request<Agent[] | { agents?: Agent[] }>(`/companies/${companyId}/agents`)
    const list = Array.isArray(data) ? data : (data as any).agents ?? []
    return list.map(mapAgent)
  }

  async getAgent(agentId: string, companyId?: string): Promise<Agent> {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
    const raw = await this.request<any>(`/agents/${encodeURIComponent(agentId)}${qs}`)
    return mapAgent(raw)
  }

  async getOrgChart(companyId: string): Promise<OrgNode[]> {
    return this.request<OrgNode[]>(`/companies/${companyId}/org`)
  }

  async createAgent(companyId: string, data: Record<string, unknown>): Promise<Agent> {
    const raw = await this.request<any>(`/companies/${companyId}/agents`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return mapAgent(raw)
  }

  async updateAgent(agentId: string, data: Record<string, unknown>, companyId?: string): Promise<Agent> {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
    const raw = await this.request<any>(`/agents/${encodeURIComponent(agentId)}${qs}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    return mapAgent(raw)
  }

  async removeAgent(agentId: string): Promise<void> {
    await this.request(`/agents/${encodeURIComponent(agentId)}`, { method: 'DELETE' })
  }

  async pauseAgent(agentId: string): Promise<Agent> {
    const raw = await this.request<any>(`/agents/${encodeURIComponent(agentId)}/pause`, { method: 'POST', body: '{}' })
    return mapAgent(raw)
  }

  async resumeAgent(agentId: string): Promise<Agent> {
    const raw = await this.request<any>(`/agents/${encodeURIComponent(agentId)}/resume`, { method: 'POST', body: '{}' })
    return mapAgent(raw)
  }

  async wakeupAgent(agentId: string, reason?: string): Promise<unknown> {
    return this.request(`/agents/${encodeURIComponent(agentId)}/wakeup`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'on_demand',
        triggerDetail: 'manual',
        reason: reason || 'Solicitado via Painel Web',
      }),
    })
  }

  async clearAgentError(agentId: string): Promise<unknown> {
    return this.request(`/agents/${encodeURIComponent(agentId)}/clear-error`, { method: 'POST', body: '{}' })
  }

  async terminateAgent(agentId: string): Promise<unknown> {
    return this.request(`/agents/${encodeURIComponent(agentId)}/terminate`, { method: 'POST', body: '{}' })
  }

  async resetAgentSession(agentId: string): Promise<unknown> {
    return this.request(`/agents/${encodeURIComponent(agentId)}/runtime-state/reset-session`, { method: 'POST', body: '{}' })
  }

  async getAgentRuntimeState(agentId: string): Promise<Record<string, unknown>> {
    return this.request(`/agents/${encodeURIComponent(agentId)}/runtime-state`)
  }

  async getAgentSkills(agentId: string): Promise<any> {
    return this.request(`/agents/${encodeURIComponent(agentId)}/skills`)
  }

  async syncAgentSkills(agentId: string, desiredSkills?: string[]): Promise<any> {
    return this.request(`/agents/${encodeURIComponent(agentId)}/skills/sync`, {
      method: 'POST',
      body: JSON.stringify(desiredSkills ? { desiredSkills } : {}),
    })
  }

  async getAgentInstructionsBundle(agentId: string): Promise<any> {
    return this.request(`/agents/${encodeURIComponent(agentId)}/instructions-bundle`)
  }

  async getAgentInstructionsFile(agentId: string, path: string): Promise<{ path: string; content: string }> {
    return this.request(`/agents/${encodeURIComponent(agentId)}/instructions-bundle/file?path=${encodeURIComponent(path)}`)
  }

  async saveAgentInstructionsFile(agentId: string, path: string, content: string): Promise<any> {
    return this.request(`/agents/${encodeURIComponent(agentId)}/instructions-bundle/file`, {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    })
  }

  async listAgentKeys(agentId: string): Promise<AgentApiKey[]> {
    return this.request<AgentApiKey[]>(`/agents/${encodeURIComponent(agentId)}/keys`)
  }

  async createAgentKey(agentId: string, name: string, scope = 'agent'): Promise<AgentApiKey> {
    return this.request<AgentApiKey>(`/agents/${encodeURIComponent(agentId)}/keys`, {
      method: 'POST',
      body: JSON.stringify({ name, scope }),
    })
  }

  async revokeAgentKey(agentId: string, keyId: string): Promise<void> {
    await this.request(`/agents/${encodeURIComponent(agentId)}/keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' })
  }

  // ─── Issues (Tarefas) ──────────────────────────────────────────────────────
  async getIssues(companyId: string, params?: { status?: string; projectId?: string; assigneeAgentId?: string; q?: string; limit?: number }): Promise<Issue[]> {
    const qs = new URLSearchParams()
    qs.set('limit', String(params?.limit ?? 100))
    if (params?.status) qs.set('status', params.status)
    if (params?.projectId) qs.set('projectId', params.projectId)
    if (params?.assigneeAgentId) qs.set('assigneeAgentId', params.assigneeAgentId)
    if (params?.q) qs.set('q', params.q)
    const data = await this.request<any>(`/companies/${companyId}/issues?${qs.toString()}`)
    const list = Array.isArray(data) ? data : data.issues ?? data.items ?? []
    return list.map(mapIssue)
  }

  async getIssue(issueId: string): Promise<Issue> {
    const raw = await this.request<any>(`/issues/${issueId}`)
    return mapIssue(raw)
  }

  async updateIssue(issueId: string, data: {
    status?: string
    priority?: string
    title?: string
    description?: string
    assigneeAgentId?: string | null
    projectId?: string | null
    goalId?: string | null
    labelIds?: string[]
  }): Promise<Issue> {
    const raw = await this.request<any>(`/issues/${issueId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    return mapIssue(raw)
  }

  async createIssue(companyId: string, data: {
    title: string
    description?: string
    status?: string
    priority?: string
    assigneeAgentId?: string | null
    projectId?: string | null
    goalId?: string | null
    labelIds?: string[]
  }): Promise<Issue> {
    const raw = await this.request<any>(`/companies/${companyId}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        description: data.description ?? '',
        status: data.status ?? 'todo',
        priority: data.priority ?? 'medium',
        assigneeAgentId: data.assigneeAgentId ?? null,
        ...(data.projectId ? { projectId: data.projectId } : {}),
        ...(data.goalId ? { goalId: data.goalId } : {}),
        ...(data.labelIds ? { labelIds: data.labelIds } : {}),
      }),
    })
    return mapIssue(raw)
  }

  async deleteIssue(issueId: string): Promise<void> {
    await this.request<any>(`/issues/${issueId}`, { method: 'DELETE' })
  }

  async checkoutIssue(issueId: string, agentId: string): Promise<Issue> {
    const raw = await this.request<any>(`/issues/${issueId}/checkout`, {
      method: 'POST',
      body: JSON.stringify({
        agentId,
        expectedStatuses: ['todo', 'backlog', 'blocked', 'in_review'],
      }),
    })
    return mapIssue(raw)
  }

  async releaseIssue(issueId: string): Promise<Issue> {
    const raw = await this.request<any>(`/issues/${issueId}/release`, { method: 'POST', body: '{}' })
    return mapIssue(raw)
  }

  async retryIssue(issueId: string): Promise<unknown> {
    return this.request(`/issues/${issueId}/retry`, {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey: generateClientRequestId(), observedRunId: null }),
    })
  }

  async markIssueRead(issueId: string): Promise<void> {
    await this.request(`/issues/${issueId}/read`, { method: 'POST', body: '{}' })
  }

  async listIssueComments(issueId: string): Promise<IssueComment[]> {
    const data = await this.request<any>(`/issues/${issueId}/comments`)
    return Array.isArray(data) ? data : data?.comments ?? []
  }

  async addIssueComment(issueId: string, body: string): Promise<IssueComment> {
    return this.request<IssueComment>(`/issues/${issueId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
  }

  async deleteIssueComment(issueId: string, commentId: string): Promise<void> {
    await this.request(`/issues/${issueId}/comments/${commentId}`, { method: 'DELETE' })
  }

  async listIssueDocuments(issueId: string): Promise<IssueDocument[]> {
    return this.request<IssueDocument[]>(`/issues/${issueId}/documents`)
  }

  async upsertIssueDocument(issueId: string, key: string, data: { title?: string; format?: string; body: string }): Promise<IssueDocument> {
    return this.request<IssueDocument>(`/issues/${issueId}/documents/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ format: 'markdown', ...data }),
    })
  }

  async lockIssueDocument(issueId: string, key: string): Promise<IssueDocument> {
    return this.request<IssueDocument>(`/issues/${issueId}/documents/${encodeURIComponent(key)}/lock`, { method: 'POST', body: '{}' })
  }

  async unlockIssueDocument(issueId: string, key: string): Promise<IssueDocument> {
    return this.request<IssueDocument>(`/issues/${issueId}/documents/${encodeURIComponent(key)}/unlock`, { method: 'POST', body: '{}' })
  }

  async deleteIssueDocument(issueId: string, key: string): Promise<void> {
    await this.request(`/issues/${issueId}/documents/${encodeURIComponent(key)}`, { method: 'DELETE' })
  }

  async listIssueAttachments(issueId: string): Promise<IssueAttachment[]> {
    return this.request<IssueAttachment[]>(`/issues/${issueId}/attachments`)
  }

  async uploadIssueAttachment(companyId: string, issueId: string, file: File): Promise<IssueAttachment> {
    const form = new FormData()
    form.append('file', file)
    return this.request<IssueAttachment>(`/companies/${companyId}/issues/${issueId}/attachments`, {
      method: 'POST',
      body: form,
    })
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    await this.request(`/attachments/${attachmentId}`, { method: 'DELETE' })
  }

  async listIssueRuns(issueId: string): Promise<HeartbeatRun[]> {
    return this.request<HeartbeatRun[]>(`/issues/${issueId}/runs`)
  }

  async listIssueActivity(issueId: string): Promise<ActivityEvent[]> {
    return this.request<ActivityEvent[]>(`/issues/${issueId}/activity`)
  }

  async listLabels(companyId: string): Promise<IssueLabel[]> {
    return this.request<IssueLabel[]>(`/companies/${companyId}/labels`)
  }

  async createLabel(companyId: string, data: { name: string; color: string }): Promise<IssueLabel> {
    return this.request<IssueLabel>(`/companies/${companyId}/labels`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteLabel(labelId: string): Promise<void> {
    await this.request(`/labels/${labelId}`, { method: 'DELETE' })
  }

  // ─── Chats com Agentes (Nativo + Sessões) ──────────────────────────────────
  async listCompanyChats(companyId: string): Promise<Issue[]> {
    const list = await this.request<any[]>(`/companies/${companyId}/chats`)
    return (Array.isArray(list) ? list : []).map(mapIssue)
  }

  async getAgentChat(companyId: string, agentRef: string): Promise<Issue | null> {
    const raw = await this.request<any | null>(`/companies/${companyId}/chats/${encodeURIComponent(agentRef)}`)
    return raw ? mapIssue(raw) : null
  }

  async ensureAgentChat(companyId: string, agentRef: string): Promise<Issue> {
    const raw = await this.request<any>(`/companies/${companyId}/chats/${encodeURIComponent(agentRef)}`, {
      method: 'POST',
      body: '{}',
    })
    return mapIssue(raw)
  }

  private async resolveAgentId(companyId: string, agentRef: string): Promise<string> {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRe.test(agentRef)) return agentRef
    const agents = await this.getAgents(companyId)
    const found = agents.find((a) => a.ref === agentRef || a.urlKey === agentRef || a.id === agentRef)
    return found?.id ?? agentRef
  }

  async createChat(companyId: string, data: { agentRef: string; subject?: string }): Promise<{ session: ChatSession }> {
    if (!data.subject) {
      const chatIssue = await this.ensureAgentChat(companyId, data.agentRef)
      return {
        session: {
          id: chatIssue.id,
          agentId: chatIssue.assigneeAgentId ?? data.agentRef,
          agentRef: data.agentRef,
          subject: chatIssue.title ?? 'Chat',
          createdAt: chatIssue.createdAt,
          updatedAt: chatIssue.updatedAt,
          messageCount: 0,
        },
      }
    }
    const agentId = await this.resolveAgentId(companyId, data.agentRef)
    const result = await this.request<any>(`/companies/${companyId}/issues`, {
      method: 'POST',
      body: JSON.stringify({
        title: data.subject,
        description: '',
        status: 'todo',
        assigneeAgentId: agentId,
        priority: 'medium',
      }),
    })
    return {
      session: {
        id: result.id,
        agentId,
        agentRef: data.agentRef,
        subject: result.title ?? data.subject,
        createdAt: result.createdAt ?? '',
        updatedAt: result.updatedAt ?? '',
        messageCount: 0,
      },
    }
  }

  async getChatSession(companyId: string, agentRef: string): Promise<{ session: ChatSession; messages: Message[] }> {
    let targetIssue = await this.getAgentChat(companyId, agentRef).catch(() => null)
    if (!targetIssue) {
      const agentId = await this.resolveAgentId(companyId, agentRef)
      const issues = await this.request<any>(`/companies/${companyId}/issues?assigneeAgentId=${encodeURIComponent(agentId)}&limit=10`)
      const list = Array.isArray(issues) ? issues : issues.issues ?? issues.items ?? []
      if (list[0]) targetIssue = mapIssue(list[0])
    }
    if (!targetIssue) {
      throw new Error('404: Nenhuma conversa encontrada')
    }
    const comments = await this.listIssueComments(targetIssue.id).catch(() => [])
    return {
      session: {
        id: targetIssue.id,
        agentId: targetIssue.assigneeAgentId ?? agentRef,
        agentRef,
        subject: targetIssue.title ?? 'Conversa',
        createdAt: targetIssue.createdAt ?? '',
        updatedAt: targetIssue.updatedAt ?? '',
        messageCount: comments.length,
      },
      messages: comments.map((c) => ({
        id: c.id,
        sessionId: targetIssue!.id,
        role: c.authorAgentId ? 'assistant' : 'user',
        content: c.body ?? '',
        timestamp: c.createdAt ?? '',
      })),
    }
  }

  async getSessionByIssueId(issueId: string, agentRef: string): Promise<{ session: ChatSession; messages: Message[] }> {
    const issue = await this.getIssue(issueId)
    const comments = await this.listIssueComments(issueId).catch(() => [])
    return {
      session: {
        id: issue.id,
        agentId: issue.assigneeAgentId ?? agentRef,
        agentRef,
        subject: issue.title ?? 'Conversa',
        createdAt: issue.createdAt ?? '',
        updatedAt: issue.updatedAt ?? '',
        messageCount: comments.length,
      },
      messages: comments.map((c) => ({
        id: c.id,
        sessionId: issue.id,
        role: c.authorAgentId ? 'assistant' : 'user',
        content: c.body ?? '',
        timestamp: c.createdAt ?? '',
      })),
    }
  }

  async getChats(companyId: string, agentRef: string): Promise<ChatSession[]> {
    const agentId = await this.resolveAgentId(companyId, agentRef)
    const [nativeChats, issuesRaw] = await Promise.all([
      this.listCompanyChats(companyId).catch(() => []),
      this.request<any>(`/companies/${companyId}/issues?assigneeAgentId=${encodeURIComponent(agentId)}&limit=20`).catch(() => []),
    ])
    const issueList = Array.isArray(issuesRaw) ? issuesRaw : issuesRaw.issues ?? issuesRaw.items ?? []
    const combined = new Map<string, Issue>()
    for (const c of nativeChats) {
      if ((c as any).conversationAgentId === agentId || c.assigneeAgentId === agentId) {
        combined.set(c.id, c)
      }
    }
    for (const i of issueList) {
      if (!combined.has(i.id)) combined.set(i.id, mapIssue(i))
    }
    return Array.from(combined.values()).map((i) => ({
      id: i.id,
      agentId,
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

  // ─── Approvals (Aprovações) ────────────────────────────────────────────────
  async getApprovals(companyId: string, status?: string): Promise<Approval[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    const data = await this.request<any[]>(`/companies/${companyId}/approvals${qs}`)
    return (Array.isArray(data) ? data : []).map(mapApproval)
  }

  async getApproval(approvalId: string): Promise<Approval> {
    const raw = await this.request<any>(`/approvals/${approvalId}`)
    return mapApproval(raw)
  }

  async createApproval(companyId: string, data: CreateApprovalRequest): Promise<Approval> {
    const raw = await this.request<any>(`/companies/${companyId}/approvals`, {
      method: 'POST',
      body: JSON.stringify({
        type: data.type || 'board_decision',
        requestedByAgentId: data.approverAgentId || undefined,
        payload: {
          title: data.title,
          description: data.description,
          ...(data.payload ?? {}),
        },
      }),
    })
    return mapApproval(raw)
  }

  async approveApproval(approvalId: string, decisionNote?: string): Promise<Approval> {
    const raw = await this.request<any>(`/approvals/${approvalId}/approve`, {
      method: 'POST',
      body: JSON.stringify(decisionNote ? { decisionNote } : {}),
    })
    return mapApproval(raw)
  }

  async rejectApproval(approvalId: string, decisionNote?: string): Promise<Approval> {
    const raw = await this.request<any>(`/approvals/${approvalId}/reject`, {
      method: 'POST',
      body: JSON.stringify(decisionNote ? { decisionNote } : {}),
    })
    return mapApproval(raw)
  }

  async requestApprovalRevision(approvalId: string, decisionNote?: string): Promise<Approval> {
    const raw = await this.request<any>(`/approvals/${approvalId}/request-revision`, {
      method: 'POST',
      body: JSON.stringify(decisionNote ? { decisionNote } : {}),
    })
    return mapApproval(raw)
  }

  async cancelApproval(approvalId: string, reason?: string): Promise<Approval> {
    const raw = await this.request<any>(`/approvals/${approvalId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    })
    return mapApproval(raw)
  }

  async resubmitApproval(approvalId: string, payload?: Record<string, unknown>): Promise<Approval> {
    const raw = await this.request<any>(`/approvals/${approvalId}/resubmit`, {
      method: 'POST',
      body: JSON.stringify(payload ? { payload } : {}),
    })
    return mapApproval(raw)
  }

  async listApprovalComments(approvalId: string): Promise<ApprovalComment[]> {
    return this.request<ApprovalComment[]>(`/approvals/${approvalId}/comments`)
  }

  async addApprovalComment(approvalId: string, body: string): Promise<ApprovalComment> {
    return this.request<ApprovalComment>(`/approvals/${approvalId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    })
  }

  async listApprovalIssues(approvalId: string): Promise<Issue[]> {
    const list = await this.request<any[]>(`/approvals/${approvalId}/issues`)
    return (Array.isArray(list) ? list : []).map(mapIssue)
  }

  async updateApproval(approvalId: string, data: UpdateApprovalRequest): Promise<Approval> {
    return data.status === 'approved'
      ? this.approveApproval(approvalId, data.comment)
      : this.rejectApproval(approvalId, data.comment)
  }

  // ─── Projects & Goals ──────────────────────────────────────────────────────
  async listProjects(companyId: string, includeArchived = false): Promise<Project[]> {
    const qs = includeArchived ? '?includeArchived=true' : ''
    return this.request<Project[]>(`/companies/${companyId}/projects${qs}`)
  }

  async createProject(companyId: string, data: Partial<Project>): Promise<Project> {
    return this.request<Project>(`/companies/${companyId}/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateProject(projectId: string, data: Partial<Project>, companyId?: string): Promise<Project> {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
    return this.request<Project>(`/projects/${encodeURIComponent(projectId)}${qs}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteProject(projectId: string, companyId?: string): Promise<void> {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
    await this.request(`/projects/${encodeURIComponent(projectId)}${qs}`, { method: 'DELETE' })
  }

  async listProjectWorkspaces(projectId: string, companyId?: string): Promise<ProjectWorkspace[]> {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
    return this.request<ProjectWorkspace[]>(`/projects/${encodeURIComponent(projectId)}/workspaces${qs}`)
  }

  async createProjectWorkspace(projectId: string, data: { name: string; cwd?: string; repoUrl?: string }, companyId?: string): Promise<ProjectWorkspace> {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
    return this.request<ProjectWorkspace>(`/projects/${encodeURIComponent(projectId)}/workspaces${qs}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteProjectWorkspace(projectId: string, workspaceId: string, companyId?: string): Promise<void> {
    const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''
    await this.request(`/projects/${encodeURIComponent(projectId)}/workspaces/${encodeURIComponent(workspaceId)}${qs}`, {
      method: 'DELETE',
    })
  }

  async listGoals(companyId: string): Promise<Goal[]> {
    return this.request<Goal[]>(`/companies/${companyId}/goals`)
  }

  async createGoal(companyId: string, data: Partial<Goal>): Promise<Goal> {
    return this.request<Goal>(`/companies/${companyId}/goals`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateGoal(goalId: string, data: Partial<Goal>): Promise<Goal> {
    return this.request<Goal>(`/goals/${goalId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteGoal(goalId: string): Promise<void> {
    await this.request(`/goals/${goalId}`, { method: 'DELETE' })
  }

  // ─── Routines (Cron & Automações) ──────────────────────────────────────────
  async listRoutines(companyId: string): Promise<Routine[]> {
    return this.request<Routine[]>(`/companies/${companyId}/routines`)
  }

  async getRoutine(routineId: string): Promise<Routine> {
    return this.request<Routine>(`/routines/${routineId}`)
  }

  async createRoutine(companyId: string, data: Record<string, unknown>): Promise<Routine> {
    return this.request<Routine>(`/companies/${companyId}/routines`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateRoutine(routineId: string, data: Record<string, unknown>): Promise<Routine> {
    return this.request<Routine>(`/routines/${routineId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async runRoutine(routineId: string, payload?: Record<string, unknown>): Promise<RoutineRun> {
    return this.request<RoutineRun>(`/routines/${routineId}/run`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    })
  }

  async listRoutineRuns(routineId: string, limit = 30): Promise<RoutineRun[]> {
    return this.request<RoutineRun[]>(`/routines/${routineId}/runs?limit=${limit}`)
  }

  async createRoutineTrigger(routineId: string, data: Record<string, unknown>): Promise<any> {
    return this.request(`/routines/${routineId}/triggers`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateRoutineTrigger(triggerId: string, data: Record<string, unknown>): Promise<any> {
    return this.request(`/routine-triggers/${triggerId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteRoutineTrigger(triggerId: string): Promise<void> {
    await this.request(`/routine-triggers/${triggerId}`, { method: 'DELETE' })
  }

  // ─── Heartbeat Runs & Activity ─────────────────────────────────────────────
  async listRuns(companyId: string, limit = 50, agentId?: string): Promise<HeartbeatRun[]> {
    const qs = new URLSearchParams({ limit: String(limit) })
    if (agentId) qs.set('agentId', agentId)
    return this.request<HeartbeatRun[]>(`/companies/${companyId}/heartbeat-runs?${qs.toString()}`)
  }

  async listLiveRuns(companyId: string): Promise<HeartbeatRun[]> {
    return this.request<HeartbeatRun[]>(`/companies/${companyId}/live-runs`)
  }

  async getRunLog(runId: string, offset = 0, limitBytes = 128000): Promise<{ runId: string; content: string; nextOffset?: number }> {
    return this.request(`/heartbeat-runs/${runId}/log?offset=${offset}&limitBytes=${limitBytes}`)
  }

  async cancelRun(runId: string): Promise<HeartbeatRun> {
    return this.request<HeartbeatRun>(`/heartbeat-runs/${runId}/cancel`, {
      method: 'POST',
      body: '{}',
    })
  }

  async listActivity(companyId: string, filters?: { agentId?: string; entityType?: string; action?: string }): Promise<ActivityEvent[]> {
    const qs = new URLSearchParams()
    if (filters?.agentId) qs.set('agentId', filters.agentId)
    if (filters?.entityType) qs.set('entityType', filters.entityType)
    if (filters?.action) qs.set('action', filters.action)
    const str = qs.toString()
    return this.request<ActivityEvent[]>(`/companies/${companyId}/activity${str ? `?${str}` : ''}`)
  }

  // ─── Costs & Budgets ───────────────────────────────────────────────────────
  async getCostsSummary(companyId: string): Promise<CostsSummary> {
    return this.request<CostsSummary>(`/companies/${companyId}/costs/summary`)
  }

  async getCostsByAgent(companyId: string): Promise<CostByAgent[]> {
    return this.request<CostByAgent[]>(`/companies/${companyId}/costs/by-agent`)
  }

  async getCostsByProject(companyId: string): Promise<CostByProject[]> {
    return this.request<CostByProject[]>(`/companies/${companyId}/costs/by-project`)
  }

  async getCostsByProvider(companyId: string): Promise<CostByProvider[]> {
    return this.request<CostByProvider[]>(`/companies/${companyId}/costs/by-provider`)
  }

  async getQuotaWindows(companyId: string): Promise<any[]> {
    return this.request<any[]>(`/companies/${companyId}/costs/quota-windows`)
  }

  async getBudgetsOverview(companyId: string): Promise<BudgetOverview> {
    return this.request<BudgetOverview>(`/companies/${companyId}/budgets/overview`)
  }

  async upsertBudgetPolicy(companyId: string, data: {
    scopeType: 'company' | 'agent' | 'project'
    scopeId: string
    amount: number
    windowKind: 'calendar_month_utc' | 'lifetime'
    warnPercent?: number
    hardStopEnabled?: boolean
  }): Promise<unknown> {
    return this.request(`/companies/${companyId}/budgets/policies`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async resolveBudgetIncident(companyId: string, incidentId: string, action: 'keep_paused' | 'raise_and_resume', amount?: number): Promise<unknown> {
    return this.request(`/companies/${companyId}/budget-incidents/${encodeURIComponent(incidentId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, ...(amount !== undefined ? { amount } : {}) }),
    })
  }

  // ─── Secrets, AI Connections, Skills, Instance Settings ────────────────────
  async listSecrets(companyId: string): Promise<CompanySecret[]> {
    return this.request<CompanySecret[]>(`/companies/${companyId}/secrets`)
  }

  async createSecret(companyId: string, data: { name: string; value: string; description?: string; provider?: string }): Promise<CompanySecret> {
    return this.request<CompanySecret>(`/companies/${companyId}/secrets`, {
      method: 'POST',
      body: JSON.stringify({ provider: 'local_encrypted', ...data }),
    })
  }

  async rotateSecret(secretId: string, value: string): Promise<CompanySecret> {
    return this.request<CompanySecret>(`/secrets/${secretId}/rotate`, {
      method: 'POST',
      body: JSON.stringify({ value }),
    })
  }

  async toggleSecret(secretId: string, enable: boolean): Promise<CompanySecret> {
    return this.request<CompanySecret>(`/secrets/${secretId}/${enable ? 'enable' : 'disable'}`, {
      method: 'PATCH',
      body: '{}',
    })
  }

  async deleteSecret(secretId: string): Promise<void> {
    await this.request(`/secrets/${secretId}`, { method: 'DELETE' })
  }

  async listAiConnections(companyId: string): Promise<AiConnectionsResponse> {
    return this.request<AiConnectionsResponse>(`/companies/${companyId}/ai-connections`)
  }

  async createAiConnection(companyId: string, data: Record<string, unknown>): Promise<AiConnection> {
    return this.request<AiConnection>(`/companies/${companyId}/ai-connections`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async probeAiConnectionUsage(companyId: string, connectionId: string, grantId?: string): Promise<any> {
    const qs = grantId ? `?grantId=${encodeURIComponent(grantId)}` : ''
    return this.request(`/companies/${companyId}/ai-connections/${connectionId}/usage${qs}`)
  }

  async listSkills(companyId: string): Promise<CompanySkill[]> {
    return this.request<CompanySkill[]>(`/companies/${companyId}/skills`)
  }

  async createSkill(companyId: string, data: { name: string; slug?: string; description?: string; body?: string }): Promise<CompanySkill> {
    return this.request<CompanySkill>(`/companies/${companyId}/skills`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async importSkillFromSource(companyId: string, source: string): Promise<any> {
    return this.request(`/companies/${companyId}/skills/import`, {
      method: 'POST',
      body: JSON.stringify({ source }),
    })
  }

  async deleteSkill(companyId: string, skillId: string): Promise<void> {
    await this.request(`/companies/${companyId}/skills/${encodeURIComponent(skillId)}`, { method: 'DELETE' })
  }

  async getInstanceSettings(): Promise<any> {
    return this.request('/instance/settings')
  }

  async updateInstanceSettings(patch: Record<string, unknown>): Promise<any> {
    return this.request('/instance/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }
}

export const api = new ApiClient()

export function generateClientRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}
