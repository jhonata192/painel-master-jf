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
  Users,
  Shield,
} from 'lucide-react'
import { cn, formatTimestamp } from '../lib/utils'
import { api } from '../lib/api'
import { useToastHelpers } from '../context/ToastContext'
import type {
  AdminUser,
  AiConnection,
  Company,
  CompanySecret,
  CompanySkill,
  HealthStatus,
  IssueLabel,
} from '../types/api'

interface SettingsViewProps {
  company: Company
  companies?: Company[]
  isInstanceAdmin?: boolean
  currentUserId?: string
  onSwitchCompany?: (companyId: string) => void
  onCompanyUpdated: () => Promise<void> | void
}

type SettingsTab = 'ai' | 'secrets' | 'skills' | 'labels' | 'company' | 'accounts'

export function SettingsView({
  company,
  companies = [],
  isInstanceAdmin = false,
  currentUserId,
  onSwitchCompany,
  onCompanyUpdated,
}: SettingsViewProps) {
  const { success, error: showError } = useToastHelpers()
  const [tab, setTab] = useState<SettingsTab>('ai')

  // AI Connections
  const [connections, setConnections] = useState<AiConnection[]>([])
  const [canManageConnections, setCanManageConnections] = useState(true)
  const [probeResult, setProbeResult] = useState<Record<string, unknown> | null>(null)
  const [aiPreset, setAiPreset] = useState('nvidia_nim_proxy')
  const [aiName, setAiName] = useState('NVIDIA NIM (proxy)')
  const [aiBaseUrl, setAiBaseUrl] = useState('http://127.0.0.1:4010/v1')
  const [aiModelsText, setAiModelsText] = useState('minimaxai/minimax-m3.1-flash')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiOwnership, setAiOwnership] = useState<'shared' | 'personal'>('shared')
  const [aiAllAgents, setAiAllAgents] = useState(true)
  const [creatingConnection, setCreatingConnection] = useState(false)

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

  // Admin Accounts & Company Access
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [accName, setAccName] = useState('')
  const [accEmail, setAccEmail] = useState('')
  const [accPassword, setAccPassword] = useState('')
  const [accCompanyIds, setAccCompanyIds] = useState<string[]>(() => (company.id ? [company.id] : []))
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editingCompanyIds, setEditingCompanyIds] = useState<string[]>([])
  const [savingAccess, setSavingAccess] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const [ai, sec, sk, lb, h, inst, usersList] = await Promise.all([
        api.listAiConnections(company.id).catch(() => ({ connections: [] })),
        api.listSecrets(company.id).catch(() => []),
        api.listSkills(company.id).catch(() => []),
        api.listLabels(company.id).catch(() => []),
        api.getHealth().catch(() => null),
        api.getInstanceSettings().catch(() => null),
        isInstanceAdmin ? api.listAdminUsers(userQuery).catch(() => []) : Promise.resolve([]),
      ])
      setConnections(ai.connections ?? [])
      setCanManageConnections((ai as { canManageConnections?: boolean }).canManageConnections !== false)
      setSecrets(sec)
      setSkills(sk)
      setLabels(lb)
      setHealth(h)
      setInstanceSettings(inst)
      if (isInstanceAdmin) setAdminUsers(usersList)
    } catch {
      // ignore
    }
  }, [company.id, isInstanceAdmin, userQuery])

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

  const applyAiPreset = (preset: string) => {
    setAiPreset(preset)
    if (preset === 'nvidia_nim_proxy') {
      setAiName('NVIDIA NIM (proxy)')
      setAiBaseUrl('http://127.0.0.1:4010/v1')
      setAiModelsText('minimaxai/minimax-m3.1-flash')
    } else if (preset === 'openai_gateway') {
      setAiName('Gateway OpenAI-Compatível')
      setAiBaseUrl('https://')
      setAiModelsText('')
    } else {
      const labels: Record<string, string> = {
        openai: 'OpenAI',
        anthropic: 'Claude (Anthropic)',
        google: 'Google Gemini',
        openrouter: 'OpenRouter',
        xai: 'Grok (xAI)',
        github: 'GitHub Copilot',
      }
      setAiName(labels[preset] ?? preset)
      setAiBaseUrl('')
      setAiModelsText('')
    }
  }

  const isGatewayPreset = aiPreset === 'nvidia_nim_proxy' || aiPreset === 'openai_gateway'

  const handleCreateAiConnection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiName.trim() || !aiApiKey.trim()) {
      showError('Dados incompletos', 'Informe o nome da conexão e a API key.')
      return
    }

    const models = aiModelsText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((id) => ({ id }))

    const payload: Record<string, unknown> = {
      provider: isGatewayPreset ? 'openai' : aiPreset,
      method: 'api_key',
      name: aiName.trim(),
      ownership: aiOwnership,
      apiKey: aiApiKey.trim(),
      agentIds: [],
      allAgents: aiAllAgents,
    }

    if (isGatewayPreset) {
      if (!aiBaseUrl.trim()) {
        showError('URL base obrigatória', 'Informe a URL base do endpoint /v1.')
        return
      }
      let isLoopback = false
      try {
        const parsed = new URL(aiBaseUrl.trim())
        isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
      } catch {
        showError('URL inválida', 'Informe uma URL válida (https://... ou http://127.0.0.1:4010/v1).')
        return
      }
      payload.routing = {
        kind: isLoopback && aiPreset === 'openai_gateway' ? 'local' : 'gateway',
        protocol: 'chat',
        baseUrl: aiBaseUrl.trim(),
        auth: 'bearer',
        models,
      }
    }

    setCreatingConnection(true)
    try {
      await api.createAiConnection(company.id, payload)
      setAiApiKey('')
      success('Conexão de IA adicionada')
      const updated = await api.listAiConnections(company.id)
      setConnections(updated.connections ?? [])
    } catch (err) {
      showError('Erro ao adicionar conexão', err instanceof Error ? err.message : 'Falha')
    } finally {
      setCreatingConnection(false)
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
      const created = await api.createCompany({ name: newCompName.trim() })
      setNewCompName('')
      await onCompanyUpdated()
      if (created?.id && onSwitchCompany) {
        onSwitchCompany(created.id)
      }
      success('Nova empresa criada')
    } catch (err) {
      showError('Erro ao criar empresa', err instanceof Error ? err.message : 'Falha')
    }
  }

  const availableCompanies = companies.length > 0 ? companies : [company]

  const toggleCompanySelection = (list: string[], id: string) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id]

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accName.trim() || !accEmail.trim() || accPassword.length < 8) {
      showError('Dados inválidos', 'Informe nome, e-mail válido e senha com pelo menos 8 caracteres.')
      return
    }
    if (accCompanyIds.length === 0) {
      showError('Selecione uma empresa', 'Atribua pelo menos uma empresa para a nova conta.')
      return
    }
    setCreatingAccount(true)
    try {
      await api.createCompanyAccount({
        name: accName.trim(),
        email: accEmail.trim(),
        password: accPassword,
        companyIds: accCompanyIds,
      })
      setAccName('')
      setAccEmail('')
      setAccPassword('')
      success('Conta criada e vinculada à(s) empresa(s)')
      setAdminUsers(await api.listAdminUsers(userQuery).catch(() => []))
    } catch (err) {
      showError('Erro ao criar conta', err instanceof Error ? err.message : 'Falha')
      setAdminUsers(await api.listAdminUsers(userQuery).catch(() => []))
    } finally {
      setCreatingAccount(false)
    }
  }

  const handleOpenEditAccess = async (userId: string) => {
    if (editingUserId === userId) {
      setEditingUserId(null)
      return
    }
    try {
      const access = await api.getUserCompanyAccess(userId)
      const activeIds = access.companyAccess
        .filter((item) => item.status === 'active')
        .map((item) => item.companyId)
      setEditingCompanyIds(activeIds)
      setEditingUserId(userId)
    } catch (err) {
      showError('Erro ao carregar empresas da conta', err instanceof Error ? err.message : 'Falha')
    }
  }

  const handleSaveUserAccess = async (userId: string) => {
    setSavingAccess(true)
    try {
      await api.setUserCompanyAccess(userId, editingCompanyIds)
      success('Acesso às empresas atualizado')
      setEditingUserId(null)
      setAdminUsers(await api.listAdminUsers(userQuery).catch(() => []))
      if (userId === currentUserId) {
        await onCompanyUpdated()
      }
    } catch (err) {
      showError('Erro ao atualizar acessos', err instanceof Error ? err.message : 'Falha')
    } finally {
      setSavingAccess(false)
    }
  }

  const handleToggleAdmin = async (user: AdminUser) => {
    if (user.id === currentUserId && user.isInstanceAdmin) return
    try {
      if (user.isInstanceAdmin) {
        await api.demoteInstanceAdmin(user.id)
        success(`Privilégio de admin removido de ${user.name || user.email}`)
      } else {
        await api.promoteInstanceAdmin(user.id)
        success(`${user.name || user.email} promovido a admin global`)
      }
      setAdminUsers(await api.listAdminUsers(userQuery).catch(() => []))
    } catch (err) {
      showError('Erro ao alterar papel global', err instanceof Error ? err.message : 'Falha')
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
          {isInstanceAdmin && (
            <button role="tab" className={cn('tab', tab === 'accounts' && 'active')} aria-selected={tab === 'accounts'} onClick={() => setTab('accounts')}>
              <Users size={14} /> Contas & Acessos ({adminUsers.length})
            </button>
          )}
        </div>
      </div>

      <div className="view-body stack-lg">
        {tab === 'ai' && (
          <div className="stack-lg">
            {canManageConnections && (
              <form onSubmit={handleCreateAiConnection} className="card stack-md" aria-labelledby="add-ai-connection-title">
                <h3 id="add-ai-connection-title" className="text-body flex items-center gap-2" style={{ fontWeight: 600 }}>
                  <Plus size={16} aria-hidden="true" /> Adicionar Conexão de IA
                </h3>

                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                  <div>
                    <label htmlFor="ai-preset" className="label">Provedor / Tipo</label>
                    <select
                      id="ai-preset"
                      className="input-base"
                      value={aiPreset}
                      onChange={(e) => applyAiPreset(e.target.value)}
                    >
                      <option value="nvidia_nim_proxy">NVIDIA NIM (Proxy local /v1)</option>
                      <option value="openai_gateway">Gateway OpenAI-Compatível</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Claude (Anthropic)</option>
                      <option value="google">Google (Gemini)</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="xai">Grok (xAI)</option>
                      <option value="github">GitHub Copilot</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="ai-conn-name" className="label">Nome da Conexão *</label>
                    <input
                      id="ai-conn-name"
                      className="input-base"
                      value={aiName}
                      onChange={(e) => setAiName(e.target.value)}
                      placeholder="Ex.: NVIDIA NIM (proxy)"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="ai-api-key" className="label">API Key *</label>
                    <input
                      id="ai-api-key"
                      type="password"
                      className="input-base text-mono"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder={aiPreset === 'nvidia_nim_proxy' ? 'nvapi-...' : 'Cole a chave de API...'}
                      required
                    />
                  </div>
                </div>

                {isGatewayPreset && (
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    <div>
                      <label htmlFor="ai-base-url" className="label">URL Base (/v1) *</label>
                      <input
                        id="ai-base-url"
                        className="input-base text-mono"
                        value={aiBaseUrl}
                        onChange={(e) => setAiBaseUrl(e.target.value)}
                        placeholder="http://127.0.0.1:4010/v1"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="ai-models" className="label">Modelos (separados por vírgula)</label>
                      <input
                        id="ai-models"
                        className="input-base text-mono"
                        value={aiModelsText}
                        onChange={(e) => setAiModelsText(e.target.value)}
                        placeholder="minimaxai/minimax-m3.1-flash"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-body-sm">
                      <span>Escopo:</span>
                      <select
                        aria-label="Escopo da conexão"
                        className="input-base"
                        style={{ width: 'auto' }}
                        value={aiOwnership}
                        onChange={(e) => setAiOwnership(e.target.value as 'shared' | 'personal')}
                      >
                        <option value="shared">Compartilhada na empresa</option>
                        <option value="personal">Pessoal</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-body-sm" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={aiAllAgents}
                        onChange={(e) => setAiAllAgents(e.target.checked)}
                      />
                      <span>Liberar para todos os agentes</span>
                    </label>
                  </div>

                  <button type="submit" className="btn btn-primary btn-sm" disabled={creatingConnection}>
                    <Plus size={15} aria-hidden="true" />
                    {creatingConnection ? 'Adicionando...' : 'Adicionar Conexão'}
                  </button>
                </div>
              </form>
            )}

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
            <section className="card stack-md" aria-labelledby="switch-company-title">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 id="switch-company-title" className="text-body flex items-center gap-2" style={{ fontWeight: 600 }}>
                  <Building2 size={16} aria-hidden="true" /> Alternar Empresa ({availableCompanies.length})
                </h3>
                {availableCompanies.length > 1 && onSwitchCompany && (
                  <select
                    aria-label="Alternar empresa ativa"
                    className="input-base"
                    style={{ width: 'auto', minWidth: '220px' }}
                    value={company.id}
                    onChange={(e) => {
                      const nextId = e.target.value
                      const target = availableCompanies.find((c) => c.id === nextId)
                      onSwitchCompany(nextId)
                      if (target) success(`Empresa alterada para ${target.name}`)
                    }}
                  >
                    {availableCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="stack-sm">
                {availableCompanies.map((c) => {
                  const isActive = c.id === company.id
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 flex-wrap"
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border-default)',
                        backgroundColor: isActive ? 'var(--color-bg-surface-elevated)' : 'transparent',
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-body-sm" style={{ fontWeight: 600 }}>{c.name}</div>
                        {c.description && <div className="text-caption text-secondary">{c.description}</div>}
                      </div>
                      {isActive ? (
                        <span className="badge badge-success">Ativa</span>
                      ) : onSwitchCompany ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            onSwitchCompany(c.id)
                            success(`Empresa alterada para ${c.name}`)
                          }}
                        >
                          Alternar
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>

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

            {isInstanceAdmin && (
              <form onSubmit={handleCreateCompany} className="card flex items-end gap-3 flex-wrap">
                <div className="flex-1">
                  <label htmlFor="new-comp" className="label">Criar Nova Empresa</label>
                  <input id="new-comp" className="input-base" value={newCompName} onChange={(e) => setNewCompName(e.target.value)} placeholder="Nome da nova empresa..." />
                </div>
                <button type="submit" className="btn btn-secondary"><Plus size={16} /> Criar Empresa</button>
              </form>
            )}

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

        {tab === 'accounts' && isInstanceAdmin && (
          <div className="stack-lg">
            <form onSubmit={handleCreateAccount} className="card stack-md" aria-labelledby="create-account-title">
              <h3 id="create-account-title" className="text-body flex items-center gap-2" style={{ fontWeight: 600 }}>
                <Users size={16} aria-hidden="true" /> Criar Nova Conta de Usuário
              </h3>
              <p className="text-caption text-secondary">
                Somente administradores podem criar contas e definir exatamente quais empresas cada conta acessa.
              </p>

              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div>
                  <label htmlFor="acc-name" className="label">Nome</label>
                  <input
                    id="acc-name"
                    className="input-base"
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="Ex.: Maria Cliente"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="acc-email" className="label">E-mail</label>
                  <input
                    id="acc-email"
                    type="email"
                    className="input-base"
                    value={accEmail}
                    onChange={(e) => setAccEmail(e.target.value)}
                    placeholder="maria@empresa.com.br"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="acc-password" className="label">Senha inicial (mín. 8 caracteres)</label>
                  <input
                    id="acc-password"
                    type="password"
                    minLength={8}
                    className="input-base"
                    value={accPassword}
                    onChange={(e) => setAccPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="stack-xs">
                <span className="label">Empresas permitidas para esta conta</span>
                <div className="flex flex-wrap gap-3">
                  {availableCompanies.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-body-sm" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={accCompanyIds.includes(c.id)}
                        onChange={() => setAccCompanyIds((prev) => toggleCompanySelection(prev, c.id))}
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary btn-sm" disabled={creatingAccount}>
                  <Plus size={15} aria-hidden="true" />
                  {creatingAccount ? 'Criando conta...' : 'Criar Conta'}
                </button>
              </div>
            </form>

            <section className="card stack-md" aria-labelledby="users-list-title">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 id="users-list-title" className="text-body flex items-center gap-2" style={{ fontWeight: 600 }}>
                  <Shield size={16} aria-hidden="true" /> Contas Cadastradas ({adminUsers.length})
                </h3>
                <input
                  type="search"
                  className="input-base"
                  style={{ width: 'auto', minWidth: '220px' }}
                  placeholder="Filtrar por nome ou e-mail..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  aria-label="Filtrar contas cadastradas"
                />
              </div>

              {adminUsers.length === 0 ? (
                <p className="text-body-sm text-tertiary">Nenhuma conta encontrada.</p>
              ) : (
                <div className="stack-sm">
                  {adminUsers.map((u) => {
                    const isEditing = editingUserId === u.id
                    return (
                      <div
                        key={u.id}
                        className="stack-sm"
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border-default)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-body-sm">{u.name || u.email || u.id}</strong>
                              <span className={cn('badge', u.isInstanceAdmin ? 'badge-brand' : 'badge-neutral')}>
                                {u.isInstanceAdmin ? 'Admin Global' : 'Usuário de Empresa'}
                              </span>
                              <span className="badge badge-neutral">
                                {u.activeCompanyMembershipCount}{' '}
                                {u.activeCompanyMembershipCount === 1 ? 'empresa' : 'empresas'}
                              </span>
                            </div>
                            {u.email && <div className="text-caption text-secondary">{u.email}</div>}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenEditAccess(u.id)}
                            >
                              {isEditing ? 'Fechar Empresas' : 'Gerenciar Empresas'}
                            </button>
                            {!(u.id === currentUserId && u.isInstanceAdmin) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleToggleAdmin(u)}
                              >
                                {u.isInstanceAdmin ? 'Remover Admin' : 'Tornar Admin'}
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div
                            className="stack-sm"
                            style={{
                              paddingTop: '10px',
                              borderTop: '1px solid var(--color-border-subtle)',
                            }}
                          >
                            <div className="text-caption text-secondary">
                              Selecione as empresas que esta conta pode acessar:
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {availableCompanies.map((c) => (
                                <label
                                  key={c.id}
                                  className="flex items-center gap-2 text-body-sm"
                                  style={{ cursor: 'pointer' }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={editingCompanyIds.includes(c.id)}
                                    onChange={() =>
                                      setEditingCompanyIds((prev) => toggleCompanySelection(prev, c.id))
                                    }
                                  />
                                  <span>{c.name}</span>
                                </label>
                              ))}
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={savingAccess}
                                onClick={() => handleSaveUserAccess(u.id)}
                              >
                                {savingAccess ? 'Salvando...' : 'Salvar Empresas'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
