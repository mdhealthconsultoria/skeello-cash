import { useNavigate } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, Scale, AlertTriangle, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useDashboard } from '../hooks/useDashboard'
import { formatCurrency } from '../lib/format'
import { DebtCard } from '../components/debts/DebtCard'
import { DebtInvites } from '../components/debts/DebtInvites'
import { EmptyState } from '../components/ui/EmptyState'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'

export default function Dashboard() {
  const { profile } = useAuth()
  const { summary, loading } = useDashboard()
  const navigate = useNavigate()

  const firstName = (profile?.name || '').split(' ')[0] || 'por aqui'

  const insights = summary
    ? [
        summary.totalReceivable > 0 && `Você tem ${formatCurrency(summary.totalReceivable)} para receber.`,
        summary.overdueTotal > 0 && `${formatCurrency(summary.overdueTotal)} está em atraso.`,
        summary.dueSoon.length > 0 && `${summary.dueSoon.length} movimentação${summary.dueSoon.length > 1 ? 'ões' : ''} vence${summary.dueSoon.length > 1 ? 'm' : ''} nos próximos 7 dias.`,
        summary.receivedThisMonth > 0 && `Você recebeu ${formatCurrency(summary.receivedThisMonth)} este mês.`,
        summary.topReceivable &&
          `Seu maior valor a receber é de ${summary.topReceivable.person.name}: ${formatCurrency(summary.topReceivable.totals.remaining_amount)}.`,
      ].filter(Boolean) as string[]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">Olá, {firstName} 👋</h1>
        <p className="text-ink-400 text-sm mt-0.5">Veja como está sua vida financeira.</p>
      </div>

      <DebtInvites />

      {loading || !summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={ArrowDownCircle} label="A receber" value={summary.totalReceivable} tone="brand" />
            <StatCard icon={ArrowUpCircle} label="A pagar" value={summary.totalPayable} tone="red" />
            <StatCard icon={Scale} label="Saldo líquido" value={summary.netBalance} tone={summary.netBalance >= 0 ? 'brand' : 'red'} />
            <StatCard icon={AlertTriangle} label="Em atraso" value={summary.overdueTotal} tone="amber" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-xs text-ink-400 mb-1">Recebido no mês</p>
              <p className="text-xl font-semibold text-brand-600 dark:text-brand-400">
                <AnimatedNumber value={summary.receivedThisMonth} />
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-ink-400 mb-1">Pago no mês</p>
              <p className="text-xl font-semibold text-red-600 dark:text-red-400">
                <AnimatedNumber value={summary.paidThisMonth} />
              </p>
            </div>
          </div>

          {insights.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={15} className="text-ink-900 dark:text-white" />
                <p className="text-sm font-medium text-ink-900 dark:text-ink-50">Resumo inteligente</p>
              </div>
              <ul className="space-y-1.5">
                {insights.map((text, i) => (
                  <li key={i} className="text-sm text-ink-500 dark:text-ink-400">
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-ink-900 dark:text-ink-50">Próximos vencimentos</h2>
              {summary.dueSoon.length > 0 && (
                <button onClick={() => navigate('/movimentacoes')} className="text-xs text-ink-900 dark:text-white font-medium underline decoration-ink-300 dark:decoration-ink-600 underline-offset-2">
                  Ver tudo
                </button>
              )}
            </div>

            {summary.dueSoon.length === 0 ? (
              <EmptyState
                illustration={<AnimatedMascot size={140} />}
                title="Nada vencendo por perto"
                description="Você não tem movimentações vencendo nos próximos 7 dias."
              />
            ) : (
              <div className="space-y-2.5">
                {summary.dueSoon.slice(0, 5).map((d) => (
                  <DebtCard key={d.id} debt={d} onClick={() => navigate(`/pessoas/${d.person_id}`)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ArrowDownCircle
  label: string
  value: number
  tone: 'brand' | 'red' | 'amber'
}) {
  const tones = {
    brand: 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10',
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
  }
  return (
    <div className="card p-4">
      <span className={`inline-flex w-8 h-8 rounded-lg items-center justify-center mb-2 ${tones[tone]}`}>
        <Icon size={16} />
      </span>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="text-lg font-semibold text-ink-900 dark:text-ink-50 truncate">
        <AnimatedNumber value={value} />
      </p>
    </div>
  )
}
