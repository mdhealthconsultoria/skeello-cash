import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Check, Copy, Search, Share2, UserMinus, UserPlus, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useFriends } from '../../hooks/useFriends'
import { usePeople } from '../../hooks/usePeople'
import { Avatar } from '../ui/Avatar'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import type { FoundUser } from '../../types/database'

/** Solicitações de amizade, busca por @usuário e lista de amigos. Quem aceita vira amigo e pode receber cobranças. */
export function FriendsPanel() {
  const { profile } = useAuth()
  const { friends, incoming, outgoing, available, loading, sendRequest, respond, cancel, removeFriend } = useFriends()
  const { searchUsersByName } = usePeople()

  const [query, setQuery] = useState('')
  const [found, setFound] = useState<FoundUser | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [searching, setSearching] = useState(false)
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null)

  const handle = profile?.username ? `@${profile.username}` : ''
  const siteUrl = `${window.location.origin}${import.meta.env.BASE_URL}`

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(handle)
      toast.success('Seu @usuário foi copiado!')
    } catch {
      toast.error('Não consegui copiar.')
    }
  }

  async function invite() {
    const text = `Me adiciona no Skeello Cash para a gente organizar o que um deve ao outro. Meu usuário é ${handle}. Acesse: ${siteUrl}`
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      toast.success('Convite copiado! Cole no WhatsApp.')
    } catch {
      /* fechou o compartilhar */
    }
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    const q = query.trim().replace(/^@/, '')
    if (q.length < 3) return toast.error('Digite o @usuário completo do seu amigo.')
    setSearching(true)
    const { users, error } = await searchUsersByName(q)
    setSearching(false)
    if (error) return toast.error(error)
    const exact = users.find((u) => u.username.toLowerCase() === q.toLowerCase()) ?? null
    setFound(exact)
    setNotFound(!exact)
  }

  async function handleAdd(u: FoundUser) {
    const { status, error } = await sendRequest(u)
    if (error) return toast.error(error)
    toast.success(status === 'accepted' ? `Vocês agora são amigos!` : `Solicitação enviada para ${u.name}.`)
  }

  const isFriend = found ? friends.some((f) => f.id === found.id) : false
  const sent = found ? outgoing.some((r) => r.user_id === found.id) : false
  const theyAsked = found ? incoming.find((r) => r.user_id === found.id) : undefined

  if (!available && !loading) {
    return (
      <div className="card p-5 text-sm text-ink-500 dark:text-ink-400 space-y-2">
        <p className="font-medium text-ink-900 dark:text-ink-50">Amizades ainda não estão ativas no banco</p>
        <p>Falta rodar a migração 0013 no Supabase (arquivo supabase/migrations/0013_friend_requests.sql).</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Meu usuário */}
      <div className="card p-4 space-y-3">
        <div>
          <p className="text-xs text-ink-400">Seu @usuário (passe para quem quer te adicionar)</p>
          <p className="text-lg font-bold text-ink-900 dark:text-ink-50">{handle || '...'}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copyHandle} disabled={!handle} className="btn-secondary py-2.5 text-sm">
            <Copy size={15} /> Copiar
          </button>
          <button onClick={invite} disabled={!handle} className="btn-secondary py-2.5 text-sm">
            <Share2 size={15} /> Convidar
          </button>
        </div>
      </div>

      {/* Buscar */}
      <form onSubmit={handleSearch} className="space-y-2">
        <label className="label">Achar alguém pelo @usuário</label>
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
        {notFound && <p className="text-xs text-ink-400">Não achei esse @usuário. Confira se está completo, ou use "Convidar" acima.</p>}
      </form>

      {found && (
        <div className="card p-3.5 flex items-center gap-3">
          <Avatar src={found.avatar_url} name={found.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink-900 dark:text-ink-50 truncate">{found.name}</p>
            <p className="text-xs text-ink-400 truncate">@{found.username}</p>
          </div>
          {isFriend ? (
            <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Já é amigo</span>
          ) : sent ? (
            <span className="text-xs text-ink-400">Solicitação enviada</span>
          ) : theyAsked ? (
            <button
              onClick={async () => {
                const { error } = await respond(theyAsked.id, true)
                if (error) toast.error(error)
                else toast.success('Vocês agora são amigos!')
              }}
              className="btn-primary px-3 py-2 text-xs"
            >
              Aceitar
            </button>
          ) : (
            <button onClick={() => handleAdd(found)} className="btn-primary px-3 py-2 text-xs">
              <UserPlus size={14} /> Adicionar
            </button>
          )}
        </div>
      )}

      {/* Recebidas */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">
          Solicitações recebidas {incoming.length > 0 && <span className="text-brand-600">({incoming.length})</span>}
        </h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-ink-400">Nenhuma solicitação esperando você.</p>
        ) : (
          incoming.map((r) => (
            <div key={r.id} className="card p-3.5 flex items-center gap-3">
              <Avatar src={r.avatar_url} name={r.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900 dark:text-ink-50 truncate">{r.name}</p>
                <p className="text-xs text-ink-400 truncate">@{r.username} quer ser seu amigo</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={async () => {
                    const { error } = await respond(r.id, true)
                    if (error) toast.error(error)
                    else toast.success(`${r.name} agora é seu amigo!`)
                  }}
                  className="btn-primary px-3 py-2"
                  aria-label="Aceitar"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={async () => {
                    const { error } = await respond(r.id, false)
                    if (error) toast.error(error)
                  }}
                  className="btn-secondary px-3 py-2"
                  aria-label="Recusar"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Enviadas */}
      {outgoing.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Solicitações enviadas</h2>
          {outgoing.map((r) => (
            <div key={r.id} className="card p-3.5 flex items-center gap-3">
              <Avatar src={r.avatar_url} name={r.name} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900 dark:text-ink-50 truncate">{r.name}</p>
                <p className="text-xs text-ink-400">Esperando aceitar</p>
              </div>
              <button
                onClick={async () => {
                  const { error } = await cancel(r.id)
                  if (error) toast.error(error)
                }}
                className="text-xs font-medium text-ink-500 hover:text-red-600"
              >
                Cancelar
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Amigos */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Meus amigos {friends.length > 0 && `(${friends.length})`}</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-ink-400">Ainda nenhum. Peça o @usuário de quem você quer cobrar ou mande o convite.</p>
        ) : (
          friends.map((f) => (
            <div key={f.id} className="card p-3.5 flex items-center gap-3">
              <Avatar src={f.avatar_url} name={f.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900 dark:text-ink-50 truncate">{f.name}</p>
                <p className="text-xs text-ink-400 truncate">@{f.username}</p>
              </div>
              <button
                onClick={() => setRemoving({ id: f.id, name: f.name })}
                className="p-2 text-ink-300 hover:text-red-600"
                aria-label={`Remover ${f.name} dos amigos`}
              >
                <UserMinus size={16} />
              </button>
            </div>
          ))
        )}
      </section>

      <ConfirmDialog
        open={!!removing}
        title={`Remover ${removing?.name ?? ''} dos amigos?`}
        message="Vocês deixam de ser amigos e ele sai das sugestões. As dívidas e empréstimos que já existem continuam. A pessoa continua na sua lista, só sem o vínculo com a conta."
        confirmLabel="Remover"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          const { error } = await removeFriend(removing.id)
          if (error) toast.error(error)
          setRemoving(null)
        }}
      />
    </div>
  )
}
