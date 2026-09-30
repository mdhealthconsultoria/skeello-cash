import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { DebtWithRelations } from '../types/database'

export interface DashboardSummary {
  totalReceivable: number
  totalPayable: number
  netBalance: number
  receivedThisMonth: number
  paidThisMonth: number
  overdueTotal: number
  dueSoon: DebtWithRelations[]
  topReceivable: DebtWithRelations | null
  peopleWithPending: number
}

export function useDashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSummary = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: debtRows } = await supabase
      .from('debts')
      .select('*, person:people(*), category:categories(*)')
      .eq('user_id', user.id)
      .eq('archived', false)

    const ids = (debtRows ?? []).map((d) => d.id)
    const { data: totalsRows } = ids.length
      ? await supabase.from('debt_totals').select('*').in('debt_id', ids)
      : { data: [] }
    const totalsMap = new Map((totalsRows ?? []).map((t) => [t.debt_id, t]))

    const debts = (debtRows ?? []).map((d) => ({
      ...d,
      totals: totalsMap.get(d.id) ?? { debt_id: d.id, original_amount: d.amount, paid_amount: 0, remaining_amount: d.amount },
    })) as DebtWithRelations[]

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    const { data: paymentsThisMonth } = await supabase
      .from('payments')
      .select('amount, debt:debts!inner(type)')
      .eq('user_id', user.id)
      .gte('payment_date', monthStart)

    let receivedThisMonth = 0
    let paidThisMonth = 0
    for (const p of paymentsThisMonth ?? []) {
      const debtType = (p as unknown as { debt: { type: string } }).debt?.type
      if (debtType === 'receivable') receivedThisMonth += p.amount
      else if (debtType === 'payable') paidThisMonth += p.amount
    }

    const active = debts.filter((d) => d.status !== 'paid' && d.status !== 'cancelled')
    const totalReceivable = active.filter((d) => d.type === 'receivable').reduce((s, d) => s + d.totals.remaining_amount, 0)
    const totalPayable = active.filter((d) => d.type === 'payable').reduce((s, d) => s + d.totals.remaining_amount, 0)
    const overdueTotal = active.filter((d) => d.status === 'overdue').reduce((s, d) => s + d.totals.remaining_amount, 0)

    const dueSoon = active
      .filter((d) => {
        if (!d.due_date) return false
        const diff = Math.round((new Date(d.due_date + 'T00:00:00').getTime() - now.setHours(0, 0, 0, 0)) / 86400000)
        return diff >= 0 && diff <= 7
      })
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))

    const receivables = active.filter((d) => d.type === 'receivable')
    const topReceivable = receivables.length
      ? receivables.reduce((max, d) => (d.totals.remaining_amount > max.totals.remaining_amount ? d : max))
      : null

    const peopleWithPending = new Set(active.map((d) => d.person_id)).size

    setSummary({
      totalReceivable,
      totalPayable,
      netBalance: totalReceivable - totalPayable,
      receivedThisMonth,
      paidThisMonth,
      overdueTotal,
      dueSoon,
      topReceivable,
      peopleWithPending,
    })
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  return { summary, loading, refetch: fetchSummary }
}
