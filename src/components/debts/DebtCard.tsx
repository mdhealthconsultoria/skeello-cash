import { ArrowRight, Link2, Clock } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { StatusBadge } from '../ui/StatusBadge'
import { formatCurrency, formatDate, daysUntil } from '../../lib/format'
import type { DebtWithRelations } from '../../types/database'

export function DebtCard({ debt, onClick, onRegisterPayment }: { debt: DebtWithRelations; onClick?: () => void; onRegisterPayment?: () => void }) {
  const remaining = debt.totals.remaining_amount
  const isReceivable = debt.type === 'receivable'
  const days = daysUntil(debt.due_date)

  let dueLabel: string | null = null
  if (debt.due_date && debt.status !== 'paid' && debt.status !== 'cancelled') {
    if (days !== null) {
      if (days < 0) dueLabel = `Venceu há ${Math.abs(days)} dia${Math.abs(days) > 1 ? 's' : ''}`
      else if (days === 0) dueLabel = 'Vence hoje'
      else if (days <= 7) dueLabel = `Vence em ${days} dia${days > 1 ? 's' : ''}`
      else dueLabel = `Vence em ${formatDate(debt.due_date)}`
    }
  }

  return (
    <div className="card p-4 hover:shadow-md transition cursor-pointer animate-pop" onClick={onClick}>
      <div className="flex items-start gap-3">
        <Avatar src={debt.person.photo_url} name={debt.person.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-ink-900 dark:text-ink-50 truncate flex items-center gap-1.5">
                {debt.person.name}
                {debt.share_status === 'accepted' && (
                  <Link2 size={12} className="text-brand-500 shrink-0" />
                )}
                {debt.share_status === 'pending' && (
                  <Clock size={12} className="text-amber-500 shrink-0" />
                )}
              </p>
              {debt.description && <p className="text-xs text-ink-400 truncate">{debt.description}</p>}
              {debt.share_status === 'pending' && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">Aguardando confirmação</p>
              )}
            </div>
            <StatusBadge status={debt.status} />
          </div>

          <div className="flex items-end justify-between mt-3">
            <div>
              <p className={`text-lg font-semibold ${isReceivable ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(remaining)}
              </p>
              {remaining !== debt.amount && (
                <p className="text-xs text-ink-400">de {formatCurrency(debt.amount)}</p>
              )}
              {dueLabel && <p className="text-xs text-ink-400 mt-0.5">{dueLabel}</p>}
            </div>

            {debt.status !== 'paid' && debt.status !== 'cancelled' && onRegisterPayment && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRegisterPayment()
                }}
                className="text-xs font-medium text-ink-900 dark:text-white flex items-center gap-1 shrink-0"
              >
                Registrar <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
