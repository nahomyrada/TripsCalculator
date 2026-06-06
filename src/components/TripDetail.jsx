import React, { useState } from 'react'
import {
  doc, deleteDoc, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { formatCurrency } from '../utils/calculations'
import { US_STATES } from '../utils/usStates'

const STATE_MAP = Object.fromEntries(US_STATES.map((s) => [s.value, s.label]))

function fmtDateShort(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('es-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function Row({ label, value, bold = false, color }) {
  return (
    <div className="td__row">
      <span className="td__row-label" style={bold ? { fontWeight: 700, color: 'var(--color-text)' } : {}}>
        {label}
      </span>
      <span className="td__row-value" style={{ fontWeight: bold ? 800 : 600, color: color || undefined }}>
        {value}
      </span>
    </div>
  )
}

export default function TripDetail({ trip, onBack, onDeleted }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const viable = trip.isViable

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'trips', trip.id))

      const snapshotRef = doc(db, 'weeklySnapshots', trip.weekId)
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
            totalMiles: Math.max(0, (ex.totalMiles || 0) - (trip.miles || 0)),
            totalGrossPayment: (ex.totalGrossPayment || 0) - (trip.grossPayment || 0),
            totalExpenses: (ex.totalExpenses || 0) - (trip.totalExpenses || 0),
            totalNetProfit: (ex.totalNetProfit || 0) - (trip.tripNetProfit || 0),
            updatedAt: serverTimestamp(),
          })
        }
      })

      if (onDeleted) onDeleted(trip.id)
      onBack()
    } catch (err) {
      console.error('Error deleting trip:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="trip-detail" role="main" aria-label="Detalles del viaje">
      {/* Top bar */}
      <div className="td__topbar">
        <button
          className="td__back-btn"
          onClick={onBack}
          aria-label="Volver al dashboard"
          id="btn-back-to-dashboard"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Volver</span>
        </button>
        <span className="td__topbar-title">Detalle del viaje</span>
        <div style={{ width: 80 }} />
      </div>

      {/* Scrollable body */}
      <div className="td__body">

        {/* Hero: profit + viability */}
        <div className={`td__hero ${viable ? 'td__hero--viable' : 'td__hero--not-viable'}`}>
          <div className="td__viability">
            {viable ? '✅ VIABLE' : '❌ NO VIABLE'}
          </div>
          <div className="td__net-profit">
            {formatCurrency(trip.tripNetProfit)}
          </div>
          <div className="td__hero-label">Ganancia neta</div>
        </div>

        {/* Route & date */}
        <section className="td__section">
          <h2 className="td__section-title">🗺️ Ruta y fecha</h2>
          {(trip.origin || trip.destination) && (
            <div className="td__route">
              <span className="td__route-state">
                🟢 {trip.origin ? STATE_MAP[trip.origin] || trip.origin : '—'}
              </span>
              <span className="td__route-arrow">→</span>
              <span className="td__route-state">
                🔴 {trip.destination ? STATE_MAP[trip.destination] || trip.destination : '—'}
              </span>
            </div>
          )}
          <div className="td__meta-grid">
            <div className="td__meta-chip">
              <span className="td__meta-icon">📅</span>
              <span className="td__meta-text">{fmtDateShort(trip.date || trip.createdAt)}</span>
            </div>
            <div className="td__meta-chip">
              <span className="td__meta-icon">🛣️</span>
              <span className="td__meta-text">{trip.miles?.toLocaleString('en-US')} millas</span>
            </div>
            <div className="td__meta-chip">
              <span className="td__meta-icon">⏱️</span>
              <span className="td__meta-text">{trip.days} días</span>
            </div>
            <div className="td__meta-chip">
              <span className="td__meta-icon">💵</span>
              <span className="td__meta-text">Bruto: {formatCurrency(trip.grossPayment)}</span>
            </div>
          </div>
        </section>

        {/* Expense breakdown */}
        <section className="td__section">
          <h2 className="td__section-title">📊 Desglose de gastos</h2>
          <div className="td__breakdown">
            <Row label="⛽ Gasolina" value={formatCurrency(trip.totalFuelCost)} />
            <Row label={`🍔 Comida (${trip.days} días)`} value={formatCurrency(trip.dailyCostFood)} />
            <Row label={`🚿 Baño/Personal (${trip.days} días)`} value={formatCurrency(trip.dailyCostBathroom)} />
            <Row label="📋 Costo fijo prorrateado" value={formatCurrency(trip.dailyCostFixed)} />
            <Row label="💰 Total gastos" value={formatCurrency(trip.totalExpenses)} bold />
            <Row label="💵 Pago bruto" value={formatCurrency(trip.grossPayment)} />
            <Row
              label="📈 Ganancia neta"
              value={formatCurrency(trip.tripNetProfit)}
              bold
              color={viable ? 'var(--color-viable)' : 'var(--color-not-viable)'}
            />
            <Row label="🛣️ Pago por milla" value={`${formatCurrency(trip.payPerMile)}/mi`} />
          </div>
        </section>

        {/* Delete area */}
        <div className="td__actions">
          {!deleteConfirm ? (
            <button
              className="td__delete-btn"
              onClick={() => setDeleteConfirm(true)}
              id="btn-delete-trip"
            >
              🗑️ Eliminar viaje
            </button>
          ) : (
            <div className="td__confirm">
              <p className="td__confirm-text">¿Estás seguro? Esta acción no se puede deshacer.</p>
              <div className="td__confirm-btns">
                <button
                  className="td__cancel-btn"
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  className="td__confirm-delete-btn"
                  onClick={handleDelete}
                  disabled={deleting}
                  id="btn-confirm-delete"
                >
                  {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
