import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { Logo } from '../components/ui/Logo'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      toast.error('Supabase não configurado. Veja o README para conectar seu projeto.')
      return
    }
    setLoading(true)
    const { error } = await signIn({ email, password })
    setLoading(false)
    if (error) {
      toast.error(error === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : error)
      return
    }
    toast.success('Bem-vindo de volta!')
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white dark:bg-ink-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-fit">
            <Logo size={48} />
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Entrar</h1>
          <p className="text-sm text-ink-400 mt-1">Acesse sua conta Skeello Cash</p>
        </div>

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
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link to="/esqueci-senha" className="text-xs text-ink-900 dark:text-white font-medium underline decoration-ink-300 dark:decoration-ink-600 underline-offset-2">
              Esqueci minha senha
            </Link>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm text-ink-400 mt-6">
          Não tem conta?{' '}
          <Link to="/criar-conta" className="text-ink-900 dark:text-white font-medium underline decoration-ink-300 dark:decoration-ink-600 underline-offset-2">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
