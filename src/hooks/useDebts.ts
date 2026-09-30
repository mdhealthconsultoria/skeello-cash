import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Debt, DebtWithRelations } from '../types/database'

interface DebtFilters {
  type?: 'receivable' | 'payable'
  personId?: string
  status?: string
  includeArchived?: boolean
}

export function useDebts(filters: DebtFilters = {}) {
  const { user } = useAuth()
  const [debts, setDebts] = useState<DebtWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDebts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let query = supabase
      .from('debts')
      .select('*, person:people(*), category:categories(*)')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false })

    if (!filters.includeArchived) query = query.eq('archived', false)
    if (filters.type) query = query.eq('type', filters.type)
    if (filters.personId) query = query.eq('person_id', filters.personId)
    if (filters.status) query = query.eq('status', filters.status)

    const { data: debtRows, error: err } = await query
    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const ids = (debtRows ?? []).map((d) => d.id)
    const { data: totalsRows } = ids.length
      ? await supabase.from('debt_totals').select('*').in('debt_id', ids)
      : { data: [] }

    const totalsMap = new Map((totalsRows ?? []).map((t) => [t.debt_id, t]))
    const merged = (debtRows ?? []).map((d) => ({
      ...d,
      totals:
        totalsMap.get(d.id) ?? { debt_id: d.id, original_amount: d.amount, paid_amount: 0, remaining_amount: d.amount },
    })) as DebtWithRelations[]

    setDebts(merged)
    setError(null)
    setLoading(false)
  }, [user, filters.type, filters.personId, filters.status, filters.includeArchived])

  useEffect(() => {
    fetchDebts()
  }, [fetchDebts])

  async function createDebt(input: Partial<Debt>) {
    if (!user) return { error: 'Não autenticado' }
    const { data, error: err } = await supabase
      .from('debts')
      .insert({ ...input, user_id: user.id })
      .select()
      .single()
    if (!err) await fetchDebts()
    return { data, error: err?.message ?? null }
  }

  async function updateDebt(id: string, input: Partial<Debt>) {
    const { data, error: err } = await supabase
      .from('debts')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (!err) await fetchDebts()
    return { data, error: err?.message ?? null }
  }

  async function deleteDebt(id: string) {
    const { error: err } = await supabase.from('debts').delete().eq('id', id)
    if (!err) await fetchDebts()
    return { error: err?.message ?? null }
  }

  async function registerPayment(debtId: string, amount: number, method: string, paymentDate: string, notes?: string) {
    if (!user) return { error: 'Não autenticado' }
    const { error: err } = await supabase
      .from('payments')
      .insert({ debt_id: debtId, user_id: user.id, amount, method, payment_date: paymentDate, notes })
    if (!err) await fetchDebts()
    return { error: err?.message ?? null }
  }

  return { debts, loading, error, refetch: fetchDebts, createDebt, updateDebt, deleteDebt, registerPayment }
}
