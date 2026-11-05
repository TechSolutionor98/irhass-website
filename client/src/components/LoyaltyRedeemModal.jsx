"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2, X } from "lucide-react"
import { useLoyalty } from "../context/LoyaltyContext"
import { useAuth } from "../context/AuthContext"
import GrabCoin from "./GrabCoin"
import TranslatedText from "./TranslatedText"

/**
 * "Use Grabian Points" modal, opened from the payment section (mirrors the Available
 * Coupons modal). Shows the balance, a one-tap "Use all points" and a custom amount.
 *
 * The cap comes from the server (`/api/loyalty/quote`) so the number offered is the number
 * the order endpoint will honour. The parent owns the applied value via `onChange`.
 */
const LoyaltyRedeemModal = ({ open, onClose, eligibleAmountAed, appliedPoints, onChange, formatPrice }) => {
  const { isEnabled, settings, balance, pending, formatPoints, pointsToAed, fetchRedemptionQuote } = useLoyalty()
  const { isAuthenticated } = useAuth()

  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState(String(appliedPoints || 0))
  const requestIdRef = useRef(0)

  const loadQuote = useCallback(async () => {
    if (!isEnabled || !isAuthenticated || eligibleAmountAed <= 0) {
      setQuote(null)
      return
    }
    const requestId = ++requestIdRef.current
    try {
      setLoading(true)
      const data = await fetchRedemptionQuote({ eligibleAmount: eligibleAmountAed, requestedPoints: 0 })
      if (requestId !== requestIdRef.current) return
      setQuote(data)
      setError("")
    } catch {
      if (requestId !== requestIdRef.current) return
      setQuote(null)
      setError("Could not check your points balance. Try again.")
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [isEnabled, isAuthenticated, eligibleAmountAed, fetchRedemptionQuote])

  // Only fetch while the modal is open.
  useEffect(() => {
    if (open) loadQuote()
  }, [open, loadQuote])

  // Keep the draft in step with whatever is currently applied when the modal opens.
  useEffect(() => {
    if (open) setDraft(String(appliedPoints || 0))
  }, [open, appliedPoints])

  // Escape closes and the body must not scroll behind the modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || !isEnabled) return null

  const pointsName = settings.pointsName || "Points"
  const maxPoints = quote?.maxPoints ?? 0
  const step = Math.max(1, Number(settings.redeemStep) || 1)

  const blockedMessages = {
    below_minimum: `You need at least ${formatPoints(settings.minPointsToRedeem)} to redeem.`,
    cap_below_minimum: `This order is too small to redeem ${pointsName} against.`,
    no_points: `You have no ${pointsName} to redeem.`,
    empty_cart: "Add something to your cart first.",
    disabled: `${pointsName} are not available right now.`,
  }

  const apply = (rawValue, thenClose = false) => {
    const snapped = Math.min(maxPoints, Math.max(0, Math.floor(Number(rawValue) || 0)))
    const stepped = Math.floor(snapped / step) * step
    setDraft(String(stepped))
    onChange(stepped, pointsToAed(stepped))
    if (thenClose) onClose()
  }

  const draftPoints = Math.min(maxPoints, Math.max(0, Math.floor(Number(draft) || 0)))

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="loyalty-redeem-title"
    >
      <div
        className="flex w-full sm:max-w-md max-h-[85vh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 id="loyalty-redeem-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <GrabCoin size={20} />
            <TranslatedText>Use</TranslatedText> {pointsName}
          </h2>
          <button
            type="button"
            className="-mr-2 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {/* Balance */}
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
              <GrabCoin size={18} />
              <TranslatedText>Available balance</TranslatedText>
            </span>
            <span className="text-base font-bold text-green-700">
              {formatPoints(balance, { withName: false })} {pointsName}
            </span>
          </div>

          {!isAuthenticated ? (
            <p className="mt-4 text-sm text-gray-600">
              <TranslatedText>Sign in to spend your</TranslatedText> {pointsName}.
            </p>
          ) : balance <= 0 ? (
            <p className="mt-4 text-sm text-gray-600">
              <TranslatedText>You have no</TranslatedText> {pointsName} <TranslatedText>yet.</TranslatedText>
              {pending > 0 && ` ${formatPoints(pending)} will arrive once your open orders are delivered.`}
            </p>
          ) : loading && !quote ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <TranslatedText>Checking your balance…</TranslatedText>
            </div>
          ) : error ? (
            <div className="mt-4 text-sm text-red-600">
              {error}{" "}
              <button onClick={loadQuote} className="font-medium underline">
                <TranslatedText>Try again</TranslatedText>
              </button>
            </div>
          ) : quote?.blockedReason ? (
            <p className="mt-4 text-sm text-gray-600">
              {blockedMessages[quote.blockedReason] || `${pointsName} cannot be used on this order.`}
            </p>
          ) : maxPoints <= 0 ? (
            <p className="mt-4 text-sm text-gray-600">
              <TranslatedText>No</TranslatedText> {pointsName} <TranslatedText>can be applied to this order.</TranslatedText>
            </p>
          ) : (
            <>
              <p className="mt-4 text-xs text-gray-500">
                <TranslatedText>You can use up to</TranslatedText>{" "}
                <strong className="text-gray-800">{formatPoints(maxPoints, { withName: false })} {pointsName}</strong>{" "}
                <TranslatedText>on this order</TranslatedText>
                {" "}(−{formatPrice ? formatPrice(pointsToAed(maxPoints)) : `Rs ${pointsToAed(maxPoints)}`}).
              </p>

              {/* Use all points */}
              <button
                type="button"
                onClick={() => apply(maxPoints, true)}
                className="mt-3 flex w-full items-center justify-between rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-700"
              >
                <span>
                  <TranslatedText>Use all points</TranslatedText> ({formatPoints(maxPoints, { withName: false })})
                </span>
                <span>− {formatPrice ? formatPrice(pointsToAed(maxPoints)) : `Rs ${pointsToAed(maxPoints)}`}</span>
              </button>

              {/* Custom amount */}
              <div className="mt-4">
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-600">
                  <TranslatedText>Or enter points to use</TranslatedText>
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={maxPoints}
                    step={step}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder="0"
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                  />
                  <button
                    type="button"
                    onClick={() => apply(draft, true)}
                    className="rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
                  >
                    <TranslatedText>Apply</TranslatedText>
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  {formatPoints(draftPoints, { withName: false })} {pointsName} ={" "}
                  <span className="font-semibold text-green-700">
                    − {formatPrice ? formatPrice(pointsToAed(draftPoints)) : `Rs ${pointsToAed(draftPoints)}`}
                  </span>
                </p>
              </div>

              {appliedPoints > 0 && (
                <button
                  type="button"
                  onClick={() => apply(0, true)}
                  className="mt-4 w-full rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  <TranslatedText>Remove</TranslatedText> {pointsName}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoyaltyRedeemModal
