/** Interruptor liga/desliga. Tamanho fixo, nunca encolhe nem amassa, igual em todas as telas. */
export function Toggle({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  ariaLabel?: string
  disabled?: boolean
}) {
  const track = (
    <span
      aria-hidden
      className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </span>
  )

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 text-left disabled:opacity-50 ${label ? 'w-full justify-between' : ''}`}
    >
      {label && <span className="text-sm text-ink-700 dark:text-ink-300 min-w-0">{label}</span>}
      {track}
    </button>
  )
}
