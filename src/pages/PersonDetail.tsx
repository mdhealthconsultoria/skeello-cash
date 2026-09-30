import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Archive, Trash2, Phone, Mail, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePeople } from '../hooks/usePeople'
import { useDebts } from '../hooks/useDebts'
import { Avatar } from '../components/ui/Avatar'
import { StatusBadge } from '../components/ui/StatusBadge'
import { AddPersonModal } from '../components/people/AddPersonModal'
import { AddDebtModal } from '../components/debts/AddDebtModal'
import { RegisterPaymentModal } from '../components/debts/RegisterPaymentModal'
import { formatCurrency, formatDate } from '../lib/format'
import type { DebtWithRelations } from '../types/database'

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { people, archivePerson, deletePerson } = usePeople(true)
  const { debts, loading } = useDebts({ personId: id, includeArchived: true })

  const [editOpen, setEditOpen] = useState(false)
  const [addDebtOpen, setAddDebtOpen] = useState(false)
  const [addDebtType, setAddDebtType] = useState<'receivable' | 'payable'>('receivable')
  const [paymentDebt, setPaymentDebt] = useState<DebtWithRelations | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const person = people.find((p) => p.id === id)

  if (!person) {
    return (
      <div className="py-16 text-center text-ink-400">
        {loading ? 'Carregando...' : 'Pessoa não encontrada.'}
      </div>
    )
  }

  const receivables = debts.filter((d) => d.type === 'receivable')
  const payables = debts.filter((d) => d.type === 'payable')
  const totalReceivable = receivables.reduce((s, d) => s + d.amount, 0)
  const receivedAmount = receivables.reduce((s, d) => s + d.totals.paid_amount, 0)
  const remainingReceivable = receivables.reduce((s, d) => s + d.totals.remaining_amount, 0)
  const personId = person.id

  async function handleArchive() {
    const { error } = await archivePerson(personId, true)
    if (error) toast.error(error)
    else {
      toast.success('Pessoa arquivada.')
      navigate('/pessoas')
    }
  }

  async function handleDelete() {
    const { error } = await deletePerson(personId)
    if (error) toast.error(error)
    else {
      toast.success('Pessoa excluída.')
      navigate('/pessoas')
    }
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/pessoas')} className="flex items-center gap-1.5 text-sm text-ink-400">
        <ArrowLeft size={16} /> Pessoas
      </button>

      <div className="card p-5 flex flex-col items-center text-center">
        <Avatar src={person.photo_url} name={person.name} size="xl" />
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50 mt-3">{person.name}</h1>
        {person.nickname && <p className="text-sm text-ink-400">"{person.nickname}"</p>}

        <div className="flex gap-4 mt-2 text-sm text-ink-400">
          {person.phone && (
            <span className="flex items-center gap-1">
              <Phone size={13} /> {person.phone}
            </span>
          )}
          {person.email && (
            <span className="flex items-center gap-1">
              <Mail size={13} /> {person.email}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 w-full mt-5 pt-5 border-t border-ink-100 dark:border-ink-800">
          <div>
            <p className="text-xs text-ink-400">Total a receber</p>
            <p className="font-semibold text-ink-900 dark:text-ink-50">{formatCurrency(totalReceivable)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Total recebido</p>
            <p className="font-semibold text-brand-600 dark:text-brand-400">{formatCurrency(receivedAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Restante</p>
            <p className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(remainingReceivable)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full mt-5">
          <button
            onClick={() => {
              setAddDebtType('receivable')
              setAddDebtOpen(true)
            }}
            className="btn-primary py-2 text-sm"
          >
            <Plus size={14} /> Cobrar {person.name.split(' ')[0]}
          </button>
          <button
            onClick={() => {
              setAddDebtType('payable')
              setAddDebtOpen(true)
            }}
            className="btn-secondary py-2 text-sm"
          >
            <Plus size={14} /> Pagar {person.name.split(' ')[0]}
          </button>
        </div>

        <div className="flex gap-2 w-full mt-2">
          <button onClick={() => setEditOpen(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-ink-500 dark:text-ink-400">
            <Pencil size={13} /> Editar
          </button>
          <button onClick={handleArchive} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-ink-500 dark:text-ink-400">
            <Archive size={13} /> Arquivar
          </button>
          <button onClick={() => setConfirmDelete(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-red-500">
            <Trash2 size={13} /> Excluir
          </button>
        </div>
      </div>

      <DebtSection title="A receber" items={receivables} onPay={setPaymentDebt} />
      <DebtSection title="A pagar" items={payables} onPay={setPaymentDebt} />

      <AddPersonModal open={editOpen} onClose={() => setEditOpen(false)} editPerson={person} />
      <AddDebtModal
        open={addDebtOpen}
        onClose={() => setAddDebtOpen(false)}
        defaultType={addDebtType}
        defaultPersonId={person.id}
      />
      <RegisterPaymentModal open={!!paymentDebt} onClose={() => setPaymentDebt(null)} debt={paymentDebt} />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setConfirmDelete(false)} />
          <div className="relative bg-white dark:bg-ink-900 rounded-2xl p-5 max-w-sm w-full">
            <h3 className="font-semibold text-ink-900 dark:text-ink-50 mb-2">Excluir {person.name}?</h3>
            <p className="text-sm text-ink-400 mb-5">
              Esta ação não pode ser desfeita. Todas as movimentações e pagamentos relacionados a esta pessoa também serão excluídos.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-600 text-white text-sm font-medium py-2.5 hover:bg-red-700 transition"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DebtSection({
  title,
  items,
  onPay,
}: {
  title: string
  items: DebtWithRelations[]
  onPay: (d: DebtWithRelations) => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-3">{title}</h2>
      <div className="space-y-2.5">
        {items.map((d) => (
          <div key={d.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-ink-900 dark:text-ink-50">{d.description || 'Sem descrição'}</p>
                <p className="text-xs text-ink-400 mt-0.5">
                  {formatDate(d.issue_date)}
                  {d.due_date && ` • vence ${formatDate(d.due_date)}`}
                </p>
              </div>
              <StatusBadge status={d.status} />
            </div>
            <div className="flex items-end justify-between mt-3">
              <div>
                <p className="font-semibold text-ink-900 dark:text-ink-50">{formatCurrency(d.totals.remaining_amount)}</p>
                {d.totals.paid_amount > 0 && (
                  <p className="text-xs text-ink-400">
                    {formatCurrency(d.totals.paid_amount)} de {formatCurrency(d.amount)} pago
                  </p>
                )}
              </div>
              {d.status !== 'paid' && d.status !== 'cancelled' && (
                <button onClick={() => onPay(d)} className="text-xs font-medium text-ink-900 dark:text-white flex items-center gap-1">
                  <Receipt size={13} /> Registrar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
