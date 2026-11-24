import { useState } from 'react'
import { CheckCircle, XCircle, Clock, AlertCircle, Info, FileText, MessageSquare, ExternalLink, Loader2 } from 'lucide-react'
import { cn, formatTimestamp, getInitials, getAgentColor } from '../lib/utils'
import { useApprovals } from '../hooks/useChat'
import { useToastHelpers } from '../context/ToastContext'
import type { Approval, Agent } from '../types/api'

interface ApprovalViewProps {
  companyId: string
  agents: Agent[]
  currentUserId?: string
}

type LucideIcon = React.ComponentType<{ size?: number | string; className?: string }>

type StatusConfig = {
  label: string
  icon: LucideIcon
  color: string
  bg: string
  border: string
}

const statusConfig: Record<string, StatusConfig> = {
  pending: { label: 'Pendente', icon: Clock, color: 'var(--color-status-warning)', bg: 'rgba(255, 214, 0, 0.15)', border: 'var(--color-status-warning)' },
  approved: { label: 'Aprovado', icon: CheckCircle, color: 'var(--color-status-success)', bg: 'rgba(0, 230, 118, 0.15)', border: 'var(--color-status-success)' },
  rejected: { label: 'Rejeitado', icon: XCircle, color: 'var(--color-status-error)', bg: 'rgba(255, 82, 82, 0.15)', border: 'var(--color-status-error)' },
  cancelled: { label: 'Cancelado', icon: Info, color: 'var(--color-status-neutral)', bg: 'rgba(158, 158, 158, 0.15)', border: 'var(--color-status-neutral)' },
}

type ApprovalStatus = keyof typeof statusConfig

