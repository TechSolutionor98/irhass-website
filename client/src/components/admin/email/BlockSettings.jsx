"use client"

import { useState } from "react"
import { Plus, Trash2, Image as ImageIcon, PackageSearch, Settings2 } from "lucide-react"
import { BLOCK_DEFS } from "./blockDefs"
import { BRAND_SWATCHES } from "./emailTheme"
import { getFullImageUrl } from "../../../utils/imageUtils"

/**
 * The settings for whichever block is selected.
 *
 * Every control a block has lives here, driven by the `fields` list each block
 * declares in blockDefs.js. Adding a setting to a block means adding one line there,
 * not editing this file -- which is what keeps fourteen block types from turning into
 * fourteen bespoke panels that drift apart.
 *
 * Text content is the exception: it is edited on the canvas, where the measure and
 * the typeface are real.
 */

const Label = ({ children, hint }) => (
  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-stone-500" title={hint || undefined}>
    {children}
  </label>
)

const inputClass =
  "w-full rounded border border-stone-300 px-2.5 py-1.5 text-sm text-stone-900 focus:border-stone-900 focus:outline-none"

const ColourField = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#000000"}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-10 flex-shrink-0 cursor-pointer rounded border border-stone-300 bg-white"
    />
    <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    <div className="flex flex-shrink-0 gap-1">
      {BRAND_SWATCHES.slice(0, 4).map((swatch) => (
        <button
          key={swatch.value}
          type="button"
          title={swatch.label}
          onClick={() => onChange(swatch.value)}
          className="h-6 w-6 rounded border border-stone-300"
          style={{ background: swatch.value }}
        />
      ))}
    </div>
  </div>
)

const NumberField = ({ value, onChange, min, max, unit }) => (
  <div className="flex items-center gap-2">
    <input
      type="range"
      min={min}
      max={max}
      value={Number(value) || min || 0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1 min-w-0 flex-1 accent-stone-900"
    />
    <input
      type="number"
      min={min}
      max={max}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      // Clamped when the field is left, not while typing: clamping on every keystroke
      // makes "10" impossible to type in a field whose minimum is 11.
      onBlur={(e) => {
        const n = Number(e.target.value)
        onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min)
      }}
      className="w-14 flex-shrink-0 rounded border border-stone-300 px-1.5 py-1 text-center text-xs"
    />
    <span className="w-5 flex-shrink-0 text-[11px] text-stone-400">{unit}</span>
  </div>
)

const ImageField = ({ value, onChange, onBrowse }) => (
  <div className="space-y-2">
    {value ? (
      <div className="flex items-center gap-2">
        <img src={getFullImageUrl(value)} alt="" className="h-12 w-16 flex-shrink-0 rounded border border-stone-200 object-contain" />
        <button type="button" onClick={() => onChange("")} className="text-xs text-red-600 hover:underline">
          Remove
        </button>
      </div>
    ) : null}
    <div className="flex gap-2">
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/emails/…" className={inputClass} />
      <button
        type="button"
        onClick={onBrowse}
        className="flex-shrink-0 rounded border border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-900"
      >
        <ImageIcon size={14} />
      </button>
    </div>
  </div>
)

const LinesField = ({ value, onChange }) => {
  const items = Array.isArray(value) ? value : []
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex gap-1.5">
          <input
            value={item}
            onChange={(e) => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, index) => index !== i))}
            className="flex-shrink-0 px-1 text-stone-400 hover:text-red-600"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])} className="inline-flex items-center gap-1 text-xs font-medium text-stone-700 hover:underline">
        <Plus size={13} /> Add
      </button>
    </div>
  )
}

const LinksField = ({ value, onChange }) => {
  const links = Array.isArray(value) ? value : []
  return (
    <div className="space-y-2">
      {links.map((link, i) => (
        <div key={i} className="space-y-1 rounded border border-stone-200 p-2">
          <div className="flex gap-1.5">
            <input
              value={link.label || ""}
              placeholder="Label"
              onChange={(e) => {
                const next = [...links]
                next[i] = { ...next[i], label: e.target.value }
                onChange(next)
              }}
              className={inputClass}
            />
            <button type="button" onClick={() => onChange(links.filter((_, index) => index !== i))} className="flex-shrink-0 px-1 text-stone-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
          <input
            value={link.url || ""}
            placeholder="https://…"
            onChange={(e) => {
              const next = [...links]
              next[i] = { ...next[i], url: e.target.value }
              onChange(next)
            }}
            className={inputClass}
          />
        </div>
      ))}
      <button type="button" onClick={() => onChange([...links, { label: "", url: "" }])} className="inline-flex items-center gap-1 text-xs font-medium text-stone-700 hover:underline">
        <Plus size={13} /> Add link
      </button>
    </div>
  )
}

