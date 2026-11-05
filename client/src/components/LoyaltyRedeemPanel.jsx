"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Loader2 } from "lucide-react"
import { useLoyalty } from "../context/LoyaltyContext"
import { useAuth } from "../context/AuthContext"
import GrabCoin from "./GrabCoin"

/**
 * The checkout control for paying with points.
 *
 * The cap comes from the server (`/api/loyalty/quote`) rather than being worked out here,
 * so the number offered is the same number the order endpoint will honour. The parent owns
 * the applied value and folds it into the order total.
 *
 * `eligibleAmountAed` is the goods total after any coupon, in AED. Points never come off
 * delivery or payment fees.
 */
const LoyaltyRedeemPanel = ({ eligibleAmountAed, appliedPoints, onChange, formatPrice }) => {
  const { isEnabled, settings, balance, pending, formatPoints, pointsToAed } = useLoyalty()
  const { isAuthenticated } = useAuth()

  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState(String(appliedPoints || 0))

  const { fetchRedemptionQuote } = useLoyalty()
  // Guards against an older, slower quote landing after a newer one.
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

  useEffect(() => {
    loadQuote()
  }, [loadQuote])

  // If the cart shrinks below what is already applied, pull the applied amount back down
  // rather than letting the order fail server-side.
  useEffect(() => {
    if (!quote) return
    if (appliedPoints > quote.maxPoints) {
      onChange(quote.maxPoints, pointsToAed(quote.maxPoints))
      setDraft(String(quote.maxPoints))
    }
  }, [quote, appliedPoints, onChange, pointsToAed])

  if (!isEnabled) return null

  const pointsName = settings.pointsName || "Points"

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
        <span className="inline-flex items-center gap-1.5 font-medium text-gray-800">
          <GrabCoin size={18} />
          {pointsName}
        </span>
        <p className="mt-1">Sign in to earn and spend {pointsName} on this order.</p>
      </div>
    )
  }

  if (balance <= 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
        <span className="inline-flex items-center gap-1.5 font-medium text-gray-800">
          <GrabCoin size={18} />
          {pointsName}
        </span>
        <p className="mt-1">
          You have no {pointsName} yet.
          {pending > 0 && ` ${formatPoints(pending)} will arrive once your open orders are delivered.`}
        </p>
      </div>
    )
  }

  const maxPoints = quote?.maxPoints ?? 0
  const step = Math.max(1, Number(settings.redeemStep) || 1)

  const blockedMessages = {
    below_minimum: `You need at least ${formatPoints(settings.minPointsToRedeem)} to redeem.`,
    cap_below_minimum: `This order is too small to redeem ${pointsName} against.`,
    no_points: `You have no ${pointsName} to redeem.`,
    empty_cart: "Add something to your cart first.",
    disabled: `${pointsName} are not available right now.`,
  }

  const apply = (rawValue) => {
    const snapped = Math.min(maxPoints, Math.max(0, Math.floor(Number(rawValue) || 0)))
    const stepped = Math.floor(snapped / step) * step
    setDraft(String(stepped))
    onChange(stepped, pointsToAed(stepped))
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50/60 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <GrabCoin size={18} />
          Pay with {pointsName}
        </span>
        <span className="text-xs text-gray-600">
          Balance: <strong>{formatPoints(balance, { withName: false })}</strong>
        </span>
      </div>

      {loading && !quote ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-1">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your balance…
        </div>
      ) : error ? (
        <div className="text-sm text-red-600">
          {error}{" "}
          <button onClick={loadQuote} className="underline font-medium">
            Try again
          </button>
        </div>
      ) : quote?.blockedReason ? (
        <p className="text-sm text-gray-600">
          {blockedMessages[quote.blockedReason] || `${pointsName} cannot be used on this order.`}
        </p>
      ) : maxPoints <= 0 ? (
        <p className="text-sm text-gray-600">No {pointsName} can be applied to this order.</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={maxPoints}
              step={step}
              value={Number(draft) || 0}
              onChange={(e) => setDraft(e.target.value)}
              onMouseUp={(e) => apply(e.target.value)}
              onTouchEnd={(e) => apply(e.target.value)}
              onKeyUp={(e) => apply(e.target.value)}
              className="flex-1 accent-green-600"
              aria-label={`${pointsName} to redeem`}
            />
            <button
              type="button"
              onClick={() => apply(maxPoints)}
              className="px-2.5 py-1 text-xs font-medium text-green-700 bg-white border border-green-300 rounded hover:bg-green-100 whitespace-nowrap"
            >
              Use max
            </button>
          </div>

          <div className="flex items-center justify-between mt-2 text-sm">
            <span className="text-gray-700">
              {formatPoints(Number(draft) || 0, { withName: false })} {pointsName}
            </span>
            <span className="font-semibold text-green-700">
              − {formatPrice ? formatPrice(pointsToAed(Number(draft) || 0)) : `Rs ${pointsToAed(Number(draft) || 0)}`}
            </span>
          </div>

          {appliedPoints > 0 && (
            <button
              type="button"
              onClick={() => apply(0)}
              className="mt-1 text-xs text-gray-500 underline hover:text-gray-700"
            >
              Remove {pointsName}
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default LoyaltyRedeemPanel
