import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { formatCurrency, formatDate } from '../../lib/format'
import { useOverdue, type OverdueItem } from '../../hooks/useOverdue'

/**
 * Cartão "Em atraso": o valor total que já venceu e não entrou (empréstimos e dívidas, de todas as pessoas).
 * Ao tocar abre a lista de todos os atrasos. scope="loans" mostra só os empréstimos.
 */
export function OverdueCard({ scope = 'all' }: { scope?: 'all' | 'loans' }) {
  const o = useOverdue()
  const [open, setOpen] = useState(false)

  const loansOnly = scope === 'loans'
  const total = loansOnly ? o.loanTotal : o.receivableTotal
  const count = loansOnly ? o.loanItems.length : o.loanItems.length + o.debtIn.length
  const label = loansOnly ? 'Atraso de empréstimos' : 'Em atraso'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`card p-4 text-left w-full transition active:scale-[0.99] ${total > 0 ? 'border-amber-200 dark:border-amber-500/30' : ''}`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              total > 0 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-ink-100 dark:bg-ink-800 text-ink-400'
            }`}
          >
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-400">{label}</p>
            <p className={`text-xl font-bold truncate ${total > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-ink-900 dark:text-ink-50'}`}>
              {formatCurrency(total)}
            </p>
            <p className="text-xs text-ink-400 truncate">
              {count > 0
                ? `${count} atrasado${count > 1 ? 's' : ''}${!loansOnly && o.loanTotal > 0 ? ` · empréstimos ${formatCurrency(o.loanTotal)}` : ''} · toque para ver todos`
                : 'Nada em atraso. Tudo em dia.'}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-ink-300" />
        </div>
      </button>

      <OverdueModal open={open} onClose={() => setOpen(false)} scope={scope} />
    </>
  )
}

export function OverdueModal({ open, onClose, scope = 'all' }: { open: boolean; onClose: () => void; scope?: 'all' | 'loans' }) {
  const o = useOverdue()
  const navigate = useNavigate()
  const loansOnly = scope === 'loans'

  function go(i: OverdueItem) {
    onClose()
    navigate(i.loanId ? `/emprestimos/${i.loanId}` : `/pessoas/${i.personId}`)
  }

  const empty = o.loanItems.length === 0 && (loansOnly || (o.debtIn.length === 0 && o.debtOutTotal === 0))

  return (
    <Modal open={open} onClose={onClose} title={loansOnly ? 'Atrasos de empréstimos' : 'Tudo que está em atraso'}>
      {empty ? (
        <p className="text-sm text-ink-500">Nada em atraso. Tudo em dia!</p>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-4">
            <p className="text-xs text-amber-700 dark:text-amber-400">Total a receber em atraso</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(loansOnly ? o.loanTotal : o.receivableTotal)}</p>
            {(loansOnly ? o.loanItems : [...o.loanItems, ...o.debtIn]).some((i) => i.updated > i.amount) && (
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                Com juros de atraso e multa: {formatCurrency(loansOnly ? o.loanItems.reduce((s, i) => s + i.updated, 0) : o.receivableUpdated)}
              </p>
            )}
          </div>

          <Group title="Empréstimos" items={o.loanItems} total={o.loanTotal} onPick={go} />
          {!loansOnly && <Group title="Dívidas a receber" items={o.debtIn} total={o.debtInTotal} onPick={go} />}
          {!loansOnly && <Group title="Você deve (atrasado)" items={o.debtOut} total={o.debtOutTotal} onPick={go} tone="red" />}
        </div>
      )}
    </Modal>
  )
}

function Group({
  title,
  items,
  total,
  onPick,
  tone,
}: {
  title: string
  items: OverdueItem[]
  total: number
  onPick: (i: OverdueItem) => void
  tone?: 'red'
}) {
  if (items.length === 0) return null
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">{title}</h3>
        <span className="text-sm font-medium text-ink-500">{formatCurrency(total)}</span>
      </div>
      <ul className="divide-y divide-ink-100 dark:divide-ink-800 rounded-2xl border border-ink-100 dark:border-ink-800">
        {items.map((i) => (
          <li key={i.key}>
            <button onClick={() => onPick(i)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{i.name}</p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  Atrasado há {i.days} dia{i.days === 1 ? '' : 's'} · venceu {formatDate(i.due)}
                </p>
                {i.description && <p className="truncate text-xs text-ink-400">{i.description}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-semibold ${tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-ink-900 dark:text-ink-50'}`}>{formatCurrency(i.amount)}</p>
                {i.updated > i.amount + 0.009 && <p className="text-[11px] text-amber-600 dark:text-amber-400">com juros {formatCurrency(i.updated)}</p>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
