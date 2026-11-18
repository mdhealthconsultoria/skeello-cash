import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/** O % ao dia padrão que o usuário definiu em Configurações (0 = nenhum). */
export function useDefaultDailyRate() {
  const { user } = useAuth()
  const [rate, setRate] = useState(0)

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const v = Number((data as { default_daily_rate?: number } | null)?.default_daily_rate ?? 0)
        setRate(Number.isFinite(v) ? v : 0)
      })
  }, [user])

  return rate
}
