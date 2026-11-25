import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ToastProvider } from '../context/ToastContext'
import { ProjectsView } from './ProjectsView'

describe('ProjectsView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads projects and goals only once on mount without infinite refetch loop and creates a project', async () => {
    let projectsCalls = 0
    let goalsCalls = 0
    let createCalls = 0

    const createdProject = {
      id: 'proj-1',
      name: 'Projeto Teste',
      description: 'Descrição teste',
      status: 'planned',
      leadAgentId: null,
      goalId: null,
      workspaces: [],
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
        if (url.endsWith('/projects') && init?.method === 'POST') {
          createCalls += 1
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

    // Give React an extra tick to ensure no loop is triggered after initial load
    await new Promise((r) => setTimeout(r, 50))
    expect(projectsCalls).toBe(1)
    expect(goalsCalls).toBe(1)
    expect(screen.queryByText('Erro ao carregar dados')).not.toBeInTheDocument()

    // Open "Novo Projeto" modal and create a project
    fireEvent.click(screen.getByRole('button', { name: /Novo Projeto/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByText('Erro ao carregar dados')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Nome \*/i), { target: { value: 'Projeto Teste' } })
    fireEvent.change(screen.getByLabelText(/Descrição/i), { target: { value: 'Descrição teste' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(createCalls).toBe(1)
      expect(screen.getByText('Projeto criado')).toBeInTheDocument()
      expect(screen.getByText('Projeto Teste')).toBeInTheDocument()
    })

    expect(projectsCalls).toBe(2)
    expect(goalsCalls).toBe(2)
  })
})
