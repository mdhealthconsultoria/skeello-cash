import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldAlert, Users, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { useAdmin } from '../hooks/useAdmin'
import { formatCurrency, formatDate } from '../lib/format'

export default function Admin() {
  const navigate = useNavigate()
  const { isAdmin, overview, users, loading, error } = useAdmin()

  if (!loading && !isAdmin) {
    return (
      <div className="flex flex-col items-center text-center py-20 px-6">
        <ShieldAlert size={32} className="text-ink-300 mb-3" />
        <h1 className="font-semibold text-ink-900 dark:text-ink-50 mb-1">Acesso restrito</h1>
        <p className="text-sm text-ink-400 mb-5">Essa área é só para o administrador do Skeello Cash.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary">
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-ink-400">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Painel administrativo</h1>
          <p className="text-xs text-ink-400">Visão geral de todo o Skeello Cash — visível só pra você</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card h-20 animate-pulse" />
            ))}
          </div>
          <div className="card h-64 animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4">
              <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center mb-2 bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300">
                <Users size={16} />
              </span>
              <p className="text-xs text-ink-400">Usuários</p>
              <p className="text-lg font-semibold text-ink-900 dark:text-ink-50">{overview?.total_users ?? 0}</p>
            </div>
            <div className="card p-4">
              <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center mb-2 bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400">
                <ArrowDownCircle size={16} />
              </span>
              <p className="text-xs text-ink-400">Total a receber</p>
              <p className="text-lg font-semibold text-ink-900 dark:text-ink-50 truncate">
                {formatCurrency(overview?.total_receivable ?? 0)}
              </p>
            </div>
            <div className="card p-4">
              <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center mb-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                <ArrowUpCircle size={16} />
              </span>
              <p className="text-xs text-ink-400">Total a pagar</p>
              <p className="text-lg font-semibold text-ink-900 dark:text-ink-50 truncate">
                {formatCurrency(overview?.total_payable ?? 0)}
              </p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-ink-100 dark:border-ink-800">
              <h2 className="font-semibold text-ink-900 dark:text-ink-50 text-sm">Todos os usuários ({users.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-400 border-b border-ink-100 dark:border-ink-800">
                    <th className="px-4 py-2.5 font-medium">Nome</th>
                    <th className="px-4 py-2.5 font-medium">E-mail</th>
                    <th className="px-4 py-2.5 font-medium">Cadastro</th>
                    <th className="px-4 py-2.5 font-medium text-right">A receber</th>
                    <th className="px-4 py-2.5 font-medium text-right">A pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-ink-50 dark:border-ink-800/60 last:border-0">
                      <td className="px-4 py-2.5 text-ink-900 dark:text-ink-50 whitespace-nowrap">
                        {u.name}
                        <span className="block text-xs text-ink-400">@{u.username}</span>
                      </td>
                      <td className="px-4 py-2.5 text-ink-500 dark:text-ink-400 whitespace-nowrap">{u.email}</td>
                      <td className="px-4 py-2.5 text-ink-400 whitespace-nowrap">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-2.5 text-right text-brand-600 dark:text-brand-400 whitespace-nowrap">
                        {formatCurrency(u.total_receivable)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-red-600 dark:text-red-400 whitespace-nowrap">
                        {formatCurrency(u.total_payable)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
