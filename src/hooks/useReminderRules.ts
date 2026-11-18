import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { ReminderRule } from '../types/database'

/** Lembretes que o próprio usuário cria: "me avise N dias antes do que tenho a receber / a pagar". */
export function useReminderRules() {
  const { user } = useAuth()
  const [rules, setRules] = useState<ReminderRule[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRules = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('kind')
      .order('days_before')
    setRules((data as ReminderRule[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  async function addRule(kind: ReminderRule['kind'], daysBefore: number) {
    if (!user) return { error: 'Não autenticado' }
    const { error } = await supabase
      .from('notification_rules')
      .insert({ user_id: user.id, kind, days_before: daysBefore })
    if (error) {
      return { error: error.code === '23505' ? 'Você já tem esse lembrete.' : error.message }
    }
    await fetchRules()
    // já confere se algo vence nessa data
    supabase.rpc('generate_my_reminders').then(() => {})
    return { error: null }
  }

  async function toggleRule(id: string, enabled: boolean) {
    const { error } = await supabase.from('notification_rules').update({ enabled }).eq('id', id)
    if (!error) setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)))
    return { error: error?.message ?? null }
  }

  async function removeRule(id: string) {
    const { error } = await supabase.from('notification_rules').delete().eq('id', id)
    if (!error) setRules((prev) => prev.filter((r) => r.id !== id))
    return { error: error?.message ?? null }
  }

  return { rules, loading, addRule, toggleRule, removeRule }
}
