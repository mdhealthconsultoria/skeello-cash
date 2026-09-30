import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { AdminOverview, AdminUserRow } from '../types/database'

export function useAdmin() {
  const { profile } = useAuth()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile?.is_admin) {
      setLoading(false)
      return
    }
    ;(async () => {
      setLoading(true)
      const [{ data: ov, error: ovErr }, { data: rows, error: rowsErr }] = await Promise.all([
        supabase.rpc('admin_get_overview').single(),
        supabase.rpc('admin_list_users'),
      ])
      if (ovErr || rowsErr) {
        setError(ovErr?.message ?? rowsErr?.message ?? 'Erro desconhecido')
      } else {
        setOverview(ov as AdminOverview)
        setUsers((rows as AdminUserRow[]) ?? [])
      }
      setLoading(false)
    })()
  }, [profile?.is_admin])

  return { isAdmin: Boolean(profile?.is_admin), overview, users, loading, error }
}
