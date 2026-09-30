import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PluggyConnect } from 'react-pluggy-connect'
import { ArrowLeft, Landmark, RefreshCw, Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBankConnections } from '../hooks/useBankConnections'
import { EmptyState } from '../components/ui/EmptyState'
import { AnimatedMascot } from '../components/illustrations/AnimatedMascot'
import { formatCurrency, formatDate } from '../lib/format'
import { isSupabaseConfigured } from '../lib/supabase'

const STATUS_LABEL: Record<string, string> = {
  UPDATING: 'Sincronizando...',
  UPDATED: 'Atualizado',
  LOGIN_ERROR: 'Erro de login — reconecte',
  OUTDATED: 'Desatualizado',
  ERROR: 'Erro na conexão',
}

export default function BankConnections() {
  const navigate = useNavigate()
  const { connections, accounts, transactions, loading, getConnectToken, syncItem, removeConnection } =
    useBankConnections()

  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [syncingId, setSyncingId] = useState<string | null>(null)

  async function startConnect(itemId?: string) {
    if (!isSupabaseConfigured) {
      toast.error('Supabase não configurado.')
      return
    }
    setConnecting(true)
    const { token, error } = await getConnectToken(itemId)
    setConnecting(false)
    if (error || !token) {
      toast.error(
        error?.includes('PLUGGY_CLIENT_ID')
          ? 'Integração bancária ainda não configurada. Veja o README (Pluggy).'
          : `Não foi possível iniciar a conexão: ${error}`
      )
      return
    }
    setConnectToken(token)
  }

  async function handleSync(itemId: string, connectionId: string) {
    setSyncingId(connectionId)
    const { error } = await syncItem(itemId)
    setSyncingId(null)
    if (error) toast.error(error)
    else toast.success('Conta atualizada!')
  }

  async function handleRemove(id: string) {
    const { error } = await removeConnection(id)
    if (error) toast.error(error)
    else toast.success('Banco desconectado.')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-ink-400">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Contas bancárias</h1>
          <p className="text-xs text-ink-400">Conecte seus bancos via Open Finance (Pluggy)</p>
        </div>
      </div>

      <button onClick={() => startConnect()} disabled={connecting} className="btn-primary w-full py-2.5">
        <Plus size={16} /> {connecting ? 'Abrindo conexão...' : 'Conectar banco'}
      </button>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card h-20 animate-pulse" />
          ))}
        </div>
      ) : connections.length === 0 ? (
        <EmptyState
          illustration={<AnimatedMascot size={140} />}
          title="Nenhum banco conectado"
          description="Conecte uma conta para importar automaticamente suas transações."
        />
      ) : (
        <div className="space-y-2.5">
          {connections.map((conn) => {
            const connAccounts = accounts.filter((a) => a.connection_id === conn.id)
            return (
              <div key={conn.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {conn.institution_image_url ? (
                      <img src={conn.institution_image_url} alt="" className="w-10 h-10 rounded-lg object-contain bg-white" />
                    ) : (
                      <span className="w-10 h-10 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-500">
                        <Landmark size={18} />
                      </span>
                    )}
                    <div>
                      <p className="font-medium text-ink-900 dark:text-ink-50">{conn.institution_name}</p>
                      <p className="text-xs text-ink-400">{STATUS_LABEL[conn.status] ?? conn.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleSync(conn.pluggy_item_id, conn.id)}
                      disabled={syncingId === conn.id}
                      className="p-2 text-ink-400 hover:text-ink-900 dark:hover:text-white transition"
                      title="Sincronizar"
                    >
                      <RefreshCw size={15} className={syncingId === conn.id ? 'animate-spin' : ''} />
                    </button>
                    <button
                      onClick={() => handleRemove(conn.id)}
                      className="p-2 text-ink-400 hover:text-red-600 transition"
                      title="Desconectar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {connAccounts.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-ink-100 dark:border-ink-800 space-y-1.5">
                    {connAccounts.map((acc) => (
                      <div key={acc.id} className="flex items-center justify-between text-sm">
                        <span className="text-ink-500 dark:text-ink-400">{acc.name}</span>
                        <span className="font-medium text-ink-900 dark:text-ink-50">
                          {formatCurrency(acc.balance, acc.currency_code)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {transactions.length > 0 && (
        <div>
          <h2 className="font-semibold text-ink-900 dark:text-ink-50 mb-3">Transações importadas</h2>
          <div className="space-y-2">
            {transactions.slice(0, 30).map((t) => (
              <div key={t.id} className="card p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-50 truncate">{t.description}</p>
                  <p className="text-xs text-ink-400">{formatDate(t.date)}</p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ml-2 ${t.amount >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox
          onSuccess={async ({ item }) => {
            setConnectToken(null)
            toast.loading('Importando contas e transações...', { id: 'pluggy-sync' })
            const { error } = await syncItem(item.id)
            toast.dismiss('pluggy-sync')
            if (error) toast.error(error)
            else toast.success('Banco conectado com sucesso!')
          }}
          onError={(err) => {
            setConnectToken(null)
            toast.error(err.message || 'Erro ao conectar banco.')
          }}
          onClose={() => setConnectToken(null)}
        />
      )}
    </div>
  )
}
