"use client"

import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import AdminOrderDetailsModal from "../../components/admin/AdminOrderDetailsModal"
import AdminSidebar from "../../components/admin/AdminSidebar"
import { Search, Eye, Mail, PencilLine, ChevronDown, RefreshCw, X } from "lucide-react"
import config from "../../config/config"
import { getOrderCountryName, formatOrderPrice } from "../../utils/paymentUtils"
import { askToEmailCustomer, askToEmailCustomerBulk } from "../../utils/customerEmail"
import { orderCustomerName, orderCustomerEmail, orderCustomerPhone, orderPickupBranch } from "../../utils/orderCustomer"

// Every status an order can be moved to. Wider than the tab list below on
// purpose: an order can be sent to Shipped or Returned even though neither has
// a tab of its own, and it is then found under All.
const ORDER_STATUS_OPTIONS = [
  "New",
  "Processing",
  "Confirmed",
  "Ready for Shipment",
  "Shipped",
  "On the Way",
  "Out for Delivery",
  "Delivered",
  "On Hold",
  "Cancelled",
  "Returned",
  "Deleted",
]

const PAYMENT_STATUS_OPTIONS = ["Paid", "Unpaid"]

const sameStatus = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase()

// What was actually ordered, for the line under the order id.
//
// Buyer protection is sold as its own line but is never what the order is
// about, so it is skipped -- an order whose first row reads "Buyer Protection"
// tells the office nothing. Only the first real product is named; the rest are
// counted, because the column has room for one name and not for five.
const orderSummaryItem = (order = {}) => {
  const items = (order.orderItems || []).filter((item) => !item?.isProtection)
  const first = items[0]
  if (!first) return null

  return {
    name: first.name || first.product?.name || "Unnamed product",
    sku: first.product?.sku || first.sku || "",
    extra: items.length - 1,
  }
}

// The tabs that replaced the ten separate pages. `match` decides which orders a
// tab shows, so a tab can be broader than one stored value -- New also picks up
// the legacy "Pending" and orders saved before status was required.
const TABS = [
  {
    id: "all",
    label: "All Orders",
    // Deleted orders are kept out of All, the way the old All Orders page did:
    // they are in the bin, not in the workload.
    match: (o) => !sameStatus(o.status, "Deleted"),
  },
  { id: "New", label: "New", match: (o) => !o.status || sameStatus(o.status, "New") || sameStatus(o.status, "Pending") },
  { id: "Confirmed", label: "Confirmed", match: (o) => sameStatus(o.status, "Confirmed") },
  { id: "Processing", label: "Processing", match: (o) => sameStatus(o.status, "Processing") },
  { id: "Ready for Shipment", label: "Ready for Shipment", match: (o) => sameStatus(o.status, "Ready for Shipment") },
  { id: "On the Way", label: "On the Way", match: (o) => sameStatus(o.status, "On the Way") },
  { id: "Delivered", label: "Delivered", match: (o) => sameStatus(o.status, "Delivered") },
  { id: "On Hold", label: "On Hold", match: (o) => sameStatus(o.status, "On Hold") },
  { id: "Cancelled", label: "Cancelled", match: (o) => sameStatus(o.status, "Cancelled") },
  { id: "Deleted", label: "Deleted", match: (o) => sameStatus(o.status, "Deleted") },
]

const statusChipClass = (status) => {
  if (sameStatus(status, "Processing")) return "bg-yellow-100 text-yellow-800"
  if (sameStatus(status, "Confirmed")) return "bg-lime-100 text-lime-800"
  if (sameStatus(status, "Ready for Shipment")) return "bg-cyan-100 text-cyan-800"
  if (sameStatus(status, "Shipped")) return "bg-purple-100 text-purple-800"
  if (sameStatus(status, "On the Way")) return "bg-blue-100 text-blue-800"
  if (sameStatus(status, "Out for Delivery")) return "bg-indigo-100 text-indigo-800"
  if (sameStatus(status, "Delivered")) return "bg-green-100 text-green-800"
  if (sameStatus(status, "On Hold")) return "bg-orange-100 text-orange-800"
  if (sameStatus(status, "Cancelled")) return "bg-red-100 text-red-800"
  if (sameStatus(status, "Returned")) return "bg-rose-100 text-rose-800"
  if (sameStatus(status, "Deleted")) return "bg-gray-200 text-gray-700"
  return "bg-gray-100 text-gray-800"
}

const getToken = () =>
  localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")

