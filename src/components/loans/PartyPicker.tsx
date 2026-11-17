import { useEffect, useState } from 'react'
import { Search, BadgeCheck, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../ui/Avatar'
import type { FoundUser } from '../../types/database'

export interface PartyValue {
  name: string
  email: string
  userId: string | null
}

/**
 * Campo de pessoa de um empréstimo (devedor ou co-fundador).
 * Dá pra só digitar nome (+ e-mail opcional) ou vincular a um usuário do app.
 * Vinculado, ele vê o empréstimo na conta dele. Com e-mail de quem ainda não tem conta,
 * o acesso é liberado sozinho assim que a pessoa se cadastrar com esse e-mail.
 */
export function PartyPicker({
  value,
  onChange,
  nameLabel,
}: {
  value: PartyValue
  onChange: (v: PartyValue) => void
  nameLabel: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (value.userId || query.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_users_by_name', { p_query: query })
      setResults((data as FoundUser[]) ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, value.userId])

  return (
    <div className="space-y-3">
      <div>
        <label className="label">{nameLabel} *</label>
        <input
          required
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className="input"
          placeholder="Nome"
        />
      </div>

      {value.userId ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 dark:bg-brand-500/10 px-3 py-2 text-sm text-brand-700 dark:text-brand-400">
          <span className="flex items-center gap-1.5">
            <BadgeCheck size={16} /> Vinculado a um usuário do app. Ele já vê o empréstimo.
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...value, userId: null })}
            className="p-1 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-500/20"
            aria-label="Remover vínculo"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div>
            <label className="label">E-mail (para liberar o acesso quando ele criar conta)</label>
            <input
              type="email"
              value={value.email}
              onChange={(e) => onChange({ ...value, email: e.target.value })}
              className="input"
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label className="label">Ou procure quem já tem conta (nome ou @usuário)</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input pl-9"
                placeholder="Buscar no Skeello Cash"
              />
            </div>
            {searching && <p className="text-xs text-ink-400 mt-1.5">Buscando...</p>}
            {results.length > 0 && (
              <div className="mt-2 rounded-xl border border-ink-100 dark:border-ink-700 divide-y divide-ink-100 dark:divide-ink-800">
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onChange({ name: value.name || u.name, email: '', userId: u.id })
                      setQuery('')
                      setResults([])
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-ink-50 dark:hover:bg-ink-800 transition"
                  >
                    <Avatar src={u.avatar_url} name={u.name} size="sm" />
                    <span className="text-sm text-ink-900 dark:text-ink-50">
                      {u.name} <span className="text-ink-400">@{u.username}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
