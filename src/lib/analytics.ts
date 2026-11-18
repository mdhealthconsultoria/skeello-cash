import { loanSummary, round2 } from './loans'
import type { LoanFull } from '../types/database'

export interface DebtRow {
  id: string
  type: 'receivable' | 'payable'
  amount: number
  status: string
  due_date: string | null
  issue_date: string
  category_id: string | null
  person_id: string
  person_name: string
  /** quanto já foi pago (todos os pagamentos) */
  paid: number
  /** quanto falta (0 se cancelada ou quitada) */
  remaining: number
}

export interface PaymentRow {
  id: string
  debt_id: string
  amount: number
  payment_date: string
  type: 'receivable' | 'payable'
}

export interface DateRange {
  from: string // AAAA-MM-DD
  to: string
  label: string
}

export type PeriodMode = 'month' | '3m' | '6m' | '12m' | 'custom'

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayStr = () => ymd(new Date())

const monthLabel = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const shortMonth = (d: Date) => d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')

export function rangeFor(mode: PeriodMode, anchor: Date, custom: { from: string; to: string }): DateRange {
  if (mode === 'month') {
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const to = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { from: ymd(from), to: ymd(to), label: monthLabel(from) }
  }
  if (mode === 'custom') {
    const from = custom.from || todayStr()
    const to = custom.to && custom.to >= from ? custom.to : from
    return { from, to, label: `${fmtShort(from)} a ${fmtShort(to)}` }
  }
  const n = mode === '3m' ? 3 : mode === '6m' ? 6 : 12
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { from: ymd(from), to: ymd(to), label: `Últimos ${n} meses` }
}

function fmtShort(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/** O período de mesmo tamanho logo antes (para comparar). */
export function previousRange(r: DateRange): DateRange {
  const from = new Date(`${r.from}T00:00:00`)
  const to = new Date(`${r.to}T00:00:00`)
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1
  const pTo = new Date(from)
  pTo.setDate(pTo.getDate() - 1)
  const pFrom = new Date(pTo)
  pFrom.setDate(pFrom.getDate() - (days - 1))
  return { from: ymd(pFrom), to: ymd(pTo), label: 'período anterior' }
}

export const inRange = (date: string | null | undefined, r: DateRange) => {
  if (!date) return false
  const d = date.slice(0, 10)
  return d >= r.from && d <= r.to
}

export interface Flows {
  received: number
  paid: number
  net: number
  /** parte dos recebimentos de empréstimos que é juros (estimada pela proporção juros/total) */
  interest: number
  newReceivable: number
  newPayable: number
}

export function flowsFor(r: DateRange, payments: PaymentRow[], debts: DebtRow[], loans: LoanFull[]): Flows {
  let received = 0
  let paid = 0
  let interest = 0
  for (const p of payments) {
    if (!inRange(p.payment_date, r)) continue
    if (p.type === 'receivable') received += p.amount
    else paid += p.amount
  }
  for (const l of loans) {
    const s = loanSummary(l)
    const ratio = s.total > 0 ? s.interest / s.total : 0
    for (const p of l.payments) {
      if (!inRange(p.paid_at, r)) continue
      received += p.amount
      interest += p.amount * ratio
    }
    for (const p of l.funder_payments) {
      if (inRange(p.paid_at, r)) paid += p.amount
    }
  }
  let newReceivable = 0
  let newPayable = 0
  for (const d of debts) {
    if (d.status === 'cancelled' || !inRange(d.issue_date, r)) continue
    if (d.type === 'receivable') newReceivable += d.amount
    else newPayable += d.amount
  }
  return {
    received: round2(received),
    paid: round2(paid),
    net: round2(received - paid),
    interest: round2(interest),
    newReceivable: round2(newReceivable),
    newPayable: round2(newPayable),
  }
}

export interface MonthRow {
  key: string
  label: string
  received: number
  paid: number
  net: number
  interest: number
  newReceivable: number
  newPayable: number
}

/** Uma linha por mês dentro do período. */
export function monthlySeries(r: DateRange, payments: PaymentRow[], debts: DebtRow[], loans: LoanFull[]): MonthRow[] {
  const rows: MonthRow[] = []
  const start = new Date(`${r.from}T00:00:00`)
  const end = new Date(`${r.to}T00:00:00`)
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cur <= end && rows.length < 36) {
    const mFrom = ymd(cur)
    const mTo = ymd(new Date(cur.getFullYear(), cur.getMonth() + 1, 0))
    const sub: DateRange = { from: mFrom < r.from ? r.from : mFrom, to: mTo > r.to ? r.to : mTo, label: '' }
    const f = flowsFor(sub, payments, debts, loans)
    rows.push({ key: mFrom.slice(0, 7), label: shortMonth(cur), ...f })
    cur.setMonth(cur.getMonth() + 1)
  }
  return rows
}

