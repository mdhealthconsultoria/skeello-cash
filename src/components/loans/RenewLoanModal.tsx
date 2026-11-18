import { useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { formatCurrency, formatDate } from '../../lib/format'
import { daysBetween, parseMoney, rateFromDaily, round2 } from '../../lib/loans'
import type { LoanFull } from '../../types/database'

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** O devedor não pagou tudo: pagou só os juros e o empréstimo renova por mais um prazo. */
export function RenewLoanModal({
  open,
  onClose,
  loan,
  remaining,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  loan: LoanFull
  remaining: number
  onSubmit: (interestPaid: number, newDue: string, termRate: number, note?: string) => Promise<string | null>
}) {
  // juros que ainda faltam: o que falta pagar menos o valor emprestado
  const interestDue = round2(Math.max(remaining - loan.principal, 0))
  const lastTermDays = useMemo(() => {
    const last = loan.renewals[0]
    const d = last ? daysBetween(last.old_due, last.new_due) : daysBetween(loan.issue_date, loan.due_date)
    return Math.max(1, d)
  }, [loan])

  const [paid, setPaid] = useState('')
  const [newDue, setNewDue] = useState('')
  const [rate, setRate] = useState('')
  const [rateTouched, setRateTouched] = useState(false)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setPaid(String(interestDue).replace('.', ','))
    setNewDue(addDays(loan.due_date, lastTermDays))
    setRateTouched(false)
    setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loan.id])

  const newDays = Math.max(0, daysBetween(loan.due_date, newDue))
  // % do novo prazo: ao dia recalcula pelo número de dias; senão repete o % de um prazo
  const suggested = loan.daily_rate != null ? rateFromDaily(loan.daily_rate, newDays) : round2(loan.term_rate ?? loan.borrower_rate)

  useEffect(() => {
    if (!rateTouched) setRate(String(suggested).replace('.', ','))
  }, [suggested, rateTouched])

  const termRate = Math.max(0, parseMoney(rate))
  const interestPaid = Math.max(0, parseMoney(paid))
  const newInterest = round2(loan.principal * (termRate / 100))
  const newRemaining = round2(Math.max(remaining - interestPaid, 0) + newInterest)
  const dailyHint = loan.daily_rate != null ? ` · ${String(loan.daily_rate).replace('.', ',')}% ao dia x ${newDays} dias` : ''

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (newDue <= loan.due_date) return toast.error('O novo vencimento precisa ser depois do atual.')
    setLoading(true)
    const error = await onSubmit(interestPaid, newDue, termRate, note.trim() || undefined)
    setLoading(false)
    if (error) return toast.error(error)
    toast.success('Empréstimo renovado!')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Renovar só com juros">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ink-500 dark:text-ink-400">
          {loan.borrower_name} não pagou tudo: pagou só os juros. O valor emprestado ({formatCurrency(loan.principal)}) continua e o
          empréstimo ganha um novo prazo.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Juros que ele pagou agora (R$)</label>
            <input inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} className="input" placeholder="0,00" />
          </div>
          <div>
            <label className="label">Novo vencimento</label>
            <input
              required
              type="date"
              value={newDue}
              min={addDays(loan.due_date, 1)}
              onChange={(e) => setNewDue(e.target.value)}
              className="input"
            />
          </div>
          <div className="col-span-2">
            <label className="label">Juros do novo prazo (%){dailyHint}</label>
            <input
              inputMode="decimal"
              value={rate}
              onChange={(e) => {
                setRate(e.target.value)
                setRateTouched(true)
              }}
              className="input"
            />
          </div>
        </div>

        <div className="rounded-2xl bg-ink-50 dark:bg-ink-800 p-4 space-y-1.5 text-sm">
          <Row label="Juros que faltavam" value={formatCurrency(interestDue)} />
          <Row label="Juros pagos agora" value={formatCurrency(interestPaid)} />
          <Row label={`Juros do novo prazo (${String(termRate).replace('.', ',')}%)`} value={formatCurrency(newInterest)} />
          <div className="border-t border-ink-200 dark:border-ink-700 pt-1.5 mt-1.5">
            <Row label={`Passa a dever até ${newDue ? formatDate(newDue) : '...'}`} value={formatCurrency(newRemaining)} strong />
          </div>
        </div>

        {loan.funders.length > 0 && (
          <p className="text-xs text-ink-400">
            Os co-fundadores continuam com o valor deles e ganham os juros do novo prazo. O repasse dos juros que já venceram você
            registra em "Registrar repasse".
          </p>
        )}

        <div>
          <label className="label">Observação (opcional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Ex: pagou só os juros por Pix" />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? 'Renovando...' : 'Renovar empréstimo'}
        </button>
      </form>
    </Modal>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500 dark:text-ink-400">{label}</span>
      <span className={`${strong ? 'font-semibold' : 'font-medium'} text-ink-900 dark:text-ink-50`}>{value}</span>
    </div>
  )
}
