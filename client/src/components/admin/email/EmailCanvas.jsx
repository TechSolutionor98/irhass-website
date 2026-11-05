"use client"

import { useState } from "react"
import { ChevronUp, ChevronDown, Copy, Trash2, GripVertical, ImagePlus } from "lucide-react"
import { EMAIL_THEME as T } from "./emailTheme"
import { BLOCK_DEFS } from "./blockDefs"
import RichText from "./RichText"
import { getFullImageUrl } from "../../../utils/imageUtils"

/**
 * The canvas.
 *
 * Deliberately an approximation, not the email. The real markup is tables with inline
 * styles and is produced on the server by the one renderer the sender also uses --
 * reproducing it here would mean a second renderer, and two renderers drift until the
 * preview is quietly lying about what was sent. Preview shows the real thing.
 *
 * What this has to get right is the look: the same type, colours, widths and spacing,
 * so a judgement made here holds in the inbox.
 */

const img = (src) => (src ? getFullImageUrl(src) : "")

const Placeholder = ({ label, height = 120 }) => (
  <div
    className="flex flex-col items-center justify-center gap-1 border border-dashed border-stone-300 bg-stone-50 text-[11px] text-stone-400"
    style={{ height }}
  >
    <ImagePlus size={18} />
    {label}
  </div>
)

/** One block, drawn as it will look. */
const BlockPreview = ({ block, active, onChange }) => {
  const pad = { paddingTop: block.paddingTop ?? 0, paddingBottom: block.paddingBottom ?? 0 }

  switch (block.type) {
    case "masthead":
      return (
        <div className="flex items-center justify-between gap-4 border-b px-8 py-6" style={{ background: block.background || T.white, borderColor: T.border }}>
          {block.logo ? (
            <img src={img(block.logo)} alt="" style={{ width: block.logoWidth || 150 }} />
          ) : (
            <div style={{ fontFamily: T.fontHeading, fontSize: 20, color: T.ink }}>{block.companyName || "Irha's Wardrobe"}</div>
          )}
          <span style={{ fontFamily: T.fontBody, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: T.muted }}>
            {block.tagline}
          </span>
        </div>
      )

    case "heading":
      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32 }}>
          <RichText
            active={active}
            value={block.html}
            onChange={(html) => onChange({ html })}
            placeholder="Your headline"
            style={{
              fontFamily: T.fontHeading,
              fontSize: block.fontSize || 28,
              lineHeight: 1.3,
              color: block.color || T.ink,
              textAlign: block.align || "center",
            }}
          />
        </div>
      )

    case "text":
      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32 }}>
          <RichText
            active={active}
            value={block.html}
            onChange={(html) => onChange({ html })}
            style={{
              fontFamily: T.fontBody,
              fontSize: block.fontSize || 15,
              lineHeight: 1.7,
              color: block.color || T.text,
              textAlign: block.align || "left",
            }}
          />
        </div>
      )

    case "list": {
      const Tag = block.ordered ? "ol" : "ul"
      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32 }}>
          <Tag style={{ margin: 0, paddingLeft: 22, fontFamily: T.fontBody, fontSize: block.fontSize || 15, lineHeight: 1.7, color: block.color || T.text, listStyleType: block.ordered ? "decimal" : "disc" }}>
            {(block.items || []).map((item, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{item}</li>
            ))}
          </Tag>
        </div>
      )
    }

    case "image":
      if (!block.src) {
        return (
          <div style={{ ...pad, paddingLeft: block.fullWidth ? 0 : 32, paddingRight: block.fullWidth ? 0 : 32 }}>
            <Placeholder label="Choose an image" height={block.fullWidth ? 180 : 140} />
          </div>
        )
      }
      return (
        <div style={{ ...pad, paddingLeft: block.fullWidth ? 0 : 32, paddingRight: block.fullWidth ? 0 : 32, textAlign: block.align || "center" }}>
          <img
            src={img(block.src)}
            alt={block.alt || ""}
            style={{
              display: "inline-block",
              maxWidth: "100%",
              width: block.fullWidth ? "100%" : block.width || undefined,
              borderRadius: block.radius || 0,
            }}
          />
        </div>
      )

    case "button":
      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32, textAlign: block.align || "center" }}>
          <span
            style={{
              display: block.fullWidth ? "block" : "inline-block",
              background: block.background || T.ink,
              color: block.color || T.white,
              borderRadius: block.radius || 0,
              padding: "14px 32px",
              fontFamily: T.fontBody,
              fontSize: 13,
              fontWeight: "bold",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            {block.label || "Shop now"}
          </span>
        </div>
      )

    case "video":
      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32, textAlign: "center" }}>
          {block.poster ? (
            <img src={img(block.poster)} alt="" style={{ maxWidth: "100%", borderRadius: block.radius || 0 }} />
          ) : (
            <Placeholder label="Choose a still image" height={160} />
          )}
          <div className="mt-3">
            <span style={{ display: "inline-block", background: T.ink, color: T.white, padding: "14px 32px", fontFamily: T.fontBody, fontSize: 13, fontWeight: "bold", letterSpacing: 1.5, textTransform: "uppercase" }}>
              {block.label || "Watch the film"}
            </span>
          </div>
        </div>
      )

    case "columns": {
      const cols = block.columns || []
      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32 }}>
          <div className="flex" style={{ gap: block.gutter ?? 16 }}>
            {cols.map((col, i) => (
              <div key={i} className="min-w-0 flex-1">
                {col.image ? (
                  <img src={img(col.image)} alt="" style={{ width: "100%", borderRadius: col.radius || 0 }} />
                ) : (
                  <Placeholder label="Image" height={110} />
                )}
                {col.heading && <p style={{ margin: "12px 0 6px", fontFamily: T.fontHeading, fontSize: 16, color: T.ink }}>{col.heading}</p>}
                {col.text && <p style={{ margin: 0, fontFamily: T.fontBody, fontSize: 13, lineHeight: 1.6, color: T.muted }}>{col.text}</p>}
                {col.buttonLabel && (
                  <span style={{ display: "inline-block", marginTop: 12, background: T.ink, color: T.white, padding: "10px 18px", fontFamily: T.fontBody, fontSize: 11, fontWeight: "bold", letterSpacing: 1.2, textTransform: "uppercase" }}>
                    {col.buttonLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    case "product": {
      const details = (
        <div className="min-w-0 flex-1">
          {block.badge && (
            <span style={{ display: "inline-block", marginBottom: 10, background: T.gold, color: T.white, padding: "4px 10px", fontFamily: T.fontBody, fontSize: 11, fontWeight: "bold", letterSpacing: 1, textTransform: "uppercase" }}>
              {block.badge}
            </span>
          )}
          {block.category && <p style={{ margin: "0 0 6px", fontFamily: T.fontBody, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: T.muted }}>{block.category}</p>}
          <p style={{ margin: "0 0 8px", fontFamily: T.fontHeading, fontSize: 19, lineHeight: 1.35, color: T.ink }}>
            {block.name || "Choose a product"}
          </p>
          {block.description && <p style={{ margin: "0 0 10px", fontFamily: T.fontBody, fontSize: 13, lineHeight: 1.6, color: T.muted }}>{block.description}</p>}
          <p style={{ margin: "0 0 16px" }}>
            <span style={{ fontFamily: T.fontBody, fontSize: 17, fontWeight: "bold", color: T.ink }}>{block.price}</span>
            {block.oldPrice && <span style={{ marginLeft: 8, fontFamily: T.fontBody, fontSize: 14, color: T.muted, textDecoration: "line-through" }}>{block.oldPrice}</span>}
          </p>
          <span style={{ display: "inline-block", background: T.ink, color: T.white, padding: "12px 24px", fontFamily: T.fontBody, fontSize: 12, fontWeight: "bold", letterSpacing: 1.4, textTransform: "uppercase" }}>
            {block.buttonLabel || "Shop now"}
          </span>
        </div>
      )

      const picture = block.image ? (
        <img src={img(block.image)} alt="" style={{ width: block.layout === "stacked" ? "100%" : 240, flexShrink: 0 }} />
      ) : (
        <div style={{ width: block.layout === "stacked" ? "100%" : 240, flexShrink: 0 }}>
          <Placeholder label="Product picture" height={block.layout === "stacked" ? 200 : 180} />
        </div>
      )

      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32 }}>
          <div className={block.layout === "stacked" ? "space-y-4" : "flex gap-4"}>
            {picture}
            {details}
          </div>
        </div>
      )
    }

    case "coupon":
      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32 }}>
          <div style={{ background: block.background || T.cream, border: `2px dashed ${block.borderColor || T.gold}`, padding: "26px 20px", textAlign: "center" }}>
            {block.heading && <p style={{ margin: "0 0 8px", fontFamily: T.fontBody, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: T.goldDark }}>{block.heading}</p>}
            <p style={{ margin: "0 0 10px", fontFamily: T.fontHeading, fontSize: 30, color: T.ink }}>{block.code}</p>
            {block.description && <p style={{ margin: "0 0 16px", fontFamily: T.fontBody, fontSize: 13, lineHeight: 1.6, color: T.text }}>{block.description}</p>}
            {block.buttonLabel && (
              <span style={{ display: "inline-block", background: T.ink, color: T.white, padding: "14px 32px", fontFamily: T.fontBody, fontSize: 13, fontWeight: "bold", letterSpacing: 1.5, textTransform: "uppercase" }}>
                {block.buttonLabel}
              </span>
            )}
            {block.expiry && <p style={{ margin: "14px 0 0", fontFamily: T.fontBody, fontSize: 11, color: T.muted }}>{block.expiry}</p>}
          </div>
        </div>
      )

    case "social":
      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32, textAlign: "center" }}>
          {(block.links || []).map((link, i) => (
            <span key={i} style={{ margin: "0 10px", fontFamily: T.fontBody, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: block.color || T.muted, textDecoration: "underline" }}>
              {link.label}
            </span>
          ))}
        </div>
      )

    case "divider":
      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32 }}>
          <div style={{ borderTop: `${block.thickness || 1}px solid ${block.color || T.border}` }} />
        </div>
      )

    case "spacer":
      return (
        <div style={{ height: block.height || 24 }} className="relative">
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] uppercase tracking-wider text-stone-300">
            {block.height || 24}px
          </span>
        </div>
      )

    case "footer":
      return (
        <div style={{ background: block.background || T.ink, padding: 32, textAlign: "center", fontFamily: T.fontBody, fontSize: 12, lineHeight: 1.8, color: "#a8a29e" }}>
          {block.companyName && <p style={{ margin: "0 0 6px", fontFamily: T.fontHeading, fontSize: 16, color: T.white }}>{block.companyName}</p>}
          {block.address && <p style={{ margin: "0 0 6px" }}>{block.address}</p>}
          {block.contact && <p style={{ margin: "0 0 14px" }}>{block.contact}</p>}
          <p style={{ margin: 0 }}>
            <span style={{ textDecoration: "underline" }}>Unsubscribe</span>
            {" · "}
            <span style={{ textDecoration: "underline" }}>Visit the shop</span>
          </p>
          {block.note && <p style={{ margin: "12px 0 0", fontSize: 11, color: "#78716c" }}>{block.note}</p>}
        </div>
      )

    case "html":
      return (
        <div style={{ ...pad, paddingLeft: 32, paddingRight: 32 }}>
          <div className="border border-dashed border-stone-300 p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-stone-400">Custom HTML</p>
            <div dangerouslySetInnerHTML={{ __html: block.html || "" }} />
          </div>
        </div>
      )

    default:
      return <div className="px-8 py-4 text-xs text-stone-400">Unknown block: {block.type}</div>
  }
}

/**
 * @param {object[]} blocks
 * @param {string|null} selectedId
 * @param {(index: number, patch: object) => void} onPatch
 * @param {(from: number, to: number) => void} onMove
 * @param {(type: string, index: number) => void} onDropNew  from the palette
 */
const EmailCanvas = ({ blocks, selectedId, onSelect, onPatch, onMove, onRemove, onDuplicate, onDropNew }) => {
  // Where a drop would land. Null means no drag is over the canvas.
  const [dropIndex, setDropIndex] = useState(null)
  const [draggingIndex, setDraggingIndex] = useState(null)

  const handleDragOver = (event, index) => {
    event.preventDefault()
    // Above or below the midpoint decides which side of this block it lands on, so
    // the indicator sits where the block will actually go.
    const rect = event.currentTarget.getBoundingClientRect()
    const after = event.clientY > rect.top + rect.height / 2
    setDropIndex(after ? index + 1 : index)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const target = dropIndex

    setDropIndex(null)
    const from = draggingIndex
    setDraggingIndex(null)
    if (target === null) return

    const paletteType = event.dataTransfer.getData("application/x-email-block")
    if (paletteType) {
      onDropNew(paletteType, target)
      return
    }

    if (from !== null && from !== target) {
      // Removing the block first shifts everything after it down by one, so a move
      // downwards has to target one index earlier than the indicator showed.
      onMove(from, target > from ? target - 1 : target)
    }
  }

  const DropLine = ({ at }) =>
    dropIndex === at ? <div className="h-0.5 bg-stone-900" /> : null

  return (
    <div
      className="mx-auto"
      style={{ width: T.contentWidth, maxWidth: "100%" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onDragLeave={(e) => {
        // Only clear when the pointer actually left the canvas, not when it crossed
        // from one block to the next inside it.
        if (!e.currentTarget.contains(e.relatedTarget)) setDropIndex(null)
      }}
    >
      <div className="bg-white shadow-sm">
        <DropLine at={0} />

        {blocks.map((block, index) => {
          const def = BLOCK_DEFS[block.type]
          const isSelected = block._id === selectedId

          return (
            <div key={block._id || index}>
              <div
                onDragOver={(e) => handleDragOver(e, index)}
                onClick={() => onSelect(block._id)}
                className={`group relative transition-shadow ${
                  isSelected ? "ring-2 ring-inset ring-stone-900" : "hover:ring-1 hover:ring-inset hover:ring-stone-300"
                } ${draggingIndex === index ? "opacity-40" : ""}`}
              >
                {/* The block's own controls. Shown on hover or when selected so the
                    canvas still reads as the email rather than a toolbar grid. */}
                <div
                  className={`absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded border border-stone-200 bg-white p-0.5 shadow-sm transition-opacity ${
                    isSelected ? "opacity-100" : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
                  }`}
                >
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDraggingIndex(index)
                      e.dataTransfer.effectAllowed = "move"
                      // Firefox will not start a drag without data on the transfer.
                      e.dataTransfer.setData("text/plain", String(index))
                    }}
                    onDragEnd={() => {
                      setDraggingIndex(null)
                      setDropIndex(null)
                    }}
                    title="Drag to reorder"
                    className="grid h-6 w-6 cursor-grab place-items-center text-stone-400 hover:text-stone-900 active:cursor-grabbing"
                  >
                    <GripVertical size={13} />
                  </span>
                  <button type="button" title="Move up" disabled={index === 0} onClick={(e) => { e.stopPropagation(); onMove(index, index - 1) }} className="grid h-6 w-6 place-items-center text-stone-400 hover:text-stone-900 disabled:opacity-30">
                    <ChevronUp size={13} />
                  </button>
                  <button type="button" title="Move down" disabled={index === blocks.length - 1} onClick={(e) => { e.stopPropagation(); onMove(index, index + 1) }} className="grid h-6 w-6 place-items-center text-stone-400 hover:text-stone-900 disabled:opacity-30">
                    <ChevronDown size={13} />
                  </button>
                  <button type="button" title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate(index) }} className="grid h-6 w-6 place-items-center text-stone-400 hover:text-stone-900">
                    <Copy size={13} />
                  </button>
                  <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); onRemove(index) }} className="grid h-6 w-6 place-items-center text-stone-400 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                </div>

                {isSelected && (
                  <span className="absolute -top-3 left-2 z-10 rounded bg-stone-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    {def?.label || block.type}
                  </span>
                )}

                <BlockPreview block={block} active={isSelected} onChange={(patch) => onPatch(index, patch)} />
              </div>

              <DropLine at={index + 1} />
            </div>
          )
        })}

        {!blocks.length && (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDropIndex(0)
            }}
            className="grid h-64 place-items-center border-2 border-dashed border-stone-300 text-sm text-stone-400"
          >
            Drag a block here to begin
          </div>
        )}
      </div>
    </div>
  )
}

export default EmailCanvas
