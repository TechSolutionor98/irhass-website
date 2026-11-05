"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import axios from "axios"
import config from "../config/config"
import { useAuth } from "./AuthContext"

const ReferralContext = createContext(null)

// Where a referral code picked up from a link is parked until the visitor actually
// registers. sessionStorage rather than state because the journey from clicking the link
// to submitting the form goes through a page load (and often a detour to Login and back),
// and localStorage would keep attributing signups to it weeks later on a shared device.
const PENDING_CODE_KEY = "pending-referral-code"

// The programme's public settings are cached so the navbar knows on the very next load
// whether "Refer & Earn" should show -- without it the button was absent on first paint and
// then popped in once the fetch returned, shifting the whole header.
const SETTINGS_CACHE_KEY = "referral-settings-cache"

const readCachedSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* storage unavailable */
  }
  // No cached value yet (first ever visit): assume the programme is on so the header renders
  // complete on first paint and "Refer & Earn" does not flash in. The settings fetch corrects
  // this within a moment and caches the real value, so every later load is exact.
  return { isEnabled: true }
}

const cacheSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings))
  } catch {
    /* storage unavailable */
  }
}

const toNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Read the code a referral link left behind, if any. */
export const getPendingReferralCode = () => {
  try {
    return sessionStorage.getItem(PENDING_CODE_KEY) || ""
  } catch {
    // Private browsing with storage disabled: the referral is simply not attributed.
    return ""
  }
}

export const setPendingReferralCode = (code) => {
  try {
    const safe = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (safe) sessionStorage.setItem(PENDING_CODE_KEY, safe)
  } catch {
    /* storage unavailable */
  }
}

export const clearPendingReferralCode = () => {
  try {
    sessionStorage.removeItem(PENDING_CODE_KEY)
  } catch {
    /* storage unavailable */
  }
}

export const ReferralProvider = ({ children }) => {
  const { isAuthenticated } = useAuth()

  const [settings, setSettings] = useState(readCachedSettings)
  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // The reward the shopper has chosen to spend on the order in progress. Held here rather
  // than in the cart so that clearing the cart does not lose a reward that was never spent.
  const [selectedRewardId, setSelectedRewardId] = useState(null)
  const [referralDiscount, setReferralDiscount] = useState(0)

  // Programme configuration is public and changes rarely, so it is fetched once per load.
  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/referrals/settings`)
      const next = data?.settings || { isEnabled: false }
      setSettings(next)
      cacheSettings(next)
    } catch {
      // A referral outage must not break the storefront. Keep the last known settings from
      // cache rather than forcing "off", so the header does not flicker on a transient error.
      setSettings(readCachedSettings())
    }
  }, [])

  const refreshSummary = useCallback(async () => {
    const token = localStorage.getItem("token")
    if (!token) {
      setSummary(null)
      return null
    }

    try {
      setLoadingSummary(true)
      // The link is built server-side, so the storefront has to say which one it is
      // building for -- otherwise a shopper in Saudi shares a UAE link and their friend
      // lands in the wrong store.
      const { data } = await axios.get(`${config.API_URL}/api/referrals/me`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          country: (localStorage.getItem("selected-country-code") || "AE").toLowerCase(),
          lang: localStorage.getItem("preferred-language") === "ar" ? "ar" : "en",
        },
      })
      setSummary(data)
      return data
    } catch {
      setSummary(null)
      return null
    } finally {
      setLoadingSummary(false)
    }
  }, [])

  /**
   * What this shopper could take off a basket of this size right now. The server is the
   * authority -- the order endpoint recalculates from verified prices -- so this is only
   * what the checkout screen renders.
   */
  const quoteRewards = useCallback(async (eligibleAmountAed) => {
    const token = localStorage.getItem("token")
    if (!token) return { rewards: [], best: null }

    try {
      const { data } = await axios.post(
        `${config.API_URL}/api/referrals/quote`,
        { eligibleAmount: Math.max(0, toNumber(eligibleAmountAed, 0)) },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      return { rewards: data?.rewards || [], best: data?.best || null }
    } catch {
      return { rewards: [], best: null }
    }
  }, [])

  const applyReward = useCallback((rewardId, discountAed) => {
    setSelectedRewardId(rewardId || null)
    setReferralDiscount(Math.max(0, toNumber(discountAed, 0)))
  }, [])

  const clearReward = useCallback(() => {
    setSelectedRewardId(null)
    setReferralDiscount(0)
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    if (settings.isEnabled && isAuthenticated) {
      refreshSummary()
    } else {
      setSummary(null)
      // A signed-out shopper cannot be holding a reward, so drop any selection with them.
      setSelectedRewardId(null)
      setReferralDiscount(0)
    }
  }, [settings.isEnabled, isAuthenticated, refreshSummary])

  const value = useMemo(
    () => ({
      isEnabled: Boolean(settings.isEnabled),
      settings,
      summary,
      loadingSummary,
      refreshSummary,
      quoteRewards,
      selectedRewardId,
      referralDiscount,
      applyReward,
      clearReward,
    }),
    [
      settings,
      summary,
      loadingSummary,
      refreshSummary,
      quoteRewards,
      selectedRewardId,
      referralDiscount,
      applyReward,
      clearReward,
    ],
  )

  return <ReferralContext.Provider value={value}>{children}</ReferralContext.Provider>
}

export const useReferral = () => {
  const context = useContext(ReferralContext)
  if (!context) {
    throw new Error("useReferral must be used within a ReferralProvider")
  }
  return context
}

export default ReferralContext
