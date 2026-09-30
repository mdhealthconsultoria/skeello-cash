import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      toast.error('Supabase não configurado. Veja o README para conectar seu projeto.')
      return
    }
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white dark:bg-ink-950">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50 mb-1">Esqueci minha senha</h1>
        <p className="text-sm text-ink-400 mb-8">
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </p>

        {sent ? (
          <div className="card p-4 text-sm text-ink-600 dark:text-ink-300">
            Se este e-mail existir na nossa base, você receberá um link de redefinição em instantes.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="voce@email.com"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-ink-400 mt-6">
          <Link to="/entrar" className="text-ink-900 dark:text-white font-medium underline decoration-ink-300 dark:decoration-ink-600 underline-offset-2">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  )
}
