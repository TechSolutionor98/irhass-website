"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import axios from "axios"
import AdminSidebar from "../../components/admin/AdminSidebar"
import {
  MessageCircle,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Plug,
  Inbox,
} from "lucide-react"
import config from "../../config/config"

/**
 * WhatsApp connection and agent inbox.
 *
 * Two tabs: connecting the number, and talking to customers. The connection tab is
 * deliberately explicit about the 24-hour service window and templates, because those
 * are the two rules that decide whether a number stays healthy or gets limited.
 */

const authHeaders = () => {
  const token =
    localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const timeAgo = (value) => {
  if (!value) return ""
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const NOTIFY_FIELDS = [
  ["onOrderPlaced", "Order placed", "orderConfirmation", "Sent the moment an order is created, with Confirm and Cancel buttons."],
  ["onOrderShipped", "Order shipped", "orderShipped", "Sent when the status moves to shipped or on the way."],
  ["onOrderDelivered", "Order delivered", "orderDelivered", "Sent when the order is marked delivered."],
  ["onOrderCancelled", "Order cancelled", "orderCancelled", "Sent when an order is cancelled."],
]

const AdminWhatsApp = () => {
  const [tab, setTab] = useState("connection")
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [testPhone, setTestPhone] = useState("")

  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [thread, setThread] = useState({ conversation: null, messages: [] })
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const threadEndRef = useRef(null)

  const api = `${config.API_URL}/api/whatsapp`

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await axios.get(`${api}/settings`, { headers: authHeaders() })
      setSettings(data)
      setForm({
        phoneNumberId: data.phoneNumberId || "",
        wabaId: data.wabaId || "",
        displayPhoneNumber: data.displayPhoneNumber || "",
        templateLanguage: data.templateLanguage || "en",
        isEnabled: Boolean(data.isEnabled),
        templates: { ...data.templates },
        notify: { ...data.notify },
        accessToken: "",
        verifyToken: "",
        appSecret: "",
      })
    } catch (error) {
      setNotice({ tone: "bad", text: error.response?.data?.message || "Could not load settings" })
    }
  }, [api])

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await axios.get(`${api}/conversations`, { headers: authHeaders() })
      setConversations(data.conversations || [])
    } catch {
      // An empty inbox is not an error worth shouting about.
    }
  }, [api])

  useEffect(() => {
    loadSettings()
    loadConversations()
  }, [loadSettings, loadConversations])

  // Poll while the inbox is open. Webhooks push into the database; this is how the
  // screen notices. Thirty seconds rather than a socket: an agent inbox does not need
  // sub-second latency, and polling cannot leak connections.
  useEffect(() => {
    if (tab !== "inbox") return
    const id = setInterval(loadConversations, 30000)
    return () => clearInterval(id)
  }, [tab, loadConversations])

  const openThread = async (conversationId) => {
    setActiveId(conversationId)
    try {
      const { data } = await axios.get(`${api}/conversations/${conversationId}/messages`, {
        headers: authHeaders(),
      })
      setThread(data)
      setConversations((prev) =>
        prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c)),
      )
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    } catch (error) {
      setNotice({ tone: "bad", text: error.response?.data?.message || "Could not open that conversation" })
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setNotice(null)
    try {
      await axios.put(`${api}/settings`, form, { headers: authHeaders() })
      setNotice({ tone: "good", text: "Settings saved" })
      await loadSettings()
    } catch (error) {
      setNotice({ tone: "bad", text: error.response?.data?.message || "Could not save" })
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async () => {
    if (!testPhone.trim()) return
    setNotice(null)
    try {
      await axios.post(`${api}/test`, { phone: testPhone.trim() }, { headers: authHeaders() })
      setNotice({ tone: "good", text: "Test message sent. Check the phone." })
      await loadSettings()
    } catch (error) {
      setNotice({ tone: "bad", text: error.response?.data?.message || "Test failed" })
    }
  }

  const sendReply = async (e) => {
    e.preventDefault()
    if (!reply.trim() || !activeId) return
    setSending(true)
    try {
      await axios.post(
        `${api}/conversations/${activeId}/reply`,
        { body: reply.trim() },
        { headers: authHeaders() },
      )
      setReply("")
      await openThread(activeId)
      await loadConversations()
    } catch (error) {
      setNotice({ tone: "bad", text: error.response?.data?.message || "Could not send" })
    } finally {
      setSending(false)
    }
  }

  const windowOpen = thread.conversation?.isWindowOpen
  const input =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
  const label = "mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500"

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <MessageCircle className="text-emerald-600" size={24} />
              WhatsApp
            </h1>
            <p className="mt-1 text-gray-600">
              Order notifications and customer conversations, over the official WhatsApp Business API.
            </p>
          </div>

          <span
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
              settings?.connected ? "bg-emerald-50 text-emerald-700" : "bg-gray-200 text-gray-600"
            }`}
          >
            {settings?.connected ? <CheckCircle2 size={16} /> : <Plug size={16} />}
            {settings?.connected ? `Connected ${settings.displayPhoneNumber || ""}` : "Not connected"}
          </span>
        </div>

        {notice && (
          <div
            className={`mb-5 rounded-md border-l-4 px-4 py-3 text-sm ${
              notice.tone === "good"
                ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                : "border-red-500 bg-red-50 text-red-700"
            }`}
          >
            {notice.text}
          </div>
        )}

        <div className="mb-6 flex gap-1 border-b border-gray-200">
          {[
            ["connection", "Connection", Plug],
            ["inbox", "Inbox", Inbox],
          ].map(([key, title, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Icon size={16} />
              {title}
              {key === "inbox" && conversations.some((c) => c.unreadCount > 0) && (
                <span className="rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white">
                  {conversations.reduce((n, c) => n + (c.unreadCount || 0), 0)}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "connection" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="rounded-lg bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Credentials</h2>
                <p className="mt-1 text-sm text-gray-500">
                  From Meta for Developers → your app → WhatsApp → API Setup.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>Phone number ID</label>
                    <input
                      className={input}
                      value={form.phoneNumberId || ""}
                      onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
                      placeholder="123456789012345"
                    />
                  </div>
                  <div>
                    <label className={label}>WhatsApp Business account ID</label>
                    <input
                      className={input}
                      value={form.wabaId || ""}
                      onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
                      placeholder="098765432109876"
                    />
                  </div>
                  <div>
                    <label className={label}>Display number</label>
                    <input
                      className={input}
                      value={form.displayPhoneNumber || ""}
                      onChange={(e) => setForm({ ...form, displayPhoneNumber: e.target.value })}
                      placeholder="+92 321 498 0835"
                    />
                  </div>
                  <div>
                    <label className={label}>Template language</label>
                    <input
                      className={input}
                      value={form.templateLanguage || ""}
                      onChange={(e) => setForm({ ...form, templateLanguage: e.target.value })}
                      placeholder="en"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={label}>
                      Permanent access token {settings?.hasAccessToken && <span className="text-emerald-600">· saved</span>}
                    </label>
                    <input
                      type="password"
                      className={input}
                      value={form.accessToken || ""}
                      onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                      placeholder={settings?.hasAccessToken ? "Leave blank to keep the saved token" : "EAAG..."}
                    />
                  </div>
                  <div>
                    <label className={label}>
                      Webhook verify token {settings?.hasVerifyToken && <span className="text-emerald-600">· saved</span>}
                    </label>
                    <input
                      type="password"
                      className={input}
                      value={form.verifyToken || ""}
                      onChange={(e) => setForm({ ...form, verifyToken: e.target.value })}
                      placeholder="any string you choose"
                    />
                  </div>
                  <div>
                    <label className={label}>
                      App secret {settings?.hasAppSecret && <span className="text-emerald-600">· saved</span>}
                    </label>
                    <input
                      type="password"
                      className={input}
                      value={form.appSecret || ""}
                      onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
                      placeholder="from App Settings → Basic"
                    />
                  </div>
                </div>

                <label className="mt-5 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(form.isEnabled)}
                    onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                    className="h-4 w-4 accent-gray-900"
                  />
                  <span className="text-sm font-medium text-gray-900">WhatsApp is switched on</span>
                </label>

                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="rounded-md bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={loadSettings}
                    className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <RefreshCw size={14} />
                    Reload
                  </button>
                </div>
              </section>

              <section className="rounded-lg bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Notifications</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Each one needs an approved template of the same name in Meta. A template that is not
                  approved simply does not send.
                </p>

                <div className="mt-5 space-y-4">
                  {NOTIFY_FIELDS.map(([notifyKey, title, templateKey, hint]) => (
                    <div key={notifyKey} className="flex flex-wrap items-start gap-4 border-b border-gray-100 pb-4 last:border-0">
                      <label className="flex min-w-[200px] flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(form.notify?.[notifyKey])}
                          onChange={(e) =>
                            setForm({ ...form, notify: { ...form.notify, [notifyKey]: e.target.checked } })
                          }
                          className="mt-0.5 h-4 w-4 accent-gray-900"
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-900">{title}</span>
                          <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>
                        </span>
                      </label>
                      <input
                        className={`${input} max-w-[240px]`}
                        value={form.templates?.[templateKey] || ""}
                        onChange={(e) =>
                          setForm({ ...form, templates: { ...form.templates, [templateKey]: e.target.value } })
                        }
                        placeholder="template_name"
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Send a test</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Goes out as a template, exactly like a real order notification.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <input
                    className={`${input} max-w-xs`}
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="03214980835"
                  />
                  <button
                    onClick={sendTest}
                    disabled={!settings?.connected || !testPhone.trim()}
                    className="flex items-center gap-2 rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    <Send size={15} />
                    Send test
                  </button>
                </div>
                {settings?.lastVerifiedAt && (
                  <p className="mt-3 text-xs text-gray-500">
                    Last successful send {timeAgo(settings.lastVerifiedAt)}
                  </p>
                )}
                {settings?.lastError && (
                  <p className="mt-3 flex items-start gap-2 text-xs text-red-600">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                    {settings.lastError}
                  </p>
                )}
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <ShieldCheck size={16} />
                  Why this will not get you banned
                </h3>
                <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-emerald-900">
                  <li>
                    <strong>Official API.</strong> This uses Meta's WhatsApp Business Platform. Bans come
                    from driving WhatsApp Web through a QR session, which breaks the terms of service.
                    Nothing here does that.
                  </li>
                  <li>
                    <strong>Only your customers.</strong> Messages go to numbers that placed an order or
                    wrote to you first. There is no way to message a bought list.
                  </li>
                  <li>
                    <strong>Templates outside 24 hours.</strong> Free-form replies are only possible for
                    24 hours after the customer writes. The inbox blocks the box rather than letting Meta
                    reject the send.
                  </li>
                  <li>
                    <strong>STOP is permanent.</strong> A customer who replies STOP is never messaged
                    again, including by order notifications.
                  </li>
                </ul>
              </section>

              <section className="rounded-lg bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Webhook URL</h3>
                <p className="mt-2 text-xs text-gray-500">
                  Paste this into Meta → WhatsApp → Configuration, with the verify token above.
                </p>
                <code className="mt-3 block break-all rounded bg-gray-900 px-3 py-2 font-mono text-xs text-emerald-300">
                  {config.API_URL}/api/whatsapp/webhook
                </code>
                <p className="mt-3 text-xs text-gray-500">
                  Subscribe to the <strong>messages</strong> field. Meta requires HTTPS, so this must be
                  your deployed URL, not localhost.
                </p>
              </section>
            </aside>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
            <section className="rounded-lg bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
                <button onClick={loadConversations} className="text-gray-400 hover:text-gray-900">
                  <RefreshCw size={15} />
                </button>
              </div>

              <ul className="max-h-[70vh] divide-y divide-gray-100 overflow-y-auto">
                {conversations.length === 0 ? (
                  <li className="px-4 py-12 text-center text-sm text-gray-500">
                    No conversations yet. They appear here when a customer messages your number.
                  </li>
                ) : (
                  conversations.map((conversation) => (
                    <li key={conversation._id}>
                      <button
                        onClick={() => openThread(conversation._id)}
                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                          activeId === conversation._id ? "bg-gray-100" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-gray-900">
                            {conversation.name || `+${conversation.phone}`}
                          </span>
                          {conversation.unreadCount > 0 && (
                            <span className="rounded-full bg-emerald-600 px-1.5 text-xs font-bold text-white">
                              {conversation.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {conversation.lastDirection === "out" ? "You: " : ""}
                          {conversation.lastMessagePreview || "—"}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                          {timeAgo(conversation.lastMessageAt)}
                          {conversation.optedOut && <span className="text-red-500">· opted out</span>}
                        </p>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="flex min-h-[70vh] flex-col rounded-lg bg-white shadow-sm">
              {!thread.conversation ? (
                <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
                  Choose a conversation to read it.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {thread.conversation.name || `+${thread.conversation.phone}`}
                      </p>
                      <p className="font-mono text-xs text-gray-500">+{thread.conversation.phone}</p>
                    </div>
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        windowOpen ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      <Clock size={13} />
                      {windowOpen ? "Can reply freely" : "Reply window closed"}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                    {thread.messages.map((message) => (
                      <div
                        key={message._id}
                        className={`flex ${message.direction === "out" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3.5 py-2.5 text-sm ${
                            message.type === "system"
                              ? "bg-amber-50 text-amber-900"
                              : message.direction === "out"
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          <p
                            className={`mt-1 text-[11px] ${
                              message.direction === "out" && message.type !== "system"
                                ? "text-emerald-100"
                                : "text-gray-500"
                            }`}
                          >
                            {new Date(message.createdAt).toLocaleString("en-PK", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {message.direction === "out" && ` · ${message.status}`}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={threadEndRef} />
                  </div>

                  <form onSubmit={sendReply} className="border-t border-gray-200 p-4">
                    {!windowOpen && (
                      <p className="mb-3 rounded border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        This customer has not written in the last 24 hours. WhatsApp only allows approved
                        templates outside that window, so a free-form reply would be rejected. Change the
                        order status to send an update, or wait for them to write.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        disabled={!windowOpen || thread.conversation.optedOut}
                        placeholder={
                          thread.conversation.optedOut
                            ? "This customer opted out"
                            : windowOpen
                              ? "Type a reply..."
                              : "Reply window closed"
                        }
                        className={`${input} flex-1 disabled:cursor-not-allowed disabled:bg-gray-50`}
                      />
                      <button
                        type="submit"
                        disabled={!windowOpen || sending || !reply.trim() || thread.conversation.optedOut}
                        className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        <Send size={15} />
                        Send
                      </button>
                    </div>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminWhatsApp
