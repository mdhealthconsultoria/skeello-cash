import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Category } from '../types/database'

export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('name')
    setCategories((data as Category[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  async function createCategory(name: string, icon = 'tag') {
    if (!user) return { error: 'Não autenticado' }
    const { data, error: err } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name, icon, is_default: false })
      .select()
      .single()
    if (!err) await fetchCategories()
    return { data, error: err?.message ?? null }
  }

  return { categories, loading, refetch: fetchCategories, createCategory }
}
