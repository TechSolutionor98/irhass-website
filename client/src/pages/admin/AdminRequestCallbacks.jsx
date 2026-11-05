import { useEffect, useState, useMemo } from "react"
import { PhoneCall, Mail, MessageCircle, Package, Search, RefreshCw, Download, Check, X, Trash2, Ban, RotateCcw, Clock, Inbox, ExternalLink, AlertTriangle, MessageSquare } from "lucide-react"

import AdminSidebar from "../../components/admin/AdminSidebar"
import ConfirmDialog from "../../components/admin/ConfirmDialog"
import { apiRequest } from "../../services/api"
import { downloadCsv } from "../../utils/csvExport"
import { useToast } from "../../context/ToastContext"

// The job of this screen is to get somebody on the phone, so each request is laid out as a
// card with the contact actions on it rather than as a row in a table wide enough to need
// horizontal scrolling -- which is what buried the status and actions columns off-screen.

const STATUS_META = {
  pending: {
    label: "Pending",
    pill: "bg-amber-100 text-amber-800",
    avatar: "bg-amber-100 text-amber-700",
    accent: "border-l-amber-400",
  },
  done: {
    label: "Done",
    pill: "bg-green-100 text-green-700",
    avatar: "bg-green-100 text-green-700",
    accent: "border-l-green-400",
  },
  spam: {
    label: "Spam",
    pill: "bg-red-100 text-red-700",
    avatar: "bg-red-100 text-red-600",
    accent: "border-l-red-300",
  },
}

const metaFor = (status) => STATUS_META[status] || STATUS_META.pending

const formatDateTime = (value) => {
  if (!value) return "N/A"
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** "3 hours ago" -- how stale a callback is matters more here than the exact timestamp. */
const timeAgo = (value) => {
  if (!value) return ""
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ]
  for (const [name, size] of units) {
    const amount = Math.floor(seconds / size)
    if (amount >= 1) return `${amount} ${name}${amount > 1 ? "s" : ""} ago`
  }
  return "just now"
}

// Only digits survive, so a number stored as "+92 321 498 0835" still dials.
const dialable = (phone) => String(phone || "").replace(/[^\d+]/g, "")

// Spam submissions arrive with an essay in the phone field, and a tel: link built from
// that is useless. A number has to look like one before it is offered as a call button.
const isCallable = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "")
  return digits.length >= 7 && digits.length <= 15
}

const initialOf = (name) => String(name || "?").trim().charAt(0).toUpperCase() || "?"

