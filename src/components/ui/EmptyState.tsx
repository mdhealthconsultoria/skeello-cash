import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  illustration?: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      {illustration ? (
        <div className="mb-4">{illustration}</div>
      ) : (
        <div className="w-14 h-14 rounded-2xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-ink-400 mb-4">
          {icon}
        </div>
      )}
      <h3 className="font-semibold text-ink-900 dark:text-ink-50 mb-1">{title}</h3>
      <p className="text-sm text-ink-400 max-w-xs mb-5">{description}</p>
      {action}
    </div>
  )
}
