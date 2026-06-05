/**
 * Pure calculation functions for TripCalculator
 */

/**
 * Returns the ISO week number string in format "YYYY-WNN"
 * @param {Date} date
 * @returns {string} e.g. "2026-W23"
 */
export function getWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // Set to nearest Thursday: current date + 4 - current day number
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  const year = d.getUTCFullYear()
  return `${year}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * Performs all trip calculations given inputs and config.
 * All monetary results are rounded to 2 decimal places.
 */
export function calculateTrip({ miles, grossPayment, days, config }) {
  const m = parseFloat(miles) || 0
  const g = parseFloat(grossPayment) || 0
  const d = parseFloat(days) || 0

  const {
    fuelTankCost = 120,
    tankMileage = 384,
    dailyFoodCost = 43,
    dailyBathroomCost = 15,
    monthlyFixed = 1400,
  } = config || {}

  const fuelCostPerMile = fuelTankCost / tankMileage
  const totalFuelCost = m * fuelCostPerMile

  const dailyCostFood = dailyFoodCost * d
  const dailyCostBathroom = dailyBathroomCost * d
  const dailyCostFixed = (monthlyFixed / 30) * d
  const dailyCostTotal = dailyCostFood + dailyCostBathroom + dailyCostFixed

  const totalExpenses = totalFuelCost + dailyCostTotal
  const tripNetProfit = g - totalExpenses
  const payPerMile = m > 0 ? g / m : 0
  const isViable = tripNetProfit > 0

  return {
    fuelCostPerMile: round2(fuelCostPerMile),
    totalFuelCost: round2(totalFuelCost),
    dailyCostFood: round2(dailyCostFood),
    dailyCostBathroom: round2(dailyCostBathroom),
    dailyCostFixed: round2(dailyCostFixed),
    dailyCostTotal: round2(dailyCostTotal),
    totalExpenses: round2(totalExpenses),
    tripNetProfit: round2(tripNetProfit),
    payPerMile: round2(payPerMile),
    isViable,
  }
}

function round2(n) {
  return Math.round(n * 100) / 100
}

/** Formats a number as USD currency string */
export function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}
