"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import axios from "axios"
import { X } from "lucide-react"
import config from "../config/config"
import { useAuth } from "../context/AuthContext"
import { useLoyalty } from "../context/LoyaltyContext"
import { useLanguage } from "../context/LanguageContext"
import GrabCoin from "./GrabCoin"

/**
 * Congratulates a customer once for points that have just become spendable — which
 * happens when an order reaches the award status (Delivered by default).
 *
 * The "once" is owned by the server: each award row carries an `announcedToUser` flag,
 * and dismissing the dialog acknowledges exactly the rows that were shown. So it survives
 * a reload, a different device and a cleared browser, and a second award later still gets
 * its own dialog.
 */
const LoyaltyRewardDialog = () => {
  const { isAuthenticated } = useAuth()
  const { isEnabled, refreshBalance } = useLoyalty()
  const { isArabic, getLocalizedPath } = useLanguage() || {}
  const navigate = useNavigate()
  const location = useLocation()

  const [news, setNews] = useState(null)
  const [closing, setClosing] = useState(false)
  // One check per signed-in session; the dialog is not worth a request on every route change.
  const checkedRef = useRef(false)

  // The admin panel is not the place to celebrate a shopper's points.
  const onAdminScreen = location.pathname.startsWith("/admin")

  useEffect(() => {
    if (!isAuthenticated || !isEnabled) {
      checkedRef.current = false
      setNews(null)
      return
    }
    if (checkedRef.current || onAdminScreen) return

    const token = localStorage.getItem("token")
    if (!token) return

    checkedRef.current = true
    let cancelled = false

    axios
      .get(`${config.API_URL}/api/loyalty/announcements`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        if (cancelled) return
        if (data?.hasNews && data.points > 0) setNews(data)
      })
      // A missed congratulation is not worth surfacing an error for; the points are
      // already banked and the flag stays unset, so the next visit tries again.
      .catch(() => {
        checkedRef.current = false
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isEnabled, onAdminScreen])

  const dismiss = useCallback(
    async (destination) => {
      const shown = news
      setClosing(true)
      setNews(null)

      const token = localStorage.getItem("token")
      if (token && shown) {
        try {
          await axios.post(
            `${config.API_URL}/api/loyalty/announcements/ack`,
            { transactionIds: shown.transactionIds },
            { headers: { Authorization: `Bearer ${token}` } },
          )
        } catch {
          // Acknowledgement failed, so the dialog will reappear next visit. Better a
          // repeat than losing the news entirely.
        }
        refreshBalance()
      }

      setClosing(false)
      if (destination) navigate(destination)
    },
    [news, navigate, refreshBalance],
  )

  if (!news || closing) return null

  const pointsName = news.pointsName || "Grabian Coins"
  const formatted = new Intl.NumberFormat(isArabic ? "ar-AE" : "en-US").format(news.points)
  const pointsPath = getLocalizedPath ? getLocalizedPath("/profile") : "/profile"

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loyalty-reward-title"
      onClick={() => dismiss()}
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => dismiss()}
          className="absolute end-3 top-3 z-10 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Wide and shallow: the coin sits alongside the message rather than above it, so
            the dialog stays a single band across the screen instead of a tall column. */}
        <div className="flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:gap-6 sm:p-6 sm:text-start">
          <div className="flex-shrink-0">
            <div className="rounded-full bg-gradient-to-br from-lime-100 to-green-100 p-2.5">
              <GrabCoin size={88} alt={pointsName} />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">
              {isArabic ? "مكافأة الولاء" : "Loyalty reward"}
            </p>

            <h2 id="loyalty-reward-title" className="mt-0.5 text-2xl font-extrabold leading-tight text-gray-900">
              {isArabic ? "لقد حصلت على" : "You have earned"}{" "}
              <span className="text-green-600">
                {formatted} {pointsName}
              </span>
              !
            </h2>

            <p className="mt-1.5 text-sm text-gray-600">
              {isArabic
                ? `استخدم ${pointsName} للحصول على خصم على طلبك القادم.`
                : `Use these ${pointsName} to get a discount on your next order.`}
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                onClick={() => dismiss(pointsPath)}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                {isArabic ? "عرض نقاطي" : `View my ${pointsName}`}
              </button>
              <button
                onClick={() => dismiss()}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                {isArabic ? "متابعة التسوق" : "Keep shopping"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoyaltyRewardDialog
