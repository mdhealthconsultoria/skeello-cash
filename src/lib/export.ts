import jsPDF from 'jspdf'
import { formatCurrency, formatDate } from './format'
import type { DebtWithRelations } from '../types/database'

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportDebtsToCsv(debts: DebtWithRelations[]) {
  const header = ['Pessoa', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Pago', 'Restante', 'Status', 'Emissão', 'Vencimento']
  const rows = debts.map((d) => [
    d.person.name,
    d.type === 'receivable' ? 'A receber' : 'A pagar',
    d.description ?? '',
    d.category?.name ?? '',
    d.amount.toFixed(2),
    d.totals.paid_amount.toFixed(2),
    d.totals.remaining_amount.toFixed(2),
    d.status,
    d.issue_date,
    d.due_date ?? '',
  ])
  const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  downloadBlob('﻿' + csv, `skeello-cash-historico-${Date.now()}.csv`, 'text/csv;charset=utf-8')
}

export function exportDebtsToPdf(debts: DebtWithRelations[]) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text('Skeello Cash — Histórico financeiro', 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Gerado em ${formatDate(new Date())}`, 14, 25)

  let y = 35
  doc.setFontSize(9)
  doc.setTextColor(0)
  for (const d of debts) {
    if (y > 280) {
      doc.addPage()
      y = 20
    }
    const line = `${d.person.name} — ${d.type === 'receivable' ? 'A receber' : 'A pagar'} — ${formatCurrency(
      d.totals.remaining_amount
    )} restante de ${formatCurrency(d.amount)} — ${d.status} — venc. ${d.due_date ? formatDate(d.due_date) : '-'}`
    doc.text(line, 14, y, { maxWidth: 182 })
    y += 8
  }

  doc.save(`skeello-cash-historico-${Date.now()}.pdf`)
}
