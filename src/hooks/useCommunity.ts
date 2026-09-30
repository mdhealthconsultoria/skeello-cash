import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { FoundUser } from '../types/database'

const PAGE_SIZE = 30

export function useCommunity() {
  const [users, setUsers] = useState<FoundUser[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const fetchFirstPage = useCallback(async () => {
    setLoading(true)
    const [{ data: userRows }, { data: count }] = await Promise.all([
      supabase.rpc('list_users', { p_limit: PAGE_SIZE, p_offset: 0 }),
      supabase.rpc('get_total_users_count'),
    ])
    setUsers((userRows as FoundUser[]) ?? [])
    setHasMore(((userRows as FoundUser[]) ?? []).length === PAGE_SIZE)
    setTotalCount(typeof count === 'number' ? count : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFirstPage()
  }, [fetchFirstPage])

  async function loadMore() {
    setLoadingMore(true)
    const { data } = await supabase.rpc('list_users', { p_limit: PAGE_SIZE, p_offset: users.length })
    const newRows = (data as FoundUser[]) ?? []
    setUsers((prev) => [...prev, ...newRows])
    setHasMore(newRows.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  return { users, totalCount, loading, loadingMore, hasMore, loadMore, refetch: fetchFirstPage }
}
