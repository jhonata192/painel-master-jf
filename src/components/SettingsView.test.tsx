import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
})
