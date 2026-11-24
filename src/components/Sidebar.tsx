import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, getInitials, getAgentColor } from '../lib/utils'
import type { Agent } from '../types/api'

interface SidebarProps {
  agents: Agent[]
  activeAgentRef: string | null
  onSelectAgent: (agentRef: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({
  agents,
  activeAgentRef,
  onSelectAgent,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const sortedAgents = [...agents].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <aside
      className={cn(
        'sidebar',
        'fixed left-0 top-0 h-full bg-[var(--color-bg-surface)] border-r border-[var(--color-border-subtle)] transition-all duration-base ease-standard z-[var(--z-sticky)] flex flex-col',
        collapsed ? 'w-[72px]' : 'w-[280px]'
      )}
      style={{
        width: collapsed ? '72px' : '280px',
        flexShrink: 0,
      }}
      aria-label="Painel de agentes"
    >
      <div className="sidebar__header p-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
        {!collapsed && (
          <h2 className="text-h3 font-semibold text-[var(--color-text-primary)]">
            Agentes
          </h2>
        )}
        {onToggleCollapse && (
          <button
            className="btn btn-ghost btn-icon p-2"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Lista de agentes">
        <ul className="space-y-1" role="list">
          {sortedAgents.map((agent) => (
            <li key={agent.id}>
              <button
                className={cn(
                  'sidebar-item w-full',
                  activeAgentRef === agent.ref && 'active'
                )}
                onClick={() => onSelectAgent(agent.ref)}
                aria-current={activeAgentRef === agent.ref ? 'true' : undefined}
                aria-label={collapsed ? agent.name : undefined}
                title={collapsed ? agent.name : undefined}
              >
                <div
                  className="avatar avatar-md flex-shrink-0"
                  style={{ backgroundColor: getAgentColor(agent.ref) }}
                  aria-hidden="true"
                >
                  {agent.avatar ? (
                    <img src={agent.avatar} alt="" />
                  ) : (
                    getInitials(agent.name)
                  )}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-truncate font-medium">
                      {agent.name}
                    </div>
                    <div className="text-truncate text-[var(--text-caption)] text-[var(--color-text-tertiary)]">
                      {agent.role}
                    </div>
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-[var(--color-border-subtle)]">
          <div
            className="text-center text-[var(--text-caption)] text-[var(--color-text-tertiary)]"
            role="status"
            aria-live="polite"
          >
            {agents.length} agentes disponíveis
          </div>
        </div>
      )}
    </aside>
  )
}