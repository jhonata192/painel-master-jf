import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  DollarSign,
  Inbox,
  MessageSquare,
  Play,
  RotateCcw,
  Square,
  ListTodo,
} from 'lucide-react'
import { api } from '../lib/api'
import { formatTimestamp } from '../lib/utils'
import { useToastHelpers } from '../context/ToastContext'
import type { Agent, AttentionFeed, DashboardSummary, HeartbeatRun } from '../types/api'

interface DashboardViewProps {
  companyId: string
  agents: Agent[]
  onNavigate?: (view: string) => void
  onOpenChat?: (agentRef: string) => void
}

export function DashboardView({ companyId, agents, onNavigate, onOpenChat }: DashboardViewProps) {
  const { success, error: showError } = useToastHelpers()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [attention, setAttention] = useState<AttentionFeed | null>(null)
  const [liveRuns, setLiveRuns] = useState<HeartbeatRun[]>([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [d, a, lr] = await Promise.all([
        api.getDashboard(companyId),
        api.getAttention(companyId).catch(() => null),
        api.listLiveRuns(companyId).catch(() => []),
      ])
      setSummary(d)
      setAttention(a)
      setLiveRuns(lr)
    } catch (err) {
      showError('Erro ao carregar dashboard', err instanceof Error ? err.message : 'Falha')
    } finally {
      setLoading(false)
    }
  }, [companyId, showError])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleCancelRun = async (runId: string) => {
    try {
      await api.cancelRun(runId)
      success('Execução cancelada')
      loadAll()
    } catch (err) {
      showError('Erro ao cancelar execução', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleClaimAttention = async (sourceKind: string, sourceId: string) => {
    try {
      await api.claimAttention(companyId, sourceKind, sourceId)
      success('Item assumido')
      loadAll()
    } catch (err) {
      showError('Erro ao assumir item', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleCloseAttention = async (sourceKind: string, sourceId: string) => {
    try {
      await api.closeAttention(companyId, sourceKind, sourceId)
      success('Item encerrado')
      loadAll()
    } catch (err) {
      showError('Erro ao encerrar item', err instanceof Error ? err.message : 'Falha')
    }
  }

  const maxDailyTotal = Math.max(
    1,
    ...(summary?.runActivity ?? []).map((r) => r.total || r.succeeded + r.failed + r.other)
  )

  return (
    <div className="view-shell">
      <div className="view-header">
        <div>
          <h2 className="text-h3 text-primary">Dashboard Executivo</h2>
          <p className="text-caption text-tertiary">
            Visão geral em tempo real da operação no Paperclip
          </p>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={loadAll} aria-label="Atualizar dashboard" title="Atualizar">
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="view-body stack-lg">
        {loading && !summary ? (
          <div className="grid-kpi" aria-busy="true">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="skeleton" style={{ height: '110px' }} />
            ))}
          </div>
        ) : summary ? (
          <>
            {/* KPIs */}
            <div className="grid-kpi">
              <div className="card stack-xs">
                <div className="flex items-center justify-between text-secondary text-caption">
                  <span>Agentes</span>
                  <Bot size={18} aria-hidden="true" />
                </div>
                <div className="text-h2 text-primary">{summary.agents.active}</div>
                <div className="text-caption text-tertiary">
                  {summary.agents.running} rodando • {summary.agents.paused} pausados • {summary.agents.error} erro
                </div>
              </div>

              <div className="card stack-xs">
                <div className="flex items-center justify-between text-secondary text-caption">
                  <span>Tarefas</span>
                  <ListTodo size={18} aria-hidden="true" />
                </div>
                <div className="text-h2 text-primary">
                  {summary.tasks.open + summary.tasks.inProgress}
                </div>
                <div className="text-caption text-tertiary">
                  {summary.tasks.inProgress} em andamento • {summary.tasks.blocked} bloqueadas • {summary.tasks.done} concluídas
                </div>
              </div>

              <div className="card stack-xs">
                <div className="flex items-center justify-between text-secondary text-caption">
                  <span>Atenção & Aprovações</span>
                  <Inbox size={18} aria-hidden="true" />
                </div>
                <div className="text-h2 text-primary">
                  {(attention?.totalCount ?? 0) + summary.pendingApprovals}
                </div>
                <div className="text-caption text-tertiary">
                  {summary.pendingApprovals} aprovações • {attention?.totalCount ?? 0} alertas no inbox
                </div>
              </div>

              <div className="card stack-xs">
                <div className="flex items-center justify-between text-secondary text-caption">
                  <span>Custo do Mês</span>
                  <DollarSign size={18} aria-hidden="true" />
                </div>
                <div className="text-h2 text-primary">
                  US$ {(summary.costs.monthSpendCents / 100).toFixed(2)}
                </div>
                <div className="text-caption text-tertiary">
                  {summary.costs.monthBudgetCents > 0
                    ? `Orçamento: US$ ${(summary.costs.monthBudgetCents / 100).toFixed(2)} (${summary.costs.monthUtilizationPercent}%)`
                    : 'Sem limite mensal definido'}
                </div>
              </div>
            </div>

            {/* Acesso Rápido & Equipe */}
            {onOpenChat && agents.length > 0 && (
              <section className="card stack-sm" aria-labelledby="quick-team-title">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 id="quick-team-title" className="text-body" style={{ fontWeight: 600 }}>
                    Acesso Rápido — Iniciar Conversa
                  </h3>
                  {onNavigate && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('tasks')}>
                      Abrir Tarefas
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {agents.slice(0, 8).map((ag) => (
                    <button
                      key={ag.id}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onOpenChat(ag.ref)}
                    >
                      <MessageSquare size={13} aria-hidden="true" />
                      {ag.name.split(' - ')[0]}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Gráfico de atividade dos últimos 14 dias */}
            <section className="card stack-md" aria-labelledby="chart-activity-title">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 id="chart-activity-title" className="text-body" style={{ fontWeight: 600 }}>
                  Atividade de Execuções (Últimos 14 dias)
                </h3>
                <div className="flex items-center gap-3 text-caption text-tertiary">
                  <span>● Sucesso</span>
                  <span className="text-error">● Falha</span>
                </div>
              </div>

              <div className="chart-bars" role="img" aria-label="Gráfico de barras de execuções nos últimos 14 dias">
                {summary.runActivity.map((day) => {
                  const total = day.total || day.succeeded + day.failed + day.other
                  const heightPct = Math.round((total / maxDailyTotal) * 100)
                  const succPct = total > 0 ? Math.round((day.succeeded / total) * 100) : 0
                  const failPct = total > 0 ? Math.round((day.failed / total) * 100) : 0
                  return (
                    <div
                      key={day.date}
                      className="chart-bar-col"
                      title={`${day.date}: ${day.succeeded} sucesso, ${day.failed} falha (${total} total)`}
                    >
                      <div
                        className="chart-bar-stack"
                        style={{ height: `${Math.max(heightPct, total > 0 ? 8 : 2)}%` }}
                      >
                        <div
                          style={{
                            height: `${succPct}%`,
                            backgroundColor: 'var(--color-status-success)',
                          }}
                        />
                        <div
                          style={{
                            height: `${failPct}%`,
                            backgroundColor: 'var(--color-status-error)',
                          }}
                        />
                      </div>
                      <span className="text-caption text-tertiary" style={{ fontSize: '10px' }}>
                        {day.date.slice(5)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Execuções Ao Vivo */}
            <section className="card stack-md" aria-labelledby="live-runs-title">
              <div className="flex items-center justify-between">
                <h3 id="live-runs-title" className="text-body flex items-center gap-2" style={{ fontWeight: 600 }}>
                  <Activity size={18} aria-hidden="true" />
                  Execuções em Andamento ({liveRuns.length})
                </h3>
                {onNavigate && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('routines')}>
                    Ver todas execuções
                  </button>
                )}
              </div>

              {liveRuns.length === 0 ? (
                <p className="text-body-sm text-tertiary">Nenhum agente executando neste instante.</p>
              ) : (
                <div className="stack-sm">
                  {liveRuns.map((run) => {
                    const ag = agents.find((a) => a.id === run.agentId)
                    return (
                      <div
                        key={run.id}
                        className="card flex items-center justify-between gap-3"
                        style={{ backgroundColor: 'var(--color-bg-surface-elevated)' }}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Play size={14} className="text-success" aria-hidden="true" />
                            <strong className="text-body-sm">{ag?.name ?? run.agentName ?? run.agentId}</strong>
                            <span className="badge badge-brand">{run.status}</span>
                          </div>
                          <div className="text-caption text-tertiary mt-1">
                            Iniciada {formatTimestamp(run.startedAt || run.createdAt)} • Fonte: {run.invocationSource}
                          </div>
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleCancelRun(run.id)}
                          aria-label={`Cancelar execução de ${ag?.name ?? 'agente'}`}
                        >
                          <Square size={13} aria-hidden="true" />
                          Parar
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Fila de Atenção (Inbox) */}
            {attention && (
              <section className="card stack-md" aria-labelledby="attention-title">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 id="attention-title" className="text-body flex items-center gap-2" style={{ fontWeight: 600 }}>
                    <AlertTriangle size={18} className="text-warning" aria-hidden="true" />
                    Fila de Atenção ({attention.items.length})
                  </h3>
                  <span className="text-caption text-tertiary">
                    Meus: {attention.viewCounts?.mine ?? 0} • Empresa: {attention.viewCounts?.company ?? 0}
                  </span>
                </div>

                {attention.items.length === 0 ? (
                  <div className="flex items-center gap-2 text-success text-body-sm">
                    <CheckCircle2 size={16} aria-hidden="true" />
                    Tudo em dia! Nenhum item pendente de atenção.
                  </div>
                ) : (
                  <div className="stack-sm">
                    {attention.items.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className="card flex items-center justify-between gap-3 flex-wrap"
                        style={{ backgroundColor: 'var(--color-bg-surface-elevated)' }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge badge-warning">{item.sourceKind}</span>
                            <strong className="text-body-sm text-primary">{item.title}</strong>
                          </div>
                          {item.summary && (
                            <p className="text-caption text-secondary mt-1">{item.summary}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleClaimAttention(item.sourceKind, item.sourceId)}
                          >
                            Assumir
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleCloseAttention(item.sourceKind, item.sourceId)}
                          >
                            Encerrar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
