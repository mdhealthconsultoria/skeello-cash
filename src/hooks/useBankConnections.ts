import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { BankAccount, BankConnection, BankTransaction } from '../types/bank'

export function useBankConnections() {
  const { user } = useAuth()
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const [{ data: connRows }, { data: accRows }, { data: txRows }] = await Promise.all([
      supabase.from('bank_connections').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).order('name'),
      supabase
        .from('bank_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(100),
    ])

    setConnections((connRows as BankConnection[]) ?? [])
    setAccounts((accRows as BankAccount[]) ?? [])
    setTransactions((txRows as BankTransaction[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  async function getConnectToken(itemId?: string) {
    const { data, error } = await supabase.functions.invoke<{ connectToken: string; error?: string }>(
      'pluggy-connect-token',
      { body: { itemId } }
    )
    if (error || !data?.connectToken) return { token: null, error: error?.message ?? data?.error ?? 'Falha ao gerar token' }
    return { token: data.connectToken, error: null }
  }

  async function syncItem(itemId: string) {
    const { data, error } = await supabase.functions.invoke<{ accounts: number; transactions: number; error?: string }>(
      'pluggy-sync',
      { body: { itemId } }
    )
    if (!error) await fetchAll()
    return { data, error: error?.message ?? data?.error ?? null }
  }

  async function removeConnection(id: string) {
    const { error } = await supabase.from('bank_connections').delete().eq('id', id)
    if (!error) await fetchAll()
    return { error: error?.message ?? null }
  }

  return {
    connections,
    accounts,
    transactions,
    loading,
    refetch: fetchAll,
    getConnectToken,
    syncItem,
    removeConnection,
  }
}
