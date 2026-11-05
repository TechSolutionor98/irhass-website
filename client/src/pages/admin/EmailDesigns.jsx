"use client"

import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Copy, Trash2, Pencil, Lock, Loader2, AlertTriangle, LayoutTemplate, Mail } from "lucide-react"
import AdminSidebar from "../../components/admin/AdminSidebar"
import {
  fetchDefaults, fetchTemplates, duplicateTemplate, deleteTemplate, createTemplate, errorMessage,
} from "../../services/emailBuilderApi"

/**
 * Default Templates and My Templates.
 *
 * Defaults open first, because on a fresh install the other tab is empty and a blank
 * screen is a poor answer to "make me an email".
 *
 * The defaults cannot be edited. They are not rows in the database at all -- they
 * live in the server's code -- so there is no edit path to offer and no way for one
 * admin to leave everybody else without a usable starting point. Picking one starts
 * a new design from it, and that copy saves into My Templates.
 */

const Card = ({ children, onClick }) => (
  <div
    onClick={onClick}
    className={`flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white transition-shadow ${onClick ? "cursor-pointer hover:shadow-md" : ""}`}
  >
    {children}
  </div>
)

/**
 * A sketch of the layout rather than a rendered thumbnail. A real render would mean
 * a screenshot pipeline for something whose only job is to say "this is the one with
 * three cards" -- the bars do that at a glance and cost nothing.
 */
const LayoutSketch = ({ shape }) => {
  const bar = (key, className, style) => <div key={key} className={className} style={style} />

  const rows = {
    "product-announcement": [
      bar("m", "h-3 rounded-sm bg-stone-300"),
      bar("b", "h-10 rounded-sm bg-stone-200"),
      bar("h", "mx-auto h-2.5 w-1/2 rounded-sm bg-stone-300"),
      <div key="p" className="flex gap-1.5">
        <div className="h-10 w-2/5 rounded-sm bg-[#e5d3ba]" />
        <div className="flex-1 space-y-1 py-1">
          <div className="h-1.5 w-full rounded-sm bg-stone-200" />
          <div className="h-1.5 w-2/3 rounded-sm bg-stone-200" />
          <div className="h-3 w-1/2 rounded-sm bg-stone-800" />
        </div>
      </div>,
      bar("f", "h-5 rounded-sm bg-[#181816]"),
    ],
    "three-products": [
      bar("m", "h-3 rounded-sm bg-stone-300"),
      bar("b", "h-10 rounded-sm bg-stone-200"),
      bar("h", "mx-auto h-2.5 w-1/2 rounded-sm bg-stone-300"),
      <div key="c" className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 space-y-1">
            <div className="h-8 rounded-sm bg-[#e5d3ba]" />
            <div className="h-1.5 rounded-sm bg-stone-200" />
            <div className="h-2.5 rounded-sm bg-stone-800" />
          </div>
        ))}
      </div>,
      bar("f", "h-5 rounded-sm bg-[#181816]"),
    ],
    "banner-promotion": [
      bar("m", "h-3 rounded-sm bg-stone-300"),
      bar("b", "h-10 rounded-sm bg-stone-200"),
      bar("h", "mx-auto h-2.5 w-1/2 rounded-sm bg-stone-300"),
      bar("b2", "h-7 rounded-sm bg-stone-200"),
      bar("c", "h-9 rounded-sm border-2 border-dashed border-[#b4874a] bg-[#faf6f0]"),
      bar("f", "h-5 rounded-sm bg-[#181816]"),
    ],
  }

  return <div className="space-y-1.5 bg-stone-50 p-3">{rows[shape] || rows["product-announcement"]}</div>
}

const EmailDesigns = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState("defaults")
  const [defaults, setDefaults] = useState([])
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [defaultsData, templates] = await Promise.all([fetchDefaults(), fetchTemplates()])
      setDefaults(defaultsData.templates || [])
      setMine(templates || [])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startFromDefault = (defaultId) => {
    // Opened in the builder, not written to the database. Looking at a starting
    // design should not litter My Templates with copies nobody asked for.
    navigate(`/admin/email-templates/builder/new?from=${encodeURIComponent(defaultId)}`)
  }

  const startBlank = async () => {
    setBusy(true)
    setError("")
    try {
      const created = await createTemplate({ name: "Untitled design", blocks: [] })
      navigate(`/admin/email-templates/builder/${created._id}`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const copy = async (id) => {
    setBusy(true)
    try {
      await duplicateTemplate(id)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (template) => {
    if (!window.confirm(`Delete “${template.name}”? Campaigns already sent keep their own copy and are unaffected.`)) return
    setBusy(true)
    try {
      await deleteTemplate(template._id)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar />

      <div className="min-w-0 flex-1 p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Email Designs</h1>
            <p className="mt-0.5 text-sm text-stone-500">Build an email once, then send it to whoever you choose.</p>
          </div>
          <button
            type="button"
            onClick={startBlank}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-[#8e6937] disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Start blank
          </button>
        </div>

        <div className="mb-5 flex gap-1 border-b border-stone-200">
          {[
            { id: "defaults", label: "Default Templates", count: defaults.length },
            { id: "mine", label: "My Templates", count: mine.length },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === item.id ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
              }`}
            >
              {item.label}
              <span className="ml-1.5 text-xs text-stone-400">{item.count}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <p className="py-16 text-center text-sm text-stone-500">Loading…</p>
        ) : tab === "defaults" ? (
          <>
            <p className="mb-4 inline-flex items-center gap-1.5 rounded bg-stone-100 px-3 py-1.5 text-xs text-stone-600">
              <Lock size={13} /> These three cannot be changed. Picking one starts a new design in My Templates.
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {defaults.map((template) => (
                <Card key={template.id} onClick={() => startFromDefault(template.id)}>
                  <LayoutSketch shape={template.id} />
                  <div className="flex flex-1 flex-col border-t border-stone-200 p-4">
                    <h3 className="text-sm font-bold text-stone-900">{template.name}</h3>
                    <p className="mt-1 flex-1 text-xs leading-relaxed text-stone-500">{template.description}</p>
                    <p className="mt-3 text-[11px] text-stone-400">{template.preview}</p>
                    <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white">
                      <LayoutTemplate size={13} /> Use this design
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : !mine.length ? (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white py-16 text-center">
            <Mail size={28} className="mx-auto mb-3 text-stone-300" />
            <p className="text-sm text-stone-600">Nothing saved yet.</p>
            <p className="mt-1 text-xs text-stone-400">Start from one of the default templates, or build one from blank.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((template) => (
              <Card key={template._id}>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-sm font-bold text-stone-900">{template.name}</h3>
                  <p className="mt-1 flex-1 text-xs text-stone-500">
                    {template.subject || <span className="text-stone-400">No subject line yet</span>}
                  </p>
                  <p className="mt-3 text-[11px] text-stone-400">
                    {template.basedOn ? `From ${template.basedOn} · ` : ""}
                    Updated {new Date(template.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 border-t border-stone-200 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/email-templates/builder/${template._id}`)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(template._id)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
                  >
                    <Copy size={13} /> Duplicate
                  </button>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => remove(template)}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-stone-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default EmailDesigns
