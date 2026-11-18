import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { FoundUser } from '../types/database'

/** Pessoas que eu sigo (contatos meus ligados a um usuário do app). São as únicas sugestões do app. */
export function useFollowing() {
  const { user } = useAuth()
  const [following, setFollowing] = useState<FoundUser[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.rpc('list_following')
    setFollowing((data as FoundUser[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { following, loading, refetch }
}
