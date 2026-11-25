import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  FolderKanban,
  Target,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  FolderGit2,
  XCircle,
  Search,
  Lock,
  GitBranch,
  Check,
  X,
} from 'lucide-react'
import { cn, formatTimestamp } from '../lib/utils'
import { api } from '../lib/api'
import { useToastHelpers } from '../context/ToastContext'
import type {
  Agent,
  CreateProjectPayload,
  Goal,
  Project,
  ProjectEnvironmentOptions,
  ProjectRepositoryOptions,
  ProjectWorkspace,
} from '../types/api'

const PROJECT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
] as const

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planned: 'Planejado',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
  backlog: 'Backlog',
  cancelled: 'Cancelado',
}

function matchWorkspaceRepoIds(
  wsList: ProjectWorkspace[],
  repoList: ProjectRepositoryOptions['repositories']
): string[] {
  const byId = new Set(
    wsList
      .map((w) => w.metadata?.githubRepositoryId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  )
  const byUrl = new Set(
    wsList
      .map((w) => w.repoUrl?.trim().toLowerCase())
      .filter((u): u is string => Boolean(u))
  )
  return repoList
    .filter((r) => byId.has(r.id) || byUrl.has(r.url.trim().toLowerCase()))
    .map((r) => r.id)
}

interface GitHubRepoPickerProps {
  inputId: string
  repoOptions: ProjectRepositoryOptions | null
  selectedIds: string[]
  onToggle: (repoId: string) => void
  loading: boolean
  disabled?: boolean
}

function GitHubRepoPicker({
  inputId,
  repoOptions,
  selectedIds,
  onToggle,
  loading,
  disabled = false,
}: GitHubRepoPickerProps) {
  const [search, setSearch] = useState('')
  const filteredRepos = useMemo(() => {
    const list = repoOptions?.repositories ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.connections.some((c) => c.toLowerCase().includes(q))
    )
  }, [repoOptions, search])

  return (
    <div className="stack-xs">
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {selectedIds.map((repoId) => {
            const repo = repoOptions?.repositories.find((r) => r.id === repoId)
            return (
              <span key={repoId} className="badge badge-info flex items-center gap-1">
                <GitBranch size={12} />
                <span>{repo?.fullName ?? repoId}</span>
                {repo?.private && <Lock size={11} aria-label="Privado" />}
                <button
                  type="button"
                  onClick={() => onToggle(repoId)}
                  disabled={disabled}
                  aria-label={`Remover repositório ${repo?.fullName ?? repoId}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {loading ? (
        <p className="text-caption text-tertiary">Carregando repositórios conectados...</p>
      ) : repoOptions && repoOptions.repositories.length > 0 ? (
        <>
          <div className="relative flex items-center">
            <Search size={14} style={{ position: 'absolute', left: '10px', opacity: 0.6, pointerEvents: 'none' }} />
            <input
              id={inputId}
              type="text"
              className="input-base"
              style={{ paddingLeft: '32px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar entre ${repoOptions.repositories.length} repositórios do GitHub...`}
              disabled={disabled}
            />
          </div>
          <div
            role="listbox"
            aria-label="Repositórios GitHub disponíveis"
            aria-multiselectable="true"
            style={{
              maxHeight: '150px',
              overflowY: 'auto',
              border: '1px solid var(--color-border-default)',
              borderRadius: '8px',
              backgroundColor: 'var(--color-bg-surface)',
            }}
          >
            {filteredRepos.length === 0 ? (
              <div className="p-2 text-caption text-tertiary">
                Nenhum repositório encontrado para "{search}".
              </div>
            ) : (
              filteredRepos.map((repo) => {
                const isSelected = selectedIds.includes(repo.id)
                return (
                  <button
                    key={repo.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onToggle(repo.id)}
                    disabled={disabled}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '7px 10px',
                      textAlign: 'left',
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border-subtle)',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <GitBranch size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                      <span className="text-truncate">{repo.fullName}</span>
                      {repo.private && (
                        <Lock size={12} style={{ flexShrink: 0, opacity: 0.7 }} aria-label="Repositório privado" />
                      )}
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0 text-caption text-tertiary">
                      {repo.connections.join(' · ')}
                      {isSelected && <Check size={14} style={{ color: 'var(--color-brand-primary)' }} />}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </>
      ) : (
        <p className="text-caption text-tertiary">
          Nenhum repositório GitHub conectado disponível no momento.
        </p>
      )}
    </div>
  )
}

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
  const [projVisibility, setProjVisibility] = useState<'open' | 'private'>('open')
  const [projColor, setProjColor] = useState<string>(PROJECT_COLORS[0])
  const [projLead, setProjLead] = useState('')
  const [projGoal, setProjGoal] = useState('')
  const [projTargetDate, setProjTargetDate] = useState('')
  const [projCwd, setProjCwd] = useState('')
  const [projRepoUrl, setProjRepoUrl] = useState('')
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([])
  const [initialRepoIds, setInitialRepoIds] = useState<string[]>([])
  const [envOptions, setEnvOptions] = useState<ProjectEnvironmentOptions | null>(null)
  const [selectedEnvId, setSelectedEnvId] = useState('')
  const [repoOptions, setRepoOptions] = useState<ProjectRepositoryOptions | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [savingProject, setSavingProject] = useState(false)

  // Workspaces modal
  const [wsProject, setWsProject] = useState<Project | null>(null)
  const [workspaces, setWorkspaces] = useState<ProjectWorkspace[]>([])
  const [wsSelectedRepoIds, setWsSelectedRepoIds] = useState<string[]>([])
  const [wsInitialRepoIds, setWsInitialRepoIds] = useState<string[]>([])
  const [loadingWsOptions, setLoadingWsOptions] = useState(false)
  const [savingWsRepos, setSavingWsRepos] = useState(false)
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

  useEffect(() => {
    if (!showProjModal && !showGoalModal && !wsProject) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showProjModal && !savingProject) setShowProjModal(false)
      else if (showGoalModal) setShowGoalModal(false)
      else if (wsProject) setWsProject(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showProjModal, showGoalModal, wsProject, savingProject])

  const selectedEnvGroup = useMemo(() => {
    if (!envOptions?.groups?.length) return null
    const id = selectedEnvId || envOptions.defaultEnvironmentId
    return (
      envOptions.groups.find((g) => g.environments.some((env) => env.id === id)) ??
      envOptions.groups[0] ??
      null
    )
  }, [envOptions, selectedEnvId])

  const toggleRepo = (repoId: string) => {
    setSelectedRepoIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    )
  }

  const toggleWsRepo = (repoId: string) => {
    setWsSelectedRepoIds((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    )
  }

  const openProjectModal = async (p?: Project) => {
    setEditProject(p ?? null)
    setProjName(p?.name ?? '')
    setProjDesc(p?.description ?? '')
    setProjStatus(p?.status ?? 'planned')
    setProjVisibility(p?.visibility === 'private' ? 'private' : 'open')
    setProjColor(p?.color || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)])
    setProjLead(p?.leadAgentId ?? '')
    setProjGoal(p?.goalId ?? p?.goalIds?.[0] ?? '')
    setProjTargetDate(p?.targetDate ? String(p.targetDate).slice(0, 10) : '')
    setProjCwd('')
    setProjRepoUrl('')
    setSelectedRepoIds([])
    setInitialRepoIds([])
    setShowProjModal(true)

    setLoadingOptions(true)
    try {
      const [envRes, repoRes] = await Promise.allSettled([
        api.listProjectEnvironments(companyId),
        api.listProjectRepositories(companyId),
      ])

      if (envRes.status === 'fulfilled') {
        setEnvOptions(envRes.value)
        setSelectedEnvId(
          envRes.value.defaultEnvironmentId ??
            envRes.value.groups[0]?.environments[0]?.id ??
            ''
        )
      } else {
        setEnvOptions(null)
        setSelectedEnvId('')
      }

      if (repoRes.status === 'fulfilled') {
        setRepoOptions(repoRes.value)
        if (p?.workspaces?.length) {
          const matchedIds = matchWorkspaceRepoIds(p.workspaces, repoRes.value.repositories)
          setSelectedRepoIds(matchedIds)
          setInitialRepoIds(matchedIds)
        }
      } else {
        setRepoOptions(null)
      }
    } finally {
      setLoadingOptions(false)
    }
  }

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projName.trim() || savingProject) return
    setSavingProject(true)
    try {
      const basePayload = {
        name: projName.trim(),
        description: projDesc.trim() || null,
        status: projStatus,
        visibility: projVisibility,
        color: projColor,
        leadAgentId: projLead || null,
        goalId: projGoal || null,
        targetDate: projTargetDate || null,
      }
      if (editProject) {
        await api.updateProject(editProject.id, basePayload, companyId)
        const prevSorted = [...initialRepoIds].sort().join(',')
        const nextSorted = [...selectedRepoIds].sort().join(',')
        if (repoOptions && prevSorted !== nextSorted) {
          await api.setProjectRepositories(editProject.id, selectedRepoIds, companyId)
        }
        success('Projeto atualizado')
      } else {
        const effectiveEnvId = selectedEnvId || envOptions?.defaultEnvironmentId || ''
        const manualUrls = projRepoUrl.trim() ? [projRepoUrl.trim()] : []
        const hasRepoSelection = selectedRepoIds.length > 0 || manualUrls.length > 0
        const payload: CreateProjectPayload = {
          ...basePayload,
          ...(selectedEnvGroup && effectiveEnvId
            ? {
                environmentId: effectiveEnvId,
                expectedStorageProviderPluginId: selectedEnvGroup.storageProviderPluginId,
              }
            : {}),
          ...(selectedRepoIds.length > 0 ? { repositoryIds: selectedRepoIds } : {}),
          ...(manualUrls.length > 0 ? { repositoryUrls: manualUrls } : {}),
          ...(!hasRepoSelection && projCwd.trim()
            ? {
                workspace: {
                  name: projName.trim(),
                  cwd: projCwd.trim(),
                },
              }
            : {}),
        }
        const created = await api.createProject(companyId, payload)
        if (hasRepoSelection && projCwd.trim()) {
          await api.createProjectWorkspace(
            created.id,
            { name: 'Local', cwd: projCwd.trim() },
            companyId
          )
        }
        success('Projeto criado')
      }
      setShowProjModal(false)
      loadAll()
    } catch (err) {
      showError('Erro ao salvar projeto', err instanceof Error ? err.message : 'Falha')
    } finally {
      setSavingProject(false)
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
    setWsSelectedRepoIds([])
    setWsInitialRepoIds([])
    setLoadingWsOptions(true)
    try {
      const [wsRes, repoRes] = await Promise.allSettled([
        api.listProjectWorkspaces(p.id, companyId),
        api.listProjectRepositories(companyId),
      ])
      const loadedWs = wsRes.status === 'fulfilled' ? wsRes.value : []
      setWorkspaces(loadedWs)

      if (repoRes.status === 'fulfilled') {
        setRepoOptions(repoRes.value)
        const matched = matchWorkspaceRepoIds(loadedWs, repoRes.value.repositories)
        setWsSelectedRepoIds(matched)
        setWsInitialRepoIds(matched)
      }
    } finally {
      setLoadingWsOptions(false)
    }
  }

  const handleSaveWsRepositories = async () => {
    if (!wsProject || savingWsRepos) return
    setSavingWsRepos(true)
    try {
      await api.setProjectRepositories(wsProject.id, wsSelectedRepoIds, companyId)
      const updatedWs = await api.listProjectWorkspaces(wsProject.id, companyId)
      setWorkspaces(updatedWs)
      setWsInitialRepoIds(wsSelectedRepoIds)
      success('Repositórios GitHub atualizados')
      loadAll()
    } catch (err) {
      showError('Erro ao vincular repositórios', err instanceof Error ? err.message : 'Falha')
    } finally {
      setSavingWsRepos(false)
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
                const repoCount = p.workspaces?.length ?? 0
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
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {p.visibility === 'private' && (
                          <span className="badge badge-neutral" title="Projeto privado">
                            <Lock size={11} /> Privado
                          </span>
                        )}
                        <span className="badge badge-info">
                          {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-body-sm text-secondary">{p.description || 'Sem descrição'}</p>
                    <div className="text-caption text-tertiary">
                      {lead && <div>Líder: {lead.name}</div>}
                      {goal && <div>Meta: {goal.title}</div>}
                      {repoCount > 0 && (
                        <div>
                          Repositórios/Workspaces: {repoCount} (
                          {p.workspaces!.map((w) => w.name).slice(0, 2).join(', ')}
                          {repoCount > 2 ? ` +${repoCount - 2}` : ''})
                        </div>
                      )}
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
          <div className="modal-backdrop" onClick={() => !savingProject && setShowProjModal(false)} aria-hidden="true" />
          <div className="modal-card modal-card--lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal__header">
              <div className="flex items-center gap-2">
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '9999px',
                    backgroundColor: projColor,
                    display: 'inline-block',
                  }}
                />
                <h3 id="proj-modal-title" className="modal__title">{editProject ? 'Editar Projeto' : 'Novo Projeto'}</h3>
              </div>
              <button className="modal__close" onClick={() => !savingProject && setShowProjModal(false)} aria-label="Fechar" disabled={savingProject}>
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveProject} className="modal__body stack-md" style={{ overflowY: 'auto' }}>
              <div className="grid grid-cols-1 gap-3" style={{ gridTemplateColumns: '1fr auto' }}>
                <div>
                  <label htmlFor="proj-name" className="label">Nome *</label>
                  <input id="proj-name" className="input-base" value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="Nome do projeto" required autoFocus disabled={savingProject} />
                </div>
                <div>
                  <span className="label">Cor</span>
                  <div className="flex items-center gap-1.5 flex-wrap" style={{ paddingTop: '6px' }} role="group" aria-label="Cor do projeto">
                    {PROJECT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setProjColor(color)}
                        aria-label={`Selecionar cor ${color}`}
                        aria-pressed={projColor === color}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '9999px',
                          backgroundColor: color,
                          border: projColor === color ? '2px solid #fff' : '2px solid transparent',
                          boxShadow: projColor === color ? `0 0 0 2px ${color}` : 'none',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {!editProject && envOptions && envOptions.groups.length > 0 && (
                <div>
                  {envOptions.groups.length > 1 ? (
                    <>
                      <label htmlFor="proj-env" className="label">Ambiente de execução</label>
                      <select
                        id="proj-env"
                        className="input-base"
                        value={selectedEnvGroup?.environments[0]?.id ?? selectedEnvId}
                        onChange={(e) => setSelectedEnvId(e.target.value)}
                        disabled={savingProject}
                      >
                        {envOptions.groups.map((group) => {
                          const firstId = group.environments[0]?.id
                          if (!firstId) return null
                          return (
                            <option key={firstId} value={firstId}>
                              {group.environments.map((env) => env.name).join(', ')}
                            </option>
                          )
                        })}
                      </select>
                      <p className="text-caption text-tertiary mt-1">
                        Define onde os arquivos de trabalho deste projeto ficam armazenados.
                      </p>
                    </>
                  ) : (
                    <div className="text-caption text-tertiary flex items-center gap-2">
                      <span>Ambiente de execução:</span>
                      <span className="badge badge-neutral">
                        {envOptions.groups[0].environments.map((env) => env.name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor="proj-repo-search" className="label">Repositórios de origem (GitHub)</label>
                  <span className="text-caption text-tertiary">opcional</span>
                </div>
                <GitHubRepoPicker
                  inputId="proj-repo-search"
                  repoOptions={repoOptions}
                  selectedIds={selectedRepoIds}
                  onToggle={toggleRepo}
                  loading={loadingOptions}
                  disabled={savingProject}
                />
              </div>

              {!editProject && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="proj-cwd" className="label">Pasta local (opcional)</label>
                    <input
                      id="proj-cwd"
                      className="input-base text-mono"
                      value={projCwd}
                      onChange={(e) => setProjCwd(e.target.value)}
                      placeholder="/home/jhonata/meu-projeto"
                      disabled={savingProject}
                    />
                  </div>
                  <div>
                    <label htmlFor="proj-repo-url" className="label">URL Git manual (opcional)</label>
                    <input
                      id="proj-repo-url"
                      type="url"
                      className="input-base text-mono"
                      value={projRepoUrl}
                      onChange={(e) => setProjRepoUrl(e.target.value)}
                      placeholder="https://github.com/org/repo"
                      disabled={savingProject}
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="proj-desc" className="label">Descrição</label>
                <textarea id="proj-desc" className="input-base" rows={2} value={projDesc} onChange={(e) => setProjDesc(e.target.value)} disabled={savingProject} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="proj-status" className="label">Status</label>
                  <select id="proj-status" className="input-base" value={projStatus} onChange={(e) => setProjStatus(e.target.value)} disabled={savingProject}>
                    <option value="planned">Planejado</option>
                    <option value="in_progress">Em Andamento</option>
                    <option value="completed">Concluído</option>
                    <option value="backlog">Backlog</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="proj-visibility" className="label">Visibilidade</label>
                  <select id="proj-visibility" className="input-base" value={projVisibility} onChange={(e) => setProjVisibility(e.target.value as 'open' | 'private')} disabled={savingProject}>
                    <option value="open">Aberto (toda empresa)</option>
                    <option value="private">Privado (somente membros)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="proj-lead" className="label">Líder (opcional)</label>
                  <select id="proj-lead" className="input-base" value={projLead} onChange={(e) => setProjLead(e.target.value)} disabled={savingProject}>
                    <option value="">Nenhum</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="proj-target-date" className="label">Prazo alvo (opcional)</label>
                  <input
                    id="proj-target-date"
                    type="date"
                    className="input-base"
                    value={projTargetDate}
                    onChange={(e) => setProjTargetDate(e.target.value)}
                    disabled={savingProject}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="proj-goal" className="label">Meta vinculada</label>
                <select id="proj-goal" className="input-base" value={projGoal} onChange={(e) => setProjGoal(e.target.value)} disabled={savingProject}>
                  <option value="">Nenhuma</option>
                  {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>
              <div className="modal__footer" style={{ padding: '12px 0 0 0' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowProjModal(false)} disabled={savingProject}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={savingProject}>{savingProject ? 'Salvando...' : 'Salvar'}</button>
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
          <div className="modal-card modal-card--lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal__header">
              <h3 id="ws-modal-title" className="modal__title">Workspaces — {wsProject.name}</h3>
              <button className="modal__close" onClick={() => setWsProject(null)} aria-label="Fechar"><XCircle size={20} /></button>
            </div>
            <div className="modal__body stack-lg" style={{ overflowY: 'auto' }}>
              <div className="card stack-sm">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-body-sm">Repositórios GitHub conectados</strong>
                  <span className="text-caption text-tertiary">selecione direto da sua conta</span>
                </div>
                <GitHubRepoPicker
                  inputId="ws-repo-search"
                  repoOptions={repoOptions}
                  selectedIds={wsSelectedRepoIds}
                  onToggle={toggleWsRepo}
                  loading={loadingWsOptions}
                  disabled={savingWsRepos}
                />
                {repoOptions && repoOptions.repositories.length > 0 && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveWsRepositories}
                      disabled={
                        savingWsRepos ||
                        [...wsSelectedRepoIds].sort().join(',') === [...wsInitialRepoIds].sort().join(',')
                      }
                    >
                      {savingWsRepos ? 'Salvando...' : 'Salvar repositórios GitHub'}
                    </button>
                  </div>
                )}
              </div>

              <form onSubmit={handleAddWorkspace} className="card stack-sm">
                <strong className="text-body-sm">Adicionar Workspace manual (pasta local ou URL)</strong>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input-base" value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="Nome *" required aria-label="Nome do workspace" />
                  <input className="input-base" value={wsCwd} onChange={(e) => setWsCwd(e.target.value)} placeholder="Caminho local (/home/...)" aria-label="Caminho do diretório" />
                </div>
                <input className="input-base" value={wsRepo} onChange={(e) => setWsRepo(e.target.value)} placeholder="URL do repositório Git (opcional)" aria-label="URL do repositório" />
                <div className="flex justify-end">
                  <button type="submit" className="btn btn-secondary btn-sm">Adicionar</button>
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
