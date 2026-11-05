"use client"

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { Users, Search, Plus, Minus, History, X } from "lucide-react"
import config from "../../config/config"
import { describeApiError } from "../../utils/apiError"

// Customer balances, manual adjustments, and the ledger behind them.
const AdminLoyaltyCustomers = () => {
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState(null)
  const [search, setSearch] = useState("")
  const [onlyWithPoints, setOnlyWithPoints] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [adjustTarget, setAdjustTarget] = useState(null)
  const [historyTarget, setHistoryTarget] = useState(null)

  const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
  const authHeader = { headers: { Authorization: `Bearer ${token}` } }

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${config.API_URL}/api/loyalty/admin/customers`, {
        ...authHeader,
        params: { page, limit: 25, search: search.trim() || undefined, onlyWithPoints },
      })
      setCustomers(data.customers || [])
      setTotalCount(data.totalCount || 0)
      setError("")
    } catch (err) {
      setError(describeApiError(err, "Failed to load customers"))
    } finally {
      setLoading(false)
    }
  }, [page, search, onlyWithPoints]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(load, search ? 350 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  useEffect(() => {
    axios
      .get(`${config.API_URL}/api/loyalty/admin/settings`, authHeader)
      .then((res) => setSettings(res.data))
      .catch(() => setSettings(null))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pointsName = settings?.pointsName || "Points"
  const totalPages = Math.max(1, Math.ceil(totalCount / 25))

  return (
    <div className="ml-64 p-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg">
          <Users className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer {pointsName}</h1>
          <p className="text-sm text-gray-500">Balances, manual adjustments and full history</p>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by name, email or phone"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={onlyWithPoints}
              onChange={(e) => {
                setOnlyWithPoints(e.target.checked)
                setPage(1)
              }}
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Only customers holding points
          </label>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium text-right">Balance</th>
                  <th className="px-4 py-3 font-medium text-right">Worth</th>
                  <th className="px-4 py-3 font-medium text-right">Lifetime</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer) => (
                  <tr key={customer._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900">{customer.name}</div>
                        {customer.loyaltyType && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-xs"
                            style={{ backgroundColor: customer.loyaltyType.color || "#10b981" }}
                          >
                            {customer.loyaltyType.name}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{customer.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {Number(customer.loyaltyPoints || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      Rs {Number(customer.balanceValueAed || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {Number(customer.loyaltyLifetimePoints || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setHistoryTarget(customer)}
                          className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
                          title="View history"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setAdjustTarget(customer)}
                          className="px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded"
                        >
                          Adjust
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Page {page} of {totalPages} · {totalCount.toLocaleString()} customers
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

      {adjustTarget && (
        <AdjustModal
          customer={adjustTarget}
          pointsName={pointsName}
          authHeader={authHeader}
          onClose={() => setAdjustTarget(null)}
          onDone={() => {
            setAdjustTarget(null)
            load()
          }}
        />
      )}

      {historyTarget && (
        <HistoryModal customer={historyTarget} authHeader={authHeader} onClose={() => setHistoryTarget(null)} />
      )}
    </div>
  )
}

const AdjustModal = ({ customer, pointsName, authHeader, onClose, onDone }) => {
  const [direction, setDirection] = useState("credit")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    const magnitude = Math.floor(Number(amount) || 0)
    if (magnitude <= 0) return setError("Enter how many points to add or remove")
    if (!note.trim()) return setError("A reason is required — it is stored on the customer's history")

    try {
      setSaving(true)
      setError("")
      await axios.post(
        `${config.API_URL}/api/loyalty/admin/customers/${customer._id}/adjust`,
        { points: direction === "credit" ? magnitude : -magnitude, note: note.trim() },
        authHeader,
      )
      onDone()
    } catch (err) {
      setError(describeApiError(err, "Adjustment failed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Adjust ${pointsName}`} subtitle={customer.name} onClose={onClose}>
      <div className="text-sm text-gray-600 mb-4">
        Current balance: <strong>{Number(customer.loyaltyPoints || 0).toLocaleString()}</strong>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setDirection("credit")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium ${
            direction === "credit" ? "bg-green-50 border-green-500 text-green-700" : "border-gray-300 text-gray-600"
          }`}
        >
          <Plus className="h-4 w-4" /> Add
        </button>
        <button
          onClick={() => setDirection("debit")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium ${
            direction === "debit" ? "bg-red-50 border-red-500 text-red-700" : "border-gray-300 text-gray-600"
          }`}
        >
          <Minus className="h-4 w-4" /> Remove
        </button>
      </div>

      <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
      <input
        type="number"
        min="1"
        step="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 outline-none focus:ring-2 focus:ring-green-500"
        placeholder="1000"
      />

      <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
        placeholder="Goodwill gesture for delayed delivery"
      />

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

      <div className="flex gap-2 mt-5">
        <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Apply"}
        </button>
      </div>
    </Modal>
  )
}

const TYPE_LABELS = {
  earn: { label: "Earned", tone: "text-green-700 bg-green-50" },
  redeem: { label: "Redeemed", tone: "text-blue-700 bg-blue-50" },
  refund: { label: "Refunded", tone: "text-amber-700 bg-amber-50" },
  reverse: { label: "Reversed", tone: "text-red-700 bg-red-50" },
  expire: { label: "Expired", tone: "text-gray-600 bg-gray-100" },
  adjust: { label: "Adjustment", tone: "text-purple-700 bg-purple-50" },
}

const HistoryModal = ({ customer, authHeader, onClose }) => {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios
      .get(`${config.API_URL}/api/loyalty/admin/transactions`, {
        ...authHeader,
        params: { user: customer._id, limit: 50 },
      })
      .then((res) => setTransactions(res.data?.transactions || []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title="Points history" subtitle={customer.name} onClose={onClose} wide>
      {loading ? (
        <div className="py-8 text-center text-gray-500">Loading…</div>
      ) : transactions.length === 0 ? (
        <div className="py-8 text-center text-gray-500">No point movements yet.</div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-500 sticky top-0 bg-white">
              <tr>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Detail</th>
                <th className="py-2 font-medium text-right">Points</th>
                <th className="py-2 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => {
                const meta = TYPE_LABELS[tx.type] || { label: tx.type, tone: "text-gray-600 bg-gray-100" }
                return (
                  <tr key={tx._id}>
                    <td className="py-2.5 text-gray-500 whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${meta.tone}`}>{meta.label}</span>
                      {tx.status === "pending" && (
                        <span className="ml-1 px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700">pending</span>
                      )}
                      {tx.status === "cancelled" && (
                        <span className="ml-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">cancelled</span>
                      )}
                    </td>
                    <td className="py-2.5 text-gray-600">
                      {tx.description}
                      {tx.adminNote && <div className="text-xs text-gray-400">{tx.adminNote}</div>}
                    </td>
                    <td
                      className={`py-2.5 text-right font-semibold ${tx.points >= 0 ? "text-green-700" : "text-red-600"}`}
                    >
                      {tx.points >= 0 ? "+" : ""}
                      {Number(tx.points).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-gray-500">
                      {tx.balanceAfter === null || tx.balanceAfter === undefined
                        ? "—"
                        : Number(tx.balanceAfter).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

const Modal = ({ title, subtitle, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div
      className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-md"} p-5`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
)

export default AdminLoyaltyCustomers
