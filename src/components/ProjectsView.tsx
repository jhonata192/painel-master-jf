import { useState, useEffect, useCallback } from 'react'
import {
  FolderKanban,
  Target,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  FolderGit2,
  XCircle,
} from 'lucide-react'
import { cn, formatTimestamp } from '../lib/utils'
import { api } from '../lib/api'
import { useToastHelpers } from '../context/ToastContext'
import type { Agent, Goal, Project, ProjectWorkspace } from '../types/api'

interface ProjectsViewProps {
  companyId: string
  agents: Agent[]
}

export function ProjectsView({ companyId, agents }: ProjectsViewProps) {
  const { success, error: showError } = useToastHelpers()
  const [tab, setTab] = useState<'projects' | 'goals'>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Project
  const [showProjModal, setShowProjModal] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [projName, setProjName] = useState('')
  const [projDesc, setProjDesc] = useState('')
  const [projStatus, setProjStatus] = useState('planned')
  const [projLead, setProjLead] = useState('')
  const [projGoal, setProjGoal] = useState('')

  // Workspaces modal
  const [wsProject, setWsProject] = useState<Project | null>(null)
  const [workspaces, setWorkspaces] = useState<ProjectWorkspace[]>([])
  const [wsName, setWsName] = useState('')
  const [wsCwd, setWsCwd] = useState('')
  const [wsRepo, setWsRepo] = useState('')

  // Modal Goal
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDesc, setGoalDesc] = useState('')
  const [goalLevel, setGoalLevel] = useState('company')
  const [goalStatus, setGoalStatus] = useState('active')
  const [goalOwner, setGoalOwner] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, g] = await Promise.all([
        api.listProjects(companyId),
        api.listGoals(companyId),
      ])
      setProjects(p)
      setGoals(g)
    } catch (err) {
      showError('Erro ao carregar dados', err instanceof Error ? err.message : 'Falha')
    } finally {
      setLoading(false)
    }
  }, [companyId, showError])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const openProjectModal = (p?: Project) => {
    setEditProject(p ?? null)
    setProjName(p?.name ?? '')
    setProjDesc(p?.description ?? '')
    setProjStatus(p?.status ?? 'planned')
    setProjLead(p?.leadAgentId ?? '')
    setProjGoal(p?.goalId ?? '')
    setShowProjModal(true)
  }

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projName.trim()) return
    try {
      const payload = {
        name: projName.trim(),
        description: projDesc.trim() || null,
        status: projStatus,
        leadAgentId: projLead || null,
        goalId: projGoal || null,
      }
      if (editProject) {
        await api.updateProject(editProject.id, payload, companyId)
        success('Projeto atualizado')
      } else {
        await api.createProject(companyId, payload)
        success('Projeto criado')
      }
      setShowProjModal(false)
      loadAll()
    } catch (err) {
      showError('Erro ao salvar projeto', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleDeleteProject = async (p: Project) => {
    if (!confirm(`Excluir projeto "${p.name}"?`)) return
    try {
      await api.deleteProject(p.id, companyId)
      success('Projeto excluído')
      loadAll()
    } catch (err) {
      showError('Erro ao excluir projeto', err instanceof Error ? err.message : 'Falha')
    }
  }

  const openWorkspaces = async (p: Project) => {
    setWsProject(p)
    try {
      setWorkspaces(await api.listProjectWorkspaces(p.id, companyId))
    } catch {
      setWorkspaces([])
    }
  }

  const handleAddWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wsProject || !wsName.trim()) return
    try {
      await api.createProjectWorkspace(
        wsProject.id,
        {
          name: wsName.trim(),
          cwd: wsCwd.trim() || undefined,
          repoUrl: wsRepo.trim() || undefined,
        },
        companyId
      )
      setWsName('')
      setWsCwd('')
      setWsRepo('')
      setWorkspaces(await api.listProjectWorkspaces(wsProject.id, companyId))
      success('Workspace adicionado')
    } catch (err) {
      showError('Erro ao criar workspace', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleDeleteWorkspace = async (wsId: string) => {
    if (!wsProject) return
    try {
      await api.deleteProjectWorkspace(wsProject.id, wsId, companyId)
      setWorkspaces((prev) => prev.filter((w) => w.id !== wsId))
      success('Workspace removido')
    } catch (err) {
      showError('Erro ao remover workspace', err instanceof Error ? err.message : 'Falha')
    }
  }

  const openGoalModal = (g?: Goal) => {
    setEditGoal(g ?? null)
    setGoalTitle(g?.title ?? '')
    setGoalDesc(g?.description ?? '')
    setGoalLevel(g?.level ?? 'company')
    setGoalStatus(g?.status ?? 'active')
    setGoalOwner(g?.ownerAgentId ?? '')
    setShowGoalModal(true)
  }

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!goalTitle.trim()) return
    try {
      const payload = {
        title: goalTitle.trim(),
        description: goalDesc.trim() || null,
        level: goalLevel,
        status: goalStatus,
        ownerAgentId: goalOwner || null,
      }
      if (editGoal) {
        await api.updateGoal(editGoal.id, payload)
        success('Meta atualizada')
      } else {
        await api.createGoal(companyId, payload)
        success('Meta criada')
      }
      setShowGoalModal(false)
      loadAll()
    } catch (err) {
      showError('Erro ao salvar meta', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleDeleteGoal = async (g: Goal) => {
    if (!confirm(`Excluir meta "${g.title}"?`)) return
    try {
      await api.deleteGoal(g.id)
      success('Meta excluída')
      loadAll()
    } catch (err) {
      showError('Erro ao excluir meta', err instanceof Error ? err.message : 'Falha')
    }
  }

  return (
    <div className="view-shell">
      <div className="view-header">
        <h2 className="text-h3 text-primary">Projetos & Metas</h2>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-icon" onClick={loadAll} aria-label="Atualizar projetos e metas">
            <RotateCcw size={18} />
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => (tab === 'projects' ? openProjectModal() : openGoalModal())}
          >
            <Plus size={16} aria-hidden="true" />
            {tab === 'projects' ? 'Novo Projeto' : 'Nova Meta'}
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 20px 0', backgroundColor: 'var(--color-bg-surface)' }}>
        <div className="tab-list" role="tablist" style={{ marginBottom: 0 }}>
          <button
            role="tab"
            className={cn('tab', tab === 'projects' && 'active')}
            aria-selected={tab === 'projects'}
            onClick={() => setTab('projects')}
          >
            <FolderKanban size={15} /> Projetos ({projects.length})
          </button>
          <button
            role="tab"
            className={cn('tab', tab === 'goals' && 'active')}
            aria-selected={tab === 'goals'}
            onClick={() => setTab('goals')}
          >
            <Target size={15} /> Metas ({goals.length})
          </button>
        </div>
      </div>

      <div className="view-body">
        {loading && projects.length === 0 && goals.length === 0 ? (
          <div className="skeleton" style={{ height: '120px' }} />
        ) : tab === 'projects' ? (
          projects.length === 0 ? (
            <div className="empty-state">
              <FolderKanban className="empty-state__icon" size={48} />
              <h3 className="empty-state__title">Nenhum projeto cadastrado</h3>
              <p className="empty-state__description">Crie um projeto para agrupar tarefas e workspaces.</p>
            </div>
          ) : (
            <div className="grid-cards">
              {projects.map((p) => {
                const lead = agents.find((a) => a.id === p.leadAgentId)
                const goal = goals.find((g) => g.id === p.goalId)
                return (
                  <article key={p.id} className="card stack-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '9999px',
                            backgroundColor: p.color || 'var(--color-brand-primary)',
                            flexShrink: 0,
                          }}
                        />
                        <h3 className="text-body text-truncate" style={{ fontWeight: 600 }}>
                          {p.name}
                        </h3>
                      </div>
                      <span className="badge badge-info">{p.status}</span>
                    </div>
                    <p className="text-body-sm text-secondary">{p.description || 'Sem descrição'}</p>
                    <div className="text-caption text-tertiary">
                      {lead && <div>Líder: {lead.name}</div>}
                      {goal && <div>Meta: {goal.title}</div>}
                      <div>Atualizado {formatTimestamp(p.updatedAt)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => openWorkspaces(p)}>
                        <FolderGit2 size={14} /> Workspaces
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openProjectModal(p)}>
                        <Edit2 size={14} /> Editar
                      </button>
                      <button className="btn btn-ghost btn-sm text-error" onClick={() => handleDeleteProject(p)}>
                        <Trash2 size={14} /> Excluir
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )
        ) : goals.length === 0 ? (
          <div className="empty-state">
            <Target className="empty-state__icon" size={48} />
            <h3 className="empty-state__title">Nenhuma meta cadastrada</h3>
            <p className="empty-state__description">Defina metas estratégicas para alinhar projetos e agentes.</p>
          </div>
        ) : (
          <div className="stack-md">
            {goals.map((g) => {
              const owner = agents.find((a) => a.id === g.ownerAgentId)
              return (
                <article key={g.id} className="card flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-body" style={{ fontWeight: 600 }}>{g.title}</h3>
                      <span className="badge badge-brand">{g.level}</span>
                      <span className={cn('badge', g.status === 'achieved' ? 'badge-success' : g.status === 'active' ? 'badge-info' : 'badge-neutral')}>
                        {g.status}
                      </span>
                    </div>
                    {g.description && <p className="text-body-sm text-secondary mt-1">{g.description}</p>}
                    <div className="text-caption text-tertiary mt-1">
                      {owner ? `Responsável: ${owner.name}` : 'Sem responsável'} • Atualizada {formatTimestamp(g.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openGoalModal(g)} aria-label="Editar meta">
                      <Edit2 size={15} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm text-error" onClick={() => handleDeleteGoal(g)} aria-label="Excluir meta">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Projeto */}
      {showProjModal && (
        <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="proj-modal-title">
          <div className="modal-backdrop" onClick={() => setShowProjModal(false)} aria-hidden="true" />
          <div className="modal-card">
            <div className="modal__header">
              <h3 id="proj-modal-title" className="modal__title">{editProject ? 'Editar Projeto' : 'Novo Projeto'}</h3>
              <button className="modal__close" onClick={() => setShowProjModal(false)} aria-label="Fechar"><XCircle size={20} /></button>
            </div>
            <form onSubmit={handleSaveProject} className="modal__body stack-md">
              <div>
                <label htmlFor="proj-name" className="label">Nome *</label>
                <input id="proj-name" className="input-base" value={projName} onChange={(e) => setProjName(e.target.value)} required autoFocus />
              </div>
              <div>
                <label htmlFor="proj-desc" className="label">Descrição</label>
                <textarea id="proj-desc" className="input-base" rows={3} value={projDesc} onChange={(e) => setProjDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="proj-status" className="label">Status</label>
                  <select id="proj-status" className="input-base" value={projStatus} onChange={(e) => setProjStatus(e.target.value)}>
                    <option value="planned">Planejado</option>
                    <option value="in_progress">Em Andamento</option>
                    <option value="completed">Concluído</option>
                    <option value="paused">Pausado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="proj-lead" className="label">Líder</label>
                  <select id="proj-lead" className="input-base" value={projLead} onChange={(e) => setProjLead(e.target.value)}>
                    <option value="">Nenhum</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="proj-goal" className="label">Meta vinculada</label>
                <select id="proj-goal" className="input-base" value={projGoal} onChange={(e) => setProjGoal(e.target.value)}>
                  <option value="">Nenhuma</option>
                  {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>
              <div className="modal__footer" style={{ padding: '12px 0 0 0' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowProjModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Meta */}
      {showGoalModal && (
        <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
          <div className="modal-backdrop" onClick={() => setShowGoalModal(false)} aria-hidden="true" />
          <div className="modal-card">
            <div className="modal__header">
              <h3 id="goal-modal-title" className="modal__title">{editGoal ? 'Editar Meta' : 'Nova Meta'}</h3>
              <button className="modal__close" onClick={() => setShowGoalModal(false)} aria-label="Fechar"><XCircle size={20} /></button>
            </div>
            <form onSubmit={handleSaveGoal} className="modal__body stack-md">
              <div>
                <label htmlFor="goal-title" className="label">Título *</label>
                <input id="goal-title" className="input-base" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} required autoFocus />
              </div>
              <div>
                <label htmlFor="goal-desc" className="label">Descrição</label>
                <textarea id="goal-desc" className="input-base" rows={3} value={goalDesc} onChange={(e) => setGoalDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="goal-level" className="label">Nível</label>
                  <select id="goal-level" className="input-base" value={goalLevel} onChange={(e) => setGoalLevel(e.target.value)}>
                    <option value="company">Empresa</option>
                    <option value="team">Equipe</option>
                    <option value="agent">Agente</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="goal-status" className="label">Status</label>
                  <select id="goal-status" className="input-base" value={goalStatus} onChange={(e) => setGoalStatus(e.target.value)}>
                    <option value="planned">Planejada</option>
                    <option value="active">Ativa</option>
                    <option value="achieved">Alcançada</option>
                    <option value="cancelled">Cancelada</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="goal-owner" className="label">Responsável</label>
                <select id="goal-owner" className="input-base" value={goalOwner} onChange={(e) => setGoalOwner(e.target.value)}>
                  <option value="">Nenhum</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="modal__footer" style={{ padding: '12px 0 0 0' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowGoalModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Workspaces do Projeto */}
      {wsProject && (
        <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="ws-modal-title">
          <div className="modal-backdrop" onClick={() => setWsProject(null)} aria-hidden="true" />
          <div className="modal-card modal-card--lg">
            <div className="modal__header">
              <h3 id="ws-modal-title" className="modal__title">Workspaces — {wsProject.name}</h3>
              <button className="modal__close" onClick={() => setWsProject(null)} aria-label="Fechar"><XCircle size={20} /></button>
            </div>
            <div className="modal__body stack-lg">
              <form onSubmit={handleAddWorkspace} className="card stack-sm">
                <strong className="text-body-sm">Adicionar Workspace</strong>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input-base" value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="Nome *" required aria-label="Nome do workspace" />
                  <input className="input-base" value={wsCwd} onChange={(e) => setWsCwd(e.target.value)} placeholder="Caminho local (/home/...)" aria-label="Caminho do diretório" />
                </div>
                <input className="input-base" value={wsRepo} onChange={(e) => setWsRepo(e.target.value)} placeholder="URL do repositório Git (opcional)" aria-label="URL do repositório" />
                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary btn-sm">Adicionar</button>
                </div>
              </form>

              <div className="stack-sm">
                {workspaces.length === 0 ? (
                  <p className="text-body-sm text-tertiary">Nenhum workspace configurado neste projeto.</p>
                ) : (
                  workspaces.map((w) => (
                    <div key={w.id} className="card flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="text-body-sm">{w.name}</strong>
                        <div className="text-caption text-mono text-tertiary text-truncate">
                          {w.cwd || w.repoUrl || 'Sem caminho'}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-icon text-error" onClick={() => handleDeleteWorkspace(w.id)} aria-label={`Excluir workspace ${w.name}`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
