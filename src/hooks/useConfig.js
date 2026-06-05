import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export const DEFAULT_CONFIG = {
  fuelTankCost: 120,
  tankMileage: 384,
  carPayment: 900,
  insurance: 500,
  monthlyFixed: 1400,   // carPayment + insurance
  dailyFoodCost: 43,
  dailyBathroomCost: 15,
}

/**
 * Reads config/business from Firestore.
 * If the document doesn't exist, creates it with DEFAULT_CONFIG.
 * Returns { config, loading, error, refresh } — call refresh() to re-fetch
 * after an external write (e.g. from the Settings screen).
 */
export function useConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    setLoading(true)
    const ref = doc(db, 'config', 'business')

    getDoc(ref)
      .then(async (snap) => {
        if (snap.exists()) {
          setConfig({ ...DEFAULT_CONFIG, ...snap.data() })
        } else {
          await setDoc(ref, DEFAULT_CONFIG)
          setConfig(DEFAULT_CONFIG)
        }
      })
      .catch((err) => {
        console.error('Error loading config:', err)
        setError(err)
        setConfig(DEFAULT_CONFIG)
      })
      .finally(() => setLoading(false))
  }, [tick])

  return { config, loading, error, refresh }
}
