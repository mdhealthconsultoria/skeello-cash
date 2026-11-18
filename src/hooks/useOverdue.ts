import { useMemo } from 'react'
import { useDebts } from './useDebts'
import { useLoans } from './useLoans'
import { useInterestDefaults } from './useInterestDefaults'
import { daysUntil } from '../lib/format'
import { lateInterest, loanSummary, round2 } from '../lib/loans'

export interface OverdueItem {
  key: string
  name: string
  /** o que falta pagar */
  amount: number
  /** com juros de atraso e multa (igual a amount se não há) */
  updated: number
  days: number
  due: string
  description?: string | null
  loanId?: string
  personId?: string
}

/** Tudo que já venceu e ainda não foi pago: empréstimos, dívidas a receber e o que você deve. */
export function useOverdue() {
  const { debts, loading: debtsLoading } = useDebts({ includeArchived: false })
  const { loans, loading: loansLoading } = useLoans()
  const defaults = useInterestDefaults()

  return useMemo(() => {
    const loanItems: OverdueItem[] = []
    for (const l of loans) {
      if (l.closed) continue
      const s = loanSummary(l)
      if (s.settled) continue
      const d = daysUntil(l.due_date)
      if (d === null || d >= 0) continue
      const li = lateInterest(s.remaining, l.due_date, l.late_daily_rate ?? defaults.lateRate, defaults.lateFee)
      loanItems.push({ key: `l${l.id}`, name: l.borrower_name, amount: s.remaining, updated: li.total, days: -d, due: l.due_date, loanId: l.id })
    }

    const debtIn: OverdueItem[] = []
    const debtOut: OverdueItem[] = []
    for (const d of debts) {
      if (d.status === 'paid' || d.status === 'cancelled' || !d.due_date) continue
      const rem = d.totals.remaining_amount
      const n = daysUntil(d.due_date)
      if (rem <= 0.009 || n === null || n >= 0) continue
      const li = lateInterest(rem, d.due_date, d.late_daily_rate ?? defaults.lateRate, defaults.lateFee)
      const item: OverdueItem = {
        key: `d${d.id}`,
        name: d.person.name,
        amount: rem,
        updated: li.total,
        days: -n,
        due: d.due_date,
        description: d.description,
        personId: d.person_id,
      }
      if (d.type === 'receivable') debtIn.push(item)
      else debtOut.push(item)
    }

    const byDays = (a: OverdueItem, b: OverdueItem) => b.days - a.days
    loanItems.sort(byDays)
    debtIn.sort(byDays)
    debtOut.sort(byDays)

    const sum = (list: OverdueItem[]) => round2(list.reduce((s, i) => s + i.amount, 0))
    const sumUpdated = (list: OverdueItem[]) => round2(list.reduce((s, i) => s + i.updated, 0))
    return {
      loanItems,
      debtIn,
      debtOut,
      loanTotal: sum(loanItems),
      debtInTotal: sum(debtIn),
      debtOutTotal: sum(debtOut),
      /** a receber em atraso (empréstimos + dívidas) */
      receivableTotal: round2(sum(loanItems) + sum(debtIn)),
      receivableUpdated: round2(sumUpdated(loanItems) + sumUpdated(debtIn)),
      loading: debtsLoading || loansLoading,
    }
  }, [debts, loans, defaults, debtsLoading, loansLoading])
}
