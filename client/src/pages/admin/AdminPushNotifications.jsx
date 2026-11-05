"use client"

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import {
  BellRing,
  Send,
  Save,
  Clock,
  Smartphone,
  Users,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Search,
  X,
  Pencil,
} from "lucide-react"
import config from "../../config/config"
import { describeApiError } from "../../utils/apiError"

const SCREENS = [
  { value: "none", label: "Just open the app" },
  { value: "home", label: "Home screen" },
  { value: "product", label: "A product (enter product ID or slug)" },
  { value: "category", label: "A category (enter category slug)" },
  { value: "offer", label: "An offer page (enter offer slug)" },
  { value: "cart", label: "Cart" },
  { value: "orders", label: "My orders" },
  { value: "url", label: "A web link" },
]

const AUDIENCES = [
  { value: "all", label: "Everyone with the app" },
  { value: "platform", label: "One platform" },
  { value: "country", label: "One country" },
  { value: "signed_in", label: "Signed-in customers only" },
  { value: "guests", label: "Guests (not signed in)" },
  { value: "users", label: "Specific customers" },
]

// Mirrors server/utils/pushSounds.js. The server is the authority -- it validates the
// id and serves its own list -- but carrying a copy here means the picker still works
// when the API is an older build that does not return `sounds` yet.
const FALLBACK_SOUNDS = [
  { id: "default", label: "Default (system tone)" },
  { id: "chime", label: "Chime" },
  { id: "ding", label: "Ding" },
  { id: "cash", label: "Cash register (offers)" },
  { id: "alert", label: "Alert" },
  { id: "silent", label: "Silent (no sound)" },
]

const EMPTY = {
  title: "",
  body: "",
  titleAr: "",
  bodyAr: "",
  imageUrl: "",
  sound: "default",
  action: { screen: "none", targetId: "", url: "" },
  audience: { type: "all", platform: "android", country: "AE", users: [] },
  scheduledAt: "",
  expiresAt: "",
}

const STATUS_TONE = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
}

const fmtDate = (v) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "")

