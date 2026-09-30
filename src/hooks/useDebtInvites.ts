import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { PendingInvite } from '../types/database'

export function useDebtInvites() {
  const { user } = useAuth()
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInvites = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: debtRows } = await supabase
      .from('debts')
      .select('*')
      .eq('counterparty_user_id', user.id)
      .eq('share_status', 'pending')
      .order('created_at', { ascending: false })

    const inviterIds = Array.from(new Set((debtRows ?? []).map((d) => d.user_id)))
    const { data: profileRows } = inviterIds.length
      ? await supabase.from('profiles').select('id, name, avatar_url').in('id', inviterIds)
      : { data: [] }

    const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))

    const merged = (debtRows ?? []).map((d) => {
      const profile = profileMap.get(d.user_id)
      return {
        ...d,
        inviter_name: profile?.name || 'Alguém',
        inviter_avatar_url: profile?.avatar_url ?? null,
      } as PendingInvite
    })

    setInvites(merged)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  async function respond(debtId: string, accept: boolean) {
    const { error } = await supabase.rpc('respond_to_debt_invite', { p_debt_id: debtId, p_accept: accept })
    if (!error) await fetchInvites()
    return { error: error?.message ?? null }
  }

  return { invites, loading, refetch: fetchInvites, respond }
}