/**
 * The orders screen. Retail by default; `wholesale` shows the orders raised from
 * quotations instead. The two lists are mutually exclusive server-side, so the same
 * screen can serve both without either showing the other's rows.
 */
export default function Orders({ wholesale = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [processingAction, setProcessingAction] = useState(false)
  const [showPaymentDropdown, setShowPaymentDropdown] = useState({})

  // Bulk selection
  const [selectedOrders, setSelectedOrders] = useState([])
  const [bulkStatus, setBulkStatus] = useState("")

  // The open tab lives in the URL, so a tab can be linked to, survives a
  // refresh, and the browser's back button steps between tabs.
  const requestedTab = searchParams.get("status")
  const activeTab = TABS.some((tab) => tab.id === requestedTab) ? requestedTab : "all"

  const selectTab = (tabId) => {
    setSelectedOrders([])
    setBulkStatus("")
    const next = new URLSearchParams(searchParams)
    if (tabId === "all") next.delete("status")
    else next.set("status", tabId)
    setSearchParams(next, { replace: true })
  }

  // One fetch covers every tab, because the tabs are a filter over the same
  // list. Deleted orders are asked for too, so the Deleted tab has something to
  // show without a second request.
  const fetchOrders = async () => {
    try {
      setLoading(true)
      const token = getToken()
      if (!token) {
        setError("Authentication token not found. Please login again.")
        setLoading(false)
        return
      }

      const { data } = await axios.get(`${config.API_URL}/api/admin/orders`, {
        params: { includeDeleted: true, ...(wholesale ? { wholesale: true } : {}) },
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      })

      setOrders(Array.isArray(data) ? data : data?.orders || [])
      setError(null)
    } catch (e) {
      console.error("[orders] fetch error:", e)
      setError("Failed to load orders: " + (e.response?.data?.message || e.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    // Refetch if the screen is reused for the other list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wholesale])

  // Notifications elsewhere in the admin link straight to one order.
  useEffect(() => {
    const focusId = location.state?.orderId
    if (!focusId || orders.length === 0) return
    const match = orders.find((o) => o._id === focusId)
    if (match) setSelectedOrder(match)
  }, [location.state?.orderId, orders])

  useEffect(() => {
    const closeDropdowns = () => setShowPaymentDropdown({})
    document.addEventListener("click", closeDropdowns)
    return () => document.removeEventListener("click", closeDropdowns)
  }, [])

  const counts = useMemo(() => {
    const result = {}
    for (const tab of TABS) result[tab.id] = orders.filter(tab.match).length
    return result
  }, [orders])

  const tabOrders = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab) || TABS[0]
    return orders.filter(tab.match)
  }, [orders, activeTab])

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return tabOrders
    return tabOrders.filter((order) => {
      const id = order._id?.toLowerCase?.() || ""
      const tracking = order.trackingId?.toLowerCase?.() || ""
      const name = orderCustomerName(order).toLowerCase()
      const email = orderCustomerEmail(order).toLowerCase()
      const phone = orderCustomerPhone(order).toLowerCase()
      return id.includes(q) || tracking.includes(q) || name.includes(q) || email.includes(q) || phone.includes(q)
    })
  }, [tabOrders, searchTerm])

  const allVisibleSelected = filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length

  const replaceOrder = (orderId, patch) => {
    setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, ...patch } : o)))
    setSelectedOrder((prev) => (prev && prev._id === orderId ? { ...prev, ...patch } : prev))
  }

  const handleUpdateStatus = async (orderId, status) => {
    try {
      setProcessingAction(true)
      // The status change is saved either way; this only decides whether the
      // customer hears about it.
      const targetOrder = orders.find((o) => o._id === orderId)
      const updateData = { status, sendCustomerEmail: await askToEmailCustomer(status, targetOrder) }

      if (sameStatus(status, "Delivered")) {
        updateData.isPaid = true
        updateData.paidAt = new Date().toISOString()
      }

      await axios.put(`${config.API_URL}/api/admin/orders/${orderId}/status`, updateData, {
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      })

      const { sendCustomerEmail, ...stored } = updateData
      replaceOrder(orderId, stored)
      setError(null)
    } catch (e) {
      console.error("[orders] status error:", e)
      setError("Failed to update order status: " + (e.response?.data?.message || e.message))
    } finally {
      setProcessingAction(false)
    }
  }

  const handleUpdatePaymentStatus = async (orderId, isPaid) => {
    try {
      setProcessingAction(true)
      const updateData = { isPaid, paidAt: isPaid ? new Date().toISOString() : null }

      await axios.put(`${config.API_URL}/api/admin/orders/${orderId}`, updateData, {
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      })

      replaceOrder(orderId, updateData)
      setShowPaymentDropdown({})
      setError(null)
    } catch (e) {
      console.error("[orders] payment error:", e)
      setError("Failed to update payment status: " + (e.response?.data?.message || e.message))
    } finally {
      setProcessingAction(false)
    }
  }

  const handleBulkStatusUpdate = async () => {
    if (selectedOrders.length === 0 || !bulkStatus) return

    try {
      setProcessingAction(true)
      // Asked once for the whole batch rather than once per order, so a bulk
      // update of fifty orders is one question, not fifty.
      const notifyBulk = await askToEmailCustomerBulk(bulkStatus, selectedOrders.length)
      const token = getToken()

      await Promise.all(
        selectedOrders.map((orderId) =>
          axios.put(
            `${config.API_URL}/api/admin/orders/${orderId}/status`,
            { status: bulkStatus, sendCustomerEmail: notifyBulk },
            { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
          ),
        ),
      )

      setOrders((prev) =>
        prev.map((o) => (selectedOrders.includes(o._id) ? { ...o, status: bulkStatus } : o)),
      )
      setSelectedOrders([])
      setBulkStatus("")
      setError(null)
    } catch (e) {
      console.error("[orders] bulk error:", e)
      setError("Failed to update orders: " + (e.response?.data?.message || e.message))
    } finally {
      setProcessingAction(false)
    }
  }

  const toggleSelectAll = () => {
    setSelectedOrders(allVisibleSelected ? [] : filteredOrders.map((o) => o._id))
  }

  const toggleSelectOrder = (orderId) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId],
    )
  }

  const activeLabel = (TABS.find((t) => t.id === activeTab) || TABS[0]).label

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="p-8 ml-64">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{wholesale ? "Wholesale Orders" : "Orders"}</h1>
            <p className="text-gray-600 mt-1">Every order in one place. Switch status with the tabs below.</p>
          </div>
          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-60"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Status tabs -- these replaced the ten separate sidebar pages. A
            segmented control rather than an underline: the counts carry real
            weight here, and a filled pill keeps the selected one obvious even
            when the bar has to scroll sideways. */}
        <div className="mb-6 -mx-1 overflow-x-auto px-1 pb-1">
          <div className="inline-flex min-w-max items-center gap-1 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-gray-200">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab
              const count = counts[tab.id] ?? 0
              const isEmpty = count === 0
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  className={`group flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1 ${
                    isActive
                      ? "bg-lime-500 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums transition-colors ${
                      isActive
                        ? "bg-white/25 text-white"
                        : isEmpty
                          // An empty queue should recede, so the eye lands on
                          // the tabs that actually have work waiting.
                          ? "bg-transparent text-gray-400"
                          : "bg-gray-100 text-gray-700 group-hover:bg-white"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-md flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={18} />
            </button>
          </div>
        )}

        {selectedOrders.length > 0 && (
          <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border-l-4 border-lime-500">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm font-medium text-gray-700">
                  {selectedOrders.length} order{selectedOrders.length !== 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Change status to:</label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
                  >
                    <option value="">Select Status</option>
                    {ORDER_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkStatusUpdate}
                    disabled={!bulkStatus || processingAction}
                    className="bg-lime-500 hover:bg-lime-600 disabled:bg-gray-400 text-white px-4 py-1 rounded-md text-sm font-medium transition-colors"
                  >
                    {processingAction ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedOrders([])
                  setBulkStatus("")
                }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-wrap justify-between items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by order ID, tracking, customer, email or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full md:w-96 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            />
          </div>
          <div className="text-sm text-gray-600">
            {activeLabel}: <span className="font-semibold text-lime-600">{filteredOrders.length}</span>
            {searchTerm.trim() && <span className="text-gray-400"> of {tabOrders.length}</span>}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lime-500" />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm" style={{ overflow: "visible" }}>
            <div className="overflow-x-auto" style={{ overflow: "visible" }}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-lime-500 focus:ring-lime-500 border-gray-300 rounded"
                        aria-label="Select all orders in this tab"
                      />
                    </th>
                    {["Order ID", "Customer", "Date", "Status", "Payment", "Total"].map((heading) => (
                      <th
                        key={heading}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {heading}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order._id}
                      className={`hover:bg-gray-50 ${selectedOrders.includes(order._id) ? "bg-lime-50" : ""}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order._id)}
                          onChange={() => toggleSelectOrder(order._id)}
                          className="h-4 w-4 text-lime-500 focus:ring-lime-500 border-gray-300 rounded"
                          aria-label={`Select order ${order._id.slice(-6)}`}
                        />
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="text-sm font-medium text-lime-600">#{order._id.slice(-6)}</div>
                        {order.trackingId && (
                          <div className="text-xs text-gray-500">{order.trackingId}</div>
                        )}
                        {/* What was ordered, capped at two lines so a long
                            laptop title cannot push every other row down the
                            page. The SKU sits under it because that is what
                            gets typed into the warehouse system. */}
                        {(() => {
                          const summary = orderSummaryItem(order)
                          if (!summary) return null

                          return (
                            <div className="mt-1.5 max-w-[220px]">
                              <p className="line-clamp-2 text-xs leading-snug text-gray-700" title={summary.name}>
                                {summary.name}
                              </p>
                              {summary.sku && (
                                <p className="mt-0.5 font-mono text-[11px] leading-tight text-gray-400">
                                  {summary.sku}
                                </p>
                              )}
                              {summary.extra > 0 && (
                                <p className="mt-0.5 text-[11px] leading-tight text-gray-400">
                                  +{summary.extra} more item{summary.extra > 1 ? "s" : ""}
                                </p>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* The customer first, whichever half of the order carries
                            them. The branch is extra detail, not a replacement for
                            knowing whose order it is. */}
                        <div className="text-sm text-gray-900">{orderCustomerName(order) || "N/A"}</div>
                        <div className="text-sm text-gray-500">
                          {orderCustomerEmail(order) || orderCustomerPhone(order) || "N/A"}
                        </div>
                        {orderPickupBranch(order) && (
                          <div className="text-xs text-gray-500">🏬 {orderPickupBranch(order)}</div>
                        )}
                        <span className="mt-1 inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 uppercase">
                          📍 {getOrderCountryName(order)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(order.createdAt).toLocaleDateString()}</div>
                        <div className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative inline-block text-left">
                          <button
                            className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full hover:opacity-80 transition-opacity ${statusChipClass(
                              order.status,
                            )}`}
                          >
                            {order.status || "New"}
                            <ChevronDown size={12} className="ml-1" />
                          </button>
                          <select
                            value={order.status || "New"}
                            onChange={(e) => handleUpdateStatus(order._id, e.target.value)}
                            disabled={processingAction}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            aria-label={`Change status of order ${order._id.slice(-6)}`}
                          >
                            {ORDER_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" style={{ overflow: "visible" }}>
                        <div style={{ position: "relative" }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowPaymentDropdown((prev) => ({ [order._id]: !prev[order._id] }))
                            }}
                            className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-80 transition-colors ${
                              order.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {order.isPaid ? "Paid" : "Unpaid"}
                            <ChevronDown size={12} className="ml-1" />
                          </button>

                          {showPaymentDropdown[order._id] && (
                            <div
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                marginTop: "4px",
                                width: "128px",
                                backgroundColor: "white",
                                border: "1px solid #e5e7eb",
                                borderRadius: "6px",
                                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                                zIndex: 9999,
                              }}
                            >
                              {PAYMENT_STATUS_OPTIONS.map((status) => (
                                <button
                                  key={status}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUpdatePaymentStatus(order._id, status === "Paid")
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                  disabled={processingAction}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                        {formatOrderPrice(order.totalPrice, order)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-lime-600 hover:text-lime-900 mr-4"
                          title="View order details"
                        >
                          <Eye size={18} />
                        </button>
                        {/* Opens the order on the Create Order/Quotation screen,
                            where every part of it -- customer, items, prices,
                            delivery -- can be changed. */}
                        <button
                          onClick={() => navigate(`/admin/orders/create?id=${order._id}`)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                          title="Edit this order"
                        >
                          <PencilLine size={18} />
                        </button>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-green-600 hover:text-green-900"
                          disabled={processingAction}
                          title="Message the customer"
                        >
                          <Mail size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredOrders.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg">
                  {searchTerm.trim() ? "No orders match that search" : `Nothing in ${activeLabel}`}
                </div>
                <p className="text-gray-400 mt-2">
                  {searchTerm.trim()
                    ? "Try a different order ID, name, email or phone number."
                    : "Orders will appear here as they reach this status."}
                </p>
              </div>
            )}
          </div>
        )}

        <AdminOrderDetailsModal
          isOpen={!!selectedOrder}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(updatedOrder) => replaceOrder(updatedOrder._id, updatedOrder)}
        />
      </div>
    </div>
  )
}
