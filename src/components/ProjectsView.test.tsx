import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ToastProvider } from '../context/ToastContext'
import { ProjectsView } from './ProjectsView'

describe('ProjectsView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads projects and goals only once on mount and creates a project with Paperclip options (env, repos, color, visibility)', async () => {
    let projectsCalls = 0
    let goalsCalls = 0
    let createCalls = 0
    let lastCreatePayload: Record<string, unknown> | null = null

    const createdProject = {
      id: 'proj-1',
      companyId: 'comp-1',
      name: 'Projeto Teste',
      description: 'Descrição teste',
      status: 'planned',
      visibility: 'private',
      color: '#22c55e',
      leadAgentId: null,
      goalId: null,
      workspaces: [
        {
          id: 'ws-1',
          projectId: 'proj-1',
          name: 'jhonata192/painel-master-jf',
          repoUrl: 'https://github.com/jhonata192/painel-master-jf',
        },
      ],
      createdAt: '2026-11-25T12:00:00Z',
      updatedAt: '2026-11-25T12:00:00Z',
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/projects') && (!init?.method || init.method === 'GET')) {
          projectsCalls += 1
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => (createCalls > 0 ? [createdProject] : []),
          })
        }
        if (url.endsWith('/goals') && (!init?.method || init.method === 'GET')) {
          goalsCalls += 1
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [],
          })
        }
        if (url.endsWith('/project-environments')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              groups: [
                {
                  storageProviderPluginId: null,
                  environments: [{ id: 'env-local', name: 'Local' }],
                },
              ],
              defaultEnvironmentId: 'env-local',
              error: null,
            }),
          })
        }
        if (url.endsWith('/project-repositories')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              repositories: [
                {
                  id: '1470559908',
                  fullName: 'jhonata192/painel-master-jf',
                  url: 'https://github.com/jhonata192/painel-master-jf',
                  private: false,
                  connections: ['GitHub'],
                },
                {
                  id: '1436265128',
                  fullName: 'jhonata192/jarvis-ai',
                  url: 'https://github.com/jhonata192/jarvis-ai',
                  private: true,
                  connections: ['GitHub'],
                },
              ],
              connectionCount: 1,
              failedConnectionCount: 0,
            }),
          })
        }
        if (url.endsWith('/projects') && init?.method === 'POST') {
          createCalls += 1
          lastCreatePayload = JSON.parse(String(init.body || '{}'))
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => createdProject,
          })
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      })
    )

    render(
      <ToastProvider>
        <ProjectsView companyId="comp-1" agents={[]} />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Nenhum projeto cadastrado')).toBeInTheDocument()
    })

    await new Promise((r) => setTimeout(r, 50))
    expect(projectsCalls).toBe(1)
    expect(goalsCalls).toBe(1)
    expect(screen.queryByText('Erro ao carregar dados')).not.toBeInTheDocument()

    // Open "Novo Projeto" modal
    fireEvent.click(screen.getByRole('button', { name: /Novo Projeto/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Local')).toBeInTheDocument()
      expect(screen.getByText('jhonata192/painel-master-jf')).toBeInTheDocument()
    })

    // Filter and select GitHub repo
    fireEvent.change(screen.getByPlaceholderText(/Buscar entre 2 repositórios/i), {
      target: { value: 'painel' },
    })
    expect(screen.queryByText('jhonata192/jarvis-ai')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: /jhonata192\/painel-master-jf/i }))

    // Fill name, description, visibility, color
    fireEvent.change(screen.getByLabelText(/Nome \*/i), { target: { value: 'Projeto Teste' } })
    fireEvent.change(screen.getByLabelText(/Descrição/i), { target: { value: 'Descrição teste' } })
    fireEvent.change(screen.getByLabelText(/Visibilidade/i), { target: { value: 'private' } })
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar cor #22c55e' }))

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(createCalls).toBe(1)
      expect(screen.getByText('Projeto criado')).toBeInTheDocument()
      expect(screen.getByText('Projeto Teste')).toBeInTheDocument()
    })

    expect(lastCreatePayload).toMatchObject({
      name: 'Projeto Teste',
      description: 'Descrição teste',
      status: 'planned',
      visibility: 'private',
      color: '#22c55e',
      environmentId: 'env-local',
      expectedStorageProviderPluginId: null,
      repositoryIds: ['1470559908'],
    })
    expect(projectsCalls).toBe(2)
    expect(goalsCalls).toBe(2)
  })

  it('allows selecting connected GitHub repositories directly inside the Workspaces modal', async () => {
    let putRepoPayload: { repositoryIds: string[] } | null = null
    const existingProject = {
      id: 'proj-1',
      companyId: 'comp-1',
      name: 'acessilia gestor',
      status: 'planned',
      workspaces: [],
      createdAt: '2026-11-25T12:00:00Z',
      updatedAt: '2026-11-25T12:00:00Z',
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith('/projects') && (!init?.method || init.method === 'GET')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => [existingProject] })
        }
        if (url.endsWith('/goals') && (!init?.method || init.method === 'GET')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => [] })
        }
        if (url.includes('/workspaces') && (!init?.method || init.method === 'GET')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () =>
              putRepoPayload
                ? [
                    {
                      id: 'ws-gh-1',
                      projectId: 'proj-1',
                      name: 'A11yDevs/acessilia',
                      repoUrl: 'https://github.com/A11yDevs/acessilia',
                      metadata: { githubRepositoryId: '1238969852' },
                    },
                  ]
                : [],
          })
        }
        if (url.endsWith('/project-repositories')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              repositories: [
                {
                  id: '1238969852',
                  fullName: 'A11yDevs/acessilia',
                  url: 'https://github.com/A11yDevs/acessilia',
                  private: false,
                  connections: ['GitHub'],
                },
              ],
              connectionCount: 1,
              failedConnectionCount: 0,
            }),
          })
        }
        if (url.includes('/projects/proj-1/repositories') && init?.method === 'PUT') {
          putRepoPayload = JSON.parse(String(init.body || '{}'))
          return Promise.resolve({ ok: true, status: 200, json: async () => existingProject })
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      })
    )

    render(
      <ToastProvider>
        <ProjectsView companyId="comp-1" agents={[]} />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('acessilia gestor')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Workspaces/i }))
    await waitFor(() => {
      expect(screen.getByText('A11yDevs/acessilia')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('option', { name: /A11yDevs\/acessilia/i }))
    fireEvent.click(screen.getByRole('button', { name: /Salvar repositórios GitHub/i }))

    await waitFor(() => {
      expect(putRepoPayload).toEqual({ repositoryIds: ['1238969852'] })
      expect(screen.getByText('Repositórios GitHub atualizados')).toBeInTheDocument()
    })
  })
})
