import { useState, useRef, useEffect, useMemo, useId } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Search, Check } from 'lucide-react'
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

interface AgentComboboxProps {
  agents: Agent[]
  activeAgentRef: string | null
  onSelectAgent: (agentRef: string) => void
  label?: string
  placeholder?: string
  minWidth?: string
}

export function AgentCombobox({
  agents,
  activeAgentRef,
  onSelectAgent,
  label = 'Selecionar agente',
  placeholder = 'Selecionar agente (digite para filtrar)...',
  minWidth,
}: AgentComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uid = useId()
  const listboxId = `agent-combobox-listbox-${uid}`

  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => a.name.localeCompare(b.name)),
    [agents]
  )

  const activeAgent = useMemo(
    () => sortedAgents.find((a) => a.ref === activeAgentRef) ?? null,
    [sortedAgents, activeAgentRef]
  )

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sortedAgents
    return sortedAgents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        (statusLabels[a.status || 'idle'] || '').toLowerCase().includes(q)
    )
  }, [sortedAgents, query])

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  const commitAgent = (agent: Agent) => {
    setOpen(false)
    setQuery('')
    onSelectAgent(agent.ref)
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
      if (filteredAgents.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filteredAgents.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredAgents.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filteredAgents.length) % filteredAgents.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = filteredAgents[activeIndex]
      if (chosen) commitAgent(chosen)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
    }
  }

  const activeOptId =
    open && filteredAgents[activeIndex]
      ? `agent-opt-${uid}-${filteredAgents[activeIndex].id}`
      : undefined

  return (
    <div ref={containerRef} className="relative" style={minWidth ? { minWidth } : undefined}>
      <div className="relative flex items-center">
        <Search
          size={14}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '10px',
            color: activeAgent ? 'var(--color-brand-primary)' : 'var(--color-text-tertiary)',
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
          aria-activedescendant={activeOptId}
          aria-label={label}
          className="input-base"
          style={{
            minHeight: '38px',
            padding: '6px 32px 6px 30px',
            fontSize: '0.8125rem',
            borderColor: activeAgent ? 'var(--color-brand-primary)' : undefined,
          }}
          placeholder={placeholder}
          value={open ? query : activeAgent ? `${activeAgent.name} — ${activeAgent.role}` : ''}
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
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'Fechar lista de agentes' : 'Abrir lista de agentes'}
          onClick={() => {
            if (open) {
              setOpen(false)
              setQuery('')
            } else {
              setQuery('')
              setOpen(true)
              inputRef.current?.focus()
            }
          }}
          style={{
            position: 'absolute',
            right: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'inline-flex',
          }}
        >
          <ChevronDown size={15} />
        </button>
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Agentes disponíveis"
          className="dropdown-menu"
          style={{ width: '100%', maxHeight: '280px', overflowY: 'auto' }}
        >
          {filteredAgents.length === 0 ? (
            <li
              className="text-caption text-tertiary"
              style={{ padding: '8px 10px' }}
              role="presentation"
            >
              Nenhum agente encontrado.
            </li>
          ) : (
            filteredAgents.map((agent, idx) => {
              const st = agent.status || 'idle'
              const stLabel = statusLabels[st] || st
              const isSelected = agent.ref === activeAgentRef
              const isHighlighted = idx === activeIndex
              return (
                <li
                  key={agent.id}
                  id={`agent-opt-${uid}-${agent.id}`}
                  role="option"
                  aria-selected={isSelected}
                  className={cn('dropdown-item', isHighlighted && 'badge-brand')}
                  style={{
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 400,
                    gap: '8px',
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    commitAgent(agent)
                  }}
                >
                  <span
                    className="avatar avatar-sm relative"
                    style={{
                      backgroundColor: getAgentColor(agent.ref),
                      flexShrink: 0,
                      overflow: 'visible',
                    }}
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                      }}
                    >
                      {agent.avatar ? <img src={agent.avatar} alt="" /> : getInitials(agent.name)}
                    </span>
                    <span className={cn('agent-status-dot', `agent-status-dot--${st}`)} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-truncate" style={{ display: 'block', fontWeight: 500 }}>
                      {agent.name}
                    </span>
                    <span className="text-truncate text-caption text-tertiary" style={{ display: 'block' }}>
                      {agent.role} • {stLabel}
                    </span>
                  </span>
                  {isSelected && <Check size={14} style={{ flexShrink: 0 }} aria-hidden="true" />}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

export function Sidebar({
  agents,
  activeAgentRef,
  onSelectAgent,
  collapsed = false,
  onToggleCollapse,
  mobile = false,
}: SidebarProps) {
  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => a.name.localeCompare(b.name)),
    [agents]
  )
  const activeAgent = useMemo(
    () => sortedAgents.find((a) => a.ref === activeAgentRef) ?? null,
    [sortedAgents, activeAgentRef]
  )

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

      {collapsed ? (
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
                    aria-label={`${agent.name} (${stLabel})`}
                    title={agent.name}
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
                        {agent.avatar ? <img src={agent.avatar} alt="" /> : getInitials(agent.name)}
                      </div>
                      <span className={cn('agent-status-dot', `agent-status-dot--${st}`)} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      ) : (
        <div className="flex-1 flex flex-col min-h-0" style={{ padding: '12px' }}>
          <AgentCombobox
            agents={agents}
            activeAgentRef={activeAgentRef}
            onSelectAgent={onSelectAgent}
            label="Selecionar agente para conversar"
          />

          <div className="flex-1 overflow-y-auto mt-3">
            {activeAgent ? (
              <div
                className="card stack-sm"
                style={{ backgroundColor: 'var(--color-bg-surface-elevated)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="avatar avatar-md relative"
                    style={{
                      backgroundColor: getAgentColor(activeAgent.ref),
                      overflow: 'visible',
                      flexShrink: 0,
                    }}
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
                      {activeAgent.avatar ? (
                        <img src={activeAgent.avatar} alt="" />
                      ) : (
                        getInitials(activeAgent.name)
                      )}
                    </div>
                    <span
                      className={cn(
                        'agent-status-dot',
                        `agent-status-dot--${activeAgent.status || 'idle'}`
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-body-sm text-truncate" style={{ fontWeight: 600 }}>
                      {activeAgent.name}
                    </div>
                    <div className="text-caption text-tertiary text-truncate">
                      {activeAgent.role}
                    </div>
                  </div>
                </div>
                <div className="text-caption text-tertiary">
                  Status: {statusLabels[activeAgent.status || 'idle'] || activeAgent.status}
                </div>
                {activeAgent.description && (
                  <p className="text-caption text-secondary">{activeAgent.description}</p>
                )}
              </div>
            ) : (
              <p className="text-caption text-tertiary">
                Escolha um agente na caixa de combinação acima para abrir a conversa.
              </p>
            )}
          </div>
        </div>
      )}

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
