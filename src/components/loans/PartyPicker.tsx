import { useMemo } from 'react'
import { BadgeCheck, X } from 'lucide-react'
import { useFollowing } from '../../hooks/useFollowing'
import { Avatar } from '../ui/Avatar'

export interface PartyValue {
  name: string
  email: string
  userId: string | null
}

/**
 * Campo de pessoa de um empréstimo (devedor ou co-fundador).
 * Dá pra só digitar o nome (+ e-mail opcional). Se a pessoa é um amigo seu no app,
 * ele aparece como sugestão: só quem você segue aparece, nunca a lista de todo mundo.
 * Quem não é seguido entra pelo código do empréstimo.
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

  const suggestions = useMemo(() => {
    const q = value.name.trim().toLowerCase()
    return following
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().startsWith(q.replace(/^@/, '')))
      .slice(0, 8)
  }, [following, value.name])

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
            <BadgeCheck size={16} /> Amigo do app. Ele já vê o empréstimo na conta dele.
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
              <p className="label">Seus amigos no app</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onChange({ name: u.name, email: '', userId: u.id })}
                    className="flex items-center gap-2 rounded-full border border-ink-100 dark:border-ink-700 pl-1 pr-3 py-1 hover:bg-ink-50 dark:hover:bg-ink-800 transition"
                  >
                    <Avatar src={u.avatar_url} name={u.name} size="sm" />
                    <span className="text-sm text-ink-900 dark:text-ink-50">{u.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label">E-mail (opcional)</label>
            <input
              type="email"
              value={value.email}
              onChange={(e) => onChange({ ...value, email: e.target.value })}
              className="input"
              placeholder="email@exemplo.com"
            />
          </div>
        </>
      )}
    </div>
  )
}
