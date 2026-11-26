import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginView } from './LoginView'

describe('LoginView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('submits email and password without exposing public signup', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'u-1', email: 'admin@masterjf.com' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onLoginSuccess = vi.fn()
    render(<LoginView onLoginSuccess={onLoginSuccess} />)

    expect(screen.queryByRole('button', { name: /Criar conta|Cadastr/i })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@masterjf.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'minha-senha' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/sign-in/email',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ email: 'admin@masterjf.com', password: 'minha-senha' }),
        })
      )
      expect(onLoginSuccess).toHaveBeenCalled()
    })
  })

  it('shows accessible error alert on invalid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid email or password' }),
      })
    )

    render(<LoginView onLoginSuccess={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'x@y.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'errada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.')
    })
  })
})
