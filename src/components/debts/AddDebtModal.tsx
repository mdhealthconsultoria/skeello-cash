import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { usePeople } from '../../hooks/usePeople'
import { useCategories } from '../../hooks/useCategories'
import { useDebts } from '../../hooks/useDebts'
import type { DebtType } from '../../types/database'

export function AddDebtModal({
  open,
  onClose,
  defaultType = 'receivable',
  defaultPersonId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  defaultType?: DebtType
  defaultPersonId?: string
  onCreated?: () => void
}) {
  const { people } = usePeople()
  const { categories } = useCategories()
  const { createDebt } = useDebts()

  const [type, setType] = useState<DebtType>(defaultType)
  const [personId, setPersonId] = useState(defaultPersonId ?? '')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [method, setMethod] = useState('')
  const [installments, setInstallments] = useState(1)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!personId) {
      toast.error('Selecione uma pessoa.')
      return
    }
    const parsedAmount = Number(amount.replace(',', '.'))
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Informe um valor válido.')
      return
    }

    setLoading(true)
    const { error } = await createDebt({
      type,
      person_id: personId,
      amount: parsedAmount,
      due_date: dueDate || null,
      description: description || null,
      category_id: categoryId || null,
      agreed_payment_method: method || null,
      installments,
      notes: notes || null,
    })
    setLoading(false)

    if (error) {
      toast.error(error)
      return
    }

    toast.success(type === 'receivable' ? 'Dívida a receber adicionada!' : 'Conta a pagar adicionada!')
    onCreated?.()
    onClose()
    setAmount('')
    setDueDate('')
    setDescription('')
    setNotes('')
  }

  return (
    <Modal open={open} onClose={onClose} title={type === 'receivable' ? 'Dinheiro a receber' : 'Conta / dívida a pagar'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-ink-100 dark:bg-ink-800 rounded-xl">
          <button
            type="button"
            onClick={() => setType('receivable')}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              type === 'receivable' ? 'bg-white dark:bg-ink-900 text-brand-700 dark:text-brand-400 shadow-sm' : 'text-ink-500'
            }`}
          >
            A receber
          </button>
          <button
            type="button"
            onClick={() => setType('payable')}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              type === 'payable' ? 'bg-white dark:bg-ink-900 text-red-600 dark:text-red-400 shadow-sm' : 'text-ink-500'
            }`}
          >
            A pagar
          </button>
        </div>

        <div>
          <label className="label">Pessoa *</label>
          <select required value={personId} onChange={(e) => setPersonId(e.target.value)} className="input">
            <option value="">Selecione</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {people.length === 0 && (
            <p className="text-xs text-ink-400 mt-1">Cadastre uma pessoa primeiro em "Pessoas".</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Valor (R$) *</label>
            <input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="0,00" />
          </div>
          <div>
            <label className="label">Vencimento</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label className="label">Descrição</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Ex: Empréstimo" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Categoria</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Parcelas</label>
            <input
              type="number"
              min={1}
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label">Forma combinada</label>
          <input value={method} onChange={(e) => setMethod(e.target.value)} className="input" placeholder="Ex: Pix, dinheiro..." />
        </div>

        <div>
          <label className="label">Observações</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input resize-none" rows={2} />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </Modal>
  )
}
