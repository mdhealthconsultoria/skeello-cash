import { useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Link2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { usePeople } from '../../hooks/usePeople'
import { useCategories } from '../../hooks/useCategories'
import { useDebts } from '../../hooks/useDebts'
import { useAuth } from '../../contexts/AuthContext'
import { sendPush } from '../../lib/push'
import { formatCurrency } from '../../lib/format'
import type { DebtType, DebtWithRelations } from '../../types/database'

export function AddDebtModal({
  open,
  onClose,
  defaultType = 'receivable',
  defaultPersonId,
  editDebt,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  defaultType?: DebtType
  defaultPersonId?: string
  editDebt?: DebtWithRelations | null
  onCreated?: () => void
}) {
  const { profile } = useAuth()
  const { people } = usePeople()
  const { categories } = useCategories()
  const { createDebt, updateDebt } = useDebts()

  const [type, setType] = useState<DebtType>(editDebt?.type ?? defaultType)
  const [personId, setPersonId] = useState(editDebt?.person_id ?? defaultPersonId ?? '')
  const [amount, setAmount] = useState(editDebt ? String(editDebt.amount) : '')
  const [dueDate, setDueDate] = useState(editDebt?.due_date ?? '')
  const [description, setDescription] = useState(editDebt?.description ?? '')
  const [categoryId, setCategoryId] = useState(editDebt?.category_id ?? '')
  const [method, setMethod] = useState(editDebt?.agreed_payment_method ?? '')
  const [installments, setInstallments] = useState(editDebt?.installments ?? 1)
  const [notes, setNotes] = useState(editDebt?.notes ?? '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setType(editDebt?.type ?? defaultType)
    setPersonId(editDebt?.person_id ?? defaultPersonId ?? '')
    setAmount(editDebt ? String(editDebt.amount) : '')
    setDueDate(editDebt?.due_date ?? '')
    setDescription(editDebt?.description ?? '')
    setCategoryId(editDebt?.category_id ?? '')
    setMethod(editDebt?.agreed_payment_method ?? '')
    setInstallments(editDebt?.installments ?? 1)
    setNotes(editDebt?.notes ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editDebt?.id])

  const selectedPerson = useMemo(() => people.find((p) => p.id === personId), [people, personId])
  const isShared = Boolean(selectedPerson?.linked_user_id)
  const isSharedDebt = Boolean(editDebt && editDebt.share_status !== 'none')

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

    if (editDebt) {
      const { error } = await updateDebt(editDebt.id, {
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
      toast.success('Dívida atualizada!')
      onCreated?.()
      onClose()
      return
    }

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
      counterparty_user_id: isShared ? selectedPerson!.linked_user_id : null,
      share_status: isShared ? 'pending' : 'none',
    })
    setLoading(false)

    if (error) {
      toast.error(error)
      return
    }

    if (isShared) {
      sendPush(
        selectedPerson!.linked_user_id!,
        `${profile?.name || 'Alguém'} quer registrar uma dívida com você`,
        `${type === 'receivable' ? 'Você deve' : 'Você tem a receber'} ${formatCurrency(parsedAmount)}${description ? ` — ${description}` : ''}`,
        '/dashboard'
      )
    }

    toast.success(
      isShared
        ? `Convite enviado para ${selectedPerson!.name} confirmar!`
        : type === 'receivable'
          ? 'Dívida a receber adicionada!'
          : 'Conta a pagar adicionada!'
    )
    onCreated?.()
    onClose()
    setAmount('')
    setDueDate('')
    setDescription('')
    setNotes('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editDebt ? 'Editar dívida' : type === 'receivable' ? 'Dinheiro a receber' : 'Conta / dívida a pagar'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-ink-100 dark:bg-ink-800 rounded-xl">
          <button
            type="button"
            disabled={!!editDebt}
            onClick={() => setType('receivable')}
            className={`py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none ${
              type === 'receivable' ? 'bg-white dark:bg-ink-900 text-brand-700 dark:text-brand-400 shadow-sm' : 'text-ink-500'
            }`}
          >
            A receber
          </button>
          <button
            type="button"
            disabled={!!editDebt}
            onClick={() => setType('payable')}
            className={`py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none ${
              type === 'payable' ? 'bg-white dark:bg-ink-900 text-red-600 dark:text-red-400 shadow-sm' : 'text-ink-500'
            }`}
          >
            A pagar
          </button>
        </div>

        <div>
          <label className="label">Pessoa *</label>
          <select
            required
            disabled={!!editDebt}
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="input disabled:opacity-60"
          >
            <option value="">Selecione</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.linked_user_id ? ' ✓' : ''}
              </option>
            ))}
          </select>
          {people.length === 0 && (
            <p className="text-xs text-ink-400 mt-1">Cadastre uma pessoa primeiro em "Pessoas".</p>
          )}
          {editDebt && (
            <p className="text-xs text-ink-400 mt-1.5">
              Pessoa e tipo não podem mudar depois de criada — exclua e crie outra se precisar trocar.
            </p>
          )}
          {!editDebt && isShared && (
            <p className="text-xs text-brand-600 dark:text-brand-400 mt-1.5 flex items-center gap-1">
              <Link2 size={12} /> {selectedPerson!.name} tem conta no Skeello Cash — essa dívida vai virar um convite pra ela confirmar, e depois fica sincronizada dos dois lados.
            </p>
          )}
          {isSharedDebt && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
              Essa dívida é compartilhada — o valor editado aqui não atualiza automaticamente do lado da outra pessoa.
            </p>
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
          {loading ? 'Salvando...' : editDebt ? 'Salvar alterações' : isShared ? 'Enviar convite' : 'Salvar'}
        </button>
      </form>
    </Modal>
  )
}
