import React, { useState, useMemo } from 'react'
import { collection, addDoc, doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { calculateTrip, getWeekId, formatCurrency } from '../utils/calculations'
import { US_STATES } from '../utils/usStates'

function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dateStringToTimestamp(str) {
  const [y, m, d] = str.split('-').map(Number)
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0))
}

function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export default function Calculator({ config = {}, configLoading = false }) {
  const [miles, setMiles] = useState('')
  const [grossPayment, setGrossPayment] = useState('')
  const [days, setDays] = useState('')
  const [tripDate, setTripDate] = useState(localDateString())
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const hasInputs = miles !== '' && grossPayment !== '' && days !== ''

  const result = useMemo(() => {
    if (!hasInputs) return null
    return calculateTrip({ miles, grossPayment, days, config })
  }, [miles, grossPayment, days, config, hasInputs])

  const handleSave = async () => {
    if (!result || saving) return
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    const weekId = getWeekId(parseDateStr(tripDate))

    const tripData = {
      miles: parseFloat(miles),
      grossPayment: parseFloat(grossPayment),
      days: parseFloat(days),
      weekId,
      ...result,
      origin: origin || '',
      destination: destination || '',
      date: dateStringToTimestamp(tripDate),
      createdAt: serverTimestamp(),
    }

    try {
      await addDoc(collection(db, 'trips'), tripData)
      const snapshotRef = doc(db, 'weeklySnapshots', weekId)
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(snapshotRef)
        if (snap.exists()) {
          const ex = snap.data()
          transaction.update(snapshotRef, {
            totalTrips: (ex.totalTrips || 0) + 1,
            totalMiles: (ex.totalMiles || 0) + parseFloat(miles),
            totalGrossPayment: (ex.totalGrossPayment || 0) + parseFloat(grossPayment),
            totalExpenses: (ex.totalExpenses || 0) + result.totalExpenses,
            totalNetProfit: (ex.totalNetProfit || 0) + result.tripNetProfit,
            updatedAt: serverTimestamp(),
          })
        } else {
          transaction.set(snapshotRef, {
            weekId,
            totalTrips: 1,
            totalMiles: parseFloat(miles),
            totalGrossPayment: parseFloat(grossPayment),
            totalExpenses: result.totalExpenses,
            totalNetProfit: result.tripNetProfit,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        }
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Error saving trip:', err)
      setSaveError('Error al guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const isToday = tripDate === localDateString()

  return (
    <main className="calculator" role="main">
      <header className="calculator__header">
        <h1 className="calculator__title">
          <span className="calculator__title-icon">🚛</span>
          Trip Calculator
        </h1>
        <p className="calculator__subtitle">Calcula la rentabilidad de tu viaje</p>
      </header>

      {result && (
        <div className={`viability-banner ${result.isViable ? 'viability-banner--viable' : 'viability-banner--not-viable'}`} role="status" aria-live="polite">
          <div className="viability-banner__status">
            <span className="viability-banner__icon">{result.isViable ? '✅' : '❌'}</span>
            <span className="viability-banner__label">{result.isViable ? 'VIABLE' : 'NO VIABLE'}</span>
          </div>
          <div className="viability-banner__profit">{formatCurrency(result.tripNetProfit)}</div>
          <div className="viability-banner__detail">{formatCurrency(result.payPerMile)} / milla</div>
        </div>
      )}

      <section className="inputs-section" aria-label="Datos del viaje">
        {/* Date field */}
        <div className="input-group">
          <label htmlFor="input-date" className="input-group__label">🗓️ Fecha del viaje</label>
          <input
            id="input-date"
            type="date"
            className="input-group__field input-group__field--date"
            value={tripDate}
            onChange={(e) => setTripDate(e.target.value)}
          />
          {isToday ? (
            <p className="input-hint">💡 Si el viaje no es de hoy, puedes cambiar la fecha</p>
          ) : (
            <p className="input-hint input-hint--warn">⚠️ Fecha modificada — se guardará como {tripDate}</p>
          )}
        </div>

        <div className="input-group">
          <label htmlFor="input-miles" className="input-group__label">🛣️ Millas del viaje</label>
          <input id="input-miles" type="number" inputMode="decimal" className="input-group__field"
            placeholder="0" value={miles} onChange={(e) => setMiles(e.target.value)} min="0" step="1" />
        </div>

        <div className="input-group">
          <label htmlFor="input-gross" className="input-group__label">💵 Pago bruto ($)</label>
          <input id="input-gross" type="number" inputMode="decimal" className="input-group__field"
            placeholder="0.00" value={grossPayment} onChange={(e) => setGrossPayment(e.target.value)} min="0" step="0.01" />
        </div>

        <div className="input-group">
          <label htmlFor="input-days" className="input-group__label">📅 Duración del viaje (días)</label>
          <input id="input-days" type="number" inputMode="decimal" className="input-group__field"
            placeholder="0" value={days} onChange={(e) => setDays(e.target.value)} min="0" step="0.5" />
        </div>
      </section>

      <section className="inputs-section" aria-label="Ruta (opcional)">
        <div className="section-divider">
          <span className="section-divider__label">📍 Ruta <span className="section-divider__optional">(opcional)</span></span>
        </div>
        <div className="route-grid">
          <div className="input-group">
            <label htmlFor="select-origin" className="input-group__label">🟢 Origen</label>
            <div className="select-wrapper">
              <select id="select-origin" className="input-group__select" value={origin} onChange={(e) => setOrigin(e.target.value)}>
                <option value="">— Estado —</option>
                {US_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <span className="select-wrapper__arrow" aria-hidden="true">▾</span>
            </div>
          </div>
          <div className="input-group">
            <label htmlFor="select-destination" className="input-group__label">🔴 Destino</label>
            <div className="select-wrapper">
              <select id="select-destination" className="input-group__select" value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option value="">— Estado —</option>
                {US_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <span className="select-wrapper__arrow" aria-hidden="true">▾</span>
            </div>
          </div>
        </div>
        {(origin || destination) && (
          <div className="route-badge">
            <span className="route-badge__state">{origin ? US_STATES.find((s) => s.value === origin)?.label : '—'}</span>
            <span className="route-badge__arrow">→</span>
            <span className="route-badge__state">{destination ? US_STATES.find((s) => s.value === destination)?.label : '—'}</span>
          </div>
        )}
      </section>

      {result && (
        <section className="breakdown" aria-label="Desglose de gastos">
          <h2 className="breakdown__title">📊 Desglose de gastos</h2>
          <div className="breakdown__items">
            <div className="breakdown__item"><span className="breakdown__item-label">⛽ Gasolina</span><span className="breakdown__item-value">{formatCurrency(result.totalFuelCost)}</span></div>
            <div className="breakdown__item"><span className="breakdown__item-label">🍔 Comida ({days} días)</span><span className="breakdown__item-value">{formatCurrency(result.dailyCostFood)}</span></div>
            <div className="breakdown__item"><span className="breakdown__item-label">🚿 Baño/Personal ({days} días)</span><span className="breakdown__item-value">{formatCurrency(result.dailyCostBathroom)}</span></div>
            <div className="breakdown__item"><span className="breakdown__item-label">📋 Costo fijo prorrateado</span><span className="breakdown__item-value">{formatCurrency(result.dailyCostFixed)}</span></div>
            <div className="breakdown__item breakdown__item--total"><span className="breakdown__item-label">💰 Total gastos</span><span className="breakdown__item-value">{formatCurrency(result.totalExpenses)}</span></div>
          </div>
        </section>
      )}

      {!hasInputs && (
        <div className="empty-state">
          <div className="empty-state__icon">🚚</div>
          <p className="empty-state__text">Ingresa los datos del viaje para ver el análisis</p>
        </div>
      )}

      {result && (
        <div className="save-section">
          {saveSuccess && <div className="save-toast save-toast--success" role="alert">✅ Viaje guardado exitosamente</div>}
          {saveError && <div className="save-toast save-toast--error" role="alert">❌ {saveError}</div>}
          <button id="btn-save-trip" className={`save-btn ${saving ? 'save-btn--loading' : ''}`}
            onClick={handleSave} disabled={saving || configLoading} aria-busy={saving}>
            {saving ? (<><span className="save-btn__spinner" aria-hidden="true" />Guardando...</>) : (<><span>💾</span>Guardar viaje</>)}
          </button>
        </div>
      )}
    </main>
  )
}
