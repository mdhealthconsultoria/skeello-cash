import { useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { usePwaInstall } from '../../hooks/usePwaInstall'

export function InstallAppButton() {
  const { canInstall, isIosManual, installed, promptInstall } = usePwaInstall()
  const [showIosHelp, setShowIosHelp] = useState(false)

  if (installed || (!canInstall && !isIosManual)) return null

  return (
    <>
      <button
        onClick={() => (canInstall ? promptInstall() : setShowIosHelp(true))}
        className="btn-secondary w-full py-3"
      >
        <Download size={16} /> Instalar o app no celular
      </button>

      {showIosHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-6">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setShowIosHelp(false)} />
          <div className="relative bg-white dark:bg-ink-900 rounded-2xl p-5 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink-900 dark:text-ink-50">Instalar no iPhone</h3>
              <button onClick={() => setShowIosHelp(false)} className="p-1 text-ink-400">
                <X size={18} />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-ink-600 dark:text-ink-300">
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-xs font-medium shrink-0">
                  1
                </span>
                Toque no ícone de compartilhar <Share size={14} className="inline mx-0.5" /> na barra do Safari
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-xs font-medium shrink-0">
                  2
                </span>
                Toque em "Adicionar à Tela de Início" <SquarePlus size={14} className="inline mx-0.5" />
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-xs font-medium shrink-0">
                  3
                </span>
                Toque em "Adicionar" no canto superior
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
