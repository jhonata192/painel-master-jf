import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Info,
  FileText,
  MessageSquare,
  ExternalLink,
  Loader2,
  RotateCcw,
  Plus,
  Send,
  Scale,
} from 'lucide-react'
import { cn, formatTimestamp, getInitials, getAgentColor } from '../lib/utils'
import { api } from '../lib/api'
import { useApprovals } from '../hooks/useChat'
import { useToastHelpers } from '../context/ToastContext'
import type { Approval, ApprovalComment, Agent, DecisionItem } from '../types/api'

interface ApprovalViewProps {
  companyId: string
  agents: Agent[]
  currentUserId?: string
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected' | 'decisions'

const statusConfig: Record<string, { label: string; icon: typeof Clock; badge: string }> = {
  pending: { label: 'Pendente', icon: Clock, badge: 'badge-warning' },
  approved: { label: 'Aprovado', icon: CheckCircle, badge: 'badge-success' },
  rejected: { label: 'Rejeitado', icon: XCircle, badge: 'badge-error' },
  revision_requested: { label: 'Revisão Solicitada', icon: AlertCircle, badge: 'badge-info' },
  cancelled: { label: 'Cancelado', icon: Info, badge: 'badge-neutral' },
}

export function ApprovalView({ companyId, agents }: ApprovalViewProps) {
  const { approvals, loading, error, refetch, createApproval, actApproval } = useApprovals({ companyId })
  const { success, error: showError } = useToastHelpers()

  const [tab, setTab] = useState<FilterTab>('all')
  const [decisions, setDecisions] = useState<DecisionItem[]>([])
  const [loadingDecisions, setLoadingDecisions] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [creating, setCreating] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadDecisions = useCallback(async () => {
    setLoadingDecisions(true)
    try {
      setDecisions(await api.listDecisions(companyId))
    } catch {
      setDecisions([])
    } finally {
      setLoadingDecisions(false)
    }
  }, [companyId])

  useEffect(() => {
    loadDecisions()
  }, [loadDecisions])

  const getRequester = (approval: Approval) => {
    const id = approval.requestedByAgentId || approval.requestedBy
    return agents.find((a) => a.id === id) ?? null
  }

  const handleCreateApproval = async (data: {
    title: string
    description: string
    type: string
    requestedByAgentId?: string
  }) => {
    try {
      setCreating(true)
      await createApproval({
        title: data.title,
        description: data.description,
        type: data.type,
        approverAgentId: data.requestedByAgentId,
      })
      success('Aprovação criada', 'Solicitação registrada no Paperclip')
      setShowCreateModal(false)
    } catch (err) {
      showError('Erro ao criar aprovação', err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setCreating(false)
    }
  }

  const handleAct = async (
    approvalId: string,
    action: 'approve' | 'reject' | 'request_revision' | 'cancel' | 'resubmit',
    note?: string
  ) => {
    try {
      setUpdatingId(approvalId)
      const updated = await actApproval(approvalId, action, note)
      const labels: Record<string, string> = {
        approve: 'Aprovação concedida',
        reject: 'Aprovação rejeitada',
        request_revision: 'Revisão solicitada',
        cancel: 'Aprovação cancelada',
        resubmit: 'Aprovação reenviada',
      }
      success(labels[action], 'Estado atualizado no Paperclip')
      if (selectedApproval?.id === approvalId) {
        setSelectedApproval(updated)
      }
    } catch (err) {
      showError('Erro na ação', err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDecide = async (decisionId: string, optionId: string) => {
    try {
      await api.decideDecision(decisionId, optionId)
      success('Decisão registrada')
      loadDecisions()
    } catch (err) {
      showError('Erro ao decidir', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleDismissDecision = async (decisionId: string) => {
    try {
      await api.dismissDecision(decisionId, 'Dispensada via painel web')
      success('Decisão dispensada')
      loadDecisions()
    } catch (err) {
      showError('Erro ao dispensar', err instanceof Error ? err.message : 'Falha')
    }
  }

  const pendingApprovals = approvals.filter((a) => a.status === 'pending' || a.status === 'revision_requested')
  const approvedApprovals = approvals.filter((a) => a.status === 'approved')
  const closedApprovals = approvals.filter((a) => a.status === 'rejected' || a.status === 'cancelled')

  const visibleApprovals =
    tab === 'pending'
      ? pendingApprovals
      : tab === 'approved'
      ? approvedApprovals
      : tab === 'rejected'
      ? closedApprovals
      : approvals

  if (loading && approvals.length === 0) {
    return (
      <div className="view-shell">
        <div className="view-header">
          <h2 className="text-h3 text-primary">Aprovações & Decisões</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-5" aria-busy="true">
          <div className="skeleton" style={{ height: '32px', width: '200px' }} aria-hidden="true" />
        </div>
      </div>
    )
  }

  return (
    <div className="view-shell">
      <div className="view-header">
        <div className="flex items-center gap-3">
          <h2 className="text-h3 text-primary">Aprovações & Decisões</h2>
          <span className="badge badge-warning">{pendingApprovals.length} pendentes</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => {
              refetch()
              loadDecisions()
            }}
            aria-label="Atualizar aprovações"
            title="Atualizar"
          >
            <RotateCcw size={18} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} aria-hidden="true" />
            Nova Aprovação
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 20px 0', backgroundColor: 'var(--color-bg-surface)' }}>
        <div className="tab-list" role="tablist" aria-label="Filtros de aprovação" style={{ marginBottom: 0 }}>
          {[
            { id: 'all', label: `Todas (${approvals.length})` },
            { id: 'pending', label: `Pendentes (${pendingApprovals.length})` },
            { id: 'approved', label: `Aprovadas (${approvedApprovals.length})` },
            { id: 'rejected', label: `Rejeitadas / Canceladas (${closedApprovals.length})` },
            { id: 'decisions', label: `Decisões (${decisions.length})` },
          ].map((item) => (
            <button
              key={item.id}
              role="tab"
              className={cn('tab', tab === item.id && 'active')}
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id as FilterTab)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="view-body">
        {error && (
          <div className="error-inline mb-4" role="alert">
            <AlertCircle size={18} className="error-inline__icon" aria-hidden="true" />
            <div>
              <strong>Erro ao carregar aprovações:</strong> {error.message}
              <div>
                <button className="btn btn-ghost btn-sm mt-2" onClick={refetch}>
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'decisions' ? (
          <div className="stack-md">
            {loadingDecisions ? (
              <p className="text-body-sm text-tertiary">Carregando decisões...</p>
            ) : decisions.length === 0 ? (
              <div className="empty-state">
                <Scale className="empty-state__icon" size={48} aria-hidden="true" />
                <h3 className="empty-state__title">Nenhuma decisão pendente</h3>
                <p className="empty-state__description">
                  Quando um agente solicitar uma decisão com múltiplas opções, ela aparecerá aqui.
                </p>
              </div>
            ) : (
              decisions.map((d) => (
                <article key={d.id} className="card stack-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-body" style={{ fontWeight: 600 }}>
                      {d.title}
                    </h3>
                    <span className="badge badge-info">{d.status}</span>
                  </div>
                  <p className="text-body-sm text-secondary">{d.body}</p>
                  {d.status === 'open' && (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {d.options.map((opt) => (
                        <button
                          key={opt.id}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDecide(d.id, opt.id)}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDismissDecision(d.id)}
                      >
                        Dispensar
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        ) : visibleApprovals.length === 0 ? (
          <div className="empty-state">
            <FileText className="empty-state__icon" size={48} aria-hidden="true" />
            <h3 className="empty-state__title">Nenhuma aprovação nesta aba</h3>
            <p className="empty-state__description">
              Solicitações de agentes ou do board aparecem aqui para revisão e aprovação.
            </p>
          </div>
        ) : (
          <div className="stack-md" role="list" aria-label="Lista de aprovações">
            {visibleApprovals.map((approval) => {
              const cfg = statusConfig[approval.status] ?? statusConfig.pending
              const StatusIcon = cfg.icon
              const requester = getRequester(approval)
              const isPending = approval.status === 'pending' || approval.status === 'revision_requested'
              const isUpdating = updatingId === approval.id

              return (
                <article key={approval.id} className="card" role="listitem">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className="avatar avatar-md"
                        style={{
                          backgroundColor: requester
                            ? getAgentColor(requester.ref)
                            : 'var(--color-bg-surface-elevated)',
                        }}
                        aria-hidden="true"
                      >
                        {requester ? getInitials(requester.name) : <FileText size={18} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-body text-primary" style={{ fontWeight: 600 }}>
                            {approval.title}
                          </h3>
                          <span className={cn('badge', cfg.badge)}>
                            <StatusIcon size={12} aria-hidden="true" />
                            {cfg.label}
                          </span>
                          {approval.type && (
                            <span className="badge badge-neutral text-mono">{approval.type}</span>
                          )}
                        </div>
                        {approval.description && (
                          <p className="text-body-sm text-secondary mt-1" style={{ whiteSpace: 'pre-wrap' }}>
                            {approval.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-caption text-tertiary flex-wrap">
                          {requester && <span>Solicitante: {requester.name}</span>}
                          <time dateTime={approval.createdAt}>
                            Criada em {formatTimestamp(approval.createdAt)}
                          </time>
                          {approval.decisionNote && (
                            <span>Nota: &ldquo;{approval.decisionNote}&rdquo;</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedApproval(approval)}
                        aria-label={`Detalhes da aprovação ${approval.title}`}
                      >
                        <ExternalLink size={15} aria-hidden="true" />
                        Detalhes
                      </button>

                      {isPending && !isUpdating && (
                        <>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleAct(approval.id, 'approve')}
                          >
                            <CheckCircle size={15} aria-hidden="true" />
                            Aprovar
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleAct(approval.id, 'reject')}
                          >
                            <XCircle size={15} aria-hidden="true" />
                            Rejeitar
                          </button>
                        </>
                      )}

                      {isUpdating && <Loader2 size={18} className="animate-spin" aria-label="Processando" />}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateApprovalModal
          agents={agents}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateApproval}
          loading={creating}
        />
      )}

      {selectedApproval && (
        <ApprovalDetailModal
          approval={selectedApproval}
          agents={agents}
          updating={updatingId === selectedApproval.id}
          onAct={(action, note) => handleAct(selectedApproval.id, action, note)}
          onClose={() => setSelectedApproval(null)}
        />
      )}
    </div>
  )
}

interface CreateApprovalModalProps {
  agents: Agent[]
  onClose: () => void
  onSubmit: (data: { title: string; description: string; type: string; requestedByAgentId?: string }) => Promise<void>
  loading: boolean
}

function CreateApprovalModal({ agents, onClose, onSubmit, loading }: CreateApprovalModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('board_decision')
  const [requestedByAgentId, setRequestedByAgentId] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      type,
      requestedByAgentId: requestedByAgentId || undefined,
    })
  }

  return (
    <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="create-approval-title">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-card">
        <div className="modal__header">
          <h3 id="create-approval-title" className="modal__title">
            Nova Solicitação de Aprovação
          </h3>
          <button className="modal__close" onClick={onClose} aria-label="Fechar">
            <XCircle size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal__body stack-md">
          <div>
            <label htmlFor="approval-title" className="label">
              Título *
            </label>
            <input
              id="approval-title"
              type="text"
              className="input-base"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Deploy v2.0 em produção"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="approval-type" className="label">
                Tipo
              </label>
              <select
                id="approval-type"
                className="input-base"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="board_decision">Decisão do Board</option>
                <option value="deploy_production">Deploy Produção</option>
                <option value="budget_override_required">Orçamento</option>
                <option value="hire_agent">Contratação de Agente</option>
              </select>
            </div>
            <div>
              <label htmlFor="approval-agent" className="label">
                Agente Solicitante
              </label>
              <select
                id="approval-agent"
                className="input-base"
                value={requestedByAgentId}
                onChange={(e) => setRequestedByAgentId(e.target.value)}
              >
                <option value="">Board / Usuário</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="approval-description" className="label">
              Descrição / Detalhes
            </label>
            <textarea
              id="approval-description"
              className="input-base"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto para decisão..."
            />
          </div>

          <div className="modal__footer" style={{ padding: '12px 0 0 0' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !title.trim()}>
              {loading ? 'Criando...' : 'Criar Aprovação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ApprovalDetailModalProps {
  approval: Approval
  agents: Agent[]
  updating: boolean
  onAct: (action: 'approve' | 'reject' | 'request_revision' | 'cancel' | 'resubmit', note?: string) => Promise<void>
  onClose: () => void
}

function ApprovalDetailModal({ approval, agents, updating, onAct, onClose }: ApprovalDetailModalProps) {
  const [note, setNote] = useState('')
  const [comments, setComments] = useState<ApprovalComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  useEffect(() => {
    api.listApprovalComments(approval.id).then(setComments).catch(() => {})
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [approval.id, onClose])

  const requester = agents.find((a) => a.id === (approval.requestedByAgentId || approval.requestedBy))
  const isPending = approval.status === 'pending' || approval.status === 'revision_requested'

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setSendingComment(true)
    try {
      const added = await api.addApprovalComment(approval.id, commentText.trim())
      setComments((prev) => [...prev, added])
      setCommentText('')
    } finally {
      setSendingComment(false)
    }
  }

  return (
    <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="approval-detail-title">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-card modal-card--lg">
        <div className="modal__header">
          <h3 id="approval-detail-title" className="modal__title">
            {approval.title}
          </h3>
          <button className="modal__close" onClick={onClose} aria-label="Fechar">
            <XCircle size={20} />
          </button>
        </div>

        <div className="modal__body stack-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('badge', statusConfig[approval.status]?.badge ?? 'badge-neutral')}>
              {statusConfig[approval.status]?.label ?? approval.status}
            </span>
            {requester && <span className="text-caption text-secondary">Solicitante: {requester.name}</span>}
            <time className="text-caption text-tertiary" dateTime={approval.createdAt}>
              {formatTimestamp(approval.createdAt)}
            </time>
          </div>

          <p className="text-body-sm" style={{ whiteSpace: 'pre-wrap' }}>
            {approval.description || 'Sem descrição.'}
          </p>

          {isPending && (
            <div className="card stack-sm">
              <label htmlFor="decision-note" className="label">
                Nota de decisão (opcional)
              </label>
              <input
                id="decision-note"
                className="input-base"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Motivo ou instrução para o agente..."
              />
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <button
                  className="btn btn-success btn-sm"
                  disabled={updating}
                  onClick={() => onAct('approve', note)}
                >
                  Aprovar
                </button>
                <button
                  className="btn btn-warning btn-sm"
                  disabled={updating}
                  onClick={() => onAct('request_revision', note)}
                >
                  Pedir Revisão
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={updating}
                  onClick={() => onAct('reject', note)}
                >
                  Rejeitar
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={updating}
                  onClick={() => onAct('cancel', note)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {approval.status === 'revision_requested' && (
            <div>
              <button
                className="btn btn-primary btn-sm"
                disabled={updating}
                onClick={() => onAct('resubmit')}
              >
                Reenviar para Aprovação
              </button>
            </div>
          )}

          <div className="stack-sm">
            <h4 className="text-body-sm flex items-center gap-2" style={{ fontWeight: 600 }}>
              <MessageSquare size={15} aria-hidden="true" />
              Comentários ({comments.length})
            </h4>
            <form onSubmit={handleComment} className="flex items-center gap-2">
              <input
                type="text"
                className="input-base flex-1"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Adicionar comentário nesta aprovação..."
                aria-label="Comentário na aprovação"
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={sendingComment || !commentText.trim()}>
                <Send size={14} />
              </button>
            </form>
            {comments.map((c) => (
              <div key={c.id} className="card" style={{ padding: '10px 12px' }}>
                <div className="text-body-sm">{c.body}</div>
                <time className="text-caption text-tertiary" dateTime={c.createdAt}>
                  {formatTimestamp(c.createdAt)}
                </time>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
