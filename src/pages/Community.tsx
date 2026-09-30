import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { useCommunity } from '../hooks/useCommunity'
import { Avatar } from '../components/ui/Avatar'
import { EmptyState } from '../components/ui/EmptyState'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'
import { AddPersonModal } from '../components/people/AddPersonModal'
import type { FoundUser } from '../types/database'

export default function Community() {
  const navigate = useNavigate()
  const { users, totalCount, loading, loadingMore, hasMore, loadMore } = useCommunity()
  const [addTarget, setAddTarget] = useState<FoundUser | null>(null)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-ink-400">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Pessoas no Skeello Cash</h1>
          {totalCount !== null && (
            <p className="text-xs text-ink-400">{totalCount} pessoa{totalCount === 1 ? '' : 's'} usando o app</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          illustration={<AnimatedMascot size={140} />}
          title="Ainda não tem ninguém por aqui"
          description="Quando mais gente criar conta no Skeello Cash, vão aparecer aqui pra você adicionar."
        />
      ) : (
        <>
          <div className="space-y-2.5">
            {users.map((u) => (
              <div key={u.id} className="card p-3.5 flex items-center gap-3">
                <Avatar src={u.avatar_url} name={u.name} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900 dark:text-ink-50 truncate">{u.name}</p>
                  <p className="text-xs text-ink-400 truncate">@{u.username}</p>
                </div>
                <button
                  onClick={() => setAddTarget(u)}
                  className="btn-secondary px-3 py-1.5 text-xs shrink-0"
                >
                  <UserPlus size={13} /> Adicionar
                </button>
              </div>
            ))}
          </div>

          {hasMore && (
            <button onClick={loadMore} disabled={loadingMore} className="btn-secondary w-full py-2.5">
              {loadingMore ? 'Carregando...' : 'Carregar mais'}
            </button>
          )}
        </>
      )}

      <AddPersonModal
        key={addTarget?.id ?? 'none'}
        open={!!addTarget}
        onClose={() => setAddTarget(null)}
        presetUser={addTarget}
      />
    </div>
  )
}
