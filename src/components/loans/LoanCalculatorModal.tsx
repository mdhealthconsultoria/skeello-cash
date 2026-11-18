import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import { formatCurrency } from '../../lib/format'
import { parseMoney, round2 } from '../../lib/loans'
import { useInterestDefaults } from '../../hooks/useInterestDefaults'

type Unit = 'term' | 'day' | 'month'

const UNIT_LABEL: Record<Unit, string> = {
  term: '% no prazo todo',
  day: '% ao dia',
  month: '% ao mês',
}

/** Calculadora de empréstimo: qualquer pessoa pode usar, não grava nada. */
export function LoanCalculatorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const defaults = useInterestDefaults()
  const defaultDaily = defaults.dailyRate
  const [amount, setAmount] = useState('1000')
  const [rate, setRate] = useState('')
  const [unit, setUnit] = useState<Unit>('term')
  const [days, setDays] = useState('30')
  const [renewals, setRenewals] = useState('0')
  const [lateDays, setLateDays] = useState('0')
  const [lateRate, setLateRate] = useState('')
  const [lateFee, setLateFee] = useState('')

  useEffect(() => {
    if (!open) return
    if (defaultDaily > 0) {
      setUnit('day')
      setRate(String(defaultDaily).replace('.', ','))
    }
    if (defaults.lateRate > 0) setLateRate(String(defaults.lateRate).replace('.', ','))
    if (defaults.lateFee > 0) setLateFee(String(defaults.lateFee).replace('.', ','))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDaily, defaults.lateRate, defaults.lateFee])

  const r = useMemo(() => {
    const p = parseMoney(amount)
    const rt = parseMoney(rate)
    const d = Math.max(1, Math.floor(parseMoney(days)) || 1)
    const n = Math.min(60, Math.max(0, Math.floor(parseMoney(renewals)) || 0))
    // taxa de um prazo (juros simples)
    const termRate = unit === 'day' ? rt * d : unit === 'month' ? (rt * d) / 30 : rt
    const perTerm = round2(p * (termRate / 100))
    const perDay = round2(perTerm / d)
    const total = round2(p + perTerm)
    // atraso: juros simples ao dia sobre o total do vencimento + multa única
    const ld = Math.max(0, Math.floor(parseMoney(lateDays)) || 0)
    const lateInterestValue = round2(p + perTerm > 0 ? (p + perTerm) * (parseMoney(lateRate) / 100) * ld : 0)
    const lateFeeValue = ld > 0 ? round2((p + perTerm) * (parseMoney(lateFee) / 100)) : 0
    return {
      ld,
      lateInterestValue,
      lateFeeValue,
      lateTotal: round2(p + perTerm + lateInterestValue + lateFeeValue),
      p,
      d,
      n,
      termRate: round2(termRate),
      perTerm,
      perDay,
      perMonth: round2(perDay * 30),
      total,
      // renovando só com juros: a cada prazo o devedor paga os juros e o valor continua
      renewedInterest: round2(perTerm * (n + 1)),
      renewedTotal: round2(p + perTerm * (n + 1)),
      renewedDays: d * (n + 1),
    }
  }, [amount, rate, unit, days, renewals, lateDays, lateRate, lateFee])

  return (
    <Modal open={open} onClose={onClose} title="Calculadora de juros">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Valor emprestado (R$)</label>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="1000" />
          </div>
          <div>
            <label className="label">Prazo (dias)</label>
            <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="input" placeholder="30" />
          </div>
          <div>
            <label className="label">Juros combinados</label>
            <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="input" placeholder="15" />
          </div>
          <div>
            <label className="label">Como o juros é contado</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="input">
              {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl bg-ink-50 dark:bg-ink-800 p-4 space-y-1.5 text-sm">
          <Row label={`Juros do prazo (${String(r.termRate).replace('.', ',')}%)`} value={formatCurrency(r.perTerm)} />
          <Row label="Total no vencimento" value={formatCurrency(r.total)} strong />
          <div className="border-t border-ink-200 dark:border-ink-700 pt-1.5 mt-1.5 space-y-1.5">
            <Row label="Juros por dia" value={formatCurrency(r.perDay)} />
            <Row label="Juros a cada 30 dias" value={formatCurrency(r.perMonth)} />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">E se a pessoa pagar só os juros e renovar? Quantas vezes?</label>
            <input inputMode="numeric" value={renewals} onChange={(e) => setRenewals(e.target.value)} className="input" placeholder="0" />
          </div>
          {r.n > 0 && (
            <div className="rounded-2xl bg-ink-50 dark:bg-ink-800 p-4 space-y-1.5 text-sm">
              <Row label={`Juros somados em ${r.n + 1} prazos (${r.renewedDays} dias)`} value={formatCurrency(r.renewedInterest)} strong />
              <Row label="No fim ela ainda deve o valor" value={formatCurrency(r.p)} />
              <Row label="Total pago ao quitar" value={formatCurrency(r.renewedTotal)} />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="label !mb-0">E se atrasar o pagamento?</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Dias de atraso</label>
              <input inputMode="numeric" value={lateDays} onChange={(e) => setLateDays(e.target.value)} className="input" placeholder="0" />
            </div>
            <div>
              <label className="label">Juros ao dia (%)</label>
              <input inputMode="decimal" value={lateRate} onChange={(e) => setLateRate(e.target.value)} className="input" placeholder="0,033" />
            </div>
            <div>
              <label className="label">Multa (%)</label>
              <input inputMode="decimal" value={lateFee} onChange={(e) => setLateFee(e.target.value)} className="input" placeholder="2" />
            </div>
          </div>
          {r.ld > 0 && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-4 space-y-1.5 text-sm">
              <Row label={`Juros de atraso (${r.ld} dia${r.ld === 1 ? '' : 's'})`} value={formatCurrency(r.lateInterestValue)} />
              <Row label="Multa" value={formatCurrency(r.lateFeeValue)} />
              <div className="border-t border-amber-200 dark:border-amber-500/30 pt-1.5 mt-1.5">
                <Row label="Valor atualizado" value={formatCurrency(r.lateTotal)} strong />
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-ink-400">Juros simples, sem juros sobre juros. É só uma conta: nada é salvo.</p>
      </div>
    </Modal>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500 dark:text-ink-400">{label}</span>
      <span className={`${strong ? 'font-semibold' : 'font-medium'} text-ink-900 dark:text-ink-50`}>{value}</span>
    </div>
  )
}
