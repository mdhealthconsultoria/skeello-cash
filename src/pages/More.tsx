import { useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  BarChart3,
  Users,
  Landmark,
  Bell,
  Search,
  HelpCircle,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../hooks/useNotifications'
import { Avatar } from '../components/ui/Avatar'

type Item = { to: string; label: string; desc: string; icon: LucideIcon; badge?: number; state?: unknown }

export default function More() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { unreadCount } = useNotifications()

  const items: Item[] = [
    { to: '/vencimentos', label: 'Vencimentos', desc: 'O que vence primeiro', icon: CalendarClock },
    { to: '/movimentacoes', label: 'Análises', desc: 'Gráficos, projeções e mês a mês', icon: BarChart3, state: { tab: 'analytics' } },
    { to: '/comunidade', label: 'Amigos no app', desc: 'Siga quem usa o Skeello Cash', icon: Users },
    { to: '/contas-bancarias', label: 'Contas bancárias', desc: 'Conexões com seu banco', icon: Landmark },
    { to: '/notificacoes', label: 'Notificações', desc: 'Avisos e lembretes', icon: Bell, badge: unreadCount },
    { to: '/busca', label: 'Buscar', desc: 'Achar pessoas e movimentações', icon: Search },
    { to: '/ajuda', label: 'Como usar o app', desc: 'Passo a passo de tudo', icon: HelpCircle },
    { to: '/configuracoes', label: 'Configurações', desc: 'Conta, lembretes e aparência', icon: Settings },
  ]
  if (profile?.is_admin) {
    items.push({ to: '/admin', label: 'Painel admin', desc: 'Todos os perfis e empréstimos', icon: ShieldCheck })
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate('/configuracoes')}
        className="w-full card p-4 flex items-center gap-3 text-left"
      >
        <Avatar src={profile?.avatar_url} name={profile?.name || profile?.email || '?'} size="lg" />
        <div className="min-w-0">
          <p className="font-semibold text-ink-900 dark:text-ink-50 truncate">{profile?.name || 'Usuário'}</p>
          <p className="text-xs text-ink-400 truncate">{profile?.email}</p>
        </div>
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {items.map((it) => (
          <button
            key={it.to}
            onClick={() => navigate(it.to, it.state ? { state: it.state } : undefined)}
            className="card p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition"
          >
            <span className="relative w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 flex items-center justify-center shrink-0">
              <it.icon size={18} />
              {!!it.badge && it.badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brand-500 text-white text-[10px] leading-4 text-center">
                  {it.badge > 9 ? '9+' : it.badge}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink-900 dark:text-ink-50">{it.label}</span>
              <span className="block text-xs text-ink-400 truncate">{it.desc}</span>
            </span>
            <ChevronRight size={16} className="text-ink-300 shrink-0" />
          </button>
        ))}
      </div>

      <button
        onClick={() => signOut()}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-ink-400 hover:text-red-600 transition"
      >
        <LogOut size={15} /> Sair da conta
      </button>
    </div>
  )
}
