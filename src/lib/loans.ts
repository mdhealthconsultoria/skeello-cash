import type { LoanFull, LoanFunder, FunderPayment } from '../types/database'
import { daysUntil } from './format'

/** Dias de antecedência dos avisos (o banco manda também no dia do vencimento). */
export const REMINDER_DAYS = [10, 7, 3, 1]

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Juros fixos (%) sobre o valor combinado: 500 a 15% = 575. */
export function withRate(amount: number, ratePercent: number): number {
  return round2(amount * (1 + ratePercent / 100))
}

export function parseMoney(value: string): number {
  const v = value.trim()
  const n = Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v)
  return Number.isFinite(n) ? n : 0
}

export function funderSummary(f: LoanFunder, payouts: FunderPayment[]) {
  const total = withRate(f.amount, f.rate)
  const paid = round2(payouts.filter((p) => p.funder_id === f.id).reduce((s, p) => s + p.amount, 0))
  return { total, paid, remaining: round2(Math.max(total - paid, 0)), interest: round2(total - f.amount) }
}

export function loanSummary(loan: LoanFull) {
  const total = withRate(loan.principal, loan.borrower_rate)
  const paid = round2(loan.payments.reduce((s, p) => s + p.amount, 0))
  const remaining = round2(Math.max(total - paid, 0))
  const funders = loan.funders.map((f) => ({ funder: f, ...funderSummary(f, loan.funder_payments) }))
  const funderTotal = round2(funders.reduce((s, f) => s + f.total, 0))
  const funderPaid = round2(funders.reduce((s, f) => s + f.paid, 0))
  const funderRemaining = round2(funders.reduce((s, f) => s + f.remaining, 0))
  const fundedAmount = round2(loan.funders.reduce((s, f) => s + f.amount, 0))
  const ownMoney = round2(Math.max(loan.principal - fundedAmount, 0))
  // lucro previsto = o que o tomador paga - o que devolvo aos co-fundadores - o que saiu do meu bolso
  const profit = round2(total - funderTotal - ownMoney)
  const days = daysUntil(loan.due_date)
  const settled = remaining <= 0.009
  const overdue = !settled && days !== null && days < 0
  return {
    total,
    paid,
    remaining,
    interest: round2(total - loan.principal),
    funders,
    funderTotal,
    funderPaid,
    funderRemaining,
    fundedAmount,
    ownMoney,
    profit,
    days,
    settled,
    overdue,
  }
}

export function dueLabel(days: number | null, settled: boolean): string {
  if (settled) return 'Quitado'
  if (days === null) return ''
  if (days < 0) return `Atrasado há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`
  if (days === 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  return `Vence em ${days} dias`
}

export function dueTone(days: number | null, settled: boolean): string {
  if (settled) return 'text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10'
  if (days !== null && days < 0) return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10'
  if (days !== null && days <= 3) return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10'
  return 'text-ink-600 dark:text-ink-300 bg-ink-100 dark:bg-ink-800'
}
