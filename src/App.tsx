import { Component, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  CheckCircle,
  Bot,
  FolderKanban,
  Clock,
  DollarSign,
  Settings,
  Bell,
  Menu,
  Search,
  Radio,
  XCircle,
} from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { DashboardView } from './components/DashboardView'
import { ChatView } from './components/ChatView'
import { TaskView } from './components/TaskView'
import { ApprovalView } from './components/ApprovalView'
import { AgentsView } from './components/AgentsView'
import { ProjectsView } from './components/ProjectsView'
import { RoutinesView } from './components/RoutinesView'
import { CostsView } from './components/CostsView'
import { SettingsView } from './components/SettingsView'
import { useSession, useAgents, useSidebarBadges } from './hooks/useSession'
import { usePaperclipLive } from './hooks/usePaperclipLive'
import { ToastProvider } from './context/ToastContext'
import { api } from './lib/api'
import { cn, getInitials } from './lib/utils'
import type { SearchHit } from './types/api'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'Conversas', icon: MessageSquare },
  { id: 'tasks', label: 'Tarefas', icon: FileText },
  { id: 'approvals', label: 'Aprovações', icon: CheckCircle },
  { id: 'agents', label: 'Agentes', icon: Bot },
  { id: 'projects', label: 'Projetos', icon: FolderKanban },
  { id: 'routines', label: 'Rotinas & Logs', icon: Clock },
  { id: 'costs', label: 'Custos', icon: DollarSign },
  { id: 'settings', label: 'Sistema', icon: Settings },
] as const

type ViewId = (typeof VIEWS)[number]['id']

class ViewErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="view-body">
          <div className="error-inline" role="alert">
            <div>
              <strong>Erro ao renderizar esta seção</strong>
              <p className="mt-2 text-body-sm">{this.state.error.message}</p>
              <button
                className="btn btn-primary btn-sm mt-3"
                onClick={() => {
                  this.setState({ error: null })
                  this.props.onReset()
                }}
              >
                Voltar ao Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppContent() {
  const {
    session,
    companies,
    switchCompany,
    loading: sessionLoading,
    error: sessionError,
    refetch: refetchSession,
  } = useSession()
  const companyId = session?.company?.id
  const currentUserId = session?.user?.id

  const {
    agents,
    loading: agentsLoading,
    error: agentsError,
    refetch: refetchAgents,
  } = useAgents(companyId)
  const { badges, refetch: refetchBadges } = useSidebarBadges(companyId)

  const [activeView, setActiveView] = useState<ViewId>('dashboard')
  const [activeAgentRef, setActiveAgentRef] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<{ id: string; message: string; read: boolean }[]>([])

  // Busca global (Ctrl+K)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)

  const mobileSidebarRef = useRef<HTMLDivElement>(null)
  const activeAgent = agents.find((a) => a.ref === activeAgentRef) || agents[0] || null

  useEffect(() => {
    if (agents.length > 0 && !activeAgentRef) {
      setActiveAgentRef(agents[0].ref)
    }
  }, [agents, activeAgentRef])

  const handleLiveEvent = useCallback(() => {
    refetchBadges()
    refetchAgents()
  }, [refetchBadges, refetchAgents])

  const { connected: wsConnected } = usePaperclipLive(companyId, handleLiveEvent)

  const handleNewMessage = useCallback(
    (message: { id: string }) => {
      setNotifications((prev) => [
        { id: message.id, message: `Nova mensagem em conversa com ${activeAgent?.name || 'agente'}`, read: false },
        ...prev.slice(0, 9),
      ])
    },
    [activeAgent]
  )

  // Atalho Ctrl+K para busca global
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Executar busca global com debounce
  useEffect(() => {
    if (!searchOpen || !companyId || searchTerm.trim().length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.search(companyId, searchTerm.trim(), 15)
        setSearchResults(res.results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchOpen, companyId, searchTerm])

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
      if (focusableEls.length === 0) {
        e.preventDefault()
        return
      }
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault()
          lastEl?.focus()
        }
      } else if (document.activeElement === lastEl) {
        e.preventDefault()
        firstEl?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mobileSidebarOpen])

  const handleSelectAgentFromSidebar = (ref: string) => {
    setActiveAgentRef(ref)
    setActiveView('chat')
    setMobileSidebarOpen(false)
  }

  const handleSearchHitClick = (hit: SearchHit) => {
    setSearchOpen(false)
    if (hit.type === 'agent') {
      const ag = agents.find((a) => a.id === hit.id)
      if (ag) {
        setActiveAgentRef(ag.ref)
        setActiveView('chat')
        return
      }
      setActiveView('agents')
    } else if (hit.type === 'issue') {
      setActiveView('tasks')
    } else if (hit.type === 'project' || hit.type === 'goal') {
      setActiveView('projects')
    } else {
      setActiveView('dashboard')
    }
  }

  if (sessionLoading || (agentsLoading && agents.length === 0)) {
    return (
      <div className="app-loading">
        <div style={{ textAlign: 'center' }} aria-busy="true" aria-label="Carregando painel">
          <div className="skeleton" style={{ height: '32px', width: '200px', margin: '0 auto' }} />
          <div className="skeleton mt-3" style={{ height: '16px', width: '140px', margin: '12px auto 0' }} />
        </div>
      </div>
    )
  }

  if (sessionError || agentsError) {
    return (
      <div className="app-error">
        <div className="error-inline" style={{ maxWidth: '460px' }} role="alert">
          <svg className="error-inline__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong>Erro ao carregar a aplicação</strong>
            <p className="mt-2 text-body-sm">{sessionError?.message || agentsError?.message}</p>
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
      <div className="app-no-session">
        <div className="empty-state" style={{ maxWidth: '420px' }}>
          <h3 className="empty-state__title">Sessão não encontrada</h3>
          <p className="empty-state__description">
            Não foi possível obter a sessão do board no Paperclip.
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

  const unreadNotifCount = notifications.filter((n) => !n.read).length

  const getBadgeForView = (id: ViewId): { count: number; warn?: boolean } => {
    if (id === 'tasks' && badges.inbox > 0) return { count: badges.inbox }
    if (id === 'approvals' && badges.approvals > 0) return { count: badges.approvals, warn: true }
    if (id === 'routines' && badges.failedRuns > 0) return { count: badges.failedRuns, warn: true }
    return { count: 0 }
  }

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo principal
      </a>

      <header
        className={cn(
          'app-header',
          sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="btn btn-ghost btn-icon mobile-only"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Abrir menu de agentes"
          >
            <Menu size={22} />
          </button>

          <h1 className="text-h3 text-primary text-truncate" style={{ fontSize: '1.05rem' }}>
            {session.company.name || 'Master JF — Painel Web'}
          </h1>

          {companies.length > 1 && (
            <select
              className="input-base desktop-only"
              style={{ width: 'auto', minHeight: '34px', padding: '4px 10px', fontSize: '0.8rem' }}
              value={companyId}
              onChange={(e) => switchCompany(e.target.value)}
              aria-label="Selecionar empresa"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSearchOpen(true)}
            aria-label="Busca global (Ctrl+K)"
            title="Buscar em toda a empresa (Ctrl+K)"
          >
            <Search size={15} aria-hidden="true" />
            <span className="desktop-only">Buscar</span>
          </button>

          <span
            className={cn('badge desktop-only', wsConnected ? 'badge-success' : 'badge-neutral')}
            title={wsConnected ? 'WebSocket conectado em tempo real' : 'Atualização periódica ativa'}
          >
            <Radio size={12} aria-hidden="true" />
            {wsConnected ? 'Ao vivo' : 'Sync'}
          </span>

          <div className="relative">
            <button
              className="btn btn-ghost btn-icon relative"
              aria-label="Notificações"
              aria-expanded={showNotifications}
              onClick={() => {
                setShowNotifications((prev) => !prev)
                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
              }}
            >
              <Bell size={20} />
              {unreadNotifCount > 0 && (
                <span
                  className="nav-pill__badge nav-pill__badge--warn"
                  style={{ position: 'absolute', top: '4px', right: '4px' }}
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={`${unreadNotifCount} notificações não lidas`}
                >
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                className="dropdown-menu"
                style={{ left: 'auto', right: 0, width: '280px', padding: '8px' }}
                role="region"
                aria-label="Notificações recentes"
              >
                <div className="text-caption text-secondary mb-2" style={{ fontWeight: 600 }}>
                  Notificações ({notifications.length})
                </div>
                {notifications.length === 0 ? (
                  <p className="text-caption text-tertiary p-2">Sem notificações recentes.</p>
                ) : (
                  <div className="stack-xs">
                    {notifications.map((n) => (
                      <div key={n.id} className="text-caption p-2" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        {n.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className="desktop-only flex items-center gap-2"
            style={{
              padding: '4px 10px',
              backgroundColor: 'var(--color-bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div className="avatar avatar-sm" style={{ backgroundColor: '#7C4DFF' }}>
              {session.user.avatar ? (
                <img src={session.user.avatar} alt={session.user.name} />
              ) : (
                getInitials(session.user.name)
              )}
            </div>
            <span className="text-body-sm text-primary">{session.user.name}</span>
          </div>

          <button
            className="btn btn-ghost btn-icon"
            aria-label="Configurações do sistema"
            onClick={() => setActiveView('settings')}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <Sidebar
        agents={agents}
        activeAgentRef={activeAgentRef}
        onSelectAgent={handleSelectAgentFromSidebar}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {mobileSidebarOpen && (
        <div
          ref={mobileSidebarRef}
          className="mobile-overlay mobile-only"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de agentes"
        >
          <div
            className="mobile-overlay__backdrop"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <Sidebar
            agents={agents}
            activeAgentRef={activeAgentRef}
            onSelectAgent={handleSelectAgentFromSidebar}
            collapsed={false}
            mobile
          />
        </div>
      )}

      <main
        id="main-content"
        className={cn(
          'app-main',
          sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
        )}
        tabIndex={-1}
      >
        {/* Navegação Desktop visível entre todas as áreas do Paperclip */}
        <nav className="desktop-top-nav" aria-label="Navegação principal do painel">
          {VIEWS.map((view) => {
            const b = getBadgeForView(view.id)
            return (
              <button
                key={view.id}
                className={cn('nav-pill', activeView === view.id && 'active')}
                onClick={() => setActiveView(view.id)}
                aria-current={activeView === view.id ? 'page' : undefined}
              >
                <view.icon size={15} aria-hidden="true" />
                <span>{view.label}</span>
                {b.count > 0 && (
                  <span className={cn('nav-pill__badge', b.warn && 'nav-pill__badge--warn')}>
                    {b.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex-1 flex flex-col min-h-0">
          <ViewErrorBoundary key={activeView} onReset={() => setActiveView('dashboard')}>
            {activeView === 'dashboard' && (
            <DashboardView
              companyId={companyId}
              agents={agents}
              onNavigate={(v) => setActiveView(v as ViewId)}
            />
          )}

          {activeView === 'chat' && activeAgent && (
            <ChatView
              agent={activeAgent}
              companyId={companyId}
              onNewMessage={handleNewMessage}
            />
          )}

          {activeView === 'chat' && !activeAgent && (
            <div className="empty-state flex-1">
              <MessageSquare className="empty-state__icon" size={56} />
              <h3 className="empty-state__title">Selecione um agente</h3>
              <p className="empty-state__description">
                Clique em um agente na barra lateral para iniciar uma conversa.
              </p>
            </div>
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

          {activeView === 'agents' && (
            <AgentsView
              companyId={companyId}
              agents={agents}
              onRefreshAgents={refetchAgents}
              onOpenChat={(ref) => {
                setActiveAgentRef(ref)
                setActiveView('chat')
              }}
            />
          )}

          {activeView === 'projects' && (
            <ProjectsView companyId={companyId} agents={agents} />
          )}

          {activeView === 'routines' && (
            <RoutinesView companyId={companyId} agents={agents} />
          )}

          {activeView === 'costs' && (
            <CostsView companyId={companyId} agents={agents} />
          )}

            {activeView === 'settings' && (
              <SettingsView company={session.company} onCompanyUpdated={refetchSession} />
            )}
          </ViewErrorBoundary>
        </div>
      </main>

      {/* Navegação inferior Mobile */}
      <nav className="app-nav-mobile" aria-label="Navegação principal mobile">
        {VIEWS.slice(0, 6).map((view) => (
          <button
            key={view.id}
            className={cn('mobile-nav-btn', activeView === view.id && 'active')}
            onClick={() => setActiveView(view.id)}
            aria-current={activeView === view.id ? 'page' : undefined}
            aria-label={view.label}
          >
            <view.icon size={19} aria-hidden="true" />
            <span>{view.label}</span>
          </button>
        ))}
      </nav>

      {/* Modal de Busca Global */}
      {searchOpen && (
        <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
          <div className="modal-backdrop" onClick={() => setSearchOpen(false)} aria-hidden="true" />
          <div className="modal-card">
            <div className="modal__header">
              <h2 id="global-search-title" className="modal__title">Busca Global Paperclip</h2>
              <button className="modal__close" onClick={() => setSearchOpen(false)} aria-label="Fechar busca">
                <XCircle size={20} />
              </button>
            </div>
            <div className="modal__body stack-md">
              <input
                type="search"
                className="input-base"
                placeholder="Buscar tarefas, agentes, projetos, metas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                aria-label="Termo de busca global"
              />

              {searching && <p className="text-caption text-tertiary">Buscando...</p>}

              {!searching && searchTerm.trim().length >= 2 && searchResults.length === 0 && (
                <p className="text-body-sm text-tertiary">Nenhum resultado encontrado.</p>
              )}

              <div className="stack-xs" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {searchResults.map((hit) => (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    type="button"
                    className="dropdown-item card"
                    onClick={() => handleSearchHitClick(hit)}
                  >
                    <span className="badge badge-neutral">{hit.type}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-body-sm text-truncate">{hit.title}</div>
                      {hit.subtitle && (
                        <div className="text-caption text-tertiary text-truncate">{hit.subtitle}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
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
