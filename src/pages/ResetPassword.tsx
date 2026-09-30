import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Senha atualizada com sucesso!')
    navigate('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-white dark:bg-ink-950">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50 mb-1">Redefinir senha</h1>
        <p className="text-sm text-ink-400 mb-8">Escolha uma nova senha para sua conta.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nova senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="label">Confirmar nova senha</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
