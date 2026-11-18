import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Search, UserPlus } from 'lucide-react'
import { useFollowing } from '../hooks/useFollowing'
import { usePeople } from '../hooks/usePeople'
import { Avatar } from '../components/ui/Avatar'
import { EmptyState } from '../components/ui/EmptyState'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'
import { AddPersonModal } from '../components/people/AddPersonModal'
import type { FoundUser } from '../types/database'

/** Amigos no app: você acha alguém pelo @usuário exato e passa a seguir. Não existe lista pública de usuários. */
export default function Community() {
  const navigate = useNavigate()
  const { following, loading, refetch } = useFollowing()
  const { searchUsersByName } = usePeople()
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<FoundUser | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [searching, setSearching] = useState(false)
  const [addTarget, setAddTarget] = useState<FoundUser | null>(null)

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim().replace(/^@/, '')
    if (q.length < 3) return toast.error('Digite o @usuário completo do seu amigo.')
    setSearching(true)
    const { users, error } = await searchUsersByName(q)
    setSearching(false)
    if (error) return toast.error(error)
    setFound(users[0] ?? null)
    setNotFound(users.length === 0)
  }

  const alreadyFollowing = found ? following.some((f) => f.id === found.id) : false

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-ink-400">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Amigos no Skeello Cash</h1>
          <p className="text-xs text-ink-400">Só quem você segue aparece como sugestão nos empréstimos e nas pessoas.</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="space-y-2">
        <label className="label">Achar um amigo pelo @usuário</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setNotFound(false)
              }}
              className="input pl-9"
              placeholder="@usuario"
              autoCapitalize="none"
              autoComplete="off"
            />
          </div>
          <button type="submit" disabled={searching} className="btn-primary px-4">
            {searching ? '...' : 'Buscar'}
          </button>
        </div>
        <p className="text-xs text-ink-400">O @usuário aparece em Configurações, no perfil do seu amigo.</p>
      </form>

      {found && (
        <div className="card p-3.5 flex items-center gap-3">
          <Avatar src={found.avatar_url} name={found.name} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink-900 dark:text-ink-50 truncate">{found.name}</p>
            <p className="text-xs text-ink-400 truncate">@{found.username}</p>
          </div>
          {alreadyFollowing ? (
            <span className="text-xs text-ink-400">Você já segue</span>
          ) : (
            <button onClick={() => setAddTarget(found)} className="btn-secondary px-3 py-1.5 text-xs shrink-0">
              <UserPlus size={13} /> Seguir
            </button>
          )}
        </div>
      )}
      {notFound && <p className="text-sm text-ink-500">Ninguém encontrado com esse @usuário. Confira com seu amigo.</p>}

      <div className="space-y-2.5">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Quem você segue ({following.length})</h2>
        {loading ? (
          <div className="card h-16 animate-pulse" />
        ) : following.length === 0 ? (
          <EmptyState
            illustration={<AnimatedMascot size={140} />}
            title="Você ainda não segue ninguém"
            description="Busque o @usuário de um amigo acima. Quem você seguir aparece como sugestão quando for adicionar alguém."
          />
        ) : (
          following.map((u) => (
            <div key={u.id} className="card p-3.5 flex items-center gap-3">
              <Avatar src={u.avatar_url} name={u.name} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-ink-900 dark:text-ink-50 truncate">{u.name}</p>
                <p className="text-xs text-ink-400 truncate">@{u.username}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <AddPersonModal
        key={addTarget?.id ?? 'none'}
        open={!!addTarget}
        onClose={() => {
          setAddTarget(null)
          refetch()
        }}
        presetUser={addTarget}
      />
    </div>
  )
}