export interface Position {
  openReceivable: number
  openPayable: number
  overdueReceivable: number
  overduePayable: number
  loanCapital: number // valor emprestado ainda na rua
  loanToReceive: number
  loanToPass: number
  loanInterestExpected: number
  loanProfitExpected: number
  activeLoans: number
}

export function positionNow(debts: DebtRow[], loans: LoanFull[]): Position {
  const today = todayStr()
  let openReceivable = 0
  let openPayable = 0
  let overdueReceivable = 0
  let overduePayable = 0
  for (const d of debts) {
    if (d.remaining <= 0) continue
    const late = d.due_date != null && d.due_date < today
    if (d.type === 'receivable') {
      openReceivable += d.remaining
      if (late) overdueReceivable += d.remaining
    } else {
      openPayable += d.remaining
      if (late) overduePayable += d.remaining
    }
  }
  const active = loans.filter((l) => !l.closed)
  let loanCapital = 0
  let loanToReceive = 0
  let loanToPass = 0
  let loanInterestExpected = 0
  let loanProfitExpected = 0
  for (const l of active) {
    const s = loanSummary(l)
    if (s.settled) continue
    loanCapital += l.principal
    loanToReceive += s.remaining
    loanToPass += s.funderRemaining
    loanInterestExpected += s.interest
    loanProfitExpected += s.profit
  }
  return {
    openReceivable: round2(openReceivable),
    openPayable: round2(openPayable),
    overdueReceivable: round2(overdueReceivable),
    overduePayable: round2(overduePayable),
    loanCapital: round2(loanCapital),
    loanToReceive: round2(loanToReceive),
    loanToPass: round2(loanToPass),
    loanInterestExpected: round2(loanInterestExpected),
    loanProfitExpected: round2(loanProfitExpected),
    activeLoans: active.filter((l) => !loanSummary(l).settled).length,
  }
}

export interface ProjectionRow {
  key: string
  label: string
  inflow: number
  outflow: number
  net: number
  cumulative: number
}

export interface Projection {
  rows: ProjectionRow[]
  overdueIn: number
  overdueOut: number
  noDateIn: number
  noDateOut: number
  /** parte do que vence que costuma entrar, pelo seu histórico (0.3 a 1) */
  collectionRate: number
}

/** O quanto do que vence você costuma receber: pelo que já venceu e o que entrou dele. */
export function collectionRateFor(debts: DebtRow[]): number {
  const today = todayStr()
  let due = 0
  let got = 0
  for (const d of debts) {
    if (d.type !== 'receivable' || d.status === 'cancelled' || !d.due_date || d.due_date >= today) continue
    due += d.amount
    got += d.paid
  }
  if (due < 1) return 1
  return Math.min(1, Math.max(0.3, got / due))
}

/**
 * Projeção mês a mês pelo vencimento: o que deve entrar e sair.
 * `factor` reduz só as entradas (cenário cauteloso). O atrasado entra no primeiro mês.
 */
