import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { US_STATES } from './usStates'

const STATE_MAP = Object.fromEntries(US_STATES.map((s) => [s.value, s.label]))

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
}

function fmtDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function stateName(code) {
  return code ? (STATE_MAP[code] || code) : '—'
}

/**
 * Generates and downloads a trip report PDF.
 * @param {object[]} trips  – Firestore trip documents
 * @param {string} fromStr  – "YYYY-MM-DD"
 * @param {string} toStr    – "YYYY-MM-DD"
 */
export function generateTripReportPDF(trips, fromStr, toStr) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pw = doc.internal.pageSize.getWidth()

  // ── Header bar ──────────────────────────────────────────
  doc.setFillColor(26, 26, 46)        // --color-surface
  doc.rect(0, 0, pw, 28, 'F')

  doc.setTextColor(99, 102, 241)      // --color-primary
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('TripCalculator', 14, 13)

  doc.setTextColor(148, 163, 184)     // --color-text-secondary
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Finance tool for freight transport', 14, 20)

  // ── Report title ─────────────────────────────────────────
  doc.setTextColor(226, 232, 240)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Reporte de Viajes', 14, 38)

  doc.setTextColor(148, 163, 184)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Período: ${fromStr} → ${toStr}`, 14, 46)
  doc.text(`Generado: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 14, 52)

  // ── Totals ───────────────────────────────────────────────
  const totalGross = trips.reduce((s, t) => s + (t.grossPayment || 0), 0)
  const totalExp   = trips.reduce((s, t) => s + (t.totalExpenses || 0), 0)
  const totalNet   = trips.reduce((s, t) => s + (t.tripNetProfit || 0), 0)
  const totalMiles = trips.reduce((s, t) => s + (t.miles || 0), 0)

  let y = 62
  const summaryItems = [
    { label: 'Viajes', value: String(trips.length), color: [99, 102, 241] },
    { label: 'Millas totales', value: totalMiles.toLocaleString('en-US') + ' mi', color: [168, 85, 247] },
    { label: 'Ingresos brutos', value: fmt(totalGross), color: [34, 197, 94] },
    { label: 'Gastos totales', value: fmt(totalExp), color: [249, 115, 22] },
    { label: 'Ganancia neta', value: fmt(totalNet), color: totalNet >= 0 ? [34, 197, 94] : [239, 68, 68] },
  ]

  const boxW = (pw - 28 - 8) / 2
  summaryItems.forEach((item, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const bx = 14 + col * (boxW + 8)
    const by = y + row * 22

    // box bg
    doc.setFillColor(26, 26, 46)
    doc.roundedRect(bx, by, boxW, 18, 3, 3, 'F')

    // accent bar
    doc.setFillColor(...item.color)
    doc.roundedRect(bx, by, 3, 18, 1.5, 1.5, 'F')

    // label
    doc.setTextColor(148, 163, 184)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(item.label.toUpperCase(), bx + 7, by + 7)

    // value
    doc.setTextColor(...item.color)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(item.value, bx + 7, by + 14)
  })

  y += Math.ceil(summaryItems.length / 2) * 22 + 8

  // ── Trips table ──────────────────────────────────────────
  const head = [['Fecha', 'Origen', 'Destino', 'Millas', 'Pago', 'Gastos', 'Ganancia']]
  const body = trips.map((t) => [
    fmtDate(t.date || t.createdAt),
    stateName(t.origin),
    stateName(t.destination),
    (t.miles || 0).toLocaleString('en-US'),
    fmt(t.grossPayment),
    fmt(t.totalExpenses),
    fmt(t.tripNetProfit),
  ])

  // Totals row
  body.push([
    'TOTAL',
    '', '',
    totalMiles.toLocaleString('en-US'),
    fmt(totalGross),
    fmt(totalExp),
    fmt(totalNet),
  ])

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 3,
      textColor: [226, 232, 240],
      fillColor: [15, 15, 26],
      lineColor: [30, 30, 50],
      lineWidth: 0.3,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [26, 26, 46],
      textColor: [148, 163, 184],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [22, 33, 62],
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 26, halign: 'right' },
      6: { cellWidth: 26, halign: 'right' },
    },
    didParseCell(data) {
      const lastRow = data.table.body.length - 1
      if (data.section === 'body' && data.row.index === lastRow) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [26, 26, 46]
        data.cell.styles.textColor = [226, 232, 240]
      }
      // Color ganancia column
      if (data.section === 'body' && data.column.index === 6 && data.row.index < lastRow) {
        const val = data.row.raw[6] || ''
        const isNeg = val.startsWith('-') || val.startsWith('($')
        data.cell.styles.textColor = isNeg ? [239, 68, 68] : [34, 197, 94]
        data.cell.styles.fontStyle = 'bold'
      }
      // Total row net profit color
      if (data.section === 'body' && data.row.index === lastRow && data.column.index === 6) {
        data.cell.styles.textColor = totalNet >= 0 ? [34, 197, 94] : [239, 68, 68]
      }
    },
    margin: { left: 14, right: 14 },
  })

  // ── Footer ───────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const ph = doc.internal.pageSize.getHeight()
    doc.setFillColor(26, 26, 46)
    doc.rect(0, ph - 10, pw, 10, 'F')
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('TripCalculator — Freight Finance Tool', 14, ph - 4)
    doc.text(`Pág. ${i} de ${pageCount}`, pw - 14, ph - 4, { align: 'right' })
  }

  const today = new Date().toISOString().split('T')[0]
  doc.save(`reporte-${today}.pdf`)
}
