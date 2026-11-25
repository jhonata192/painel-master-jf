import { useState, useRef, useEffect } from 'react'
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
  Filter,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  RotateCcw,
  Loader2,
  AlertCircle,
  User,
  ExternalLink,
} from 'lucide-react'
import { cn, formatTimestamp, getInitials, getAgentColor } from '../lib/utils'
import { api } from '../lib/api'
import { useIssues } from '../hooks/useChat'
import { useToastHelpers } from '../context/ToastContext'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import type { Agent, Issue, IssueLabel, Project } from '../types/api'

interface TaskViewProps {
  companyId: string
  agents: Agent[]
  currentAgentId?: string
  showOnlyAssigned?: boolean
}

const statusConfig = {
  backlog: { label: 'Backlog', icon: Info, color: 'var(--color-status-neutral)', bg: 'rgba(158,158,158,0.15)' },
  todo: { label: 'A Fazer', icon: Info, color: 'var(--color-status-info)', bg: 'rgba(68,138,255,0.15)' },
  in_progress: { label: 'Em Andamento', icon: Clock, color: 'var(--color-brand-primary)', bg: 'rgba(124,77,255,0.15)' },
  in_review: { label: 'Em Revisão', icon: AlertTriangle, color: 'var(--color-status-warning)', bg: 'rgba(255,214,0,0.15)' },
  done: { label: 'Concluído', icon: CheckCircle, color: 'var(--color-status-success)', bg: 'rgba(0,230,118,0.15)' },
  blocked: { label: 'Bloqueado', icon: AlertCircle, color: 'var(--color-status-error)', bg: 'rgba(255,82,82,0.15)' },
  cancelled: { label: 'Cancelado', icon: XCircle, color: 'var(--color-status-neutral)', bg: 'rgba(158,158,158,0.15)' },
} as const

type StatusKey = keyof typeof statusConfig

const priorityConfig: Record<string, { label: string; badge: string }> = {
  urgent: { label: 'Urgente', badge: 'badge-error' },
  critical: { label: 'Crítico', badge: 'badge-error' },
  high: { label: 'Alto', badge: 'badge-error' },
  medium: { label: 'Médio', badge: 'badge-warning' },
  low: { label: 'Baixo', badge: 'badge-info' },
}

const STATUS_OPTIONS = Object.entries(statusConfig).map(([k, v]) => ({ value: k, label: v.label }))
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixo' },
  { value: 'medium', label: 'Médio' },
  { value: 'high', label: 'Alto' },
  { value: 'urgent', label: 'Urgente' },
]

interface TaskModalProps {
  agents: Agent[]
  projects: Project[]
  initialData?: Issue
  onSave: (data: {
    title: string
    description: string
    status: string
    priority: string
    assigneeAgentId?: string | null
    projectId?: string | null
  }) => Promise<void>
  onClose: () => void
}

