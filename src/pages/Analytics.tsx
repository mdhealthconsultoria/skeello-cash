import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gauge,
  Info,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLoans } from '../hooks/useLoans'
import { formatCurrency, formatDate } from '../lib/format'
import { loanSummary } from '../lib/loans'
import {
  agingReceivable,
  byMethod,
  delta,
  flowsFor,
  healthFor,
  monthlySeries,
  positionNow,
  previousRange,
  projectMonths,
  rangeFor,
  topPeople,
  upcomingItems,
  type DebtRow,
  type PaymentRow,
  type PeriodMode,
} from '../lib/analytics'
import { ValueInterestChart } from '../components/loans/ValueInterestChart'
import { OverdueCard } from '../components/overdue/OverdueCard'

const GREEN = '#16a352'
const RED = '#ef4444'
const BLUE = '#3b82f6'
const AMBER = '#f59e0b'
const CATEGORY_COLORS = ['#16a352', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

type Tab = 'overview' | 'months' | 'projection' | 'loans'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Visão geral' },
  { key: 'months', label: 'Mês a mês' },
  { key: 'projection', label: 'Projeções' },
  { key: 'loans', label: 'Empréstimos' },
]

const PERIODS: { key: PeriodMode; label: string }[] = [
  { key: 'month', label: 'Mês' },
  { key: '3m', label: '3 meses' },
  { key: '6m', label: '6 meses' },
  { key: '12m', label: '12 meses' },
  { key: 'custom', label: 'Datas' },
]

const compact = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (a >= 1_000) return `${(v / 1_000).toFixed(a >= 10_000 ? 0 : 1).replace('.', ',')}k`
  return String(Math.round(v))
}

const tooltipStyle = { borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12, padding: '8px 10px' }

type RawPayment = {
  id: string
  debt_id: string
  amount: number
  payment_date: string
  method?: string | null
  debt: { type: 'receivable' | 'payable' } | { type: 'receivable' | 'payable' }[] | null
}

type RawDebt = {
  id: string
  type: 'receivable' | 'payable'
  amount: number
  status: string
  due_date: string | null
  issue_date: string
  category_id: string | null
  person_id: string
  archived: boolean
  person: { name: string } | { name: string }[] | null
}

