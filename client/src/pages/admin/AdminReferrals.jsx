"use client"

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { Users, Search, Clock, CheckCircle2, XCircle, Trophy, Ban } from "lucide-react"
import config from "../../config/config"
import { describeApiError } from "../../utils/apiError"

const STATUS_STYLES = {
  pending: { label: "Waiting", tone: "text-amber-700 bg-amber-50 border-amber-200", Icon: Clock },
  qualified: { label: "Counted", tone: "text-green-700 bg-green-50 border-green-200", Icon: CheckCircle2 },
  cancelled: { label: "Not counted", tone: "text-gray-600 bg-gray-100 border-gray-200", Icon: XCircle },
}

const REWARD_STATUS_TONE = {
  active: "text-green-700 bg-green-50",
  used: "text-blue-700 bg-blue-50",
  expired: "text-gray-600 bg-gray-100",
  cancelled: "text-red-700 bg-red-50",
}

const formatDate = (value) => {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return "—"
  }
}

const describeOffer = (reward) => {
  if (!reward) return "—"
  const headline = reward.discountType === "fixed" ? `Rs ${reward.discountValue}` : `${reward.discountValue}%`
  return `${headline} off`
}

/** Every invite in the programme, so the team can see who is bringing customers in. */
const AdminReferrals = () => {
  const [data, setData] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [cancelling, setCancelling] = useState(null)

  const token = localStorage.getItem("adminToken") || localStorage.getItem("token")

  const load = useCallback(async () => {
    const authHeader = { headers: { Authorization: `Bearer ${token}` } }
    try {
      setLoading(true)
      const [listRes, statsRes] = await Promise.all([
        axios.get(`${config.API_URL}/api/referrals/admin/list`, {
          ...authHeader,
          params: { page, limit: 25, status: status || undefined, search: search || undefined },
        }),
        axios.get(`${config.API_URL}/api/referrals/admin/stats`, authHeader).catch(() => ({ data: null })),
      ])
      setData(listRes.data)
      setStats(statsRes.data)
      setError("")
    } catch (err) {
      setError(describeApiError(err, "Failed to load referrals"))
    } finally {
      setLoading(false)
    }
  }, [token, page, status, search])

  useEffect(() => {
    load()
  }, [load])

  const handleSearch = (event) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  // Withdrawing a reward is visible to the customer the moment it happens, so the reason
  // is required before anything is sent.
  const handleCancelReward = async (rewardId) => {
    const reason = window.prompt("Why is this reward being withdrawn? The customer will lose it immediately.")
    if (reason === null) return
    if (!reason.trim()) {
      window.alert("A reason is required to withdraw a reward.")
      return
    }

    try {
      setCancelling(rewardId)
      await axios.post(
        `${config.API_URL}/api/referrals/admin/rewards/${rewardId}/cancel`,
        { reason: reason.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      await load()
    } catch (err) {
      window.alert(describeApiError(err, "Failed to withdraw the reward"))
    } finally {
      setCancelling(null)
    }
  }

  const referrals = data?.referrals || []

  return (
    <div className="ml-64 p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <Users className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
          <p className="text-sm text-gray-500">Who invited whom, and which invites have counted</p>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Invites total" value={stats.referrals?.total?.toLocaleString()} />
          <StatCard label="Waiting to count" value={stats.referrals?.pending?.toLocaleString()} tone="amber" />
          <StatCard label="Counted" value={stats.referrals?.qualified?.toLocaleString()} tone="green" />
          <StatCard
            label="Discount given"
            value={`Rs ${Number(stats.discountGiven?.totalAed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            tone="amber"
          />
        </div>
      )}

      {stats?.topReferrers?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-3">
            <Trophy className="h-4 w-4 text-amber-500" />
            Top referrers
          </h2>
          <ul className="divide-y divide-gray-100">
            {stats.topReferrers.map((referrer) => (
              <li key={referrer._id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{referrer.name}</p>
                  <p className="truncate text-xs text-gray-500">
                    {referrer.email}
                    {referrer.code ? ` · ${referrer.code}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-bold text-green-700">{referrer.qualified} counted</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, email or code"
              className="w-72 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            Search
          </button>
        </form>

        <select
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500"
        >
          <option value="">All statuses</option>
          <option value="pending">Waiting</option>
          <option value="qualified">Counted</option>
          <option value="cancelled">Not counted</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Inviter</th>
              <th className="px-4 py-3">Invited friend</th>
              <th className="px-4 py-3">Signed up</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Friend&apos;s discount</th>
              <th className="px-4 py-3">Inviter&apos;s reward</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && referrals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  Loading referrals…
                </td>
              </tr>
            )}

            {!loading && referrals.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No referrals match this view.
                </td>
              </tr>
            )}

            {referrals.map((referral) => {
              const style = STATUS_STYLES[referral.status] || STATUS_STYLES.pending
              const { Icon } = style
              return (
                <tr key={referral._id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-gray-900">{referral.referrer?.name || "—"}</p>
                      {referral.referrer?.referralType && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-xs"
                          style={{ backgroundColor: referral.referrer.referralType.color || "#3b82f6" }}
                        >
                          {referral.referrer.referralType.name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{referral.referrer?.email}</p>
                    <p className="mt-0.5 font-mono text-xs text-gray-400">{referral.code}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{referral.referee?.name || "—"}</p>
                    <p className="text-xs text-gray-500">{referral.referee?.email}</p>
                    {referral.referee && !referral.referee.isEmailVerified && (
                      <p className="mt-0.5 text-xs font-medium text-amber-600">Email not verified</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(referral.createdAt)}
                    {referral.qualifiedAt && (
                      <p className="text-xs text-green-600">counted {formatDate(referral.qualifiedAt)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${style.tone}`}
                    >
                      <Icon className="h-3 w-3" />
                      {style.label}
                    </span>
                    {referral.notRewardedReason && (
                      <p className="mt-1 text-xs text-amber-700">{referral.notRewardedReason.replace(/_/g, " ")}</p>
                    )}
                    {referral.rewardAlreadySpent && (
                      <p className="mt-1 text-xs text-red-600">Reward was already spent — could not be withdrawn</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RewardCell reward={referral.refereeReward} onCancel={handleCancelReward} cancelling={cancelling} />
                  </td>
                  <td className="px-4 py-3">
                    <RewardCell reward={referral.referrerReward} onCancel={handleCancelReward} cancelling={cancelling} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {data && data.totalCount > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.totalCount)} of{" "}
            {data.totalCount}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page === 1 || loading}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((value) => value + 1)}
              disabled={!data.hasMore || loading}
              className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const RewardCell = ({ reward, onCancel, cancelling }) => {
  if (!reward) return <span className="text-gray-400">—</span>

  return (
    <div>
      <p className="font-medium text-gray-900">{describeOffer(reward)}</p>
      <span
        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
          REWARD_STATUS_TONE[reward.status] || REWARD_STATUS_TONE.expired
        }`}
      >
        {reward.status}
      </span>
      {reward.status === "used" && reward.discountAppliedAed > 0 && (
        <p className="mt-0.5 text-xs text-gray-500">saved Rs {Number(reward.discountAppliedAed).toFixed(2)}</p>
      )}
      {reward.status === "active" && (
        <button
          type="button"
          onClick={() => onCancel(reward._id)}
          disabled={cancelling === reward._id}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          <Ban className="h-3 w-3" />
          {cancelling === reward._id ? "Withdrawing…" : "Withdraw"}
        </button>
      )}
    </div>
  )
}

const StatCard = ({ label, value, tone = "gray" }) => {
  const toneClass = tone === "amber" ? "text-amber-700" : tone === "green" ? "text-green-700" : "text-gray-900"
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <div className={`text-xl font-bold ${toneClass}`}>{value ?? "—"}</div>
    </div>
  )
}

export default AdminReferrals
