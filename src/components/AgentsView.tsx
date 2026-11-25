import { useState, useEffect, useCallback } from 'react'
import {
  Bot,
  Pause,
  Play,
  Zap,
  RefreshCw,
  Trash2,
  Plus,
  MessageSquare,
  Settings,
  Key,
  FileCode,
  Network,
  AlertCircle,
  Loader2,
  XCircle,
  RotateCcw,
} from 'lucide-react'
import { cn, formatTimestamp, getInitials, getAgentColor } from '../lib/utils'
import { api } from '../lib/api'
import { useToastHelpers } from '../context/ToastContext'
import type { Agent, AgentApiKey, OrgNode } from '../types/api'

interface AgentsViewProps {
  companyId: string
  agents: Agent[]
  onRefreshAgents: () => void
  onOpenChat: (agentRef: string) => void
}

type AgentsSubTab = 'list' | 'org'

export function AgentsView({ companyId, agents, onRefreshAgents, onOpenChat }: AgentsViewProps) {
  const { success, error: showError } = useToastHelpers()
  const [subTab, setSubTab] = useState<AgentsSubTab>('list')
  const [orgTree, setOrgTree] = useState<OrgNode[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadOrg = useCallback(async () => {
    try {
      setOrgTree(await api.getOrgChart(companyId))
    } catch {
      setOrgTree([])
    }
  }, [companyId])

  useEffect(() => {
    if (subTab === 'org') loadOrg()
  }, [subTab, loadOrg])

  const runAction = async (agent: Agent, label: string, fn: () => Promise<unknown>) => {
    setBusyId(agent.id)
    try {
      await fn()
      success(label, agent.name)
      onRefreshAgents()
    } catch (err) {
      showError(`Erro: ${label}`, err instanceof Error ? err.message : 'Falha')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="view-shell">
      <div className="view-header">
        <div className="flex items-center gap-3">
          <h2 className="text-h3 text-primary">Agentes & Organograma</h2>
          <span className="badge badge-brand">{agents.length}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => {
              onRefreshAgents()
              if (subTab === 'org') loadOrg()
            }}
            aria-label="Atualizar agentes"
          >
            <RotateCcw size={18} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} aria-hidden="true" />
            Novo Agente
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 20px 0', backgroundColor: 'var(--color-bg-surface)' }}>
        <div className="tab-list" role="tablist" aria-label="Visualizações de agentes" style={{ marginBottom: 0 }}>
          <button
            role="tab"
            className={cn('tab', subTab === 'list' && 'active')}
            aria-selected={subTab === 'list'}
            onClick={() => setSubTab('list')}
          >
            <Bot size={15} aria-hidden="true" />
            Equipe ({agents.length})
          </button>
          <button
            role="tab"
            className={cn('tab', subTab === 'org' && 'active')}
            aria-selected={subTab === 'org'}
            onClick={() => setSubTab('org')}
          >
            <Network size={15} aria-hidden="true" />
            Organograma
          </button>
        </div>
      </div>

      <div className="view-body">
        {subTab === 'list' ? (
          <div className="grid-cards" role="list" aria-label="Cards de agentes">
            {agents.map((agent) => {
              const isPaused = agent.status === 'paused'
              const hasError = agent.status === 'error'
              const isBusy = busyId === agent.id

              return (
                <article key={agent.id} className="card stack-md" role="listitem">
                  <div className="flex items-start gap-3">
                    <div
                      className="avatar avatar-lg"
                      style={{ backgroundColor: getAgentColor(agent.ref) }}
                      aria-hidden="true"
                    >
                      {agent.avatar ? <img src={agent.avatar} alt="" /> : getInitials(agent.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-body text-primary text-truncate" style={{ fontWeight: 600 }}>
                          {agent.name}
                        </h3>
                        <span
                          className={cn(
                            'badge',
                            agent.status === 'running'
                              ? 'badge-brand'
                              : isPaused
                              ? 'badge-warning'
                              : hasError
                              ? 'badge-error'
                              : 'badge-success'
                          )}
                        >
                          {agent.status || 'idle'}
                        </span>
                      </div>
                      <p className="text-caption text-secondary text-truncate">{agent.title || agent.role}</p>
                      <div className="text-caption text-tertiary mt-1">
                        Adaptador: <span className="text-mono">{agent.adapterType || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {agent.errorReason && (
                    <div className="error-inline" role="alert">
                      <AlertCircle size={14} className="error-inline__icon" />
                      <span className="text-caption">{agent.errorReason}</span>
                    </div>
                  )}

                  <div className="text-caption text-tertiary">
                    Último heartbeat:{' '}
                    {agent.lastHeartbeatAt ? formatTimestamp(agent.lastHeartbeatAt) : 'Nunca'}
                    {agent.budgetMonthlyCents
                      ? ` • Orçamento: US$ ${(agent.budgetMonthlyCents / 100).toFixed(2)}`
                      : ''}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onOpenChat(agent.ref)}
                      disabled={isBusy}
                    >
                      <MessageSquare size={14} aria-hidden="true" />
                      Conversar
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        runAction(agent, 'Agente acordado', () => api.wakeupAgent(agent.id))
                      }
                      disabled={isBusy}
                    >
                      <Zap size={14} aria-hidden="true" />
                      Acordar
                    </button>

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        runAction(agent, isPaused ? 'Agente retomado' : 'Agente pausado', () =>
                          isPaused ? api.resumeAgent(agent.id) : api.pauseAgent(agent.id)
                        )
                      }
                      disabled={isBusy}
                    >
                      {isPaused ? <Play size={14} /> : <Pause size={14} />}
                      {isPaused ? 'Retomar' : 'Pausar'}
                    </button>

                    {hasError && (
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() =>
                          runAction(agent, 'Erro limpo', () => api.clearAgentError(agent.id))
                        }
                        disabled={isBusy}
                      >
                        Limpar Erro
                      </button>
                    )}

                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => setSelectedAgent(agent)}
                      aria-label={`Configurar ${agent.name}`}
                      title="Configurações, Instruções e Chaves"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="card stack-md">
            <h3 className="text-body" style={{ fontWeight: 600 }}>
              Hierarquia Organizacional
            </h3>
            {orgTree.length === 0 ? (
              <p className="text-body-sm text-tertiary">Nenhum nó no organograma.</p>
            ) : (
              <ul style={{ listStyle: 'none' }} className="stack-sm">
                {orgTree.map((node) => (
                  <OrgTreeNode key={node.id} node={node} depth={0} onOpenChat={onOpenChat} agents={agents} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateAgentModal
          companyId={companyId}
          agents={agents}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            onRefreshAgents()
          }}
        />
      )}

      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          companyId={companyId}
          onClose={() => setSelectedAgent(null)}
          onUpdated={onRefreshAgents}
        />
      )}
    </div>
  )
}

function OrgTreeNode({
  node,
  depth,
  onOpenChat,
  agents,
}: {
  node: OrgNode
  depth: number
  onOpenChat: (ref: string) => void
  agents: Agent[]
}) {
  const full = agents.find((a) => a.id === node.id)
  return (
    <li style={{ marginLeft: `${depth * 24}px` }}>
      <div
        className="card flex items-center justify-between gap-3"
        style={{ padding: '10px 14px', marginBottom: '6px' }}
      >
        <div>
          <strong className="text-body-sm text-primary">{node.name}</strong>
          <span className="text-caption text-tertiary ml-2">({node.role})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-neutral">{node.status}</span>
          {full && (
            <button className="btn btn-ghost btn-sm" onClick={() => onOpenChat(full.ref)}>
              Chat
            </button>
          )}
        </div>
      </div>
      {node.reports?.length > 0 && (
        <ul style={{ listStyle: 'none' }}>
          {node.reports.map((child) => (
            <OrgTreeNode key={child.id} node={child} depth={depth + 1} onOpenChat={onOpenChat} agents={agents} />
          ))}
        </ul>
      )}
    </li>
  )
}

function CreateAgentModal({
  companyId,
  agents,
  onClose,
  onCreated,
}: {
  companyId: string
  agents: Agent[]
  onClose: () => void
  onCreated: () => void
}) {
  const { success, error: showError } = useToastHelpers()
  const [name, setName] = useState('')
  const [role, setRole] = useState('general')
  const [title, setTitle] = useState('')
  const [capabilities, setCapabilities] = useState('')
  const [reportsTo, setReportsTo] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.createAgent(companyId, {
        name: name.trim(),
        role,
        title: title.trim() || undefined,
        capabilities: capabilities.trim() || undefined,
        reportsTo: reportsTo || null,
      })
      success('Agente criado', name.trim())
      onCreated()
    } catch (err) {
      showError('Erro ao criar agente', err instanceof Error ? err.message : 'Falha')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="create-agent-title">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-card">
        <div className="modal__header">
          <h3 id="create-agent-title" className="modal__title">
            Novo Agente
          </h3>
          <button className="modal__close" onClick={onClose} aria-label="Fechar">
            <XCircle size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal__body stack-md">
          <div>
            <label htmlFor="ag-name" className="label">Nome *</label>
            <input
              id="ag-name"
              className="input-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Ana Paula - Analista QA"
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ag-role" className="label">Papel (Role)</label>
              <select id="ag-role" className="input-base" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="ceo">CEO</option>
                <option value="cto">CTO</option>
                <option value="engineer">Engineer</option>
                <option value="designer">Designer</option>
                <option value="pm">PM</option>
                <option value="qa">QA</option>
                <option value="devops">DevOps</option>
                <option value="researcher">Researcher</option>
                <option value="general">General</option>
              </select>
            </div>
            <div>
              <label htmlFor="ag-reports" className="label">Reporta para</label>
              <select id="ag-reports" className="input-base" value={reportsTo} onChange={(e) => setReportsTo(e.target.value)}>
                <option value="">Ninguém (Topo)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ag-title" className="label">Título / Cargo</label>
            <input
              id="ag-title"
              className="input-base"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: QA Lead & Automação"
            />
          </div>

          <div>
            <label htmlFor="ag-cap" className="label">Capacidades</label>
            <textarea
              id="ag-cap"
              className="input-base"
              rows={2}
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
              placeholder="Especialidades deste agente..."
            />
          </div>

          <div className="modal__footer" style={{ padding: '12px 0 0 0' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Criando...' : 'Criar Agente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

type DetailTab = 'profile' | 'instructions' | 'keys' | 'runtime'

function AgentDetailModal({
  agent,
  companyId,
  onClose,
  onUpdated,
}: {
  agent: Agent
  companyId: string
  onClose: () => void
  onUpdated: () => void
}) {
  const { success, error: showError } = useToastHelpers()
  const [tab, setTab] = useState<DetailTab>('profile')

  // Profile state
  const [name, setName] = useState(agent.name)
  const [title, setTitle] = useState(agent.title || '')
  const [capabilities, setCapabilities] = useState(agent.capabilities || '')
  const [budgetDollars, setBudgetDollars] = useState(
    agent.budgetMonthlyCents ? String(agent.budgetMonthlyCents / 100) : '0'
  )
  const [saving, setSaving] = useState(false)

  // Instructions state
  const [bundleFiles, setBundleFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)

  // Keys state
  const [keys, setKeys] = useState<AgentApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [createdToken, setCreatedToken] = useState<string | null>(null)

  // Runtime & Skills
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown> | null>(null)
  const [agentSkills, setAgentSkills] = useState<any>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (tab === 'instructions') {
      api.getAgentInstructionsBundle(agent.id)
        .then((res) => {
          const files: string[] = Array.isArray(res?.files)
            ? res.files.map((f: any) => (typeof f === 'string' ? f : f.path))
            : ['AGENTS.md', 'SOUL.md']
          setBundleFiles(files)
          if (files[0]) loadFile(files[0])
        })
        .catch(() => {})
    } else if (tab === 'keys') {
      api.listAgentKeys(agent.id).then(setKeys).catch(() => setKeys([]))
    } else if (tab === 'runtime') {
      api.getAgentRuntimeState(agent.id).then(setRuntimeState).catch(() => {})
      api.getAgentSkills(agent.id).then(setAgentSkills).catch(() => {})
    }
  }, [tab, agent.id])

  const loadFile = async (path: string) => {
    setActiveFile(path)
    setLoadingFile(true)
    try {
      const res = await api.getAgentInstructionsFile(agent.id, path)
      setFileContent(res?.content ?? '')
    } catch {
      setFileContent('')
    } finally {
      setLoadingFile(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateAgent(
        agent.id,
        {
          name: name.trim(),
          title: title.trim() || null,
          capabilities: capabilities.trim() || null,
          budgetMonthlyCents: Math.max(0, Math.round(Number(budgetDollars || 0) * 100)),
        },
        companyId
      )
      success('Agente atualizado')
      onUpdated()
    } catch (err) {
      showError('Erro ao salvar', err instanceof Error ? err.message : 'Falha')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveInstructions = async () => {
    if (!activeFile) return
    setSaving(true)
    try {
      await api.saveAgentInstructionsFile(agent.id, activeFile, fileContent)
      success('Instruções salvas', activeFile)
    } catch (err) {
      showError('Erro ao salvar arquivo', err instanceof Error ? err.message : 'Falha')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return
    try {
      const created = await api.createAgentKey(agent.id, newKeyName.trim())
      setCreatedToken(created.token || null)
      setNewKeyName('')
      setKeys(await api.listAgentKeys(agent.id))
      success('Chave de API criada')
    } catch (err) {
      showError('Erro ao criar chave', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleRevokeKey = async (keyId: string) => {
    try {
      await api.revokeAgentKey(agent.id, keyId)
      setKeys(await api.listAgentKeys(agent.id))
      success('Chave revogada')
    } catch (err) {
      showError('Erro ao revogar chave', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleResetSession = async () => {
    try {
      await api.resetAgentSession(agent.id)
      success('Sessão resetada', 'Próximo ciclo iniciará sessão limpa')
      setRuntimeState(await api.getAgentRuntimeState(agent.id))
    } catch (err) {
      showError('Erro ao resetar sessão', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleSyncSkills = async () => {
    try {
      await api.syncAgentSkills(agent.id)
      success('Skills sincronizadas')
      setAgentSkills(await api.getAgentSkills(agent.id))
    } catch (err) {
      showError('Erro ao sincronizar skills', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleDeleteAgent = async () => {
    if (!confirm(`Excluir permanentemente o agente "${agent.name}"?`)) return
    try {
      await api.removeAgent(agent.id)
      success('Agente excluído')
      onUpdated()
      onClose()
    } catch (err) {
      showError('Erro ao excluir agente', err instanceof Error ? err.message : 'Falha')
    }
  }

  return (
    <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="agent-detail-title">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-card modal-card--lg">
        <div className="modal__header">
          <h3 id="agent-detail-title" className="modal__title text-truncate">
            {agent.name}
          </h3>
          <button className="modal__close" onClick={onClose} aria-label="Fechar">
            <XCircle size={20} />
          </button>
        </div>

        <div style={{ padding: '8px 20px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div className="tab-list" role="tablist" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <button role="tab" className={cn('tab', tab === 'profile' && 'active')} aria-selected={tab === 'profile'} onClick={() => setTab('profile')}>
              <Settings size={14} /> Perfil
            </button>
            <button role="tab" className={cn('tab', tab === 'instructions' && 'active')} aria-selected={tab === 'instructions'} onClick={() => setTab('instructions')}>
              <FileCode size={14} /> Instruções
            </button>
            <button role="tab" className={cn('tab', tab === 'keys' && 'active')} aria-selected={tab === 'keys'} onClick={() => setTab('keys')}>
              <Key size={14} /> Chaves API
            </button>
            <button role="tab" className={cn('tab', tab === 'runtime' && 'active')} aria-selected={tab === 'runtime'} onClick={() => setTab('runtime')}>
              <RefreshCw size={14} /> Runtime & Skills
            </button>
          </div>
        </div>

        <div className="modal__body">
          {tab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="stack-md">
              <div>
                <label htmlFor="edit-ag-name" className="label">Nome</label>
                <input id="edit-ag-name" className="input-base" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="edit-ag-title" className="label">Título / Cargo</label>
                <input id="edit-ag-title" className="input-base" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label htmlFor="edit-ag-cap" className="label">Capacidades</label>
                <textarea id="edit-ag-cap" className="input-base" rows={3} value={capabilities} onChange={(e) => setCapabilities(e.target.value)} />
              </div>
              <div>
                <label htmlFor="edit-ag-budget" className="label">Orçamento Mensal (USD)</label>
                <input id="edit-ag-budget" type="number" step="0.01" min="0" className="input-base" value={budgetDollars} onChange={(e) => setBudgetDollars(e.target.value)} />
              </div>
              <div className="flex items-center justify-between pt-2">
                <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteAgent}>
                  <Trash2 size={14} /> Excluir Agente
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          )}

          {tab === 'instructions' && (
            <div className="stack-md">
              <div className="flex items-center gap-2 flex-wrap">
                {bundleFiles.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={cn('btn btn-sm', activeFile === f ? 'btn-primary' : 'btn-secondary')}
                    onClick={() => loadFile(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {loadingFile ? (
                <div className="flex items-center gap-2 text-secondary"><Loader2 size={16} className="animate-spin" /> Carregando...</div>
              ) : (
                <>
                  <textarea
                    className="input-base text-mono"
                    rows={12}
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    aria-label={`Conteúdo de ${activeFile}`}
                    style={{ fontSize: '12.5px' }}
                  />
                  <div className="flex justify-end">
                    <button className="btn btn-primary" onClick={handleSaveInstructions} disabled={saving}>
                      {saving ? 'Salvando...' : `Salvar ${activeFile}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'keys' && (
            <div className="stack-md">
              <form onSubmit={handleCreateKey} className="flex items-center gap-2">
                <input
                  className="input-base flex-1"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Nome da nova chave (ex: cli-local)"
                  aria-label="Nome da nova chave de API"
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!newKeyName.trim()}>
                  Gerar Chave
                </button>
              </form>

              {createdToken && (
                <div className="card" style={{ borderColor: 'var(--color-status-success)' }}>
                  <div className="text-caption text-success" style={{ fontWeight: 600 }}>
                    Copie o token agora (exibido uma única vez):
                  </div>
                  <pre className="log-console mt-2" style={{ maxHeight: '80px' }}>{createdToken}</pre>
                </div>
              )}

              <div className="stack-sm">
                {keys.length === 0 ? (
                  <p className="text-body-sm text-tertiary">Nenhuma chave de API emitida.</p>
                ) : (
                  keys.map((k) => (
                    <div key={k.id} className="card flex items-center justify-between gap-2">
                      <div>
                        <strong className="text-body-sm">{k.name}</strong>
                        <div className="text-caption text-tertiary">
                          Escopo: {k.scope || 'agent'} • Criada em {formatTimestamp(k.createdAt)}
                        </div>
                      </div>
                      {!k.revokedAt ? (
                        <button className="btn btn-danger btn-sm" onClick={() => handleRevokeKey(k.id)}>
                          Revogar
                        </button>
                      ) : (
                        <span className="badge badge-neutral">Revogada</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'runtime' && (
            <div className="stack-lg">
              <div className="flex items-center gap-2 flex-wrap">
                <button className="btn btn-warning btn-sm" onClick={handleResetSession}>
                  <RefreshCw size={14} /> Resetar Sessão do Agente
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleSyncSkills}>
                  <RefreshCw size={14} /> Sincronizar Skills
                </button>
              </div>

              <div>
                <h4 className="text-body-sm mb-2" style={{ fontWeight: 600 }}>Estado do Runtime</h4>
                <pre className="log-console" style={{ maxHeight: '180px' }}>
                  {JSON.stringify(runtimeState ?? {}, null, 2)}
                </pre>
              </div>

              <div>
                <h4 className="text-body-sm mb-2" style={{ fontWeight: 600 }}>Skills do Agente</h4>
                <pre className="log-console" style={{ maxHeight: '180px' }}>
                  {JSON.stringify(agentSkills ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
