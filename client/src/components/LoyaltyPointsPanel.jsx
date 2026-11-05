"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { Clock, TrendingUp, Info, Zap } from "lucide-react"
import config from "../config/config"
import { useLoyalty } from "../context/LoyaltyContext"
import GrabCoin from "./GrabCoin"

const TYPE_LABELS = {
  earn: { label: "Earned", tone: "text-green-700 bg-green-50" },
  redeem: { label: "Spent", tone: "text-blue-700 bg-blue-50" },
  refund: { label: "Returned", tone: "text-amber-700 bg-amber-50" },
  reverse: { label: "Reversed", tone: "text-red-700 bg-red-50" },
  expire: { label: "Expired", tone: "text-gray-600 bg-gray-100" },
  adjust: { label: "Adjustment", tone: "text-purple-700 bg-purple-50" },
}

/** The customer's own points page: balance, what is still pending, and full history. */
const LoyaltyPointsPanel = () => {
  const { isEnabled, settings, formatPoints } = useLoyalty()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token")
      if (!token) return setLoading(false)
      try {
        setLoading(true)
        const res = await axios.get(`${config.API_URL}/api/loyalty/me`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { page, limit: 15 },
        })
        setData(res.data)
        setError("")
      } catch {
        setError("Your points could not be loaded right now.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [page])

  if (!isEnabled) return null

  const pointsName = settings.pointsName || "Points"

  if (loading && !data) {
    return <div className="py-10 text-center text-gray-500">Loading your {pointsName}…</div>
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        {error}{" "}
        <button onClick={() => setPage((p) => p)} className="underline font-medium">
          Try again
        </button>
      </div>
    )
  }

  const transactions = data?.transactions || []
  const totalPages = Math.max(1, Math.ceil((data?.totalCount || 0) / 15))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">My {pointsName}</h2>
        {data?.tier && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white shadow-xs"
            style={{ backgroundColor: data.tier.color || "#10b981" }}
          >
            <Zap size={13} />
            <span>{data.tier.name} Member</span>
            {data.tier.earnMultiplier > 1 && <span>({data.tier.earnMultiplier}x Points)</span>}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-lime-500 to-green-600 text-white p-5">
          <div className="flex items-center gap-2 text-white/80 text-xs font-medium mb-1">
            <GrabCoin size={16} />
            Available now
          </div>
          <div className="text-3xl font-extrabold">{Number(data?.balance || 0).toLocaleString()}</div>
          <div className="text-sm text-white/90 mt-1">
            worth Rs {Number(data?.balanceValueAed || 0).toFixed(2)}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
            <Clock className="h-4 w-4" />
            Pending
          </div>
          <div className="text-2xl font-bold text-gray-900">{Number(data?.pending || 0).toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Arrives when your orders are delivered</div>
        </div>

        <div className="rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
            <TrendingUp className="h-4 w-4" />
            Earned all time
          </div>
          <div className="text-2xl font-bold text-gray-900">{Number(data?.lifetime || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Only the admin's own programme terms appear here. The conversion rate and the
          minimum balance are deliberately not restated: the balance cards above already
          show what the points are worth, and checkout shows the rate where it matters. */}
      {settings.programmeTerms && (
        <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
          <span>{settings.programmeTerms}</span>
        </div>
      )}

      <div>
        <h3 className="text-base font-bold text-gray-900 mb-3">History</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-lg">
            No {pointsName} activity yet. Points appear here once you place an order.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {transactions.map((tx) => {
              const meta = TYPE_LABELS[tx.type] || { label: tx.type, tone: "text-gray-600 bg-gray-100" }
              return (
                <div key={tx._id} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${meta.tone}`}>{meta.label}</span>
                      {tx.status === "pending" && (
                        <span className="px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700">
                          pending delivery
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1 truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div
                    className={`text-base font-bold whitespace-nowrap ${
                      tx.points >= 0 ? "text-green-700" : "text-gray-700"
                    }`}
                  >
                    {tx.points >= 0 ? "+" : ""}
                    {Number(tx.points).toLocaleString()}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 text-sm">
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-300 rounded disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LoyaltyPointsPanel
