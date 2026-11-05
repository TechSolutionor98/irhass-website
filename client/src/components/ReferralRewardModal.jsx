"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Gift, Loader2, X } from "lucide-react"
import { useReferral } from "../context/ReferralContext"
import { useAuth } from "../context/AuthContext"
import TranslatedText from "./TranslatedText"

/**
 * "Use Referral Discount" modal, opened from the payment section (mirrors the coupons and
 * Grabian Points modals). Lists the referral rewards the customer holds and lets them apply
 * one to this order.
 *
 * What a reward is worth comes from the server (`/api/referrals/quote`), so the figure shown
 * is the figure the order endpoint will honour. The quote/re-value sync runs whether or not
 * the modal is open, so a basket change never leaves a stale referral discount on the total.
 *
 * `eligibleAmountAed` is the goods total after any coupon, in AED. A referral reward never
 * comes off delivery or payment fees.
 */
const ReferralRewardModal = ({ open, onClose, eligibleAmountAed, selectedRewardId, onApply, onClear, formatPrice }) => {
  const { isEnabled, quoteRewards } = useReferral()
  const { isAuthenticated } = useAuth()

  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
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

  // Runs regardless of whether the modal is open so the total stays correct.
  useEffect(() => {
    loadQuote()
  }, [loadQuote])

  // The basket changed under a reward that was already applied: re-apply at its new value,
  // or clear it if it no longer qualifies.
  useEffect(() => {
    if (!selectedRewardId || rewards.length === 0) return
    const current = rewards.find((reward) => reward.id === selectedRewardId)
    if (!current || !current.applicable) {
      onClear()
      return
    }
    onApply(current.id, current.discountAed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewards, selectedRewardId])

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

  if (!open) return null

  const headline = (reward) =>
    reward.discountType === "fixed" ? formatPrice(reward.discountValue) : `${reward.discountValue}%`

  // Usable now, or blocked only by the basket being too small (the one case fixable here).
  const visible = rewards.filter((reward) => reward.applicable || reward.blockedReason === "below_minimum")

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-reward-title"
    >
      <div
        className="flex w-full sm:max-w-md max-h-[85vh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 id="referral-reward-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Gift size={20} className="text-lime-600" />
            <TranslatedText>Use Referral Discount</TranslatedText>
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
          {!isAuthenticated ? (
            <p className="text-sm text-gray-600">
              <TranslatedText>Sign in to use a referral discount.</TranslatedText>
            </p>
          ) : loading && rewards.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <TranslatedText>Checking your referral discounts…</TranslatedText>
            </div>
          ) : error ? (
            <div className="text-sm text-red-600">
              {error}{" "}
              <button onClick={loadQuote} className="font-medium underline">
                <TranslatedText>Try again</TranslatedText>
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="py-4 text-center">
              <Gift size={28} className="mx-auto text-gray-300" />
              <p className="mt-2 text-sm font-semibold text-gray-800">
                <TranslatedText>No referral discounts yet</TranslatedText>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                <TranslatedText>
                  Invite a friend with your code, or sign up with someone else's link, to earn a discount here.
                </TranslatedText>
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visible.map((reward) => {
                const applied = reward.id === selectedRewardId
                const disabled = !reward.applicable
                return (
                  <div
                    key={reward.id}
                    className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
                      applied ? "border-lime-500 bg-lime-50" : "border-gray-200"
                    } ${disabled ? "opacity-70" : ""}`}
                  >
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-gray-900">
                          {headline(reward)}{" "}
                          {reward.role === "referee" ? (
                            <TranslatedText>welcome discount</TranslatedText>
                          ) : (
                            <TranslatedText>referral reward</TranslatedText>
                          )}
                        </span>
                        {reward.code && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-700">
                            {reward.code}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs">
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
                            <TranslatedText>Add</TranslatedText>{" "}
                            {formatPrice(Math.max(0, reward.minOrderAed - eligibleAmountAed))}{" "}
                            <TranslatedText>more to use this discount</TranslatedText> (
                            <TranslatedText>min. order</TranslatedText> {formatPrice(reward.minOrderAed)})
                          </span>
                        )}
                      </p>
                    </div>
                    {applied ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClear()
                          onClose()
                        }}
                        className="self-center whitespace-nowrap rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <TranslatedText>Remove</TranslatedText>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          onApply(reward.id, reward.discountAed)
                          onClose()
                        }}
                        className="self-center whitespace-nowrap rounded-lg bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <TranslatedText>Apply</TranslatedText>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReferralRewardModal
