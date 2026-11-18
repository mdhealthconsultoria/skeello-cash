import { useState } from 'react'
import { Modal } from './Modal'

/** Pergunta "tem certeza?" antes de uma ação que não dá para desfazer. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Excluir',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<void> | void
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title}>
      <p className="text-sm text-ink-500 dark:text-ink-400 mb-5">{message}</p>
      <div className="flex gap-2">
        <button onClick={onClose} disabled={busy} className="btn-secondary flex-1">
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={busy}
          className="flex-1 rounded-xl bg-red-600 text-white text-sm font-medium py-2.5 hover:bg-red-700 transition disabled:opacity-50"
        >
          {busy ? 'Excluindo...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
