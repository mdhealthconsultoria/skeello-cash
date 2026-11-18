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
    const { data, error } = await supabase.rpc('list_following')
    if (error) {
      // banco ainda sem a função: usa direto as pessoas minhas que são usuárias do app
      const { data: rows } = await supabase
        .from('people')
        .select('linked_user_id, name, photo_url')
        .eq('user_id', user.id)
        .eq('archived', false)
        .not('linked_user_id', 'is', null)
      const seen = new Set<string>()
      const list: FoundUser[] = []
      for (const r of rows ?? []) {
        const id = r.linked_user_id as string
        if (seen.has(id)) continue
        seen.add(id)
        list.push({ id, name: r.name as string, avatar_url: (r.photo_url as string | null) ?? null, username: '' })
      }
      setFollowing(list)
    } else {
      setFollowing((data as FoundUser[]) ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { following, loading, refetch }
}
