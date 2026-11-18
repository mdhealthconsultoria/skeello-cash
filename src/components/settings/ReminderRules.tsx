import { useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { Toggle } from '../ui/Toggle'
import { useReminderRules } from '../../hooks/useReminderRules'
import type { ReminderRule } from '../../types/database'

const DAY_OPTIONS = [0, 1, 2, 3, 5, 7, 10, 15, 30]

function dayLabel(d: number) {
  if (d === 0) return 'No dia'
  if (d === 1) return '1 dia antes'
  return `${d} dias antes`
}

/** Lembretes que o usuário cria: "me avise N dias antes do que tenho a receber / a pagar". */
export function ReminderRules() {
  const { rules, loading, addRule, toggleRule, removeRule } = useReminderRules()
  const [kind, setKind] = useState<ReminderRule['kind']>('receive')
  const [days, setDays] = useState(1)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    setSaving(true)
    const { error } = await addRule(kind, days)
    setSaving(false)
    if (error) toast.error(error)
    else toast.success('Lembrete criado!')
  }

  return (
    <div className="mt-5 pt-5 border-t border-ink-100 dark:border-ink-800">
      <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50 mb-1">Meus lembretes</h3>
      <p className="text-xs text-ink-400 mb-3">
        Crie avisos como "amanhã você tem R$ 200 a receber" ou "em 3 dias você tem R$ 150 a pagar". Somamos dívidas e empréstimos que vencem naquele dia.
      </p>

      <div className="space-y-2 mb-4">
        {!loading && rules.length === 0 && <p className="text-xs text-ink-400">Nenhum lembrete. Crie o primeiro abaixo.</p>}
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl bg-ink-50 dark:bg-ink-800 px-3 py-2.5">
            {r.kind === 'receive' ? (
              <ArrowDownCircle size={16} className="text-brand-600 dark:text-brand-400 shrink-0" />
            ) : (
              <ArrowUpCircle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${r.enabled ? 'text-ink-900 dark:text-ink-50' : 'text-ink-400 line-through'}`}>
                {r.kind === 'receive' ? 'O que tenho a receber' : 'O que tenho a pagar'}
              </p>
              <p className="text-xs text-ink-400">{dayLabel(r.days_before)}</p>
            </div>
            <Toggle checked={r.enabled} onChange={(v) => toggleRule(r.id, v)} ariaLabel="Ligar ou desligar" />
            <button onClick={() => removeRule(r.id)} className="text-ink-300 hover:text-red-600" aria-label="Apagar lembrete">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as ReminderRule['kind'])} className="input">
          <option value="receive">Avisar do que vou receber</option>
          <option value="pay">Avisar do que vou pagar</option>
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input">
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {dayLabel(d)}
            </option>
          ))}
        </select>
      </div>
      <button onClick={handleAdd} disabled={saving} className="btn-secondary w-full mt-2 py-2.5">
        <Plus size={15} /> {saving ? 'Criando...' : 'Criar lembrete'}
      </button>
    </div>
  )
}
