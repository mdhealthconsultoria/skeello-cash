import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, X } from 'lucide-react'
import { useFollowing } from '../../hooks/useFollowing'
import { usePeople } from '../../hooks/usePeople'
import { Avatar } from '../ui/Avatar'
import type { FoundUser } from '../../types/database'

export interface PartyValue {
  name: string
  email: string
  userId: string | null
}

/** O campo aceita e-mail ou @usuário. Só e-mail de verdade vai para o banco. */
export function cleanEmail(raw: string): string | null {
  const v = raw.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null
}

interface Suggestion {
  key: string
  name: string
  email: string
  userId: string | null
  avatar: string | null
  tag: string
}

/**
 * Campo de pessoa de um empréstimo (devedor ou co-fundador).
 * - Digite o nome, ou escolha uma sugestão: amigos que você segue no app e pessoas que você já salvou.
 * - No segundo campo vale o e-mail ou o @usuário da pessoa. Com o @usuário certo, o app acha a conta e vincula.
 * Quem não é do app entra pelo código do empréstimo.
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
  const { following } = useFollowing()
  const { people, searchUsersByName } = usePeople()
  const [found, setFound] = useState<FoundUser | null>(null)
  const [looking, setLooking] = useState(false)

  const suggestions = useMemo(() => {
    const q = value.name.trim().toLowerCase().replace(/^@/, '')
    const list: Suggestion[] = []
    const seenUsers = new Set<string>()
    for (const u of following) {
      seenUsers.add(u.id)
      list.push({ key: `u${u.id}`, name: u.name, email: '', userId: u.id, avatar: u.avatar_url, tag: 'no app' })
    }
    for (const p of people) {
      if (p.linked_user_id) {
        if (seenUsers.has(p.linked_user_id)) continue
        seenUsers.add(p.linked_user_id)
        list.push({ key: `p${p.id}`, name: p.name, email: p.email ?? '', userId: p.linked_user_id, avatar: p.photo_url, tag: 'no app' })
      } else {
        list.push({ key: `p${p.id}`, name: p.name, email: p.email ?? '', userId: null, avatar: p.photo_url, tag: 'salvo' })
      }
    }
    return list
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .filter((s) => s.name.trim().toLowerCase() !== value.name.trim().toLowerCase())
      .slice(0, 8)
  }, [following, people, value.name])

  // @usuário digitado no segundo campo: procura a conta (usuário exato)
  const handle = value.email.trim().startsWith('@') ? value.email.trim().replace(/^@/, '') : ''
  useEffect(() => {
    setFound(null)
    if (handle.length < 3) return
    setLooking(true)
    const t = setTimeout(async () => {
      const { users } = await searchUsersByName(handle)
      const exact = users.find((u) => u.username.toLowerCase() === handle.toLowerCase()) ?? null
      setFound(exact)
      setLooking(false)
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle])

  return (
    <div className="space-y-3">
      <div>
        <label className="label">{nameLabel} *</label>
        <input
          required
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value, userId: value.userId ? null : value.userId })}
          className="input"
          placeholder="Nome"
          autoComplete="off"
        />
      </div>

      {value.userId ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 dark:bg-brand-500/10 px-3 py-2 text-sm text-brand-700 dark:text-brand-400">
          <span className="flex items-center gap-1.5">
            <BadgeCheck size={16} /> Tem conta no app. Ele já vê o empréstimo na conta dele.
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
          {suggestions.length > 0 && (
            <div>
              <p className="label">Sugestões</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onChange({ name: s.name, email: s.email, userId: s.userId })}
                    className="flex items-center gap-2 rounded-full border border-ink-100 dark:border-ink-700 pl-1 pr-3 py-1 hover:bg-ink-50 dark:hover:bg-ink-800 transition"
                  >
                    <Avatar src={s.avatar} name={s.name} size="sm" />
                    <span className="text-sm text-ink-900 dark:text-ink-50">{s.name}</span>
                    {s.tag === 'no app' && <BadgeCheck size={13} className="text-brand-500" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label">E-mail ou @usuário (opcional)</label>
            <input
              value={value.email}
              onChange={(e) => onChange({ ...value, email: e.target.value })}
              className="input"
              placeholder="email@exemplo.com ou @usuario"
              autoComplete="off"
              autoCapitalize="none"
            />
            {looking && <p className="text-xs text-ink-400 mt-1.5">Procurando @{handle}...</p>}
            {found && (
              <button
                type="button"
                onClick={() => onChange({ name: value.name.trim() || found.name, email: '', userId: found.id })}
                className="mt-2 flex w-full items-center gap-2 rounded-xl border border-brand-200 dark:border-brand-500/30 bg-brand-50 dark:bg-brand-500/10 px-3 py-2 text-left"
              >
                <Avatar src={found.avatar_url} name={found.name} size="sm" />
                <span className="text-sm text-brand-700 dark:text-brand-400">
                  Vincular a {found.name} (@{found.username})
                </span>
              </button>
            )}
            {handle.length >= 3 && !looking && !found && (
              <p className="text-xs text-ink-400 mt-1.5">Não achei esse @usuário. Confira se está completo.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
