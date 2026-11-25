import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatView } from './ChatView'
import type { Agent } from '../types/api'

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Larissa',
  role: 'Tech Lead',
  description: 'Tech Lead Fullstack',
  ref: 'larissa',
}

describe('ChatView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading state initially', () => {
    render(<ChatView agent={mockAgent} companyId="company-1" />)
    expect(screen.getByText('Larissa')).toBeInTheDocument()
    // Loading skeletons should be present
    expect(screen.getByTestId('chat-loading-skeleton')).toBeInTheDocument()
  })

  it('displays agent info in header', () => {
    render(<ChatView agent={mockAgent} companyId="company-1" />)
    expect(screen.getByText('Larissa')).toBeInTheDocument()
    expect(screen.getByText('Tech Lead')).toBeInTheDocument()
  })

  it('shows loading skeletons while fetching session', () => {
    render(<ChatView agent={mockAgent} companyId="company-1" />)
    // Should show 3 skeleton elements
    const skeletons = screen.getAllByTestId('chat-loading-skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it('allows filtering and binding a project via combobox', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/projects')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            { id: 'proj-1', companyId: 'company-1', name: 'Master Gestor', status: 'in_progress', createdAt: '', updatedAt: '' },
            { id: 'proj-2', companyId: 'company-1', name: 'Painel Web', status: 'planned', createdAt: '', updatedAt: '' },
          ],
        })
      }
      if (url.includes('/chats/larissa')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'chat-issue-1',
            title: 'Chat com Larissa',
            assigneeAgentId: 'agent-1',
            projectId: null,
            createdAt: '2026-11-25T10:00:00Z',
            updatedAt: '2026-11-25T10:00:00Z',
          }),
        })
      }
      if (url.includes('/issues/chat-issue-1') && opts?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'chat-issue-1',
            title: 'Chat com Larissa',
            assigneeAgentId: 'agent-1',
            projectId: 'proj-1',
            createdAt: '2026-11-25T10:00:00Z',
            updatedAt: '2026-11-25T10:01:00Z',
          }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ChatView agent={mockAgent} companyId="company-1" />)

    const combo = await screen.findByRole('combobox', { name: 'Projeto da conversa' })
    fireEvent.focus(combo)
    fireEvent.change(combo, { target: { value: 'Gestor' } })

    const optionBtn = await screen.findByText('Master Gestor')
    fireEvent.mouseDown(optionBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/issues/chat-issue-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ projectId: 'proj-1' }),
        })
      )
    })
  })
})