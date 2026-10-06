import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useDebts } from '../hooks/useDebts'
import { DebtCard } from '../components/debts/DebtCard'
import { EmptyState } from '../components/ui/EmptyState'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'
import { AddDebtModal } from '../components/debts/AddDebtModal'
import { RegisterPaymentModal } from '../components/debts/RegisterPaymentModal'
import type { DebtStatus, DebtType, DebtWithRelations } from '../types/database'

type FilterTab = 'all' | DebtType
type StatusFilter = 'all' | DebtStatus

export default function Movimentacoes() {
  const location = useLocation()
  const navigate = useNavigate()
  const { debts, loading } = useDebts({ includeArchived: false })

  const [tab, setTab] = useState<FilterTab>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState<DebtType>('receivable')
  const [paymentDebt, setPaymentDebt] = useState<DebtWithRelations | null>(null)
  const [editingDebt, setEditingDebt] = useState<DebtWithRelations | null>(null)

  useEffect(() => {
    const state = location.state as { openAdd?: DebtType } | null
    if (state?.openAdd) {
      setAddType(state.openAdd)
      setAddOpen(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const filtered = useMemo(() => {
    return debts.filter((d) => {
      if (tab !== 'all' && d.type !== tab) return false
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const matches =
          d.person.name.toLowerCase().includes(q) ||
          (d.description ?? '').toLowerCase().includes(q) ||
          (d.category?.name ?? '').toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [debts, tab, statusFilter, search])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Movimentações</h1>
          <p className="text-ink-400 text-sm">Tudo o que você tem a receber e a pagar</p>
        </div>
        <button
          onClick={() => {
            setAddType('receivable')
            setAddOpen(true)
          }}
          className="btn-primary px-3 py-2"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Adicionar</span>
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por pessoa, descrição ou categoria..."
          className="input pl-10"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['all', 'receivable', 'payable'] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              tab === t ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900' : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400'
            }`}
          >
            {t === 'all' ? 'Todas' : t === 'receivable' ? 'A receber' : 'A pagar'}
          </button>
        ))}
        <span className="w-px bg-ink-200 dark:bg-ink-700 mx-1" />
        {(['all', 'pending', 'partially_paid', 'overdue', 'paid'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              statusFilter === s ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900' : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400'
            }`}
          >
            {{ all: 'Todos status', pending: 'Pendente', partially_paid: 'Parcial', overdue: 'Atrasado', paid: 'Pago' }[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration={<AnimatedMascot size={140} />}
          title={debts.length === 0 ? 'Você está começando do zero' : 'Nada encontrado'}
          description={
            debts.length === 0
              ? 'Adicione sua primeira movimentação financeira.'
              : 'Tente ajustar os filtros ou o termo buscado.'
          }
          action={
            debts.length === 0 ? (
              <button onClick={() => setAddOpen(true)} className="btn-primary">
                <Plus size={16} /> Adicionar movimentação
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((d) => (
            <DebtCard
              key={d.id}
              debt={d}
              onClick={() => navigate(`/pessoas/${d.person_id}`)}
              onRegisterPayment={() => setPaymentDebt(d)}
              onEdit={() => setEditingDebt(d)}
            />
          ))}
        </div>
      )}

      <AddDebtModal open={addOpen} onClose={() => setAddOpen(false)} defaultType={addType} />
      <AddDebtModal open={!!editingDebt} onClose={() => setEditingDebt(null)} editDebt={editingDebt} />
      <RegisterPaymentModal open={!!paymentDebt} onClose={() => setPaymentDebt(null)} debt={paymentDebt} />
    </div>
  )
}
