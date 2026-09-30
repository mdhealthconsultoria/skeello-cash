import { useState } from 'react'
import toast from 'react-hot-toast'
import { Check, X, Link2 } from 'lucide-react'
import { useDebtInvites } from '../../hooks/useDebtInvites'
import { Avatar } from '../ui/Avatar'
import { formatCurrency } from '../../lib/format'

export function DebtInvites() {
  const { invites, loading, respond } = useDebtInvites()
  const [respondingId, setRespondingId] = useState<string | null>(null)

  if (loading || invites.length === 0) return null

  async function handleRespond(id: string, accept: boolean) {
    setRespondingId(id)
    const { error } = await respond(id, accept)
    setRespondingId(null)
    if (error) toast.error(error)
    else toast.success(accept ? 'Dívida compartilhada aceita!' : 'Convite recusado.')
  }

  return (
    <div className="card p-4 border-brand-200 dark:border-brand-500/30">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={15} className="text-brand-600 dark:text-brand-400" />
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">
          {invites.length === 1 ? 'Você tem 1 convite de dívida compartilhada' : `Você tem ${invites.length} convites de dívida compartilhada`}
        </p>
      </div>
      <div className="space-y-2.5">
        {invites.map((inv) => (
          <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-ink-50 dark:bg-ink-800">
            <Avatar src={inv.inviter_avatar_url} name={inv.inviter_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-900 dark:text-ink-50 truncate">
                <span className="font-medium">{inv.inviter_name}</span> diz que{' '}
                {inv.type === 'receivable' ? 'você deve' : 'te deve'} {formatCurrency(inv.amount)}
              </p>
              {inv.description && <p className="text-xs text-ink-400 truncate">{inv.description}</p>}
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => handleRespond(inv.id, true)}
                disabled={respondingId === inv.id}
                className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition disabled:opacity-50"
                title="Aceitar"
              >
                <Check size={15} />
              </button>
              <button
                onClick={() => handleRespond(inv.id, false)}
                disabled={respondingId === inv.id}
                className="w-8 h-8 rounded-lg bg-ink-100 dark:bg-ink-700 text-ink-500 flex items-center justify-center hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 transition disabled:opacity-50"
                title="Recusar"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
