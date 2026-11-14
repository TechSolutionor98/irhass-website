import React, { useState, useEffect, useCallback } from "react"
import axios from "axios"
import {
  Bell,
  Search,
  RefreshCw,
  Download,
  CheckCircle,
  Clock,
  Trash2,
  ExternalLink,
  MessageCircle,
  Mail,
  Phone,
  Send,
  Check,
  X,
  Package,
} from "lucide-react"

import AdminSidebar from "../../components/admin/AdminSidebar"
import ConfirmDialog from "../../components/admin/ConfirmDialog"
import config from "../../config/config"
import { useToast } from "../../context/ToastContext"
import { getFullImageUrl } from "../../utils/imageUtils"

const AdminNotifyMe = () => {
  const { showToast } = useToast()

  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, pending: 0, notified: 0 })
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // all | pending | notified
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Action states
  const [busyId, setBusyId] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, item: null })
  const [emailDialog, setEmailDialog] = useState({ isOpen: false, item: null })

  // Fetch subscriptions from backend
  const fetchSubscriptions = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("adminToken")
      const params = new URLSearchParams()
      if (search.trim()) params.append("search", search.trim())
      if (statusFilter !== "all") params.append("status", statusFilter)
      params.append("page", page.toString())
      params.append("limit", "25")

      const res = await axios.get(
        `${config.API_URL}/api/back-in-stock/admin/list?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )

      if (res.data) {
        setSubscriptions(res.data.subscriptions || [])
        setTotalCount(res.data.total || 0)
        setTotalPages(res.data.pages || 1)
        if (res.data.stats) {
          setStats(res.data.stats)
        }
      }
    } catch (err) {
      console.error("Error fetching subscriptions:", err)
      showToast(err.response?.data?.message || "Failed to load subscriptions", "error")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page, showToast])

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  // Handle Search Input Debounce or Enter
  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    fetchSubscriptions()
  }

  // Toggle Notified Status
  const handleToggleStatus = async (item) => {
    try {
      setBusyId(item._id)
      const token = localStorage.getItem("adminToken")
      const res = await axios.patch(
        `${config.API_URL}/api/back-in-stock/admin/${item._id}/status`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )

      showToast(res.data?.message || "Status updated", "success")
      setSubscriptions((prev) =>
        prev.map((s) => (s._id === item._id ? { ...s, notified: !s.notified, notifiedAt: !s.notified ? new Date() : null } : s)),
      )
      fetchSubscriptions()
    } catch (err) {
      console.error("Error toggling status:", err)
      showToast(err.response?.data?.message || "Failed to update status", "error")
    } finally {
      setBusyId(null)
    }
  }

  // Manually Dispatch Restock Alert Email
  const handleSendEmail = async () => {
    const item = emailDialog.item
    if (!item) return

    try {
      setBusyId(item._id)
      const token = localStorage.getItem("adminToken")
      const res = await axios.post(
        `${config.API_URL}/api/back-in-stock/admin/${item._id}/send-email`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      )

      showToast(res.data?.message || `Email sent to ${item.email}`, "success")
      setSubscriptions((prev) =>
        prev.map((s) => (s._id === item._id ? { ...s, notified: true, notifiedAt: new Date() } : s)),
      )
      fetchSubscriptions()
    } catch (err) {
      console.error("Error sending email:", err)
      showToast(err.response?.data?.message || "Failed to send email alert", "error")
    } finally {
      setBusyId(null)
      setEmailDialog({ isOpen: false, item: null })
    }
  }

  // Delete Subscription
  const handleDelete = async () => {
    const item = deleteDialog.item
    if (!item) return

    try {
      setBusyId(item._id)
      const token = localStorage.getItem("adminToken")
      await axios.delete(`${config.API_URL}/api/back-in-stock/admin/${item._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      showToast("Subscription deleted successfully", "success")
      setSubscriptions((prev) => prev.filter((s) => s._id !== item._id))
      fetchSubscriptions()
    } catch (err) {
      console.error("Error deleting subscription:", err)
      showToast(err.response?.data?.message || "Failed to delete subscription", "error")
    } finally {
      setBusyId(null)
      setDeleteDialog({ isOpen: false, item: null })
    }
  }

  // Direct WhatsApp Chat with Pre-filled message from Admin/Company to Customer
  const handleOpenWhatsApp = (item) => {
    const rawPhone = item.phone || ""
    const cleanPhone = config.formatWhatsAppNumber
      ? config.formatWhatsAppNumber(rawPhone)
      : String(rawPhone).replace(/\D/g, "")

    if (!cleanPhone || cleanPhone.length < 7) {
      showToast("No valid WhatsApp number provided for this customer.", "error")
      return
    }

    const liveBase = (config.SITE_URL || "https://irhaas.com").replace(/\/$/, "")
    const productSlug = item.product?.slug || item.metadata?.slug || item.product?._id || item.product
    const productUrl = `${liveBase}/product/${encodeURIComponent(productSlug)}`
    const productName = item.product?.name || item.metadata?.productName || "Product"
    const priceText = item.product?.price ?? item.metadata?.productPrice ?? ""

    const messageLines = [
      `🌟 *IRHA'S WARDROBE — RESTOCK ALERT*`,
      `*اسٹاک الرٹ — ارہا'ز وارڈروب*`,
      `----------------------------------------`,
      `Assalam-o-Alaikum / Hello *${item.name || "Customer"}*,`,
      ``,
      `Good news! The item you were waiting for is now *BACK IN STOCK*! ✨`,
      `خوشخبری! آپ کی مطلوبہ پروڈکٹ دوبارہ اسٹاک میں دستیاب ہے!`,
      ``,
      `🛍️ *Product / پروڈکٹ:* ${productName}`,
      `📏 *Size / سائز:* ${item.size || "Standard / Available"}`,
      priceText ? `💰 *Price / قیمت:* ${priceText} Rs` : null,
      ``,
      `🔗 *Order Link / آرڈر کا لنک:*`,
      `${productUrl}`,
      ``,
      `Stock is limited, order now before it sells out again!`,
      `اسٹاک محدود ہے، ختم ہونے سے پہلے ابھی آرڈر کریں۔ شکریہ!`,
      `----------------------------------------`,
      `*Irha's Wardrobe Customer Support*`,
    ].filter(Boolean)

    const message = messageLines.join("\n")
    const waUrl = config.getWhatsAppUrl
      ? config.getWhatsAppUrl(message, cleanPhone)
      : `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`

    window.open(waUrl, "_blank")
  }

  // Export to CSV
  const handleExportCsv = () => {
    if (!subscriptions.length) {
      showToast("No data to export", "info")
      return
    }

    const headers = ["Customer Name", "Email", "WhatsApp Phone", "Product Name", "Size", "Price", "Status", "Date Requested", "Date Notified"]
    const rows = subscriptions.map((s) => [
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${(s.email || "").replace(/"/g, '""')}"`,
      `"${(s.phone || "").replace(/"/g, '""')}"`,
      `"${(s.product?.name || s.metadata?.productName || "").replace(/"/g, '""')}"`,
      `"${(s.size || "All").replace(/"/g, '""')}"`,
      `"${s.product?.price || s.metadata?.productPrice || 0}"`,
      `"${s.notified ? "Notified" : "Pending"}"`,
      `"${s.createdAt ? new Date(s.createdAt).toLocaleString("en-PK") : ""}"`,
      `"${s.notifiedAt ? new Date(s.notifiedAt).toLocaleString("en-PK") : ""}"`,
    ])

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Notify_Me_Subscribers_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast("CSV exported successfully", "success")
  }

  const liveBase = (config.SITE_URL || "https://irhaas.com").replace(/\/$/, "")

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />

      {/* Main content shifted by ml-64 to sit right beside AdminSidebar */}
      <div className="ml-64 p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-sm">
              <Bell size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                Notify Me / Restock Alerts
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Track and manage customers waiting for out-of-stock products & sizes
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchSubscriptions}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={handleExportCsv}
              disabled={!subscriptions.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-gray-800 active:scale-95 disabled:opacity-50"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Alerts</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                <Bell size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              <span className="text-xs text-gray-400">all-time requests</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Pending Alerts</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-900">{stats.pending}</span>
              <span className="text-xs text-amber-700">waiting for stock</span>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Notified / Sent</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <CheckCircle size={16} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-900">{stats.notified}</span>
              <span className="text-xs text-emerald-700">alerts dispatched</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "All Alerts", count: stats.total },
                { key: "pending", label: "Pending (Waiting)", count: stats.pending },
                { key: "notified", label: "Notified (Sent)", count: stats.notified },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setStatusFilter(tab.key)
                    setPage(1)
                  }}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    statusFilter === tab.key
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-80">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, email, phone, product..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-8 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("")
                      setPage(1)
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="rounded-lg bg-gray-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        {/* Data Table Container */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
              <p className="text-xs text-gray-500">Loading subscriptions...</p>
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-3">
                <Bell size={24} />
              </div>
              <h3 className="text-sm font-bold text-gray-800">No Notify Me Alerts Found</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                {search || statusFilter !== "all"
                  ? "No subscriptions matched your active filters. Try clearing search or status filter."
                  : "Customers who click 'Notify Me' on out-of-stock items will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                  <tr>
                    <th className="px-5 py-3.5 min-w-[220px]">Customer</th>
                    <th className="px-5 py-3.5 min-w-[220px]">Product</th>
                    <th className="px-4 py-3.5 min-w-[130px] whitespace-nowrap">Requested Size</th>
                    <th className="px-4 py-3.5 min-w-[130px] whitespace-nowrap">Current Stock</th>
                    <th className="px-4 py-3.5 min-w-[120px] whitespace-nowrap">Date</th>
                    <th className="px-4 py-3.5 min-w-[110px] whitespace-nowrap">Status</th>
                    <th className="px-5 py-3.5 min-w-[160px] text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {subscriptions.map((sub) => {
                    const productSlug = sub.product?.slug || sub.metadata?.slug || sub.product?._id || sub.product
                    const productUrl = `${liveBase}/product/${encodeURIComponent(productSlug)}`
                    const img = sub.product?.image || sub.metadata?.productImage || ""
                    const productName = sub.product?.name || sub.metadata?.productName || "Product"
                    const price = sub.product?.price ?? sub.metadata?.productPrice ?? 0

                    // Check live stock status if product populated
                    let isStockAvailable = false
                    if (sub.product) {
                      if (sub.size && Array.isArray(sub.product.sizes) && sub.product.sizes.length > 0) {
                        const cleanSubSize = String(sub.size).trim().toLowerCase()
                        const match = sub.product.sizes.find(
                          (s) =>
                            (s.code && String(s.code).trim().toLowerCase() === cleanSubSize) ||
                            (s.name && String(s.name).trim().toLowerCase() === cleanSubSize),
                        )
                        isStockAvailable = match && Number(match.countInStock) > 0
                      } else {
                        isStockAvailable =
                          sub.product.stockStatus === "In Stock" || Number(sub.product.countInStock) > 0
                      }
                    }

                    return (
                      <tr key={sub._id} className="transition hover:bg-gray-50/70">
                        {/* Customer Info */}
                        <td className="px-5 py-4 min-w-[220px]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800 shadow-sm">
                              {(sub.name || sub.email || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 text-xs truncate max-w-[170px]">
                                {sub.name || "Customer"}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                                <Mail size={12} className="text-gray-400 flex-shrink-0" />
                                <span className="truncate max-w-[170px]" title={sub.email}>{sub.email}</span>
                              </div>
                              {sub.phone && (
                                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 mt-0.5">
                                  <Phone size={11} className="flex-shrink-0 text-emerald-600" />
                                  <span>{sub.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Product Info */}
                        <td className="px-5 py-4 min-w-[220px]">
                          <div className="flex items-center gap-3">
                            {img ? (
                              <img
                                src={getFullImageUrl(img)}
                                alt={productName}
                                className="h-12 w-9 rounded border border-gray-200 object-cover flex-shrink-0 shadow-sm"
                              />
                            ) : (
                              <div className="flex h-12 w-9 items-center justify-center rounded border border-gray-200 bg-gray-100 text-gray-400 flex-shrink-0">
                                <Package size={16} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <a
                                href={productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-gray-900 hover:text-brand-600 flex items-center gap-1 text-xs"
                                title="Open live product page"
                              >
                                <span className="truncate max-w-[170px]">{productName}</span>
                                <ExternalLink size={11} className="text-gray-400 flex-shrink-0" />
                              </a>
                              <div className="text-[11px] font-bold text-amber-800 mt-0.5">
                                {price} Rs
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Requested Size */}
                        <td className="px-4 py-4 whitespace-nowrap min-w-[130px]">
                          {sub.size ? (
                            <span className="inline-flex items-center rounded-md bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-800 border border-stone-200 shadow-sm">
                              Size: {sub.size}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">All / Any Size</span>
                          )}
                        </td>

                        {/* Current Stock */}
                        <td className="px-4 py-4 whitespace-nowrap min-w-[130px]">
                          {isStockAvailable ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              In Stock Now
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              Out of Stock
                            </span>
                          )}
                        </td>

                        {/* Date Requested */}
                        <td className="px-4 py-4 whitespace-nowrap text-gray-500 text-xs min-w-[120px]">
                          <div className="font-medium text-gray-800">
                            {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {sub.createdAt ? new Date(sub.createdAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" }) : ""}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 whitespace-nowrap min-w-[110px]">
                          {sub.notified ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                                <Check size={12} strokeWidth={3} />
                                Notified
                              </span>
                              {sub.notifiedAt && (
                                <div className="text-[10px] text-gray-400 mt-0.5">
                                  {new Date(sub.notifiedAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short" })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                              <Clock size={12} strokeWidth={2.5} />
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 whitespace-nowrap text-right min-w-[160px]">
                          <div className="flex items-center justify-end gap-2">
                            {/* WhatsApp Direct Chat Button */}
                            {sub.phone && (
                              <button
                                type="button"
                                onClick={() => handleOpenWhatsApp(sub)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition shadow-sm border border-emerald-200"
                                title="Open WhatsApp Chat with Customer"
                              >
                                <MessageCircle size={15} />
                              </button>
                            )}

                            {/* Send Email Alert Button */}
                            <button
                              type="button"
                              onClick={() => setEmailDialog({ isOpen: true, item: sub })}
                              disabled={busyId === sub._id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-200 disabled:opacity-50"
                              title="Send Restock Email Alert Now"
                            >
                              <Send size={14} />
                            </button>

                            {/* Toggle Status (Mark as Notified / Pending) */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(sub)}
                              disabled={busyId === sub._id}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition shadow-sm disabled:opacity-50 ${
                                sub.notified
                                  ? "border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                              }`}
                              title={sub.notified ? "Mark as Pending" : "Mark as Notified"}
                            >
                              <Check size={14} strokeWidth={sub.notified ? 2 : 3} />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setDeleteDialog({ isOpen: true, item: sub })}
                              disabled={busyId === sub._id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition shadow-sm border border-red-200 disabled:opacity-50"
                              title="Delete Alert"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && subscriptions.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-5 py-3.5 text-xs">
              <span className="text-gray-500">
                Page <span className="font-semibold text-gray-900">{page}</span> of{" "}
                <span className="font-semibold text-gray-900">{totalPages}</span> ({totalCount} total alerts)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 px-3.5 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 px-3.5 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Delete */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, item: null })}
        onConfirm={handleDelete}
        title="Delete Restock Alert?"
        message={`Are you sure you want to delete the restock alert for "${deleteDialog.item?.name || deleteDialog.item?.email}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />

      {/* Confirmation Dialog for Sending Email Alert */}
      <ConfirmDialog
        isOpen={emailDialog.isOpen}
        onClose={() => setEmailDialog({ isOpen: false, item: null })}
        onConfirm={handleSendEmail}
        title="Send Restock Email Alert?"
        message={`Send official "Back in Stock" email alert to ${emailDialog.item?.email} for "${emailDialog.item?.product?.name || emailDialog.item?.metadata?.productName}"?`}
        confirmText="Send Email"
        type="info"
      />
    </div>
  )
}

export default AdminNotifyMe