const AdminRequestCallbacks = () => {
  const { showToast } = useToast()

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState(null)
  const [detailRequest, setDetailRequest] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("adminToken")
      const data = await apiRequest("/api/request-callback", {
        headers: { Authorization: `Bearer ${token}` },
      })
      setRequests(Array.isArray(data) ? data : [])
      setError(null)
    } catch {
      setError("Callback requests could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  useEffect(() => {
    if (!detailRequest) return
    const onKeyDown = (event) => {
      if (event.key === "Escape") setDetailRequest(null)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [detailRequest])

  const updateStatus = async (id, status) => {
    const previous = requests
    // Moved in the list straight away -- triaging a backlog one request at a time should
    // not mean waiting on a round trip between each -- and put back if the save fails.
    setRequests((prev) => prev.map((req) => (req._id === id ? { ...req, status } : req)))
    setBusyId(id)
    try {
      const token = localStorage.getItem("adminToken")
      await apiRequest(`/api/request-callback/${id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: { status },
      })
      setDetailRequest((current) => (current && current._id === id ? { ...current, status } : current))
      showToast(`Marked as ${metaFor(status).label.toLowerCase()}`, "success")
    } catch {
      setRequests(previous)
      showToast("Could not update the status. Please try again.", "error")
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    const id = deleteTarget?._id
    if (!id) return
    setDeleteTarget(null)
    setBusyId(id)
    try {
      const token = localStorage.getItem("adminToken")
      await apiRequest(`/api/request-callback/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      setRequests((prev) => prev.filter((req) => req._id !== id))
      // The detail modal may be showing the record that has just gone.
      setDetailRequest((current) => (current && current._id === id ? null : current))
      showToast("Callback request deleted", "success")
    } catch {
      showToast("Could not delete the request. Please try again.", "error")
    } finally {
      setBusyId(null)
    }
  }

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter((req) => req.status === "pending").length,
      done: requests.filter((req) => req.status === "done").length,
      spam: requests.filter((req) => req.status === "spam").length,
    }),
    [requests],
  )

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return requests
      .filter((req) => statusFilter === "all" || req.status === statusFilter)
      .filter((req) => {
        if (!term) return true
        // Everything a colleague might search by, including the note, so a request can be
        // found from whatever detail the caller happens to remember.
        return [req.name, req.email, req.phone, req.productName, req.customerNote]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term))
      })
  }, [requests, statusFilter, search])

  const handleDownloadCsv = () => {
    downloadCsv({
      // Exports what is on screen, so a filtered view can be handed over as-is.
      rows: visible,
      columns: [
        { header: "Name", accessor: (row) => row.name || "N/A" },
        { header: "Email", accessor: (row) => row.email || "N/A" },
        { header: "Phone", accessor: (row) => row.phone || "N/A" },
        { header: "Product Name", accessor: (row) => row.productName || "N/A" },
        { header: "Product Link", accessor: (row) => row.productLink || "N/A" },
        { header: "Customer Note", accessor: (row) => row.customerNote || "" },
        { header: "Status", accessor: (row) => row.status || "N/A" },
        { header: "Created At", accessor: (row) => formatDateTime(row.createdAt) },
      ],
      filename: "request-callbacks.csv",
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="ml-64 p-6 lg:p-8">
        {/* ---- Header ---- */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-lime-100 p-2.5">
              <PhoneCall className="h-6 w-6 text-lime-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Request Callbacks</h1>
              <p className="text-sm text-gray-500">Customers waiting for someone to call them back</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              disabled={visible.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={fetchRequests}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ---- Counts, which double as the filter ---- */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { key: "all", label: "All requests", value: counts.all, Icon: Inbox, tone: "text-gray-900" },
            { key: "pending", label: "Pending", value: counts.pending, Icon: Clock, tone: "text-amber-600" },
            { key: "done", label: "Done", value: counts.done, Icon: Check, tone: "text-green-600" },
            { key: "spam", label: "Spam", value: counts.spam, Icon: Ban, tone: "text-red-600" },
          ].map(({ key, label, value, Icon, tone }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-xl border p-4 text-left transition ${
                statusFilter === key
                  ? "border-lime-500 bg-lime-50 ring-1 ring-lime-500"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
            </button>
          ))}
        </div>

        {/* ---- Search ---- */}
        <div className="mb-5 relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, product or note"
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>

        {/* ---- Body ---- */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex gap-4">
                  <div className="h-11 w-11 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded bg-gray-200" />
                    <div className="h-3 w-64 rounded bg-gray-100" />
                    <div className="h-3 w-52 rounded bg-gray-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <p className="font-semibold text-red-800">{error}</p>
                <button onClick={fetchRequests} className="mt-1 text-sm font-medium text-red-700 underline">
                  Try again
                </button>
              </div>
            </div>
          </div>
        ) : visible.length === 0 ? (
          // An empty shelf and an empty search result need different answers.
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <Inbox className="mx-auto h-10 w-10 text-gray-300" />
            {requests.length === 0 ? (
              <>
                <p className="mt-3 font-semibold text-gray-800">No callback requests yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Requests appear here as soon as a customer asks to be called back.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 font-semibold text-gray-800">Nothing matches this view</p>
                <p className="mt-1 text-sm text-gray-500">Try another search, or switch the filter above.</p>
                <button
                  onClick={() => {
                    setSearch("")
                    setStatusFilter("all")
                  }}
                  className="mt-3 text-sm font-medium text-lime-700 underline"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((req) => {
              const meta = metaFor(req.status)
              const note = req.customerNote || ""
              const callable = isCallable(req.phone)

              return (
                <div
                  key={req._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailRequest(req)}
                  onKeyDown={(e) => {
                    // Reachable by keyboard, since the whole card is the control now.
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setDetailRequest(req)
                    }
                  }}
                  className={`cursor-pointer rounded-xl border border-l-4 border-gray-200 bg-white p-5 text-left transition hover:border-gray-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-lime-500 ${meta.accent} ${
                    busyId === req._id ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* ---- Who, and how to reach them ---- */}
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${meta.avatar}`}
                      >
                        {initialOf(req.name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-gray-900">{req.name || "Unknown"}</h3>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.pill}`}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-gray-400" title={formatDateTime(req.createdAt)}>
                            {timeAgo(req.createdAt)}
                          </span>
                        </div>

                        {/* The actual point of the page: one tap to make contact. */}
                        <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {callable ? (
                            <>
                              <a
                                href={`tel:${dialable(req.phone)}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800"
                              >
                                <PhoneCall className="h-3.5 w-3.5" />
                                {req.phone}
                              </a>
                              <a
                                href={`https://wa.me/${dialable(req.phone).replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                WhatsApp
                              </a>
                            </>
                          ) : (
                            // Not a phone number. Shown as plain text, because a call
                            // button built from it would only ever fail.
                            <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
                              <PhoneCall className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{req.phone || "No phone given"}</span>
                            </span>
                          )}

                          {req.email && (
                            <a
                              href={`mailto:${req.email}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              {req.email}
                            </a>
                          )}
                        </div>

                        {/* A request with no product came from the Contact Us page rather
                            than a product page. Saying so beats rendering nothing, which
                            reads as missing data. */}
                        {!req.productName && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-sm text-gray-400">
                            <MessageSquare className="h-4 w-4 shrink-0" />
                            <span>General enquiry &mdash; no product attached</span>
                          </div>
                        )}

                        {req.productName && (
                          <div className="mt-2.5 flex items-start gap-1.5 text-sm">
                            <Package className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                            <span className="text-gray-700">
                              {req.productName}
                              {req.productLink && (
                                <a
                                  href={req.productLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                                >
                                  View
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </span>
                          </div>
                        )}

                        {note && (
                          <div className="mt-3 rounded-lg border-l-2 border-gray-300 bg-gray-50 px-3 py-2">
                            <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                              {note}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ---- Triage ---- */}
                    {/* Stops the card's own click, so triaging in place never also opens
                        the modal. */}
                    <div
                      className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-stretch"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {req.status !== "done" && (
                        <button
                          onClick={() => updateStatus(req._id, "done")}
                          disabled={busyId === req._id}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Mark done
                        </button>
                      )}
                      {req.status !== "spam" && (
                        <button
                          onClick={() => updateStatus(req._id, "spam")}
                          disabled={busyId === req._id}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Spam
                        </button>
                      )}
                      {req.status !== "pending" && (
                        <button
                          onClick={() => updateStatus(req._id, "pending")}
                          disabled={busyId === req._id}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reopen
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteTarget(req)}
                        disabled={busyId === req._id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <ConfirmDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title="Delete callback request"
          message={`Delete the request from ${deleteTarget?.name || "this customer"}? This cannot be undone. To keep the record but take it out of the queue, mark it as spam instead.`}
          confirmText="Delete"
          type="danger"
        />

        {/* ---- Detail modal ---- */}
        {detailRequest && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDetailRequest(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Callback request details"
              // The backdrop closes the modal, so a click inside it must not bubble out.
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
            >
              <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                      metaFor(detailRequest.status).avatar
                    }`}
                  >
                    {initialOf(detailRequest.name)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-gray-900">{detailRequest.name || "Unknown"}</h2>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          metaFor(detailRequest.status).pill
                        }`}
                      >
                        {metaFor(detailRequest.status).label}
                      </span>
                      <span className="text-xs text-gray-500">{formatDateTime(detailRequest.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDetailRequest(null)}
                  aria-label="Close"
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 px-6 py-5">
                {/* Reaching them comes first -- it is why the record exists. */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</h3>
                  <div className="flex flex-wrap gap-2">
                    {isCallable(detailRequest.phone) ? (
                      <>
                        <a
                          href={`tel:${dialable(detailRequest.phone)}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                        >
                          <PhoneCall className="h-4 w-4" />
                          {detailRequest.phone}
                        </a>
                        <a
                          href={`https://wa.me/${dialable(detailRequest.phone).replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      </>
                    ) : (
                      <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone field</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">
                          {detailRequest.phone || "No phone given"}
                        </p>
                        <p className="mt-1.5 text-xs text-amber-700">
                          This is not a usable phone number, so no call option is offered.
                        </p>
                      </div>
                    )}
                    {detailRequest.email && (
                      <a
                        href={`mailto:${detailRequest.email}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        <Mail className="h-4 w-4" />
                        {detailRequest.email}
                      </a>
                    )}
                  </div>
                  {detailRequest.countryCode && (
                    <p className="mt-2 text-xs text-gray-500">Country code: {detailRequest.countryCode}</p>
                  )}
                </div>

                {!detailRequest.productName && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Product enquired about
                    </h3>
                    <div className="flex items-start gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <p className="text-sm text-gray-500">
                        None. This came through the Contact Us form, which asks only for a name, email
                        and phone number &mdash; requests raised from a product page carry the product.
                      </p>
                    </div>
                  </div>
                )}

                {detailRequest.productName && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Product enquired about
                    </h3>
                    <div className="flex items-start gap-2 rounded-lg border border-gray-200 p-3">
                      <Package className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900">{detailRequest.productName}</p>
                        {detailRequest.productLink && (
                          <a
                            href={detailRequest.productLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                          >
                            Open product page
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {detailRequest.customerNote && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Customer note
                    </h3>
                    {/* In full here, however long -- the card only ever shows a preview. */}
                    <p className="whitespace-pre-wrap break-words rounded-lg border-l-2 border-gray-300 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-700">
                      {detailRequest.customerNote}
                    </p>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
                {detailRequest.status !== "done" && (
                  <button
                    onClick={() => updateStatus(detailRequest._id, "done")}
                    disabled={busyId === detailRequest._id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    Mark done
                  </button>
                )}
                {detailRequest.status !== "spam" && (
                  <button
                    onClick={() => updateStatus(detailRequest._id, "spam")}
                    disabled={busyId === detailRequest._id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
                  >
                    <Ban className="h-4 w-4" />
                    Spam
                  </button>
                )}
                {detailRequest.status !== "pending" && (
                  <button
                    onClick={() => updateStatus(detailRequest._id, "pending")}
                    disabled={busyId === detailRequest._id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reopen
                  </button>
                )}
                <button
                  onClick={() => setDetailRequest(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminRequestCallbacks
