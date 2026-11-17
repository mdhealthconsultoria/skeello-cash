import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { formatCurrency } from '../../lib/format'
import { parseMoney } from '../../lib/loans'

/** Registra um pagamento (do tomador pra mim, ou de mim pra um co-fundador). */
export function LoanPaymentModal({
  open,
  onClose,
  title,
  who,
  remaining,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  who: string
  remaining: number
  onSubmit: (amount: number, paidAt: string, note: string) => Promise<string | null>
}) {
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = parseMoney(amount)
    if (parsed <= 0) {
      toast.error('Informe um valor válido.')
      return
    }
    setLoading(true)
    const error = await onSubmit(parsed, paidAt, note)
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Pagamento registrado!')
    setAmount('')
    setNote('')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="mb-4 p-3 rounded-xl bg-ink-50 dark:bg-ink-800 text-sm">
        <p className="text-ink-500 dark:text-ink-400">{who}</p>
        <p className="font-semibold text-ink-900 dark:text-ink-50">Falta: {formatCurrency(remaining)}</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Valor (R$) *</label>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            placeholder="0,00"
          />
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(remaining).replace('.', ','))}
              className="text-xs text-ink-900 dark:text-white font-medium underline decoration-ink-300 dark:decoration-ink-600 underline-offset-2 mt-1.5"
            >
              Usar o valor que falta
            </button>
          )}
        </div>
        <div>
          <label className="label">Data</label>
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Observação</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Pix, dinheiro..." />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? 'Salvando...' : 'Confirmar'}
        </button>
      </form>
    </Modal>
  )
}
