import React, { useState, useEffect, useCallback } from 'react'
import {
  collection, query, orderBy, limit, getDocs,
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

function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Main Dashboard ────────────────────────────────────────────────
export default function Dashboard({ onTripSelect }) {
  const [snapshots, setSnapshots] = useState([])
  const [trips, setTrips] = useState([])
  const [loadingSnaps, setLoadingSnaps] = useState(true)
  const [loadingTrips, setLoadingTrips] = useState(true)

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

  // Called when a trip is deleted from TripDetail — remove it from local state
  const handleTripDeleted = (tripId) => {
    setTrips((prev) => prev.filter((t) => t.id !== tripId))
  }

  const currentSnap = snapshots.find((s) => s.weekId === currentWeek)

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
              <TripCard
                key={trip.id}
                trip={trip}
                onClick={() => onTripSelect && onTripSelect(trip, () => handleTripDeleted(trip.id))}
              />
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
      <div className="trip-card__chevron">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </button>
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
