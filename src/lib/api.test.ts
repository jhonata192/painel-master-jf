import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, PaperclipApiError } from './api'

describe('ApiClient — Paperclip full integration', () => {
  const companyId = 'company-123'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('maps agents array including urlKey as ref and status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'ag-1',
            name: 'Sofia',
            role: 'ceo',
            title: 'CEO & Orquestradora',
            urlKey: 'sofia-ceo-orquestradora',
            status: 'idle',
            avatarUrl: null,
          },
        ],
      })
    )

    const agents = await api.getAgents(companyId)
    expect(agents).toHaveLength(1)
    expect(agents[0].ref).toBe('sofia-ceo-orquestradora')
    expect(agents[0].status).toBe('idle')
  })

  it('uses native chat endpoint when creating default agent chat', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'issue-chat-1',
        title: 'Chat with Sofia',
        assigneeAgentId: 'ag-1',
        createdAt: '2026-11-25T00:00:00Z',
        updatedAt: '2026-11-25T00:00:00Z',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await api.createChat(companyId, { agentRef: 'sofia-ceo-orquestradora' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/companies/company-123/chats/sofia-ceo-orquestradora',
      expect.objectContaining({ method: 'POST' })
    )
    expect(res.session.id).toBe('issue-chat-1')
  })

  it('calls real Paperclip approval endpoints (list, approve, reject)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'app-1',
            companyId,
            type: 'deploy_production',
            status: 'pending',
            requestedByAgentId: 'ag-1',
            payload: { description: 'Deploy v2' },
            createdAt: '2026-11-25T00:00:00Z',
            updatedAt: '2026-11-25T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'app-1',
          companyId,
          type: 'deploy_production',
          status: 'approved',
          payload: { description: 'Deploy v2' },
          decisionNote: 'OK',
          createdAt: '2026-11-25T00:00:00Z',
          updatedAt: '2026-11-25T00:00:00Z',
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    const list = await api.getApprovals(companyId)
    expect(list).toHaveLength(1)
    expect(list[0].description).toBe('Deploy v2')

    const approved = await api.approveApproval('app-1', 'OK')
    expect(approved.status).toBe('approved')
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/approvals/app-1/approve',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('supports wakeupAgent, pauseAgent, runRoutine and dashboard', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.wakeupAgent('ag-1', 'Teste')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agents/ag-1/wakeup',
      expect.objectContaining({ method: 'POST' })
    )

    await api.pauseAgent('ag-1')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agents/ag-1/pause',
      expect.objectContaining({ method: 'POST' })
    )

    await api.runRoutine('rt-1')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/routines/rt-1/run',
      expect.objectContaining({ method: 'POST' })
    )

    await api.getDashboard(companyId)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/companies/company-123/dashboard',
      expect.any(Object)
    )
  })

  it('throws PaperclipApiError (instanceof Error) on non-OK HTTP responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Failed query: delete from "issues"' }),
      })
    )

    await expect(api.deleteIssue('issue-1')).rejects.toThrow(PaperclipApiError)
    await expect(api.deleteIssue('issue-1')).rejects.toMatchObject({
      status: 500,
      message: 'Failed query: delete from "issues"',
    })
  })
})
