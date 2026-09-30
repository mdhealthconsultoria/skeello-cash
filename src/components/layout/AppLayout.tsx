import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Users, Wallet, BarChart3, Settings, Plus, LogOut, Search, Bell } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../hooks/useNotifications'
import { Avatar } from '../ui/Avatar'
import { Logo } from '../ui/Logo'
import { QuickAddMenu } from './QuickAddMenu'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Início', icon: Home, end: true },
  { to: '/pessoas', label: 'Pessoas', icon: Users, end: false },
  { to: '/movimentacoes', label: 'Movimentações', icon: Wallet, end: false },
  { to: '/analises', label: 'Análises', icon: BarChart3, end: false },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, end: false },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { unreadCount } = useNotifications()
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 px-4 py-6">
        <div className="flex items-center gap-2 px-2 mb-8">
          <Logo size={32} />
          <span className="font-semibold text-ink-900 dark:text-ink-50">Skeello Cash</span>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900'
                    : 'text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button onClick={() => setQuickAddOpen(true)} className="btn-primary w-full mb-3">
          <Plus size={16} /> Adicionar
        </button>

        <button
          onClick={() => navigate('/notificacoes')}
          className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800 transition mb-1"
        >
          <Bell size={18} />
          Notificações
          {unreadCount > 0 && (
            <span className="absolute left-7 top-1.5 w-2 h-2 rounded-full bg-brand-500" />
          )}
        </button>

        <button
          onClick={() => navigate('/configuracoes')}
          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-ink-50 dark:hover:bg-ink-800 transition"
        >
          <Avatar src={profile?.avatar_url} name={profile?.name || profile?.email || '?'} size="sm" />
          <div className="text-left overflow-hidden">
            <p className="text-sm font-medium text-ink-900 dark:text-ink-50 truncate">{profile?.name || 'Usuário'}</p>
            <p className="text-xs text-ink-400 truncate">{profile?.email}</p>
          </div>
        </button>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 px-3 py-2 mt-1 text-xs text-ink-400 hover:text-red-600 transition"
        >
          <LogOut size={14} /> Sair da conta
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 bg-white/80 dark:bg-ink-950/80 backdrop-blur border-b border-ink-100 dark:border-ink-800"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: '12px' }}
        >
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <span className="font-semibold text-ink-900 dark:text-ink-50 text-sm">Skeello Cash</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/busca')} className="p-1.5 text-ink-400" aria-label="Buscar">
              <Search size={19} />
            </button>
            <button onClick={() => navigate('/notificacoes')} className="relative p-1.5 text-ink-400" aria-label="Notificações">
              <Bell size={19} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white dark:ring-ink-950" />
              )}
            </button>
            <button onClick={() => navigate('/configuracoes')}>
              <Avatar src={profile?.avatar_url} name={profile?.name || profile?.email || '?'} size="sm" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-5 md:py-8 pb-32 md:pb-8 max-w-5xl w-full mx-auto">{children}</main>

        {/* Bottom nav (mobile) */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-ink-950/95 backdrop-blur border-t border-ink-100 dark:border-ink-800 flex items-center justify-around"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 px-3 text-xs ${
                  isActive ? 'text-ink-900 dark:text-white' : 'text-ink-400'
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}

          <button
            onClick={() => setQuickAddOpen(true)}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 shadow-lg shadow-ink-900/30 -mt-6 active:scale-95 transition"
            aria-label="Adicionar"
          >
            <Plus size={22} />
          </button>

          {NAV_ITEMS.slice(2).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 px-3 text-xs ${
                  isActive ? 'text-ink-900 dark:text-white' : 'text-ink-400'
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <QuickAddMenu open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  )
}
