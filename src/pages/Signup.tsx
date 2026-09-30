import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Avatar } from '../components/ui/Avatar'

export default function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      toast.error('Supabase não configurado. Veja o README para conectar seu projeto.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }
    if (password.length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)
    const { error } = await signUp({ name, email, password })
    if (error) {
      setLoading(false)
      toast.error(error === 'User already registered' ? 'Este e-mail já está cadastrado.' : error)
      return
    }

    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session && photoFile) {
      const userId = sessionData.session.user.id
      const ext = photoFile.name.split('.').pop()
      const path = `${userId}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, photoFile, { upsert: true })
      if (!uploadError) {
        const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path)
        await supabase.from('profiles').update({ avatar_url: publicUrl.publicUrl }).eq('id', userId)
      }
    }

    setLoading(false)

    if (sessionData.session) {
      toast.success('Conta criada com sucesso!')
      navigate('/')
    } else {
      toast.success('Conta criada! Verifique seu e-mail para confirmar o acesso.')
      navigate('/entrar')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-white dark:bg-ink-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Criar conta</h1>
          <p className="text-sm text-ink-400 mt-1">Comece a organizar seu dinheiro</p>
        </div>

        <div className="flex justify-center mb-5">
          <label className="relative cursor-pointer group">
            <Avatar src={photoPreview} name={name || '?'} size="xl" />
            <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 flex items-center justify-center border-2 border-white dark:border-ink-950">
              <Camera size={13} />
            </span>
            <input type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
          </label>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Seu nome" />
          </div>
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
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
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
          <div>
            <label className="label">Confirmar senha</label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center text-sm text-ink-400 mt-6">
          Já tem conta?{' '}
          <Link to="/entrar" className="text-ink-900 dark:text-white font-medium underline decoration-ink-300 dark:decoration-ink-600 underline-offset-2">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
