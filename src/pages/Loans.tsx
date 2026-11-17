import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight } from 'lucide-react'
import { useLoans, useParticipations } from '../hooks/useLoans'
import { LoanFormModal } from '../components/loans/LoanFormModal'
import { BorrowingCard, FundingCard } from '../components/loans/ParticipationCard'
import { EmptyState } from '../components/ui/EmptyState'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'
import { formatCurrency, formatDate } from '../lib/format'
import { dueLabel, dueTone, loanSummary, round2 } from '../lib/loans'
import type { LoanFull } from '../types/database'

type Tab = 'mine' | 'owe' | 'funded'

export default function Loans() {
  const navigate = useNavigate()
  const { loans, loading, saveLoan } = useLoans()
  const { borrowings, fundings } = useParticipations()
  const [tab, setTab] = useState<Tab>('mine')
  const [formOpen, setFormOpen] = useState(false)

  const rows = useMemo(() => loans.map((l) => ({ loan: l, s: loanSummary(l) })), [loans])
  const active = rows.filter((r) => !r.loan.closed)

  const totals = useMemo(
    () => ({
      toReceive: round2(active.reduce((s, r) => s + r.s.remaining, 0)),
      toPass: round2(active.reduce((s, r) => s + r.s.funderRemaining, 0)),
      profit: round2(active.reduce((s, r) => s + r.s.profit, 0)),
    }),
    [active]
  )

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'mine', label: 'Devedores', count: loans.length },
    { key: 'owe', label: 'Eu devo', count: borrowings.length },
    { key: 'funded', label: 'Co-fundador', count: fundings.length },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Empréstimos</h1>
        <button onClick={() => setFormOpen(true)} className="btn-primary">
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-ink-100 dark:bg-ink-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs sm:text-sm font-medium transition ${
              tab === t.key
                ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-50 shadow-sm'
                : 'text-ink-500 dark:text-ink-400'
            }`}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1 text-ink-400">({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === 'mine' && (
        <>
          <p className="text-sm text-ink-500 dark:text-ink-400">Pessoas que pegaram dinheiro com você e vão te pagar com juros.</p>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="A receber" value={totals.toReceive} />
            <Stat label="A repassar" value={totals.toPass} />
            <Stat label="Meu lucro" value={totals.profit} tone="text-brand-600 dark:text-brand-400" />
          </div>

          {!loading && rows.length === 0 ? (
            <EmptyState
              illustration={<AnimatedMascot size={140} />}
              title="Nenhum empréstimo ainda"
              description="Crie o primeiro: quanto emprestou, quantos % cobra e quem colocou dinheiro junto com você."
              action={
                <button onClick={() => setFormOpen(true)} className="btn-primary">
                  <Plus size={16} /> Novo empréstimo
                </button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {rows.map(({ loan, s }) => (
                <LoanRow key={loan.id} loan={loan} s={s} onClick={() => navigate(`/emprestimos/${loan.id}`)} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'owe' && borrowings.length > 0 && (
        <p className="text-sm text-ink-500 dark:text-ink-400">Dinheiro que você pegou emprestado e precisa pagar.</p>
      )}
      {tab === 'funded' && fundings.length > 0 && (
        <p className="text-sm text-ink-500 dark:text-ink-400">Dinheiro que você emprestou junto com alguém. Aqui você vê quanto vai receber e quando.</p>
      )}

      {tab === 'owe' &&
        (borrowings.length === 0 ? (
          <EmptyState
            illustration={<AnimatedMascot size={140} />}
            title="Você não deve nenhum empréstimo"
            description="Quando alguém registrar um empréstimo para você, ele aparece aqui com o valor e o vencimento."
          />
        ) : (
          <div className="space-y-2.5">
            {borrowings.map((b) => (
              <BorrowingCard key={b.id} b={b} />
            ))}
          </div>
        ))}

      {tab === 'funded' &&
        (fundings.length === 0 ? (
          <EmptyState
            illustration={<AnimatedMascot size={140} />}
            title="Nenhum empréstimo como co-fundador"
            description="Quando alguém te incluir como co-fundador, você vê aqui quanto vai receber e quando."
          />
        ) : (
          <div className="space-y-2.5">
            {fundings.map((f) => (
              <FundingCard key={f.id} f={f} />
            ))}
          </div>
        ))}

      <LoanFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={async (input, funders) => {
          const res = await saveLoan(input, funders)
          if (res.id && !res.error) navigate(`/emprestimos/${res.id}`)
          return res
        }}
      />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card p-3">
      <p className="text-[11px] text-ink-400">{label}</p>
      <p className={`text-sm sm:text-base font-bold truncate ${tone ?? 'text-ink-900 dark:text-ink-50'}`}>
        {formatCurrency(value)}
      </p>
    </div>
  )
}

function LoanRow({ loan, s, onClick }: { loan: LoanFull; s: ReturnType<typeof loanSummary>; onClick: () => void }) {
  const pct = s.total > 0 ? Math.min(100, Math.round((s.paid / s.total) * 100)) : 0
  return (
    <button onClick={onClick} className="w-full card p-4 text-left space-y-3 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900 dark:text-ink-50 truncate">{loan.borrower_name}</p>
          <p className="text-xs text-ink-400">
            {formatCurrency(loan.principal)} a {String(loan.borrower_rate).replace('.', ',')}% · vence {formatDate(loan.due_date)}
            {loan.funders.length > 0 ? ` · ${loan.funders.length} co-fundador${loan.funders.length > 1 ? 'es' : ''}` : ''}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${dueTone(s.days, s.settled || loan.closed)}`}>
          {loan.closed && !s.settled ? 'Encerrado' : dueLabel(s.days, s.settled)}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-ink-400">Falta receber</p>
          <p className="text-xl font-bold text-ink-900 dark:text-ink-50">{formatCurrency(s.remaining)}</p>
        </div>
        <ChevronRight size={18} className="text-ink-300" />
      </div>
      <div className="h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </button>
  )
}
