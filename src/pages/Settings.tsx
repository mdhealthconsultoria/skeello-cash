import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Download, FileText, LogOut, Moon, Sun, Monitor, Trash2, Landmark, ChevronRight, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useDebts } from '../hooks/useDebts'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/ui/Avatar'
import { exportDebtsToCsv, exportDebtsToPdf } from '../lib/export'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { InstallAppButton } from '../components/ui/InstallAppButton'
import type { Theme, UserSettings } from '../types/database'

export default function Settings() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { debts } = useDebts({ includeArchived: true })
  const { canInstall, isIosManual } = usePwaInstall()

  const [name, setName] = useState(profile?.name ?? '')
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile?.avatar_url ?? null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  useEffect(() => {
    setName(profile?.name ?? '')
    setPhotoPreview(profile?.avatar_url ?? null)
  }, [profile])

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setSettings(data as UserSettings | null))
  }, [user])

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSavingProfile(true)

    let avatarUrl = profile?.avatar_url ?? null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, photoFile, { upsert: true })
      if (!uploadError) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = data.publicUrl
      }
    }

    const { error } = await supabase.from('profiles').update({ name, avatar_url: avatarUrl }).eq('id', user.id)
    setSavingProfile(false)
    if (error) {
      toast.error(error.message)
      return
    }
    await refreshProfile()
    toast.success('Perfil atualizado!')
  }

  async function updateSetting(patch: Partial<UserSettings>) {
    if (!user) return
    const next = { ...settings, ...patch } as UserSettings
    setSettings(next)
    await supabase.from('user_settings').update(patch).eq('user_id', user.id)
  }

  async function handleDeleteAccount() {
    if (!user) return
    setDeletingAccount(true)

    await supabase.from('people').delete().eq('user_id', user.id)
    await supabase.from('categories').delete().eq('user_id', user.id).eq('is_default', false)
    await supabase.from('notifications').delete().eq('user_id', user.id)

    const { error: fnError } = await supabase.functions.invoke('delete-account')

    setDeletingAccount(false)

    if (fnError) {
      toast.error('Seus dados foram apagados, mas a conta de login não pôde ser removida automaticamente. Veja o README (Edge Function delete-account).')
      await signOut()
      navigate('/')
      return
    }

    toast.success('Conta excluída permanentemente.')
    navigate('/')
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Configurações</h1>

      {/* Perfil */}
      <section className="card p-5">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-4">Perfil</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="flex justify-center">
            <label className="relative cursor-pointer">
              <Avatar src={photoPreview} name={name || '?'} size="xl" />
              <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 flex items-center justify-center border-2 border-white dark:border-ink-900">
                <Camera size={13} />
              </span>
              <input type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
            </label>
          </div>
          <div>
            <label className="label">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input value={profile?.email ?? ''} disabled className="input opacity-60" />
          </div>
          <button type="submit" disabled={savingProfile} className="btn-primary w-full py-2.5">
            {savingProfile ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </section>

      {/* Preferências */}
      <section className="card p-5">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-4">Preferências</h2>
        <label className="label">Tema</label>
        <div className="grid grid-cols-3 gap-2 mb-1">
          {([
            { value: 'light', label: 'Claro', icon: Sun },
            { value: 'dark', label: 'Escuro', icon: Moon },
            { value: 'system', label: 'Sistema', icon: Monitor },
          ] as { value: Theme; label: string; icon: typeof Sun }[]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-xs font-medium transition ${
                theme === opt.value
                  ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 ring-1 ring-ink-900 dark:ring-white'
                  : 'bg-ink-50 dark:bg-ink-800 text-ink-500 dark:text-ink-400'
              }`}
            >
              <opt.icon size={16} />
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Contas bancárias */}
      <button
        onClick={() => navigate('/contas-bancarias')}
        className="card p-5 w-full flex items-center justify-between text-left hover:shadow-md transition"
      >
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-700 dark:text-ink-300">
            <Landmark size={18} />
          </span>
          <div>
            <p className="font-semibold text-ink-900 dark:text-ink-50">Contas bancárias</p>
            <p className="text-xs text-ink-400">Conecte seus bancos e importe transações</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-ink-300" />
      </button>

      {/* Instalar app */}
      {(canInstall || isIosManual) && (
        <section className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-700 dark:text-ink-300">
              <Smartphone size={18} />
            </span>
            <div>
              <p className="font-semibold text-ink-900 dark:text-ink-50">Instalar app</p>
              <p className="text-xs text-ink-400">Acesse o Skeello Cash como um app, direto da tela inicial</p>
            </div>
          </div>
          <InstallAppButton />
        </section>
      )}

      {/* Notificações */}
      <section className="card p-5">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-4">Notificações</h2>
        <div className="space-y-3">
          <Toggle
            label="Avisar vencimentos próximos"
            checked={settings?.notify_due ?? true}
            onChange={(v) => updateSetting({ notify_due: v })}
          />
          <Toggle
            label="Avisar dívidas atrasadas"
            checked={settings?.notify_overdue ?? true}
            onChange={(v) => updateSetting({ notify_overdue: v })}
          />
          <Toggle
            label="Resumos periódicos"
            checked={settings?.notify_summary ?? true}
            onChange={(v) => updateSetting({ notify_summary: v })}
          />
        </div>
      </section>

      {/* Privacidade / export */}
      <section className="card p-5">
        <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-4">Privacidade</h2>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => exportDebtsToCsv(debts)} className="btn-secondary py-2.5 text-sm">
            <Download size={15} /> Exportar CSV
          </button>
          <button onClick={() => exportDebtsToPdf(debts)} className="btn-secondary py-2.5 text-sm">
            <FileText size={15} /> Exportar PDF
          </button>
        </div>
        <button
          onClick={() => setConfirmDeleteAccount(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-600 border border-red-200 dark:border-red-900 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition"
        >
          <Trash2 size={15} /> Excluir minha conta
        </button>
      </section>

      {/* Sessão */}
      <section className="card p-5">
        <button onClick={() => signOut()} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-ink-500 dark:text-ink-400">
          <LogOut size={15} /> Sair da conta
        </button>
      </section>

      {confirmDeleteAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setConfirmDeleteAccount(false)} />
          <div className="relative bg-white dark:bg-ink-900 rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-semibold text-ink-900 dark:text-ink-50 mb-2">Excluir sua conta?</h3>
            <p className="text-sm text-ink-400 mb-4">
              Isso apaga permanentemente seu perfil, pessoas, dívidas, pagamentos, fotos e histórico. Não pode ser desfeito.
              Digite <strong>EXCLUIR</strong> para confirmar.
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="input mb-4"
              placeholder="EXCLUIR"
            />
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteAccount(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'EXCLUIR' || deletingAccount}
                className="flex-1 rounded-xl bg-red-600 text-white text-sm font-medium py-2.5 hover:bg-red-700 transition disabled:opacity-50"
              >
                {deletingAccount ? 'Excluindo...' : 'Excluir permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between"
    >
      <span className="text-sm text-ink-700 dark:text-ink-300">{label}</span>
      <span className={`w-10 h-6 rounded-full transition relative ${checked ? 'bg-ink-900 dark:bg-white' : 'bg-ink-200 dark:bg-ink-700'}`}>
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform ${
            checked ? 'bg-white dark:bg-ink-900 translate-x-4' : 'bg-white translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
