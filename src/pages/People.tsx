import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Archive } from 'lucide-react'
import { usePeople } from '../hooks/usePeople'
import { useDebts } from '../hooks/useDebts'
import { Avatar } from '../components/ui/Avatar'
import { EmptyState } from '../components/ui/EmptyState'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'
import { FriendsPanel } from '../components/people/FriendsPanel'
import { usePendingRequestCount } from '../hooks/useFriends'
import { AddPersonModal } from '../components/people/AddPersonModal'
import { formatCurrency } from '../lib/format'

export default function People() {
  const location = useLocation()
  const navigate = useNavigate()
  const { people, loading } = usePeople()
  const { debts } = useDebts({ includeArchived: false })
  const [addOpen, setAddOpen] = useState(false)
  const [tab, setTab] = useState<'people' | 'requests'>(() => ((location.state as { tab?: string } | null)?.tab === 'requests' ? 'requests' : 'people'))
  const pending = usePendingRequestCount()

  useEffect(() => {
    const st = location.state as { openAdd?: boolean; tab?: string } | null
    if (st?.openAdd) {
      setAddOpen(true)
      window.history.replaceState({}, '')
    }
    if (st?.tab === 'requests') setTab('requests')
  }, [location.state])

  function balanceFor(personId: string) {
    const personDebts = debts.filter((d) => d.person_id === personId && d.status !== 'cancelled')
    const receivable = personDebts.filter((d) => d.type === 'receivable').reduce((s, d) => s + d.totals.remaining_amount, 0)
    const payable = personDebts.filter((d) => d.type === 'payable').reduce((s, d) => s + d.totals.remaining_amount, 0)
    return { receivable, payable }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Pessoas</h1>
          <p className="text-ink-400 text-sm">Quem está envolvido nas suas movimentações</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/pessoas/arquivadas')} className="btn-secondary px-3 py-2" title="Arquivadas">
            <Archive size={16} />
          </button>
          <button onClick={() => setAddOpen(true)} className="btn-primary px-3 py-2">
            <Plus size={16} />
            <span className="hidden sm:inline">Adicionar</span>
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-ink-100 dark:bg-ink-800">
        <button
          onClick={() => setTab('people')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            tab === 'people' ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-50 shadow-sm' : 'text-ink-500 dark:text-ink-400'
          }`}
        >
          Pessoas
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            tab === 'requests' ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-50 shadow-sm' : 'text-ink-500 dark:text-ink-400'
          }`}
        >
          Solicitações e amigos
          {pending > 0 && <span className="ml-1.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] text-white">{pending}</span>}
        </button>
      </div>

      {tab === 'requests' && <FriendsPanel />}

      {tab === 'people' && (
        <>
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <EmptyState
          illustration={<AnimatedMascot size={140} />}
          title="Você ainda não adicionou ninguém"
          description="Comece cadastrando uma pessoa que precisa pagar você ou que você deve algo."
          action={
            <button onClick={() => setAddOpen(true)} className="btn-primary">
              <Plus size={16} /> Adicionar pessoa
            </button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {people.map((person) => {
            const { receivable, payable } = balanceFor(person.id)
            // só o saldo: o que passa de um lado ao outro. Quem te deve mais = verde, quem você deve mais = vermelho.
            const net = Math.round((receivable - payable) * 100) / 100
            return (
              <div
                key={person.id}
                onClick={() => navigate(`/pessoas/${person.id}`)}
                className="card p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition animate-pop"
              >
                <Avatar src={person.photo_url} name={person.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900 dark:text-ink-50 truncate">{person.name}</p>
                  {net > 0.009 && (
                    <p className="text-sm font-medium text-brand-600 dark:text-brand-400">Você tem a receber: {formatCurrency(net)}</p>
                  )}
                  {net < -0.009 && (
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Você deve: {formatCurrency(Math.abs(net))}</p>
                  )}
                  {Math.abs(net) <= 0.009 && (
                    <p className="text-sm text-ink-400">{receivable > 0 || payable > 0 ? 'Quites: um cobre o outro' : 'Sem pendências'}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

        </>
      )}

      <AddPersonModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
