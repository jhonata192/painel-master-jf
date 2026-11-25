import { useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { cn, getInitials, getAgentColor } from '../lib/utils'
import type { Agent } from '../types/api'

interface SidebarProps {
  agents: Agent[]
  activeAgentRef: string | null
  onSelectAgent: (agentRef: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  mobile?: boolean
}

const statusLabels: Record<string, string> = {
  idle: 'Disponível',
  running: 'Executando',
  paused: 'Pausado',
  error: 'Com erro',
  terminated: 'Encerrado',
}

export function Sidebar({
  agents,
  activeAgentRef,
  onSelectAgent,
  collapsed = false,
  onToggleCollapse,
  mobile = false,
}: SidebarProps) {
  const [query, setQuery] = useState('')

  const sortedAgents = [...agents]
    .filter((a) => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <aside
      className={cn('sidebar', mobile && 'sidebar--mobile')}
      style={{
        width: collapsed ? '72px' : '280px',
        flexShrink: 0,
      }}
      aria-label="Painel de agentes"
    >
      <div className="sidebar__header">
        {!collapsed && (
          <h2 className="text-h3 text-primary" style={{ fontSize: '1rem' }}>
            Agentes
          </h2>
        )}
        {onToggleCollapse && (
          <button
            className="btn btn-ghost btn-icon"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        )}
      </div>

      {!collapsed && agents.length > 5 && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="relative">
            <Search
              size={14}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-tertiary)',
              }}
            />
            <input
              type="search"
              className="input-base"
              style={{ minHeight: '36px', padding: '6px 10px 6px 30px', fontSize: '0.8125rem' }}
              placeholder="Filtrar agentes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filtrar lista de agentes"
            />
          </div>
        </div>
      )}

      <nav className="sidebar__nav" aria-label="Lista de agentes">
        <ul className="sidebar__list" role="list">
          {sortedAgents.map((agent) => {
            const st = agent.status || 'idle'
            const stLabel = statusLabels[st] || st
            return (
              <li key={agent.id}>
                <button
                  className={cn(
                    'sidebar-item',
                    activeAgentRef === agent.ref && 'active'
                  )}
                  onClick={() => onSelectAgent(agent.ref)}
                  aria-current={activeAgentRef === agent.ref ? 'true' : undefined}
                  aria-label={collapsed ? `${agent.name} (${stLabel})` : undefined}
                  title={collapsed ? agent.name : undefined}
                >
                  <div
                    className="avatar avatar-md relative"
                    style={{ backgroundColor: getAgentColor(agent.ref), overflow: 'visible' }}
                    aria-hidden="true"
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {agent.avatar ? (
                        <img src={agent.avatar} alt="" />
                      ) : (
                        getInitials(agent.name)
                      )}
                    </div>
                    <span
                      className={cn('agent-status-dot', `agent-status-dot--${st}`)}
                    />
                  </div>
                  {!collapsed && (
                    <div className="flex-1 min-w-0" style={{ textAlign: 'left' }}>
                      <div className="text-truncate" style={{ fontWeight: 500 }}>
                        {agent.name}
                      </div>
                      <div className="text-truncate text-caption text-tertiary">
                        {agent.role}
                        <span className="sr-only"> — Status: {stLabel}</span>
                      </div>
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {!collapsed && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--color-border-subtle)',
            textAlign: 'center',
          }}
        >
          <div className="text-caption text-tertiary" role="status" aria-live="polite">
            {agents.length} agentes disponíveis
          </div>
        </div>
      )}
    </aside>
  )
}