export function ApprovalView({ companyId, agents, currentUserId }: ApprovalViewProps) {
  const { approvals, loading, error, refetch, createApproval, updateApproval } = useApprovals({ companyId })
  const { success, error: showError } = useToastHelpers()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const getRequester = (id: string) => agents.find((a) => a.id === id) ?? null
  const getApprover = (id?: string) => (id ? agents.find((a) => a.id === id) ?? null : null)

  const handleCreateApproval = async (data: { title: string; description: string; approverAgentId: string }) => {
    try {
      setCreating(true)
      await createApproval(data)
      success('Aprovação criada', 'A solicitação foi enviada para aprovação')
      setShowCreateModal(false)
    } catch (err) {
      showError('Erro ao criar aprovação', err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateApproval = async (approvalId: string, status: 'approved' | 'rejected', comment?: string) => {
    try {
      setUpdating(approvalId)
      await updateApproval(approvalId, { status, comment })
      success(
        status === 'approved' ? 'Aprovação concedida' : 'Aprovação rejeitada',
        `A solicitação foi ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso`
      )
      setSelectedApproval(null)
    } catch (err) {
      showError('Erro ao atualizar', err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setUpdating(null)
    }
  }

  const pendingApprovals = approvals.filter((a) => a.status === 'pending')
  const myPendingApprovals = pendingApprovals.filter(
    (a) => a.approverAgentId === currentUserId
  )
  const requestedApprovals = approvals.filter(
    (a) => a.requestedBy === currentUserId
  )

  if (loading && approvals.length === 0) {
    return (
      <div className="approval-view flex flex-col h-full">
        <div className="approval-view__header p-4 border-b border-[var(--color-border-subtle)]">
          <h2 className="text-h3 font-semibold text-[var(--color-text-primary)]">Aprovações</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="skeleton h-8 w-48 rounded-md" />
        </div>
      </div>
    )
  }

  return (
    <div className="approval-view flex flex-col h-full">
      <div className="approval-view__header p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-h3 font-semibold text-[var(--color-text-primary)]">Aprovações</h2>
            <span className="badge badge-warning">{pendingApprovals.length}</span>
            <span className="badge badge-info">{myPendingApprovals.length}</span>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <MessageSquare size={18} className="mr-2" />
            Nova Aprovação
          </button>
        </div>
      </div>

      {error && (
        <div className="error-inline m-4" role="alert">
          <AlertCircle className="error-inline__icon" size={20} />
          <div>
            <strong>Erro ao carregar aprovações:</strong> {error.message}
            <button className="btn btn-ghost btn-sm mt-2" onClick={refetch}>
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      <div className="approval-view__tabs" role="tablist" aria-label="Filtros de aprovação">
        <div className="tab-list">
          <button role="tab" className="tab" aria-selected={false}>
            Todas ({approvals.length})
          </button>
          <button role="tab" className="tab" aria-selected={false}>
            Pendentes ({pendingApprovals.length})
          </button>
          <button role="tab" className="tab" aria-selected={false}>
            Minhas para Aprovar ({myPendingApprovals.length})
          </button>
          <button role="tab" className="tab" aria-selected={false}>
            Solicitadas por Mim ({requestedApprovals.length})
          </button>
        </div>
      </div>

      <div className="approval-view__list flex-1 overflow-y-auto p-4">
        {approvals.length === 0 ? (
          <div className="empty-state flex-1 flex items-center justify-center">
            <FileText className="empty-state__icon" size={64} />
            <div className="text-center">
              <h3 className="empty-state__title">Nenhuma aprovação</h3>
              <p className="empty-state__description">
                Crie sua primeira solicitação de aprovação clicando em "Nova Aprovação"
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-label="Lista de aprovações">
            {approvals.map((approval) => {
              const config = statusConfig[approval.status as ApprovalStatus] || statusConfig.pending
              const StatusIcon = config.icon
              const requester = getRequester(approval.requestedBy)
              const approver = getApprover(approval.approverAgentId)
              const canAct = approval.status === 'pending' && approval.approverAgentId === currentUserId
              const isMine = approval.requestedBy === currentUserId

              return (
                <ApprovalCard
                  key={approval.id}
                  approval={approval}
                  config={config}
                  StatusIcon={StatusIcon}
                  requester={requester}
                  approver={approver}
                  canAct={canAct}
                  isMine={isMine}
                  onViewDetails={() => setSelectedApproval(approval)}
                  onApprove={() => canAct && handleUpdateApproval(approval.id, 'approved')}
                  onReject={() => canAct && handleUpdateApproval(approval.id, 'rejected')}
                  updating={updating === approval.id}
                />
              )
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateApprovalModal
          agents={agents}
          currentUserId={currentUserId}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateApproval}
          loading={creating}
        />
      )}

      {selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          agents={agents}
          onClose={() => setSelectedApproval(null)}
        />
      )}
    </div>
  )
}

interface ApprovalCardProps {
  approval: Approval
  config: StatusConfig
  StatusIcon: LucideIcon
  requester: Agent | null
  approver: Agent | null
  canAct: boolean
  isMine: boolean
  onViewDetails: () => void
  onApprove: () => void
  onReject: () => void
  updating: boolean
}

function ApprovalCard({
  approval,
  config,
  StatusIcon,
  requester,
  approver,
  canAct,
  isMine,
  onViewDetails,
  onApprove,
  onReject,
  updating,
}: ApprovalCardProps) {
  return (
    <article
      className={cn(
        'card approval-card',
        'hover:border-[var(--color-border-default)] hover:shadow-md transition-all duration-fast'
      )}
      role="listitem"
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center',
            `bg-[${config.bg}] border-2`,
            `border-[${config.border}]`
          )}
        >
          <StatusIcon size={24} className={cn('text-[', config.color, ']')} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-body font-medium text-[var(--color-text-primary)] text-truncate">
                {approval.title}
              </h3>
              <p className="text-[var(--text-caption)] text-[var(--color-text-tertiary)] text-truncate-2 mt-1">
                {approval.description}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={cn(
                  'badge',
                  'flex items-center gap-1',
                  `text-[${config.color}]`,
                  `bg-[${config.bg}]`,
                  `border border-[${config.border}]`
                )}
              >
                <StatusIcon size={12} aria-hidden="true" />
                {config.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap text-[var(--text-caption)]">
            {requester && (
              <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                <span>Solicitado por:</span>
                <span className="font-medium text-[var(--color-text-primary)]">{requester.name}</span>
                <span className="text-[var(--color-text-tertiary)]">({requester.role})</span>
              </div>
            )}
            {approver && (
              <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                <span>Aprovador:</span>
                <span className="font-medium text-[var(--color-text-primary)]">{approver.name}</span>
                <span className="text-[var(--color-text-tertiary)]">({approver.role})</span>
              </div>
            )}
            <time className="text-[var(--color-text-tertiary)]" dateTime={approval.createdAt}>
              {formatTimestamp(approval.createdAt)}
            </time>
            {isMine && (
              <span className="badge badge-brand badge-sm">Minha solicitação</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="btn btn-ghost btn-icon"
            onClick={onViewDetails}
            aria-label="Ver detalhes da aprovação"
          >
            <ExternalLink size={20} />
          </button>
          {canAct && !updating && (
            <>
              <button
                className="btn btn-success btn-sm"
                onClick={onApprove}
                aria-label="Aprovar"
              >
                <CheckCircle size={16} className="mr-1" />
                Aprovar
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={onReject}
                aria-label="Rejeitar"
              >
                <XCircle size={16} className="mr-1" />
                Rejeitar
              </button>
            </>
          )}
          {canAct && updating && (
            <Loader2 size={20} className="animate-spin text-[var(--color-brand-primary)]" />
          )}
        </div>
      </div>
    </article>
  )
}

interface CreateApprovalModalProps {
  agents: Agent[]
  currentUserId?: string
  onClose: () => void
  onSubmit: (data: { title: string; description: string; approverAgentId: string }) => Promise<void>
  loading: boolean
}

function CreateApprovalModal({ agents, currentUserId, onClose, onSubmit, loading }: CreateApprovalModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [approverAgentId, setApproverAgentId] = useState('')

  const availableApprovers = agents.filter((a) => a.id !== currentUserId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !approverAgentId) return
    await onSubmit({ title: title.trim(), description: description.trim(), approverAgentId })
  }

  return (
    <div className="modal-backdrop" onClick={onClose} aria-hidden="true">
      <div className="modal modal-md" role="dialog" aria-modal="true" aria-labelledby="create-approval-title">
        <div className="modal__header">
          <h3 id="create-approval-title" className="modal__title">Nova Solicitação de Aprovação</h3>
          <button className="modal__close" onClick={onClose} aria-label="Fechar">
            <XCircle size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal__body" id="create-approval-form">
          <div className="space-y-4">
            <div>
              <label htmlFor="approval-title" className="label">Título *</label>
              <input
                id="approval-title"
                type="text"
                className="input-base"
                placeholder="Título da aprovação"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="approval-description" className="label">Descrição</label>
              <textarea
                id="approval-description"
                className="input-base"
                rows={4}
                placeholder="Descreva o que precisa ser aprovado..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="approval-approver" className="label">Aprovador *</label>
              <select
                id="approval-approver"
                className="input-base"
                value={approverAgentId}
                onChange={(e) => setApproverAgentId(e.target.value)}
                required
              >
                <option value="">Selecione o aprovador</option>
                {availableApprovers.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} — {agent.role}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
        <div className="modal__footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button type="submit" form="create-approval-form" className="btn btn-primary" disabled={loading || !title.trim() || !approverAgentId}>
            {loading ? (
              <>
                <Loader2 size={18} className="mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Aprovação'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ApprovalDetailModalProps {
  approval: Approval
  agents: Agent[]
  onClose: () => void
}

function ApprovalDetailModal({ approval, agents, onClose }: ApprovalDetailModalProps) {
  const config = statusConfig[approval.status as ApprovalStatus] || statusConfig.pending
  const StatusIcon = config.icon
  const requester = agents.find((a) => a.id === approval.requestedBy)
  const approver = approval.approverAgentId ? agents.find((a) => a.id === approval.approverAgentId) : null

  return (
    <div className="modal-backdrop" onClick={onClose} aria-hidden="true">
      <div className="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="approval-detail-title">
        <div className="modal__header">
          <h3 id="approval-detail-title" className="modal__title">Detalhes da Aprovação</h3>
          <button className="modal__close" onClick={onClose} aria-label="Fechar">
            <XCircle size={24} />
          </button>
        </div>
        <div className="modal__body">
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-[var(--color-bg-surface-elevated)] rounded-lg">
              <div
                className={cn(
                  'flex-shrink-0 w-16 h-16 rounded-lg flex items-center justify-center',
                  `bg-[${config.bg}] border-2`,
                  `border-[${config.border}]`
                )}
              >
                <StatusIcon size={32} className={cn('text-[', config.color, ']')} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h4 className="text-h3 font-semibold text-[var(--color-text-primary)]">{approval.title}</h4>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span
                    className={cn(
                      'badge',
                      'flex items-center gap-1',
                      `text-[${config.color}]`,
                      `bg-[${config.bg}]`,
                      `border border-[${config.border}]`
                    )}
                  >
                    <StatusIcon size={14} aria-hidden="true" />
                    {config.label}
                  </span>
                  {approval.decidedAt && (
                    <time className="text-[var(--text-caption)] text-[var(--color-text-tertiary)]" dateTime={approval.decidedAt}>
                      Decidido em {formatTimestamp(approval.decidedAt)}
                    </time>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h5 className="text-body-sm font-medium text-[var(--color-text-secondary)] mb-3">Descrição</h5>
              <p className="text-[var(--color-text-primary)] whitespace-pre-wrap">{approval.description || 'Sem descrição'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--color-bg-surface-elevated)] rounded-lg">
                <h5 className="text-body-sm font-medium text-[var(--color-text-secondary)] mb-3">Solicitante</h5>
                {requester ? (
                  <div className="flex items-center gap-3">
                    <div
                      className="avatar avatar-md"
                      style={{ backgroundColor: getAgentColor(requester.ref) }}
                    >
                      {requester.avatar ? (
                        <img src={requester.avatar} alt="" />
                      ) : (
                        getInitials(requester.name)
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">{requester.name}</p>
                      <p className="text-[var(--text-caption)] text-[var(--color-text-tertiary)]">{requester.role}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--color-text-tertiary)]">Não identificado</p>
                )}
              </div>

              <div className="p-4 bg-[var(--color-bg-surface-elevated)] rounded-lg">
                <h5 className="text-body-sm font-medium text-[var(--color-text-secondary)] mb-3">Aprovador</h5>
                {approver ? (
                  <div className="flex items-center gap-3">
                    <div
                      className="avatar avatar-md"
                      style={{ backgroundColor: getAgentColor(approver.ref) }}
                    >
                      {approver.avatar ? (
                        <img src={approver.avatar} alt="" />
                      ) : (
                        getInitials(approver.name)
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">{approver.name}</p>
                      <p className="text-[var(--text-caption)] text-[var(--color-text-tertiary)]">{approver.role}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--color-text-tertiary)]">Não definido</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[var(--color-bg-surface-elevated)] rounded-lg">
                <h5 className="text-body-sm font-medium text-[var(--color-text-secondary)] mb-1">Criado em</h5>
                <time className="text-[var(--color-text-primary)]" dateTime={approval.createdAt}>
                  {formatTimestamp(approval.createdAt)}
                </time>
              </div>
              <div className="p-4 bg-[var(--color-bg-surface-elevated)] rounded-lg">
                <h5 className="text-body-sm font-medium text-[var(--color-text-secondary)] mb-1">Atualizado em</h5>
                <time className="text-[var(--color-text-primary)]" dateTime={approval.updatedAt}>
                  {formatTimestamp(approval.updatedAt)}
                </time>
              </div>
              {approval.decidedAt && (
                <div className="p-4 bg-[var(--color-bg-surface-elevated)] rounded-lg">
                  <h5 className="text-body-sm font-medium text-[var(--color-text-secondary)] mb-1">Decidido em</h5>
                  <time className="text-[var(--color-text-primary)]" dateTime={approval.decidedAt}>
                    {formatTimestamp(approval.decidedAt)}
                  </time>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal__footer">
          <button className="btn btn-primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}