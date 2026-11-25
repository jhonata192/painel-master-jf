import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  MessageSquare,
  FileText,
  Paperclip,
  Activity,
  Play,
  RotateCw,
  Unlock,
  Zap,
  Trash2,
  Lock,
  Upload,
  Send,
  Loader2,
  Plus,
  Tag,
} from 'lucide-react'
import { cn, formatTimestamp } from '../lib/utils'
import { api } from '../lib/api'
import { useToastHelpers } from '../context/ToastContext'
import type {
  Agent,
  ActivityEvent,
  HeartbeatRun,
  Issue,
  IssueAttachment,
  IssueComment,
  IssueDocument,
  IssueLabel,
  Project,
} from '../types/api'

interface TaskDetailDrawerProps {
  issue: Issue
  allIssues?: Issue[]
  companyId: string
  agents: Agent[]
  projects: Project[]
  labels: IssueLabel[]
  onClose: () => void
  onIssueUpdated: (updated: Issue) => void
  onSelectIssue?: (target: Issue) => void
}

type DetailTab = 'overview' | 'comments' | 'documents' | 'attachments' | 'runs'

export function TaskDetailDrawer({
  issue,
  allIssues = [],
  companyId,
  agents,
  projects,
  labels,
  onClose,
  onIssueUpdated,
  onSelectIssue,
}: TaskDetailDrawerProps) {
  const { success, error: showError } = useToastHelpers()
  const [tab, setTab] = useState<DetailTab>('overview')
  const [comments, setComments] = useState<IssueComment[]>([])
  const [documents, setDocuments] = useState<IssueDocument[]>([])
  const [attachments, setAttachments] = useState<IssueAttachment[]>([])
  const [runs, setRuns] = useState<HeartbeatRun[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loadingTab, setLoadingTab] = useState(false)

  // Comentário novo
  const [commentBody, setCommentBody] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  // Documento editor
  const [docKey, setDocKey] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [docBody, setDocBody] = useState('')
  const [savingDoc, setSavingDoc] = useState(false)

  // Upload anexo
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const loadTabData = useCallback(
    async (target: DetailTab) => {
      setLoadingTab(true)
      try {
        if (target === 'comments') {
          setComments(await api.listIssueComments(issue.id))
        } else if (target === 'documents') {
          setDocuments(await api.listIssueDocuments(issue.id))
        } else if (target === 'attachments') {
          setAttachments(await api.listIssueAttachments(issue.id))
        } else if (target === 'runs') {
          const [r, a] = await Promise.all([
            api.listIssueRuns(issue.id).catch(() => []),
            api.listIssueActivity(issue.id).catch(() => []),
          ])
          setRuns(r)
          setActivity(a)
        }
      } catch (err) {
        showError('Erro ao carregar dados', err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        setLoadingTab(false)
      }
    },
    [issue.id, showError]
  )

  useEffect(() => {
    loadTabData(tab)
  }, [tab, loadTabData])

  const handleCheckout = async () => {
    const agentId = issue.assigneeAgentId || agents[0]?.id
    if (!agentId) {
      showError('Sem agente', 'Atribua um agente primeiro')
      return
    }
    try {
      const updated = await api.checkoutIssue(issue.id, agentId)
      onIssueUpdated(updated)
      success('Checkout realizado', 'Tarefa colocada em andamento')
    } catch (err) {
      showError('Erro no checkout', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleRelease = async () => {
    try {
      const updated = await api.releaseIssue(issue.id)
      onIssueUpdated(updated)
      success('Execução liberada', 'Lock de execução removido')
    } catch (err) {
      showError('Erro ao liberar', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleRetry = async () => {
    try {
      await api.retryIssue(issue.id)
      success('Nova tentativa agendada', 'A tarefa foi reenviada para execução')
    } catch (err) {
      showError('Erro ao retentar', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleWakeAssignee = async () => {
    if (!issue.assigneeAgentId) return
    try {
      await api.wakeupAgent(issue.assigneeAgentId, `Tarefa ${issue.identifier || issue.title}`)
      success('Agente acordado', 'Sinal de wakeup enviado')
    } catch (err) {
      showError('Erro ao acordar agente', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleToggleLabel = async (labelId: string) => {
    const currentIds = issue.labelIds ?? (issue.labels ?? []).map((l) => l.id)
    const nextIds = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId]
    try {
      const updated = await api.updateIssue(issue.id, { labelIds: nextIds })
      onIssueUpdated(updated)
    } catch (err) {
      showError('Erro nas etiquetas', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentBody.trim()) return
    setSendingComment(true)
    try {
      const created = await api.addIssueComment(issue.id, commentBody.trim())
      setComments((prev) => [...prev, created])
      setCommentBody('')
      success('Comentário adicionado')
    } catch (err) {
      showError('Erro ao comentar', err instanceof Error ? err.message : 'Falha')
    } finally {
      setSendingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.deleteIssueComment(issue.id, commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      success('Comentário removido')
    } catch (err) {
      showError('Erro ao remover comentário', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docKey.trim() || !docBody.trim()) return
    setSavingDoc(true)
    try {
      await api.upsertIssueDocument(issue.id, docKey.trim(), {
        title: docTitle.trim() || docKey.trim(),
        body: docBody,
      })
      setDocuments(await api.listIssueDocuments(issue.id))
      setDocKey('')
      setDocTitle('')
      setDocBody('')
      success('Documento salvo')
    } catch (err) {
      showError('Erro ao salvar documento', err instanceof Error ? err.message : 'Falha')
    } finally {
      setSavingDoc(false)
    }
  }

  const handleToggleDocLock = async (doc: IssueDocument) => {
    try {
      if (doc.locked) await api.unlockIssueDocument(issue.id, doc.key)
      else await api.lockIssueDocument(issue.id, doc.key)
      setDocuments(await api.listIssueDocuments(issue.id))
      success(doc.locked ? 'Documento destravado' : 'Documento travado')
    } catch (err) {
      showError('Erro ao alterar trava', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleDeleteDoc = async (key: string) => {
    try {
      await api.deleteIssueDocument(issue.id, key)
      setDocuments((prev) => prev.filter((d) => d.key !== key))
      success('Documento removido')
    } catch (err) {
      showError('Erro ao remover documento', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const att = await api.uploadIssueAttachment(companyId, issue.id, file)
      setAttachments((prev) => [...prev, att])
      success('Anexo enviado', file.name)
    } catch (err) {
      showError('Erro no upload', err instanceof Error ? err.message : 'Falha')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAttachment = async (attId: string) => {
    try {
      await api.deleteAttachment(attId)
      setAttachments((prev) => prev.filter((a) => a.id !== attId))
      success('Anexo excluído')
    } catch (err) {
      showError('Erro ao excluir anexo', err instanceof Error ? err.message : 'Falha')
    }
  }

  const assignee = agents.find((a) => a.id === issue.assigneeAgentId)
  const creator = issue.createdByAgentId ? agents.find((a) => a.id === issue.createdByAgentId) : null
  const project = projects.find((p) => p.id === issue.projectId)
  const parentIssue = issue.parentId ? allIssues.find((i) => i.id === issue.parentId) : null
  const childIssues = allIssues.filter((i) => i.parentId === issue.id)
  const activeLabelIds = issue.labelIds ?? (issue.labels ?? []).map((l) => l.id)

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="drawer drawer-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        <div className="drawer__header">
          <div className="min-w-0 flex-1">
            {issue.identifier && (
              <span className="text-caption text-mono text-tertiary">{issue.identifier}</span>
            )}
            <h2 id="task-detail-title" className="drawer__title text-truncate">
              {issue.title}
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Fechar detalhes da tarefa"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 16px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="tab-list" role="tablist" aria-label="Seções da tarefa" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {[
              { id: 'overview', label: 'Resumo & Ações' },
              { id: 'comments', label: 'Comentários', icon: MessageSquare },
              { id: 'documents', label: 'Documentos', icon: FileText },
              { id: 'attachments', label: 'Anexos', icon: Paperclip },
              { id: 'runs', label: 'Execuções', icon: Activity },
            ].map((t) => (
              <button
                key={t.id}
                role="tab"
                className={cn('tab', tab === t.id && 'active')}
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id as DetailTab)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="drawer__body">
          {loadingTab && tab !== 'overview' && (
            <div className="flex items-center gap-2 text-secondary mb-3" role="status">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              <span>Carregando...</span>
            </div>
          )}

          {tab === 'overview' && (
            <div className="stack-lg">
              <div>
                <h3 className="text-body-sm text-secondary mb-2">Descrição</h3>
                <p
                  className="text-body-sm text-primary"
                  style={{
                    whiteSpace: 'pre-wrap',
                    backgroundColor: 'var(--color-bg-surface-elevated)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  {issue.description || 'Sem descrição.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="card">
                  <div className="text-caption text-tertiary">Responsável</div>
                  <div className="text-body-sm mt-1">
                    {assignee ? assignee.name : 'Não atribuído'}
                  </div>
                </div>
                <div className="card">
                  <div className="text-caption text-tertiary">Origem / Projeto</div>
                  <div className="text-body-sm mt-1">
                    {creator ? `Delegada por ${creator.name}` : (project ? project.name : 'Board / Manual')}
                  </div>
                </div>
              </div>

              {(parentIssue || childIssues.length > 0) && (
                <div className="card stack-sm">
                  <h3 className="text-body-sm text-secondary" style={{ fontWeight: 600 }}>
                    Relacionamentos (Delegação)
                  </h3>
                  {parentIssue && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption text-tertiary">Tarefa Pai:</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onSelectIssue?.(parentIssue)}
                      >
                        {parentIssue.identifier ? `${parentIssue.identifier} — ` : ''}{parentIssue.title}
                      </button>
                    </div>
                  )}
                  {childIssues.length > 0 && (
                    <div className="stack-xs">
                      <span className="text-caption text-tertiary">Subtarefas ({childIssues.length}):</span>
                      {childIssues.map((sub) => {
                        const subAg = agents.find((a) => a.id === sub.assigneeAgentId)
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            className="dropdown-item"
                            onClick={() => onSelectIssue?.(sub)}
                          >
                            <span className="badge badge-neutral">{sub.status}</span>
                            <span className="text-truncate flex-1">{sub.title}</span>
                            {subAg && <span className="text-caption text-tertiary">{subAg.name.split(' ')[0]}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <h3 className="text-body-sm text-secondary mb-2">Ações de Execução (Paperclip)</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="btn btn-primary btn-sm" onClick={handleCheckout}>
                    <Play size={14} aria-hidden="true" />
                    Iniciar (Checkout)
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleRelease}>
                    <Unlock size={14} aria-hidden="true" />
                    Liberar Lock
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={handleRetry}>
                    <RotateCw size={14} aria-hidden="true" />
                    Retentar
                  </button>
                  {issue.assigneeAgentId && (
                    <button className="btn btn-secondary btn-sm" onClick={handleWakeAssignee}>
                      <Zap size={14} aria-hidden="true" />
                      Acordar Agente
                    </button>
                  )}
                </div>
              </div>

              {labels.length > 0 && (
                <div>
                  <h3 className="text-body-sm text-secondary mb-2 flex items-center gap-2">
                    <Tag size={14} aria-hidden="true" />
                    Etiquetas
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    {labels.map((lbl) => {
                      const active = activeLabelIds.includes(lbl.id)
                      return (
                        <button
                          key={lbl.id}
                          type="button"
                          className={cn('badge', active ? 'badge-brand' : 'badge-neutral')}
                          style={{
                            cursor: 'pointer',
                            border: active ? '1px solid var(--color-brand-primary)' : '1px solid transparent',
                          }}
                          aria-pressed={active}
                          onClick={() => handleToggleLabel(lbl.id)}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '9999px',
                              backgroundColor: lbl.color,
                            }}
                          />
                          {lbl.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="text-caption text-tertiary">
                Criado em {formatTimestamp(issue.createdAt)} • Atualizado em {formatTimestamp(issue.updatedAt)}
              </div>
            </div>
          )}

          {tab === 'comments' && (
            <div className="stack-lg">
              <form onSubmit={handleAddComment} className="stack-sm">
                <label htmlFor="issue-comment-input" className="label">
                  Novo comentário
                </label>
                <textarea
                  id="issue-comment-input"
                  className="input-base"
                  rows={3}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Escreva uma atualização ou instrução..."
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={sendingComment || !commentBody.trim()}
                  >
                    {sendingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Comentar
                  </button>
                </div>
              </form>

              <div className="stack-md" role="list" aria-label="Comentários da tarefa">
                {comments.length === 0 && !loadingTab && (
                  <p className="text-body-sm text-tertiary">Nenhum comentário ainda.</p>
                )}
                {comments.map((c) => {
                  const authorAgent = agents.find((a) => a.id === c.authorAgentId)
                  return (
                    <div key={c.id} className="card" role="listitem">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-caption" style={{ fontWeight: 600 }}>
                          {authorAgent ? authorAgent.name : 'Board / Usuário'}
                        </span>
                        <div className="flex items-center gap-2">
                          <time className="text-caption text-tertiary" dateTime={c.createdAt}>
                            {formatTimestamp(c.createdAt)}
                          </time>
                          <button
                            className="btn btn-ghost btn-icon"
                            style={{ minWidth: '30px', minHeight: '30px' }}
                            onClick={() => handleDeleteComment(c.id)}
                            aria-label="Excluir comentário"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-body-sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {c.body}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'documents' && (
            <div className="stack-lg">
              <form onSubmit={handleSaveDoc} className="card stack-sm">
                <h3 className="text-body-sm" style={{ fontWeight: 600 }}>
                  Criar / Atualizar Documento
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="doc-key" className="label">Chave (slug)</label>
                    <input
                      id="doc-key"
                      className="input-base"
                      value={docKey}
                      onChange={(e) => setDocKey(e.target.value)}
                      placeholder="ex: plano-acao"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="doc-title" className="label">Título</label>
                    <input
                      id="doc-title"
                      className="input-base"
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      placeholder="Plano de Ação"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="doc-body" className="label">Conteúdo (Markdown)</label>
                  <textarea
                    id="doc-body"
                    className="input-base text-mono"
                    rows={4}
                    value={docBody}
                    onChange={(e) => setDocBody(e.target.value)}
                    placeholder="# Conteúdo do documento..."
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingDoc}>
                    <Plus size={14} />
                    {savingDoc ? 'Salvando...' : 'Salvar Documento'}
                  </button>
                </div>
              </form>

              <div className="stack-md">
                {documents.length === 0 && !loadingTab && (
                  <p className="text-body-sm text-tertiary">Nenhum documento anexado a esta tarefa.</p>
                )}
                {documents.map((d) => (
                  <div key={d.key} className="card stack-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <strong className="text-body-sm">{d.title || d.key}</strong>
                        <span className="text-caption text-mono text-tertiary ml-2">({d.key})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setDocKey(d.key)
                            setDocTitle(d.title || '')
                            setDocBody(d.body)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => handleToggleDocLock(d)}
                          aria-label={d.locked ? 'Destravar documento' : 'Travar documento'}
                          title={d.locked ? 'Destravar' : 'Travar'}
                        >
                          {d.locked ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                        <button
                          className="btn btn-ghost btn-icon text-error"
                          onClick={() => handleDeleteDoc(d.key)}
                          aria-label={`Excluir documento ${d.key}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <pre className="log-console" style={{ maxHeight: '180px' }}>{d.body}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'attachments' && (
            <div className="stack-lg">
              <div className="card flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <strong className="text-body-sm">Enviar arquivo anexo</strong>
                  <p className="text-caption text-tertiary">
                    Anexe imagens, logs ou documentos à tarefa.
                  </p>
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    id="issue-attachment-file"
                    className="sr-only"
                    onChange={handleUploadFile}
                    disabled={uploading}
                  />
                  <label htmlFor="issue-attachment-file" className="btn btn-primary btn-sm">
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? 'Enviando...' : 'Escolher Arquivo'}
                  </label>
                </div>
              </div>

              <div className="stack-sm">
                {attachments.length === 0 && !loadingTab && (
                  <p className="text-body-sm text-tertiary">Nenhum anexo encontrado.</p>
                )}
                {attachments.map((att) => (
                  <div key={att.id} className="card flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-body-sm text-truncate">{att.filename}</div>
                      <div className="text-caption text-tertiary">
                        {att.mimeType || 'arquivo'} • {att.sizeBytes ? `${Math.round(att.sizeBytes / 1024)} KB` : ''}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-icon text-error"
                      onClick={() => handleDeleteAttachment(att.id)}
                      aria-label={`Excluir anexo ${att.filename}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'runs' && (
            <div className="stack-lg">
              <div>
                <h3 className="text-body-sm text-secondary mb-2">Execuções (Heartbeat Runs)</h3>
                {runs.length === 0 ? (
                  <p className="text-body-sm text-tertiary">Nenhuma execução registrada para esta tarefa.</p>
                ) : (
                  <div className="stack-sm">
                    {runs.map((r) => (
                      <div key={r.id} className="card flex items-center justify-between gap-2">
                        <div>
                          <div className="text-body-sm">
                            <span className={cn('badge', r.status === 'succeeded' ? 'badge-success' : r.status === 'failed' ? 'badge-error' : 'badge-info')}>
                              {r.status}
                            </span>
                            <span className="ml-2 text-mono text-caption text-tertiary">{r.id.slice(0, 8)}</span>
                          </div>
                          <div className="text-caption text-tertiary mt-1">
                            {formatTimestamp(r.createdAt)} • Fonte: {r.invocationSource}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-body-sm text-secondary mb-2">Log de Atividades</h3>
                {activity.length === 0 ? (
                  <p className="text-body-sm text-tertiary">Nenhuma atividade registrada.</p>
                ) : (
                  <div className="stack-xs">
                    {activity.slice(0, 20).map((ev) => (
                      <div key={ev.id} className="card" style={{ padding: '10px 12px' }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-caption text-mono">{ev.action}</span>
                          <time className="text-caption text-tertiary" dateTime={ev.createdAt}>
                            {formatTimestamp(ev.createdAt)}
                          </time>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
