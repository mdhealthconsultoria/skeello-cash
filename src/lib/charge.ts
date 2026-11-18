import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from './format'
import type { DebtWithRelations } from '../types/database'

export function chargeMessage(d: DebtWithRelations): string {
  const first = d.person.name.trim().split(/\s+/)[0]
  const value = formatCurrency(d.totals.remaining_amount)
  const what = d.description ? ` (${d.description})` : ''
  const when = d.due_date ? `, com vencimento em ${formatDate(d.due_date)}` : ''
  return `Oi, ${first}! Passando para lembrar do valor de ${value}${what}${when}. Qualquer dúvida é só falar. Obrigado!`
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
export async function sendCharge(d: DebtWithRelations) {
  const text = chargeMessage(d)
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
