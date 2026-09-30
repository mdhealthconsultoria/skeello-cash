import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Person } from '../types/database'

export function usePeople(includeArchived = false) {
  const { user } = useAuth()
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPeople = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let query = supabase.from('people').select('*').eq('user_id', user.id).order('name')
    if (!includeArchived) query = query.eq('archived', false)
    const { data, error: err } = await query
    if (err) setError(err.message)
    else setPeople((data as Person[]) ?? [])
    setLoading(false)
  }, [user, includeArchived])

  useEffect(() => {
    fetchPeople()
  }, [fetchPeople])

  async function createPerson(input: Partial<Person>) {
    if (!user) return { error: 'Não autenticado' }
    const { data, error: err } = await supabase
      .from('people')
      .insert({ ...input, user_id: user.id })
      .select()
      .single()
    if (!err) await fetchPeople()
    return { data, error: err?.message ?? null }
  }

  async function updatePerson(id: string, input: Partial<Person>) {
    const { data, error: err } = await supabase
      .from('people')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (!err) await fetchPeople()
    return { data, error: err?.message ?? null }
  }

  async function archivePerson(id: string, archived = true) {
    return updatePerson(id, { archived })
  }

  async function deletePerson(id: string) {
    const { error: err } = await supabase.from('people').delete().eq('id', id)
    if (!err) await fetchPeople()
    return { error: err?.message ?? null }
  }

  return { people, loading, error, refetch: fetchPeople, createPerson, updatePerson, archivePerson, deletePerson }
}
