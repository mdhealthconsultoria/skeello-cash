import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface InterestDefaults {
  /** juros ao dia padrão ao criar empréstimo (%) */
  dailyRate: number
  /** juros de atraso ao dia padrão (%) */
  lateRate: number
  /** multa única por atraso (%) */
  lateFee: number
}

const num = (v: unknown) => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Os padrões de juros que o usuário definiu em Configurações (0 = nenhum). */
export function useInterestDefaults(): InterestDefaults {
  const { user } = useAuth()
  const [d, setD] = useState<InterestDefaults>({ dailyRate: 0, lateRate: 0, lateFee: 0 })

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const r = (data ?? {}) as Record<string, unknown>
        setD({ dailyRate: num(r.default_daily_rate), lateRate: num(r.default_late_rate), lateFee: num(r.default_late_fee) })
      })
  }, [user])

  return d
}
