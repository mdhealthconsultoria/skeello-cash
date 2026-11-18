import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '../../lib/format'

const PRINCIPAL_COLOR = '#3b82f6'
const INTEREST_COLOR = '#16a352'

/** Quanto do total é valor emprestado e quanto é juros (rosca + legenda). */
export function ValueInterestChart({
  principal,
  interest,
  principalLabel = 'Valor',
  received,
}: {
  principal: number
  interest: number
  principalLabel?: string
  /** quanto já entrou, para mostrar o andamento */
  received?: number
}) {
  const total = principal + interest
  const data = [
    { name: principalLabel, value: Math.max(principal, 0), color: PRINCIPAL_COLOR },
    { name: 'Juros', value: Math.max(interest, 0), color: INTEREST_COLOR },
  ]
  const pctInterest = total > 0 ? (interest / total) * 100 : 0

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={44} outerRadius={64} paddingAngle={total > 0 ? 2 : 0} stroke="none">
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-ink-400">Juros</span>
          <span className="text-base font-bold text-ink-900 dark:text-ink-50">{pctInterest.toFixed(1).replace('.', ',')}%</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2 text-sm">
        <Legend color={PRINCIPAL_COLOR} label={principalLabel} value={formatCurrency(principal)} />
        <Legend color={INTEREST_COLOR} label="Juros" value={formatCurrency(interest)} />
        <div className="border-t border-ink-100 dark:border-ink-800 pt-2">
          <Legend label="Total" value={formatCurrency(total)} strong />
        </div>
        {received !== undefined && (
          <p className="text-xs text-ink-400">
            Já entrou {formatCurrency(received)} ({total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0}%)
          </p>
        )}
      </div>
    </div>
  )
}

function Legend({ color, label, value, strong }: { color?: string; label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-ink-500 dark:text-ink-400">
        {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
        {label}
      </span>
      <span className={`${strong ? 'font-semibold' : 'font-medium'} text-ink-900 dark:text-ink-50`}>{value}</span>
    </div>
  )
}
