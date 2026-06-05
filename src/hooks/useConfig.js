import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

const DEFAULT_CONFIG = {
  fuelTankCost: 120,
  tankMileage: 384,
  carPayment: 900,
  insurance: 500,
  monthlyFixed: 1400,
  dailyFoodCost: 43,
  dailyBathroomCost: 15,
}

/**
 * Reads config/business from Firestore.
 * If the document doesn't exist, creates it with DEFAULT_CONFIG.
 */
export function useConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const ref = doc(db, 'config', 'business')

    getDoc(ref)
      .then(async (snap) => {
        if (snap.exists()) {
          setConfig({ ...DEFAULT_CONFIG, ...snap.data() })
        } else {
          // Create default config document
          await setDoc(ref, DEFAULT_CONFIG)
          setConfig(DEFAULT_CONFIG)
        }
      })
      .catch((err) => {
        console.error('Error loading config:', err)
        setError(err)
        // Fall back to defaults so the app still works offline
        setConfig(DEFAULT_CONFIG)
      })
      .finally(() => setLoading(false))
  }, [])

  return { config, loading, error }
}
