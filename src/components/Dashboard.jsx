import React, { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, limit, getDocs,
  doc, deleteDoc, runTransaction, serverTimestamp,
  where, Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { formatCurrency, getWeekId } from '../utils/calculations'
import { US_STATES } from '../utils/usStates'
import { generateTripReportPDF } from '../utils/pdfReport'

const STATE_MAP = Object.fromEntries(US_STATES.map((s) => [s.value, s.label]))

function fmtDate(ts) {
  if (!ts) return null
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Main Dashboard ────────────────────────────────────────────────
export default function Dashboard() {
  const [snapshots, setSnapshots] = useState([])
  const [trips, setTrips] = useState([])
  const [loadingSnaps, setLoadingSnaps] = useState(true)
  const [loadingTrips, setLoadingTrips] = useState(true)

  // Detail modal
  const [selectedTrip, setSelectedTrip] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // PDF export panel
  const [exportOpen, setExportOpen] = useState(false)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return localDateString(d)
  })
  const [toDate, setToDate] = useState(localDateString())
  const [generatingPDF, setGeneratingPDF] = useState(false)
  const [pdfError, setPdfError] = useState(null)

  const currentWeek = getWeekId(new Date())

  const loadData = useCallback(() => {
    setLoadingSnaps(true)
    setLoadingTrips(true)

    getDocs(query(collection(db, 'weeklySnapshots'), orderBy('createdAt', 'desc'), limit(8)))
      .then((snap) => setSnapshots(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setLoadingSnaps(false))

    getDocs(query(collection(db, 'trips'), orderBy('createdAt', 'desc'), limit(20)))
      .then((snap) => setTrips(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setLoadingTrips(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const currentSnap = snapshots.find((s) => s.weekId === currentWeek)

  // ── Delete trip ────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedTrip || deleting) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'trips', selectedTrip.id))

      // Update weekly snapshot
      const snapshotRef = doc(db, 'weeklySnapshots', selectedTrip.weekId)
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(snapshotRef)
        if (!snap.exists()) return
        const ex = snap.data()
        const newTrips = (ex.totalTrips || 0) - 1
        if (newTrips <= 0) {
          transaction.delete(snapshotRef)
        } else {
          transaction.update(snapshotRef, {
            totalTrips: newTrips,
            totalMiles: Math.max(0, (ex.totalMiles || 0) - (selectedTrip.miles || 0)),
            totalGrossPayment: (ex.totalGrossPayment || 0) - (selectedTrip.grossPayment || 0),
            totalExpenses: (ex.totalExpenses || 0) - (selectedTrip.totalExpenses || 0),
            totalNetProfit: (ex.totalNetProfit || 0) - (selectedTrip.tripNetProfit || 0),
            updatedAt: serverTimestamp(),
          })
        }
      })

      setTrips((prev) => prev.filter((t) => t.id !== selectedTrip.id))
      setSnapshots((prev) => prev.filter((s) => s.weekId !== selectedTrip.weekId || true)
        .map((s) => {
          if (s.weekId !== selectedTrip.weekId) return s
          const newTrips = (s.totalTrips || 0) - 1
          if (newTrips <= 0) return null
          return {
            ...s,
            totalTrips: newTrips,
            totalMiles: Math.max(0, (s.totalMiles || 0) - (selectedTrip.miles || 0)),
            totalGrossPayment: (s.totalGrossPayment || 0) - (selectedTrip.grossPayment || 0),
            totalExpenses: (s.totalExpenses || 0) - (selectedTrip.totalExpenses || 0),
            totalNetProfit: (s.totalNetProfit || 0) - (selectedTrip.tripNetProfit || 0),
          }
        }).filter(Boolean))
      setSelectedTrip(null)
      setDeleteConfirm(false)
    } catch (err) {
      console.error('Error deleting trip:', err)
    } finally {
      setDeleting(false)
    }
  }

  // ── PDF export ─────────────────────────────────────────
  const handleGeneratePDF = async () => {
    setGeneratingPDF(true)
    setPdfError(null)
    try {
      const [fy, fm, fd] = fromDate.split('-').map(Number)
      const [ty, tm, td] = toDate.split('-').map(Number)
      const startTs = Timestamp.fromDate(new Date(fy, fm - 1, fd, 0, 0, 0))
      const endTs = Timestamp.fromDate(new Date(ty, tm - 1, td, 23, 59, 59))

      const snap = await getDocs(
        query(
          collection(db, 'trips'),
          where('date', '>=', startTs),
          where('date', '<=', endTs),
          orderBy('date', 'asc')
        )
      )
      const filtered = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      if (filtered.length === 0) {
        setPdfError('No hay viajes en ese período.')
        return
      }
      generateTripReportPDF(filtered, fromDate, toDate)
      setExportOpen(false)
    } catch (err) {
      console.error('PDF error:', err)
      setPdfError('Error generando el reporte. Intenta de nuevo.')
    } finally {
      setGeneratingPDF(false)
    }
  }

  return (
    <main className="dashboard" role="main">
      {/* Header */}
      <header className="dashboard__header">
        <div className="dashboard__title-row">
          <h1 className="dashboard__title"><span>📈</span>Dashboard</h1>
          <button
            id="btn-export-pdf"
            className={`export-btn ${exportOpen ? 'export-btn--active' : ''}`}
            onClick={() => { setExportOpen((v) => !v); setPdfError(null) }}
            aria-label="Exportar reporte PDF"
            title="Exportar reporte PDF"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        </div>
        <p className="dashboard__subtitle">Semana actual: {currentWeek}</p>
      </header>

      {/* PDF Export Panel */}
      {exportOpen && (
        <section className="export-panel" aria-label="Exportar reporte">
          <h2 className="export-panel__title">📄 Exportar reporte PDF</h2>
          <div className="export-panel__dates">
            <div className="input-group">
              <label htmlFor="pdf-from" className="input-group__label">Desde</label>
              <input id="pdf-from" type="date" className="input-group__field input-group__field--date"
                value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="input-group">
              <label htmlFor="pdf-to" className="input-group__label">Hasta</label>
              <input id="pdf-to" type="date" className="input-group__field input-group__field--date"
                value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>
          {pdfError && <p className="export-panel__error">❌ {pdfError}</p>}
          <button id="btn-generate-pdf" className={`save-btn ${generatingPDF ? 'save-btn--loading' : ''}`}
            onClick={handleGeneratePDF} disabled={generatingPDF || !fromDate || !toDate} aria-busy={generatingPDF}>
            {generatingPDF ? (<><span className="save-btn__spinner" />Generando...</>) : (<><span>📄</span>Descargar PDF</>)}
          </button>
        </section>
      )}

      {/* Weekly Summary */}
      <section className="week-summary" aria-label="Resumen semana actual">
        <h2 className="week-summary__heading">Esta semana</h2>
        {loadingSnaps ? (
          <div className="skeleton-loader"><div className="skeleton-card" /><div className="skeleton-card" /></div>
        ) : currentSnap ? (
          <div className="stat-grid">
            <StatCard icon="🚛" label="Viajes" value={currentSnap.totalTrips} unit="viajes" accent="blue" />
            <StatCard icon="🛣️" label="Millas" value={currentSnap.totalMiles?.toLocaleString('en-US')} unit="mi" accent="purple" />
            <StatCard icon="💵" label="Ingresos brutos" value={formatCurrency(currentSnap.totalGrossPayment)} accent="green" />
            <StatCard icon="📉" label="Gastos" value={formatCurrency(currentSnap.totalExpenses)} accent="orange" />
            <StatCard icon="💰" label="Ganancia neta" value={formatCurrency(currentSnap.totalNetProfit)}
              accent={currentSnap.totalNetProfit >= 0 ? 'green' : 'red'} fullWidth />
          </div>
        ) : (
          <div className="empty-week">
            <div className="empty-week__icon">📭</div>
            <p className="empty-week__text">Aún no hay viajes esta semana.<br />¡Guarda tu primer viaje!</p>
          </div>
        )}
      </section>

      {/* Recent Trips */}
      <section className="recent-trips" aria-label="Viajes recientes">
        <h2 className="recent-trips__heading">🚚 Viajes recientes</h2>
        {loadingTrips ? (
          <div className="skeleton-loader" style={{ gridTemplateColumns: '1fr' }}>
            <div className="skeleton-card" style={{ height: 90 }} />
            <div className="skeleton-card" style={{ height: 90 }} />
          </div>
        ) : trips.length === 0 ? (
          <div className="empty-week" style={{ paddingTop: 'var(--space-6)' }}>
            <p className="empty-week__text">No hay viajes guardados aún.</p>
          </div>
        ) : (
          <div className="trips-list">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} onClick={() => { setSelectedTrip(trip); setDeleteConfirm(false) }} />
            ))}
          </div>
        )}
      </section>

      {/* Previous Weeks */}
      {snapshots.length > 1 && (
        <section className="recent-weeks" aria-label="Semanas anteriores">
          <h2 className="recent-weeks__heading">Semanas anteriores</h2>
          <div className="weeks-list">
            {snapshots.filter((s) => s.weekId !== currentWeek).map((snap) => (
              <WeekRow key={snap.id} snap={snap} />
            ))}
          </div>
        </section>
      )}

      {/* Trip Detail Modal */}
      {selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          deleteConfirm={deleteConfirm}
          deleting={deleting}
          onClose={() => { setSelectedTrip(null); setDeleteConfirm(false) }}
          onDeleteRequest={() => setDeleteConfirm(true)}
          onDeleteConfirm={handleDelete}
          onDeleteCancel={() => setDeleteConfirm(false)}
        />
      )}
    </main>
  )
}

