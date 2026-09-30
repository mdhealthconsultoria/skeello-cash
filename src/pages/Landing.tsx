import { Link } from 'react-router-dom'
import { UserPlus, HandCoins, ReceiptText, ShieldCheck } from 'lucide-react'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'
import { InstallAppButton } from '../components/ui/InstallAppButton'

const STEPS = [
  {
    icon: UserPlus,
    title: 'Cadastre as pessoas',
    description: 'Quem te deve, pra quem você deve — com foto, telefone e observações.',
  },
  {
    icon: HandCoins,
    title: 'Registre o valor',
    description: 'Dinheiro a receber ou a pagar, com vencimento e categoria.',
  },
  {
    icon: ReceiptText,
    title: 'Dê baixa aos poucos',
    description: 'Pagamento parcial ou total — o app calcula o que ainda falta sozinho.',
  },
  {
    icon: ShieldCheck,
    title: 'Tudo privado e seguro',
    description: 'Seus dados são só seus. Ninguém mais vê suas dívidas.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-ink-950 flex flex-col">
      <div className="flex-1 flex flex-col items-center px-6 py-10 text-center max-w-md mx-auto w-full">
        <AnimatedMascot size={140} className="mb-4" />
        <h1 className="text-3xl font-bold text-ink-900 dark:text-ink-50 mb-1">Skeello Cash</h1>
        <p className="text-ink-500 dark:text-ink-400 mb-8 text-lg">Seu dinheiro. Sob controle.</p>

        <div className="w-full text-left mb-8">
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-3 text-center">Como funciona</p>
          <div className="space-y-3">
            {STEPS.map((step, i) => (
              <div key={i} className="card p-3.5 flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-700 dark:text-ink-300 shrink-0">
                  <step.icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{step.title}</p>
                  <p className="text-xs text-ink-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col w-full gap-3">
          <Link to="/entrar" className="btn-primary py-3">
            Entrar
          </Link>
          <Link to="/criar-conta" className="btn-secondary py-3">
            Criar conta
          </Link>
          <InstallAppButton />
        </div>
      </div>
    </div>
  )
}
