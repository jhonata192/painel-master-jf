import { useState } from 'react'
import { Lock, LogIn } from 'lucide-react'
import { api } from '../lib/api'

interface LoginViewProps {
  onLoginSuccess: () => Promise<void> | void
}

/** Tela de autenticação por e-mail e senha (contas criadas pelo administrador). */
export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setSubmitting(true)
    setError(null)
    try {
      await api.signIn(email.trim(), password)
      await onLoginSuccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'E-mail ou senha inválidos'
      setError(msg === 'Invalid email or password' ? 'E-mail ou senha inválidos.' : msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app-no-session" style={{ padding: '24px' }}>
      <form
        onSubmit={handleSubmit}
        className="card stack-md"
        style={{ width: '100%', maxWidth: '400px', padding: '28px' }}
        aria-labelledby="login-title"
      >
        <div className="flex items-center gap-3">
          <div
            className="avatar"
            style={{
              backgroundColor: 'var(--color-brand-primary)',
              color: '#fff',
              width: '40px',
              height: '40px',
            }}
          >
            <Lock size={18} aria-hidden="true" />
          </div>
          <div>
            <h1 id="login-title" className="text-h3 text-primary">
              Master JF — Painel Web
            </h1>
            <p className="text-caption text-secondary">
              Entre com sua conta para acessar sua empresa
            </p>
          </div>
        </div>

        {error && (
          <div className="error-inline" role="alert">
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="login-email" className="label">
            E-mail
          </label>
          <input
            id="login-email"
            type="email"
            className="input-base"
            autoComplete="email"
            placeholder="nome@empresa.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="login-password" className="label">
            Senha
          </label>
          <input
            id="login-password"
            type="password"
            className="input-base"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          <LogIn size={16} aria-hidden="true" />
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-caption text-tertiary" style={{ textAlign: 'center' }}>
          As contas de acesso e permissões por empresa são criadas pelo administrador.
        </p>
      </form>
    </div>
  )
}
