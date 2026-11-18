import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Pencil, Trash2, Plus, BadgeCheck, Mail, CheckCircle2, RotateCcw, Copy, RefreshCw, KeyRound, UserMinus } from 'lucide-react'
import { useLoans } from '../hooks/useLoans'
import { LoanFormModal } from '../components/loans/LoanFormModal'
import { LoanPaymentModal } from '../components/loans/LoanPaymentModal'
import { formatCurrency, formatDate } from '../lib/format'
import { dueLabel, dueTone, formatCode, loanSummary } from '../lib/loans'
import { Toggle } from '../components/ui/Toggle'

export default function LoanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    loans,
    loading,
    saveLoan,
    deleteLoan,
    setClosed,
    addPayment,
    deletePayment,
    addFunderPayment,
    deleteFunderPayment,
    updateFunderAccess,
    regenerateCode,
    releaseAccess,
  } = useLoans()

  const loan = useMemo(() => loans.find((l) => l.id === id) ?? null, [loans, id])
  const s = useMemo(() => (loan ? loanSummary(loan) : null), [loan])

  const [editOpen, setEditOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [payoutFor, setPayoutFor] = useState<string | null>(null)

  if (loading) return null
  if (!loan || !s) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/emprestimos')} className="p-2 -ml-2 text-ink-400">
          <ArrowLeft size={18} />
        </button>
        <p className="text-sm text-ink-500">Empréstimo não encontrado.</p>
      </div>
    )
  }

  const payoutFunder = s.funders.find((f) => f.funder.id === payoutFor) ?? null

  async function handleDelete() {
    if (!loan) return
    if (!window.confirm(`Excluir o empréstimo de ${loan.borrower_name}? Isso apaga também os pagamentos e remove o acesso de todos.`)) return
    const { error } = await deleteLoan(loan.id)
    if (error) return toast.error(error)
    toast.success('Empréstimo excluído.')
    navigate('/emprestimos')
  }

  async function copyCode() {
    if (!loan) return
    const text = `Código do empréstimo no Skeello Cash: ${formatCode(loan.share_code)}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Código copiado!')
    } catch {
      toast.error('Não consegui copiar. Selecione o código e copie.')
    }
  }

  async function handleRegenerate() {
    if (!loan) return
    if (!window.confirm('Gerar um código novo? O código antigo deixa de funcionar (quem já entrou continua com acesso).')) return
    const { error } = await regenerateCode(loan.id)
    if (error) toast.error(error)
    else toast.success('Código novo gerado.')
  }

  async function handleRelease(target: { loanId: string } | { funderId: string }, who: string) {
    if (!window.confirm(`Remover o acesso de ${who}? A vaga volta a ficar livre pro código.`)) return
    const { error } = await releaseAccess(target)
    if (error) toast.error(error)
  }

  async function handleDeletePayment(paymentId: string, funder = false) {
    if (!window.confirm('Remover este pagamento?')) return
    const { error } = funder ? await deleteFunderPayment(paymentId) : await deletePayment(paymentId)
    if (error) toast.error(error)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/emprestimos')} className="p-2 -ml-2 text-ink-400" aria-label="Voltar">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50 truncate">{loan.borrower_name}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditOpen(true)} className="p-2 text-ink-500 hover:text-ink-900 dark:hover:text-white" aria-label="Editar">
            <Pencil size={17} />
          </button>
          <button onClick={handleDelete} className="p-2 text-ink-400 hover:text-red-600" aria-label="Excluir">
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      {/* Resumo */}
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-ink-400">Falta receber de {loan.borrower_name}</p>
            <p className="text-3xl font-bold text-ink-900 dark:text-ink-50">{formatCurrency(s.remaining)}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${dueTone(s.days, s.settled)}`}>
            {loan.closed && !s.settled ? 'Encerrado' : dueLabel(s.days, s.settled)}
          </span>
        </div>
        <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${s.total > 0 ? Math.min(100, (s.paid / s.total) * 100) : 0}%` }}
          />
        </div>
        <div className="space-y-1.5 text-sm">
          <Line label="Valor emprestado" value={formatCurrency(loan.principal)} />
          <Line label={`Juros (${String(loan.borrower_rate).replace('.', ',')}%)`} value={formatCurrency(s.interest)} />
          <Line label="Total que ele paga" value={formatCurrency(s.total)} strong />
          <Line label="Já recebido" value={formatCurrency(s.paid)} />
          <Line label="Vencimento" value={formatDate(loan.due_date)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {!s.settled && (
            <button onClick={() => setPayOpen(true)} className="btn-primary">
              <Plus size={16} /> Registrar recebimento
            </button>
          )}
          <button
            onClick={async () => {
              const { error } = await setClosed(loan.id, !loan.closed)
              if (error) toast.error(error)
            }}
            className="btn-secondary"
          >
            {loan.closed ? (
              <>
                <RotateCcw size={15} /> Reabrir
              </>
            ) : (
              <>
                <CheckCircle2 size={15} /> Encerrar
              </>
            )}
          </button>
        </div>
        {loan.borrower_user_id ? (
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-brand-700 dark:text-brand-400">
              <BadgeCheck size={14} /> {loan.borrower_name} vê só o total que precisa pagar, na conta dele.
            </p>
            <button
              onClick={() => handleRelease({ loanId: loan.id }, loan.borrower_name)}
              className="shrink-0 text-ink-400 hover:text-red-600"
              aria-label="Remover acesso do devedor"
            >
              <UserMinus size={15} />
            </button>
          </div>
        ) : loan.borrower_email ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <Mail size={14} /> Acesso liberado quando {loan.borrower_name} criar conta com {loan.borrower_email}, ou com o código abaixo.
          </p>
        ) : (
          <p className="text-xs text-ink-400">{loan.borrower_name} ainda não entrou. Mande o código abaixo para ele ver o quanto deve.</p>
        )}
        {loan.notes && <p className="text-sm text-ink-600 dark:text-ink-300">{loan.notes}</p>}
      </div>

      {/* Código de acesso */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-ink-500" />
          <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Código do empréstimo</h2>
        </div>
        <p className="text-xs text-ink-400">
          Mande este código para o devedor e para os co-fundadores. Cada um entra com ele em Empréstimos &gt; Tenho um código.
          O devedor vê só o total. O co-fundador vê só o que ele mesmo recebe.
        </p>
        <div className="flex items-center gap-2">
          <p className="flex-1 rounded-xl bg-ink-50 dark:bg-ink-800 py-3 text-center text-xl font-bold tracking-widest text-ink-900 dark:text-ink-50 select-all">
            {formatCode(loan.share_code)}
          </p>
          <button onClick={copyCode} className="btn-secondary h-12 px-4" aria-label="Copiar código">
            <Copy size={16} />
          </button>
          <button onClick={handleRegenerate} className="btn-secondary h-12 px-4" aria-label="Gerar código novo">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Meu resultado */}
      <div className="card p-5 space-y-1.5 text-sm">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50 mb-1">Minha conta</h2>
        <Line label="Entra (devedor paga)" value={formatCurrency(s.total)} />
        <Line label="Repassar aos co-fundadores" value={formatCurrency(s.funderTotal)} />
        {s.ownMoney > 0 && s.funders.length > 0 && <Line label="Saiu do meu bolso" value={formatCurrency(s.ownMoney)} />}
        <div className="border-t border-ink-100 dark:border-ink-800 pt-1.5 mt-1.5">
          <Line
            label="Sobra pra mim"
            value={formatCurrency(s.profit)}
            strong
            tone={s.profit < 0 ? 'text-red-600' : 'text-brand-600 dark:text-brand-400'}
          />
        </div>
      </div>

      {/* Co-fundadores */}
      <div className="space-y-2.5">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Co-fundadores (quem te emprestou o dinheiro)</h2>
        {s.funders.length === 0 && (
          <p className="text-sm text-ink-400">Nenhum. O dinheiro desse empréstimo é seu.</p>
        )}
        {s.funders.map(({ funder: f, total, paid, remaining, interest }) => {
          const payouts = loan.funder_payments.filter((p) => p.funder_id === f.id)
          return (
            <div key={f.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink-900 dark:text-ink-50 truncate">{f.funder_name}</p>
                  <p className="text-xs text-ink-400">
                    Te emprestou {formatCurrency(f.amount)} a {String(f.rate).replace('.', ',')}% (+{formatCurrency(interest)})
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-ink-400">Devo repassar</p>
                  <p className="font-bold text-ink-900 dark:text-ink-50">{formatCurrency(remaining)}</p>
                </div>
              </div>

              <p className="text-xs text-ink-400">
                Total {formatCurrency(total)} · já repassei {formatCurrency(paid)}
              </p>

              {f.funder_user_id ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs text-brand-700 dark:text-brand-400">
                      <BadgeCheck size={14} /> Vê só o que ele mesmo recebe
                    </p>
                    <button
                      onClick={() => handleRelease({ funderId: f.id }, f.funder_name)}
                      className="text-ink-400 hover:text-red-600"
                      aria-label="Remover acesso"
                    >
                      <UserMinus size={15} />
                    </button>
                  </div>
                  <Toggle checked={f.can_see_borrower} onChange={(v) => updateFunderAccess(f.id, { can_see_borrower: v })} label="Pode ver o nome do devedor" />
                </div>
              ) : f.funder_email ? (
                <p className="flex items-center gap-1.5 text-xs text-ink-500">
                  <Mail size={14} /> Acesso liberado quando criar conta com {f.funder_email}.
                </p>
              ) : (
                <p className="text-xs text-ink-400">Ainda não entrou. Mande o código do empréstimo.</p>
              )}

              {payouts.length > 0 && (
                <ul className="space-y-1.5 border-t border-ink-100 dark:border-ink-800 pt-2.5">
                  {payouts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink-500 dark:text-ink-400">
                        {formatDate(p.paid_at)}
                        {p.note ? ` · ${p.note}` : ''}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-ink-900 dark:text-ink-50">{formatCurrency(p.amount)}</span>
                        <button onClick={() => handleDeletePayment(p.id, true)} className="text-ink-300 hover:text-red-600" aria-label="Remover">
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {remaining > 0.009 && (
                <button onClick={() => setPayoutFor(f.id)} className="btn-secondary w-full">
                  <Plus size={15} /> Registrar repasse a {f.funder_name}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Pagamentos do devedor */}
      <div className="space-y-2.5">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">Recebimentos de {loan.borrower_name}</h2>
        {loan.payments.length === 0 ? (
          <p className="text-sm text-ink-400">Nenhum recebimento registrado.</p>
        ) : (
          <div className="card divide-y divide-ink-100 dark:divide-ink-800">
            {loan.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-ink-500 dark:text-ink-400">
                  {formatDate(p.paid_at)}
                  {p.note ? ` · ${p.note}` : ''}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-ink-900 dark:text-ink-50">{formatCurrency(p.amount)}</span>
                  <button onClick={() => handleDeletePayment(p.id)} className="text-ink-300 hover:text-red-600" aria-label="Remover">
                    <Trash2 size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <LoanFormModal open={editOpen} onClose={() => setEditOpen(false)} editLoan={loan} onSave={saveLoan} />

      <LoanPaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Registrar recebimento"
        who={loan.borrower_name}
        remaining={s.remaining}
        onSubmit={async (amount, paidAt, note) => (await addPayment(loan.id, amount, paidAt, note)).error}
      />

      {payoutFunder && (
        <LoanPaymentModal
          open
          onClose={() => setPayoutFor(null)}
          title="Registrar repasse"
          who={payoutFunder.funder.funder_name}
          remaining={payoutFunder.remaining}
          onSubmit={async (amount, paidAt, note) =>
            (await addFunderPayment(payoutFunder.funder.id, loan.id, amount, paidAt, note)).error
          }
        />
      )}
    </div>
  )
}

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500 dark:text-ink-400">{label}</span>
      <span className={`${strong ? 'font-semibold' : 'font-medium'} ${tone ?? 'text-ink-900 dark:text-ink-50'}`}>{value}</span>
    </div>
  )
}
