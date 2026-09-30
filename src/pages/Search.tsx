import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search as SearchIcon } from 'lucide-react'
import { useDebts } from '../hooks/useDebts'
import { usePeople } from '../hooks/usePeople'
import { DebtCard } from '../components/debts/DebtCard'
import { Avatar } from '../components/ui/Avatar'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'
import { formatCurrency } from '../lib/format'

export default function Search() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { debts } = useDebts({ includeArchived: false })
  const { people } = usePeople()

  const matchedPeople = useMemo(() => {
    if (!query) return []
    const q = query.toLowerCase()
    return people.filter((p) => p.name.toLowerCase().includes(q) || (p.nickname ?? '').toLowerCase().includes(q))
  }, [people, query])

  const matchedDebts = useMemo(() => {
    if (!query) return []
    const q = query.toLowerCase()
    return debts.filter(
      (d) =>
        d.person.name.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q) ||
        (d.category?.name ?? '').toLowerCase().includes(q) ||
        String(d.amount).includes(q)
    )
  }, [debts, query])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-ink-400">
          <ArrowLeft size={18} />
        </button>
        <div className="relative flex-1">
          <SearchIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Buscar "João", "R$ 500", "Empréstimo"...'
            className="input pl-10"
          />
        </div>
      </div>

      {query && matchedPeople.length === 0 && matchedDebts.length === 0 && (
        <div className="flex flex-col items-center text-center py-12">
          <AnimatedMascot size={120} className="mb-3" />
          <p className="text-sm text-ink-400">Nada encontrado para "{query}".</p>
        </div>
      )}

      {matchedPeople.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-ink-400 uppercase mb-2">Pessoas</h2>
          <div className="space-y-2">
            {matchedPeople.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/pessoas/${p.id}`)}
                className="w-full card p-3 flex items-center gap-3 text-left"
              >
                <Avatar src={p.photo_url} name={p.name} size="sm" />
                <span className="text-sm font-medium text-ink-900 dark:text-ink-50">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedDebts.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-ink-400 uppercase mb-2">Movimentações</h2>
          <div className="space-y-2.5">
            {matchedDebts.map((d) => (
              <DebtCard key={d.id} debt={d} onClick={() => navigate(`/pessoas/${d.person_id}`)} />
            ))}
          </div>
        </div>
      )}

      {!query && (
        <p className="text-center text-sm text-ink-400 py-10">
          Pesquise por nome, valor (ex: {formatCurrency(500)}), categoria ou descrição.
        </p>
      )}
    </div>
  )
}