export default function Analytics({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { loans, loading: loansLoading } = useLoans()

  const [debts, setDebts] = useState<DebtRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<Tab>('overview')
  const [mode, setMode] = useState<PeriodMode>('6m')
  const [anchor, setAnchor] = useState(() => new Date())
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [horizon, setHorizon] = useState(6)
  const [scenario, setScenario] = useState<'full' | 'history' | 'careful'>('history')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const [{ data: debtRows }, { data: paymentRows }, { data: catRows }] = await Promise.all([
        supabase
          .from('debts')
          .select('id, type, amount, status, due_date, issue_date, category_id, person_id, archived, person:people(name)')
          .eq('user_id', user.id),
        supabase.from('payments').select('id, debt_id, amount, payment_date, method, debt:debts!inner(type)').eq('user_id', user.id),
        supabase.from('categories').select('id, name').or(`user_id.eq.${user.id},user_id.is.null`),
      ])

      const pays: PaymentRow[] = ((paymentRows ?? []) as unknown as RawPayment[]).map((p) => ({
        id: p.id,
        debt_id: p.debt_id,
        amount: Number(p.amount),
        payment_date: p.payment_date,
        method: p.method ?? null,
        type: (Array.isArray(p.debt) ? p.debt[0]?.type : p.debt?.type) ?? 'receivable',
      }))
      const paidBy = new Map<string, number>()
      for (const p of pays) paidBy.set(p.debt_id, (paidBy.get(p.debt_id) ?? 0) + p.amount)

      const rows: DebtRow[] = ((debtRows ?? []) as unknown as RawDebt[])
        .filter((d) => !d.archived)
        .map((d) => {
          const paid = paidBy.get(d.id) ?? 0
          const amount = Number(d.amount)
          return {
            id: d.id,
            type: d.type,
            amount,
            status: d.status,
            due_date: d.due_date,
            issue_date: d.issue_date,
            category_id: d.category_id,
            person_id: d.person_id,
            person_name: (Array.isArray(d.person) ? d.person[0]?.name : d.person?.name) ?? 'Sem nome',
            paid,
            remaining: d.status === 'cancelled' ? 0 : Math.max(amount - paid, 0),
          }
        })

      setDebts(rows)
      setPayments(pays)
      setCategoryNames(Object.fromEntries((catRows ?? []).map((c) => [c.id, c.name])))
      setLoading(false)
    })()
  }, [user])

  const range = useMemo(() => rangeFor(mode, anchor, custom), [mode, anchor, custom])
  const prev = useMemo(() => previousRange(range), [range])

  const flows = useMemo(() => flowsFor(range, payments, debts, loans), [range, payments, debts, loans])
  const prevFlows = useMemo(() => flowsFor(prev, payments, debts, loans), [prev, payments, debts, loans])
  const months = useMemo(() => monthlySeries(range, payments, debts, loans), [range, payments, debts, loans])
  const pos = useMemo(() => positionNow(debts, loans), [debts, loans])
  const aging = useMemo(() => agingReceivable(debts, loans), [debts, loans])
  const topIn = useMemo(() => topPeople(debts, 'receivable'), [debts])
  const topOut = useMemo(() => topPeople(debts, 'payable'), [debts])
  const health = useMemo(() => healthFor(debts, payments), [debts, payments])
  const upcoming = useMemo(() => upcomingItems(debts, loans), [debts, loans])
  const methods = useMemo(() => byMethod(range, payments), [range, payments])

  const projection = useMemo(() => {
    const base = projectMonths(debts, loans, horizon, 1)
    const f = scenario === 'full' ? 1 : scenario === 'careful' ? 0.7 : base.collectionRate
    return projectMonths(debts, loans, horizon, f)
  }, [debts, loans, horizon, scenario])

  const chartMonths = useMemo(() => {
    let run = 0
    return months.map((m) => {
      run += m.net
      return { ...m, saldo: Math.round(run * 100) / 100 }
    })
  }, [months])

  const categoryData = useMemo(() => {
    const totals = new Map<string, number>()
    for (const d of debts) {
      if (d.status === 'cancelled' || d.issue_date < range.from || d.issue_date > range.to) continue
      const name = d.category_id ? categoryNames[d.category_id] ?? 'Outros' : 'Sem categoria'
      totals.set(name, (totals.get(name) ?? 0) + d.amount)
    }
    return [...totals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [debts, categoryNames, range])

  const insights = useMemo(() => {
    const list: { tone: 'good' | 'warn' | 'info'; text: string }[] = []
    if (pos.overdueReceivable > 0) list.push({ tone: 'warn', text: `Você tem ${formatCurrency(pos.overdueReceivable)} a receber que já venceu.` })
    if (pos.overduePayable > 0) list.push({ tone: 'warn', text: `Você tem ${formatCurrency(pos.overduePayable)} a pagar que já venceu.` })
    if (topIn[0] && pos.openReceivable > 0) {
      const share = (topIn[0].amount / pos.openReceivable) * 100
      if (share >= 40) list.push({ tone: 'info', text: `${topIn[0].name} concentra ${Math.round(share)}% de tudo que você tem a receber.` })
    }
    const d = delta(flows.received, prevFlows.received)
    if (d !== null && Math.abs(d) >= 10) {
      list.push({ tone: d > 0 ? 'good' : 'warn', text: `Os recebimentos ${d > 0 ? 'subiram' : 'caíram'} ${Math.abs(Math.round(d))}% em relação ao período anterior.` })
    }
    if (months.length > 1) {
      const best = [...months].sort((a, b) => b.net - a.net)[0]
      if (best && best.net > 0) list.push({ tone: 'good', text: `Melhor mês do período: ${best.label}, com saldo de ${formatCurrency(best.net)}.` })
    }
    const neg = projection.rows.find((r) => r.cumulative < 0)
    if (neg) list.push({ tone: 'warn', text: `Pela projeção, o saldo acumulado fica negativo em ${neg.label}. Vale se preparar.` })
    if (pos.activeLoans > 0) {
      list.push({
        tone: 'info',
        text: `${pos.activeLoans} empréstimo${pos.activeLoans > 1 ? 's' : ''} em andamento, com ${formatCurrency(pos.loanProfitExpected)} de lucro previsto.`,
      })
    }
    return list
  }, [pos, topIn, flows, prevFlows, months, projection])

  if (loading || loansLoading) {
    return (
      <div className="space-y-4">
        <div className="card h-24 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
        <div className="card h-64 animate-pulse" />
      </div>
    )
  }

  const hasData = debts.length > 0 || loans.length > 0
  const showPeriod = tab === 'overview' || tab === 'months'

  function shiftMonth(step: number) {
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + step, 1))
  }

  function openMonth(key: string) {
    const [y, m] = key.split('-').map(Number)
    setAnchor(new Date(y, m - 1, 1))
    setMode('month')
    setTab('overview')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-5 tabular-nums">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Análises</h1>
          <p className="text-ink-400 text-sm">Como seu dinheiro andou, onde está agora e para onde vai.</p>
        </div>
      )}

      {/* Abas */}
      <div className="flex gap-1 p-1 rounded-xl bg-ink-100 dark:bg-ink-800 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition ${
              tab === t.key ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-50 shadow-sm' : 'text-ink-500 dark:text-ink-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <div className="card p-10 text-center text-ink-400 text-sm">Adicione movimentações ou empréstimos para ver suas análises aqui.</div>
      ) : (
        <>
          {showPeriod && (
            <div className="card p-3 space-y-3">
              <div className="flex gap-1 overflow-x-auto">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setMode(p.key)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      mode === p.key ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900' : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {mode === 'month' && (
                <div className="flex items-center justify-between">
                  <button onClick={() => shiftMonth(-1)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Mês anterior">
                    <ChevronLeft size={18} />
                  </button>
                  <p className="text-sm font-semibold capitalize text-ink-900 dark:text-ink-50">{range.label}</p>
                  <button onClick={() => shiftMonth(1)} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Próximo mês">
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
              {mode === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">De</label>
                    <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Até</label>
                    <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="input" />
                  </div>
                </div>
              )}
              {mode !== 'month' && mode !== 'custom' && (
                <p className="text-xs text-ink-400">
                  {formatDate(range.from)} a {formatDate(range.to)}
                </p>
              )}
            </div>
          )}

          {tab === 'overview' && (
            <>
              <Hero pos={pos} />

              <OverdueCard scope="all" />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Recebido" value={flows.received} tone="text-brand-600 dark:text-brand-400" change={delta(flows.received, prevFlows.received)} />
                <Kpi label="Pago" value={flows.paid} tone="text-red-600 dark:text-red-400" change={delta(flows.paid, prevFlows.paid)} invert />
                <Kpi
                  label="Saldo do período"
                  value={flows.net}
                  tone={flows.net >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}
                  change={delta(flows.net, prevFlows.net)}
                />
                <Kpi label="Juros recebidos (est.)" value={flows.interest} hint="Parte dos recebimentos de empréstimos que é juros." />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi
                  label="A receber agora"
                  value={pos.openReceivable + pos.loanToReceive}
                  sub={pos.overdueReceivable > 0 ? `${formatCurrency(pos.overdueReceivable)} atrasado` : 'nada atrasado'}
                  subBad={pos.overdueReceivable > 0}
                />
                <Kpi
                  label="A pagar agora"
                  value={pos.openPayable + pos.loanToPass}
                  sub={pos.overduePayable > 0 ? `${formatCurrency(pos.overduePayable)} atrasado` : 'nada atrasado'}
                  subBad={pos.overduePayable > 0}
                />
                <Kpi label="Novos a receber" value={flows.newReceivable} sub="criados no período" />
                <Kpi label="Novos a pagar" value={flows.newPayable} sub="criados no período" />
              </div>

              <Section title="Saúde das suas cobranças" subtitle="Calculado com tudo que você já registrou.">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <Metric
                    icon={Gauge}
                    label="Taxa de recebimento"
                    value={`${Math.round(health.collectionRate * 100)}%`}
                    hint="do que já venceu, quanto entrou"
                    tone={health.collectionRate >= 0.8 ? 'good' : health.collectionRate >= 0.5 ? 'mid' : 'bad'}
                  />
                  <Metric
                    icon={Clock3}
                    label="Pagam em dia"
                    value={health.onTimeRate === null ? '—' : `${Math.round(health.onTimeRate)}%`}
                    hint="das dívidas quitadas, até o vencimento"
                    tone={health.onTimeRate === null ? 'mid' : health.onTimeRate >= 70 ? 'good' : health.onTimeRate >= 40 ? 'mid' : 'bad'}
                  />
                  <Metric
                    icon={CalendarClock}
                    label="Prazo médio"
                    value={health.avgDaysToReceive === null ? '—' : `${Math.round(health.avgDaysToReceive)} dias`}
                    hint="para uma dívida ser quitada"
                  />
                  <Metric icon={Receipt} label="Ticket médio" value={formatCurrency(health.avgTicket)} hint="valor de cada dívida a receber" />
                  <Metric icon={Users} label="Pessoas em aberto" value={String(health.peopleOpen)} hint="com algo a receber ou a pagar" />
                  <Metric
                    icon={Wallet}
                    label="Maior devedor"
                    value={health.biggest ? health.biggest.name : '—'}
                    hint={health.biggest ? formatCurrency(health.biggest.amount) : 'ninguém te deve'}
                  />
                </div>
              </Section>

              {upcoming.length > 0 && (
                <Section title="Próximos vencimentos" subtitle="O que vence nos próximos 30 dias e o que já passou.">
                  <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                    {upcoming.map((u) => (
                      <li
                        key={u.key}
                        onClick={() => navigate(u.loanId ? `/emprestimos/${u.loanId}` : `/pessoas/${u.personId}`)}
                        className="flex items-center gap-3 py-2.5 cursor-pointer"
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            u.kind === 'in' ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600' : 'bg-red-50 dark:bg-red-500/10 text-red-600'
                          }`}
                        >
                          {u.kind === 'in' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{u.who}</p>
                          <p className={`text-xs ${u.days < 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-ink-400'}`}>
                            {u.days < 0 ? `Atrasado há ${Math.abs(u.days)} dia${Math.abs(u.days) === 1 ? '' : 's'}` : u.days === 0 ? 'Vence hoje' : u.days === 1 ? 'Vence amanhã' : `Vence em ${u.days} dias`} · {formatDate(u.due)}
                          </p>
                        </div>
                        <p className={`shrink-0 text-sm font-semibold ${u.kind === 'in' ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCurrency(u.amount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {insights.length > 0 && (
                <Section title="O que chama atenção">
                  <ul className="space-y-2">
                    {insights.map((i, k) => (
                      <li key={k} className="flex items-start gap-2.5 text-sm text-ink-700 dark:text-ink-200">
                        {i.tone === 'warn' ? (
                          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                        ) : i.tone === 'good' ? (
                          <TrendingUp size={16} className="mt-0.5 shrink-0 text-brand-500" />
                        ) : (
                          <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
                        )}
                        {i.text}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section title="Recebido x pago, com saldo acumulado">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={chartMonths} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-ink-100 dark:stroke-ink-800" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={44} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0} className="stroke-ink-300" />
                    <Bar dataKey="received" name="Recebido" fill={GREEN} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="paid" name="Pago" fill={RED} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    <Line dataKey="saldo" name="Saldo acumulado" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3 }} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              </Section>

              <Section title="A receber por prazo" subtitle="Quanto falta receber, agrupado por vencimento.">
                <Bars
                  rows={aging.map((a) => ({ key: a.key, label: a.label, amount: a.amount, color: a.tone === 'bad' ? RED : a.tone === 'warn' ? AMBER : GREEN }))}
                  empty="Nada a receber agora."
                />
              </Section>

              <div className="grid lg:grid-cols-2 gap-5">
                <Section title="Quem mais te deve" subtitle="Em aberto, por pessoa.">
                  <Bars
                    rows={topIn.map((p) => ({ key: p.id, label: p.name, amount: p.amount, color: GREEN }))}
                    onRow={(id) => navigate(`/pessoas/${id}`)}
                    empty="Ninguém te deve nada agora."
                  />
                </Section>
                <Section title="A quem você mais deve" subtitle="Em aberto, por pessoa.">
                  <Bars
                    rows={topOut.map((p) => ({ key: p.id, label: p.name, amount: p.amount, color: RED }))}
                    onRow={(id) => navigate(`/pessoas/${id}`)}
                    empty="Você não deve nada agora."
                  />
                </Section>
              </div>

              {methods.length > 0 && (
                <Section title="Como você recebeu" subtitle="Recebimentos do período por forma de pagamento.">
                  <Bars rows={methods.map((m, i) => ({ key: m.name, label: m.name, amount: m.value, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))} />
                </Section>
              )}

              {categoryData.length > 0 && (
                <Section title="Categorias do período" subtitle="Valor das movimentações criadas no período.">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2} stroke="none">
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Section>
              )}
            </>
          )}

          {tab === 'months' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Recebido no período" value={flows.received} tone="text-brand-600 dark:text-brand-400" />
                <Kpi label="Pago no período" value={flows.paid} tone="text-red-600 dark:text-red-400" />
                <Kpi label="Saldo" value={flows.net} tone={flows.net >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'} />
                <Kpi label="Média por mês" value={months.length ? flows.net / months.length : 0} sub="saldo médio" />
              </div>
              <Section title="Análise de cada mês" subtitle="Toque em um mês para ver o detalhe dele.">
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="text-left text-xs text-ink-400">
                        <th className="py-2 px-1 font-medium">Mês</th>
                        <th className="py-2 px-1 font-medium text-right">Recebido</th>
                        <th className="py-2 px-1 font-medium text-right">Pago</th>
                        <th className="py-2 px-1 font-medium text-right">Saldo</th>
                        <th className="py-2 px-1 font-medium text-right">Juros (est.)</th>
                        <th className="py-2 px-1 font-medium text-right">Novos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...months].reverse().map((m) => (
                        <tr
                          key={m.key}
                          onClick={() => openMonth(m.key)}
                          className="border-t border-ink-100 dark:border-ink-800 cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/60"
                        >
                          <td className="py-2.5 px-1 font-medium capitalize text-ink-900 dark:text-ink-50">
                            {m.label}
                            <span className="text-ink-400 font-normal"> {m.key.slice(2, 4)}</span>
                          </td>
                          <td className="py-2.5 px-1 text-right text-brand-600 dark:text-brand-400">{formatCurrency(m.received)}</td>
                          <td className="py-2.5 px-1 text-right text-red-600 dark:text-red-400">{formatCurrency(m.paid)}</td>
                          <td className={`py-2.5 px-1 text-right font-semibold ${m.net >= 0 ? 'text-ink-900 dark:text-ink-50' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(m.net)}
                          </td>
                          <td className="py-2.5 px-1 text-right text-ink-500">{formatCurrency(m.interest)}</td>
                          <td className="py-2.5 px-1 text-right text-ink-500">{formatCurrency(m.newReceivable + m.newPayable)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ink-200 dark:border-ink-700 font-semibold text-ink-900 dark:text-ink-50">
                        <td className="py-2.5 px-1">Total</td>
                        <td className="py-2.5 px-1 text-right">{formatCurrency(flows.received)}</td>
                        <td className="py-2.5 px-1 text-right">{formatCurrency(flows.paid)}</td>
                        <td className="py-2.5 px-1 text-right">{formatCurrency(flows.net)}</td>
                        <td className="py-2.5 px-1 text-right">{formatCurrency(flows.interest)}</td>
                        <td className="py-2.5 px-1 text-right">{formatCurrency(flows.newReceivable + flows.newPayable)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Section>
              <Section title="Saldo de cada mês">
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={months} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-ink-100 dark:stroke-ink-800" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={44} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
                    <ReferenceLine y={0} className="stroke-ink-300" />
                    <Bar dataKey="net" name="Saldo" radius={[6, 6, 0, 0]} maxBarSize={32}>
                      {months.map((m) => (
                        <Cell key={m.key} fill={m.net >= 0 ? GREEN : RED} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </Section>
            </>
          )}

          {tab === 'projection' && (
            <>
              <div className="card p-3 grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantos meses à frente</label>
                  <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="input">
                    {[3, 6, 9, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} meses
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Cenário de recebimento</label>
                  <select value={scenario} onChange={(e) => setScenario(e.target.value as typeof scenario)} className="input">
                    <option value="full">Todos pagam em dia (100%)</option>
                    <option value="history">Pelo meu histórico ({Math.round(projection.collectionRate * 100)}%)</option>
                    <option value="careful">Cauteloso (70%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Entra no período" value={projection.rows.reduce((s, r) => s + r.inflow, 0)} tone="text-brand-600 dark:text-brand-400" />
                <Kpi label="Sai no período" value={projection.rows.reduce((s, r) => s + r.outflow, 0)} tone="text-red-600 dark:text-red-400" />
                <Kpi label="Saldo projetado" value={projection.rows[projection.rows.length - 1]?.cumulative ?? 0} />
                <Kpi label="Sem data de vencimento" value={projection.noDateIn - projection.noDateOut} sub="fora da projeção" />
              </div>

              <Section title="Entradas, saídas e saldo acumulado" subtitle="Pelo vencimento do que está em aberto. O atrasado entra no mês atual.">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={projection.rows} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-ink-100 dark:stroke-ink-800" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={44} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0} className="stroke-ink-300" />
                    <Bar dataKey="inflow" name="Entra" fill={GREEN} radius={[6, 6, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="outflow" name="Sai" fill={RED} radius={[6, 6, 0, 0]} maxBarSize={26} />
                    <Line dataKey="cumulative" name="Saldo acumulado" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3 }} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              </Section>

              {(projection.overdueIn > 0 || projection.overdueOut > 0) && (
                <div className="card p-4 flex items-start gap-3 border-amber-200 dark:border-amber-500/30">
                  <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-700 dark:text-ink-200">
                    Já venceram {formatCurrency(projection.overdueIn)} a receber e {formatCurrency(projection.overdueOut)} a pagar. Eles foram
                    somados ao mês atual.
                  </p>
                </div>
              )}

              <Section title="Mês a mês">
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full text-sm min-w-[420px]">
                    <thead>
                      <tr className="text-left text-xs text-ink-400">
                        <th className="py-2 px-1 font-medium">Mês</th>
                        <th className="py-2 px-1 font-medium text-right">Entra</th>
                        <th className="py-2 px-1 font-medium text-right">Sai</th>
                        <th className="py-2 px-1 font-medium text-right">Saldo</th>
                        <th className="py-2 px-1 font-medium text-right">Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projection.rows.map((r) => (
                        <tr key={r.key} className="border-t border-ink-100 dark:border-ink-800">
                          <td className="py-2.5 px-1 font-medium capitalize text-ink-900 dark:text-ink-50">
                            {r.label}
                            <span className="text-ink-400 font-normal"> {r.key.slice(2, 4)}</span>
                          </td>
                          <td className="py-2.5 px-1 text-right text-brand-600 dark:text-brand-400">{formatCurrency(r.inflow)}</td>
                          <td className="py-2.5 px-1 text-right text-red-600 dark:text-red-400">{formatCurrency(r.outflow)}</td>
                          <td className="py-2.5 px-1 text-right">{formatCurrency(r.net)}</td>
                          <td className={`py-2.5 px-1 text-right font-semibold ${r.cumulative >= 0 ? 'text-ink-900 dark:text-ink-50' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(r.cumulative)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
              <p className="text-xs text-ink-400">
                A projeção usa só o que já está cadastrado, pela data de vencimento. O cenário "pelo meu histórico" reduz as entradas pelo que
                costuma ser pago de verdade.
              </p>
            </>
          )}

          {tab === 'loans' && <LoansTab loans={loans} pos={pos} />}
        </>
      )}
    </div>
  )
}

function LoansTab({ loans, pos }: { loans: ReturnType<typeof useLoans>['loans']; pos: ReturnType<typeof positionNow> }) {
  const navigate = useNavigate()
  const rows = loans.map((l) => ({ loan: l, s: loanSummary(l) }))
  if (rows.length === 0) {
    return <div className="card p-10 text-center text-ink-400 text-sm">Você ainda não tem empréstimos. Crie um em Empréstimos para ver a análise aqui.</div>
  }
  const active = rows.filter((r) => !r.loan.closed && !r.s.settled)
  const principalAll = rows.reduce((s, r) => s + r.loan.principal, 0)
  const interestAll = rows.reduce((s, r) => s + r.s.interest, 0)
  const receivedAll = rows.reduce((s, r) => s + r.s.paid, 0)
  const ownMoney = active.reduce((s, r) => s + r.s.ownMoney, 0)
  const roi = ownMoney > 0 ? (pos.loanProfitExpected / ownMoney) * 100 : null
  const renewals = rows.reduce((s, r) => s + r.loan.renewals.length, 0)
  const overdue = active.filter((r) => r.s.overdue)

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Dinheiro na rua" value={pos.loanCapital} sub={`${pos.activeLoans} em andamento`} />
        <Kpi label="A receber" value={pos.loanToReceive} tone="text-brand-600 dark:text-brand-400" />
        <Kpi label="Juros previstos" value={pos.loanInterestExpected} />
        <Kpi
          label="Lucro previsto"
          value={pos.loanProfitExpected}
          tone="text-brand-600 dark:text-brand-400"
          sub={roi !== null ? `${roi.toFixed(1).replace('.', ',')}% sobre o seu dinheiro` : undefined}
        />
      </div>

      <Section title="Valor e juros de todos os empréstimos">
        <ValueInterestChart principal={principalAll} interest={interestAll} principalLabel="Valor emprestado" received={receivedAll} />
        {renewals > 0 && (
          <p className="text-xs text-ink-400 mt-3">
            {renewals} renovação{renewals > 1 ? 'ões' : ''} feita{renewals > 1 ? 's' : ''} (devedor pagou só os juros).
          </p>
        )}
      </Section>

      {overdue.length > 0 && (
        <div className="card p-4 flex items-start gap-3 border-amber-200 dark:border-amber-500/30">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-ink-700 dark:text-ink-200">
            {overdue.length} empréstimo{overdue.length > 1 ? 's' : ''} atrasado{overdue.length > 1 ? 's' : ''}, somando{' '}
            {formatCurrency(overdue.reduce((s, r) => s + r.s.remaining, 0))}. Veja se dá para renovar só com os juros.
          </p>
        </div>
      )}

      <Section title="Cada empréstimo">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-xs text-ink-400">
                <th className="py-2 px-1 font-medium">Devedor</th>
                <th className="py-2 px-1 font-medium text-right">Valor</th>
                <th className="py-2 px-1 font-medium text-right">Juros</th>
                <th className="py-2 px-1 font-medium text-right">Falta</th>
                <th className="py-2 px-1 font-medium text-right">Lucro</th>
                <th className="py-2 px-1 font-medium text-right">Vence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ loan, s }) => (
                <tr
                  key={loan.id}
                  onClick={() => navigate(`/emprestimos/${loan.id}`)}
                  className="border-t border-ink-100 dark:border-ink-800 cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-800/60"
                >
                  <td className="py-2.5 px-1 font-medium text-ink-900 dark:text-ink-50">
                    {loan.borrower_name}
                    {s.settled && <span className="ml-1.5 text-[10px] text-brand-600">quitado</span>}
                  </td>
                  <td className="py-2.5 px-1 text-right">{formatCurrency(loan.principal)}</td>
                  <td className="py-2.5 px-1 text-right text-ink-500">{formatCurrency(s.interest)}</td>
                  <td className="py-2.5 px-1 text-right font-medium">{formatCurrency(s.remaining)}</td>
                  <td className={`py-2.5 px-1 text-right ${s.profit >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600'}`}>{formatCurrency(s.profit)}</td>
                  <td className={`py-2.5 px-1 text-right ${s.overdue ? 'text-red-600 dark:text-red-400' : 'text-ink-500'}`}>{formatDate(loan.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}

/** Cartão de abertura: a posição líquida de agora, com a divisão entre o que entra e o que sai. */
function Hero({ pos }: { pos: ReturnType<typeof positionNow> }) {
  const receivable = pos.openReceivable + pos.loanToReceive
  const payable = pos.openPayable + pos.loanToPass
  const net = Math.round((receivable - payable) * 100) / 100
  const total = receivable + payable
  const pct = total > 0 ? (receivable / total) * 100 : 50
  const overdue = pos.overdueReceivable + pos.overduePayable
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-ink-800 to-brand-900 p-5 sm:p-6 text-white shadow-lg">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/20 blur-3xl" />
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">Posição líquida agora</p>
      <p className={`mt-1 text-3xl sm:text-4xl font-bold ${net < 0 ? 'text-red-300' : 'text-white'}`}>{formatCurrency(net)}</p>
      <p className="mt-0.5 text-sm text-white/70">
        {net > 0.009 ? 'é quanto ainda deve entrar, já descontando o que você deve' : net < -0.009 ? 'é quanto você ainda deve, já descontando o que te devem' : 'o que você tem a receber cobre o que deve'}
      </p>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-red-400/70">
        <div className="h-full rounded-full bg-brand-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-white/60">A receber</p>
          <p className="font-semibold text-brand-300">{formatCurrency(receivable)}</p>
        </div>
        <div>
          <p className="text-[11px] text-white/60">A pagar</p>
          <p className="font-semibold text-red-300">{formatCurrency(payable)}</p>
        </div>
        <div>
          <p className="text-[11px] text-white/60">Atrasado</p>
          <p className={`font-semibold ${overdue > 0 ? 'text-amber-300' : 'text-white/80'}`}>{formatCurrency(overdue)}</p>
        </div>
      </div>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  tone?: 'good' | 'mid' | 'bad'
}) {
  const color =
    tone === 'good'
      ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400'
      : tone === 'bad'
        ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
        : tone === 'mid'
          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300'
  return (
    <div className="rounded-2xl border border-ink-100 dark:border-ink-800 p-3.5">
      <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${color}`}>
        <Icon size={16} />
      </span>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-0.5 truncate text-lg font-bold text-ink-900 dark:text-ink-50">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-tight text-ink-400">{hint}</p>}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="font-semibold text-ink-900 dark:text-ink-50 text-sm">{title}</h2>
      {subtitle && <p className="text-xs text-ink-400 mt-0.5">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Kpi({
  label,
  value,
  tone,
  change,
  invert,
  sub,
  subBad,
  hint,
}: {
  label: string
  value: number
  tone?: string
  change?: number | null
  /** para valores em que subir é ruim (ex.: pago) */
  invert?: boolean
  sub?: string
  subBad?: boolean
  hint?: string
}) {
  const up = change != null && change > 0
  const good = change == null ? true : invert ? !up : up
  return (
    <div className="card p-3.5 sm:p-4" title={hint}>
      <p className="text-xs text-ink-400 truncate">{label}</p>
      <p className={`mt-1 text-lg sm:text-xl font-bold truncate ${tone ?? 'text-ink-900 dark:text-ink-50'}`}>{formatCurrency(value)}</p>
      {change != null && Math.abs(change) >= 0.5 && (
        <p className={`mt-0.5 flex items-center gap-0.5 text-xs font-medium ${good ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {Math.abs(Math.round(change))}% vs período anterior
        </p>
      )}
      {sub && <p className={`mt-0.5 text-xs ${subBad ? 'text-red-600 dark:text-red-400' : 'text-ink-400'}`}>{sub}</p>}
    </div>
  )
}

function Bars({
  rows,
  onRow,
  empty = 'Nada por aqui.',
}: {
  rows: { key: string; label: string; amount: number; color: string }[]
  onRow?: (key: string) => void
  empty?: string
}) {
  const max = Math.max(...rows.map((r) => r.amount), 0)
  if (rows.length === 0 || max <= 0) return <p className="text-sm text-ink-400">{empty}</p>
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.key} onClick={onRow ? () => onRow(r.key) : undefined} className={onRow ? 'cursor-pointer' : ''}>
          <div className="flex items-center justify-between gap-3 text-sm mb-1">
            <span className="truncate text-ink-600 dark:text-ink-300">{r.label}</span>
            <span className="font-medium text-ink-900 dark:text-ink-50 shrink-0">{formatCurrency(r.amount)}</span>
          </div>
          <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(r.amount / max) * 100}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}
