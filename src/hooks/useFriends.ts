import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { FoundUser } from '../types/database'

export interface FriendUser {
  id: string
  name: string
  avatar_url: string | null
  username: string
  since: string | null
}

export interface FriendRequestRow {
  id: string
  direction: 'in' | 'out'
  user_id: string
  name: string
  avatar_url: string | null
  username: string
  created_at: string
}

/** Amigos (amizade aceita) e solicitações pendentes. */
export function useFriends() {
  const { user } = useAuth()
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [requests, setRequests] = useState<FriendRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  // false = o banco ainda não tem as funções de amizade (migração 0013 pendente)
  const [available, setAvailable] = useState(true)

  const refetch = useCallback(async () => {
    if (!user) return
    const [f, r] = await Promise.all([supabase.rpc('list_friends'), supabase.rpc('list_friend_requests')])
    if (f.error || r.error) {
      setAvailable(false)
    } else {
      setAvailable(true)
      setFriends((f.data as FriendUser[]) ?? [])
      setRequests((r.data as FriendRequestRow[]) ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    refetch()
  }, [refetch])

  async function sendRequest(target: FoundUser, personId?: string | null) {
    const { data, error } = await supabase.rpc('send_friend_request', { p_to: target.id, p_person_id: personId ?? null })
    if (!error) await refetch()
    return { status: (data as string | null) ?? null, error: error?.message ?? null }
  }

  async function respond(id: string, accept: boolean) {
    const { error } = await supabase.rpc('respond_friend_request', { p_id: id, p_accept: accept })
    if (!error) await refetch()
    return { error: error?.message ?? null }
  }

  async function cancel(id: string) {
    const { error } = await supabase.rpc('cancel_friend_request', { p_id: id })
    if (!error) await refetch()
    return { error: error?.message ?? null }
  }

  async function removeFriend(userId: string) {
    const { error } = await supabase.rpc('remove_friend', { p_user: userId })
    if (!error) await refetch()
    return { error: error?.message ?? null }
  }

  return {
    friends,
    incoming: requests.filter((r) => r.direction === 'in'),
    outgoing: requests.filter((r) => r.direction === 'out'),
    loading,
    available,
    refetch,
    sendRequest,
    respond,
    cancel,
    removeFriend,
  }
}

/** Quantas solicitações de amizade esperam resposta (para o aviso no menu). */
export function usePendingRequestCount() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase
      .from('friend_requests')
      .select('id', { count: 'exact', head: true })
      .eq('to_user', user.id)
      .eq('status', 'pending')
      .then(({ count: c, error }) => {
        if (!error) setCount(c ?? 0)
      })
  }, [user])

  return count
}