const AdminPushNotifications = () => {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
  const authHeader = { headers: { Authorization: `Bearer ${token}` } }

  const [status, setStatus] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [reach, setReach] = useState(null)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Customer picker for the "specific customers" audience.
  const [userSearch, setUserSearch] = useState("")
  const [userResults, setUserResults] = useState([])
  const [pickedUsers, setPickedUsers] = useState([])

  // Test send.
  const [testToken, setTestToken] = useState("")

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/notifications/admin/status`, authHeader)
      setStatus(data)
    } catch (e) {
      setError(describeApiError(e, "Could not load push status"))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true)
      const { data } = await axios.get(`${config.API_URL}/api/notifications/admin/list?limit=50`, authHeader)
      setHistory(data.notifications || [])
    } catch (e) {
      setError(describeApiError(e, "Could not load notification history"))
    } finally {
      setLoadingHistory(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadStatus()
    loadHistory()
  }, [loadStatus, loadHistory])

  // Live "this will reach N devices" as the audience changes.
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.post(
          `${config.API_URL}/api/notifications/admin/audience-count`,
          { audience: { ...form.audience, users: pickedUsers.map((u) => u._id) } },
          authHeader,
        )
        if (!cancelled) setReach(data.count)
      } catch {
        if (!cancelled) setReach(null)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.audience.type, form.audience.platform, form.audience.country, pickedUsers])

  // Customer search.
  useEffect(() => {
    if (form.audience.type !== "users" || userSearch.trim().length < 2) {
      setUserResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${config.API_URL}/api/admin/users`, {
          ...authHeader,
          params: { search: userSearch.trim(), limit: 8, page: 1 },
        })
        const list = Array.isArray(data) ? data : data.users || []
        if (!cancelled) setUserResults(list)
      } catch {
        if (!cancelled) setUserResults([])
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSearch, form.audience.type])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setAction = (patch) => setForm((f) => ({ ...f, action: { ...f.action, ...patch } }))
  const setAudience = (patch) => setForm((f) => ({ ...f, audience: { ...f.audience, ...patch } }))

  const payload = (extra = {}) => ({
    ...form,
    audience: { ...form.audience, users: pickedUsers.map((u) => u._id) },
    scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    ...extra,
  })

  const flash = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(""), 4000)
  }

  const resetForm = () => {
    setForm(EMPTY)
    setPickedUsers([])
    setEditingId(null)
  }

  const submit = async (mode) => {
    setError("")
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and message are required")
      return
    }
    if (mode === "send" && !window.confirm(`Send this notification to ${reach ?? "the selected"} device(s) now?`)) return
    try {
      setBusy(mode)
      if (editingId) {
        await axios.put(`${config.API_URL}/api/notifications/admin/${editingId}`, payload(), authHeader)
        if (mode === "send") {
          const { data } = await axios.post(`${config.API_URL}/api/notifications/admin/${editingId}/send`, {}, authHeader)
          flash(`Sent to ${data.notification?.stats?.sent || 0} device(s)`)
        } else {
          flash(form.scheduledAt ? "Scheduled" : "Draft saved")
        }
      } else {
        const { data } = await axios.post(`${config.API_URL}/api/notifications/admin`, payload({ send: mode === "send" }), authHeader)
        if (mode === "send") flash(`Sent to ${data.notification?.stats?.sent || 0} device(s)`)
        else flash(form.scheduledAt ? "Scheduled" : "Draft saved")
      }
      resetForm()
      loadHistory()
      loadStatus()
    } catch (e) {
      setError(describeApiError(e, "Could not save the notification"))
    } finally {
      setBusy("")
    }
  }

  const sendExisting = async (row) => {
    if (!window.confirm(`Send "${row.title}" now?`)) return
    try {
      setBusy(`send-${row._id}`)
      const { data } = await axios.post(`${config.API_URL}/api/notifications/admin/${row._id}/send`, {}, authHeader)
      flash(`Sent to ${data.notification?.stats?.sent || 0} device(s)`)
      loadHistory()
    } catch (e) {
      setError(describeApiError(e, "Could not send"))
      loadHistory()
    } finally {
      setBusy("")
    }
  }

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.title}"? It will also disappear from the app inbox.`)) return
    try {
      await axios.delete(`${config.API_URL}/api/notifications/admin/${row._id}`, authHeader)
      loadHistory()
      if (editingId === row._id) resetForm()
    } catch (e) {
      setError(describeApiError(e, "Could not delete"))
    }
  }

  const editExisting = (row) => {
    setEditingId(row._id)
    setForm({
      title: row.title || "",
      body: row.body || "",
      titleAr: row.titleAr || "",
      bodyAr: row.bodyAr || "",
      imageUrl: row.imageUrl || "",
      sound: row.sound || "default",
      action: { screen: row.action?.screen || "none", targetId: row.action?.targetId || "", url: row.action?.url || "" },
      audience: {
        type: row.audience?.type || "all",
        platform: row.audience?.platform || "android",
        country: row.audience?.country || "AE",
        users: [],
      },
      scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString().slice(0, 16) : "",
      expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString().slice(0, 16) : "",
    })
    setPickedUsers((row.audience?.users || []).filter((u) => u && u._id))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const sendTest = async () => {
    if (!testToken.trim()) return
    setError("")
    try {
      setBusy("test")
      const { data } = await axios.post(
        `${config.API_URL}/api/notifications/admin/test`,
        { title: form.title || "Test notification", body: form.body || "Hello from Irhaas", imageUrl: form.imageUrl, sound: form.sound, action: form.action, token: testToken.trim() },
        authHeader,
      )
      if (data.sent > 0) flash("Test sent")
      else setError(data.errors?.[0] || "Test could not be delivered")
    } catch (e) {
      setError(describeApiError(e, "Test could not be sent"))
    } finally {
      setBusy("")
    }
  }

  const configured = status?.configured
  const devices = status?.devices

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BellRing className="text-lime-600" />
            Push Notifications
          </h1>
          <p className="text-sm text-gray-500">Write a notification and send it to the Irhaas mobile app.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadStatus()
            loadHistory()
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {status && !configured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold">Firebase is not connected yet, so nothing can be sent.</p>
            <p className="mt-1">
              Add the Firebase service account key to the server as <code className="rounded bg-amber-100 px-1">FIREBASE_SERVICE_ACCOUNT</code>{" "}
              (Firebase console → Project settings → Service accounts → Generate new private key) and restart the API. Drafts can
              still be written and saved.
            </p>
            {status.error && <p className="mt-1 text-xs text-amber-700">{status.error}</p>}
          </div>
        </div>
      )}

      {devices && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat icon={Smartphone} label="Devices" value={devices.total} />
          <Stat icon={Smartphone} label="Android" value={devices.android} />
          <Stat icon={Smartphone} label="iOS" value={devices.ios} />
          <Stat icon={Users} label="Signed in" value={devices.signedIn} />
          <Stat icon={Users} label="Guests" value={devices.guests} />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")} className="text-red-400 hover:text-red-700">
            <X size={16} />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Compose */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{editingId ? "Edit notification" : "New notification"}</h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-800">
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Title" hint={`${form.title.length}/120`}>
              <input className={inputClass} maxLength={120} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Weekend deals are live" />
            </Field>
            <Field label="Title (Arabic, optional)">
              <input className={inputClass} dir="rtl" maxLength={120} value={form.titleAr} onChange={(e) => set({ titleAr: e.target.value })} />
            </Field>
            <Field label="Message" hint={`${form.body.length}/500`}>
              <textarea className={inputClass} rows={3} maxLength={500} value={form.body} onChange={(e) => set({ body: e.target.value })} placeholder="Up to 30% off laptops until Sunday." />
            </Field>
            <Field label="Message (Arabic, optional)">
              <textarea className={inputClass} dir="rtl" rows={3} maxLength={500} value={form.bodyAr} onChange={(e) => set({ bodyAr: e.target.value })} />
            </Field>
          </div>

          <Field
            label="Notification sound"
            hint="The tone the phone plays. Requires the sound to be bundled in the app."
          >
            <select className={inputClass} value={form.sound} onChange={(e) => set({ sound: e.target.value })}>
              {(status?.sounds?.length ? status.sounds : FALLBACK_SOUNDS).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Image URL (optional)" hint="Shown as a large picture in the notification. Use a public https link, ideally 2:1.">
            <div className="flex gap-3">
              <input className={inputClass} value={form.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://…/banner.jpg" />
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="h-10 w-20 rounded object-cover border border-gray-200" onError={(e) => (e.target.style.visibility = "hidden")} />
              ) : (
                <span className="flex h-10 w-20 items-center justify-center rounded border border-dashed border-gray-300 text-gray-300">
                  <ImageIcon size={16} />
                </span>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="When tapped, open">
              <select className={inputClass} value={form.action.screen} onChange={(e) => setAction({ screen: e.target.value, targetId: "", url: "" })}>
                {SCREENS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            {["product", "category", "offer"].includes(form.action.screen) && (
              <Field label={form.action.screen === "product" ? "Product ID or slug" : "Slug"}>
                <input className={inputClass} value={form.action.targetId} onChange={(e) => setAction({ targetId: e.target.value })} />
              </Field>
            )}
            {form.action.screen === "url" && (
              <Field label="Link">
                <input className={inputClass} value={form.action.url} onChange={(e) => setAction({ url: e.target.value })} placeholder="https://www.irhaas.com/ae-en/offers/…" />
              </Field>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Who receives it</h3>
              <span className="text-sm text-gray-600">
                Reaches <strong className="text-gray-900">{reach ?? "…"}</strong> device{reach === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <select className={inputClass} value={form.audience.type} onChange={(e) => setAudience({ type: e.target.value })}>
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              {form.audience.type === "platform" && (
                <select className={inputClass} value={form.audience.platform} onChange={(e) => setAudience({ platform: e.target.value })}>
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                </select>
              )}
              {form.audience.type === "country" && (
                <select className={inputClass} value={form.audience.country} onChange={(e) => setAudience({ country: e.target.value })}>
                  {(devices?.byCountry?.length ? devices.byCountry.map((c) => c.country) : ["AE", "SA", "QA", "OM", "BH", "KW"]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {form.audience.type === "users" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className={`${inputClass} pl-9`} value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search customers by name or email" />
                  {userResults.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                      {userResults.map((u) => (
                        <li key={u._id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                            onClick={() => {
                              if (!pickedUsers.some((p) => p._id === u._id)) setPickedUsers([...pickedUsers, u])
                              setUserSearch("")
                              setUserResults([])
                            }}
                          >
                            <span className="font-medium text-gray-900">{u.name}</span> <span className="text-gray-500">· {u.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {pickedUsers.map((u) => (
                    <span key={u._id} className="inline-flex items-center gap-1 rounded-full bg-white border border-gray-300 px-2.5 py-1 text-xs text-gray-800">
                      {u.name || u.email}
                      <button type="button" onClick={() => setPickedUsers(pickedUsers.filter((p) => p._id !== u._id))} className="text-gray-400 hover:text-red-600">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {pickedUsers.length === 0 && <span className="text-xs text-gray-500">No customers picked yet. Only customers who opened the app can be reached.</span>}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Schedule for later (optional)" hint="Leave empty to send now or keep as a draft.">
              <input type="datetime-local" className={inputClass} value={form.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} />
            </Field>
            <Field label="Remove from app inbox after (optional)">
              <input type="datetime-local" className={inputClass} value={form.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              disabled={Boolean(busy) || !configured}
              onClick={() => submit("send")}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-700 disabled:opacity-50"
            >
              <Send size={15} />
              {busy === "send" ? "Sending…" : "Send now"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => submit("save")}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {form.scheduledAt ? <Clock size={15} /> : <Save size={15} />}
              {form.scheduledAt ? "Schedule" : "Save draft"}
            </button>
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 p-4">
            <p className="text-sm font-medium text-gray-900">Send a test to one phone</p>
            <p className="text-xs text-gray-500">Paste the device's push token (the app developer can show it in a debug screen). Uses the title, message and image above.</p>
            <div className="mt-2 flex gap-2">
              <input className={inputClass} value={testToken} onChange={(e) => setTestToken(e.target.value)} placeholder="Device push token" />
              <button
                type="button"
                disabled={!configured || !testToken.trim() || busy === "test"}
                onClick={sendTest}
                className="whitespace-nowrap rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {busy === "test" ? "Sending…" : "Send test"}
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-gray-900">Preview</h2>
            <div className="mx-auto max-w-xs rounded-[28px] border-8 border-gray-900 bg-gray-100 p-3 shadow-inner">
              <div className="rounded-2xl bg-white p-3 shadow">
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                  <img src="/favicon.png" alt="" className="h-4 w-4 rounded" />
                  Irhaas · now
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900">{form.title || "Notification title"}</p>
                <p className="text-xs text-gray-700 whitespace-pre-line">{form.body || "The message customers will read."}</p>
                {form.imageUrl && <img src={form.imageUrl} alt="" className="mt-2 w-full rounded-lg object-cover max-h-32" onError={(e) => (e.target.style.display = "none")} />}
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Tap opens: <strong>{SCREENS.find((s) => s.value === form.action.screen)?.label}</strong>
              {form.action.targetId ? ` (${form.action.targetId})` : ""}
              {form.action.url ? ` (${form.action.url})` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Sent and saved notifications</h2>
          <span className="text-sm text-gray-500">{history.length} shown</span>
        </div>
        {loadingHistory ? (
          <p className="p-6 text-sm text-gray-500">Loading…</p>
        ) : history.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">Nothing yet. Your first notification will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Notification</th>
                  <th className="px-3 py-3">Audience</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Delivered</th>
                  <th className="px-3 py-3">When</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((row) => (
                  <tr key={row._id} className="align-top">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{row.title}</p>
                      <p className="line-clamp-2 text-xs text-gray-500 max-w-md">{row.body}</p>
                      {row.error && <p className="mt-1 text-xs text-red-600">{row.error}</p>}
                    </td>
                    <td className="px-3 py-3 text-gray-700">{describeAudience(row.audience)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[row.status] || STATUS_TONE.draft}`}>{row.status}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      {row.status === "sent" ? (
                        <>
                          {row.stats?.sent || 0} / {row.stats?.targeted || 0}
                          {row.stats?.failed > 0 && <span className="block text-xs text-red-600">{row.stats.failed} failed</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
                      {row.status === "scheduled" ? `Scheduled ${fmtDate(row.scheduledAt)}` : fmtDate(row.sentAt || row.createdAt)}
                      <span className="block text-xs text-gray-400">{row.createdBy?.name || ""}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        {["draft", "scheduled", "failed"].includes(row.status) && (
                          <>
                            <button type="button" onClick={() => editExisting(row)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100" title="Edit">
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              disabled={!configured || busy === `send-${row._id}`}
                              onClick={() => sendExisting(row)}
                              className="rounded p-1.5 text-lime-700 hover:bg-lime-50 disabled:opacity-40"
                              title="Send now"
                            >
                              <Send size={15} />
                            </button>
                          </>
                        )}
                        <button type="button" onClick={() => remove(row)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-lime-500 focus:outline-none focus:ring-2 focus:ring-lime-200"

const Field = ({ label, hint, children }) => (
  <label className="block">
    <span className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700">
      {label}
      {hint && <span className="text-xs font-normal text-gray-400">{hint}</span>}
    </span>
    {children}
  </label>
)

const Stat = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
      <Icon size={14} />
      {label}
    </div>
    <p className="mt-1 text-2xl font-bold text-gray-900">{value ?? 0}</p>
  </div>
)

const describeAudience = (a = {}) => {
  switch (a.type) {
    case "platform":
      return a.platform === "ios" ? "iOS" : "Android"
    case "country":
      return `Country: ${a.country}`
    case "signed_in":
      return "Signed-in customers"
    case "guests":
      return "Guests"
    case "users":
      return `${(a.users || []).length} customer${(a.users || []).length === 1 ? "" : "s"}`
    default:
      return "Everyone"
  }
}

export default AdminPushNotifications
