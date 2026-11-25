import { useState, useEffect, useCallback } from 'react'
import {
  Clock,
  Play,
  Pause,
  Plus,
  RotateCcw,
  Terminal,
  Activity,
  History,
  Square,
  Trash2,
  XCircle,
} from 'lucide-react'
import { cn, formatTimestamp } from '../lib/utils'
import { api } from '../lib/api'
import { useToastHelpers } from '../context/ToastContext'
import type { ActivityEvent, Agent, HeartbeatRun, Routine } from '../types/api'

interface RoutinesViewProps {
  companyId: string
  agents: Agent[]
}

type SubTab = 'routines' | 'runs' | 'activity'

export function RoutinesView({ companyId, agents }: RoutinesViewProps) {
  const { success, error: showError } = useToastHelpers()
  const [tab, setTab] = useState<SubTab>('routines')
  const [routines, setRoutines] = useState<Routine[]>([])
  const [runs, setRuns] = useState<HeartbeatRun[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Modal Criar Rotina
  const [showCreate, setShowCreate] = useState(false)
  const [rTitle, setRTitle] = useState('')
  const [rDesc, setRDesc] = useState('')
  const [rAgentId, setRAgentId] = useState('')
  const [rPriority, setRPriority] = useState('medium')

  // Modal Trigger Cron
  const [triggerRoutine, setTriggerRoutine] = useState<Routine | null>(null)
  const [cronExpr, setCronExpr] = useState('0 * * * *')
  const [cronLabel, setCronLabel] = useState('')
  const [cronTz, setCronTz] = useState('America/Sao_Paulo')

  // Modal Log de Run
  const [logRun, setLogRun] = useState<HeartbeatRun | null>(null)
  const [logContent, setLogContent] = useState('')
  const [loadingLog, setLoadingLog] = useState(false)

  // Filtro de runs
  const [runAgentFilter, setRunAgentFilter] = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [rt, rn, act] = await Promise.all([
        api.listRoutines(companyId),
        api.listRuns(companyId, 60),
        api.listActivity(companyId),
      ])
      setRoutines(rt)
      setRuns(rn)
      setActivity(act)
    } catch (err) {
      showError('Erro ao carregar execuções', err instanceof Error ? err.message : 'Falha')
    } finally {
      setLoading(false)
    }
  }, [companyId, showError])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRunNow = async (routine: Routine) => {
    try {
      await api.runRoutine(routine.id)
      success('Rotina disparada', routine.title)
      loadData()
    } catch (err) {
      showError('Erro ao executar rotina', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleToggleRoutineStatus = async (routine: Routine) => {
    const next = routine.status === 'active' ? 'paused' : 'active'
    try {
      await api.updateRoutine(routine.id, { status: next })
      success(next === 'active' ? 'Rotina ativada' : 'Rotina pausada', routine.title)
      loadData()
    } catch (err) {
      showError('Erro ao atualizar rotina', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleCreateRoutine = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rTitle.trim() || !rAgentId) return
    try {
      await api.createRoutine(companyId, {
        title: rTitle.trim(),
        description: rDesc.trim() || undefined,
        assigneeAgentId: rAgentId,
        priority: rPriority,
        status: 'active',
      })
      setShowCreate(false)
      setRTitle('')
      setRDesc('')
      success('Rotina criada')
      loadData()
    } catch (err) {
      showError('Erro ao criar rotina', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleCreateTrigger = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!triggerRoutine || !cronExpr.trim()) return
    try {
      await api.createRoutineTrigger(triggerRoutine.id, {
        kind: 'schedule',
        label: cronLabel.trim() || 'Agendamento',
        cronExpression: cronExpr.trim(),
        timezone: cronTz,
        enabled: true,
      })
      success('Gatilho agendado')
      setTriggerRoutine(null)
      setCronLabel('')
      loadData()
    } catch (err) {
      showError('Erro ao criar gatilho', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleDeleteTrigger = async (triggerId: string) => {
    try {
      await api.deleteRoutineTrigger(triggerId)
      success('Gatilho removido')
      loadData()
    } catch (err) {
      showError('Erro ao remover gatilho', err instanceof Error ? err.message : 'Falha')
    }
  }

  const openRunLog = async (run: HeartbeatRun) => {
    setLogRun(run)
    setLoadingLog(true)
    setLogContent('')
    try {
      const res = await api.getRunLog(run.id)
      setLogContent(res.content || '(Log vazio)')
    } catch {
      const fallback = [run.stdoutExcerpt, run.stderrExcerpt, run.error]
        .filter(Boolean)
        .join('\n--- STDERR / ERRO ---\n')
      setLogContent(fallback || 'Log detalhado não disponível para esta execução.')
    } finally {
      setLoadingLog(false)
    }
  }

  useEffect(() => {
    if (!logRun || logRun.status !== 'running') return
    const timer = setInterval(() => {
      api.getRunLog(logRun.id).then((res) => {
        if (res.content) setLogContent(res.content)
      }).catch(() => {})
    }, 3000)
    return () => clearInterval(timer)
  }, [logRun])

  const handleCancelRun = async (runId: string) => {
    try {
      await api.cancelRun(runId)
      success('Execução cancelada')
      loadData()
    } catch (err) {
      showError('Erro ao cancelar', err instanceof Error ? err.message : 'Falha')
    }
  }

  const filteredRuns = runs.filter((r) => runAgentFilter === 'all' || r.agentId === runAgentFilter)

  return (
    <div className="view-shell">
      <div className="view-header">
        <h2 className="text-h3 text-primary">Rotinas, Execuções & Auditoria</h2>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-icon" onClick={loadData} aria-label="Atualizar">
            <RotateCcw size={18} />
          </button>
          {tab === 'routines' && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} aria-hidden="true" />
              Nova Rotina
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 20px 0', backgroundColor: 'var(--color-bg-surface)' }}>
        <div className="tab-list" role="tablist" style={{ marginBottom: 0 }}>
          <button role="tab" className={cn('tab', tab === 'routines' && 'active')} aria-selected={tab === 'routines'} onClick={() => setTab('routines')}>
            <Clock size={15} /> Rotinas ({routines.length})
          </button>
          <button role="tab" className={cn('tab', tab === 'runs' && 'active')} aria-selected={tab === 'runs'} onClick={() => setTab('runs')}>
            <Terminal size={15} /> Execuções / Logs ({runs.length})
          </button>
          <button role="tab" className={cn('tab', tab === 'activity' && 'active')} aria-selected={tab === 'activity'} onClick={() => setTab('activity')}>
            <History size={15} /> Atividade ({activity.length})
          </button>
        </div>
      </div>

      <div className="view-body">
        {loading && routines.length === 0 && runs.length === 0 ? (
          <div className="skeleton" style={{ height: '120px' }} />
        ) : tab === 'routines' ? (
          <div className="stack-md">
            {routines.length === 0 ? (
              <div className="empty-state">
                <Clock className="empty-state__icon" size={48} />
                <h3 className="empty-state__title">Nenhuma rotina configurada</h3>
                <p className="empty-state__description">Crie rotinas recorrentes com cron para seus agentes.</p>
              </div>
            ) : (
              routines.map((rt) => {
                const assignee = agents.find((a) => a.id === rt.assigneeAgentId)
                return (
                  <article key={rt.id} className="card stack-sm">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-body" style={{ fontWeight: 600 }}>{rt.title}</h3>
                          <span className={cn('badge', rt.status === 'active' ? 'badge-success' : 'badge-warning')}>
                            {rt.status}
                          </span>
                        </div>
                        {rt.description && (
                          <p className="text-caption text-secondary text-truncate-2 mt-1">{rt.description}</p>
                        )}
                        <div className="text-caption text-tertiary mt-1">
                          Agente: {assignee?.name ?? 'N/A'} • Última execução: {rt.lastTriggeredAt ? formatTimestamp(rt.lastTriggeredAt) : 'Nunca'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button className="btn btn-primary btn-sm" onClick={() => handleRunNow(rt)}>
                          <Play size={14} /> Executar Agora
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setTriggerRoutine(rt)}>
                          <Plus size={14} /> Gatilho
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleToggleRoutineStatus(rt)}>
                          {rt.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                          {rt.status === 'active' ? 'Pausar' : 'Ativar'}
                        </button>
                      </div>
                    </div>

                    {rt.triggers && rt.triggers.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        {rt.triggers.map((t) => (
                          <span key={t.id} className="badge badge-neutral">
                            <Clock size={11} />
                            {t.label || t.kind}: <code className="text-mono">{t.cronExpression || t.kind}</code>
                            <button
                              type="button"
                              onClick={() => handleDeleteTrigger(t.id)}
                              aria-label={`Remover gatilho ${t.label || t.kind}`}
                              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: '4px' }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>
        ) : tab === 'runs' ? (
          <div className="stack-md">
            <div className="flex items-center gap-3 flex-wrap">
              <select
                className="input-base"
                style={{ width: 'auto', minHeight: '38px', padding: '6px 12px', fontSize: '0.875rem' }}
                value={runAgentFilter}
                onChange={(e) => setRunAgentFilter(e.target.value)}
                aria-label="Filtrar execuções por agente"
              >
                <option value="all">Todos os agentes</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Agente</th>
                    <th>Status</th>
                    <th>Origem</th>
                    <th>Tokens</th>
                    <th>Início</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => {
                    const ag = agents.find((a) => a.id === run.agentId)
                    const isRunning = run.status === 'running' || run.status === 'queued'
                    return (
                      <tr key={run.id}>
                        <td>{ag?.name ?? run.agentId.slice(0, 8)}</td>
                        <td>
                          <span
                            className={cn(
                              'badge',
                              run.status === 'succeeded'
                                ? 'badge-success'
                                : run.status === 'failed'
                                ? 'badge-error'
                                : run.status === 'running'
                                ? 'badge-brand'
                                : 'badge-neutral'
                            )}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="text-caption">{run.invocationSource}</td>
                        <td className="text-caption text-mono">
                          {run.totalTokens != null ? run.totalTokens.toLocaleString() : '-'}
                        </td>
                        <td className="text-caption">{formatTimestamp(run.startedAt || run.createdAt)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button className="btn btn-ghost btn-sm" onClick={() => openRunLog(run)}>
                              <Terminal size={14} /> Log
                            </button>
                            {isRunning && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleCancelRun(run.id)}>
                                <Square size={12} /> Parar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            {activity.map((ev) => {
              const ag = agents.find((a) => a.id === ev.agentId)
              return (
                <div key={ev.id} className="card flex items-center justify-between gap-3 flex-wrap" style={{ padding: '10px 14px' }}>
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Activity size={14} className="text-tertiary" aria-hidden="true" />
                    <span className="badge badge-neutral text-mono">{ev.action}</span>
                    <span className="text-caption text-secondary">
                      {ev.entityType} ({ev.entityId.slice(0, 8)})
                    </span>
                    {ag && <span className="text-caption text-primary">• {ag.name}</span>}
                  </div>
                  <time className="text-caption text-tertiary" dateTime={ev.createdAt}>
                    {formatTimestamp(ev.createdAt)}
                  </time>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Nova Rotina */}
      {showCreate && (
        <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="new-routine-title">
          <div className="modal-backdrop" onClick={() => setShowCreate(false)} aria-hidden="true" />
          <div className="modal-card">
            <div className="modal__header">
              <h3 id="new-routine-title" className="modal__title">Nova Rotina</h3>
              <button className="modal__close" onClick={() => setShowCreate(false)} aria-label="Fechar"><XCircle size={20} /></button>
            </div>
            <form onSubmit={handleCreateRoutine} className="modal__body stack-md">
              <div>
                <label htmlFor="rt-title" className="label">Título *</label>
                <input id="rt-title" className="input-base" value={rTitle} onChange={(e) => setRTitle(e.target.value)} required autoFocus />
              </div>
              <div>
                <label htmlFor="rt-agent" className="label">Agente Executor *</label>
                <select id="rt-agent" className="input-base" value={rAgentId} onChange={(e) => setRAgentId(e.target.value)} required>
                  <option value="">Selecione um agente</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="rt-priority" className="label">Prioridade</label>
                <select id="rt-priority" className="input-base" value={rPriority} onChange={(e) => setRPriority(e.target.value)}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>
              <div>
                <label htmlFor="rt-desc" className="label">Instruções da Rotina</label>
                <textarea id="rt-desc" className="input-base" rows={4} value={rDesc} onChange={(e) => setRDesc(e.target.value)} placeholder="O que o agente deve fazer a cada disparo..." />
              </div>
              <div className="modal__footer" style={{ padding: '12px 0 0 0' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Criar Rotina</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar Trigger Cron */}
      {triggerRoutine && (
        <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="new-trig-title">
          <div className="modal-backdrop" onClick={() => setTriggerRoutine(null)} aria-hidden="true" />
          <div className="modal-card">
            <div className="modal__header">
              <h3 id="new-trig-title" className="modal__title">Agendar Gatilho — {triggerRoutine.title}</h3>
              <button className="modal__close" onClick={() => setTriggerRoutine(null)} aria-label="Fechar"><XCircle size={20} /></button>
            </div>
            <form onSubmit={handleCreateTrigger} className="modal__body stack-md">
              <div>
                <label htmlFor="trig-label" className="label">Rótulo</label>
                <input id="trig-label" className="input-base" value={cronLabel} onChange={(e) => setCronLabel(e.target.value)} placeholder="Ex: Verificação diária às 9h" />
              </div>
              <div>
                <label htmlFor="trig-cron" className="label">Expressão Cron *</label>
                <input id="trig-cron" className="input-base text-mono" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="trig-tz" className="label">Fuso Horário</label>
                <input id="trig-tz" className="input-base" value={cronTz} onChange={(e) => setCronTz(e.target.value)} />
              </div>
              <div className="modal__footer" style={{ padding: '12px 0 0 0' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setTriggerRoutine(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Adicionar Gatilho</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Log da Execução */}
      {logRun && (
        <div className="modal-overlay-flex" role="dialog" aria-modal="true" aria-labelledby="run-log-title">
          <div className="modal-backdrop" onClick={() => setLogRun(null)} aria-hidden="true" />
          <div className="modal-card modal-card--lg">
            <div className="modal__header">
              <h3 id="run-log-title" className="modal__title">Log de Execução — {logRun.id.slice(0, 8)}</h3>
              <button className="modal__close" onClick={() => setLogRun(null)} aria-label="Fechar"><XCircle size={20} /></button>
            </div>
            <div className="modal__body stack-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-caption text-tertiary">
                  Status: <strong>{logRun.status}</strong> • Tokens: {logRun.totalTokens ?? 0} • Custo: US$ {(logRun.costUsd ?? 0).toFixed(4)}
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-secondary btn-sm" onClick={() => openRunLog(logRun)}>
                    <RotateCcw size={13} /> Atualizar
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(logContent)
                      success('Log copiado')
                    }}
                  >
                    Copiar
                  </button>
                </div>
              </div>
              <pre className="log-console">
                {loadingLog ? 'Carregando log...' : logContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
