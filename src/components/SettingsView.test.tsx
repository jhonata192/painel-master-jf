import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ToastProvider } from '../context/ToastContext'
import { SettingsView } from './SettingsView'

describe('SettingsView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders AI connections when routing.models contains { id, label } objects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/ai-connections')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              connections: [
                {
                  id: 'conn-1',
                  provider: 'openai',
                  method: 'api_key',
                  name: 'NVIDIA NIM (proxy 30 RPM)',
                  status: 'connected',
                  usageProbeSupported: false,
                  routing: {
                    kind: 'gateway',
                    protocol: 'chat',
                    baseUrl: 'http://127.0.0.1:4010/v1',
                    models: [
                      {
                        id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
                        label: 'Nemotron Lightning 30B (rápido)',
                      },
                    ],
                  },
                },
              ],
            }),
          })
        }
        if (url.includes('/health')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'ok' }) })
        }
        if (url.includes('/instance/settings')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({}) })
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      })
    )

    render(
      <ToastProvider>
        <SettingsView
          company={{ id: 'c-1', name: 'Master JF' }}
          onCompanyUpdated={vi.fn()}
        />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('NVIDIA NIM (proxy 30 RPM)')).toBeInTheDocument()
      expect(screen.getByText('Nemotron Lightning 30B (rápido)')).toBeInTheDocument()
    })
  })

  it('allows switching between companies and switches to a newly created company', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/companies' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 'c-3', name: 'Empresa Nova' }),
        })
      }
      if (url.includes('/ai-connections')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ connections: [] }) })
      }
      if (url.includes('/health')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'ok' }) })
      }
      if (url.includes('/instance/settings')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const onSwitchCompany = vi.fn()
    const onCompanyUpdated = vi.fn().mockResolvedValue(undefined)

    render(
      <ToastProvider>
        <SettingsView
          company={{ id: 'c-1', name: 'Master JF' }}
          companies={[
            { id: 'c-1', name: 'Master JF' },
            { id: 'c-2', name: 'Filial Sul' },
          ]}
          onSwitchCompany={onSwitchCompany}
          onCompanyUpdated={onCompanyUpdated}
        />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('tab', { name: /Empresa/i }))

    await waitFor(() => {
      expect(screen.getByText('Alternar Empresa (2)')).toBeInTheDocument()
      expect(screen.queryByLabelText('Criar Nova Empresa')).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('tab', { name: /Contas & Acessos/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Alternar' }))
    expect(onSwitchCompany).toHaveBeenCalledWith('c-2')
  })

  it('allows instance admin to create company-scoped accounts and edit user company access', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/companies' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ id: 'c-3', name: 'Empresa Nova' }),
        })
      }
      if (url.startsWith('/api/admin/users?') || url === '/api/admin/users') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 'u-1',
              name: 'Jhonata Admin',
              email: 'fjhonata14@gmail.com',
              isInstanceAdmin: true,
              activeCompanyMembershipCount: 2,
            },
            {
              id: 'u-2',
              name: 'Cliente Sul',
              email: 'cliente@sul.com',
              isInstanceAdmin: false,
              activeCompanyMembershipCount: 1,
            },
          ],
        })
      }
      if (url === '/api/auth/sign-up/email' && init?.method === 'POST') {
        expect(init.credentials).toBe('omit')
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ user: { id: 'u-3', email: 'novo@cliente.com', name: 'Novo Cliente' } }),
        })
      }
      if (url === '/api/admin/users/u-3/company-access' && init?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            user: { id: 'u-3', email: 'novo@cliente.com', name: 'Novo Cliente', isInstanceAdmin: false },
            companyAccess: [],
          }),
        })
      }
      if (url === '/api/admin/users/u-2/company-access' && !init?.method) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            user: { id: 'u-2', email: 'cliente@sul.com', name: 'Cliente Sul', isInstanceAdmin: false },
            companyAccess: [
              {
                id: 'm-1',
                companyId: 'c-2',
                principalType: 'user',
                principalId: 'u-2',
                status: 'active',
                membershipRole: 'operator',
                companyName: 'Filial Sul',
                companyStatus: 'active',
                grants: [{ permissionKey: 'agents:read', scope: null }],
              },
            ],
          }),
        })
      }
      if (url === '/api/admin/users/u-2' && init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            user: { id: 'u-2', email: 'cliente@sul.com', name: 'Cliente Sul Editado', isInstanceAdmin: false },
            companyAccess: [],
          }),
        })
      }
      if (url.includes('/ai-connections')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ connections: [] }) })
      }
      if (url.includes('/health')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'ok' }) })
      }
      if (url.includes('/instance/settings')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const onSwitchCompany = vi.fn()
    const onCompanyUpdated = vi.fn().mockResolvedValue(undefined)

    render(
      <ToastProvider>
        <SettingsView
          company={{ id: 'c-1', name: 'Master JF' }}
          companies={[
            { id: 'c-1', name: 'Master JF' },
            { id: 'c-2', name: 'Filial Sul' },
          ]}
          isInstanceAdmin
          currentUserId="u-1"
          onSwitchCompany={onSwitchCompany}
          onCompanyUpdated={onCompanyUpdated}
        />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('tab', { name: /Empresa/i }))
    fireEvent.change(screen.getByLabelText('Criar Nova Empresa'), { target: { value: 'Empresa Nova' } })
    fireEvent.click(screen.getByRole('button', { name: /Criar Empresa/i }))

    await waitFor(() => {
      expect(onCompanyUpdated).toHaveBeenCalled()
      expect(onSwitchCompany).toHaveBeenCalledWith('c-3')
    })

    fireEvent.click(screen.getByRole('tab', { name: /Contas & Acessos/i }))

    await waitFor(() => {
      expect(screen.getByText('Cliente Sul')).toBeInTheDocument()
      expect(screen.getByText('Admin Principal')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Novo Cliente' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'novo@cliente.com' } })
    fireEvent.change(screen.getByLabelText(/Senha inicial/i), { target: { value: 'SenhaForte123' } })
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/users/u-3/company-access',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ companyIds: ['c-1'] }),
        })
      )
    })

    const manageButtons = screen.getAllByRole('button', { name: /Editar Conta & Permissões/i })
    fireEvent.click(manageButtons[1])

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Salvar Conta' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Papel em Filial Sul'), { target: { value: 'admin' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Criar agentes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Conta' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/users/u-2',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"membershipRole":"admin"'),
        })
      )
    })
  })

  it('creates an NVIDIA NIM proxy AI connection from the AI Connections tab', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/companies/c-9/ai-connections' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ connectionId: 'conn-new', grantId: 'grant-new' }),
        })
      }
      if (url === '/api/companies/c-9/ai-connections') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ canManageConnections: true, connections: [] }),
        })
      }
      if (url.includes('/health')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'ok' }) })
      }
      if (url.includes('/instance/settings')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ToastProvider>
        <SettingsView
          company={{ id: 'c-9', name: 'Aurora Security' }}
          onCompanyUpdated={vi.fn()}
        />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Adicionar Conexão de IA')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/API Key/i), { target: { value: 'nvapi-secret-key' } })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Conexão/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/companies/c-9/ai-connections',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            provider: 'openai',
            method: 'api_key',
            name: 'NVIDIA NIM (proxy)',
            ownership: 'shared',
            apiKey: 'nvapi-secret-key',
            agentIds: [],
            allAgents: true,
            routing: {
              kind: 'gateway',
              protocol: 'chat',
              baseUrl: 'http://127.0.0.1:4010/v1',
              auth: 'bearer',
              models: [{ id: 'minimaxai/minimax-m3.1-flash' }],
            },
          }),
        })
      )
    })
  })

  it('creates a Kilo Code Auto Router Free connection and edits/deletes connections', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    let storedConnections = [
      {
        id: 'conn-kilo',
        grantId: 'grant-kilo',
        provider: 'openai',
        method: 'api_key',
        name: 'Kilo Inicial',
        ownership: 'shared',
        status: 'connected',
        routing: {
          kind: 'gateway',
          protocol: 'chat',
          auth: 'none',
          baseUrl: 'https://ai-gateway.kilo.ai/api/v1',
          models: [{ id: 'kilo-auto/free' }],
        },
      },
    ]
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/companies/c-9/ai-connections' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ connectionId: 'conn-new', grantId: 'grant-new' }),
        })
      }
      if (url === '/api/companies/c-9/ai-connections/conn-kilo' && init?.method === 'PATCH') {
        storedConnections = [{ ...storedConnections[0], name: 'Kilo Editado' }]
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ connectionId: 'conn-kilo', grantId: 'grant-kilo' }),
        })
      }
      if (url === '/api/companies/c-9/ai-connections/conn-kilo' && init?.method === 'DELETE') {
        storedConnections = []
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
      }
      if (url === '/api/companies/c-9/ai-connections') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ canManageConnections: true, connections: storedConnections }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ToastProvider>
        <SettingsView company={{ id: 'c-9', name: 'Aurora Security' }} onCompanyUpdated={vi.fn()} />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Kilo Inicial')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Provedor / Tipo'), { target: { value: 'kilo_free' } })
    fireEvent.click(screen.getByRole('button', { name: /Adicionar Conexão/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/companies/c-9/ai-connections',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            provider: 'openai',
            method: 'api_key',
            name: 'Kilo Code Auto Router (Free)',
            ownership: 'shared',
            agentIds: [],
            allAgents: true,
            routing: {
              kind: 'gateway',
              protocol: 'chat',
              baseUrl: 'https://ai-gateway.kilo.ai/api/v1',
              auth: 'none',
              models: [{ id: 'kilo-auto/free' }],
            },
          }),
        })
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByDisplayValue('Kilo Inicial'), { target: { value: 'Kilo Editado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Conexão' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/companies/c-9/ai-connections/conn-kilo',
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/companies/c-9/ai-connections/conn-kilo',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })
})
