import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from './format'
import { lateInterest } from './loans'
import type { DebtWithRelations } from '../types/database'

export interface LateDefaults {
  lateRate: number
  lateFee: number
}

export function chargeMessage(d: DebtWithRelations, late?: LateDefaults): string {
  const first = d.person.name.trim().split(/\s+/)[0]
  const value = formatCurrency(d.totals.remaining_amount)
  const what = d.description ? ` (${d.description})` : ''
  const when = d.due_date ? `, com vencimento em ${formatDate(d.due_date)}` : ''
  const li = lateInterest(d.totals.remaining_amount, d.due_date, d.late_daily_rate ?? late?.lateRate ?? 0, late?.lateFee ?? 0)
  const extra =
    li.extra > 0 ? ` Com ${li.days} dia${li.days === 1 ? '' : 's'} de atraso, o valor atualizado é ${formatCurrency(li.total)} (juros e multa de ${formatCurrency(li.extra)}).` : ''
  return `Oi, ${first}! Passando para lembrar do valor de ${value}${what}${when}.${extra} Qualquer dúvida é só falar. Obrigado!`
}

/** Só dígitos; sem DDI assume Brasil (55). */
function whatsappNumber(phone: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.length <= 11 ? `55${digits}` : digits
}

/**
 * Cobra sem precisar de app: abre o WhatsApp com a mensagem pronta.
 * Sem telefone salvo, abre o compartilhar do aparelho ou copia o texto.
 */
export async function sendCharge(d: DebtWithRelations, late?: LateDefaults) {
  const text = chargeMessage(d, late)
  const number = whatsappNumber(d.person.phone)
  if (number) {
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    return
  }
  try {
    if (navigator.share) {
      await navigator.share({ text })
      return
    }
  } catch {
    return // a pessoa fechou o compartilhar
  }
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Mensagem de cobrança copiada! Cole no WhatsApp ou onde preferir.')
  } catch {
    toast.error('Não consegui copiar. Salve o telefone da pessoa para abrir o WhatsApp direto.')
  }
}
