"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Gift, Loader2, X } from "lucide-react"
import { useReferral } from "../context/ReferralContext"
import { useAuth } from "../context/AuthContext"

/**
 * The checkout control for spending a referral reward.
 *
 * What each reward is worth comes from the server (`/api/referrals/quote`) rather than
 * being worked out here, so the number offered is the number the order endpoint will
 * honour. The parent owns the applied value and folds it into the order total.
 *
 * `eligibleAmountAed` is the goods total after any coupon, in AED. A referral reward never
 * comes off delivery or payment fees.
 */
const ReferralRewardPanel = ({ eligibleAmountAed, selectedRewardId, onApply, onClear, formatPrice }) => {
  const { isEnabled, quoteRewards } = useReferral()
  const { isAuthenticated } = useAuth()

  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState(false)

  // Guards against an older, slower quote landing after a newer one.
  const requestIdRef = useRef(0)

  const loadQuote = useCallback(async () => {
    if (!isEnabled || !isAuthenticated || eligibleAmountAed <= 0) {
      setRewards([])
      return
    }
    const requestId = ++requestIdRef.current
    try {
      setLoading(true)
      const data = await quoteRewards(eligibleAmountAed)
      if (requestId !== requestIdRef.current) return
      setRewards(data.rewards || [])
      setError("")
    } catch {
      if (requestId !== requestIdRef.current) return
      setRewards([])
      setError("Could not check your referral discounts. Try again.")
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [isEnabled, isAuthenticated, eligibleAmountAed, quoteRewards])

  useEffect(() => {
    loadQuote()
  }, [loadQuote])

  const applicable = rewards.filter((reward) => reward.applicable)
  const selected = rewards.find((reward) => reward.id === selectedRewardId) || null

  // The basket changed under a reward that was already applied. Re-apply it at its new
  // value, or drop it if it no longer qualifies, rather than letting the order fail
  // server-side with a price the customer was never shown.
  useEffect(() => {
    if (!selectedRewardId || rewards.length === 0) return
    const current = rewards.find((reward) => reward.id === selectedRewardId)
    if (!current || !current.applicable) {
      onClear()
      return
    }
    onApply(current.id, current.discountAed)
    // onApply/onClear are stable callbacks from context; re-running on their identity
    // would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewards, selectedRewardId])

  if (!isEnabled || !isAuthenticated) return null
  if (!loading && applicable.length === 0 && !selected) return null

  const describe = (reward) => {
    const headline = reward.discountType === "fixed" ? formatPrice(reward.discountValue) : `${reward.discountValue}%`
    const label = reward.role === "referee" ? `${headline} welcome discount` : `${headline} referral reward`
    return reward.code ? `${label} · ${reward.code}` : label
  }

  return (
    <div className="mb-3 rounded-lg border border-lime-200 bg-lime-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Gift size={16} className="shrink-0 text-lime-600" />
          <span className="truncate text-sm font-bold text-gray-900">Referral discount</span>
        </div>
        {loading && <Loader2 size={14} className="shrink-0 animate-spin text-lime-600" />}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {selected ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{describe(selected)}</p>
            <p className="text-xs text-green-600">Saves {formatPrice(selected.discountAed)}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
          >
            <X size={13} />
            Remove
          </button>
        </div>
      ) : (
        applicable.length > 0 && (
          <div className="mt-2 space-y-2">
            {/* Only the best-value reward is offered up front. Someone holding several
                sees the rest behind "Use a different one" rather than a wall of choices
                where one is obviously right. */}
            {(expanded ? applicable : applicable.slice(0, 1)).map((reward) => (
              <button
                key={reward.id}
                type="button"
                onClick={() => onApply(reward.id, reward.discountAed)}
                className="flex w-full items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-left transition hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{describe(reward)}</p>
                  <p className="text-xs text-gray-500">Saves {formatPrice(reward.discountAed)}</p>
                </div>
                <span className="shrink-0 rounded-md bg-lime-600 px-3 py-1 text-xs font-bold text-white">Apply</span>
              </button>
            ))}
            {applicable.length > 1 && (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="text-xs font-semibold text-lime-700 underline"
              >
                {expanded ? "Show fewer" : `Use a different one (${applicable.length - 1} more)`}
              </button>
            )}
          </div>
        )
      )}
    </div>
  )
}

export default ReferralRewardPanel
