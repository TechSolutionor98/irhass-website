"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  PanelTop, PanelBottom, Heading, Type, List, Image as ImageIcon, MousePointerClick, Play,
  Columns3, ShoppingBag, Ticket, Share2, Minus, MoveVertical, Code,
  Save, Eye, ArrowLeft, Monitor, Smartphone, Loader2, X, AlertTriangle,
} from "lucide-react"
import AdminSidebar from "../../components/admin/AdminSidebar"
import EmailCanvas from "../../components/admin/email/EmailCanvas"
import BlockSettings from "../../components/admin/email/BlockSettings"
import ProductPicker from "../../components/admin/email/ProductPicker"
import ImageManager from "../../components/admin/email/ImageManager"
import { BLOCK_GROUPS, blocksInGroup, createBlock } from "../../components/admin/email/blockDefs"
import {
  fetchTemplate, createTemplate, updateTemplate, fetchDefaults, renderPreview, errorMessage,
} from "../../services/emailBuilderApi"

/**
 * The email builder.
 *
 * Three columns: blocks to drag in, the email, and the settings for whatever is
 * selected. Text is typed on the canvas rather than in the right-hand panel, because
 * in an email the measure and the typeface are the layout.
 *
 * Preview renders through the server, deliberately. The canvas is an approximation
 * drawn with React; the email that gets sent is tables and inline styles produced by
 * one renderer on the server. Previewing through that same renderer is the only way
 * the preview can be trusted to match what lands in an inbox.
 */

const ICONS = {
  PanelTop, PanelBottom, Heading, Type, List, Image: ImageIcon, MousePointerClick,
  Play, Columns3, ShoppingBag, Ticket, Share2, Minus, MoveVertical, Code,
}

