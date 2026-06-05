import React, { useState, useEffect } from 'react'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { formatCurrency, getWeekId } from '../utils/calculations'

export default function Dashboard() {
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const currentWeek = getWeekId(new Date())

  useEffect(() => {
    const q = query(
      collection(db, 'weeklySnapshots'),
      orderBy('createdAt', 'desc'),
      limit(8)
    )
    getDocs(q)
      .then((snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setSnapshots(data)
      })
      .catch((err) => console.error('Error loading snapshots:', err))
      .finally(() => setLoading(false))
  }, [])

  const currentSnap = snapshots.find((s) => s.weekId === currentWeek)

  return (
    <main className="dashboard" role="main">
      <header className="dashboard__header">
        <h1 className="dashboard__title">
          <span>📈</span>
          Dashboard
        </h1>
        <p className="dashboard__subtitle">Semana actual: {currentWeek}</p>
      </header>

      {/* Current Week Summary */}
      <section className="week-summary" aria-label="Resumen semana actual">
        <h2 className="week-summary__heading">Esta semana</h2>
        {loading ? (
          <div className="skeleton-loader">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        ) : currentSnap ? (
          <div className="stat-grid">
            <StatCard
              icon="🚛"
              label="Viajes"
              value={currentSnap.totalTrips}
              unit="viajes"
              accent="blue"
            />
            <StatCard
              icon="🛣️"
              label="Millas"
              value={currentSnap.totalMiles?.toLocaleString('en-US')}
              unit="mi"
              accent="purple"
            />
            <StatCard
              icon="💵"
              label="Ingresos brutos"
              value={formatCurrency(currentSnap.totalGrossPayment)}
              accent="green"
            />
            <StatCard
              icon="📉"
              label="Gastos"
              value={formatCurrency(currentSnap.totalExpenses)}
              accent="orange"
            />
            <StatCard
              icon="💰"
              label="Ganancia neta"
              value={formatCurrency(currentSnap.totalNetProfit)}
              accent={currentSnap.totalNetProfit >= 0 ? 'green' : 'red'}
              fullWidth
            />
          </div>
        ) : (
          <div className="empty-week">
            <div className="empty-week__icon">📭</div>
            <p className="empty-week__text">
              Aún no hay viajes esta semana.<br />
              ¡Guarda tu primer viaje en la calculadora!
            </p>
          </div>
        )}
      </section>

      {/* Recent Weeks */}
      {snapshots.length > 1 && (
        <section className="recent-weeks" aria-label="Semanas recientes">
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

function StatCard({ icon, label, value, unit, accent = 'blue', fullWidth = false }) {
  return (
    <div className={`stat-card stat-card--${accent} ${fullWidth ? 'stat-card--full' : ''}`}>
      <div className="stat-card__icon">{icon}</div>
      <div className="stat-card__body">
        <div className="stat-card__label">{label}</div>
        <div className="stat-card__value">
          {value}
          {unit && <span className="stat-card__unit"> {unit}</span>}
        </div>
      </div>
    </div>
  )
}

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
