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

  it('includes issue description briefing and authorAgentId in getChatSession for delegated tasks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/chats/')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => null })
        }
        if (url.includes('/issues?assigneeAgentId=')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 'task-del-1',
                identifier: 'MAS-2',
                title: 'Implementar tela X',
                description: 'Larissa, crie a tela X conforme combinado.',
                status: 'in_progress',
                assigneeAgentId: '11111111-1111-1111-1111-111111111111',
                createdByAgentId: '22222222-2222-2222-2222-222222222222',
                createdAt: '2026-11-25T10:00:00Z',
                updatedAt: '2026-11-25T10:01:00Z',
              },
            ],
          })
        }
        if (url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 'c-1',
                issueId: 'task-del-1',
                authorAgentId: '11111111-1111-1111-1111-111111111111',
                body: 'Iniciando implementação agora.',
                createdAt: '2026-11-25T10:02:00Z',
              },
            ],
          })
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      })
    )

    const res = await api.getChatSession(companyId, '11111111-1111-1111-1111-111111111111')
    expect(res.session.createdByAgentId).toBe('22222222-2222-2222-2222-222222222222')
    expect(res.messages).toHaveLength(2)
    expect(res.messages[0].isBriefing).toBe(true)
    expect(res.messages[0].authorAgentId).toBe('22222222-2222-2222-2222-222222222222')
    expect(res.messages[1].content).toBe('Iniciando implementação agora.')
  })

  it('sends valid UUID clientRequestId in sendMessage and addIssueComment', async () => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'c-10', body: 'Oi', createdAt: '2026-11-25T13:00:00Z' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await api.sendMessage('issue-1', { content: 'Olá Sofia', clientRequestId: '' })
    const sendBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(sendBody.body).toBe('Olá Sofia')
    expect(sendBody.clientRequestId).toMatch(uuidRe)

    await api.addIssueComment('issue-1', 'Comentário')
    const commentBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body))
    expect(commentBody.body).toBe('Comentário')
    expect(commentBody.clientRequestId).toMatch(uuidRe)
  })
})
