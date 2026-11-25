export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'terminated' | 'pending_approval'

export interface Agent {
  id: string
  name: string
  role: string
  description: string
  avatar?: string
  ref: string
  urlKey?: string
  title?: string
  status?: AgentStatus | string
  icon?: string
  adapterType?: string
  adapterConfig?: Record<string, unknown>
  runtimeConfig?: Record<string, unknown>
  reportsTo?: string | null
  capabilities?: string | null
  budgetMonthlyCents?: number
  spentMonthlyCents?: number
  pauseReason?: string | null
  errorReason?: string | null
  lastHeartbeatAt?: string | null
  permissions?: {
    canCreateAgents?: boolean
    canCreateSkills?: boolean
    canAssignTasks?: boolean
    trustPreset?: string
  }
}

export interface OrgNode {
  id: string
  name: string
  role: string
  status: string
  reports: OrgNode[]
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

export type IssueStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'blocked'
  | 'cancelled'
  | 'open'
  | 'review'

export type IssuePriority = 'low' | 'medium' | 'high' | 'critical' | 'urgent'

export interface IssueLabel {
  id: string
  companyId: string
  name: string
  color: string
  createdAt?: string
}

export interface Issue {
  id: string
  identifier?: string
  issueNumber?: number
  title: string
  status: IssueStatus | string
  assigneeAgentId?: string | null
  assigneeAgentName?: string
  assigneeAgentRef?: string
  assigneeUserId?: string | null
  projectId?: string | null
  goalId?: string | null
  parentId?: string | null
  visibility?: 'open' | 'restricted' | string
  createdAt: string
  updatedAt: string
  description?: string | null
  priority?: IssuePriority | string
  labels?: IssueLabel[]
  labelIds?: string[]
  executionRunId?: string | null
}

export interface IssueComment {
  id: string
  issueId: string
  authorAgentId?: string | null
  authorUserId?: string | null
  body: string
  createdAt: string
  updatedAt?: string
}

export interface IssueDocument {
  id?: string
  issueId?: string
  key: string
  title?: string | null
  format?: string
  body: string
  locked?: boolean
  revisionNumber?: number
  createdAt?: string
  updatedAt?: string
}

export interface IssueAttachment {
  id: string
  issueId: string
  filename: string
  mimeType?: string
  sizeBytes?: number
  url?: string
  createdAt: string
}

export interface Approval {
  id: string
  companyId?: string
  type?: string
  title: string
  description: string
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested' | 'cancelled'
  requestedBy: string
  requestedByName: string
  requestedByAgentId?: string | null
  requestedByUserId?: string | null
  approverAgentId?: string
  approverAgentName?: string
  payload?: Record<string, unknown>
  decisionNote?: string | null
  decidedByUserId?: string | null
  createdAt: string
  updatedAt: string
  decidedAt?: string | null
  metadata?: Record<string, unknown>
}

export interface ApprovalComment {
  id: string
  approvalId: string
  authorAgentId?: string | null
  authorUserId?: string | null
  body: string
  createdAt: string
}

export interface Company {
  id: string
  name: string
  slug?: string
  description?: string | null
  status?: string
  issuePrefix?: string
  brandColor?: string | null
  budgetMonthlyCents?: number
  spentMonthlyCents?: number
}

export interface HealthStatus {
  status: 'ok' | 'starting'
  version?: string
  serverVersion?: string
  commit?: string | null
  deploymentMode?: string
  deploymentExposure?: string
  authReady?: boolean
}

export interface DashboardSummary {
  companyId: string
  agents: { active: number; running: number; paused: number; error: number }
  tasks: { open: number; inProgress: number; blocked: number; done: number }
  costs: { monthSpendCents: number; monthBudgetCents: number; monthUtilizationPercent: number }
  pendingApprovals: number
  budgets?: { activeIncidents: number; pendingApprovals: number; pausedAgents: number; pausedProjects: number }
  runActivity: Array<{
    date: string
    succeeded: number
    failed: number
    recovered: number
    other: number
    total: number
    failedByErrorCode?: Record<string, number>
  }>
}

export interface SidebarBadges {
  inbox: number
  approvals: number
  failedRuns: number
  joinRequests: number
  unreadIssueIds?: string[]
}

export interface AttentionItem {
  id: string
  sourceKind: string
  sourceId: string
  title: string
  summary?: string | null
  severity?: string
  status?: string
  agentId?: string | null
  issueId?: string | null
  createdAt: string
  updatedAt?: string
}

export interface AttentionFeed {
  companyId: string
  generatedAt: string
  totalCount: number
  deskBadgeCount: number
  viewCounts: Record<string, number>
  countsBySourceKind: Record<string, number>
  items: AttentionItem[]
}

export interface DecisionOption {
  id: string
  label: string
  description?: string
}

export interface DecisionItem {
  id: string
  companyId: string
  originAgentId: string
  originIssueId: string
  title: string
  body: string
  options: DecisionOption[]
  status: string
  chosenOptionId?: string | null
  createdAt: string
  expiresAt?: string
}

export interface Project {
  id: string
  companyId: string
  goalId?: string | null
  name: string
  description?: string | null
  status: string
  leadAgentId?: string | null
  targetDate?: string | null
  color?: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectWorkspace {
  id: string
  projectId: string
  name: string
  cwd?: string | null
  repoUrl?: string | null
  repoRef?: string | null
  isPrimary?: boolean
  runtimeServices?: Array<{
    id: string
    name: string
    status: string
    url?: string | null
  }>
}

export interface Goal {
  id: string
  companyId: string
  parentId?: string | null
  ownerAgentId?: string | null
  title: string
  description?: string | null
  level: 'company' | 'team' | 'agent' | string
  status: 'planned' | 'active' | 'achieved' | 'cancelled' | string
  createdAt: string
  updatedAt: string
}

export interface RoutineTrigger {
  id: string
  kind: 'schedule' | 'webhook' | string
  label?: string | null
  enabled: boolean
  cronExpression?: string | null
  timezone?: string | null
  nextRunAt?: string | null
  lastFiredAt?: string | null
  lastResult?: string | null
}

export interface RoutineRun {
  id: string
  routineId: string
  triggerId?: string | null
  source: string
  status: string
  triggeredAt: string
  completedAt?: string | null
  failureReason?: string | null
  linkedIssueId?: string | null
  linkedIssue?: {
    id: string
    identifier?: string
    title: string
    status: string
  } | null
}

export interface Routine {
  id: string
  companyId: string
  projectId?: string | null
  title: string
  description?: string | null
  assigneeAgentId?: string | null
  priority: string
  status: 'active' | 'paused' | 'archived' | string
  concurrencyPolicy?: string
  lastTriggeredAt?: string | null
  triggers?: RoutineTrigger[]
  lastRun?: RoutineRun | null
  createdAt: string
  updatedAt: string
}

export interface HeartbeatRun {
  id: string
  companyId: string
  agentId: string
  agentName?: string
  scopeKind?: string
  issueId?: string | null
  invocationSource: string
  triggerDetail?: string | null
  status: string
  inputTokens?: number | null
  cachedInputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
  costUsd?: number | null
  startedAt?: string | null
  finishedAt?: string | null
  error?: string | null
  errorCode?: string | null
  stdoutExcerpt?: string | null
  stderrExcerpt?: string | null
  createdAt: string
}

export interface ActivityEvent {
  id: string
  companyId: string
  actorType: string
  actorId: string
  action: string
  entityType: string
  entityId: string
  agentId?: string | null
  runId?: string | null
  details?: Record<string, unknown> | null
  createdAt: string
}

export interface CostsSummary {
  companyId: string
  eventCount: number
  unpricedEventCount: number
  unknownBillingEventCount: number
  estimatedEventCount: number
  pendingRunCount: number
  pricingComplete: boolean
  spendCents: number
  spendCentsExact?: string
  budgetCents: number
  utilizationPercent: number
}

export interface CostByAgent {
  agentId: string
  agentName: string
  agentStatus?: string
  eventCount: number
  costCents: number
  costCentsExact?: string
  inputTokens: number
  cachedInputTokens?: number
  outputTokens: number
}

export interface CostByProject {
  projectId: string | null
  projectName: string | null
  eventCount: number
  costCents: number
}

export interface CostByProvider {
  provider: string
  biller: string
  billingType?: string
  model: string
  costCents: number
  inputTokens?: number
  outputTokens?: number
}

export interface BudgetOverview {
  companyId: string
  policies: Array<{
    id: string
    scopeType: string
    scopeId: string
    scopeName?: string
    metric?: string
    amount: number
    windowKind: string
    warnPercent?: number
    hardStopEnabled?: boolean
    isActive?: boolean
  }>
  activeIncidents: Array<{
    id: string
    scopeType: string
    scopeId: string
    scopeName?: string
    amountLimit: number
    amountObserved: number
    status: string
    createdAt: string
  }>
  pausedAgentCount: number
  pausedProjectCount: number
}

export interface CompanySecret {
  id: string
  companyId: string
  scope: string
  key: string
  name: string
  provider: string
  status: 'active' | 'disabled' | 'archived' | string
  latestVersion?: number
  description?: string | null
  createdAt: string
  updatedAt: string
}

export interface AiConnection {
  id: string
  grantId?: string
  companyId?: string
  provider: string
  method: string
  name?: string
  label?: string
  status?: string
  usageProbeSupported?: boolean
  routing?: {
    kind?: string
    protocol?: string
    baseUrl?: string
    models?: Array<string | { id: string; label?: string }>
  }
  models?: Array<string | { id: string; label?: string }>
  createdAt?: string
}

export interface AiConnectionsResponse {
  currentUserId?: string
  pools?: unknown[]
  canManageConnections?: boolean
  connections: AiConnection[]
}

export interface CompanySkill {
  id: string
  companyId: string
  key: string
  slug: string
  name: string
  description?: string | null
  folderPath?: string | null
  status?: string
  sourceType?: string
  createdAt?: string
  updatedAt?: string
}

export interface AgentApiKey {
  id: string
  name: string
  scope?: string
  createdAt: string
  revokedAt?: string | null
  token?: string
}

export interface SearchHit {
  id: string
  type: 'issue' | 'agent' | 'project' | 'goal' | 'document' | string
  title: string
  subtitle?: string | null
  identifier?: string | null
  status?: string | null
}

export interface SessionData {
  user: {
    id: string
    name: string
    email: string
    avatar?: string | null
  }
  company: Company
  boardBootstrap?: {
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
  approverAgentId?: string
  type?: string
  payload?: Record<string, unknown>
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
