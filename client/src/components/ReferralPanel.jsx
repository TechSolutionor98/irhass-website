"use client"

import { useState, useMemo } from "react"
import { Copy, Check, Share2, Gift, Users, Clock, CheckCircle2, XCircle } from "lucide-react"
import { useReferral } from "../context/ReferralContext"
import { useCurrency } from "../context/CurrencyContext"

const INVITE_STATUS = {
  pending: {
    label: "Waiting on their first delivered order",
    tone: "text-amber-700 bg-amber-50 border-amber-200",
    Icon: Clock,
  },
  qualified: {
    label: "Counted",
    tone: "text-green-700 bg-green-50 border-green-200",
    Icon: CheckCircle2,
  },
  cancelled: {
    label: "Not counted",
    tone: "text-gray-600 bg-gray-100 border-gray-200",
    Icon: XCircle,
  },
}

const REWARD_STATUS = {
  active: { label: "Ready to use", tone: "text-green-700 bg-green-50" },
  used: { label: "Used", tone: "text-blue-700 bg-blue-50" },
  expired: { label: "Expired", tone: "text-gray-600 bg-gray-100" },
  cancelled: { label: "Withdrawn", tone: "text-red-700 bg-red-50" },
}

// Why a counted referral did not pay out. An invite that brought a customer in but earned
// nothing needs an answer on the screen, not a support ticket.
const NOT_REWARDED_REASON = {
  limit_reached: "You have reached the maximum number of rewarded invites",
  no_reward_configured: "No reward was running at the time",
}

const formatDate = (value) => {
  if (!value) return ""
  try {
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return ""
  }
}

