import { useState } from 'react'
import { Clock, CheckCircle, AlertTriangle, Info, XCircle, Filter, Menu } from 'lucide-react'
import { cn, formatTimestamp, getInitials, getAgentColor } from '../lib/utils'
import { useIssues } from '../hooks/useChat'
import type { Agent } from '../types/api'

interface TaskViewProps {
  companyId: string
  agents: Agent[]
  currentAgentId?: string
  showOnlyAssigned?: boolean
}

const statusConfig = {
  open: { label: 'Aberto', icon: Info, color: 'var(--color-status-info)', bg: 'rgba(68, 138, 255, 0.15)' },
  in_progress: { label: 'Em Andamento', icon: Clock, color: 'var(--color-brand-primary)', bg: 'rgba(124, 77, 255, 0.15)' },
  review: { label: 'Em Revisão', icon: AlertTriangle, color: 'var(--color-status-warning)', bg: 'rgba(255, 214, 0, 0.15)' },
  done: { label: 'Concluído', icon: CheckCircle, color: 'var(--color-status-success)', bg: 'rgba(0, 230, 118, 0.15)' },
  cancelled: { label: 'Cancelado', icon: XCircle, color: 'var(--color-status-neutral)', bg: 'rgba(158, 158, 158, 0.15)' },
} as const

type StatusKey = keyof typeof statusConfig

export function TaskView({ companyId, agents, currentAgentId, showOnlyAssigned = false }: TaskViewProps) {
  const { issues, loading, error, refetch } = useIssues({
    companyId,
    agentId: showOnlyAssigned ? currentAgentId : undefined,
  })

  const [filterStatus, setFilterStatus] = useState<StatusKey | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredIssues = issues.filter((issue) => {
    if (filterStatus !== 'all' && issue.status !== filterStatus) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        issue.title.toLowerCase().includes(query) ||
        issue.description?.toLowerCase().includes(query) ||
        issue.id.toLowerCase().includes(query)
      )
    }
    return true
  })

  const getAssignee = (agentId?: string) => {
    if (!agentId) return null
    return agents.find((a) => a.id === agentId) || null
  }

  if (loading && issues.length === 0) {
    return (
      <div className="task-view flex flex-col h-full">
        <div className="task-view__header p-4 border-b border-[var(--color-border-subtle)]">
          <h2 className="text-h3 font-semibold text-[var(--color-text-primary)]">Tarefas</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="skeleton h-8 w-48 rounded-md" />
          <div className="skeleton h-4 w-64 rounded-md mt-2" />
        </div>
      </div>
    )
  }

  return (
    <div className="task-view flex flex-col h-full">
      <div className="task-view__header p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-h3 font-semibold text-[var(--color-text-primary)]">Tarefas</h2>
            <span className="badge badge-brand">{filteredIssues.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" aria-hidden="true" />
              <select
                className="input-base pl-9 pr-8 py-2 text-sm min-w-[140px] bg-[var(--color-bg-surface)] appearance-none"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StatusKey | 'all')}
                aria-label="Filtrar por status"
              >
                <option value="all">Todos os status</option>
                <option value="open">Aberto</option>
                <option value="in_progress">Em Andamento</option>
                <option value="review">Em Revisão</option>
                <option value="done">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            <div className="relative">
              <input
                type="search"
                className="input-base pl-9 pr-4 py-2 text-sm min-w-[200px]"
                placeholder="Buscar tarefas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Buscar tarefas"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={refetch} aria-label="Atualizar">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-inline m-4" role="alert">
          <AlertTriangle className="error-inline__icon" size={20} />
          <div>
            <strong>Erro ao carregar tarefas:</strong> {error.message}
            <button className="btn btn-ghost btn-sm mt-2" onClick={refetch}>
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      <div className="task-view__list flex-1 overflow-y-auto p-4">
        {filteredIssues.length === 0 ? (
          <div className="empty-state flex-1 flex items-center justify-center">
            <svg className="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="64" height="64">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <div className="text-center">
              <h3 className="empty-state__title">Nenhuma tarefa encontrada</h3>
              <p className="empty-state__description">
                {searchQuery || filterStatus !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Nenhuma tarefa atribuída no momento'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-label="Lista de tarefas">
            {filteredIssues.map((issue) => {
              const config = statusConfig[issue.status as StatusKey] || statusConfig.open
              const assignee = getAssignee(issue.assigneeAgentId)
              const StatusIcon = config.icon

              return (
                <article
                  key={issue.id}
                  className={cn(
                    'card task-card',
                    'hover:border-[var(--color-border-default)] hover:shadow-md transition-all duration-fast'
                  )}
                  role="listitem"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                      assignee
                        ? ''
                        : 'bg-[var(--color-bg-surface-elevated)]'
                    )} style={assignee ? { backgroundColor: getAgentColor(assignee.ref) } : {}}>
                      {assignee ? (
                        assignee.avatar ? (
                          <img src={assignee.avatar} alt="" className="w-full h-full rounded-lg" />
                        ) : (
                          <span className="text-sm font-semibold text-[var(--color-text-on-brand)]">
                            {getInitials(assignee.name)}
                          </span>
                        )
                      ) : (
                        <Menu size={20} className="text-[var(--color-text-tertiary)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-body font-medium text-[var(--color-text-primary)] text-truncate">
                            {issue.title}
                          </h3>
                          {issue.description && (
                            <p className="text-[var(--text-caption)] text-[var(--color-text-tertiary)] text-truncate-2 mt-1">
                              {issue.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={cn(
                              'badge',
                              'flex items-center gap-1',
                              `text-[${config.color}]`
                            )}
                            style={{ backgroundColor: config.bg }}
                          >
                            <StatusIcon size={12} aria-hidden="true" />
                            {config.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {assignee && (
                          <div className="flex items-center gap-1.5 text-[var(--text-caption)] text-[var(--color-text-secondary)]">
                            <span className="font-medium text-[var(--color-text-primary)]">{assignee.name}</span>
                            <span className="text-[var(--color-text-tertiary)]">•</span>
                            <span>{assignee.role}</span>
                          </div>
                        )}
                        <time className="text-[var(--text-caption)] text-[var(--color-text-tertiary)]" dateTime={issue.updatedAt}>
                          Atualizado {formatTimestamp(issue.updatedAt)}
                        </time>
                        {issue.priority && (
                          <span className={cn(
                            'badge badge-sm',
                            issue.priority === 'critical' || issue.priority === 'high'
                              ? 'badge-error'
                              : issue.priority === 'medium'
                              ? 'badge-warning'
                              : 'badge-info'
                          )}>
                            {issue.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}