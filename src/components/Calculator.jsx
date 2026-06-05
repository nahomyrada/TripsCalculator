import React, { useState, useMemo } from 'react'
import {
  collection,
  addDoc,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useConfig } from '../hooks/useConfig'
import { calculateTrip, getWeekId, formatCurrency } from '../utils/calculations'

export default function Calculator() {
  const { config, loading: configLoading } = useConfig()

  const [miles, setMiles] = useState('')
  const [grossPayment, setGrossPayment] = useState('')
  const [days, setDays] = useState('')
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

    const weekId = getWeekId(new Date())

    const tripData = {
      miles: parseFloat(miles),
      grossPayment: parseFloat(grossPayment),
      days: parseFloat(days),
      weekId,
      ...result,
      createdAt: serverTimestamp(),
    }

    try {
      // 1. Write trip document
      await addDoc(collection(db, 'trips'), tripData)

      // 2. Update weekly snapshot with a transaction
      const snapshotRef = doc(db, 'weeklySnapshots', weekId)
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(snapshotRef)
        if (snap.exists()) {
          const existing = snap.data()
          transaction.update(snapshotRef, {
            totalTrips: (existing.totalTrips || 0) + 1,
            totalMiles: (existing.totalMiles || 0) + parseFloat(miles),
            totalGrossPayment: (existing.totalGrossPayment || 0) + parseFloat(grossPayment),
            totalExpenses: (existing.totalExpenses || 0) + result.totalExpenses,
            totalNetProfit: (existing.totalNetProfit || 0) + result.tripNetProfit,
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

  return (
    <main className="calculator" role="main">
      <header className="calculator__header">
        <h1 className="calculator__title">
          <span className="calculator__title-icon">🚛</span>
          Trip Calculator
        </h1>
        <p className="calculator__subtitle">Calcula la rentabilidad de tu viaje</p>
      </header>

      {/* Viability Banner */}
      {result && (
        <div
          className={`viability-banner ${result.isViable ? 'viability-banner--viable' : 'viability-banner--not-viable'}`}
          role="status"
          aria-live="polite"
        >
          <div className="viability-banner__status">
            <span className="viability-banner__icon">{result.isViable ? '✅' : '❌'}</span>
            <span className="viability-banner__label">{result.isViable ? 'VIABLE' : 'NO VIABLE'}</span>
          </div>
          <div className="viability-banner__profit">
            {formatCurrency(result.tripNetProfit)}
          </div>
          <div className="viability-banner__detail">
            {formatCurrency(result.payPerMile)} / milla
          </div>
        </div>
      )}

      {/* Input Fields */}
      <section className="inputs-section" aria-label="Datos del viaje">
        <div className="input-group">
          <label htmlFor="input-miles" className="input-group__label">
            🛣️ Millas del viaje
          </label>
          <input
            id="input-miles"
            type="number"
            inputMode="decimal"
            className="input-group__field"
            placeholder="0"
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            min="0"
            step="1"
          />
        </div>

        <div className="input-group">
          <label htmlFor="input-gross" className="input-group__label">
            💵 Pago bruto ($)
          </label>
          <input
            id="input-gross"
            type="number"
            inputMode="decimal"
            className="input-group__field"
            placeholder="0.00"
            value={grossPayment}
            onChange={(e) => setGrossPayment(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>

        <div className="input-group">
          <label htmlFor="input-days" className="input-group__label">
            📅 Duración del viaje (días)
          </label>
          <input
            id="input-days"
            type="number"
            inputMode="decimal"
            className="input-group__field"
            placeholder="0"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            min="0"
            step="0.5"
          />
        </div>
      </section>

      {/* Expense Breakdown */}
      {result && (
        <section className="breakdown" aria-label="Desglose de gastos">
          <h2 className="breakdown__title">📊 Desglose de gastos</h2>

          <div className="breakdown__items">
            <div className="breakdown__item">
              <span className="breakdown__item-label">⛽ Gasolina</span>
              <span className="breakdown__item-value">{formatCurrency(result.totalFuelCost)}</span>
            </div>
            <div className="breakdown__item">
              <span className="breakdown__item-label">🍔 Comida ({days} días)</span>
              <span className="breakdown__item-value">{formatCurrency(result.dailyCostFood)}</span>
            </div>
            <div className="breakdown__item">
              <span className="breakdown__item-label">🚿 Baño/Personal ({days} días)</span>
              <span className="breakdown__item-value">{formatCurrency(result.dailyCostBathroom)}</span>
            </div>
            <div className="breakdown__item">
              <span className="breakdown__item-label">📋 Costo fijo prorrateado</span>
              <span className="breakdown__item-value">{formatCurrency(result.dailyCostFixed)}</span>
            </div>
            <div className="breakdown__item breakdown__item--total">
              <span className="breakdown__item-label">💰 Total gastos</span>
              <span className="breakdown__item-value">{formatCurrency(result.totalExpenses)}</span>
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {!hasInputs && (
        <div className="empty-state">
          <div className="empty-state__icon">🚚</div>
          <p className="empty-state__text">Ingresa los datos del viaje para ver el análisis</p>
        </div>
      )}

      {/* Save Button */}
      {result && (
        <div className="save-section">
          {saveSuccess && (
            <div className="save-toast save-toast--success" role="alert">
              ✅ Viaje guardado exitosamente
            </div>
          )}
          {saveError && (
            <div className="save-toast save-toast--error" role="alert">
              ❌ {saveError}
            </div>
          )}
          <button
            id="btn-save-trip"
            className={`save-btn ${saving ? 'save-btn--loading' : ''}`}
            onClick={handleSave}
            disabled={saving || configLoading}
            aria-busy={saving}
          >
            {saving ? (
              <>
                <span className="save-btn__spinner" aria-hidden="true" />
                Guardando...
              </>
            ) : (
              <>
                <span aria-hidden="true">💾</span>
                Guardar viaje
              </>
            )}
          </button>
        </div>
      )}
    </main>
  )
}