const EmailBuilder = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromDefault = searchParams.get("from")

  const [name, setName] = useState("Untitled design")
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [blocks, setBlocks] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const [templateId, setTemplateId] = useState(id && id !== "new" ? id : null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [dirty, setDirty] = useState(false)

  const [preview, setPreview] = useState(null)
  const [previewWidth, setPreviewWidth] = useState("desktop")

  // Which field a picker is filling. Held rather than passed, because the picker is
  // one shared dialog serving the panel, the columns editor and the canvas.
  const [imageTarget, setImageTarget] = useState(null)
  const [productTarget, setProductTarget] = useState(null)

  const selectedIndex = useMemo(() => blocks.findIndex((b) => b._id === selectedId), [blocks, selectedId])
  const selectedBlock = selectedIndex >= 0 ? blocks[selectedIndex] : null

  /* ------------------------------------------------------------------- load -- */

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError("")
      try {
        if (templateId) {
          const template = await fetchTemplate(templateId)
          if (cancelled) return
          setName(template.name)
          setSubject(template.subject || "")
          setPreheader(template.preheader || "")
          setBlocks(withIds(template.blocks || []))
        } else if (fromDefault) {
          // Started from a built-in design. It is copied into local state here and
          // only becomes a saved design on the first Save -- nothing is written to
          // the database just because somebody opened one to look at it.
          const { templates } = await fetchDefaults()
          const base = templates.find((t) => t.id === fromDefault)
          if (cancelled) return
          if (!base) {
            setError("That starting design no longer exists.")
          } else {
            setName(`${base.name} copy`)
            setSubject(base.subject || "")
            setPreheader(base.preheader || "")
            setBlocks(withIds(base.blocks || []))
          }
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [templateId, fromDefault])

  // Blocks arrive from the server without the editor's ids; it needs them for keys
  // and drag targets, and the renderer ignores them.
  function withIds(list) {
    return list.map((block, index) => ({
      ...block,
      _id: block._id || `b_${index}_${Math.random().toString(36).slice(2, 8)}`,
    }))
  }

  /* ---------------------------------------------------------------- editing -- */

  const mutate = useCallback((updater) => {
    setBlocks(updater)
    setDirty(true)
  }, [])

  const patchBlock = useCallback((index, patch) => {
    mutate((prev) => prev.map((block, i) => (i === index ? { ...block, ...patch } : block)))
  }, [mutate])

  const patchSelected = useCallback((patch) => {
    if (selectedIndex < 0) return
    patchBlock(selectedIndex, patch)
  }, [patchBlock, selectedIndex])

  const moveBlock = useCallback((from, to) => {
    mutate((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [mutate])

  const insertBlock = useCallback((type, index) => {
    const block = createBlock(type)
    if (!block) return
    mutate((prev) => {
      const next = [...prev]
      next.splice(Math.min(index, next.length), 0, block)
      return next
    })
    setSelectedId(block._id)
  }, [mutate])

  const removeBlock = useCallback((index) => {
    mutate((prev) => prev.filter((_, i) => i !== index))
    setSelectedId(null)
  }, [mutate])

  const duplicateBlock = useCallback((index) => {
    mutate((prev) => {
      const copy = { ...prev[index], _id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }
      const next = [...prev]
      next.splice(index + 1, 0, copy)
      return next
    })
  }, [mutate])

  /* ----------------------------------------------------------------- saving -- */

  const save = async () => {
    setSaving(true)
    setError("")
    try {
      // The editor's ids are stripped before saving. They are regenerated on load,
      // so storing them would just be noise that grows every round trip.
      const payload = {
        name,
        subject,
        preheader,
        blocks: blocks.map(({ _id, ...rest }) => rest),
      }

      if (templateId) {
        await updateTemplate(templateId, payload)
      } else {
        const created = await createTemplate({ ...payload, fromDefault: fromDefault || undefined })
        setTemplateId(created._id)
        // Replaces the URL so a reload does not start another copy from the default.
        navigate(`/admin/email-templates/builder/${created._id}`, { replace: true })
      }

      setDirty(false)
      setNotice("Saved")
      window.setTimeout(() => setNotice(""), 2000)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const openPreview = async () => {
    setError("")
    try {
      const { html } = await renderPreview({
        subject,
        preheader,
        blocks: blocks.map(({ _id, ...rest }) => rest),
      })
      setPreview(html)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // The browser's own warning. A design is a lot of work to lose to a stray tab close.
  useEffect(() => {
    if (!dirty) return
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  /* ---------------------------------------------------------------- pickers -- */

  const handleImagePicked = (url) => {
    if (!imageTarget) return
    if (imageTarget.kind === "column") {
      const columns = [...(selectedBlock.columns || [])]
      columns[imageTarget.index] = { ...columns[imageTarget.index], image: url }
      patchSelected({ columns })
    } else {
      patchSelected({ [imageTarget.key]: url })
    }
    setImageTarget(null)
  }

  const handleProductPicked = (product) => {
    if (productTarget?.kind === "column") {
      const columns = [...(selectedBlock.columns || [])]
      columns[productTarget.index] = {
        ...columns[productTarget.index],
        image: product.image,
        heading: product.name,
        text: product.price,
        href: product.url,
        buttonLabel: "Shop now",
      }
      patchSelected({ columns })
    } else {
      // The snapshot, field by field. Nothing here points back at the catalogue.
      patchSelected({
        name: product.name,
        category: product.category,
        price: product.price,
        oldPrice: product.oldPrice,
        badge: product.badge,
        image: product.image,
        url: product.url,
      })
    }
    setProductTarget(null)
  }

  /* ------------------------------------------------------------------ render -- */

  return (
    <div className="flex min-h-screen bg-stone-100">
      <AdminSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/admin/email-templates")}
            className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft size={16} /> Templates
          </button>

          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setDirty(true)
            }}
            className="min-w-[160px] flex-1 rounded border border-transparent px-2 py-1 text-sm font-semibold text-stone-900 hover:border-stone-300 focus:border-stone-900 focus:outline-none"
          />

          {notice && <span className="text-xs font-medium text-green-700">{notice}</span>}
          {dirty && !notice && <span className="text-xs text-stone-400">Unsaved changes</span>}

          <button
            type="button"
            onClick={openPreview}
            className="inline-flex items-center gap-1.5 rounded border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-900"
          >
            <Eye size={15} /> Preview
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded bg-stone-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#8e6937] disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
          </button>
        </div>

        {/* Subject + preheader */}
        <div className="grid flex-shrink-0 gap-3 border-b border-stone-200 bg-white px-4 py-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wider text-stone-500">Subject line</label>
            <input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
                setDirty(true)
              }}
              placeholder="What the inbox shows first"
              className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm focus:border-stone-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wider text-stone-500" title="The grey line most inboxes show after the subject. Leave it blank and the client pulls the first words of the email instead.">
              Preview text
            </label>
            <input
              value={preheader}
              onChange={(e) => {
                setPreheader(e.target.value)
                setDirty(true)
              }}
              placeholder="The grey line after the subject"
              className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm focus:border-stone-900 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="flex flex-shrink-0 items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Three columns */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Palette */}
          <div className="hidden w-48 flex-shrink-0 overflow-y-auto border-r border-stone-200 bg-white p-3 lg:block">
            {BLOCK_GROUPS.map((group) => (
              <div key={group} className="mb-4">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">{group}</p>
                <div className="space-y-1">
                  {blocksInGroup(group).map((block) => {
                    const Icon = ICONS[block.icon] || Type
                    return (
                      <div
                        key={block.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "copy"
                          e.dataTransfer.setData("application/x-email-block", block.type)
                          // Firefox refuses to begin a drag with no text/plain payload.
                          e.dataTransfer.setData("text/plain", block.type)
                        }}
                        // Click adds to the end, for anyone who would rather not drag.
                        onClick={() => insertBlock(block.type, blocks.length)}
                        title={block.hint}
                        className="flex cursor-grab items-center gap-2 rounded border border-stone-200 px-2 py-1.5 text-xs text-stone-700 transition-colors hover:border-stone-900 hover:bg-stone-50 active:cursor-grabbing"
                      >
                        <Icon size={14} className="flex-shrink-0 text-stone-400" />
                        {block.label}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div className="min-w-0 flex-1 overflow-y-auto bg-stone-100 p-6" onClick={() => setSelectedId(null)}>
            {loading ? (
              <p className="py-20 text-center text-sm text-stone-500">Loading…</p>
            ) : (
              <div onClick={(e) => e.stopPropagation()}>
                <EmailCanvas
                  blocks={blocks}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onPatch={patchBlock}
                  onMove={moveBlock}
                  onRemove={removeBlock}
                  onDuplicate={duplicateBlock}
                  onDropNew={insertBlock}
                />
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="w-72 flex-shrink-0 overflow-y-auto border-l border-stone-200 bg-white">
            <BlockSettings
              block={selectedBlock}
              onPatch={patchSelected}
              onBrowseImage={(key) => setImageTarget({ kind: "field", key })}
              onPickProduct={() => setProductTarget({ kind: "block" })}
              onBrowseColumnImage={(index) => setImageTarget({ kind: "column", index })}
              onPickColumnProduct={(index) => setProductTarget({ kind: "column", index })}
            />
          </div>
        </div>
      </div>

      <ImageManager open={Boolean(imageTarget)} onClose={() => setImageTarget(null)} onSelect={handleImagePicked} />
      <ProductPicker open={Boolean(productTarget)} onClose={() => setProductTarget(null)} onPick={handleProductPicked} />

      {/* Preview. An iframe with srcDoc, so the email's own styles are sandboxed from
          the admin's -- rendering it inline would let the admin stylesheet reach in
          and show something nobody will actually receive. */}
      {preview !== null && (
        <div className="fixed inset-0 z-[75] flex flex-col bg-black/60 p-4">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col rounded-lg bg-white">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-200 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900">Preview</h3>
                <span className="text-xs text-stone-400">Merge fields filled with sample values</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPreviewWidth("desktop")} className={`grid h-7 w-7 place-items-center rounded ${previewWidth === "desktop" ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"}`} title="Desktop">
                  <Monitor size={14} />
                </button>
                <button type="button" onClick={() => setPreviewWidth("mobile")} className={`grid h-7 w-7 place-items-center rounded ${previewWidth === "mobile" ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"}`} title="Phone">
                  <Smartphone size={14} />
                </button>
                <button type="button" onClick={() => setPreview(null)} className="text-stone-400 hover:text-stone-900" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-stone-100 p-4">
              <iframe
                title="Email preview"
                srcDoc={preview}
                sandbox=""
                className="mx-auto block h-full border-0 bg-white"
                style={{ width: previewWidth === "mobile" ? 390 : "100%", maxWidth: "100%" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmailBuilder
