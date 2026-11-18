import { useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { PartyPicker, cleanEmail, type PartyValue } from './PartyPicker'
import { formatCurrency } from '../../lib/format'
import { daysBetween, isRenewed, parseMoney, rateFromDaily, round2, withRate } from '../../lib/loans'
import { useDefaultDailyRate } from '../../hooks/useDefaultDailyRate'
import type { FunderInput, LoanInput } from '../../hooks/useLoans'
import type { LoanFull } from '../../types/database'
import { Toggle } from '../ui/Toggle'

interface FunderDraft {
  key: string
  id?: string
  party: PartyValue
  amount: string
  rate: string
  /** 'term' = % no prazo todo, 'day' = % ao dia */
  unit: RateUnit
  canSeeBorrower: boolean
  canSeePayments: boolean
  canSeeChart: boolean
  /** o banco já tem as colunas novas / o empréstimo já foi renovado (juros de vários prazos somados) */
  hasNewCols: boolean
  renewed: boolean
}

type RateUnit = 'term' | 'day'

const today = () => new Date().toISOString().slice(0, 10)
const num = (n: number) => String(n).replace('.', ',')
let counter = 0
const newKey = () => `f${++counter}`

function blankFunder(defaultDaily = 0): FunderDraft {
  return {
    key: newKey(),
    party: { name: '', email: '', userId: null },
    amount: '',
    rate: defaultDaily > 0 ? num(defaultDaily) : '',
    unit: defaultDaily > 0 ? 'day' : 'term',
    canSeeBorrower: false,
    canSeePayments: true,
    canSeeChart: false,
    hasNewCols: false,
    renewed: false,
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
  const defaultDaily = useDefaultDailyRate()
  const [rate, setRate] = useState('')
  const [rateUnit, setRateUnit] = useState<RateUnit>('term')
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
      const dailyOn = editLoan.daily_rate != null && !isRenewed(editLoan)
      setRateUnit(dailyOn ? 'day' : 'term')
      setRate(dailyOn ? num(editLoan.daily_rate as number) : num(editLoan.borrower_rate))
      setIssueDate(editLoan.issue_date)
      setDueDate(editLoan.due_date)
      setNotes(editLoan.notes ?? '')
      setFunders(
        editLoan.funders.map((f) => ({
          key: newKey(),
          id: f.id,
          party: { name: f.funder_name, email: f.funder_email ?? '', userId: f.funder_user_id },
          amount: num(f.amount),
          rate: f.daily_rate != null && !isRenewed({ borrower_rate: f.rate, term_rate: f.term_rate }) ? num(f.daily_rate) : num(f.rate),
          unit: f.daily_rate != null && !isRenewed({ borrower_rate: f.rate, term_rate: f.term_rate }) ? 'day' : 'term',
          canSeeBorrower: f.can_see_borrower,
          canSeePayments: f.can_see_payments,
          canSeeChart: Boolean(f.can_see_chart),
          hasNewCols: f.can_see_chart !== undefined,
          renewed: isRenewed({ borrower_rate: f.rate, term_rate: f.term_rate }),
        }))
      )
    } else {
      setBorrower({ name: '', email: '', userId: null })
      setPrincipal('')
      setRate(defaultDaily > 0 ? num(defaultDaily) : '')
      setRateUnit(defaultDaily > 0 ? 'day' : 'term')
      setIssueDate(today())
      setDueDate('')
      setNotes('')
      setFunders([blankFunder(defaultDaily)])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editLoan?.id, defaultDaily])

  // a conta ao vivo: o que o devedor paga, o que devolvo a cada um e o que sobra pra mim
  const days = Math.max(1, daysBetween(issueDate, dueDate))
  const termOf = (value: string, unit: RateUnit) => (unit === 'day' ? rateFromDaily(parseMoney(value), days) : parseMoney(value))
  const loanRenewed = Boolean(editLoan && isRenewed(editLoan))

  // Com co-fundador, o valor que você empresta ao devedor é o mesmo que você pegou com ele.
  // (Empréstimo antigo que mistura dinheiro seu com o do co-fundador continua editável.)
  const hasFunders = funders.some((f) => f.party.name.trim() || f.amount.trim())
  const legacyOwn = Boolean(
    editLoan && editLoan.funders.length > 0 && Math.abs(editLoan.principal - editLoan.funders.reduce((s, x) => s + x.amount, 0)) > 0.009
  )
  const principalFromFunders = hasFunders && !legacyOwn

  const calc = useMemo(() => {
    const fundedSum = round2(funders.reduce((s, f) => s + parseMoney(f.amount), 0))
    const p = principalFromFunders ? fundedSum : parseMoney(principal)
    const r = rateUnit === 'day' ? rateFromDaily(parseMoney(rate), days) : parseMoney(rate)
    const total = withRate(p, r)
    const rows = funders.map((f) => {
      const a = parseMoney(f.amount)
      const fr = f.unit === 'day' ? rateFromDaily(parseMoney(f.rate), days) : parseMoney(f.rate)
      return { key: f.key, name: f.party.name || 'Co-fundador', amount: a, total: withRate(a, fr) }
    })
    const funded = round2(rows.reduce((s, x) => s + x.amount, 0))
    const funderTotal = round2(rows.reduce((s, x) => s + x.total, 0))
    const own = round2(Math.max(p - funded, 0))
    return { p, r, total, rows, funded, funderTotal, own, profit: round2(total - funderTotal - own) }
  }, [principal, rate, rateUnit, funders, days, principalFromFunders])

  function patchFunder(key: string, patch: Partial<FunderDraft>) {
    setFunders((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const filled = funders.filter((f) => f.party.name.trim() || f.amount.trim())
    if (calc.p <= 0) return toast.error(principalFromFunders ? 'Informe o valor que o co-fundador te emprestou.' : 'Informe o valor emprestado.')
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
        borrower_email: cleanEmail(borrower.email),
        borrower_user_id: borrower.userId,
        principal: calc.p,
        borrower_rate: calc.r,
        issue_date: issueDate,
        due_date: dueDate,
        notes: notes.trim() || null,
        ...(rateUnit === 'day' && !loanRenewed
          ? { daily_rate: parseMoney(rate) }
          : editLoan && editLoan.daily_rate !== undefined && !loanRenewed
            ? { daily_rate: null }
            : {}),
        ...(editLoan && editLoan.term_rate !== undefined && !loanRenewed ? { term_rate: calc.r } : {}),
      },
      filled.map((f) => ({
        id: f.id,
        funder_name: f.party.name.trim(),
        funder_email: cleanEmail(f.party.email),
        funder_user_id: f.party.userId,
        amount: parseMoney(f.amount),
        rate: f.renewed ? parseMoney(f.rate) : termOf(f.rate, f.unit),
        can_see_borrower: f.canSeeBorrower,
        can_see_payments: f.canSeePayments,
        ...(f.canSeeChart || f.hasNewCols ? { can_see_chart: f.canSeeChart } : {}),
        ...(f.unit === 'day' && !f.renewed ? { daily_rate: parseMoney(f.rate) } : f.hasNewCols && !f.renewed ? { daily_rate: null } : {}),
        ...(f.hasNewCols && !f.renewed ? { term_rate: termOf(f.rate, f.unit) } : {}),
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
                  <RateField
                    value={f.rate}
                    unit={f.unit}
                    lockUnit={f.renewed}
                    onChange={(rate, unit) => patchFunder(f.key, { rate, unit })}
                    placeholder="10"
                    days={days}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="label !mb-0">O que ele pode ver</p>
                <p className="text-xs text-ink-400">Ele sempre vê o valor dele, a % dele e quando vai receber. Nunca vê o que você cobra do devedor.</p>
                <Toggle checked={f.canSeeBorrower} onChange={(v) => patchFunder(f.key, { canSeeBorrower: v })} label="Ele pode ver o nome do devedor" />
                <Toggle checked={f.canSeeChart} onChange={(v) => patchFunder(f.key, { canSeeChart: v })} label="Ele pode ver o gráfico de valor e juros" />
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50">2. Para quem você vai emprestar (devedor)</h3>
          <PartyPicker value={borrower} onChange={setBorrower} nameLabel="Nome do devedor" />
          <div className="grid grid-cols-2 gap-3">
            {principalFromFunders ? (
              <div>
                <label className="label">Valor que você empresta ao devedor</label>
                <p className="input flex items-center font-semibold bg-ink-50 dark:bg-ink-800">{formatCurrency(calc.p)}</p>
                <p className="text-xs text-ink-400 mt-1">É o mesmo valor que você pegou com o co-fundador.</p>
              </div>
            ) : (
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
            )}
            <div>
              <label className="label">Juros que o devedor paga *</label>
              <RateField
                value={rate}
                unit={rateUnit}
                lockUnit={loanRenewed}
                onChange={(v, u) => {
                  setRate(v)
                  setRateUnit(u)
                }}
                placeholder="15"
                days={days}
                required
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

/** Campo de juros: o valor e se ele vale pelo prazo todo ou por dia. Mostra a conta pronta. */
function RateField({
  value,
  unit,
  lockUnit,
  onChange,
  placeholder,
  days,
  required,
}: {
  value: string
  unit: RateUnit
  lockUnit?: boolean
  onChange: (value: string, unit: RateUnit) => void
  placeholder: string
  days: number
  required?: boolean
}) {
  const n = parseMoney(value)
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          required={required}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value, unit)}
          className="input min-w-0"
          placeholder={placeholder}
        />
        <select
          value={unit}
          disabled={lockUnit}
          onChange={(e) => onChange(value, e.target.value as RateUnit)}
          className="input !w-auto shrink-0 pr-2"
          aria-label="Como o juros é contado"
        >
          <option value="term">% no prazo</option>
          <option value="day">% ao dia</option>
        </select>
      </div>
      {unit === 'day' && n > 0 && (
        <p className="text-xs text-ink-400">
          {String(n).replace('.', ',')}% x {days} dia{days === 1 ? '' : 's'} = {String(rateFromDaily(n, days)).replace('.', ',')}% no prazo
        </p>
      )}
      {lockUnit && <p className="text-xs text-ink-400">Já renovado: este é o % total de todos os prazos somados.</p>}
    </div>
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
