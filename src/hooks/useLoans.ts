import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Borrowing, Funding, LoanFull, LoanRenewal } from '../types/database'

export interface LoanInput {
  borrower_name: string
  borrower_email: string | null
  borrower_user_id: string | null
  principal: number
  borrower_rate: number
  issue_date: string
  due_date: string
  notes: string | null
  /** só vai ao banco quando o juros é ao dia (ou o empréstimo já usa esses campos) */
  daily_rate?: number | null
  term_rate?: number
}

export interface FunderInput {
  id?: string
  funder_name: string
  funder_email: string | null
  funder_user_id: string | null
  amount: number
  rate: number
  can_see_borrower: boolean
  can_see_payments: boolean
  can_see_chart?: boolean
  daily_rate?: number | null
  term_rate?: number
}

const SELECT = '*, funders:loan_funders(*), payments:loan_payments(*), funder_payments(*)'

function sortLoan(l: LoanFull): LoanFull {
  return {
    ...l,
    renewals: [...(l.renewals ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    funders: [...(l.funders ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    payments: [...(l.payments ?? [])].sort(
      (a, b) => b.paid_at.localeCompare(a.paid_at) || b.created_at.localeCompare(a.created_at)
    ),
    funder_payments: [...(l.funder_payments ?? [])].sort(
      (a, b) => b.paid_at.localeCompare(a.paid_at) || b.created_at.localeCompare(a.created_at)
    ),
  }
}

/** Empréstimos que EU fiz (sou o dono): crio, edito, registro pagamentos. */
export function useLoans() {
  const { user } = useAuth()
  const [loans, setLoans] = useState<LoanFull[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLoans = useCallback(async () => {
    if (!user) return
    const { data, error: err } = await supabase
      .from('loans')
      .select(SELECT)
      .eq('owner_id', user.id)
      .order('due_date', { ascending: true })
    if (err) setError(err.message)
    else {
      // renovações vêm à parte: se a tabela ainda não existir no banco, o resto continua funcionando
      const { data: ren } = await supabase.from('loan_renewals').select('*').eq('owner_id', user.id)
      const byLoan = new Map<string, LoanRenewal[]>()
      for (const r of (ren ?? []) as LoanRenewal[]) byLoan.set(r.loan_id, [...(byLoan.get(r.loan_id) ?? []), r])
      setLoans(((data ?? []) as LoanFull[]).map((l) => sortLoan({ ...l, renewals: byLoan.get(l.id) ?? [] })))
      setError(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  async function syncFunders(loanId: string, funders: FunderInput[]) {
    if (!user) return 'Não autenticado'
    const { data: existing, error: e1 } = await supabase.from('loan_funders').select('id').eq('loan_id', loanId)
    if (e1) return e1.message
    const keep = new Set(funders.filter((f) => f.id).map((f) => f.id as string))
    const toDelete = (existing ?? []).map((r) => r.id).filter((id) => !keep.has(id))
    if (toDelete.length) {
      const { error: e2 } = await supabase.from('loan_funders').delete().in('id', toDelete)
      if (e2) return e2.message
    }
    for (const f of funders) {
      const row = {
        funder_name: f.funder_name,
        funder_email: f.funder_email,
        funder_user_id: f.funder_user_id,
        amount: f.amount,
        rate: f.rate,
        can_see_borrower: f.can_see_borrower,
        can_see_payments: f.can_see_payments,
        ...(f.can_see_chart !== undefined ? { can_see_chart: f.can_see_chart } : {}),
        ...(f.daily_rate !== undefined ? { daily_rate: f.daily_rate } : {}),
        ...(f.term_rate !== undefined ? { term_rate: f.term_rate } : {}),
      }
      const { error: e3 } = f.id
        ? await supabase.from('loan_funders').update(row).eq('id', f.id)
        : await supabase.from('loan_funders').insert({ ...row, loan_id: loanId, owner_id: user.id })
      if (e3) return e3.message
    }
    return null
  }

  async function saveLoan(input: LoanInput, funders: FunderInput[], editId?: string) {
    if (!user) return { id: null as string | null, error: 'Não autenticado' }
    let loanId = editId ?? null
    if (editId) {
      const { error: err } = await supabase
        .from('loans')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', editId)
      if (err) return { id: null, error: err.message }
    } else {
      const { data, error: err } = await supabase
        .from('loans')
        .insert({ ...input, owner_id: user.id })
        .select('id')
        .single()
      if (err) return { id: null, error: err.message }
      loanId = data.id
    }
    const fErr = await syncFunders(loanId as string, funders)
    await fetchLoans()
    return { id: loanId, error: fErr }
  }

  async function deleteLoan(id: string) {
    const { error: err } = await supabase.from('loans').delete().eq('id', id)
    if (!err) await fetchLoans()
    return { error: err?.message ?? null }
  }

  async function setClosed(id: string, closed: boolean) {
    const { error: err } = await supabase
      .from('loans')
      .update({ closed, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!err) await fetchLoans()
    return { error: err?.message ?? null }
  }

  async function addPayment(loanId: string, amount: number, paidAt: string, note?: string) {
    if (!user) return { error: 'Não autenticado' }
    const { error: err } = await supabase
      .from('loan_payments')
      .insert({ loan_id: loanId, owner_id: user.id, amount, paid_at: paidAt, note: note || null })
    if (!err) await fetchLoans()
    return { error: err?.message ?? null }
  }

  async function deletePayment(id: string) {
    const { error: err } = await supabase.from('loan_payments').delete().eq('id', id)
    if (!err) await fetchLoans()
    return { error: err?.message ?? null }
  }

  async function addFunderPayment(funderId: string, loanId: string, amount: number, paidAt: string, note?: string) {
    if (!user) return { error: 'Não autenticado' }
    const { error: err } = await supabase.from('funder_payments').insert({
      funder_id: funderId,
      loan_id: loanId,
      owner_id: user.id,
      amount,
      paid_at: paidAt,
      note: note || null,
    })
    if (!err) await fetchLoans()
    return { error: err?.message ?? null }
  }

  async function deleteFunderPayment(id: string) {
    const { error: err } = await supabase.from('funder_payments').delete().eq('id', id)
    if (!err) await fetchLoans()
    return { error: err?.message ?? null }
  }

  async function updateFunderAccess(funderId: string, patch: { can_see_borrower?: boolean; can_see_payments?: boolean; can_see_chart?: boolean }) {
    const { error: err } = await supabase.from('loan_funders').update(patch).eq('id', funderId)
    if (!err) await fetchLoans()
    return { error: err?.message ?? null }
  }

  /** O devedor pagou só os juros: registra o pagamento, empurra o vencimento e soma os juros do novo prazo. */
  async function renewLoan(loanId: string, interestPaid: number, newDue: string, termRate: number, note?: string) {
    const { error: err } = await supabase.rpc('renew_loan', {
      p_loan_id: loanId,
      p_interest_paid: interestPaid,
      p_new_due: newDue,
      p_term_rate: termRate,
      p_note: note || null,
    })
    if (!err) await fetchLoans()
    return { error: err?.message ?? null }
  }

  async function regenerateCode(loanId: string) {
    const { error: err } = await supabase.rpc('regenerate_loan_code', { p_loan_id: loanId })
    if (!err) await fetchLoans()
    return { error: err?.message ?? null }
  }

  /** Tira o acesso de quem entrou (devedor ou co-fundador) e libera a vaga pro código. */
  async function releaseAccess(target: { loanId: string } | { funderId: string }) {
    const { error: err } =
      'funderId' in target
        ? await supabase.from('loan_funders').update({ funder_user_id: null }).eq('id', target.funderId)
        : await supabase.from('loans').update({ borrower_user_id: null }).eq('id', target.loanId)
    if (!err) await fetchLoans()
    return { error: err?.message ?? null }
  }

  return {
    loans,
    loading,
    error,
    refetch: fetchLoans,
    regenerateCode,
    renewLoan,
    releaseAccess,
    saveLoan,
    deleteLoan,
    setClosed,
    addPayment,
    deletePayment,
    addFunderPayment,
    deleteFunderPayment,
    updateFunderAccess,
  }
}

export interface CodeLookup {
  owner_name: string | null
  due_date: string
  borrower_open: boolean
  funders_open: { id: string; name: string }[]
}

/** Quem recebeu um código: confere de quem é e quais vagas estão livres. */
export async function lookupLoanCode(code: string) {
  const { data, error } = await supabase.rpc('lookup_loan_code', { p_code: code })
  return { info: (data as CodeLookup) ?? null, error: error?.message ?? null }
}

/** Entra no empréstimo como devedor ou como co-fundador (numa vaga livre). */
export async function redeemLoanCode(code: string, role: 'borrower' | 'funder', funderId?: string) {
  const { error } = await supabase.rpc('redeem_loan_code', {
    p_code: code,
    p_role: role,
    p_funder_id: funderId ?? null,
  })
  return { error: error?.message ?? null }
}

/** Empréstimos em que participo: como devedor (eu devo) e como co-fundador (vou receber). */
export function useParticipations() {
  const { user } = useAuth()
  const [borrowings, setBorrowings] = useState<Borrowing[]>([])
  const [fundings, setFundings] = useState<Funding[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!user) return
    const [b, f] = await Promise.all([supabase.rpc('get_my_borrowings'), supabase.rpc('get_my_fundings')])
    setBorrowings((b.data as Borrowing[]) ?? [])
    setFundings((f.data as Funding[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { borrowings, fundings, loading, refetch: fetchAll }
}