// ─── Trip Card ─────────────────────────────────────────────────────
function TripCard({ trip, onClick }) {
  const hasRoute = trip.origin || trip.destination
  const dateStr = fmtDate(trip.date || trip.createdAt)
  return (
    <button className="trip-card" onClick={onClick} aria-label="Ver detalles del viaje">
      <div className="trip-card__top">
        <div className="trip-card__route">
          {hasRoute ? (
            <>
              <span className="trip-card__state">🟢 {trip.origin ? STATE_MAP[trip.origin] || trip.origin : '—'}</span>
              <span className="trip-card__arrow">→</span>
              <span className="trip-card__state">🔴 {trip.destination ? STATE_MAP[trip.destination] || trip.destination : '—'}</span>
            </>
          ) : (
            <span className="trip-card__no-route">Sin ruta especificada</span>
          )}
        </div>
        <div className={`trip-card__profit ${trip.isViable ? 'trip-card__profit--viable' : 'trip-card__profit--not-viable'}`}>
          {formatCurrency(trip.tripNetProfit)}
        </div>
      </div>
      <div className="trip-card__details">
        <span className="trip-card__detail">🛣️ {trip.miles?.toLocaleString('en-US')} mi</span>
        <span className="trip-card__detail">💵 {formatCurrency(trip.grossPayment)}</span>
        <span className="trip-card__detail">📅 {trip.days} días</span>
      </div>
      {dateStr && <div className="trip-card__date">{dateStr}</div>}
    </button>
  )
}

