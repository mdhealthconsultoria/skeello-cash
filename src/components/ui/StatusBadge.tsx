import type { DebtStatus } from '../../types/database'

const CONFIG: Record<DebtStatus, { label: string; dot: string; text: string; bg: string }> = {
  pending: { label: 'Pendente', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  partially_paid: { label: 'Parcial', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  paid: { label: 'Pago', dot: 'bg-brand-500', text: 'text-brand-700 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-500/10' },
  overdue: { label: 'Atrasado', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10' },
  cancelled: { label: 'Cancelado', dot: 'bg-ink-400', text: 'text-ink-600 dark:text-ink-400', bg: 'bg-ink-100 dark:bg-ink-800' },
}

export function StatusBadge({ status }: { status: DebtStatus }) {
  const c = CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${c.text} ${c.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}
