import { Fragment, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import {
  Send,
  Plus,
  RotateCcw,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Zap,
  Terminal,
  Square,
  Copy,
  Check,
  Paperclip,
  XCircle,
  FolderKanban,
  X,
} from 'lucide-react'
import { cn, formatTime, getInitials, getAgentColor } from '../lib/utils'
import { api } from '../lib/api'
import { useChat, useChats } from '../hooks/useChat'
import type { Agent, HeartbeatRun, Message, Project } from '../types/api'

interface ChatViewProps {
  agent: Agent
  companyId: string
  agents?: Agent[]
  onSelectAgent?: (agentRef: string) => void
  onNewMessage?: (message: Message) => void
}

function renderFormattedInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const tokenRe = /(`[^`]+`|\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const tok = match[0]
    if (tok.startsWith('`') && tok.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="text-mono"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '4px', fontSize: '0.88em' }}
        >
          {tok.slice(1, -1)}
        </code>
      )
    } else if (tok.startsWith('**') && tok.endsWith('**')) {
      parts.push(<strong key={match.index}>{tok.slice(2, -2)}</strong>)
    } else {
      parts.push(
        <a key={match.index} href={tok} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
          {tok}
        </a>
      )
    }
    lastIndex = tokenRe.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function FormattedMessage({ content }: { content: string }) {
  const segments = content.split(/(```[\s\S]*?```)/g)
  return (
    <div className="stack-xs" style={{ lineHeight: 1.55 }}>
      {segments.map((seg, idx) => {
        if (seg.startsWith('```') && seg.endsWith('```')) {
          const inner = seg.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, '')
          return (
            <pre key={idx} className="log-console" style={{ maxHeight: '260px', margin: '4px 0' }}>
              {inner}
            </pre>
          )
        }
        return (
          <Fragment key={idx}>
            {seg.split('\n').map((line, lIdx) => {
              const trimmed = line.trim()
              if (!trimmed) return <div key={lIdx} style={{ height: '4px' }} />
              if (/^#{1,3}\s+/.test(trimmed)) {
                return (
                  <div key={lIdx} style={{ fontWeight: 700, fontSize: '1.02em', marginTop: '4px' }}>
                    {renderFormattedInline(trimmed.replace(/^#{1,3}\s+/, ''))}
                  </div>
                )
              }
              if (/^[-*]\s+/.test(trimmed)) {
                return (
                  <div key={lIdx} style={{ paddingLeft: '14px', textIndent: '-10px' }}>
                    {'• '}
                    {renderFormattedInline(trimmed.replace(/^[-*]\s+/, ''))}
                  </div>
                )
              }
              return <div key={lIdx}>{renderFormattedInline(line)}</div>
            })}
          </Fragment>
        )
      })}
    </div>
  )
}

export function ChatView({ agent, companyId, agents = [], onSelectAgent, onNewMessage }: ChatViewProps) {
  const [subject, setSubject] = useState('')
  const [showSubjectHistory, setShowSubjectHistory] = useState(false)
  const [newSubjectInput, setNewSubjectInput] = useState('')
  const [showNewSubjectInput, setShowNewSubjectInput] = useState(false)
  const [waking, setWaking] = useState(false)
  const [wakeNotice, setWakeNotice] = useState<string | null>(null)
  const [liveRun, setLiveRun] = useState<HeartbeatRun | null>(null)
  const [showLiveLog, setShowLiveLog] = useState(false)
  const [liveLogText, setLiveLogText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [savingProject, setSavingProject] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    session,
    messages,
    loading,
    sending,
    error,
    subject: currentSubject,
    fetchSession,
    selectSessionById,
    createNewSession,
    updateSessionProject,
    sendMessage,
    refreshSession,
  } = useChat({
    companyId,
    agentRef: agent.ref,
    onNewMessage,
  })

  const { chats, refetch: refetchChats } = useChats({
    companyId,
    agentRef: agent.ref,
  })

  useEffect(() => {
    if (currentSubject) {
      setSubject(currentSubject)
    } else {
      setSubject('')
    }
  }, [currentSubject])

  useEffect(() => {
    setSelectedProjectId(session?.projectId ?? null)
  }, [session?.id, session?.projectId])

  useEffect(() => {
    api.listProjects(companyId).then(setProjects).catch(() => setProjects([]))
  }, [companyId])

  const scrollToBottom = useCallback(() => {
    const el = messagesEndRef.current
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  const prevLiveRunIdRef = useRef<string | null>(null)

  const pollLive = useCallback(() => {
    api
      .listLiveRuns(companyId)
      .then((runs) => {
        const match = runs.find(
          (r) => r.agentId === agent.id && (r.status === 'running' || r.status === 'queued')
        )
        const nextRun = match ?? null
        setLiveRun(nextRun)
        if (prevLiveRunIdRef.current && !nextRun) {
          refreshSession()
          refetchChats()
        }
        prevLiveRunIdRef.current = nextRun?.id ?? null
      })
      .catch(() => {})
  }, [companyId, agent.id, refreshSession, refetchChats])

  // Monitorar execuções ao vivo deste agente
  useEffect(() => {
    prevLiveRunIdRef.current = null
    pollLive()
    const timer = setInterval(pollLive, 4000)
    return () => {
      clearInterval(timer)
    }
  }, [pollLive])

  // Auto-refresh do log ao vivo quando o modal estiver aberto
  useEffect(() => {
    if (!showLiveLog || !liveRun) return
    let active = true
    const loadLog = () => {
      api
        .getRunLog(liveRun.id)
        .then((res) => {
          if (active) setLiveLogText(res.content || '(Aguardando saída...)')
        })
        .catch(() => {
          if (active) setLiveLogText(liveRun.stdoutExcerpt || 'Log ao vivo ainda iniciando...')
        })
    }
    loadLog()
    const timer = setInterval(loadLog, 3000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [showLiveLog, liveRun])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const textarea = textareaRef.current
    if (!textarea) return

    const content = textarea.value.trim()
    if (!content || sending) return

    textarea.value = ''
    textarea.style.height = 'auto'

    try {
      await sendMessage(content)
      setTimeout(pollLive, 400)
      setTimeout(pollLive, 1500)
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }

  const handleNewSubject = async () => {
    const subjectText = newSubjectInput.trim() || undefined
    try {
      await createNewSession(subjectText, selectedProjectId)
      setShowNewSubjectInput(false)
      setNewSubjectInput('')
      refetchChats()
    } catch (err) {
      console.error('Failed to create new subject:', err)
    }
  }

  const handleProjectChange = async (projectId: string | null) => {
    setSelectedProjectId(projectId)
    if (!session?.id) return
    setSavingProject(true)
    try {
      await updateSessionProject(projectId)
      const pName = projects.find((p) => p.id === projectId)?.name
      setWakeNotice(
        projectId
          ? `Projeto "${pName ?? projectId}" vinculado a esta conversa`
          : 'Projeto desvinculado desta conversa'
      )
      setTimeout(() => setWakeNotice(null), 4000)
    } catch (err) {
      setWakeNotice(err instanceof Error ? err.message : 'Erro ao vincular projeto')
    } finally {
      setSavingProject(false)
    }
  }

  const handleCreateProjectInline = async (name: string) => {
    setSavingProject(true)
    try {
      const created = await api.createProject(companyId, { name, status: 'in_progress' })
      setProjects((prev) => [...prev, created])
      setSelectedProjectId(created.id)
      if (session?.id) {
        await updateSessionProject(created.id)
      }
      setWakeNotice(`Projeto "${created.name}" criado e vinculado`)
      setTimeout(() => setWakeNotice(null), 4000)
    } catch (err) {
      setWakeNotice(err instanceof Error ? err.message : 'Erro ao criar projeto')
    } finally {
      setSavingProject(false)
    }
  }

  const handleSelectExistingChat = async (issueId: string) => {
    try {
      await selectSessionById(issueId)
      setShowSubjectHistory(false)
    } catch (err) {
      console.error('Failed to switch session:', err)
    }
  }

  const handleWakeup = async () => {
    try {
      setWaking(true)
      await api.wakeupAgent(agent.id, `Wakeup via Chat (${subject || 'conversa'})`)
      setWakeNotice(`Sinal de despertar enviado para ${agent.name}`)
      setTimeout(() => setWakeNotice(null), 4000)
    } catch (err) {
      setWakeNotice(err instanceof Error ? err.message : 'Falha ao acordar agente')
    } finally {
      setWaking(false)
    }
  }

  const handleStopLiveRun = async () => {
    if (!liveRun) return
    try {
      await api.cancelRun(liveRun.id)
      setLiveRun(null)
      setShowLiveLog(false)
      setWakeNotice(`Execução de ${agent.name} interrompida`)
      setTimeout(() => setWakeNotice(null), 4000)
    } catch (err) {
      setWakeNotice(err instanceof Error ? err.message : 'Falha ao parar execução')
    }
  }

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session) return
    setUploading(true)
    try {
      const att = await api.uploadIssueAttachment(companyId, session.id, file)
      await sendMessage(`[Anexo enviado: ${att.filename}]`)
    } catch (err) {
      setWakeNotice(err instanceof Error ? err.message : 'Erro ao enviar anexo')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const delegatorAgent = session?.createdByAgentId
    ? agents.find((a) => a.id === session.createdByAgentId) ?? null
    : null

  const headerBlock = (
    <div className="chat-view__header">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="avatar avatar-md"
            style={{ backgroundColor: getAgentColor(agent.ref) }}
            aria-hidden="true"
          >
            {agent.avatar ? <img src={agent.avatar} alt="" /> : getInitials(agent.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-h3 text-primary text-truncate" style={{ fontSize: '1.05rem' }}>
                {agent.name}
              </h2>
              {delegatorAgent && (
                <button
                  type="button"
                  className="badge badge-brand"
                  style={{ border: 'none', cursor: onSelectAgent ? 'pointer' : 'default' }}
                  onClick={() => onSelectAgent?.(delegatorAgent.ref)}
                  title={`Ver conversa de ${delegatorAgent.name}`}
                >
                  Delegada por {delegatorAgent.name}
                </button>
              )}
            </div>
            <p className="text-caption text-tertiary text-truncate">
              {agent.role}
              {session?.identifier ? ` • ${session.identifier}` : ''}
              {subject ? ` • ${subject}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ProjectCombobox
            projects={projects}
            selectedProjectId={selectedProjectId}
            disabled={savingProject}
            onSelect={handleProjectChange}
            onCreateProject={handleCreateProjectInline}
          />
          {liveRun && (
            <button
              type="button"
              className="btn btn-warning btn-sm"
              onClick={() => setShowLiveLog(true)}
              aria-label={`Ver o que ${agent.name} está executando agora`}
            >
              <Terminal size={14} aria-hidden="true" />
              Executando agora (Ver Log)
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleWakeup}
            disabled={waking}
            title="Acordar agente (Wakeup)"
            aria-label={`Acordar ${agent.name}`}
          >
            {waking ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Zap size={14} aria-hidden="true" />}
            Acordar
          </button>

          {chats.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowSubjectHistory(!showSubjectHistory)}
              aria-expanded={showSubjectHistory}
              aria-label="Histórico de conversas"
            >
              Histórico ({chats.length})
              {showSubjectHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowNewSubjectInput(!showNewSubjectInput)}
            aria-expanded={showNewSubjectInput}
          >
            <Plus size={14} aria-hidden="true" />
            Nova Conversa
          </button>

          {session && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={refreshSession}
              aria-label="Atualizar conversa"
              title="Atualizar mensagens"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </div>

      {wakeNotice && (
        <div
          className="badge badge-info mt-2"
          role="status"
          aria-live="polite"
        >
          {wakeNotice}
        </div>
      )}

      {showNewSubjectInput && (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="text"
            className="input-base flex-1"
            style={{ minHeight: '38px', padding: '6px 12px', fontSize: '0.875rem' }}
            placeholder="Assunto da conversa (opcional — deixe em branco para chat principal)"
            value={newSubjectInput}
            onChange={(e) => setNewSubjectInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleNewSubject()
              }
            }}
            aria-label="Assunto da nova conversa"
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={handleNewSubject}>
            Iniciar
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowNewSubjectInput(false)}
          >
            Cancelar
          </button>
        </div>
      )}

      {showSubjectHistory && chats.length > 0 && (
        <div
          className="mt-3 p-2"
          style={{
            backgroundColor: 'var(--color-bg-surface-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-subtle)',
            maxHeight: '180px',
            overflowY: 'auto',
          }}
          role="region"
          aria-label="Conversas anteriores"
        >
          <ul style={{ listStyle: 'none' }} className="stack-xs">
            {chats.map((c) => {
              const del = c.createdByAgentId ? agents.find((a) => a.id === c.createdByAgentId) : null
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={cn(
                      'dropdown-item',
                      session?.id === c.id && 'badge-brand'
                    )}
                    onClick={() => handleSelectExistingChat(c.id)}
                  >
                    <MessageSquare size={14} aria-hidden="true" />
                    {c.identifier && (
                      <span className="text-mono text-caption text-tertiary">{c.identifier}</span>
                    )}
                    <span className="text-truncate flex-1">{c.subject}</span>
                    {del && (
                      <span className="badge badge-info" style={{ fontSize: '10px' }}>
                        de {del.name.split(' ')[0]}
                      </span>
                    )}
                    {c.status && (
                      <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                        {c.status}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )

  if (loading && !session && messages.length === 0) {
    return (
      <div className="chat-view">
        {headerBlock}
        <div
          className="flex-1 flex flex-col items-center justify-center p-4"
          aria-busy="true"
          aria-label="Carregando conversa"
        >
          <div
            className="skeleton"
            style={{ height: '32px', width: '192px' }}
            data-testid="chat-loading-skeleton"
            aria-hidden="true"
          />
          <div
            className="skeleton mt-2"
            style={{ height: '16px', width: '256px' }}
            aria-hidden="true"
          />
          <div
            className="skeleton mt-2"
            style={{ height: '16px', width: '192px' }}
            aria-hidden="true"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="chat-view">
      {headerBlock}

      <div
        className="chat-view__messages"
        role="log"
        aria-live="polite"
        aria-label="Mensagens"
      >
        {error && (
          <div className="error-inline" role="alert">
            <AlertCircle size={18} className="error-inline__icon" aria-hidden="true" />
            <div>
              <strong>Erro na conversa:</strong> {error.message}
              <div>
                <button className="btn btn-ghost btn-sm mt-2" onClick={fetchSession}>
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        {!session && !error && (
          <div className="empty-state flex-1">
            <MessageSquare className="empty-state__icon" size={48} aria-hidden="true" />
            <div>
              <h3 className="empty-state__title">Nenhuma conversa ativa com {agent.name}</h3>
              <p className="empty-state__description">
                Inicie o chat direto com {agent.name} para enviar instruções e acompanhar respostas.
              </p>
              <div className="empty-state__action">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => createNewSession(undefined, selectedProjectId)}
                >
                  <Plus size={16} aria-hidden="true" />
                  Iniciar Conversa
                </button>
              </div>
            </div>
          </div>
        )}

        {session && messages.length === 0 && !error && (
          <div className="empty-state flex-1">
            <MessageSquare className="empty-state__icon" size={48} aria-hidden="true" />
            <div>
              <h3 className="empty-state__title">Conversa iniciada</h3>
              <p className="empty-state__description">
                Envie a primeira mensagem para {agent.name}
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            agent={agent}
            agents={agents}
            onSelectAgent={onSelectAgent}
            isOwn={message.role === 'user'}
            isSending={message.id.startsWith('temp-')}
          />
        ))}

        {liveRun && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 p-3"
            style={{
              backgroundColor: 'rgba(124, 77, 255, 0.08)',
              border: '1px solid rgba(124, 77, 255, 0.35)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Loader2
              size={16}
              className="animate-spin"
              style={{ color: 'var(--color-brand-primary)', marginTop: '2px', flexShrink: 0 }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <div className="text-body-sm" style={{ fontWeight: 600 }}>
                {agent.name}{' '}
                {liveRun.status === 'queued'
                  ? 'está na fila para iniciar...'
                  : 'está analisando e executando sua solicitação agora...'}
              </div>
              <div className="text-caption text-tertiary mt-1">
                A resposta aparecerá aqui automaticamente ao concluir.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm flex-shrink-0"
              onClick={() => setShowLiveLog(true)}
            >
              <Terminal size={13} aria-hidden="true" />
              Acompanhar execução
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        className="chat-view__input"
        onSubmit={handleSendMessage}
        aria-label={`Enviar mensagem para ${agent.name}`}
      >
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            id="chat-file-upload"
            onChange={handleUploadAttachment}
            disabled={uploading || !session}
          />
          <label
            htmlFor="chat-file-upload"
            className={cn('btn btn-ghost btn-icon flex-shrink-0', (!session || uploading) && 'opacity-40')}
            title="Anexar arquivo à conversa"
            aria-label="Anexar arquivo"
            style={{ pointerEvents: !session || uploading ? 'none' : 'auto' }}
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
          </label>
          <textarea
            ref={textareaRef}
            className="input-base flex-1"
            rows={1}
            placeholder={
              session
                ? `Mensagem para ${agent.name}... (Enter para enviar)`
                : 'Clique em "Iniciar Conversa" ou "Nova Conversa" acima...'
            }
            onKeyDown={handleKeyDown}
            onChange={handleTextareaInput}
            disabled={sending || !session}
            aria-label={`Mensagem para ${agent.name}`}
            style={{ minHeight: '44px', maxHeight: '160px', resize: 'none' }}
          />
          <button
            type="submit"
            className="btn btn-primary btn-icon flex-shrink-0"
            disabled={sending || !session}
            aria-label={sending ? 'Enviando mensagem...' : 'Enviar mensagem'}
          >
            {sending ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                <span className="sr-only">Enviando...</span>
              </>
            ) : (
              <Send size={20} aria-hidden="true" />
            )}
          </button>
        </div>
      </form>

      {showLiveLog && liveRun && (
        <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="chat-live-log-title">
          <div className="modal-backdrop" onClick={() => setShowLiveLog(false)} aria-hidden="true" />
          <div className="modal-card modal-card--lg">
            <div className="modal__header">
              <h3 id="chat-live-log-title" className="modal__title">
                Execução ao vivo — {agent.name}
              </h3>
              <button className="modal__close" onClick={() => setShowLiveLog(false)} aria-label="Fechar log ao vivo">
                <XCircle size={20} />
              </button>
            </div>
            <div className="modal__body stack-md">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-caption text-secondary">
                  Run <span className="text-mono">{liveRun.id.slice(0, 8)}</span> • Status: <strong>{liveRun.status}</strong> (atualiza a cada 3s)
                </span>
                <button className="btn btn-danger btn-sm" onClick={handleStopLiveRun}>
                  <Square size={12} /> Parar Execução
                </button>
              </div>
              <pre className="log-console">{liveLogText || 'Aguardando logs...'}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
  agent: Agent
  agents: Agent[]
  onSelectAgent?: (agentRef: string) => void
  isOwn: boolean
  isSending: boolean
}

function MessageBubble({ message, agent, agents, onSelectAgent, isOwn, isSending }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const authorAgent = message.authorAgentId
    ? agents.find((a) => a.id === message.authorAgentId) ?? agent
    : agent
  const isOtherAgent = Boolean(message.authorAgentId && message.authorAgentId !== agent.id)

  const handleCopy = () => {
    navigator.clipboard?.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  return (
    <div className={cn('message-bubble', isOwn && 'message-bubble--own')}>
      {!isOwn && (
        <div
          className="avatar avatar-sm flex-shrink-0"
          style={{ backgroundColor: getAgentColor(authorAgent.ref) }}
          aria-hidden="true"
        >
          {authorAgent.avatar ? <img src={authorAgent.avatar} alt="" /> : getInitials(authorAgent.name)}
        </div>
      )}
      <div
        className="message-bubble__content"
        style={{ textAlign: isOwn ? 'right' : 'left' }}
      >
        {!isOwn && (
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-caption text-secondary" style={{ fontWeight: 600 }}>
              {authorAgent.name}
            </span>
            {isOtherAgent && onSelectAgent && (
              <button
                type="button"
                className="badge badge-brand"
                style={{ border: 'none', cursor: 'pointer', fontSize: '10px' }}
                onClick={() => onSelectAgent(authorAgent.ref)}
              >
                Abrir chat
              </button>
            )}
            {message.isBriefing && (
              <span className="badge badge-info" style={{ fontSize: '10px' }}>
                Instrução inicial
              </span>
            )}
          </div>
        )}
        <div
          className={cn(
            'message-bubble__text',
            isOwn ? 'message-bubble__text--own' : 'message-bubble__text--agent'
          )}
          style={{ opacity: isSending ? 0.65 : 1 }}
        >
          <FormattedMessage content={message.content} />
          {isSending && (
            <div className="flex items-center justify-end gap-1 mt-1 text-caption text-tertiary">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              <span>Enviando...</span>
            </div>
          )}
        </div>
        <div
          className="flex items-center gap-2 mt-1"
          style={{ justifyContent: isOwn ? 'flex-end' : 'flex-start' }}
        >
          <time className="text-caption text-tertiary" dateTime={message.timestamp}>
            {formatTime(message.timestamp)}
          </time>
          {!isSending && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copiar mensagem"
              title="Copiar texto"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-tertiary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
              }}
            >
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface ProjectComboboxProps {
  projects: Project[]
  selectedProjectId: string | null
  disabled?: boolean
  onSelect: (projectId: string | null) => void
  onCreateProject: (name: string) => Promise<void>
}

type ComboOption =
  | { kind: 'none'; id: string; label: string }
  | { kind: 'project'; id: string; label: string; status: string }
  | { kind: 'create'; id: string; label: string; name: string }

function ProjectCombobox({
  projects,
  selectedProjectId,
  disabled,
  onSelect,
  onCreateProject,
}: ProjectComboboxProps) {
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setQuery(selectedProject?.name ?? '')
    }
  }, [selectedProject, open])

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const trimmed = query.trim().toLowerCase()
  const filteredProjects = projects.filter((p) =>
    !trimmed || p.name.toLowerCase().includes(trimmed)
  )
  const exactMatch = projects.some((p) => p.name.toLowerCase() === trimmed)

  const options: ComboOption[] = [
    { kind: 'none', id: '__none__', label: 'Nenhum projeto (geral)' },
    ...filteredProjects.map((p) => ({
      kind: 'project' as const,
      id: p.id,
      label: p.name,
      status: p.status,
    })),
    ...(trimmed && !exactMatch
      ? [
          {
            kind: 'create' as const,
            id: '__create__',
            label: `Criar projeto "${query.trim()}"`,
            name: query.trim(),
          },
        ]
      : []),
  ]

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  const commitOption = async (opt: ComboOption) => {
    setOpen(false)
    if (opt.kind === 'none') {
      setQuery('')
      onSelect(null)
    } else if (opt.kind === 'project') {
      setQuery(opt.label)
      onSelect(opt.id)
    } else {
      await onCreateProject(opt.name)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % Math.max(1, options.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + options.length) % Math.max(1, options.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = options[activeIndex]
      if (opt) commitOption(opt)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery(selectedProject?.name ?? '')
    }
  }

  const listboxId = 'chat-project-combobox-listbox'
  const activeOpt = open && options[activeIndex] ? `proj-opt-${options[activeIndex].id}` : undefined

  return (
    <div ref={containerRef} className="relative" style={{ minWidth: '215px' }}>
      <div className="relative flex items-center">
        <FolderKanban
          size={14}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '10px',
            color: selectedProject ? 'var(--color-brand-primary)' : 'var(--color-text-tertiary)',
            pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOpt}
          aria-label="Projeto da conversa"
          className="input-base"
          style={{
            minHeight: '36px',
            padding: '4px 54px 4px 30px',
            fontSize: '0.8125rem',
            borderColor: selectedProject ? 'var(--color-brand-primary)' : undefined,
          }}
          placeholder="Projeto: Geral (digite...)"
          value={open ? query : (selectedProject?.name ?? '')}
          disabled={disabled}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        <div
          style={{
            position: 'absolute',
            right: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {selectedProjectId && (
            <button
              type="button"
              onClick={() => {
                onSelect(null)
                setQuery('')
              }}
              aria-label="Desvincular projeto"
              title="Desvincular projeto"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-tertiary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'inline-flex',
              }}
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-label={open ? 'Fechar lista de projetos' : 'Abrir lista de projetos'}
            onClick={() => {
              if (open) {
                setOpen(false)
              } else {
                setQuery('')
                setOpen(true)
                inputRef.current?.focus()
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              padding: '4px',
              display: 'inline-flex',
            }}
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Projetos disponíveis"
          className="dropdown-menu"
          style={{ width: '100%', maxHeight: '220px', overflowY: 'auto' }}
        >
          {options.map((opt, idx) => {
            const isSelected =
              (opt.kind === 'none' && !selectedProjectId) ||
              (opt.kind === 'project' && opt.id === selectedProjectId)
            const isHighlighted = idx === activeIndex
            return (
              <li
                key={opt.id}
                id={`proj-opt-${opt.id}`}
                role="option"
                aria-selected={isSelected}
              >
                <button
                  type="button"
                  className={cn('dropdown-item', isHighlighted && 'badge-brand')}
                  style={{ fontWeight: isSelected ? 600 : 400 }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    commitOption(opt)
                  }}
                >
                  {opt.kind === 'create' && <Plus size={13} aria-hidden="true" />}
                  <span className="text-truncate flex-1">{opt.label}</span>
                  {opt.kind === 'project' && (
                    <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                      {opt.status}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