/** The customer's own referral page: their link, who they invited, and what they earned. */
const ReferralPanel = () => {
  const { isEnabled, settings, summary, loadingSummary } = useReferral()
  const { formatPrice } = useCurrency()

  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState("invites")

  const describeOffer = (type, value, cap) => {
    const headline = type === "fixed" ? formatPrice(value) : `${value}%`
    if (type !== "fixed" && cap > 0) return `${headline} off (up to ${formatPrice(cap)})`
    return `${headline} off`
  }

  const invites = summary?.invites || []
  const rewards = summary?.rewards || []

  // The thank-you rewards are the ones the customer earned by inviting; the welcome
  // discount they were given is shown separately so the two are never confused.
  const { earnedRewards, welcomeRewards } = useMemo(
    () => ({
      earnedRewards: rewards.filter((reward) => reward.role === "referrer"),
      welcomeRewards: rewards.filter((reward) => reward.role === "referee"),
    }),
    [rewards],
  )

  if (!isEnabled) return null

  const link = summary?.link || ""
  const code = summary?.code || ""

  // The figures in the banner come from the server's view of this customer's tier
  // (assigned, else the programme default), which is exactly what a reward will carry.
  // The base settings only stand in while the summary is still loading.
  const refereeOffer = summary?.offer?.referee || {
    discountType: settings.refereeDiscountType,
    discountValue: settings.refereeDiscountValue,
    maxDiscountAed: settings.refereeMaxDiscountAed,
    minOrderAed: settings.refereeMinOrderAed,
  }
  const referrerOffer = summary?.offer?.referrer || {
    discountType: settings.referrerDiscountType,
    discountValue: settings.referrerDiscountValue,
    maxDiscountAed: settings.referrerMaxDiscountAed,
    minOrderAed: settings.referrerMinOrderAed,
  }

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      // Older browsers, and any page not served over https, have no clipboard API. Select
      // the field instead so the customer can copy it by hand rather than being told
      // nothing happened.
      const field = document.getElementById("referral-link-field")
      if (field) {
        field.focus()
        field.select()
      }
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleShare = async () => {
    if (!link) return
    const message = String(settings.shareMessage || "").replace("{{link}}", link) || link

    // The native share sheet is the whole point on a phone; on a desktop browser without
    // one, copying is the next best thing.
    if (navigator.share) {
      try {
        await navigator.share({ title: settings.programmeName || "Refer a friend", text: message, url: link })
        return
      } catch {
        // The customer dismissed the sheet. Nothing to report.
        return
      }
    }
    handleCopy()
  }

  if (loadingSummary && !summary) {
    return <div className="py-10 text-center text-gray-500">Loading your invite link…</div>
  }

  return (
    <div className="space-y-6">
      {/* ---- The offer ---- */}
      <div className="rounded-2xl border-2 border-lime-300 bg-gradient-to-br from-lime-50 to-lime-100/70 p-5 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
          <div className="rounded-xl bg-lime-600 p-2 text-white">
            <Gift size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold text-gray-900">{settings.programmeName || "Refer a Friend"}</h2>
              {summary?.tier && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-xs"
                  style={{ backgroundColor: summary.tier.color || "#3b82f6" }}
                >
                  {summary.tier.name} Tier
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-700">
              Your friend gets{" "}
              <strong className="text-lime-800">
                {describeOffer(refereeOffer.discountType, refereeOffer.discountValue, refereeOffer.maxDiscountAed)}
              </strong>{" "}
              when they sign up with your link
              {refereeOffer.minOrderAed > 0 ? ` (on orders over ${formatPrice(refereeOffer.minOrderAed)})` : ""}. Once
              their first order is delivered, you get{" "}
              <strong className="text-lime-800">
                {describeOffer(referrerOffer.discountType, referrerOffer.discountValue, referrerOffer.maxDiscountAed)}
              </strong>{" "}
              on your next order{referrerOffer.minOrderAed > 0 ? ` over ${formatPrice(referrerOffer.minOrderAed)}` : ""}.
            </p>
          </div>
          </div>

          {/* Referral code highlight — kept prominent so it is easy to read and share. */}
          {code && (
            <div className="hidden shrink-0 rounded-xl border border-lime-300 bg-white px-4 py-3 text-right shadow-sm sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wide text-lime-700">Your code</p>
              <p className="font-mono text-xl font-extrabold leading-tight tracking-wider text-lime-700 lg:text-2xl">
                {code}
              </p>
              <p className="text-[11px] text-gray-500">share to earn</p>
            </div>
          )}
        </div>

        {/* ---- The link ---- */}
        <div className="mt-5 space-y-3">
          <label htmlFor="referral-link-field" className="block text-xs font-bold uppercase tracking-wide text-gray-600">
            Your invite link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="referral-link-field"
              readOnly
              value={link}
              onFocus={(event) => event.target.select()}
              className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-xs text-gray-700 sm:text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!link}
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={!link}
                className="inline-flex items-center gap-2 rounded-xl bg-lime-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Share2 size={16} />
                Share
              </button>
            </div>
          </div>
          {code && (
            <p className="text-xs text-gray-600">
              Or share your code: <span className="font-mono font-bold text-gray-900">{code}</span>
            </p>
          )}
        </div>
      </div>

      {/* ---- Tabs ---- */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: "invites", label: `Invites (${invites.length})` },
          { id: "rewards", label: `My rewards (${rewards.length})` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition ${
              tab === item.id ? "border-lime-600 text-lime-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ---- Invites ---- */}
      {tab === "invites" && (
        <div>
          {invites.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No invites yet"
              body="Share your link above. Everyone who signs up with it appears here straight away."
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-gray-500">
                An invite counts once your friend&apos;s first order has been delivered — that is when your reward is
                added.
              </p>
              <ul className="space-y-2">
                {invites.map((invite) => {
                  const status = INVITE_STATUS[invite.status] || INVITE_STATUS.pending
                  const { Icon } = status
                  return (
                    <li
                      key={invite.id}
                      className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-gray-900">{invite.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {invite.email}
                          {invite.joinedAt ? ` · joined ${formatDate(invite.joinedAt)}` : ""}
                        </p>
                        {invite.status === "qualified" && !invite.rewarded && invite.notRewardedReason && (
                          <p className="mt-1 text-xs text-amber-700">
                            {NOT_REWARDED_REASON[invite.notRewardedReason] || "No reward was added for this invite"}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${status.tone}`}
                      >
                        <Icon size={13} />
                        {status.label}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ---- Rewards ---- */}
      {tab === "rewards" && (
        <div className="space-y-6">
          <RewardList
            title="Earned by inviting"
            emptyBody="Rewards you earn from invites will appear here."
            rewards={earnedRewards}
            describeOffer={describeOffer}
            formatPrice={formatPrice}
          />
          {welcomeRewards.length > 0 && (
            <RewardList
              title="Your welcome discount"
              emptyBody=""
              rewards={welcomeRewards}
              describeOffer={describeOffer}
              formatPrice={formatPrice}
            />
          )}
          <p className="text-xs text-gray-500">
            A reward that is ready to use is offered to you automatically at checkout.
          </p>
        </div>
      )}

      {settings.programmeTerms && (
        <p className="whitespace-pre-line border-t border-gray-100 pt-4 text-xs text-gray-500">
          {settings.programmeTerms}
        </p>
      )}
    </div>
  )
}

const EmptyState = ({ icon: Icon, title, body }) => (
  <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
    <Icon size={28} className="mx-auto text-gray-400" />
    <p className="mt-3 font-bold text-gray-800">{title}</p>
    <p className="mt-1 text-sm text-gray-500">{body}</p>
  </div>
)

const RewardList = ({ title, emptyBody, rewards, describeOffer, formatPrice }) => (
  <div>
    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">{title}</h3>
    {rewards.length === 0 ? (
      <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        {emptyBody}
      </p>
    ) : (
      <ul className="space-y-2">
        {rewards.map((reward) => {
          const status = REWARD_STATUS[reward.status] || REWARD_STATUS.expired
          return (
            <li
              key={reward.id}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-bold text-gray-900">
                  {describeOffer(reward.discountType, reward.discountValue, reward.maxDiscountAed)}
                </p>
                <p className="text-xs text-gray-500">
                  {reward.description}
                  {reward.code ? ` · code ${reward.code}` : ""}
                  {reward.minOrderAed > 0 ? ` · min. order ${formatPrice(reward.minOrderAed)}` : ""}
                  {reward.firstOrderOnly ? " · first order only" : ""}
                  {reward.expiresAt && reward.status === "active" ? ` · expires ${formatDate(reward.expiresAt)}` : ""}
                  {reward.status === "used" && reward.discountAppliedAed
                    ? ` · saved ${formatPrice(reward.discountAppliedAed)}`
                    : ""}
                </p>
              </div>
              <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.tone}`}>
                {status.label}
              </span>
            </li>
          )
        })}
      </ul>
    )}
  </div>
)

export default ReferralPanel
