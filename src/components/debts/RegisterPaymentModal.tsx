import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { Confetti } from '../ui/Confetti'
import { useDebts } from '../../hooks/useDebts'
import { formatCurrency } from '../../lib/format'
import type { DebtWithRelations } from '../../types/database'

export function RegisterPaymentModal({
  open,
  onClose,
  debt,
  onRegistered,
}: {
  open: boolean
  onClose: () => void
  debt: DebtWithRelations | null
  onRegistered?: () => void
}) {
  const { registerPayment } = useDebts()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  const remaining = debt?.totals.remaining_amount ?? 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!debt) return
    const parsed = Number(amount.replace(',', '.'))
    if (!parsed || parsed <= 0) {
      toast.error('Informe um valor válido.')
      return
    }
    if (parsed > remaining + 0.01) {
      toast.error(`O valor não pode ser maior que o restante (${formatCurrency(remaining)}).`)
      return
    }

    setLoading(true)
    const { error } = await registerPayment(debt.id, parsed, method, paymentDate, notes || undefined)
    setLoading(false)

    if (error) {
      toast.error(error)
      return
    }

    const fullyPaid = parsed >= remaining - 0.01
    toast.success(fullyPaid ? 'Movimentação quitada!' : 'Pagamento parcial registrado!')

    if (fullyPaid) {
      setCelebrate(true)
      setTimeout(() => setCelebrate(false), 1000)
    }

    onRegistered?.()
    onClose()
    setAmount('')
    setMethod('')
    setNotes('')
  }

  return (
    <>
      <Confetti show={celebrate} />
      {debt && (
        <Modal open={open} onClose={onClose} title={debt.type === 'receivable' ? 'Registrar recebimento' : 'Registrar pagamento'}>
          <div className="mb-4 p-3 rounded-xl bg-ink-50 dark:bg-ink-800 text-sm">
            <p className="text-ink-500 dark:text-ink-400">{debt.person.name}</p>
            <p className="font-semibold text-ink-900 dark:text-ink-50">Restante: {formatCurrency(remaining)}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Valor (R$) *</label>
              <input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="0,00" />
              <button
                type="button"
                onClick={() => setAmount(String(remaining))}
                className="text-xs text-ink-900 dark:text-white font-medium underline decoration-ink-300 dark:decoration-ink-600 underline-offset-2 mt-1.5"
              >
                Usar valor total restante
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Data</label>
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Método</label>
                <input value={method} onChange={(e) => setMethod(e.target.value)} className="input" placeholder="Pix, dinheiro..." />
              </div>
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input resize-none" rows={2} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? 'Salvando...' : 'Confirmar'}
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
