import { useState, useEffect, useCallback } from 'react'
import {
  KeyRound,
  Cpu,
  Sparkles,
  Tag,
  Building2,
  Server,
  Plus,
  Trash2,
  RotateCcw,
  RefreshCw,
} from 'lucide-react'
import { cn, formatTimestamp } from '../lib/utils'
import { api } from '../lib/api'
import { useToastHelpers } from '../context/ToastContext'
import type {
  AiConnection,
  Company,
  CompanySecret,
  CompanySkill,
  HealthStatus,
  IssueLabel,
} from '../types/api'

interface SettingsViewProps {
  company: Company
  onCompanyUpdated: () => void
}

type SettingsTab = 'ai' | 'secrets' | 'skills' | 'labels' | 'company'

export function SettingsView({ company, onCompanyUpdated }: SettingsViewProps) {
  const { success, error: showError } = useToastHelpers()
  const [tab, setTab] = useState<SettingsTab>('ai')

  // AI Connections
  const [connections, setConnections] = useState<AiConnection[]>([])
  const [probeResult, setProbeResult] = useState<Record<string, unknown> | null>(null)

  // Secrets
  const [secrets, setSecrets] = useState<CompanySecret[]>([])
  const [secName, setSecName] = useState('')
  const [secVal, setSecVal] = useState('')
  const [secDesc, setSecDesc] = useState('')

  // Skills
  const [skills, setSkills] = useState<CompanySkill[]>([])
  const [skillSource, setSkillSource] = useState('')

  // Labels
  const [labels, setLabels] = useState<IssueLabel[]>([])
  const [lblName, setLblName] = useState('')
  const [lblColor, setLblColor] = useState('#7C4DFF')

  // Company & Instance
  const [compName, setCompName] = useState(company.name)
  const [compDesc, setCompDesc] = useState(company.description ?? '')
  const [newCompName, setNewCompName] = useState('')
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [instanceSettings, setInstanceSettings] = useState<Record<string, unknown> | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [ai, sec, sk, lb, h, inst] = await Promise.all([
        api.listAiConnections(company.id).catch(() => ({ connections: [] })),
        api.listSecrets(company.id).catch(() => []),
        api.listSkills(company.id).catch(() => []),
        api.listLabels(company.id).catch(() => []),
        api.getHealth().catch(() => null),
        api.getInstanceSettings().catch(() => null),
      ])
      setConnections(ai.connections ?? [])
      setSecrets(sec)
      setSkills(sk)
      setLabels(lb)
      setHealth(h)
      setInstanceSettings(inst)
    } catch {
      // ignore
    }
  }, [company.id])

  useEffect(() => {
    setCompName(company.name)
    setCompDesc(company.description ?? '')
    loadAll()
  }, [company, loadAll])

  const handleProbeConnection = async (conn: AiConnection) => {
    try {
      const res = await api.probeAiConnectionUsage(company.id, conn.id, conn.grantId)
      setProbeResult(res)
      success('Conexão verificada')
    } catch (err) {
      showError('Erro ao verificar conexão', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleCreateSecret = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!secName.trim() || !secVal.trim()) return
    try {
      await api.createSecret(company.id, {
        name: secName.trim(),
        value: secVal,
        description: secDesc.trim() || undefined,
      })
      setSecName('')
      setSecVal('')
      setSecDesc('')
      success('Segredo criado')
      setSecrets(await api.listSecrets(company.id))
    } catch (err) {
      showError('Erro ao criar segredo', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleToggleSecret = async (s: CompanySecret) => {
    try {
      await api.toggleSecret(s.id, s.status !== 'active')
      success(s.status === 'active' ? 'Segredo desativado' : 'Segredo ativado')
      setSecrets(await api.listSecrets(company.id))
    } catch (err) {
      showError('Erro ao atualizar segredo', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleDeleteSecret = async (s: CompanySecret) => {
    if (!confirm(`Excluir segredo "${s.name}"?`)) return
    try {
      await api.deleteSecret(s.id)
      success('Segredo excluído')
      setSecrets(await api.listSecrets(company.id))
    } catch (err) {
      showError('Erro ao excluir segredo', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleImportSkill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!skillSource.trim()) return
    try {
      await api.importSkillFromSource(company.id, skillSource.trim())
      setSkillSource('')
      success('Skill importada')
      setSkills(await api.listSkills(company.id))
    } catch (err) {
      showError('Erro ao importar skill', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleDeleteSkill = async (sk: CompanySkill) => {
    if (!confirm(`Remover skill "${sk.name}"?`)) return
    try {
      await api.deleteSkill(company.id, sk.id)
      success('Skill removida')
      setSkills(await api.listSkills(company.id))
    } catch (err) {
      showError('Erro ao remover skill', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lblName.trim()) return
    try {
      await api.createLabel(company.id, { name: lblName.trim(), color: lblColor })
      setLblName('')
      success('Etiqueta criada')
      setLabels(await api.listLabels(company.id))
    } catch (err) {
      showError('Erro ao criar etiqueta', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleDeleteLabel = async (id: string) => {
    try {
      await api.deleteLabel(id)
      setLabels(await api.listLabels(company.id))
      success('Etiqueta excluída')
    } catch (err) {
      showError('Erro ao excluir etiqueta', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.updateCompany(company.id, { name: compName.trim(), description: compDesc.trim() || null })
      success('Empresa atualizada')
      onCompanyUpdated()
    } catch (err) {
      showError('Erro ao atualizar empresa', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompName.trim()) return
    try {
      await api.createCompany({ name: newCompName.trim() })
      setNewCompName('')
      success('Nova empresa criada')
      onCompanyUpdated()
    } catch (err) {
      showError('Erro ao criar empresa', err instanceof Error ? err.message : 'Falha')
    }
  }

  return (
    <div className="view-shell">
      <div className="view-header">
        <h2 className="text-h3 text-primary">Configurações, Conexões & Sistema</h2>
        <button className="btn btn-ghost btn-icon" onClick={loadAll} aria-label="Recarregar configurações">
          <RotateCcw size={18} />
        </button>
      </div>

      <div style={{ padding: '12px 20px 0', backgroundColor: 'var(--color-bg-surface)' }}>
        <div className="tab-list" role="tablist" style={{ marginBottom: 0 }}>
          <button role="tab" className={cn('tab', tab === 'ai' && 'active')} aria-selected={tab === 'ai'} onClick={() => setTab('ai')}>
            <Cpu size={14} /> Conexões de IA ({connections.length})
          </button>
          <button role="tab" className={cn('tab', tab === 'secrets' && 'active')} aria-selected={tab === 'secrets'} onClick={() => setTab('secrets')}>
            <KeyRound size={14} /> Segredos ({secrets.length})
          </button>
          <button role="tab" className={cn('tab', tab === 'skills' && 'active')} aria-selected={tab === 'skills'} onClick={() => setTab('skills')}>
            <Sparkles size={14} /> Skills ({skills.length})
          </button>
          <button role="tab" className={cn('tab', tab === 'labels' && 'active')} aria-selected={tab === 'labels'} onClick={() => setTab('labels')}>
            <Tag size={14} /> Etiquetas ({labels.length})
          </button>
          <button role="tab" className={cn('tab', tab === 'company' && 'active')} aria-selected={tab === 'company'} onClick={() => setTab('company')}>
            <Building2 size={14} /> Empresa & Servidor
          </button>
        </div>
      </div>

      <div className="view-body stack-lg">
        {tab === 'ai' && (
          <div className="stack-md">
            {connections.length === 0 ? (
              <p className="text-body-sm text-tertiary">Nenhuma conexão de IA configurada.</p>
            ) : (
              connections.map((c) => {
                const modelsList = c.routing?.models || c.models || []
                return (
                  <article key={c.id} className="card flex items-start justify-between gap-3 flex-wrap">
                    <div className="stack-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-body">{c.name || c.label || c.provider}</strong>
                        <span className="badge badge-brand">{c.method}</span>
                        {c.status && <span className="badge badge-success">{c.status}</span>}
                        {c.routing?.protocol && <span className="badge badge-neutral">{c.routing.protocol}</span>}
                      </div>
                      {c.routing?.baseUrl && (
                        <div className="text-caption text-mono text-tertiary">{c.routing.baseUrl}</div>
                      )}
                      {modelsList.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          {modelsList.map((m, idx) => {
                            const key = typeof m === 'string' ? m : m.id || String(idx)
                            const label = typeof m === 'string' ? m : (m.label || m.id)
                            return (
                              <span key={key} className="badge badge-info text-mono">
                                {label}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {c.usageProbeSupported !== false && (
                      <button className="btn btn-secondary btn-sm" onClick={() => handleProbeConnection(c)}>
                        <RefreshCw size={14} /> Testar Uso
                      </button>
                    )}
                  </article>
                )
              })
            )}
            {probeResult && (
              <pre className="log-console">{JSON.stringify(probeResult, null, 2)}</pre>
            )}
          </div>
        )}

        {tab === 'secrets' && (
          <div className="stack-lg">
            <form onSubmit={handleCreateSecret} className="card stack-md">
              <h3 className="text-body" style={{ fontWeight: 600 }}>Adicionar Segredo Criptografado</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sec-name" className="label">Nome / Chave *</label>
                  <input id="sec-name" className="input-base text-mono" value={secName} onChange={(e) => setSecName(e.target.value)} placeholder="OPENAI_API_KEY" required />
                </div>
                <div>
                  <label htmlFor="sec-val" className="label">Valor *</label>
                  <input id="sec-val" type="password" className="input-base" value={secVal} onChange={(e) => setSecVal(e.target.value)} placeholder="sk-..." required />
                </div>
              </div>
              <div>
                <label htmlFor="sec-desc" className="label">Descrição</label>
                <input id="sec-desc" className="input-base" value={secDesc} onChange={(e) => setSecDesc(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} /> Salvar Segredo</button>
              </div>
            </form>

            <div className="stack-sm">
              {secrets.map((s) => (
                <div key={s.id} className="card flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-mono text-body-sm">{s.name}</strong>
                      <span className={cn('badge', s.status === 'active' ? 'badge-success' : 'badge-neutral')}>{s.status}</span>
                      <span className="badge badge-neutral">{s.provider}</span>
                    </div>
                    <div className="text-caption text-tertiary mt-1">
                      Versão {s.latestVersion ?? 1} • Atualizado {formatTimestamp(s.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => handleToggleSecret(s)}>
                      {s.status === 'active' ? 'Desativar' : 'Ativar'}
                    </button>
                    <button className="btn btn-ghost btn-icon text-error" onClick={() => handleDeleteSecret(s)} aria-label={`Excluir segredo ${s.name}`}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'skills' && (
          <div className="stack-lg">
            <form onSubmit={handleImportSkill} className="card flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <label htmlFor="skill-src" className="label">Importar Skill (URL Git / caminho)</label>
                <input id="skill-src" className="input-base" value={skillSource} onChange={(e) => setSkillSource(e.target.value)} placeholder="https://github.com/..." />
              </div>
              <button type="submit" className="btn btn-primary" disabled={!skillSource.trim()}>
                <Plus size={16} /> Importar Skill
              </button>
            </form>

            <div className="grid-cards">
              {skills.map((sk) => (
                <article key={sk.id} className="card stack-xs">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-body-sm">{sk.name}</strong>
                    <button className="btn btn-ghost btn-icon btn-sm text-error" onClick={() => handleDeleteSkill(sk)} aria-label={`Remover skill ${sk.name}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="text-caption text-mono text-tertiary">{sk.key}</div>
                  <p className="text-caption text-secondary text-truncate-3">{sk.description || 'Sem descrição'}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {tab === 'labels' && (
          <div className="stack-lg">
            <form onSubmit={handleCreateLabel} className="card flex items-end gap-3 flex-wrap">
              <div className="flex-1">
                <label htmlFor="lbl-name" className="label">Nome da Etiqueta *</label>
                <input id="lbl-name" className="input-base" value={lblName} onChange={(e) => setLblName(e.target.value)} placeholder="Ex: Urgente, Bug, Comercial" required />
              </div>
              <div>
                <label htmlFor="lbl-color" className="label">Cor</label>
                <input id="lbl-color" type="color" value={lblColor} onChange={(e) => setLblColor(e.target.value)} style={{ height: '44px', width: '64px', borderRadius: '8px', border: 'none' }} />
              </div>
              <button type="submit" className="btn btn-primary"><Plus size={16} /> Criar</button>
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              {labels.map((l) => (
                <span key={l.id} className="badge badge-neutral" style={{ padding: '6px 12px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: l.color }} />
                  {l.name}
                  <button
                    type="button"
                    onClick={() => handleDeleteLabel(l.id)}
                    aria-label={`Excluir etiqueta ${l.name}`}
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: '6px' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {tab === 'company' && (
          <div className="stack-lg">
            <form onSubmit={handleUpdateCompany} className="card stack-md">
              <h3 className="text-body" style={{ fontWeight: 600 }}>Dados da Empresa Atual</h3>
              <div>
                <label htmlFor="comp-name" className="label">Nome da Empresa</label>
                <input id="comp-name" className="input-base" value={compName} onChange={(e) => setCompName(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="comp-desc" className="label">Descrição</label>
                <textarea id="comp-desc" className="input-base" rows={2} value={compDesc} onChange={(e) => setCompDesc(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary btn-sm">Salvar Empresa</button>
              </div>
            </form>

            <form onSubmit={handleCreateCompany} className="card flex items-end gap-3 flex-wrap">
              <div className="flex-1">
                <label htmlFor="new-comp" className="label">Criar Nova Empresa</label>
                <input id="new-comp" className="input-base" value={newCompName} onChange={(e) => setNewCompName(e.target.value)} placeholder="Nome da nova empresa..." />
              </div>
              <button type="submit" className="btn btn-secondary"><Plus size={16} /> Criar Empresa</button>
            </form>

            <section className="card stack-sm" aria-labelledby="server-health-title">
              <h3 id="server-health-title" className="text-body flex items-center gap-2" style={{ fontWeight: 600 }}>
                <Server size={16} aria-hidden="true" /> Status do Servidor Paperclip
              </h3>
              <div className="text-caption text-secondary">
                Versão: <strong>{health?.serverVersion || health?.version || 'N/A'}</strong> • Modo: {health?.deploymentMode || 'N/A'} • Status: <span className="badge badge-success">{health?.status || 'ok'}</span>
              </div>
              {instanceSettings && (
                <pre className="log-console" style={{ maxHeight: '220px' }}>
                  {JSON.stringify(instanceSettings, null, 2)}
                </pre>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
