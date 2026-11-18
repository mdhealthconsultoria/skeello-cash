import { useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Link2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Toggle } from '../ui/Toggle'
import { usePeople } from '../../hooks/usePeople'
import { useCategories } from '../../hooks/useCategories'
import { useFriends } from '../../hooks/useFriends'
import { useInterestDefaults } from '../../hooks/useInterestDefaults'
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
  const { friends, available: friendsAvailable } = useFriends()
  const interest = useInterestDefaults()
  const { debts, createDebt, updateDebt } = useDebts()

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
  const [invite, setInvite] = useState(true)
  const [lateRate, setLateRate] = useState(editDebt?.late_daily_rate != null ? String(editDebt.late_daily_rate).replace('.', ',') : '')

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
    setInvite(true)
    setLateRate(editDebt?.late_daily_rate != null ? String(editDebt.late_daily_rate).replace('.', ',') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editDebt?.id])

  const selectedPerson = useMemo(() => people.find((p) => p.id === personId), [people, personId])
  // convite só para amigo que aceitou (se o banco ainda não tem amizades, vale o vínculo antigo)
  const linkedUser = selectedPerson?.linked_user_id ?? null
  const isFriend = Boolean(linkedUser) && (!friendsAvailable || friends.some((f) => f.id === linkedUser))
  const hasApp = isFriend
  // convite só vai se a pessoa tem o app E você quer; senão é um registro só seu (e você cobra por fora)
  const isShared = hasApp && invite

  // Conta na hora: o que já está em aberto com essa pessoa + o valor que está sendo digitado.
  // Só conta o que falta pagar (pagamentos já feitos saem da conta).
  const preview = useMemo(() => {
    if (!personId) return null
    const raw = amount.trim().replace(',', '.')
    const value = raw === '' ? 0 : Number(raw)
    if (Number.isNaN(value) || value < 0) return null
    const open = debts.filter((d) => d.person_id === personId && d.id !== editDebt?.id && d.status !== 'cancelled')
    const receivable = open.filter((d) => d.type === 'receivable').reduce((s, d) => s + d.totals.remaining_amount, 0)
    const payable = open.filter((d) => d.type === 'payable').reduce((s, d) => s + d.totals.remaining_amount, 0)
    const afterReceivable = receivable + (type === 'receivable' ? value : 0)
    const afterPayable = payable + (type === 'payable' ? value : 0)
    const parts = Math.max(1, Math.floor(installments) || 1)
    return { value, receivable, payable, afterReceivable, afterPayable, net: afterReceivable - afterPayable, parts, perPart: value / parts }
  }, [personId, amount, type, debts, editDebt?.id, installments])
  const isSharedDebt = Boolean(editDebt && editDebt.share_status !== 'none')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const lateParsed = lateRate.trim() === '' ? null : Number(lateRate.replace(',', '.'))
    if (lateParsed !== null && (!Number.isFinite(lateParsed) || lateParsed < 0)) {
      toast.error('Juros de atraso inválido.')
      return
    }
    const latePart = lateParsed !== null || editDebt?.late_daily_rate !== undefined ? { late_daily_rate: lateParsed } : {}
    if (!personId) {
      toast.error('Selecione uma pessoa.')
      return
    }
    const parsedAmount = Number(amount.replace(',', '.'))
    if (amount.trim() === '' || Number.isNaN(parsedAmount) || parsedAmount < 0) {
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
        ...latePart,
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
      ...latePart,
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
          {!editDebt && selectedPerson && hasApp && (
            <div className="mt-2 rounded-xl bg-ink-50 dark:bg-ink-800 p-3 space-y-2">
              <Toggle checked={invite} onChange={setInvite} label={`Enviar convite para ${selectedPerson.name} confirmar no app`} />
              <p className="text-xs text-ink-400 flex items-start gap-1">
                <Link2 size={12} className="mt-0.5 shrink-0" />
                {invite
                  ? 'Ela recebe o convite, confirma, e a dívida fica sincronizada dos dois lados.'
                  : 'Fica só no seu controle: ela não vê nada. Você pode cobrar pelo WhatsApp depois.'}
              </p>
            </div>
          )}
          {!editDebt && selectedPerson && !hasApp && (
            <p className="text-xs text-ink-400 mt-1.5">
              {linkedUser
                ? `${selectedPerson.name} ainda não aceitou ser seu amigo no app, então fica registrado só para você. Peça amizade em Pessoas > Solicitações e amigos para enviar convites.`
                : `${selectedPerson.name} não usa o app? Sem problema: fica registrado só para você. Depois use "Cobrar" para mandar a cobrança pelo WhatsApp.`}
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
          <label className="label">Juros de atraso (% ao dia, opcional)</label>
          <input
            inputMode="decimal"
            value={lateRate}
            onChange={(e) => setLateRate(e.target.value)}
            className="input"
            placeholder={interest.lateRate > 0 ? `Padrão: ${String(interest.lateRate).replace('.', ',')}%` : 'Vazio = sem juros de atraso'}
          />
          <p className="text-xs text-ink-400 mt-1">Depois do vencimento o app calcula o valor atualizado. O padrão fica em Configurações.</p>
        </div>

        {preview && (
          <div className="rounded-xl bg-ink-50 dark:bg-ink-800 p-3.5 text-sm space-y-1.5">
            <p className="text-xs font-medium text-ink-500 dark:text-ink-400">
              Conta com {selectedPerson?.name ?? 'esta pessoa'} (só o que falta pagar)
            </p>
            <div className="flex justify-between text-ink-600 dark:text-ink-300">
              <span>A receber</span>
              <span>
                {preview.receivable !== preview.afterReceivable && (
                  <span className="text-ink-400 mr-1.5">{formatCurrency(preview.receivable)} →</span>
                )}
                <span className="font-medium text-brand-600 dark:text-brand-400">{formatCurrency(preview.afterReceivable)}</span>
              </span>
            </div>
            <div className="flex justify-between text-ink-600 dark:text-ink-300">
              <span>A pagar</span>
              <span>
                {preview.payable !== preview.afterPayable && (
                  <span className="text-ink-400 mr-1.5">{formatCurrency(preview.payable)} →</span>
                )}
                <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(preview.afterPayable)}</span>
              </span>
            </div>
            <div className="flex justify-between border-t border-ink-200 dark:border-ink-700 pt-1.5 font-medium text-ink-900 dark:text-ink-50">
              <span>{preview.net >= 0 ? 'Ele te deve no total' : 'Você deve no total'}</span>
              <span>{formatCurrency(Math.abs(preview.net))}</span>
            </div>
            {preview.parts > 1 && (
              <p className="text-xs text-ink-400 pt-0.5">
                Esta dívida em {preview.parts} parcelas: {preview.parts}x de {formatCurrency(preview.perPart)}
              </p>
            )}
          </div>
        )}

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
