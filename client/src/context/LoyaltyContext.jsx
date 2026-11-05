"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import axios from "axios"
import config from "../config/config"
import { useAuth } from "./AuthContext"

const LoyaltyContext = createContext(null)

// Mirrors RELEVANCE-style resolution in server/utils/loyalty.js. The two must stay in
// step: the storefront quotes the points here, the server pays them out, and a shopper
// must never be shown a number they do not receive.
//
// Deepest category first, so a rule on "Gaming Keyboards" beats one on "Accessories".
const CATEGORY_CHAIN = [
  { field: "subCategory4", scope: "subcategory" },
  { field: "subCategory3", scope: "subcategory" },
  { field: "subCategory2", scope: "subcategory" },
  { field: "category", scope: "subcategory" },
  { field: "subCategory", scope: "subcategory" },
  { field: "parentCategory", scope: "category" },
]

const refIdOf = (value) => {
  if (!value) return null
  if (typeof value === "string") return value
  if (typeof value === "object" && value._id) return String(value._id)
  return null
}

const toNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const applyRounding = (value, mode) => {
  if (!Number.isFinite(value)) return 0
  if (mode === "ceil") return Math.ceil(value)
  if (mode === "round") return Math.round(value)
  return Math.floor(value)
}

export const LoyaltyProvider = ({ children }) => {
  const { isAuthenticated } = useAuth()

  const [settings, setSettings] = useState({ isEnabled: false })
  const [ruleMap, setRuleMap] = useState(() => new Map())
  const [balance, setBalance] = useState(0)
  const [pending, setPending] = useState(0)
  const [loadingBalance, setLoadingBalance] = useState(false)

  // Programme configuration is public and changes rarely, so it is fetched once per load.
  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/loyalty/settings`)
      setSettings(data?.settings || { isEnabled: false })

      const map = new Map()
      for (const rule of Array.isArray(data?.rules) ? data.rules : []) {
        map.set(`${rule.scope}:${rule.refId}`, rule)
      }
      setRuleMap(map)
    } catch {
      // A loyalty outage must not break the storefront: fall back to "programme off",
      // which simply hides every points affordance.
      setSettings({ isEnabled: false })
      setRuleMap(new Map())
    }
  }, [])

  const refreshBalance = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      setBalance(0)
      setPending(0)
      return
    }

    try {
      setLoadingBalance(true)
      const { data } = await axios.get(`${config.API_URL}/api/loyalty/me`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 1 },
      })
      setBalance(toNumber(data?.balance, 0))
      setPending(toNumber(data?.pending, 0))
    } catch {
      setBalance(0)
      setPending(0)
    } finally {
      setLoadingBalance(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    if (settings.isEnabled && isAuthenticated) {
      refreshBalance()
    } else {
      setBalance(0)
      setPending(0)
    }
  }, [settings.isEnabled, isAuthenticated, refreshBalance])

  // Which rule governs a product: its own override, else the nearest category rule, else
  // the global rate.
  const resolveEarnRule = useCallback(
    (product) => {
      if (!product) return { mode: "multiplier", multiplier: 1, fixedPoints: 0 }

      const productMode = product.loyaltyPointsMode || "inherit"
      if (productMode === "none") return { mode: "none", multiplier: 0, fixedPoints: 0 }
      if (productMode === "fixed") {
        return { mode: "fixed", multiplier: 1, fixedPoints: Math.max(0, toNumber(product.loyaltyPointsFixed, 0)) }
      }
      if (productMode === "multiplier") {
        return { mode: "multiplier", multiplier: Math.max(0, toNumber(product.loyaltyPointsMultiplier, 1)), fixedPoints: 0 }
      }

      for (const { field, scope } of CATEGORY_CHAIN) {
        const refId = refIdOf(product[field])
        if (!refId) continue
        const rule = ruleMap.get(`${scope}:${refId}`)
        if (!rule) continue

        if (rule.mode === "fixed") {
          return { mode: "fixed", multiplier: 1, fixedPoints: Math.max(0, toNumber(rule.fixedPoints, 0)) }
        }
        return { mode: "multiplier", multiplier: Math.max(0, toNumber(rule.multiplier, 1)), fixedPoints: 0 }
      }

      return { mode: "multiplier", multiplier: 1, fixedPoints: 0 }
    },
    [ruleMap],
  )

  /**
   * Points one unit of this product earns. `unitPriceAed` is the price actually charged,
   * in AED (the currency prices are stored in) -- not the converted display price.
   */
  const pointsForProduct = useCallback(
    (product, unitPriceAed) => {
      if (!settings.isEnabled || !product) return 0

      const rule = resolveEarnRule(product)
      if (rule.mode === "none") return 0
      if (rule.mode === "fixed") return Math.max(0, Math.floor(rule.fixedPoints))

      const perAed = toNumber(settings.earnPointsPerAed, 0)
      if (perAed <= 0) return 0

      const price = Math.max(0, toNumber(unitPriceAed, 0))
      return Math.max(0, applyRounding(price * perAed * rule.multiplier, settings.earnRounding || "floor"))
    },
    [settings, resolveEarnRule],
  )

  /** Points a whole cart would earn. Items need { product, price, quantity }. */
  const pointsForCart = useCallback(
    (items) => {
      if (!settings.isEnabled || !Array.isArray(items)) return 0
      return items.reduce((sum, item) => {
        const product = item.product || item
        const quantity = Math.max(0, toNumber(item.quantity, 0))
        const price = toNumber(item.price ?? product?.offerPrice ?? product?.price, 0)
        return sum + pointsForProduct(product, price) * quantity
      }, 0)
    },
    [settings.isEnabled, pointsForProduct],
  )

  const pointsToAed = useCallback(
    (points) => {
      const perAed = toNumber(settings.redeemPointsPerAed, 0)
      if (perAed <= 0) return 0
      return Math.floor((toNumber(points, 0) / perAed) * 100) / 100
    },
    [settings.redeemPointsPerAed],
  )

  /** Ask the server what this cart may redeem. The server is the authority on the cap. */
  const fetchRedemptionQuote = useCallback(async ({ eligibleAmount, requestedPoints = 0 }) => {
    const token = localStorage.getItem("token")
    if (!token) return null

    const { data } = await axios.post(
      `${config.API_URL}/api/loyalty/quote`,
      { eligibleAmount, requestedPoints },
      { headers: { Authorization: `Bearer ${token}` } },
    )
    return data
  }, [])

  const formatPoints = useCallback(
    (points, { withName = true, isArabic = false } = {}) => {
      const value = Math.max(0, Math.floor(toNumber(points, 0)))
      const formatted = new Intl.NumberFormat(isArabic ? "ar-AE" : "en-US").format(value)
      if (!withName) return formatted
      const name =
        isArabic && settings.pointsNameAr
          ? settings.pointsNameAr
          : value === 1 && settings.pointsNameSingular
            ? settings.pointsNameSingular
            : settings.pointsName || "Points"
      return `${formatted} ${name}`
    },
    [settings],
  )

  const value = useMemo(
    () => ({
      settings,
      isEnabled: Boolean(settings.isEnabled),
      pointsName: settings.pointsName || "Points",
      balance,
      pending,
      loadingBalance,
      refreshBalance,
      refreshSettings: fetchSettings,
      pointsForProduct,
      pointsForCart,
      pointsToAed,
      fetchRedemptionQuote,
      formatPoints,
    }),
    [
      settings,
      balance,
      pending,
      loadingBalance,
      refreshBalance,
      fetchSettings,
      pointsForProduct,
      pointsForCart,
      pointsToAed,
      fetchRedemptionQuote,
      formatPoints,
    ],
  )

  return <LoyaltyContext.Provider value={value}>{children}</LoyaltyContext.Provider>
}

export const useLoyalty = () => {
  const context = useContext(LoyaltyContext)
  if (!context) {
    throw new Error("useLoyalty must be used within a LoyaltyProvider")
  }
  return context
}

export default LoyaltyContext
