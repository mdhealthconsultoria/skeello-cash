import { useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { formatDate } from '../../lib/format'
import { formatCode } from '../../lib/loans'
import { lookupLoanCode, redeemLoanCode, type CodeLookup } from '../../hooks/useLoans'

/**
 * Entrar num empréstimo com o código que o dono mandou.
 * 1) digita o código  2) escolhe se é o devedor ou o co-fundador (e qual vaga)  3) pronto.
 */
export function JoinLoanModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean
  onClose: () => void
  onJoined: (role: 'borrower' | 'funder') => void
}) {
  const [code, setCode] = useState('')
  const [info, setInfo] = useState<CodeLookup | null>(null)
  const [role, setRole] = useState<'borrower' | 'funder' | null>(null)
  const [funderId, setFunderId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setCode('')
      setInfo(null)
      setRole(null)
      setFunderId('')
    }
  }, [open])

  async function handleLookup(e: FormEvent) {
    e.preventDefault()
    if (code.replace(/[^a-zA-Z0-9]/g, '').length < 10) return toast.error('O código tem 10 letras e números.')
    setLoading(true)
    const { info: found, error } = await lookupLoanCode(code)
    setLoading(false)
    if (error || !found) return toast.error(error ?? 'Código não encontrado.')
    setInfo(found)
    setRole(found.borrower_open ? null : 'funder')
    setFunderId(found.funders_open.length === 1 ? found.funders_open[0].id : '')
  }

  async function handleJoin() {
    if (!role) return toast.error('Escolha se você é o devedor ou o co-fundador.')
    if (role === 'funder' && !funderId) return toast.error('Escolha qual co-fundador é você.')
    setLoading(true)
    const { error } = await redeemLoanCode(code, role, role === 'funder' ? funderId : undefined)
    setLoading(false)
    if (error) return toast.error(error)
    toast.success('Pronto! Você já vê o empréstimo na sua conta.')
    onJoined(role)
    onClose()
  }

  const nothingOpen = info && !info.borrower_open && info.funders_open.length === 0

  return (
    <Modal open={open} onClose={onClose} title="Entrar com um código">
      {!info ? (
        <form onSubmit={handleLookup} className="space-y-4">
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Digite o código que a pessoa te mandou. Você passa a ver o empréstimo na sua conta.
          </p>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(formatCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)))}
            className="input text-center text-xl tracking-widest font-semibold"
            placeholder="ABCDE-12345"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'Procurando...' : 'Continuar'}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-ink-50 dark:bg-ink-800 p-3.5 text-sm">
            <p className="text-ink-900 dark:text-ink-50 font-medium">Empréstimo de {info.owner_name ?? 'alguém'}</p>
            <p className="text-xs text-ink-400">Vence em {formatDate(info.due_date)}</p>
          </div>

          {nothingOpen ? (
            <p className="text-sm text-ink-500">
              Todas as vagas desse empréstimo já foram preenchidas. Peça ao dono para liberar a sua.
            </p>
          ) : (
            <>
              <p className="label !mb-0">Você é:</p>
              <div className="grid grid-cols-2 gap-2">
                {info.borrower_open && (
                  <RoleButton active={role === 'borrower'} onClick={() => setRole('borrower')} title="O devedor" hint="Eu vou pagar" />
                )}
                {info.funders_open.length > 0 && (
                  <RoleButton active={role === 'funder'} onClick={() => setRole('funder')} title="Co-fundador" hint="Eu vou receber" />
                )}
              </div>

              {role === 'funder' && info.funders_open.length > 1 && (
                <div>
                  <label className="label">Qual é você?</label>
                  <select value={funderId} onChange={(e) => setFunderId(e.target.value)} className="input">
                    <option value="">Escolha seu nome</option>
                    {info.funders_open.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button onClick={handleJoin} disabled={loading || !role} className="btn-primary w-full py-2.5">
                {loading ? 'Entrando...' : 'Entrar no empréstimo'}
              </button>
            </>
          )}
          <button onClick={() => setInfo(null)} className="w-full text-xs text-ink-400 py-1">
            Usar outro código
          </button>
        </div>
      )}
    </Modal>
  )
}

function RoleButton({ active, onClick, title, hint }: { active: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-3 text-left transition ${
        active
          ? 'border-ink-900 dark:border-white bg-ink-50 dark:bg-ink-800'
          : 'border-ink-100 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800'
      }`}
    >
      <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{title}</p>
      <p className="text-xs text-ink-400">{hint}</p>
    </button>
  )
}