export function projectMonths(debts: DebtRow[], loans: LoanFull[], months: number, factor: number): Projection {
  const today = todayStr()
  const now = new Date()
  const rows: ProjectionRow[] = []
  const idx = new Map<string, ProjectionRow>()
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const row: ProjectionRow = { key: ymd(d).slice(0, 7), label: shortMonth(d), inflow: 0, outflow: 0, net: 0, cumulative: 0 }
    rows.push(row)
    idx.set(row.key, row)
  }
  let overdueIn = 0
  let overdueOut = 0
  let noDateIn = 0
  let noDateOut = 0

  const put = (due: string | null, amount: number, kind: 'in' | 'out') => {
    if (amount <= 0) return
    if (!due) {
      if (kind === 'in') noDateIn += amount
      else noDateOut += amount
      return
    }
    if (due < today) {
      if (kind === 'in') overdueIn += amount
      else overdueOut += amount
      return
    }
    const row = idx.get(due.slice(0, 7))
    if (!row) return // além do horizonte
    if (kind === 'in') row.inflow += amount
    else row.outflow += amount
  }

  for (const d of debts) put(d.due_date, d.remaining, d.type === 'receivable' ? 'in' : 'out')
  for (const l of loans) {
    if (l.closed) continue
    const s = loanSummary(l)
    put(l.due_date, s.remaining, 'in')
    put(l.due_date, s.funderRemaining, 'out')
  }

  // atrasado cai no mês atual
  rows[0].inflow += overdueIn
  rows[0].outflow += overdueOut

  let cum = 0
  for (const r of rows) {
    r.inflow = round2(r.inflow * factor)
    r.outflow = round2(r.outflow)
    r.net = round2(r.inflow - r.outflow)
    cum += r.net
    r.cumulative = round2(cum)
  }
  return {
    rows,
    overdueIn: round2(overdueIn),
    overdueOut: round2(overdueOut),
    noDateIn: round2(noDateIn),
    noDateOut: round2(noDateOut),
    collectionRate: collectionRateFor(debts),
  }
}

export interface AgingBucket {
  key: string
  label: string
  amount: number
  tone: 'ok' | 'warn' | 'bad'
}

/** A receber em aberto agrupado por quanto falta (ou quanto passou) do vencimento. */
export function agingReceivable(debts: DebtRow[], loans: LoanFull[]): AgingBucket[] {
  const today = new Date(`${todayStr()}T00:00:00`).getTime()
  const defs: AgingBucket[] = [
    { key: 'over60', label: 'Atrasado há mais de 60 dias', amount: 0, tone: 'bad' },
    { key: 'over30', label: 'Atrasado de 31 a 60 dias', amount: 0, tone: 'bad' },
    { key: 'over0', label: 'Atrasado até 30 dias', amount: 0, tone: 'warn' },
    { key: 'd7', label: 'Vence em até 7 dias', amount: 0, tone: 'ok' },
    { key: 'd30', label: 'Vence de 8 a 30 dias', amount: 0, tone: 'ok' },
    { key: 'd30p', label: 'Vence depois de 30 dias', amount: 0, tone: 'ok' },
    { key: 'none', label: 'Sem vencimento', amount: 0, tone: 'ok' },
  ]
  const by = Object.fromEntries(defs.map((d) => [d.key, d])) as Record<string, AgingBucket>
  const add = (due: string | null, amount: number) => {
    if (amount <= 0) return
    if (!due) return void (by.none.amount += amount)
    const diff = Math.round((new Date(`${due}T00:00:00`).getTime() - today) / 86400000)
    if (diff < -60) by.over60.amount += amount
    else if (diff < -30) by.over30.amount += amount
    else if (diff < 0) by.over0.amount += amount
    else if (diff <= 7) by.d7.amount += amount
    else if (diff <= 30) by.d30.amount += amount
    else by.d30p.amount += amount
  }
  for (const d of debts) if (d.type === 'receivable') add(d.due_date, d.remaining)
  for (const l of loans) if (!l.closed) add(l.due_date, loanSummary(l).remaining)
  return defs.map((d) => ({ ...d, amount: round2(d.amount) }))
}

export interface PersonRow {
  id: string
  name: string
  amount: number
}

export function topPeople(debts: DebtRow[], type: 'receivable' | 'payable', limit = 5): PersonRow[] {
  const map = new Map<string, PersonRow>()
  for (const d of debts) {
    if (d.type !== type || d.remaining <= 0) continue
    const cur = map.get(d.person_id) ?? { id: d.person_id, name: d.person_name, amount: 0 }
    cur.amount += d.remaining
    map.set(d.person_id, cur)
  }
  return [...map.values()].map((p) => ({ ...p, amount: round2(p.amount) })).sort((a, b) => b.amount - a.amount).slice(0, limit)
}

/** Variação em % entre o período atual e o anterior (null se não dá para comparar). */
export function delta(now: number, before: number): number | null {
  if (Math.abs(before) < 0.01) return null
  return ((now - before) / Math.abs(before)) * 100
}