// ─── Trip Detail Modal ─────────────────────────────────────────────
function TripDetailModal({ trip, deleteConfirm, deleting, onClose, onDeleteRequest, onDeleteConfirm, onDeleteCancel }) {
  const viable = trip.isViable

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal" role="dialog" aria-modal="true" aria-label="Detalles del viaje">
        {/* Modal header */}
        <div className="modal__header">
          <div>
            <div className={`modal__viability ${viable ? 'modal__viability--viable' : 'modal__viability--not-viable'}`}>
              {viable ? '✅ VIABLE' : '❌ NO VIABLE'}
            </div>
            <div className={`modal__net-profit ${viable ? 'modal__net-profit--viable' : 'modal__net-profit--not-viable'}`}>
              {formatCurrency(trip.tripNetProfit)}
            </div>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {/* Route & Date */}
        <div className="modal__section">
          {(trip.origin || trip.destination) && (
            <div className="modal__route">
              <span>🟢 {trip.origin ? STATE_MAP[trip.origin] || trip.origin : '—'}</span>
              <span className="route-badge__arrow">→</span>
              <span>🔴 {trip.destination ? STATE_MAP[trip.destination] || trip.destination : '—'}</span>
            </div>
          )}
          <div className="modal__meta-row">
            <span>📅 {fmtDateShort(trip.date || trip.createdAt)}</span>
            <span>🛣️ {trip.miles?.toLocaleString('en-US')} millas</span>
            <span>⏱️ {trip.days} días</span>
            <span>💵 Pago bruto: {formatCurrency(trip.grossPayment)}</span>
          </div>
        </div>

        {/* Expense breakdown */}
        <div className="modal__section">
          <h3 className="modal__section-title">📊 Desglose de gastos</h3>
          <div className="modal__breakdown">
            <BreakdownRow label="⛽ Gasolina" value={formatCurrency(trip.totalFuelCost)} />
            <BreakdownRow label={`🍔 Comida (${trip.days} días)`} value={formatCurrency(trip.dailyCostFood)} />
            <BreakdownRow label={`🚿 Baño/Personal (${trip.days} días)`} value={formatCurrency(trip.dailyCostBathroom)} />
            <BreakdownRow label="📋 Costo fijo prorrateado" value={formatCurrency(trip.dailyCostFixed)} />
            <BreakdownRow label="💰 Total gastos" value={formatCurrency(trip.totalExpenses)} bold />
            <BreakdownRow label="💵 Pago bruto" value={formatCurrency(trip.grossPayment)} />
            <BreakdownRow label="📈 Ganancia neta" value={formatCurrency(trip.tripNetProfit)} bold
              color={viable ? 'var(--color-viable)' : 'var(--color-not-viable)'} />
            <BreakdownRow label="🛣️ Pago por milla" value={`${formatCurrency(trip.payPerMile)}/mi`} />
          </div>
        </div>

        {/* Delete */}
        <div className="modal__actions">
          {!deleteConfirm ? (
            <button className="modal__delete-btn" onClick={onDeleteRequest} id="btn-delete-trip">
              🗑️ Eliminar viaje
            </button>
          ) : (
            <div className="modal__confirm">
              <p className="modal__confirm-text">¿Estás seguro? Esta acción no se puede deshacer.</p>
              <div className="modal__confirm-btns">
                <button className="modal__cancel-btn" onClick={onDeleteCancel} disabled={deleting}>Cancelar</button>
                <button className="modal__confirm-delete-btn" onClick={onDeleteConfirm} disabled={deleting} id="btn-confirm-delete">
                  {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function BreakdownRow({ label, value, bold = false, color }) {
  return (
    <div className="modal__breakdown-row">
      <span className="modal__breakdown-label" style={bold ? { fontWeight: 700, color: 'var(--color-text)' } : {}}>{label}</span>
      <span className="modal__breakdown-value" style={{ fontWeight: bold ? 800 : 600, color: color || undefined }}>{value}</span>
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────
function StatCard({ icon, label, value, unit, accent = 'blue', fullWidth = false }) {
  return (
    <div className={`stat-card stat-card--${accent} ${fullWidth ? 'stat-card--full' : ''}`}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__body">
        <div className="stat-card__label">{label}</div>
        <div className="stat-card__value">{value}{unit && <span className="stat-card__unit"> {unit}</span>}</div>
      </div>
    </div>
  )
}

// ─── Week Row ──────────────────────────────────────────────────────
function WeekRow({ snap }) {
  const profitable = snap.totalNetProfit >= 0
  return (
    <div className="week-row">
      <div className="week-row__left">
        <div className="week-row__id">{snap.weekId}</div>
        <div className="week-row__trips">{snap.totalTrips} viajes · {snap.totalMiles?.toLocaleString('en-US')} mi</div>
      </div>
      <div className={`week-row__profit ${profitable ? 'week-row__profit--pos' : 'week-row__profit--neg'}`}>
        {formatCurrency(snap.totalNetProfit)}
      </div>
    </div>
  )
}
