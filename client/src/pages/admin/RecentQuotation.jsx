"use client"

import { useEffect, useMemo, useState } from "react"
import { adminAPI } from "../../services/api"
import { Search, Eye, RefreshCw, PauseCircle, PlayCircle, ArrowRightCircle, PencilLine, Trash2, MoreHorizontal } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import AdminOrderDetailsModal from "../../components/admin/AdminOrderDetailsModal"
import { askToEmailCustomer } from "../../utils/customerEmail"
import { orderCustomerName, orderCustomerEmail, orderPickupBranch } from "../../utils/orderCustomer"

const formatPrice = (price) => `Rs ${Number(price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`

// Draft and Hold are both still here waiting; Converted has already become a
// real order and is kept only as a record.
const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "Draft", label: "Draft" },
  { id: "Hold", label: "On Hold" },
  { id: "Converted", label: "Moved to Orders" },
]

const statusChipClass = (status) => {
  if (status === "Converted") return "bg-green-100 text-green-700"
  if (status === "Hold") return "bg-orange-100 text-orange-700"
  return "bg-yellow-100 text-yellow-700"
}

const statusLabel = (status) => {
  if (status === "Converted") return "Moved to Orders"
  if (status === "Hold") return "On Hold"
  return "Draft"
}

export default function RecentQuotation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  // Arriving from the On Hold button on the create screen opens straight onto
  // that tab rather than making the admin find it.
  const requestedStatus = searchParams.get("status")
  const [statusFilter, setStatusFilter] = useState(
    STATUS_TABS.some((tab) => tab.id === requestedStatus) ? requestedStatus : "all",
  )
  const [busyId, setBusyId] = useState(null)
  const [selectedQuotation, setSelectedQuotation] = useState(null)
  // Which row has its actions menu open. Only one at a time.
  const [openMenuId, setOpenMenuId] = useState(null)

  // A menu left open behind a click elsewhere (or a scroll) is a trap, so any click
  // outside it and the Escape key close it.
  useEffect(() => {
    if (!openMenuId) return
    const close = (event) => {
      if (!event.target.closest?.("[data-row-menu]")) setOpenMenuId(null)
    }
    const onKey = (event) => {
      if (event.key === "Escape") setOpenMenuId(null)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [openMenuId])

  const fetchQuotations = async () => {
    try {
      setLoading(true)
      const data = await adminAPI.getQuotations()
      setQuotations(Array.isArray(data) ? data : [])
      setError("")
    } catch (e) {
      setError(e?.message || "Failed to load quotations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotations()
  }, [])

  const replaceRow = (updated) =>
    setQuotations((prev) => prev.map((q) => (q._id === updated._id ? { ...q, ...updated } : q)))

  // Hold parks a document; releasing puts it back in the working pile. Neither
  // touches the Orders queues.
  const changeStatus = async (quotation, nextStatus) => {
    try {
      setBusyId(quotation._id)
      setError("")
      // Hold and Release are internal bookkeeping. The customer is never mailed
      // about them, so there is nothing to ask.
      const updated = await adminAPI.setQuotationStatus(quotation._id, nextStatus)
      replaceRow(updated)
    } catch (e) {
      setError(e?.message || "Could not change the status. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  // Deleting is a soft delete server-side, but it is still a document disappearing
  // from the list, so it is confirmed first and names what is going.
  const deleteQuotation = async (quotation) => {
    const ref = `#${String(quotation._id).slice(-6)}`
    const who = quotation.shippingAddress?.name || quotation.shippingAddress?.fullName || "this customer"
    if (!window.confirm(`Delete quotation ${ref} for ${who}? It will be removed from this list.`)) return

    try {
      setBusyId(quotation._id)
      setError("")
      await adminAPI.deleteQuotation(quotation._id)
      setQuotations((prev) => prev.filter((q) => q._id !== quotation._id))
    } catch (e) {
      setError(e?.message || "Could not delete this quotation. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  // The one door into the Orders section. Until this runs, nothing created on
  // the Create Order/Quotation screen is visible to the warehouse.
  const moveToOrders = async (quotation) => {
    const who = quotation.shippingAddress?.name || "this customer"
    if (
      !window.confirm(
        `Move #${quotation._id.slice(-6)} for ${who} into Orders?\n\n` +
          `It will appear in New Orders at ${formatPrice(quotation.totalPrice)} and can be fulfilled. ` +
          `This cannot be undone.`,
      )
    ) {
      return
    }

    try {
      setBusyId(quotation._id)
      setError("")
      const sendCustomerEmail = await askToEmailCustomer("Moved to Orders", quotation)
      const response = await adminAPI.convertQuotation(quotation._id, { sendCustomerEmail })
      replaceRow(response?.quotation || { ...quotation, quotationStatus: "Converted" })
    } catch (e) {
      setError(e?.message || "Could not move this document to Orders. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return quotations.filter((it) => {
      const status = it.quotationStatus || "Draft"
      if (statusFilter !== "all" && status !== statusFilter) return false
      if (!q) return true
      const id = it._id?.slice?.(-6)?.toLowerCase?.() || ""
      const name = orderCustomerName(it).toLowerCase()
      const email = orderCustomerEmail(it).toLowerCase()
      return id.includes(q) || name.includes(q) || email.includes(q)
    })
  }, [quotations, search, statusFilter])

  const countFor = (tabId) =>
    tabId === "all"
      ? quotations.length
      : quotations.filter((q) => (q.quotationStatus || "Draft") === tabId).length

  return (
    <div className="ml-64 p-6">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">Recent Quotation</h1>
        <button
          onClick={fetchQuotations}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Everything created on the Create Order/Quotation screen is held here. Use{" "}
        <span className="font-medium">Move to Orders</span> when a document is ready to be fulfilled.
      </p>

      {error && <div className="mb-4 bg-red-50 text-red-700 p-3 rounded">{error}</div>}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex rounded-md border overflow-hidden text-sm">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-2 ${
                statusFilter === tab.id ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab.label} ({countFor(tab.id)})
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quotation #, customer, email"
            className="pl-9 pr-3 py-2 border rounded w-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading quotations...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Quotation ID</th>
                <th className="px-4 py-3 text-left">Created as</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const status = q.quotationStatus || "Draft"
                const isConverted = status === "Converted"
                const busy = busyId === q._id
                return (
                  <tr key={q._id} className="border-t">
                    <td className="px-4 py-3 font-medium text-blue-700">#{q._id.slice(-6)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                        {q.stagedAs === "order" ? "Order" : "Quotation"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>{orderCustomerName(q) || "N/A"}</div>
                      <div className="text-gray-500">{orderCustomerEmail(q) || "N/A"}</div>
                      {orderPickupBranch(q) && (
                        <div className="mt-0.5 text-xs text-gray-500">Collect: {orderPickupBranch(q)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${statusChipClass(status)}`}>
                        {statusLabel(status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{new Date(q.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(q.totalPrice)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedQuotation(q)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                        >
                          <Eye size={16} /> View
                        </button>

                        {/* Everything that changes the document sits behind one menu, so a
                            long row of links cannot be clicked by accident. */}
                        <div className="relative" data-row-menu>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === q._id ? null : q._id)}
                            disabled={busy}
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === q._id}
                            title="More actions"
                            className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          {openMenuId === q._id && (
                            <div
                              role="menu"
                              className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-left shadow-lg"
                            >
                              <button
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  navigate(`/admin/orders/create?id=${q._id}`)
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <PencilLine size={15} className="text-blue-600" />
                                {isConverted ? "Edit" : "Recall"}
                              </button>

                              {!isConverted && (
                                <>
                                  {status === "Hold" ? (
                                    <button
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        changeStatus(q, "Draft")
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      <PlayCircle size={15} className="text-gray-700" />
                                      Release
                                    </button>
                                  ) : (
                                    <button
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenMenuId(null)
                                        changeStatus(q, "Hold")
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      <PauseCircle size={15} className="text-orange-600" />
                                      Hold
                                    </button>
                                  )}

                                  <button
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      moveToOrders(q)
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <ArrowRightCircle size={15} className="text-lime-700" />
                                    Move to Orders
                                  </button>
                                </>
                              )}

                              <div className="my-1 border-t border-gray-100" />

                              <button
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  deleteQuotation(q)
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={15} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-500">
                    {statusFilter === "all"
                      ? "No quotations found."
                      : `Nothing ${statusFilter === "Hold" ? "on hold" : statusLabel(statusFilter).toLowerCase()}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedQuotation && (
        <AdminOrderDetailsModal
          isOpen={!!selectedQuotation}
          order={selectedQuotation}
          onClose={() => setSelectedQuotation(null)}
          isQuotation={true}
          onUpdate={(updatedQuotation) => {
            replaceRow(updatedQuotation)
            if (selectedQuotation && selectedQuotation._id === updatedQuotation._id) {
              setSelectedQuotation(updatedQuotation)
            }
          }}
        />
      )}
    </div>
  )
}
