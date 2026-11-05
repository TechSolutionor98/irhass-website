import axios from "axios"
import Country from "../models/countryModel.js"

// Standard fallback rates relative to 1 PKR, the base prices are stored in.
const DEFAULT_BASE_RATES = {
  PKR: 1.0,
}

/**
 * Fetches live conversion rates with PKR as base currency from public exchange API.
 * Updates Country liveExchangeRate fields in database.
 */
export const updateLiveExchangeRates = async () => {
  try {
    let rates = { ...DEFAULT_BASE_RATES }

    try {
      // Try open.er-api.com free open endpoint (Base PKR)
      const response = await axios.get("https://open.er-api.com/v6/latest/PKR", { timeout: 5000 })
      if (response.data && response.data.result === "success" && response.data.rates) {
        rates = { ...rates, ...response.data.rates }
      }
    } catch (apiErr) {
      console.warn("Primary exchange rate API failed, trying fallback endpoint:", apiErr.message)
      try {
        const fallbackRes = await axios.get("https://api.exchangerate-api.com/v4/latest/PKR", { timeout: 5000 })
        if (fallbackRes.data && fallbackRes.data.rates) {
          rates = { ...rates, ...fallbackRes.data.rates }
        }
      } catch (fallbackErr) {
        console.warn("Fallback exchange rate API failed as well, using hardcoded defaults:", fallbackErr.message)
      }
    }

    const countries = await Country.find({})
    const updatePromises = countries.map(async (country) => {
      const code = country.currencyCode.toUpperCase()
      const newRate = rates[code] || DEFAULT_BASE_RATES[code] || 1.0

      country.liveExchangeRate = newRate
      country.lastRateUpdated = new Date()
      return country.save()
    })

    await Promise.all(updatePromises)
    return { success: true, rates }
  } catch (error) {
    console.error("Error updating live exchange rates:", error.message)
    return { success: false, error: error.message }
  }
}
