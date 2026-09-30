import { initials } from '../../lib/format'

export function Avatar({
  src,
  name,
  size = 'md',
}: {
  src?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
  }

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover shrink-0 border border-ink-100 dark:border-ink-800`}
      />
    )
  }

  return (
    <div
      className={`${sizes[size]} rounded-full bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300 flex items-center justify-center font-semibold shrink-0`}
    >
      {initials(name)}
    </div>
  )
}
