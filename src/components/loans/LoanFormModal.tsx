import { useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { PartyPicker, type PartyValue } from './PartyPicker'
import { formatCurrency } from '../../lib/format'
import { parseMoney, round2, withRate } from '../../lib/loans'
import type { FunderInput, LoanInput } from '../../hooks/useLoans'
import type { LoanFull } from '../../types/database'

interface FunderDraft {
  key: string
  id?: string
  party: PartyValue
  amount: string
  rate: string
  canSeeBorrower: boolean
  canSeePayments: boolean
}

const today = () => new Date().toISOString().slice(0, 10)
const num = (n: number) => String(n).replace('.', ',')
let counter = 0
const newKey = () => `f${++counter}`

function blankFunder(): FunderDraft {
  return {
    key: newKey(),
    party: { name: '', email: '', userId: null },
    amount: '',
    rate: '',
    canSeeBorrower: false,
    canSeePayments: true,
  }
}

export function LoanFormModal({
  open,
  onClose,
  editLoan,
  onSave,
}: {
  open: boolean
  onClose: () => void
  editLoan?: LoanFull | null
  onSave: (input: LoanInput, funders: FunderInput[], editId?: string) => Promise<{ id: string | null; error: string | null }>
}) {
  const [borrower, setBorrower] = useState<PartyValue>({ name: '', email: '', userId: null })
  const [principal, setPrincipal] = useState('')
  const [rate, setRate] = useState('')
  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [funders, setFunders] = useState<FunderDraft[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editLoan) {
      setBorrower({
        name: editLoan.borrower_name,
        email: editLoan.borrower_email ?? '',
        userId: editLoan.borrower_user_id,
      })
      setPrincipal(num(editLoan.principal))
      setRate(num(editLoan.borrower_rate))
      setIssueDate(editLoan.issue_date)
      setDueDate(editLoan.due_date)
      setNotes(editLoan.notes ?? '')
      setFunders(
        editLoan.funders.map((f) => ({
          key: newKey(),
          id: f.id,
          party: { name: f.funder_name, email: f.funder_email ?? '', userId: f.funder_user_id },
          amount: num(f.amount),
          rate: num(f.rate),
          canSeeBorrower: f.can_see_borrower,
          canSeePayments: f.can_see_payments,
        }))
      )
    } else {
      setBorrower({ name: '', email: '', userId: null })
      setPrincipal('')
      setRate('')
      setIssueDate(today())
      setDueDate('')
      setNotes('')
      setFunders([blankFunder()])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editLoan?.id])

  // a conta ao vivo: o que o devedor paga, o que devolvo a cada um e o que sobra pra mim
  const calc = useMemo(() => {
    const p = parseMoney(principal)
    const r = parseMoney(rate)
    const total = withRate(p, r)
    const rows = funders.map((f) => {
      const a = parseMoney(f.amount)
      return { key: f.key, name: f.party.name || 'Co-fundador', amount: a, total: withRate(a, parseMoney(f.rate)) }
    })
    const funded = round2(rows.reduce((s, x) => s + x.amount, 0))
    const funderTotal = round2(rows.reduce((s, x) => s + x.total, 0))
    const own = round2(Math.max(p - funded, 0))
    return { p, r, total, rows, funded, funderTotal, own, profit: round2(total - funderTotal - own) }
  }, [principal, rate, funders])

  function patchFunder(key: string, patch: Partial<FunderDraft>) {
    setFunders((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const filled = funders.filter((f) => f.party.name.trim() || f.amount.trim())
    if (calc.p <= 0) return toast.error('Informe o valor emprestado.')
    if (!dueDate) return toast.error('Informe a data de vencimento.')
    if (calc.funded > calc.p + 0.009) {
      return toast.error('Os valores dos co-fundadores somam mais que o valor emprestado.')
    }
    for (const f of filled) {
      if (!f.party.name.trim()) return toast.error('Dê um nome a cada co-fundador.')
      if (parseMoney(f.amount) <= 0) return toast.error(`Informe o valor de ${f.party.name}.`)
    }

    setLoading(true)
    const { error } = await onSave(
      {
        borrower_name: borrower.name.trim(),
        borrower_email: borrower.email.trim() || null,
        borrower_user_id: borrower.userId,
        principal: calc.p,
        borrower_rate: calc.r,
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes.trim() || null,
      },
      filled.map((f) => ({
        id: f.id,
        funder_name: f.party.name.trim(),
        funder_email: f.party.email.trim() || null,
        funder_user_id: f.party.userId,
        amount: parseMoney(f.amount),
        rate: parseMoney(f.rate),
        can_see_borrower: f.canSeeBorrower,
        can_see_payments: f.canSeePayments,
      })),
      editLoan?.id
    )
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(editLoan ? 'Empréstimo atualizado!' : 'Empréstimo criado!')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editLoan ? 'Editar empréstimo' : 'Novo empréstimo'}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">1. Quem te emprestou o dinheiro (co-fundador)</h3>
            <button
              type="button"
              onClick={() => setFunders((p) => [...p, blankFunder()])}
              className="text-xs font-medium text-ink-900 dark:text-white flex items-center gap-1"
            >
              <Plus size={14} /> Outro co-fundador
            </button>
          </div>
          {funders.length === 0 && (
            <p className="text-xs text-ink-400">
              Coloque aqui a pessoa que te emprestou o dinheiro e a % que você vai pagar a ela. Ela vai ver o valor, as datas e quanto vai receber. Se o dinheiro é só seu, remova este quadro.
            </p>
          )}
          {funders.map((f) => (
            <div key={f.key} className="rounded-2xl border border-ink-100 dark:border-ink-700 p-3 space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setFunders((p) => p.filter((x) => x.key !== f.key))}
                  className="p-1 text-ink-400 hover:text-red-600"
                  aria-label="Remover co-fundador"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <PartyPicker value={f.party} onChange={(party) => patchFunder(f.key, { party })} nameLabel="Nome do co-fundador" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor que ele te emprestou (R$)</label>
                  <input
                    inputMode="decimal"
                    value={f.amount}
                    onChange={(e) => patchFunder(f.key, { amount: e.target.value })}
                    className="input"
                    placeholder="500,00"
                  />
                </div>
                <div>
                  <label className="label">% que você paga a ele</label>
                  <input
                    inputMode="decimal"
                    value={f.rate}
                    onChange={(e) => patchFunder(f.key, { rate: e.target.value })}
                    className="input"
                    placeholder="10"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="label !mb-0">O que ele pode ver</p>
                <p className="text-xs text-ink-400">Ele sempre vê o valor dele, a % dele e quando vai receber. Nunca vê o que você cobra do devedor.</p>
                <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
                  <input
                    type="checkbox"
                    checked={f.canSeeBorrower}
                    onChange={(e) => patchFunder(f.key, { canSeeBorrower: e.target.checked })}
                  />
                  O nome do devedor
                </label>
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">2. Para quem você vai emprestar (devedor)</h3>
          <PartyPicker value={borrower} onChange={setBorrower} nameLabel="Nome do devedor" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor que você empresta ao devedor (R$) *</label>
              <input
                required
                inputMode="decimal"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="input"
                placeholder="500,00"
              />
            </div>
            <div>
              <label className="label">Juros que o devedor paga (%) *</label>
              <input
                required
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="input"
                placeholder="15"
              />
            </div>
            <div>
              <label className="label">Data do empréstimo</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Vencimento *</label>
              <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-ink-50 dark:bg-ink-800 p-4 space-y-1.5 text-sm">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50 mb-1">A conta</h3>
          <Row label={`${borrower.name || 'Devedor'} paga no vencimento`} value={formatCurrency(calc.total)} strong />
          {calc.rows.filter((r) => r.amount > 0).map((r) => (
            <Row key={r.key} label={`Você devolve a ${r.name}`} value={formatCurrency(r.total)} />
          ))}
          {calc.own > 0 && funders.length > 0 && <Row label="Saiu do seu bolso" value={formatCurrency(calc.own)} />}
          <div className="border-t border-ink-200 dark:border-ink-700 pt-1.5 mt-1.5">
            <Row
              label="Sobra pra você"
              value={formatCurrency(calc.profit)}
              strong
              tone={calc.profit < 0 ? 'text-red-600' : 'text-brand-600 dark:text-brand-400'}
            />
          </div>
          {calc.funded > calc.p + 0.009 && (
            <p className="text-xs text-red-600">Os co-fundadores somam mais que o valor emprestado.</p>
          )}
        </section>

        <div>
          <label className="label">Observações</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input resize-none" rows={2} />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
          {loading ? 'Salvando...' : editLoan ? 'Salvar alterações' : 'Criar empréstimo'}
        </button>
      </form>
    </Modal>
  )
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500 dark:text-ink-400">{label}</span>
      <span className={`${strong ? 'font-semibold' : ''} ${tone ?? 'text-ink-900 dark:text-ink-50'}`}>{value}</span>
    </div>
  )
}
