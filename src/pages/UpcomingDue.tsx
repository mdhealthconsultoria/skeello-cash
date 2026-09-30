import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useDebts } from '../hooks/useDebts'
import { DebtCard } from '../components/debts/DebtCard'
import { EmptyState } from '../components/ui/EmptyState'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'

export default function UpcomingDue() {
  const navigate = useNavigate()
  const { debts, loading } = useDebts({ includeArchived: false })

  const sorted = useMemo(() => {
    return debts
      .filter((d) => d.due_date && d.status !== 'paid' && d.status !== 'cancelled')
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  }, [debts])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-ink-400">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Próximos vencimentos</h1>
      </div>

      {!loading && sorted.length === 0 ? (
        <EmptyState
          illustration={<AnimatedMascot size={140} />}
          title="Nada por aqui"
          description="Você não tem vencimentos pendentes."
        />
      ) : (
        <div className="space-y-2.5">
          {sorted.map((d) => (
            <DebtCard key={d.id} debt={d} onClick={() => navigate(`/pessoas/${d.person_id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}
