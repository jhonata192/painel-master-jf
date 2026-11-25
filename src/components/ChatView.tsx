import { useState, useRef, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { cn, formatTime, getInitials, getAgentColor } from '../lib/utils'
import { api } from '../lib/api'
import { useChat, useChats } from '../hooks/useChat'
import type { Agent, Message } from '../types/api'

interface ChatViewProps {
  agent: Agent
  companyId: string
  onNewMessage?: (message: Message) => void
}

export function ChatView({ agent, companyId, onNewMessage }: ChatViewProps) {
  const [subject, setSubject] = useState('')
  const [showSubjectHistory, setShowSubjectHistory] = useState(false)
  const [newSubjectInput, setNewSubjectInput] = useState('')
  const [showNewSubjectInput, setShowNewSubjectInput] = useState(false)
  const [waking, setWaking] = useState(false)
  const [wakeNotice, setWakeNotice] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const scrollToBottom = useCallback(() => {
    const el = messagesEndRef.current
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

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
      await createNewSession(subjectText)
      setShowNewSubjectInput(false)
      setNewSubjectInput('')
      refetchChats()
    } catch (err) {
      console.error('Failed to create new subject:', err)
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
            <h2 className="text-h3 text-primary text-truncate" style={{ fontSize: '1.05rem' }}>
              {agent.name}
            </h2>
            <p className="text-caption text-tertiary text-truncate">
              {agent.role}
              {subject ? ` • ${subject}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            {chats.map((c) => (
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
                  <span className="text-truncate flex-1">{c.subject}</span>
                </button>
              </li>
            ))}
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
                  onClick={() => createNewSession()}
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
            isOwn={message.role === 'user'}
            isSending={message.id.startsWith('temp-')}
          />
        ))}

        <div ref={messagesEndRef} />
      </div>

      <form
        className="chat-view__input"
        onSubmit={handleSendMessage}
        aria-label={`Enviar mensagem para ${agent.name}`}
      >
        <div className="flex items-end gap-3">
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
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
  agent: Agent
  isOwn: boolean
  isSending: boolean
}

function MessageBubble({ message, agent, isOwn, isSending }: MessageBubbleProps) {
  return (
    <div className={cn('message-bubble', isOwn && 'message-bubble--own')}>
      {!isOwn && (
        <div
          className="avatar avatar-sm flex-shrink-0"
          style={{ backgroundColor: getAgentColor(agent.ref) }}
          aria-hidden="true"
        >
          {agent.avatar ? <img src={agent.avatar} alt="" /> : getInitials(agent.name)}
        </div>
      )}
      <div
        className="message-bubble__content"
        style={{ textAlign: isOwn ? 'right' : 'left' }}
      >
        {!isOwn && (
          <div className="text-caption text-secondary mb-1" style={{ fontWeight: 500 }}>
            {agent.name}
          </div>
        )}
        <div
          className={cn(
            'message-bubble__text',
            isOwn ? 'message-bubble__text--own' : 'message-bubble__text--agent'
          )}
          style={{ opacity: isSending ? 0.65 : 1 }}
        >
          <p>{message.content}</p>
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
        </div>
      </div>
    </div>
  )
}
