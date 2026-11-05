"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Plus, Send, Pause, Play, Copy, Trash2, Users, Mail, Search, AlertTriangle, Loader2,
  CheckCircle2, XCircle, Clock, ArrowLeft, Gauge, RefreshCw, Ban,
} from "lucide-react"
import AdminSidebar from "../../components/admin/AdminSidebar"
import {
  fetchCampaigns, fetchCampaign, createCampaign, updateCampaign, duplicateCampaign, deleteCampaign,
  previewAudience, fetchContacts, fetchRecipients, sendTest, startCampaign, pauseCampaign,
  resumeCampaign, fetchTemplates, fetchUnsubscribes, errorMessage,
} from "../../services/emailBuilderApi"

/**
 * Bulk Mails: pick who, pick a design, review, send.
 *
 * The screen's job is to make the consequences visible before the button is pressed.
 * Two things in particular:
 *
 *   The audience count is stated three ways -- people, rows across the lists, and how
 *   many of them are on more than one list. One number would hide the overlap and
 *   make a 305-person send look like a 319-person one.
 *
 *   Opted-out addresses appear in the pick-by-hand list, greyed and un-tickable,
 *   rather than quietly missing. A customer who has vanished with no explanation
 *   looks like a bug, and somebody goes looking for them.
 */

const AUDIENCES = [
  { id: "users", label: "Users", hint: "Everyone with an account" },
  { id: "newsletter", label: "Newsletter Subscribers", hint: "Signed up through the footer" },
  { id: "callbacks", label: "Request Callbacks", hint: "Asked to be called back" },
  { id: "bulk", label: "Bulk Purchase", hint: "Trade and bulk enquiries" },
]

const STATUS_STYLES = {
  draft: "bg-stone-100 text-stone-600",
  queued: "bg-blue-100 text-blue-700",
  sending: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-stone-100 text-stone-500",
}

const StatusChip = ({ status }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
    {status}
  </span>
)

