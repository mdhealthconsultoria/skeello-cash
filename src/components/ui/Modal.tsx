import { type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-ink-900 rounded-t-3xl sm:rounded-3xl shadow-xl animate-[slideUp_0.2s_ease-out] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-50">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
