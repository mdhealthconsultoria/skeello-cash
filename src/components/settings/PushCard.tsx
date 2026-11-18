import { useState } from 'react'
import toast from 'react-hot-toast'
import { BellRing, ChevronDown } from 'lucide-react'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { Toggle } from '../ui/Toggle'

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/** Liga as notificações do aparelho, testa se estão chegando e explica o passo a passo. */
export function PushCard() {
  const { permission, subscribed, loading, enable, disable } = usePushNotifications()
  const [testing, setTesting] = useState(false)
  const ios = isIos()
  const needsInstall = ios && !isStandalone()

  async function handleToggle(on: boolean) {
    if (!on) return disable()
    const { error } = await enable()
    if (error) toast.error(error)
    else toast.success('Notificações ligadas neste aparelho!')
  }

  async function sendTest() {
    setTesting(true)
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('Skeello Cash', {
        body: 'Teste ok! Os avisos vão aparecer assim neste aparelho.',
        icon: 'favicon.svg',
        data: { url: '/' },
      })
    } catch {
      toast.error('Não consegui mostrar o teste. Confira as permissões do aparelho.')
    }
    setTesting(false)
  }

  let status = 'Avisa mesmo com o app fechado.'
  if (permission === 'unsupported') {
    status = needsInstall
      ? 'No iPhone, instale o app na tela inicial primeiro (veja o passo a passo abaixo).'
      : 'Este navegador não suporta notificações.'
  } else if (permission === 'denied') {
    status = 'Estão bloqueadas neste aparelho. Libere nas configurações (veja abaixo).'
  } else if (subscribed) {
    status = 'Ligadas neste aparelho.'
  }

  const canToggle = permission !== 'unsupported' && permission !== 'denied'

  return (
    <div className="rounded-xl bg-ink-50 dark:bg-ink-800 p-3 mb-4">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200 flex items-center justify-center shrink-0">
          <BellRing size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-900 dark:text-ink-50">Notificações no celular</p>
          <p className="text-xs text-ink-400">{status}</p>
        </div>
        {canToggle && <Toggle checked={subscribed} onChange={handleToggle} disabled={loading} ariaLabel="Notificações no celular" />}
      </div>

      {subscribed && (
        <button onClick={sendTest} disabled={testing} className="btn-secondary w-full mt-3 py-2 text-xs">
          {testing ? 'Enviando...' : 'Enviar uma notificação de teste'}
        </button>
      )}

      <details className="group mt-3">
        <summary className="flex items-center justify-between cursor-pointer list-none text-xs font-medium text-ink-600 dark:text-ink-300">
          Como ativar, passo a passo
          <ChevronDown size={14} className="transition group-open:rotate-180" />
        </summary>
        <div className="mt-2 space-y-3 text-xs text-ink-500 dark:text-ink-400 leading-relaxed">
          <div>
            <p className="font-medium text-ink-700 dark:text-ink-200 mb-1">iPhone (iOS 16.4 ou mais novo)</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Abra o site no Safari.</li>
              <li>Toque em compartilhar e em "Adicionar à Tela de Início".</li>
              <li>Abra o Skeello Cash pelo ícone novo da tela inicial (não pelo Safari).</li>
              <li>Vá em Configurações, ligue o interruptor "Notificações no celular" e toque em Permitir.</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-ink-700 dark:text-ink-200 mb-1">Android e computador</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Abra o site no Chrome.</li>
              <li>Ligue o interruptor "Notificações no celular" e toque em Permitir.</li>
              <li>Toque em "Enviar uma notificação de teste" para conferir.</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-ink-700 dark:text-ink-200 mb-1">Apareceu "bloqueadas"?</p>
            <p>
              Você tocou em "Não permitir" antes. No Android/Chrome, toque no cadeado ao lado do endereço &gt;
              Permissões &gt; Notificações &gt; Permitir. No iPhone, abra Ajustes &gt; Notificações &gt; Skeello Cash e ligue.
            </p>
          </div>
          <p>
            Os avisos de "você tem X para receber/pagar" aparecem dentro do app, no sino. Os avisos de convite e de novo
            empréstimo chegam também no celular, com o app fechado.
          </p>
        </div>
      </details>
    </div>
  )
}
