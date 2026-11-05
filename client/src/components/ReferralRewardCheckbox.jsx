"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Gift, Loader2 } from "lucide-react"
import { useReferral } from "../context/ReferralContext"
import { useAuth } from "../context/AuthContext"
import TranslatedText from "./TranslatedText"

/**
 * The cart's control for a referral discount: one checkbox per reward the customer
 * holds, each showing the referral code it came from and what it takes off this basket.
 *
 * What a reward is worth comes from the server (`/api/referrals/quote`), so the number
 * shown is the number the order endpoint will honour. The choice is kept in
 * ReferralContext and carries through to checkout.
 *
 * `eligibleAmountAed` is the goods total after any coupon, in AED. A referral reward never
 * comes off delivery or payment fees.
 */
const ReferralRewardCheckbox = ({ eligibleAmountAed, selectedRewardId, onApply, onClear, formatPrice }) => {
  const { isEnabled, quoteRewards } = useReferral()
  const { isAuthenticated } = useAuth()

  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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
      setError("Could not check your referral discount. Try again.")
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [isEnabled, isAuthenticated, eligibleAmountAed, quoteRewards])

  useEffect(() => {
    loadQuote()
  }, [loadQuote])

  // The basket changed under a reward that was already ticked. Re-apply it at its new
  // value, or untick it if it no longer qualifies, so the total never shows a discount
  // the order endpoint would refuse.
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

  // Rewards worth showing: usable now, or blocked only by the basket being too small
  // (the one case the shopper can fix from this page).
  const visible = rewards.filter((reward) => reward.applicable || reward.blockedReason === "below_minimum")
  if (!loading && visible.length === 0) return null

  const headline = (reward) =>
    reward.discountType === "fixed" ? formatPrice(reward.discountValue) : `${reward.discountValue}%`

  return (
    <div className="rounded-lg border border-lime-200 bg-lime-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <Gift size={15} className="text-lime-600" />
          <TranslatedText>Referral discount</TranslatedText>
        </span>
        {loading && <Loader2 size={14} className="animate-spin text-lime-600" />}
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      <div className="mt-2 space-y-2">
        {visible.map((reward) => {
          const checked = reward.id === selectedRewardId
          const disabled = !reward.applicable
          return (
            <label
              key={reward.id}
              className={`flex items-start gap-2.5 rounded-md bg-white px-3 py-2 ${
                disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:bg-lime-50"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500 disabled:cursor-not-allowed"
                checked={checked}
                disabled={disabled}
                onChange={(e) => (e.target.checked ? onApply(reward.id, reward.discountAed) : onClear())}
              />
              <span className="min-w-0 flex-1 text-sm">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-gray-900">
                    {headline(reward)}{" "}
                    {reward.role === "referee" ? <TranslatedText>welcome discount</TranslatedText> : <TranslatedText>referral reward</TranslatedText>}
                  </span>
                  {reward.code && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-700">
                      {reward.code}
                    </span>
                  )}
                  {reward.referralTypeName && (
                    <span className="text-[11px] text-gray-500">{reward.referralTypeName}</span>
                  )}
                </span>
                <span className="block text-xs">
                  {reward.applicable ? (
                    <span className="text-green-600">
                      <TranslatedText>Saves</TranslatedText> {formatPrice(reward.discountAed)}
                      {reward.discountType !== "fixed" && reward.maxDiscountAed > 0 && (
                        <span className="text-gray-500">
                          {" "}
                          (<TranslatedText>up to</TranslatedText> {formatPrice(reward.maxDiscountAed)})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      <TranslatedText>Add</TranslatedText> {formatPrice(Math.max(0, reward.minOrderAed - eligibleAmountAed))}{" "}
                      <TranslatedText>more to use this discount</TranslatedText> (<TranslatedText>min. order</TranslatedText>{" "}
                      {formatPrice(reward.minOrderAed)})
                    </span>
                  )}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export default ReferralRewardCheckbox
