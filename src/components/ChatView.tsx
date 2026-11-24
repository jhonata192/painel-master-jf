import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Plus, RotateCcw, Loader2, AlertCircle, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { cn, formatTime, getInitials, getAgentColor } from '../lib/utils'
import { useChat } from '../hooks/useChat'
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
    createNewSession,
    sendMessage,
    refreshSession,
  } = useChat({
    companyId,
    agentRef: agent.ref,
    onNewMessage,
  })

  useEffect(() => {
    if (currentSubject) {
      setSubject(currentSubject)
    }
  }, [currentSubject])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

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
    } catch (err) {
      console.error('Failed to create new subject:', err)
    }
  }

  const handleSubjectSelect = async (chatSubject: string) => {
    try {
      await createNewSession(chatSubject)
      setShowSubjectHistory(false)
    } catch (err) {
      console.error('Failed to switch subject:', err)
    }
  }

  if (loading && !session && messages.length === 0) {
    return (
      <div className="chat-view flex flex-col h-full">
        <div className="chat-view__header p-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-3">
            <div
              className="avatar avatar-md"
              style={{ backgroundColor: getAgentColor(agent.ref) }}
            >
              {agent.avatar ? (
                <img src={agent.avatar} alt="" />
              ) : (
                getInitials(agent.name)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-h3 font-semibold text-[var(--color-text-primary)] text-truncate">
                {agent.name}
              </h2>
              <p className="text-[var(--text-caption)] text-[var(--color-text-tertiary)] text-truncate">
                {agent.role}
              </p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="skeleton h-8 w-48 rounded-md" data-testid="chat-loading-skeleton" />
          <div className="skeleton h-4 w-64 rounded-md mt-2" />
          <div className="skeleton h-4 w-48 rounded-md mt-2" />
        </div>
      </div>
    )
  }

  if (!session && messages.length === 0) {
    return (
      <div className="chat-view flex flex-col h-full">
        <div className="chat-view__header p-4 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-3">
            <div
              className="avatar avatar-md"
              style={{ backgroundColor: getAgentColor(agent.ref) }}
            >
              {agent.avatar ? (
                <img src={agent.avatar} alt="" />
              ) : (
                getInitials(agent.name)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-h3 font-semibold text-[var(--color-text-primary)] text-truncate">
                {agent.name}
              </h2>
              <p className="text-[var(--text-caption)] text-[var(--color-text-tertiary)] text-truncate">
                {agent.role}
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => createNewSession()}
              disabled={sending}
            >
              <Plus size={18} className="mr-2" />
              Nova Conversa
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="empty-state">
            <MessageSquare className="empty-state__icon" size={64} />
            <h3 className="empty-state__title">Nenhuma conversa iniciada</h3>
            <p className="empty-state__description">
              Clique em "Nova Conversa" para começar a falar com {agent.name}
            </p>
            <div className="empty-state__action">
              <button
                className="btn btn-primary"
                onClick={() => createNewSession()}
              >
                <Plus size={18} className="mr-2" />
                Iniciar Conversa
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-view flex flex-col h-full">
      <div className="chat-view__header p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
        <div className="flex items-center gap-3">
          <div
            className="avatar avatar-md flex-shrink-0"
            style={{ backgroundColor: getAgentColor(agent.ref) }}
          >
            {agent.avatar ? (
              <img src={agent.avatar} alt="" />
            ) : (
              getInitials(agent.name)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-h3 font-semibold text-[var(--color-text-primary)] text-truncate">
              {agent.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="badge badge-brand text-[var(--text-caption)]">
                {agent.role}
              </span>
              {subject && (
                <button
                  className="btn btn-ghost btn-sm flex items-center gap-1 px-2 py-1"
                  onClick={() => setShowSubjectHistory(!showSubjectHistory)}
                  aria-expanded={showSubjectHistory}
                  aria-label={showSubjectHistory ? 'Ocultar histórico de assuntos' : 'Ver histórico de assuntos'}
                >
                  <span className="text-truncate max-w-[200px]">{subject}</span>
                  {showSubjectHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setShowNewSubjectInput(true)}
              aria-label="Novo assunto"
              title="Novo assunto"
            >
              <Plus size={20} />
            </button>
            <button
              className="btn btn-ghost btn-icon"
              onClick={refreshSession}
              disabled={loading}
              aria-label="Atualizar conversa"
              title="Atualizar"
            >
              <RotateCcw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {showSubjectHistory && (
          <div className="mt-3 p-3 bg-[var(--color-bg-surface-elevated)] rounded-lg border border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-body-sm font-medium text-[var(--color-text-primary)]">
                Histórico de Assuntos
              </h3>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setShowSubjectHistory(false)}
                aria-label="Fechar histórico"
              >
                <ChevronUp size={16} />
              </button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {session && (
                <>
                  <button
                    className={cn(
                      'w-full text-left p-2 rounded-md text-sm transition-colors',
                      'hover:bg-[var(--color-bg-surface)]',
                      subject === session.subject
                        ? 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] font-medium'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                    onClick={() => handleSubjectSelect(session.subject)}
                    aria-current={subject === session.subject ? 'true' : 'false'}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-truncate">{session.subject || 'Sem assunto'}</span>
                      {subject === session.subject && (
                        <span className="badge badge-brand badge-sm ml-2">Atual</span>
                      )}
                    </div>
                    <div className="text-[var(--text-caption)] text-[var(--color-text-tertiary)] mt-1">
                      {formatTime(session.updatedAt)} • {session.messageCount} mensagens
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {showNewSubjectInput && (
          <div className="mt-3 p-3 bg-[var(--color-bg-surface-elevated)] rounded-lg border border-[var(--color-border-subtle)]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input-base flex-1"
                placeholder="Título do novo assunto (opcional)"
                value={newSubjectInput}
                onChange={(e) => setNewSubjectInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNewSubject()}
                autoFocus
                aria-label="Título do novo assunto"
              />
              <button
                className="btn btn-primary"
                onClick={handleNewSubject}
                disabled={sending}
              >
                Criar
              </button>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => {
                  setShowNewSubjectInput(false)
                  setNewSubjectInput('')
                }}
                aria-label="Cancelar"
              >
                <RotateCcw size={20} />
              </button>
            </div>
            <p className="text-[var(--text-caption)] text-[var(--color-text-tertiary)] mt-1">
              Inicia uma nova sessão limpa. O histórico do assunto anterior permanece salvo.
            </p>
          </div>
        )}
      </div>

      <div className="chat-view__messages flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite" aria-label="Mensagens">
        {error && (
          <div className="error-inline" role="alert">
            <AlertCircle className="error-inline__icon" size={20} />
            <div>
              <strong>Erro:</strong> {error.message}
              <button
                className="btn btn-ghost btn-sm mt-2"
                onClick={fetchSession}
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {messages.length === 0 && session && (
          <div className="empty-state flex-1 flex items-center justify-center">
            <MessageSquare className="empty-state__icon" size={48} />
            <div className="text-center">
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

      <form className="chat-view__input p-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]" onSubmit={handleSendMessage}>
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            className="input-base flex-1 resize-none"
            rows={1}
            placeholder={`Mensagem para ${agent.name}...`}
            onKeyDown={handleKeyDown}
            onChange={handleTextareaInput}
            disabled={sending || !session}
            aria-label={`Mensagem para ${agent.name}`}
            style={{ minHeight: '44px', maxHeight: '160px' }}
          />
          <button
            type="submit"
            className="btn btn-primary btn-icon flex-shrink-0"
            disabled={sending || !session}
            aria-label="Enviar mensagem"
          >
            {sending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
        {!session && (
          <p className="text-[var(--text-caption)] text-[var(--color-text-tertiary)] mt-2 text-center">
            Clique em "Nova Conversa" no cabeçalho para iniciar
          </p>
        )}
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
    <div
      className={cn(
        'message-bubble flex gap-3 animate-fade-in',
        isOwn && 'flex-row-reverse'
      )}
    >
      {!isOwn && (
        <div
          className="avatar avatar-sm flex-shrink-0"
          style={{ backgroundColor: getAgentColor(agent.ref) }}
          aria-hidden="true"
        >
          {agent.avatar ? (
            <img src={agent.avatar} alt="" />
          ) : (
            getInitials(agent.name)
          )}
        </div>
      )}
      <div
        className={cn(
          'message-bubble__content max-w-[70%]',
          isOwn ? 'text-right' : 'text-left'
        )}
      >
        {!isOwn && (
          <div className="message-bubble__sender text-[var(--text-caption)] font-medium text-[var(--color-text-secondary)] mb-1 ml-1">
            {agent.name}
          </div>
        )}
        <div
          className={cn(
            'message-bubble__text inline-block p-3 rounded-2xl',
            isOwn
              ? 'bg-[var(--color-brand-primary)] text-[var(--color-text-inverse)] rounded-tr-none'
              : 'bg-[var(--color-bg-surface-elevated)] text-[var(--color-text-primary)] rounded-tl-none',
            isSending && 'opacity-60'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          {isSending && (
            <div className="flex items-center justify-end gap-1 mt-1">
              <Loader2 size={12} className="animate-spin text-[var(--color-text-tertiary)]" />
              <span className="text-[var(--text-caption)] text-[var(--color-text-tertiary)]">
                Enviando...
              </span>
            </div>
          )}
        </div>
        <div className="message-bubble__meta flex items-center gap-2 mt-1">
          <time className="text-[var(--text-caption)] text-[var(--color-text-tertiary)]">
            {formatTime(message.timestamp)}
          </time>
          {message.clientRequestId && (
            <span className="text-[var(--text-caption)] text-[var(--color-text-tertiary)] font-mono">
              {message.clientRequestId.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>
      {isOwn && (
        <div className="w-8 flex-shrink-0" aria-hidden="true" />
      )}
    </div>
  )
}