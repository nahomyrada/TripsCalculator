import React, { useState, useEffect } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { DEFAULT_CONFIG } from '../hooks/useConfig'
import { formatCurrency } from '../utils/calculations'

/**
 * Settings screen — reads current config from Firestore (via parent prop),
 * allows editing, and writes back on save.
 */
export default function Settings({ config, onSaved }) {
  // Fuel
  const [fuelTankCost, setFuelTankCost] = useState('')
  const [tankMileage, setTankMileage] = useState('')

  // Fixed monthly
  const [carPayment, setCarPayment] = useState('')
  const [insurance, setInsurance] = useState('')

  // Food: store the raw amount + period
  const [foodAmount, setFoodAmount] = useState('')
  const [foodPeriod, setFoodPeriod] = useState('weekly') // 'weekly' | 'monthly'

  // Bathroom / personal
  const [dailyBathroomCost, setDailyBathroomCost] = useState('')

  // UI
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Seed form from config whenever it changes
  useEffect(() => {
    if (!config) return
    setFuelTankCost(String(config.fuelTankCost ?? DEFAULT_CONFIG.fuelTankCost))
    setTankMileage(String(config.tankMileage ?? DEFAULT_CONFIG.tankMileage))
    setCarPayment(String(config.carPayment ?? DEFAULT_CONFIG.carPayment))
    setInsurance(String(config.insurance ?? DEFAULT_CONFIG.insurance))
    setDailyBathroomCost(String(config.dailyBathroomCost ?? DEFAULT_CONFIG.dailyBathroomCost))

    // Reverse-engineer the food amount:
    // We store dailyFoodCost; infer weekly equivalent for display
    const daily = config.dailyFoodCost ?? DEFAULT_CONFIG.dailyFoodCost
    setFoodAmount(String(Math.round(daily * 7 * 100) / 100))
    setFoodPeriod('weekly')
  }, [config])

  // Live-calculated previews
  const fuelCostPerMile = parseFloat(tankMileage) > 0
    ? parseFloat(fuelTankCost) / parseFloat(tankMileage)
    : 0

  const totalMonthly =
    (parseFloat(carPayment) || 0) + (parseFloat(insurance) || 0)

  const computedDailyFood = (() => {
    const amt = parseFloat(foodAmount) || 0
    return foodPeriod === 'weekly' ? amt / 7 : amt / 30
  })()

  const handleSave = async () => {
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    const payload = {
      fuelTankCost: parseFloat(fuelTankCost) || 0,
      tankMileage: parseFloat(tankMileage) || 0,
      carPayment: parseFloat(carPayment) || 0,
      insurance: parseFloat(insurance) || 0,
      monthlyFixed: (parseFloat(carPayment) || 0) + (parseFloat(insurance) || 0),
      dailyFoodCost: Math.round(computedDailyFood * 100) / 100,
      dailyBathroomCost: parseFloat(dailyBathroomCost) || 0,
      updatedAt: serverTimestamp(),
    }

    try {
      await setDoc(doc(db, 'config', 'business'), payload, { merge: true })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      if (onSaved) onSaved()
    } catch (err) {
      console.error('Error saving config:', err)
      setSaveError('Error al guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="settings" role="main">
      <header className="settings__header">
        <h1 className="settings__title">
          <span>⚙️</span>
          Configuración
        </h1>
        <p className="settings__subtitle">Personaliza los costos de tu negocio</p>
      </header>

      {/* ── GASOLINA ─────────────────────────────────── */}
      <section className="settings-section">
        <h2 className="settings-section__title">⛽ Gasolina</h2>

        <div className="input-group">
          <label htmlFor="cfg-fuel-cost" className="input-group__label">
            Costo de un tanque lleno ($)
          </label>
          <input
            id="cfg-fuel-cost"
            type="number"
            inputMode="decimal"
            className="input-group__field"
            placeholder="120"
            value={fuelTankCost}
            onChange={(e) => setFuelTankCost(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>

        <div className="input-group">
          <label htmlFor="cfg-tank-mileage" className="input-group__label">
            Millas que rinde un tanque (mi)
          </label>
          <input
            id="cfg-tank-mileage"
            type="number"
            inputMode="decimal"
            className="input-group__field"
            placeholder="384"
            value={tankMileage}
            onChange={(e) => setTankMileage(e.target.value)}
            min="1"
            step="1"
          />
        </div>

        {fuelCostPerMile > 0 && (
          <div className="live-preview">
            <span className="live-preview__label">Costo por milla</span>
            <span className="live-preview__value">{formatCurrency(fuelCostPerMile)}</span>
          </div>
        )}
      </section>

      {/* ── COSTOS FIJOS MENSUALES ───────────────────── */}
      <section className="settings-section">
        <h2 className="settings-section__title">📋 Costos fijos mensuales</h2>

        <div className="input-group">
          <label htmlFor="cfg-car-payment" className="input-group__label">
            Pago de camioneta ($/mes)
          </label>
          <input
            id="cfg-car-payment"
            type="number"
            inputMode="decimal"
            className="input-group__field"
            placeholder="900"
            value={carPayment}
            onChange={(e) => setCarPayment(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>

        <div className="input-group">
          <label htmlFor="cfg-insurance" className="input-group__label">
            Seguro ($/mes)
          </label>
          <input
            id="cfg-insurance"
            type="number"
            inputMode="decimal"
            className="input-group__field"
            placeholder="500"
            value={insurance}
            onChange={(e) => setInsurance(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>

        {totalMonthly > 0 && (
          <div className="live-preview">
            <span className="live-preview__label">Total mensual</span>
            <span className="live-preview__value">{formatCurrency(totalMonthly)}</span>
          </div>
        )}
      </section>

      {/* ── COMIDA ──────────────────────────────────── */}
      <section className="settings-section">
        <h2 className="settings-section__title">🍔 Comida</h2>

        <div className="input-group">
          <label htmlFor="cfg-food-amount" className="input-group__label">
            Monto de comida ($)
          </label>
          <div className="field-with-toggle">
            <input
              id="cfg-food-amount"
              type="number"
              inputMode="decimal"
              className="input-group__field field-with-toggle__input"
              placeholder="300"
              value={foodAmount}
              onChange={(e) => setFoodAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <div className="period-toggle" role="group" aria-label="Frecuencia">
              <button
                className={`period-toggle__btn ${foodPeriod === 'weekly' ? 'period-toggle__btn--active' : ''}`}
                onClick={() => setFoodPeriod('weekly')}
                type="button"
                id="food-period-weekly"
              >
                Por semana
              </button>
              <button
                className={`period-toggle__btn ${foodPeriod === 'monthly' ? 'period-toggle__btn--active' : ''}`}
                onClick={() => setFoodPeriod('monthly')}
                type="button"
                id="food-period-monthly"
              >
                Por mes
              </button>
            </div>
          </div>
        </div>

        {computedDailyFood > 0 && (
          <div className="live-preview">
            <span className="live-preview__label">Costo diario de comida</span>
            <span className="live-preview__value">{formatCurrency(computedDailyFood)}/día</span>
          </div>
        )}
      </section>

      {/* ── BAÑO / GASTOS PERSONALES ─────────────────── */}
      <section className="settings-section">
        <h2 className="settings-section__title">🚿 Baño / Gastos personales</h2>

        <div className="input-group">
          <label htmlFor="cfg-bathroom" className="input-group__label">
            Monto diario ($)
          </label>
          <input
            id="cfg-bathroom"
            type="number"
            inputMode="decimal"
            className="input-group__field"
            placeholder="15"
            value={dailyBathroomCost}
            onChange={(e) => setDailyBathroomCost(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
      </section>

      {/* ── SAVE ────────────────────────────────────── */}
      <div className="save-section">
        {saveSuccess && (
          <div className="save-toast save-toast--success" role="alert">
            ✅ Configuración guardada
          </div>
        )}
        {saveError && (
          <div className="save-toast save-toast--error" role="alert">
            ❌ {saveError}
          </div>
        )}
        <button
          id="btn-save-config"
          className={`save-btn ${saving ? 'save-btn--loading' : ''}`}
          onClick={handleSave}
          disabled={saving}
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
              Guardar configuración
            </>
          )}
        </button>
      </div>
    </main>
  )
}