function TaskModal({ agents, projects, initialData, onSave, onClose }: TaskModalProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [status, setStatus] = useState<string>(initialData?.status ?? 'todo')
  const [priority, setPriority] = useState<string>(initialData?.priority ?? 'medium')
  const [assigneeAgentId, setAssigneeAgentId] = useState(initialData?.assigneeAgentId ?? '')
  const [projectId, setProjectId] = useState(initialData?.projectId ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const isEdit = !!initialData

  useEffect(() => {
    titleRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErr('O título é obrigatório')
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    setErr('')
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeAgentId: assigneeAgentId || null,
        projectId: projectId || null,
      })
      onClose()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal-overlay-flex"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-card">
        <div className="modal__header">
          <h2 id="task-modal-title" className="modal__title">
            {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
          </h2>
          <button className="modal__close" onClick={onClose} aria-label="Fechar modal">
            <XCircle size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal__body stack-lg" noValidate>
          <div>
            <label htmlFor="task-title" className="label">
              Título <span aria-hidden="true" className="text-error">*</span>
            </label>
            <input
              id="task-title"
              ref={titleRef}
              type="text"
              className="input-base"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setErr('')
              }}
              placeholder="Ex: Revisar relatório mensal"
              aria-required="true"
              aria-invalid={!!err}
              aria-describedby={err ? 'task-title-error' : undefined}
            />
            {err && (
              <p id="task-title-error" className="error-text" role="alert">
                {err}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="task-desc" className="label">
              Descrição
            </label>
            <textarea
              id="task-desc"
              className="input-base"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes opcionais..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-status" className="label">
                Status
              </label>
              <select
                id="task-status"
                className="input-base"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-priority" className="label">
                Prioridade
              </label>
              <select
                id="task-priority"
                className="input-base"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-assignee" className="label">
                Responsável
              </label>
              <select
                id="task-assignee"
                className="input-base"
                value={assigneeAgentId}
                onChange={(e) => setAssigneeAgentId(e.target.value)}
              >
                <option value="">Nenhum</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-project" className="label">
                Projeto
              </label>
              <select
                id="task-project"
                className="input-base"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">Nenhum</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal__footer" style={{ padding: '12px 0 0 0' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span>Salvando...</span>
                </>
              ) : isEdit ? (
                'Salvar'
              ) : (
                'Criar Tarefa'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface StatusDropdownProps {
  current: string
  onSelect: (status: string) => void
  disabled?: boolean
}

function StatusDropdown({ current, onSelect, disabled }: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const config = statusConfig[current as StatusKey] ?? statusConfig.todo
  const StatusIcon = config.icon

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="badge"
        style={{
          backgroundColor: config.bg,
          color: config.color,
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          minHeight: '28px',
        }}
        onClick={() => !disabled && setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Status: ${config.label}. Clique para alterar`}
        title="Alterar status"
      >
        <StatusIcon size={12} aria-hidden="true" />
        <span>{config.label}</span>
        <ChevronDown size={11} aria-hidden="true" />
      </button>

      {open && (
        <ul role="listbox" aria-label="Selecionar status" className="dropdown-menu">
          {STATUS_OPTIONS.map((opt) => {
            const cfg = statusConfig[opt.value as StatusKey]
            const Icon = cfg.icon
            return (
              <li key={opt.value}>
                <button
                  role="option"
                  aria-selected={opt.value === current}
                  className="dropdown-item"
                  style={{ fontWeight: opt.value === current ? 600 : 400 }}
                  onClick={() => {
                    onSelect(opt.value)
                    setOpen(false)
                  }}
                >
                  <Icon size={14} style={{ color: cfg.color }} aria-hidden="true" />
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function TaskView({ companyId, agents, currentAgentId, showOnlyAssigned = false }: TaskViewProps) {
  const { issues, loading, error, refetch, updateIssue, createIssue, deleteIssue } = useIssues({
    companyId,
    agentId: showOnlyAssigned ? currentAgentId : undefined,
  })
  const { success, error: showError } = useToastHelpers()

  const [projects, setProjects] = useState<Project[]>([])
  const [labels, setLabels] = useState<IssueLabel[]>([])
  const [filterStatus, setFilterStatus] = useState<StatusKey | 'all'>('all')
  const [filterAgent, setFilterAgent] = useState<string>('all')
  const [filterProject, setFilterProject] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null)
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    api.listProjects(companyId).then(setProjects).catch(() => {})
    api.listLabels(companyId).then(setLabels).catch(() => {})
  }, [companyId])

  const filteredIssues = issues.filter((issue) => {
    if (filterStatus !== 'all' && issue.status !== filterStatus) return false
    if (filterAgent !== 'all' && issue.assigneeAgentId !== filterAgent) return false
    if (filterProject !== 'all' && issue.projectId !== filterProject) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        issue.title.toLowerCase().includes(q) ||
        (issue.identifier ?? '').toLowerCase().includes(q) ||
        (issue.description ?? '').toLowerCase().includes(q) ||
        issue.id.toLowerCase().includes(q)
      )
    }
    return true
  })

  const getAssignee = (agentId?: string | null) =>
    agentId ? agents.find((a) => a.id === agentId) ?? null : null

  const handleStatusChange = async (issueId: string, newStatus: string) => {
    setUpdatingId(issueId)
    try {
      await updateIssue(issueId, { status: newStatus })
      success(
        'Status atualizado',
        `Tarefa movida para "${statusConfig[newStatus as StatusKey]?.label ?? newStatus}"`
      )
    } catch (err) {
      showError('Erro ao atualizar', err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCreate = async (data: {
    title: string
    description: string
    status: string
    priority: string
    assigneeAgentId?: string | null
    projectId?: string | null
  }) => {
    await createIssue(data)
    success('Tarefa criada', `"${data.title}" adicionada à lista`)
  }

  const handleEdit = async (data: {
    title: string
    description: string
    status: string
    priority: string
    assigneeAgentId?: string | null
    projectId?: string | null
  }) => {
    if (!editingIssue) return
    await updateIssue(editingIssue.id, data)
    success('Tarefa atualizada', `"${data.title}" foi salva`)
  }

  const handleDelete = async (issueId: string, title: string) => {
    if (!confirm(`Excluir a tarefa "${title}"?\n\nEssa ação não pode ser desfeita.`)) return
    setDeletingId(issueId)
    try {
      await deleteIssue(issueId)
      if (detailIssue?.id === issueId) setDetailIssue(null)
      success('Tarefa excluída', `"${title}" foi removida`)
    } catch (err) {
      showError('Erro ao excluir', err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading && issues.length === 0) {
    return (
      <div className="view-shell">
        <div className="view-header">
          <h2 className="text-h3 text-primary">Tarefas</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-5" aria-busy="true" aria-label="Carregando tarefas">
          <div className="skeleton" style={{ height: '32px', width: '200px' }} aria-hidden="true" />
          <div className="skeleton mt-2" style={{ height: '16px', width: '260px' }} aria-hidden="true" />
        </div>
      </div>
    )
  }

  return (
    <div className="view-shell">
      <div className="view-header">
        <div className="flex items-center gap-3">
          <h2 className="text-h3 text-primary">Tarefas</h2>
          <span className="badge badge-brand" aria-live="polite" aria-atomic="true">
            {filteredIssues.length}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap" role="search" aria-label="Filtrar e buscar tarefas">
          <div className="relative">
            <Filter
              size={15}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-tertiary)',
              }}
            />
            <select
              className="input-base"
              style={{ minHeight: '38px', padding: '6px 12px 6px 32px', fontSize: '0.875rem', width: 'auto' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusKey | 'all')}
              aria-label="Filtrar por status"
            >
              <option value="all">Todos os status</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <select
            className="input-base"
            style={{ minHeight: '38px', padding: '6px 12px', fontSize: '0.875rem', width: 'auto', maxWidth: '180px' }}
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            aria-label="Filtrar por responsável"
          >
            <option value="all">Todos os agentes</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {projects.length > 0 && (
            <select
              className="input-base"
              style={{ minHeight: '38px', padding: '6px 12px', fontSize: '0.875rem', width: 'auto', maxWidth: '170px' }}
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              aria-label="Filtrar por projeto"
            >
              <option value="all">Todos os projetos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <input
            type="search"
            className="input-base"
            style={{ minHeight: '38px', padding: '6px 12px', fontSize: '0.875rem', width: '200px' }}
            placeholder="Buscar tarefas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Buscar tarefas"
          />

          <button
            className="btn btn-ghost btn-icon"
            onClick={refetch}
            aria-label="Atualizar lista de tarefas"
            title="Atualizar"
          >
            <RotateCcw size={18} />
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingIssue(null)
              setShowModal(true)
            }}
          >
            <Plus size={16} aria-hidden="true" />
            Nova Tarefa
          </button>
        </div>
      </div>

      <div className="view-body">
        {error && (
          <div className="error-inline mb-4" role="alert">
            <AlertCircle size={16} className="error-inline__icon" aria-hidden="true" />
            <div>
              <strong>Erro ao carregar tarefas:</strong> {error.message}
              <div>
                <button className="btn btn-ghost btn-sm mt-2" onClick={refetch}>
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        {filteredIssues.length === 0 && !loading ? (
          <div className="empty-state">
            <CheckCircle className="empty-state__icon" size={48} aria-hidden="true" />
            <h3 className="empty-state__title">
              {searchQuery || filterStatus !== 'all' ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa ainda'}
            </h3>
            <p className="empty-state__description">
              {searchQuery || filterStatus !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Clique em "Nova Tarefa" para criar a primeira'}
            </p>
            <div className="empty-state__action">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditingIssue(null)
                  setShowModal(true)
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Nova Tarefa
              </button>
            </div>
          </div>
        ) : (
          <div className="stack-md" role="list" aria-label="Lista de tarefas">
            {filteredIssues.map((issue) => {
              const pConfig = priorityConfig[issue.priority ?? 'medium'] ?? priorityConfig.medium
              const assignee = getAssignee(issue.assigneeAgentId)
              const project = projects.find((p) => p.id === issue.projectId)
              const isUpdating = updatingId === issue.id
              const isDeleting = deletingId === issue.id

              return (
                <article
                  key={issue.id}
                  className="card"
                  style={{ opacity: isUpdating || isDeleting ? 0.6 : 1 }}
                  role="listitem"
                  aria-busy={isUpdating || isDeleting}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="avatar avatar-md"
                      style={{
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: assignee
                          ? getAgentColor(assignee.ref)
                          : 'var(--color-bg-surface-elevated)',
                      }}
                      aria-hidden="true"
                    >
                      {assignee ? (
                        assignee.avatar ? (
                          <img src={assignee.avatar} alt="" />
                        ) : (
                          getInitials(assignee.name)
                        )
                      ) : (
                        <User size={18} className="text-tertiary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => setDetailIssue(issue)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              textAlign: 'left',
                              cursor: 'pointer',
                              color: 'inherit',
                              width: '100%',
                            }}
                          >
                            <h3 className="text-body text-primary text-truncate" style={{ fontWeight: 600 }}>
                              {issue.identifier && (
                                <span className="text-mono text-caption text-tertiary" style={{ marginRight: '8px' }}>
                                  {issue.identifier}
                                </span>
                              )}
                              {issue.title}
                            </h3>
                          </button>
                          {issue.description && (
                            <p className="text-caption text-tertiary text-truncate-2 mt-1">
                              {issue.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <StatusDropdown
                            current={issue.status}
                            onSelect={(s) => handleStatusChange(issue.id, s)}
                            disabled={isUpdating}
                          />

                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => setDetailIssue(issue)}
                            aria-label={`Abrir detalhes: ${issue.title}`}
                            title="Detalhes, comentários e documentos"
                          >
                            <ExternalLink size={15} />
                          </button>

                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => {
                              setEditingIssue(issue)
                              setShowModal(true)
                            }}
                            aria-label={`Editar tarefa: ${issue.title}`}
                            title="Editar"
                          >
                            <Edit2 size={15} />
                          </button>

                          <button
                            className="btn btn-ghost btn-icon btn-sm text-error"
                            onClick={() => handleDelete(issue.id, issue.title)}
                            aria-label={`Excluir tarefa: ${issue.title}`}
                            title="Excluir"
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2 flex-wrap text-caption text-tertiary">
                        <span>
                          {assignee ? (
                            <>
                              <strong className="text-primary">{assignee.name}</strong> • {assignee.role}
                            </>
                          ) : (
                            <em>Sem responsável</em>
                          )}
                        </span>

                        {project && <span className="badge badge-neutral">{project.name}</span>}

                        <time dateTime={issue.updatedAt}>
                          Atualizado {formatTimestamp(issue.updatedAt)}
                        </time>

                        {issue.priority && (
                          <span className={cn('badge', pConfig.badge)}>{pConfig.label}</span>
                        )}

                        {issue.labels?.map((lbl) => (
                          <span key={lbl.id} className="badge badge-neutral">
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '9999px',
                                backgroundColor: lbl.color,
                              }}
                            />
                            {lbl.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <TaskModal
          agents={agents}
          projects={projects}
          initialData={editingIssue ?? undefined}
          onSave={editingIssue ? handleEdit : handleCreate}
          onClose={() => {
            setShowModal(false)
            setEditingIssue(null)
          }}
        />
      )}

      {detailIssue && (
        <TaskDetailDrawer
          issue={detailIssue}
          companyId={companyId}
          agents={agents}
          projects={projects}
          labels={labels}
          onClose={() => setDetailIssue(null)}
          onIssueUpdated={(updated) => {
            setDetailIssue(updated)
            refetch()
          }}
        />
      )}
    </div>
  )
}
