import { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, FileText, CheckCircle, Bell, Settings, Menu } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { ChatView } from './components/ChatView'
import { TaskView } from './components/TaskView'
import { ApprovalView } from './components/ApprovalView'
import { useSession, useAgents } from './hooks/useSession'
import { ToastProvider } from './context/ToastContext'
import { cn, getInitials } from './lib/utils'

const VIEWS = [
  { id: 'chat', label: 'Conversas', icon: MessageSquare },
  { id: 'tasks', label: 'Tarefas', icon: FileText },
  { id: 'approvals', label: 'Aprovações', icon: CheckCircle },
] as const

type ViewId = typeof VIEWS[number]['id']

function AppContent() {
  const { session, loading: sessionLoading, error: sessionError, refetch: refetchSession } = useSession()
  const companyId = session?.company?.id
  const currentUserId = session?.user?.id

  const { agents, loading: agentsLoading, error: agentsError } = useAgents(companyId)

  const [activeView, setActiveView] = useState<ViewId>('chat')
  const [activeAgentRef, setActiveAgentRef] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState<{ id: string; message: string; read: boolean }[]>([])
  const mobileSidebarRef = useRef<HTMLDivElement>(null)

  const activeAgent = agents.find((a) => a.ref === activeAgentRef) || agents[0] || null

  useEffect(() => {
    if (agents.length > 0 && !activeAgentRef) {
      setActiveAgentRef(agents[0].ref)
    }
  }, [agents, activeAgentRef])

  const handleNewMessage = useCallback((message: any) => {
    setNotifications((prev) => [
      { id: message.id, message: `Nova mensagem de ${activeAgent?.name || 'agente'}`, read: false },
      ...prev.slice(0, 9),
    ])
  }, [activeAgent])

  // Focus trap para o mobile sidebar
  useEffect(() => {
    if (!mobileSidebarOpen) return
    const container = mobileSidebarRef.current
    if (!container) return
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const focusableEls = Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
    const firstEl = focusableEls[0]
    const lastEl = focusableEls[focusableEls.length - 1]
    firstEl?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSidebarOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      if (focusableEls.length === 0) { e.preventDefault(); return }
      if (e.shiftKey) {
        if (document.activeElement === firstEl) { e.preventDefault(); lastEl?.focus() }
      } else {
        if (document.activeElement === lastEl) { e.preventDefault(); firstEl?.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileSidebarOpen])

  if (sessionLoading || agentsLoading) {
    return (
      <div className="app-loading flex h-screen items-center justify-center bg-[var(--color-bg-base)]">
        <div className="text-center">
          <div className="skeleton h-8 w-48 rounded-md mx-auto" />
          <div className="skeleton h-4 w-32 rounded-md mx-auto mt-4" />
        </div>
      </div>
    )
  }

  if (sessionError || agentsError) {
    return (
      <div className="app-error flex h-screen items-center justify-center bg-[var(--color-bg-base)] p-8">
        <div className="error-inline max-w-md" role="alert">
          <svg className="error-inline__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong>Erro ao carregar a aplicação</strong>
            <p className="mt-2 text-sm">{sessionError?.message || agentsError?.message}</p>
            <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!session || !companyId) {
    return (
      <div className="app-no-session flex h-screen items-center justify-center bg-[var(--color-bg-base)] p-8">
        <div className="empty-state max-w-md">
          <svg className="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="64" height="64">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
          </svg>
          <h3 className="empty-state__title">Sessão não encontrada</h3>
          <p className="empty-state__description">
            Não foi possível obter a sessão do board. Certifique-se de estar logado no Paperclip.
          </p>
          <div className="empty-state__action">
            <button className="btn btn-primary" onClick={() => refetchSession()}>
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app min-h-screen bg-[var(--color-bg-base)]">
      {/* Skip-link para navegação por teclado */}
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo principal
      </a>

      <header className={cn(
        'app-header fixed top-0 right-0 h-[56px] bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] flex items-center justify-between px-4 z-[var(--z-sticky)] transition-all duration-base',
        sidebarCollapsed ? 'left-[72px]' : 'left-[280px]'
      )}>
        <div className="flex items-center gap-3">
          <button
            className="btn btn-ghost btn-icon lg:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-h3 font-semibold text-[var(--color-text-primary)] hidden sm:block">
            Master JF — Painel Web
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="btn btn-ghost btn-icon relative" aria-label="Notificações">
              <Bell size={24} />
              {notifications.some((n) => !n.read) && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-status-error)] text-[var(--color-text-on-brand)] text-[10px] font-bold flex items-center justify-center"
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={`${notifications.filter((n) => !n.read).length} notificações não lidas`}
                >
                  {notifications.filter((n) => !n.read).length}
                </span>
              )}
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-surface-elevated)] rounded-lg border border-[var(--color-border-subtle)]">
            <div
              className="avatar avatar-sm"
              style={{ backgroundColor: '#7C4DFF' }}
            >
              {session.user.avatar ? (
                <img src={session.user.avatar} alt={session.user.name} />
              ) : (
                getInitials(session.user.name)
              )}
            </div>
            <span className="text-body-sm font-medium text-[var(--color-text-primary)]">
              {session.user.name}
            </span>
          </div>
          <button className="btn btn-ghost btn-icon" aria-label="Configurações">
            <Settings size={24} />
          </button>
        </div>
      </header>

      <Sidebar
        agents={agents}
        activeAgentRef={activeAgentRef}
        onSelectAgent={setActiveAgentRef}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {mobileSidebarOpen && (
        <div
          ref={mobileSidebarRef}
          className="fixed inset-0 z-[var(--z-drawer)] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de agentes"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <Sidebar
            agents={agents}
            activeAgentRef={activeAgentRef}
            onSelectAgent={(ref) => {
              setActiveAgentRef(ref)
              setMobileSidebarOpen(false)
            }}
            collapsed={false}
          />
        </div>
      )}

      <main
        id="main-content"
        className={cn(
          'app-main flex-1 pt-[56px] transition-all duration-base',
          sidebarCollapsed ? 'ml-[72px]' : 'ml-[280px]'
        )}
        tabIndex={-1}
      >
        <div className="h-full">
          {activeView === 'chat' && activeAgent && (
            <ChatView
              agent={activeAgent}
              companyId={companyId}
              onNewMessage={handleNewMessage}
            />
          )}
          {activeView === 'tasks' && (
            <TaskView
              companyId={companyId}
              agents={agents}
              currentAgentId={activeAgent?.id}
              showOnlyAssigned={false}
            />
          )}
          {activeView === 'approvals' && (
            <ApprovalView
              companyId={companyId}
              agents={agents}
              currentUserId={currentUserId}
            />
          )}
          {!activeAgent && activeView === 'chat' && (
            <div className="flex h-full items-center justify-center p-8">
              <div className="empty-state">
                <MessageSquare className="empty-state__icon" size={64} />
                <h3 className="empty-state__title">Selecione um agente</h3>
                <p className="empty-state__description">
                  Clique em um agente na barra lateral para iniciar uma conversa
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <nav
        className={cn(
          'app-nav fixed bottom-0 left-0 right-0 h-[56px] bg-[var(--color-bg-surface)] border-t border-[var(--color-border-subtle)] flex items-center justify-around lg:hidden z-[var(--z-sticky)]',
          sidebarCollapsed ? 'left-[72px]' : 'left-[280px]'
        )}
        aria-label="Navegação principal"
      >
        {VIEWS.map((view) => (
          <button
            key={view.id}
            className={cn(
              'btn btn-ghost btn-icon flex flex-col items-center gap-1 px-3 py-2 min-w-0',
              activeView === view.id && 'text-[var(--color-brand-primary)]'
            )}
            onClick={() => setActiveView(view.id)}
            aria-current={activeView === view.id ? 'page' : undefined}
            aria-label={view.label}
          >
            <view.icon size={24} />
            <span className="text-[var(--text-caption)]">{view.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}