const BulkMails = () => {
  const [campaigns, setCampaigns] = useState([])
  const [templates, setTemplates] = useState([])
  const [view, setView] = useState("list")
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [unsubscribes, setUnsubscribes] = useState(null)

  /* ---------------------------------------------------------------- loading -- */

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [campaignList, templateList] = await Promise.all([fetchCampaigns(), fetchTemplates()])
      setCampaigns(campaignList || [])
      setTemplates(templateList || [])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const open = async (id) => {
    setBusy(true)
    setError("")
    try {
      setCurrent(await fetchCampaign(id))
      setView("detail")
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    setBusy(true)
    try {
      const created = await createCampaign({ name: "Untitled campaign", ratePerMinute: 30 })
      setCampaigns((prev) => [created, ...prev])
      setCurrent(created)
      setView("detail")
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const flash = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 3000)
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar />

      <div className="min-w-0 flex-1 p-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div>
        )}

        {view === "list" ? (
          <CampaignList
            campaigns={campaigns}
            loading={loading}
            busy={busy}
            unsubscribes={unsubscribes}
            onLoadUnsubscribes={async () => {
              try {
                setUnsubscribes(await fetchUnsubscribes())
              } catch (err) {
                setError(errorMessage(err))
              }
            }}
            onCreate={create}
            onOpen={open}
            onRefresh={load}
            onDuplicate={async (id) => {
              setBusy(true)
              try {
                await duplicateCampaign(id)
                await load()
                flash("Duplicated as a new draft.")
              } catch (err) {
                setError(errorMessage(err))
              } finally {
                setBusy(false)
              }
            }}
            onDelete={async (campaign) => {
              if (!window.confirm(`Delete “${campaign.name}”? Its per-person record goes with it.`)) return
              setBusy(true)
              try {
                await deleteCampaign(campaign._id)
                await load()
              } catch (err) {
                setError(errorMessage(err))
              } finally {
                setBusy(false)
              }
            }}
          />
        ) : (
          <CampaignDetail
            campaign={current}
            templates={templates}
            onBack={() => {
              setView("list")
              setCurrent(null)
              load()
            }}
            onChange={setCurrent}
            onError={setError}
            onNotice={flash}
          />
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- list -- */

const CampaignList = ({
  campaigns, loading, busy, unsubscribes, onLoadUnsubscribes,
  onCreate, onOpen, onDuplicate, onDelete, onRefresh,
}) => {
  const [tab, setTab] = useState("campaigns")

  return (
  <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Bulk Mails</h1>
        <p className="mt-0.5 text-sm text-stone-500">Send a design to a list of people.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1.5 rounded border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:border-stone-900">
          <RefreshCw size={15} /> Refresh
        </button>
        <button type="button" onClick={onCreate} disabled={busy} className="inline-flex items-center gap-1.5 rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-[#8e6937] disabled:opacity-50">
          <Plus size={15} /> New campaign
        </button>
      </div>
    </div>

    <div className="mb-5 flex gap-1 border-b border-stone-200">
      {[
        { id: "campaigns", label: "Campaigns" },
        { id: "unsubscribes", label: "Opted out" },
      ].map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            setTab(item.id)
            // Fetched on first open. It is a list nobody looks at most days.
            if (item.id === "unsubscribes" && !unsubscribes) onLoadUnsubscribes()
          }}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === item.id ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          {item.label}
          {item.id === "unsubscribes" && unsubscribes && (
            <span className="ml-1.5 text-xs text-stone-400">{unsubscribes.length}</span>
          )}
        </button>
      ))}
    </div>

    {/* The opt-out list, visible rather than invisible. Staff get asked "why did my
        customer stop getting these?" and without this the only answer is a guess. */}
    {tab === "unsubscribes" ? (
      !unsubscribes ? (
        <p className="py-16 text-center text-sm text-stone-500">Loading…</p>
      ) : !unsubscribes.length ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white py-16 text-center">
          <Ban size={28} className="mx-auto mb-3 text-stone-300" />
          <p className="text-sm text-stone-600">Nobody has opted out.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Address</th>
                <th className="px-4 py-2.5 font-medium">How</th>
                <th className="px-4 py-2.5 font-medium">Reason given</th>
                <th className="px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {unsubscribes.map((row) => (
                <tr key={row._id}>
                  <td className="px-4 py-2.5 text-stone-900">{row.email}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-500">
                    {row.source === "one-click" ? "Inbox button" : row.source === "admin" ? "Profile / admin" : "Email link"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-stone-600">{row.reason || "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-stone-500">{new Date(row.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-stone-200 px-4 py-2 text-[11px] text-stone-500">
            An opt-out is never reversed from here. The customer can resubscribe themselves from their profile.
          </p>
        </div>
      )
    ) : (
    <>

    {loading ? (
      <p className="py-16 text-center text-sm text-stone-500">Loading…</p>
    ) : !campaigns.length ? (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white py-16 text-center">
        <Mail size={28} className="mx-auto mb-3 text-stone-300" />
        <p className="text-sm text-stone-600">No campaigns yet.</p>
      </div>
    ) : (
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Campaign</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Sent</th>
              <th className="px-4 py-2.5 font-medium text-right">Failed</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {campaigns.map((campaign) => (
              <tr key={campaign._id} className="hover:bg-stone-50">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onOpen(campaign._id)} className="text-left font-medium text-stone-900 hover:underline">
                    {campaign.name}
                  </button>
                  <p className="mt-0.5 text-xs text-stone-500">{campaign.subject || "No subject line"}</p>
                </td>
                <td className="px-4 py-3"><StatusChip status={campaign.status} /></td>
                <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                  {campaign.stats?.sent || 0}
                  <span className="text-stone-400"> / {campaign.stats?.total || 0}</span>
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${campaign.stats?.failed ? "text-red-600" : "text-stone-400"}`}>
                  {campaign.stats?.failed || 0}
                </td>
                <td className="px-4 py-3 text-xs text-stone-500">{new Date(campaign.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" title="Duplicate" onClick={() => onDuplicate(campaign._id)} className="grid h-7 w-7 place-items-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-900">
                      <Copy size={14} />
                    </button>
                    <button type="button" title="Delete" onClick={() => onDelete(campaign)} className="grid h-7 w-7 place-items-center rounded text-stone-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    </>
    )}
  </>
  )
}

/* ------------------------------------------------------------------ detail -- */

const CampaignDetail = ({ campaign, templates, onBack, onChange, onError, onNotice }) => {
  const [draft, setDraft] = useState(campaign)
  const [audience, setAudience] = useState(null)
  const [audienceLoading, setAudienceLoading] = useState(false)
  const [contacts, setContacts] = useState([])
  const [contactSearch, setContactSearch] = useState("")
  const [showContacts, setShowContacts] = useState(false)
  const [recipients, setRecipients] = useState([])
  const [recipientFilter, setRecipientFilter] = useState("")
  const [testEmail, setTestEmail] = useState("")
  const [busy, setBusy] = useState(false)

  // Sent and sending campaigns are a record of what happened, not a plan. The form
  // is read-only for them; Duplicate is the way to run it again.
  const locked = ["sending", "sent"].includes(draft.status)
  const running = draft.status === "sending" || draft.status === "queued"

  useEffect(() => setDraft(campaign), [campaign])

  /* --------------------------------------------------------------- audience -- */

  const refreshAudience = useCallback(async () => {
    if (!draft.audiences?.length && !draft.manualEmails?.length) {
      setAudience(null)
      return
    }
    setAudienceLoading(true)
    try {
      setAudience(await previewAudience({ audiences: draft.audiences, manualEmails: draft.manualEmails }))
    } catch (err) {
      onError(errorMessage(err))
    } finally {
      setAudienceLoading(false)
    }
  }, [draft.audiences, draft.manualEmails, onError])

  useEffect(() => {
    refreshAudience()
  }, [refreshAudience])

  // A send runs for hours at 30 a minute, so the page follows along rather than
  // making somebody reload to find out where it got to.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(async () => {
      try {
        const fresh = await fetchCampaign(draft._id)
        setDraft(fresh)
        onChange(fresh)
      } catch {
        // A failed poll is not worth an error banner; the next one will do.
      }
    }, 5000)
    return () => window.clearInterval(id)
  }, [running, draft._id, onChange])

  const loadRecipients = useCallback(async (status) => {
    try {
      setRecipients(await fetchRecipients(draft._id, status))
    } catch (err) {
      onError(errorMessage(err))
    }
  }, [draft._id, onError])

  useEffect(() => {
    if (draft.stats?.total) loadRecipients(recipientFilter)
  }, [draft.stats?.total, recipientFilter, loadRecipients])

  const patch = (changes) => setDraft((prev) => ({ ...prev, ...changes }))

  const save = async (changes = {}) => {
    setBusy(true)
    try {
      const next = { ...draft, ...changes }
      const saved = await updateCampaign(draft._id, {
        name: next.name,
        subject: next.subject,
        preheader: next.preheader,
        template: next.template,
        audiences: next.audiences,
        manualEmails: next.manualEmails,
        ratePerMinute: next.ratePerMinute,
      })
      setDraft(saved)
      onChange(saved)
      onNotice("Saved")
    } catch (err) {
      onError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const openContacts = async () => {
    setShowContacts(true)
    if (contacts.length) return
    try {
      setContacts(await fetchContacts())
    } catch (err) {
      onError(errorMessage(err))
    }
  }

  const visibleContacts = useMemo(() => {
    const term = contactSearch.trim().toLowerCase()
    if (!term) return contacts
    return contacts.filter((c) => c.email.includes(term) || c.name.toLowerCase().includes(term))
  }, [contacts, contactSearch])

  const manual = draft.manualEmails || []
  const toggleManual = (email) => {
    patch({ manualEmails: manual.includes(email) ? manual.filter((e) => e !== email) : [...manual, email] })
  }

  const action = async (fn, successMessage) => {
    setBusy(true)
    try {
      const result = await fn()
      const fresh = await fetchCampaign(draft._id)
      setDraft(fresh)
      onChange(fresh)
      onNotice(result?.message || successMessage)
    } catch (err) {
      onError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const progress = draft.stats?.total
    ? Math.round(((draft.stats.sent + draft.stats.failed + draft.stats.unsubscribed) / draft.stats.total) * 100)
    : 0

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900">
          <ArrowLeft size={16} /> Campaigns
        </button>
        <span className="flex-1" />
        <StatusChip status={draft.status} />
      </div>

      {locked && (
        <div className="mb-4 flex items-start gap-2 rounded border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-stone-700">
          <Ban size={15} className="mt-0.5 flex-shrink-0" />
          <span>
            This campaign is {draft.status} and can no longer be edited — it is the record of what went out.
            Duplicate it from the list to make a new one.
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {/* 1 · Details */}
          <Section step="1" title="Details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Campaign name">
                <input value={draft.name || ""} disabled={locked} onChange={(e) => patch({ name: e.target.value })} onBlur={() => save()} className={inputClass} />
              </Field>
              <Field label="Design">
                <select
                  value={draft.template || ""}
                  disabled={locked}
                  onChange={(e) => {
                    const template = templates.find((t) => t._id === e.target.value)
                    patch({ template: e.target.value || null })
                    // The subject follows the design unless one has been typed, so a
                    // campaign is not sent with an empty subject by accident.
                    save({ template: e.target.value || null, subject: draft.subject || template?.subject || "" })
                  }}
                  className={inputClass}
                >
                  <option value="">Choose a design…</option>
                  {templates.map((template) => (
                    <option key={template._id} value={template._id}>{template.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Subject line">
                <input value={draft.subject || ""} disabled={locked} onChange={(e) => patch({ subject: e.target.value })} onBlur={() => save()} className={inputClass} />
              </Field>
              <Field label="Preview text">
                <input value={draft.preheader || ""} disabled={locked} onChange={(e) => patch({ preheader: e.target.value })} onBlur={() => save()} className={inputClass} />
              </Field>
            </div>
          </Section>

          {/* 2 · Audience */}
          <Section step="2" title="Who it goes to">
            <div className="grid gap-2 sm:grid-cols-2">
              {AUDIENCES.map((list) => {
                const checked = (draft.audiences || []).includes(list.id)
                return (
                  <label key={list.id} className={`flex items-start gap-2.5 rounded border p-3 ${locked ? "opacity-60" : "cursor-pointer"} ${checked ? "border-stone-900 bg-stone-50" : "border-stone-200"}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={() => {
                        const next = checked
                          ? draft.audiences.filter((a) => a !== list.id)
                          : [...(draft.audiences || []), list.id]
                        patch({ audiences: next })
                        save({ audiences: next })
                      }}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 accent-stone-900"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-stone-900">{list.label}</span>
                      <span className="block text-xs text-stone-500">{list.hint}</span>
                      {audience?.perList?.[list.id] != null && (
                        <span className="mt-0.5 block text-xs text-stone-400">{audience.perList[list.id]} on this list</span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={openContacts} disabled={locked} className="inline-flex items-center gap-1.5 rounded border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-900 disabled:opacity-50">
                <Users size={14} /> Pick addresses by hand
              </button>
              {manual.length > 0 && <span className="text-xs text-stone-500">{manual.length} picked individually</span>}
            </div>

            {/* The honest count. */}
            {audienceLoading ? (
              <p className="mt-3 text-sm text-stone-500">Counting…</p>
            ) : audience ? (
              <div className="mt-3 rounded border border-stone-200 bg-stone-50 p-3">
                <p className="text-sm text-stone-900">
                  <strong className="text-base">{audience.people}</strong> {audience.people === 1 ? "person" : "people"} will be emailed
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {audience.rowsAcrossLists} across the lists you chose
                  {audience.overlapping > 0 && `, ${audience.overlapping} on more than one list`}
                  {audience.unsubscribed > 0 && `, ${audience.unsubscribed} opted out and excluded`}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-stone-500">Choose at least one list.</p>
            )}
          </Section>

          {/* 3 · Send */}
          <Section step="3" title="Send">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pace" hint="Messages per minute. Firing thousands at once is how a sending domain gets blocked.">
                <div className="flex items-center gap-2">
                  <Gauge size={15} className="flex-shrink-0 text-stone-400" />
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={draft.ratePerMinute ?? 30}
                    disabled={locked}
                    onChange={(e) => patch({ ratePerMinute: Number(e.target.value) })}
                    onBlur={() => save()}
                    className={`${inputClass} w-24`}
                  />
                  <span className="text-xs text-stone-500">per minute</span>
                </div>
              </Field>
              <Field label="Send a test first">
                <div className="flex gap-2">
                  <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
                  <button
                    type="button"
                    disabled={busy || !testEmail}
                    onClick={() => action(() => sendTest(draft._id, testEmail), "Test sent")}
                    className="flex-shrink-0 rounded border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-900 disabled:opacity-50"
                  >
                    Send test
                  </button>
                </div>
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {draft.status === "draft" && (
                <button
                  type="button"
                  disabled={busy || !audience?.people || !draft.template}
                  onClick={() => {
                    if (!window.confirm(`Send “${draft.name}” to ${audience.people} people?`)) return
                    action(() => startCampaign(draft._id), "Sending started")
                  }}
                  className="inline-flex items-center gap-1.5 rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-[#8e6937] disabled:opacity-50"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send now
                </button>
              )}

              {running && (
                <button type="button" disabled={busy} onClick={() => action(() => pauseCampaign(draft._id), "Paused")} className="inline-flex items-center gap-1.5 rounded border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:border-stone-900 disabled:opacity-50">
                  <Pause size={15} /> Pause
                </button>
              )}

              {draft.status === "paused" && (
                <button type="button" disabled={busy} onClick={() => action(() => resumeCampaign(draft._id), "Resumed")} className="inline-flex items-center gap-1.5 rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-[#8e6937] disabled:opacity-50">
                  <Play size={15} /> Resume
                </button>
              )}

              {!draft.template && draft.status === "draft" && (
                <span className="text-xs text-stone-500">Choose a design before sending.</span>
              )}
            </div>

            {draft.lastError && (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{draft.lastError}</p>
            )}
          </Section>
        </div>

        {/* Progress and per-person outcomes */}
        <div className="space-y-5">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-stone-900">Progress</h3>

            <div className="mb-3 h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full bg-stone-900 transition-all" style={{ width: `${progress}%` }} />
            </div>

            <dl className="space-y-1.5 text-sm">
              <Row icon={<Users size={14} className="text-stone-400" />} label="Queued" value={draft.stats?.total || 0} />
              <Row icon={<CheckCircle2 size={14} className="text-green-600" />} label="Sent" value={draft.stats?.sent || 0} />
              <Row icon={<XCircle size={14} className="text-red-600" />} label="Failed" value={draft.stats?.failed || 0} />
              <Row icon={<Ban size={14} className="text-amber-600" />} label="Opted out" value={draft.stats?.unsubscribed || 0} />
            </dl>

            {draft.startedAt && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-500">
                <Clock size={12} /> Started {new Date(draft.startedAt).toLocaleString()}
              </p>
            )}
          </div>

          {Boolean(draft.stats?.total) && (
            <div className="rounded-lg border border-stone-200 bg-white">
              <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2.5">
                <h3 className="text-sm font-bold text-stone-900">Per person</h3>
                <select value={recipientFilter} onChange={(e) => setRecipientFilter(e.target.value)} className="rounded border border-stone-300 px-2 py-1 text-xs">
                  <option value="">All</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="unsubscribed">Opted out</option>
                </select>
              </div>
              <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
                {recipients.map((recipient) => (
                  <li key={recipient._id} className="px-4 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs text-stone-700">{recipient.email}</span>
                      <span className={`flex-shrink-0 text-[10px] font-semibold uppercase ${
                        recipient.status === "sent" ? "text-green-600"
                          : recipient.status === "failed" ? "text-red-600"
                          : recipient.status === "unsubscribed" ? "text-amber-600"
                          : "text-stone-400"
                      }`}>
                        {recipient.status}
                      </span>
                    </div>
                    {recipient.sources?.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-stone-400">from {recipient.sources.join(", ")}</p>
                    )}
                    {/* The reason, not just the fact — "mailbox full" and "no such
                        domain" need completely different responses. */}
                    {recipient.error && <p className="mt-0.5 text-[10px] text-red-600">{recipient.error}</p>}
                  </li>
                ))}
                {!recipients.length && <li className="px-4 py-6 text-center text-xs text-stone-400">Nothing to show.</li>}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Pick by hand */}
      {showContacts && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[84vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
            <div className="flex flex-shrink-0 items-center gap-3 border-b border-stone-200 px-4 py-3">
              <Search size={16} className="flex-shrink-0 text-stone-400" />
              <input value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} placeholder="Search addresses…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              <button
                type="button"
                onClick={() => {
                  // Select-all covers what is on screen, and never an opted-out address.
                  const selectable = visibleContacts.filter((c) => !c.unsubscribed).map((c) => c.email)
                  const allPicked = selectable.every((email) => manual.includes(email))
                  patch({ manualEmails: allPicked ? manual.filter((e) => !selectable.includes(e)) : [...new Set([...manual, ...selectable])] })
                }}
                className="flex-shrink-0 text-xs font-medium text-stone-700 hover:underline"
              >
                Select all shown
              </button>
            </div>

            <ul className="min-h-0 flex-1 divide-y divide-stone-100 overflow-y-auto">
              {visibleContacts.map((contact) => (
                <li key={contact.email}>
                  <label
                    className={`flex items-center gap-3 px-4 py-2 ${contact.unsubscribed ? "cursor-not-allowed bg-stone-50" : "cursor-pointer hover:bg-stone-50"}`}
                    // Shown, greyed, and un-tickable rather than filtered out: a
                    // customer who silently vanished from the list looks like a bug.
                    title={contact.unsubscribed ? "This person has opted out and cannot be emailed." : undefined}
                  >
                    <input
                      type="checkbox"
                      disabled={contact.unsubscribed}
                      checked={manual.includes(contact.email)}
                      onChange={() => toggleManual(contact.email)}
                      className="h-4 w-4 flex-shrink-0 accent-stone-900 disabled:opacity-40"
                    />
                    <span className={`min-w-0 flex-1 ${contact.unsubscribed ? "text-stone-400" : "text-stone-800"}`}>
                      <span className="block truncate text-sm">{contact.email}</span>
                      <span className="block truncate text-xs text-stone-400">
                        {contact.name || "—"} · {contact.sources.join(", ")}
                      </span>
                    </span>
                    {contact.unsubscribed && (
                      <span className="flex-shrink-0 rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-500">
                        Opted out
                      </span>
                    )}
                  </label>
                </li>
              ))}
              {!visibleContacts.length && <li className="px-4 py-10 text-center text-sm text-stone-400">No addresses match.</li>}
            </ul>

            <div className="flex flex-shrink-0 items-center justify-between border-t border-stone-200 px-4 py-3">
              <span className="text-xs text-stone-500">{manual.length} picked</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowContacts(false)} className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-900">Cancel</button>
                <button
                  type="button"
                  onClick={async () => {
                    await save()
                    setShowContacts(false)
                  }}
                  className="rounded bg-stone-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#8e6937]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------- bits -- */

const inputClass =
  "w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm focus:border-stone-900 focus:outline-none disabled:bg-stone-50 disabled:text-stone-500"

const Section = ({ step, title, children }) => (
  <section className="rounded-lg border border-stone-200 bg-white p-4">
    <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-stone-900">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-stone-900 text-[11px] text-white">{step}</span>
      {title}
    </h2>
    {children}
  </section>
)

const Field = ({ label, hint, children }) => (
  <div>
    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-stone-500" title={hint}>
      {label}
    </label>
    {children}
  </div>
)

const Row = ({ icon, label, value }) => (
  <div className="flex items-center justify-between">
    <dt className="flex items-center gap-1.5 text-stone-600">{icon}{label}</dt>
    <dd className="tabular-nums font-semibold text-stone-900">{value}</dd>
  </div>
)

export default BulkMails
