import { useNavigate } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, UserPlus, HandCoins } from 'lucide-react'

const ITEMS = [
  {
    key: 'receivable',
    label: 'Dinheiro a receber',
    desc: 'Alguém te deve',
    icon: ArrowDownCircle,
    color: 'text-brand-600 bg-brand-50 dark:bg-brand-500/10',
    to: '/movimentacoes',
    state: { openAdd: 'receivable' },
  },
  {
    key: 'payable',
    label: 'Conta / dívida a pagar',
    desc: 'Você deve para alguém',
    icon: ArrowUpCircle,
    color: 'text-red-600 bg-red-50 dark:bg-red-500/10',
    to: '/movimentacoes',
    state: { openAdd: 'payable' },
  },
  {
    key: 'person',
    label: 'Pessoa',
    desc: 'Cadastrar novo contato',
    icon: UserPlus,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10',
    to: '/pessoas',
    state: { openAdd: true },
  },
  {
    key: 'payment',
    label: 'Registrar pagamento',
    desc: 'Dar baixa em uma movimentação',
    icon: HandCoins,
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10',
    to: '/movimentacoes',
    state: { focusPayment: true },
  },
]

export function QuickAddMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-ink-900 rounded-t-3xl sm:rounded-3xl shadow-xl p-5 animate-[slideUp_0.2s_ease-out]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
      >
        <div className="w-10 h-1 bg-ink-200 dark:bg-ink-700 rounded-full mx-auto mb-5 sm:hidden" />
        <h2 className="text-lg font-semibold mb-4 text-ink-900 dark:text-ink-50">O que você quer adicionar?</h2>
        <div className="space-y-2">
          {ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                onClose()
                navigate(item.to, { state: item.state })
              }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-ink-50 dark:hover:bg-ink-800 transition text-left"
            >
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.color}`}>
                <item.icon size={20} />
              </span>
              <span>
                <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{item.label}</p>
                <p className="text-xs text-ink-400">{item.desc}</p>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
