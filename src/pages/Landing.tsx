import { Link } from 'react-router-dom'
import { Wallet, ShieldCheck, TrendingUp } from 'lucide-react'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-ink-950 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <AnimatedMascot size={180} className="mb-6" />
        <h1 className="text-3xl sm:text-4xl font-bold text-ink-900 dark:text-ink-50 mb-2">Skeello Cash</h1>
        <p className="text-ink-500 dark:text-ink-400 mb-10 text-lg">Seu dinheiro. Sob controle.</p>

        <div className="flex flex-col w-full max-w-xs gap-3">
          <Link to="/entrar" className="btn-primary py-3">
            Entrar
          </Link>
          <Link to="/criar-conta" className="btn-secondary py-3">
            Criar conta
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-16 max-w-md">
          <Feature icon={Wallet} label="Controle total" />
          <Feature icon={TrendingUp} label="Visão clara" />
          <Feature icon={ShieldCheck} label="Dados privados" />
        </div>
      </div>
    </div>
  )
}

function Feature({ icon: Icon, label }: { icon: typeof Wallet; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-10 h-10 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-700 dark:text-ink-300">
        <Icon size={18} />
      </div>
      <span className="text-xs text-ink-500 dark:text-ink-400">{label}</span>
    </div>
  )
}
