import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { daysUntil, formatCurrency, formatDate } from '../../lib/format'
import { dueLabel, dueTone, round2 } from '../../lib/loans'
import type { Borrowing, Funding, ParticipationPayment } from '../../types/database'

function Payments({ items, empty }: { items: ParticipationPayment[]; empty: string }) {
  if (items.length === 0) return <p className="text-xs text-ink-400">{empty}</p>
  return (
    <ul className="space-y-1.5">
      {items.map((p) => (
        <li key={p.id} className="flex items-center justify-between text-sm">
          <span className="text-ink-500 dark:text-ink-400">
            {formatDate(p.paid_at)}
            {p.note ? ` · ${p.note}` : ''}
          </span>
          <span className="font-medium text-ink-900 dark:text-ink-50">{formatCurrency(p.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

function Progress({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  return (
    <div className="h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

function Shell({
  title,
  subtitle,
  dueDate,
  remainingLabel,
  remaining,
  settled,
  paid,
  total,
  lines,
  children,
}: {
  title: string
  subtitle: string
  dueDate: string
  remainingLabel: string
  remaining: number
  settled: boolean
  paid: number
  total: number
  lines: { label: string; value: string }[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const days = daysUntil(dueDate)
  return (
    <div className="card p-4 space-y-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink-900 dark:text-ink-50 truncate">{title}</p>
            <p className="text-xs text-ink-400">{subtitle}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${dueTone(days, settled)}`}>
            {dueLabel(days, settled)}
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-ink-400">{remainingLabel}</p>
            <p className="text-2xl font-bold text-ink-900 dark:text-ink-50">{formatCurrency(remaining)}</p>
          </div>
          <div className="text-right text-xs text-ink-400">
            <p>Vencimento</p>
            <p className="text-sm font-medium text-ink-700 dark:text-ink-200">{formatDate(dueDate)}</p>
          </div>
        </div>
        <Progress paid={paid} total={total} />
        <p className="flex items-center justify-center gap-1 text-xs text-ink-400">
          {open ? 'Esconder a conta' : 'Ver a conta'}
          <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
        </p>
      </button>

      {open && (
        <div className="space-y-4 border-t border-ink-100 dark:border-ink-800 pt-3">
          <div className="space-y-1.5 text-sm">
            {lines.map((l) => (
              <div key={l.label} className="flex items-center justify-between">
                <span className="text-ink-500 dark:text-ink-400">{l.label}</span>
                <span className="font-medium text-ink-900 dark:text-ink-50">{l.value}</span>
              </div>
            ))}
          </div>
          {children}
        </div>
      )}
    </div>
  )
}

/** Visão de quem DEVE: quanto precisa pagar, até quando, e o que já pagou. */
export function BorrowingCard({ b }: { b: Borrowing }) {
  const remaining = round2(Math.max(b.total - b.paid, 0))
  return (
    <Shell
      title={`Devo a ${b.owner_name ?? 'alguém'}`}
      subtitle={`Pego em ${formatDate(b.issue_date)}`}
      dueDate={b.due_date}
      remainingLabel="Falta pagar"
      remaining={remaining}
      settled={remaining <= 0.009}
      paid={b.paid}
      total={b.total}
      lines={[
        { label: 'Valor emprestado', value: formatCurrency(b.principal) },
        { label: `Juros (${String(b.borrower_rate).replace('.', ',')}%)`, value: formatCurrency(round2(b.total - b.principal)) },
        { label: 'Total a pagar', value: formatCurrency(b.total) },
        { label: 'Já pago', value: formatCurrency(b.paid) },
      ]}
    >
      <div>
        <p className="label">Pagamentos feitos</p>
        <Payments items={b.payments} empty="Nenhum pagamento registrado ainda." />
      </div>
    </Shell>
  )
}

/** Visão de co-fundador: quanto vai receber, de quem e quando. */
export function FundingCard({ f }: { f: Funding }) {
  const remaining = round2(Math.max(f.total - f.paid, 0))
  const lines = [
    { label: 'Você colocou', value: formatCurrency(f.amount) },
    { label: `Retorno combinado (${String(f.rate).replace('.', ',')}%)`, value: formatCurrency(round2(f.total - f.amount)) },
    { label: 'Total a receber', value: formatCurrency(f.total) },
    { label: 'Já recebido', value: formatCurrency(f.paid) },
  ]
  if (f.can_see_payments && f.borrower_total !== null && f.borrower_paid !== null) {
    lines.push({
      label: 'O tomador já pagou',
      value: `${formatCurrency(f.borrower_paid)} de ${formatCurrency(f.borrower_total)}`,
    })
  }
  return (
    <Shell
      title={`${f.owner_name ?? 'Alguém'} te deve`}
      subtitle={f.borrower_name ? `Emprestado a ${f.borrower_name}` : `Co-fundador desde ${formatDate(f.issue_date)}`}
      dueDate={f.due_date}
      remainingLabel="Falta receber"
      remaining={remaining}
      settled={remaining <= 0.009}
      paid={f.paid}
      total={f.total}
      lines={lines}
    >
      <div>
        <p className="label">Pagamentos que você recebeu</p>
        <Payments items={f.payments} empty="Nenhum pagamento recebido ainda." />
      </div>
    </Shell>
  )
}
