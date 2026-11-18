import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { AdminLoan, AdminOverview, AdminUserDetail, AdminUserRow } from '../types/database'

export function useAdmin() {
  const { profile } = useAuth()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loans, setLoans] = useState<AdminLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.is_admin) {
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      const [ov, rows, allLoans] = await Promise.all([
        supabase.rpc('admin_get_overview').single(),
        supabase.rpc('admin_list_users'),
        supabase.rpc('admin_list_loans'),
      ])
      const err = ov.error ?? rows.error ?? allLoans.error
      if (err) {
        setError(err.message)
      } else {
        setOverview(ov.data as AdminOverview)
        setUsers((rows.data as AdminUserRow[]) ?? [])
        setLoans((allLoans.data as AdminLoan[]) ?? [])
      }
      setLoading(false)
    })()
  }, [profile?.is_admin])

  const getUserDetail = useCallback(async (id: string) => {
    const { data, error: err } = await supabase.rpc('admin_get_user_detail', { p_user: id })
    return { detail: (data as AdminUserDetail) ?? null, error: err?.message ?? null }
  }, [])

  return { isAdmin: Boolean(profile?.is_admin), overview, users, loans, loading, error, getUserDetail }
}
