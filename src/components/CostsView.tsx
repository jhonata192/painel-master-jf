import { useState, useEffect, useCallback } from 'react'
import { DollarSign, Cpu, RotateCcw, Plus, ShieldAlert } from 'lucide-react'
import { api } from '../lib/api'
import { useToastHelpers } from '../context/ToastContext'
import type {
  Agent,
  BudgetOverview,
  CostByAgent,
  CostByProject,
  CostByProvider,
  CostsSummary,
} from '../types/api'

interface CostsViewProps {
  companyId: string
  agents: Agent[]
}

export function CostsView({ companyId, agents }: CostsViewProps) {
  const { success, error: showError } = useToastHelpers()
  const [summary, setSummary] = useState<CostsSummary | null>(null)
  const [byAgent, setByAgent] = useState<CostByAgent[]>([])
  const [byProject, setByProject] = useState<CostByProject[]>([])
  const [byProvider, setByProvider] = useState<CostByProvider[]>([])
  const [budgets, setBudgets] = useState<BudgetOverview | null>(null)
  const [loading, setLoading] = useState(true)

  // Nova política de orçamento
  const [scopeType, setScopeType] = useState<'company' | 'agent'>('company')
  const [scopeId, setScopeId] = useState(companyId)
  const [amountUsd, setAmountUsd] = useState('50')

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, ba, bp, bpr, bg] = await Promise.all([
        api.getCostsSummary(companyId),
        api.getCostsByAgent(companyId),
        api.getCostsByProject(companyId),
        api.getCostsByProvider(companyId),
        api.getBudgetsOverview(companyId),
      ])
      setSummary(s)
      setByAgent(ba)
      setByProject(bp)
      setByProvider(bpr)
      setBudgets(bg)
    } catch (err) {
      showError('Erro ao carregar custos', err instanceof Error ? err.message : 'Falha')
    } finally {
      setLoading(false)
    }
  }, [companyId, showError])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    const cents = Math.round(Number(amountUsd || 0) * 100)
    if (cents <= 0) return
    try {
      await api.upsertBudgetPolicy(companyId, {
        scopeType,
        scopeId: scopeType === 'company' ? companyId : scopeId,
        amount: cents,
        windowKind: 'calendar_month_utc',
        warnPercent: 80,
        hardStopEnabled: true,
      })
      success('Política de orçamento salva')
      loadAll()
    } catch (err) {
      showError('Erro ao salvar política', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleResolveIncident = async (incidentId: string, action: 'keep_paused' | 'raise_and_resume') => {
    try {
      await api.resolveBudgetIncident(companyId, incidentId, action)
      success('Incidente resolvido')
      loadAll()
    } catch (err) {
      showError('Erro ao resolver incidente', err instanceof Error ? err.message : 'Falha')
    }
  }

  return (
    <div className="view-shell">
      <div className="view-header">
        <h2 className="text-h3 text-primary">Custos, Tokens & Orçamentos</h2>
        <button className="btn btn-ghost btn-icon" onClick={loadAll} aria-label="Atualizar custos">
          <RotateCcw size={18} />
        </button>
      </div>

      <div className="view-body stack-lg">
        {loading && !summary ? (
          <div className="skeleton" style={{ height: '120px' }} />
        ) : (
          <>
            {summary && (
              <div className="grid-kpi">
                <div className="card stack-xs">
                  <div className="text-caption text-secondary flex items-center justify-between">
                    <span>Gasto Total</span>
                    <DollarSign size={16} aria-hidden="true" />
                  </div>
                  <div className="text-h2">US$ {(summary.spendCents / 100).toFixed(2)}</div>
                  <div className="text-caption text-tertiary">
                    {summary.eventCount} eventos registrados
                  </div>
                </div>

                <div className="card stack-xs">
                  <div className="text-caption text-secondary">Orçamento</div>
                  <div className="text-h2">
                    {summary.budgetCents > 0 ? `US$ ${(summary.budgetCents / 100).toFixed(2)}` : 'Sem limite'}
                  </div>
                  <div className="progress-track mt-1">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, summary.utilizationPercent)}%` }}
                    />
                  </div>
                </div>

                <div className="card stack-xs">
                  <div className="text-caption text-secondary flex items-center justify-between">
                    <span>Eventos sem Preço / Pendentes</span>
                    <Cpu size={16} aria-hidden="true" />
                  </div>
                  <div className="text-h2">{summary.unpricedEventCount}</div>
                  <div className="text-caption text-tertiary">
                    {summary.pendingRunCount} execuções pendentes
                  </div>
                </div>
              </div>
            )}

            {/* Uso por Provedor / Modelo */}
            <section className="card stack-md" aria-labelledby="cost-provider-title">
              <h3 id="cost-provider-title" className="text-body" style={{ fontWeight: 600 }}>
                Consumo por Provedor / Modelo
              </h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Provedor</th>
                      <th>Modelo</th>
                      <th>Input Tokens</th>
                      <th>Output Tokens</th>
                      <th>Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byProvider.map((p, idx) => (
                      <tr key={`${p.provider}-${p.model}-${idx}`}>
                        <td>{p.provider}</td>
                        <td className="text-mono text-caption">{p.model}</td>
                        <td className="text-mono text-caption">{(p.inputTokens ?? 0).toLocaleString()}</td>
                        <td className="text-mono text-caption">{(p.outputTokens ?? 0).toLocaleString()}</td>
                        <td>US$ {(p.costCents / 100).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Uso por Agente */}
            <section className="card stack-md" aria-labelledby="cost-agent-title">
              <h3 id="cost-agent-title" className="text-body" style={{ fontWeight: 600 }}>
                Consumo por Agente
              </h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Agente</th>
                      <th>Eventos</th>
                      <th>Tokens Entrada</th>
                      <th>Tokens Saída</th>
                      <th>Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byAgent.map((a) => (
                      <tr key={a.agentId}>
                        <td>{a.agentName}</td>
                        <td>{a.eventCount}</td>
                        <td className="text-mono text-caption">{a.inputTokens.toLocaleString()}</td>
                        <td className="text-mono text-caption">{a.outputTokens.toLocaleString()}</td>
                        <td>US$ {(a.costCents / 100).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Uso por Projeto */}
            {byProject.length > 0 && (
              <section className="card stack-md" aria-labelledby="cost-proj-title">
                <h3 id="cost-proj-title" className="text-body" style={{ fontWeight: 600 }}>
                  Consumo por Projeto
                </h3>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Projeto</th>
                        <th>Eventos</th>
                        <th>Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byProject.map((p, idx) => (
                        <tr key={p.projectId ?? idx}>
                          <td>{p.projectName || 'Sem projeto'}</td>
                          <td>{p.eventCount}</td>
                          <td>US$ {(p.costCents / 100).toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Políticas de Orçamento */}
            <section className="card stack-md" aria-labelledby="budgets-title">
              <h3 id="budgets-title" className="text-body" style={{ fontWeight: 600 }}>
                Políticas de Orçamento Mensal
              </h3>

              <form onSubmit={handleSavePolicy} className="flex items-end gap-3 flex-wrap">
                <div>
                  <label htmlFor="budget-scope" className="label">Escopo</label>
                  <select
                    id="budget-scope"
                    className="input-base"
                    value={scopeType}
                    onChange={(e) => {
                      const val = e.target.value as 'company' | 'agent'
                      setScopeType(val)
                      setScopeId(val === 'company' ? companyId : agents[0]?.id || '')
                    }}
                  >
                    <option value="company">Empresa inteira</option>
                    <option value="agent">Agente específico</option>
                  </select>
                </div>

                {scopeType === 'agent' && (
                  <div>
                    <label htmlFor="budget-agent" className="label">Agente</label>
                    <select id="budget-agent" className="input-base" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="budget-usd" className="label">Limite Mensal (USD)</label>
                  <input
                    id="budget-usd"
                    type="number"
                    min="1"
                    step="0.01"
                    className="input-base"
                    style={{ width: '140px' }}
                    value={amountUsd}
                    onChange={(e) => setAmountUsd(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary">
                  <Plus size={16} /> Definir Limite
                </button>
              </form>

              {budgets && budgets.policies.length > 0 && (
                <div className="stack-sm">
                  {budgets.policies.map((pol) => (
                    <div key={pol.id} className="card flex items-center justify-between gap-2" style={{ backgroundColor: 'var(--color-bg-surface-elevated)' }}>
                      <div>
                        <strong>{pol.scopeName || pol.scopeType}</strong>
                        <div className="text-caption text-tertiary">
                          Janela: {pol.windowKind} • Aviso em {pol.warnPercent ?? 80}%
                        </div>
                      </div>
                      <span className="badge badge-brand">US$ {(pol.amount / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {budgets && budgets.activeIncidents.length > 0 && (
                <div className="stack-sm">
                  <h4 className="text-body-sm text-error flex items-center gap-2">
                    <ShieldAlert size={16} /> Incidentes Ativos
                  </h4>
                  {budgets.activeIncidents.map((inc) => (
                    <div key={inc.id} className="card flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <strong>{inc.scopeName || inc.scopeType}</strong>
                        <div className="text-caption text-tertiary">
                          Observado: US$ {(inc.amountObserved / 100).toFixed(2)} / Limite: US$ {(inc.amountLimit / 100).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="btn btn-secondary btn-sm" onClick={() => handleResolveIncident(inc.id, 'keep_paused')}>
                          Manter Pausado
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleResolveIncident(inc.id, 'raise_and_resume')}>
                          Aumentar e Retomar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