const ColumnsField = ({ value, onChange, onBrowseImage, onPickProduct }) => {
  const columns = Array.isArray(value) ? value : []
  const [openIndex, setOpenIndex] = useState(0)

  const patch = (index, changes) => {
    const next = [...columns]
    next[index] = { ...next[index], ...changes }
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {columns.map((col, i) => (
        <div key={i} className="rounded border border-stone-200">
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? -1 : i)}
            className="flex w-full items-center justify-between px-2.5 py-2 text-left text-xs font-semibold text-stone-700"
          >
            <span>Column {i + 1}{col.heading ? ` · ${col.heading}` : ""}</span>
            <Settings2 size={13} className="text-stone-400" />
          </button>

          {openIndex === i && (
            <div className="space-y-2 border-t border-stone-200 p-2.5">
              <button
                type="button"
                onClick={() => onPickProduct(i)}
                className="flex w-full items-center justify-center gap-1.5 rounded border border-stone-300 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-900"
              >
                <PackageSearch size={13} /> Choose a product
              </button>

              <ImageField value={col.image} onChange={(v) => patch(i, { image: v })} onBrowse={() => onBrowseImage(i)} />
              <input value={col.heading || ""} placeholder="Heading" onChange={(e) => patch(i, { heading: e.target.value })} className={inputClass} />
              <input value={col.text || ""} placeholder="Line of text" onChange={(e) => patch(i, { text: e.target.value })} className={inputClass} />
              <input value={col.href || ""} placeholder="Links to" onChange={(e) => patch(i, { href: e.target.value })} className={inputClass} />
              <input value={col.buttonLabel || ""} placeholder="Button label (blank for none)" onChange={(e) => patch(i, { buttonLabel: e.target.value })} className={inputClass} />

              <button type="button" onClick={() => onChange(columns.filter((_, index) => index !== i))} className="text-xs text-red-600 hover:underline">
                Remove column
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Four columns inside 536px leaves each one 125px wide, which is narrower than
          most product pictures read at. Three is the practical ceiling. */}
      {columns.length < 3 && (
        <button
          type="button"
          onClick={() => onChange([...columns, { image: "", heading: "Heading", text: "", href: "/shop", buttonLabel: "Shop now" }])}
          className="inline-flex items-center gap-1 text-xs font-medium text-stone-700 hover:underline"
        >
          <Plus size={13} /> Add column
        </button>
      )}
    </div>
  )
}

const BlockSettings = ({ block, onPatch, onBrowseImage, onPickProduct, onBrowseColumnImage, onPickColumnProduct }) => {
  if (!block) {
    return (
      <div className="px-4 py-10 text-center text-sm text-stone-400">
        <Settings2 size={22} className="mx-auto mb-2 text-stone-300" />
        Select a block to change its settings.
      </div>
    )
  }

  const def = BLOCK_DEFS[block.type]
  if (!def) return <div className="px-4 py-6 text-sm text-stone-500">No settings for this block.</div>

  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-bold text-stone-900">{def.label}</h3>
        {def.hint && <p className="mt-0.5 text-xs text-stone-500">{def.hint}</p>}
        {def.editable && <p className="mt-1 text-xs text-stone-400">Click the words on the canvas to edit them.</p>}
      </div>

      {def.fields.map((field) => {
        const value = block[field.key]

        if (field.kind === "product") {
          return (
            <button
              key={field.key}
              type="button"
              onClick={onPickProduct}
              className="flex w-full items-center justify-center gap-2 rounded bg-stone-900 py-2 text-xs font-semibold text-white hover:bg-[#8e6937]"
            >
              <PackageSearch size={14} /> Choose a product
            </button>
          )
        }

        return (
          <div key={field.key}>
            <Label hint={field.hint}>{field.label}</Label>

            {field.kind === "text" && (
              <input value={value || ""} onChange={(e) => onPatch({ [field.key]: e.target.value })} className={inputClass} />
            )}

            {field.kind === "url" && (
              <input
                value={value || ""}
                placeholder="https://… or /shop"
                onChange={(e) => onPatch({ [field.key]: e.target.value })}
                className={inputClass}
              />
            )}

            {field.kind === "textarea" && (
              <textarea
                value={value || ""}
                rows={field.rows || 3}
                onChange={(e) => onPatch({ [field.key]: e.target.value })}
                className={`${inputClass} resize-y ${field.mono ? "font-mono text-xs" : ""}`}
              />
            )}

            {field.kind === "number" && (
              <NumberField value={value} onChange={(v) => onPatch({ [field.key]: v })} min={field.min} max={field.max} unit={field.unit} />
            )}

            {field.kind === "colour" && <ColourField value={value} onChange={(v) => onPatch({ [field.key]: v })} />}

            {field.kind === "select" && (
              <select value={value || field.options[0]} onChange={(e) => onPatch({ [field.key]: e.target.value })} className={inputClass}>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}

            {field.kind === "toggle" && (
              <button
                type="button"
                onClick={() => onPatch({ [field.key]: !value })}
                className={`relative h-5 w-9 rounded-full transition-colors ${value ? "bg-stone-900" : "bg-stone-300"}`}
                aria-pressed={Boolean(value)}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${value ? "left-[18px]" : "left-0.5"}`} />
              </button>
            )}

            {field.kind === "image" && (
              <ImageField value={value} onChange={(v) => onPatch({ [field.key]: v })} onBrowse={() => onBrowseImage(field.key)} />
            )}

            {field.kind === "list" && <LinesField value={value} onChange={(v) => onPatch({ [field.key]: v })} />}

            {field.kind === "links" && <LinksField value={value} onChange={(v) => onPatch({ [field.key]: v })} />}

            {field.kind === "columns" && (
              <ColumnsField
                value={value}
                onChange={(v) => onPatch({ [field.key]: v })}
                onBrowseImage={onBrowseColumnImage}
                onPickProduct={onPickColumnProduct}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default BlockSettings
