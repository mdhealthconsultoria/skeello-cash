import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Link2, HandCoins, CheckCheck } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { EmptyState } from '../components/ui/EmptyState'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'
import { formatDate } from '../lib/format'
import type { Notification } from '../types/database'

const ICONS: Record<Notification['type'], typeof Bell> = {
  due_today: Bell,
  due_soon: Bell,
  overdue: Bell,
  summary: Bell,
  debt_invite: HandCoins,
  debt_accepted: HandCoins,
  contact_added: Link2,
}

export default function Notifications() {
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-ink-400">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Notificações</h1>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="text-xs font-medium text-ink-900 dark:text-white flex items-center gap-1">
            <CheckCheck size={14} /> Marcar todas como lidas
          </button>
        )}
      </div>

      {!loading && notifications.length === 0 ? (
        <EmptyState
          illustration={<AnimatedMascot size={140} />}
          title="Nenhuma notificação ainda"
          description="Avisos de convites, novos contatos e vencimentos aparecem aqui."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Bell
            return (
              <button
                key={n.id}
                onClick={() => !n.read && markAsRead(n.id)}
                className={`w-full card p-3.5 flex items-start gap-3 text-left transition ${
                  !n.read ? 'border-brand-200 dark:border-brand-500/30' : ''
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    !n.read
                      ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400'
                      : 'bg-ink-100 dark:bg-ink-800 text-ink-400'
                  }`}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${!n.read ? 'font-medium text-ink-900 dark:text-ink-50' : 'text-ink-500 dark:text-ink-400'}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-ink-400 mt-0.5">{formatDate(n.created_at, 'long')}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
