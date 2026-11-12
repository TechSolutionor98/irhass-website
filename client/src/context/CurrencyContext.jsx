"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import axios from "axios"
import config from "../config/config"

const CurrencyContext = createContext(null)

// Used only when /api/countries fails. One entry: prices are stored in PKR, so the
// base country converts 1:1.
const DEFAULT_COUNTRIES = [
  {
    code: "PK",
    name: "Pakistan",
    nameAr: "باكستان",
    currencyCode: "PKR",
    currencySymbol: "Rs",
    currencySymbolAr: "روپیہ",
    effectiveRate: 1.0,
    isDefault: true,
  },
]

const ALL_PRESETS_MAP = new Map([
  ["PK", { nameAr: "باكستان", currencySymbol: "Rs", currencySymbolAr: "روپیہ" }],
])

const COUNTRIES_CACHE_KEY = "irhaas_countries_cache_v1"

export const CurrencyProvider = ({ children }) => {
  const [countries, setCountries] = useState(() => {
    try {
      const cached = sessionStorage.getItem(COUNTRIES_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return DEFAULT_COUNTRIES
  })
  const [selectedCountryCode, setSelectedCountryCode] = useState(() => {
    return localStorage.getItem("selected-country-code") || "AE"
  })
  const [loading, setLoading] = useState(false)

  // Fetch active countries from public API
  const fetchCountries = useCallback(async () => {
    try {
      const res = await axios.get(`${config.API_URL}/api/countries/public`)
      if (Array.isArray(res.data) && res.data.length > 0) {
        // Only include countries active in backend API
        const activeList = res.data.map((apiC) => {
          const codeUpper = apiC.code?.toUpperCase()
          const preset = ALL_PRESETS_MAP.get(codeUpper) || {}
          return {
            ...preset,
            ...apiC,
          }
        })
        setCountries(activeList)
        try {
          sessionStorage.setItem(COUNTRIES_CACHE_KEY, JSON.stringify(activeList))
        } catch {}
      }
    } catch (err) {
      console.warn("Failed to fetch active countries, using defaults:", err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      const hasCached = sessionStorage.getItem(COUNTRIES_CACHE_KEY)
      if (hasCached) {
        // Refresh quietly in background after critical rendering has settled
        const t = setTimeout(() => fetchCountries(), 2500)
        return () => clearTimeout(t)
      }
    } catch {}
    fetchCountries()
  }, [fetchCountries])

  useEffect(() => {
    const handleCountryChanged = (e) => {
      if (e.detail) {
        setSelectedCountryCode(String(e.detail).toUpperCase())
      }
    }
    window.addEventListener("country-changed", handleCountryChanged)
    return () => window.removeEventListener("country-changed", handleCountryChanged)
  }, [])

  // Current active country object
  const currentCountry =
    countries.find((c) => c.code.toUpperCase() === selectedCountryCode.toUpperCase()) ||
    countries.find((c) => c.isDefault) ||
    DEFAULT_COUNTRIES[0]

  const changeCountry = useCallback((countryCode) => {
    if (!countryCode) return
    const upperCode = String(countryCode).toUpperCase()
    setSelectedCountryCode(upperCode)
    localStorage.setItem("selected-country-code", upperCode)
  }, [])

  /**
   * Format price based on current country's currency and exchange rate.
   * @param {number|string} amountInBase Base price, stored in PKR
   * @param {boolean} isArabic Whether to format in Arabic symbol
   */
  const formatPrice = useCallback(
    (amountInBase, isArabic = false) => {
      const num = Number(amountInBase)
      if (isNaN(num) || num === null || num === undefined) return ""

      const rate = currentCountry?.effectiveRate > 0 ? currentCountry.effectiveRate : 1.0
      const converted = num * rate
      const formattedNum = new Intl.NumberFormat(isArabic ? "ar-AE" : "en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(converted)

      const symbol = isArabic
        ? currentCountry?.currencySymbolAr || currentCountry?.currencyCode || "روپیہ"
        : currentCountry?.currencySymbol || currentCountry?.currencyCode || "Rs"

      return isArabic ? `${formattedNum} ${symbol}` : `${symbol} ${formattedNum}`
    },
    [currentCountry],
  )

  const value = {
    countries,
    currentCountry,
    selectedCountryCode,
    changeCountry,
    formatPrice,
    loading,
    refreshCountries: fetchCountries,
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider")
  }
  return context
}

export default CurrencyContext
