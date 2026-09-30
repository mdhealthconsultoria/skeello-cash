import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/format'
import type { Debt, Payment } from '../types/database'

const CATEGORY_COLORS = ['#16a352', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

export default function Analytics() {
  const { user } = useAuth()
  const [debts, setDebts] = useState<Debt[]>([])
  const [payments, setPayments] = useState<(Payment & { debt: { type: string } })[]>([])
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const [{ data: debtRows }, { data: paymentRows }, { data: catRows }] = await Promise.all([
        supabase.from('debts').select('*').eq('user_id', user.id).eq('archived', false),
        supabase.from('payments').select('*, debt:debts!inner(type)').eq('user_id', user.id),
        supabase.from('categories').select('id, name').or(`user_id.eq.${user.id},user_id.is.null`),
      ])
      setDebts((debtRows as Debt[]) ?? [])
      setPayments((paymentRows as (Payment & { debt: { type: string } })[]) ?? [])
      setCategoryNames(Object.fromEntries((catRows ?? []).map((c) => [c.id, c.name])))
      setLoading(false)
    })()
  }, [user])

  const receivablePayableData = useMemo(() => {
    const receivable = debts.filter((d) => d.type === 'receivable' && d.status !== 'cancelled').reduce((s, d) => s + d.amount, 0)
    const payable = debts.filter((d) => d.type === 'payable' && d.status !== 'cancelled').reduce((s, d) => s + d.amount, 0)
    return [
      { name: 'A receber', value: receivable, fill: '#16a352' },
      { name: 'A pagar', value: payable, fill: '#ef4444' },
    ]
  }, [debts])

  const monthlyData = useMemo(() => {
    const months: { key: string; label: string; recebido: number; pago: number }[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('pt-BR', { month: 'short' }),
        recebido: 0,
        pago: 0,
      })
    }
    for (const p of payments) {
      const key = p.payment_date.slice(0, 7)
      const bucket = months.find((m) => m.key === key)
      if (!bucket) continue
      if (p.debt.type === 'receivable') bucket.recebido += p.amount
      else bucket.pago += p.amount
    }
    return months
  }, [payments])

  const balanceEvolution = useMemo(() => {
    let running = 0
    return monthlyData.map((m) => {
      running += m.recebido - m.pago
      return { label: m.label, saldo: running }
    })
  }, [monthlyData])

  const categoryData = useMemo(() => {
    const totals = new Map<string, number>()
    for (const d of debts) {
      if (d.status === 'cancelled') continue
      const name = d.category_id ? categoryNames[d.category_id] ?? 'Outros' : 'Sem categoria'
      totals.set(name, (totals.get(name) ?? 0) + d.amount)
    }
    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [debts, categoryNames])

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card h-64 animate-pulse" />
        ))}
      </div>
    )
  }

  const hasData = debts.length > 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Análises</h1>
        <p className="text-ink-400 text-sm">Sua movimentação financeira em gráficos</p>
      </div>

      {!hasData ? (
        <div className="card p-10 text-center text-ink-400 text-sm">
          Adicione movimentações para ver seus gráficos aqui.
        </div>
      ) : (
        <>
          <ChartCard title="A receber vs. a pagar">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={receivablePayableData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-ink-100 dark:stroke-ink-800" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={32}>
                  {receivablePayableData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Recebimentos e pagamentos por mês">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-ink-100 dark:stroke-ink-800" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="recebido" name="Recebido" fill="#16a352" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pago" name="Pago" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Evolução do saldo">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={balanceEvolution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-ink-100 dark:stroke-ink-800" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="saldo" radius={[6, 6, 0, 0]}>
                  {balanceEvolution.map((entry, i) => (
                    <Cell key={i} fill={entry.saldo >= 0 ? '#16a352' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {categoryData.length > 0 && (
            <ChartCard title="Categorias que mais movimentaram dinheiro">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-4">
      <h2 className="font-medium text-ink-900 dark:text-ink-50 mb-2 text-sm">{title}</h2>
      {children}
    </div>
  )
}
