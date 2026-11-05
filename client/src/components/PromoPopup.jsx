"use client"

import { useState, useEffect } from "react"
import { X, Tag, Zap, Bell } from "lucide-react"
import axios from "axios"
import config from "../config/config"

const POPUP_DISMISSED_KEY_PREFIX = "promo_popup_dismissed_"

// Fixed feature icons (matches the screenshot: Tag, Zap, Bell)
const FEATURE_ICONS = [
  <Tag className="text-green-600" size={22} />,
  <Zap className="text-green-600" size={22} />,
  <Bell className="text-green-600" size={22} />,
]

/**
 * PromoPopup — Fixed two-column promotional popup.
 *
 * Style is fixed to match the screenshot:
 *   Left:  Green banner image (full-bleed)
 *   Right: "Why Download Our App?" + 3 features + discount box + store buttons + continue btn
 *
 * All text content is fetched from /api/popup-settings.
 *
 * Props:
 *  - pageKey  {string}  Page identifier (e.g. "home"). Popup only shows if admin enabled it here.
 *  - delayMs  {number}  Delay before showing. Default: 3000ms.
 */
const PromoPopup = ({ pageKey, delayMs = 3000 }) => {
  const [settings, setSettings] = useState(null)
  const [visible, setVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const storageKey = `${POPUP_DISMISSED_KEY_PREFIX}${pageKey}`

  // Detect viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const checkIsApp = () => {
    const params = new URLSearchParams(window.location.search)
    if (
      params.get("platform") === "app" ||
      params.get("isApp") === "true" ||
      params.get("source") === "app"
    ) {
      localStorage.setItem("isAppUser", "true")
      return true
    }
    if (localStorage.getItem("isAppUser") === "true") {
      return true
    }
    if (window.ReactNativeWebView || window.webkit?.messageHandlers?.firebase) {
      return true
    }
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes("wv") || ua.includes("webview") || ua.includes("irhaas")) {
      return true
    }
    return false
  }

  // Fetch settings
  useEffect(() => {
    let cancelled = false
    const platform = checkIsApp() ? "app" : "web"

    axios
      .get(`${config.API_URL}/api/popup-settings`, { params: { pageKey, platform } })
      .then(({ data }) => {
        if (cancelled) return
        if (
          data?.isEnabled &&
          Array.isArray(data.showOnPages) &&
          data.showOnPages.includes(pageKey)
        ) {
          setSettings(data)
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [pageKey])

  // Show after delay
  useEffect(() => {
    if (!settings) return

    const isDismissed = sessionStorage.getItem(storageKey)
    const showLimit = settings.showLimit || "once"

    if (isDismissed && showLimit !== "always") {
      return
    }

    const timer = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(timer)
  }, [settings, delayMs, storageKey])

  const handleClose = () => {
    setVisible(false)
    sessionStorage.setItem(storageKey, "1")
  }

  if (!visible || !settings) return null

  // Resolve the left panel image URL
  const leftImageSrc = settings.leftImageUrl
    ? settings.leftImageUrl.startsWith("http")
      ? settings.leftImageUrl
      : `${config.API_URL}${settings.leftImageUrl}`
    : "/download-banner.png"

  // Resolve the mobile image URL
  const mobileImageSrc = settings.mobileImageUrl
    ? settings.mobileImageUrl.startsWith("http")
      ? settings.mobileImageUrl
      : `${config.API_URL}${settings.mobileImageUrl}`
    : null

  // Split feature labels on \n for two-line display
  const features = [
    settings.feature1Label || "Exclusive\nApp Discounts",
    settings.feature2Label || "Faster &\nSmooth Checkout",
    settings.feature3Label || "Early Access to\nDeals & Offers",
  ]

  // ── Desktop layout (two-column) ─────────────────────────────────────────────
  const Desktop = (
    <div className="relative w-full max-w-[1000px] max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-300 flex">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
        aria-label="Close popup"
      >
        <X size={20} />
      </button>

      {/* ── Left: Image panel (50% width grid column) ─────────────────── */}
      <div className="relative w-1/2 flex-shrink-0 overflow-hidden">
        <img
          src={leftImageSrc}
          alt="App promotion"
          className="absolute inset-0 w-full h-full bg-cover"
          loading="eager"
        />
      </div>

      {/* ── Right: White content panel ──────────────────────────────── */}
      <div className="flex-1 bg-white px-7 py-7 flex flex-col justify-center min-h-[480px]">
        {/* Section title */}
        <div className="text-center mb-5">
          <h3 className="text-[clamp(14px,1.5vw,26px)] font-bold text-gray-900 flex items-center justify-center gap-2 whitespace-nowrap">
            <span className="text-green-500">-</span>
            {settings.sectionTitle || "Why Download Our App?"}
            <span className="text-green-500">-</span>
          </h3>
        </div>

        {/* 3 feature tiles */}
        <div className="grid grid-cols-3 gap-3 mb-5 text-center">
          {features.map((label, i) => (
            <div key={i}>
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                {FEATURE_ICONS[i]}
              </div>
              {label.split("\n").map((line, li) => (
                <p key={li} className="mt-1 text-[clamp(10px,1.1vw,16px)] leading-snug font-bold text-gray-900">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>

        {/* Discount box */}
        <div className="border-2 border-dashed border-green-400 rounded-2xl py-4 text-center mb-5">
          <p className="text-[clamp(11px,1.3vw,20px)] font-black text-gray-900 uppercase tracking-wide">
            {settings.discountTopText || "DOWNLOAD NOW & GET"}
          </p>
          <p className="text-[clamp(30px,3.5vw,58px)] leading-none font-black text-green-600 uppercase my-1">
            {settings.discountValue || "10% Off"}
          </p>
          <p className="text-[clamp(11px,1.2vw,18px)] font-extrabold text-gray-900 uppercase leading-none">
            {settings.discountBottomText || "On Your First App Order!"}
          </p>
          {settings.discountNote && (
            <p className="text-[clamp(8px,0.75vw,12px)] text-gray-400 mt-1">{settings.discountNote}</p>
          )}
        </div>

        {/* App store buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
          {settings.googlePlayLink && (
            <a href={settings.googlePlayLink} target="_blank" rel="noreferrer">
              <img src="/getitongoogle.png" alt="Google Play" className="h-11 w-auto" />
            </a>
          )}
          {settings.appStoreLink && (
            <a href={settings.appStoreLink} target="_blank" rel="noreferrer">
              <img src="/getitonappstore.png" alt="App Store" className="h-[52px] w-auto" />
            </a>
          )}
        </div>

        {/* Continue to website */}
        <button
          onClick={handleClose}
          className="w-full rounded-xl border-2 border-gray-300 py-2.5 text-[clamp(13px,1.1vw,18px)] text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
        >
          {settings.continueButtonText || "Continue to Website"}
        </button>
      </div>
    </div>
  )

  // ── Mobile layout (card) ────────────────────────────────────────────────────
  const Mobile = (
    <div className="relative w-[92%] max-w-[420px] bg-white rounded-3xl shadow-2xl overflow-hidden">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-3 right-3 z-20 text-gray-500 hover:text-gray-800 p-1 bg-white/80 rounded-full"
        aria-label="Close popup"
      >
        <X size={20} strokeWidth={2.5} />
      </button>

      {/* Top image strip */}
      {mobileImageSrc && (
        <div className="w-full h-40 overflow-hidden">
          <img src={mobileImageSrc} alt="App promotion" className="w-full h-full bg-cover object-top" />
        </div>
      )}

      <div className="px-5 py-4 flex flex-col">
        {/* Section title */}
        <div className="text-center mb-3">
          <h3 className="text-[17px] font-bold text-gray-900 flex items-center justify-center gap-1.5">
            <span className="text-green-500">-</span>
            {settings.sectionTitle || "Why Download Our App?"}
            <span className="text-green-500">-</span>
          </h3>
        </div>

        {/* 3 feature tiles */}
        <div className="grid grid-cols-3 gap-1 mb-4 text-center">
          {features.map((label, i) => (
            <div key={i}>
              <div className="mx-auto w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 scale-75">{FEATURE_ICONS[i]}</span>
              </div>
              {label.split("\n").map((line, li) => (
                <p key={li} className="mt-1 text-[10px] leading-tight font-bold text-gray-900">{line}</p>
              ))}
            </div>
          ))}
        </div>

        {/* Discount box */}
        <div className="border-2 border-dashed border-green-400 rounded-2xl py-3 text-center mb-4">
          <p className="text-[12px] font-black text-gray-900 uppercase tracking-wide">
            {settings.discountTopText || "DOWNLOAD NOW & GET"}
          </p>
          <p className="text-[34px] leading-none font-black text-green-600 uppercase my-0.5">
            {settings.discountValue || "10% Off"}
          </p>
          <p className="text-[13px] font-extrabold text-gray-900 uppercase leading-none">
            {settings.discountBottomText || "On Your First App Order!"}
          </p>
          {settings.discountNote && (
            <p className="text-[9px] text-gray-400 mt-1">{settings.discountNote}</p>
          )}
        </div>

        {/* App store buttons */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {settings.googlePlayLink && (
            <a href={settings.googlePlayLink} target="_blank" rel="noreferrer">
              <img src="/getitongoogle.png" alt="Google Play" className="h-9 w-auto" />
            </a>
          )}
          {settings.appStoreLink && (
            <a href={settings.appStoreLink} target="_blank" rel="noreferrer">
              <img src="/getitonappstore.png" alt="App Store" className="h-[42px] w-auto" />
            </a>
          )}
        </div>

        {/* Continue */}
        <button
          onClick={handleClose}
          className="w-full rounded-xl border-2 border-gray-300 py-2.5 text-[13px] text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
        >
          {settings.continueButtonText || "Continue to Website"}
        </button>
      </div>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-2 md:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      {isMobile ? Mobile : Desktop}
    </div>
  )
}

export default PromoPopup
