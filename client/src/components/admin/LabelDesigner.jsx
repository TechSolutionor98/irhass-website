"use client"

import { X } from "lucide-react"
import BarcodeLabel from "./BarcodeLabel"

/**
 * What goes on a label and how big it is.
 *
 * Laid out wide rather than tall. The first version stacked every control in one
 * column beside a mostly empty preview, which pushed the last options below the
 * fold on a laptop -- a settings panel you have to scroll to find a checkbox in is
 * a panel whose options go unused.
 *
 * Now: preview and sizes share the top row, the content checkboxes run across the
 * full width beneath, and the whole thing is capped at the viewport height with its
 * own scroll as a backstop.
 *
 * Width and height are in millimetres because that is how label paper is sold --
 * a roll is 50 x 25mm, not 180 x 90 pixels.
 */

// A4 is 210mm across; the print sheet keeps a 10mm margin each side.
export const USABLE_PAGE_WIDTH_MM = 190
const LABEL_GAP_MM = 4

export const DEFAULT_LABEL_DESIGN = {
  widthMm: 60,
  heightMm: 35,

  // Company line. Text by default rather than the logo: a logo rendered at 5mm on a
  // thermal printer usually prints as a grey smudge, where a name stays readable.
  showCompany: false,
  companyMode: "name", // "name" | "logo"
  companyName: "Irha's Wardrobe",

  showName: true,
  showSku: false,
  showBarcode: true,
  showCode: true,
  showPrice: true,

  showCustom: false,
  customText: "",

  barcodeHeight: 52,
  moduleWidth: 2,
}

/** How many labels of this width fit across the page. At least one, always. */
export const labelsPerRow = (widthMm) => {
  const width = Number(widthMm) || DEFAULT_LABEL_DESIGN.widthMm
  return Math.max(1, Math.floor((USABLE_PAGE_WIDTH_MM + LABEL_GAP_MM) / (width + LABEL_GAP_MM)))
}

const SAMPLE = {
  name: "Amal & Co Leather Loafers - Burgundy",
  code: "IRH-0100",
  sku: "IRH-0100",
  price: "Rs 5,750",
}

/**
 * One row: name, slider, number box.
 *
 * All three on a single line rather than stacked, which is what took the panel past
 * the bottom of the screen. Slider for finding a size by eye, box for typing the
 * figure printed on the packet of label paper.
 *
 * Typing is clamped on blur, not on every keystroke, so clearing the field to retype
 * does not snap back to the minimum mid-edit.
 */
const SizeControl = ({ label, value, onChange, min, max, step = 1, unit, disabled }) => (
  <div className={`flex items-center gap-3 ${disabled ? "pointer-events-none opacity-40" : ""}`}>
    <label className="w-[86px] flex-shrink-0 text-xs text-gray-600">{label}</label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={Number(value) || min}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1 min-w-0 flex-1 accent-gray-900"
    />
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      onBlur={(e) => {
        const n = Number(e.target.value)
        onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min)
      }}
      className="w-14 flex-shrink-0 rounded border border-gray-300 px-2 py-1 text-right text-xs tabular-nums focus:border-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
    <span className="w-5 flex-shrink-0 text-[11px] text-gray-400">{unit}</span>
  </div>
)

/** A compact checkbox. The hint is a tooltip, not a second line of text. */
const Toggle = ({ checked, onChange, title, hint }) => (
  <label
    title={hint}
    className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 transition-colors hover:bg-gray-50"
  >
    <input
      type="checkbox"
      checked={Boolean(checked)}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 flex-shrink-0 accent-gray-900"
    />
    <span className="text-sm text-gray-800">{title}</span>
  </label>
)

const LabelDesigner = ({ design, onChange, onClose }) => {
  const set = (patch) => onChange({ ...design, ...patch })
  const perRow = labelsPerRow(design.widthMm)

  // Keeps the sample inside its panel whichever way the label is shaped.
  const previewWidth = Math.min(190, design.heightMm > design.widthMm ? 120 : 190)

  const sectionTitle = "text-[11px] font-semibold uppercase tracking-wider text-gray-500"

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Design label"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-2xl"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-5 py-3.5">
          <div>
            <h2 className="text-base font-bold text-gray-900">Design label</h2>
            <p className="text-xs text-gray-500">Applies to every label on the sheet.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Top row: the sample next to the measurements that change it. */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,260px)_1fr]">
            <div>
              <h3 className={sectionTitle}>Preview</h3>
              <div className="mt-2 flex items-center justify-center rounded-md bg-gray-100 p-4">
                {/* Drawn at the real aspect ratio, so a label too short for its
                    contents looks wrong here before any paper is used. */}
                <div
                  className="flex flex-col items-center justify-center overflow-hidden border border-gray-300 bg-white p-1.5 text-center"
                  style={{
                    width: `${previewWidth}px`,
                    height: `${previewWidth * (design.heightMm / design.widthMm)}px`,
                  }}
                >
                  {design.showCompany &&
                    (design.companyMode === "logo" ? (
                      <img src="/logo-wide.png" alt="" className="mb-0.5 h-2.5 w-auto object-contain" />
                    ) : (
                      <p className="w-full truncate text-[8px] font-bold uppercase tracking-wide text-gray-900">
                        {design.companyName}
                      </p>
                    ))}
                  {design.showName && (
                    <p className="line-clamp-2 w-full text-[9px] font-semibold leading-tight text-gray-900">
                      {SAMPLE.name}
                    </p>
                  )}
                  {design.showSku && (
                    <p className="w-full truncate font-mono text-[8px] text-gray-600">{SAMPLE.sku}</p>
                  )}
                  {design.showBarcode ? (
                    <BarcodeLabel
                      value={SAMPLE.code}
                      height={design.barcodeHeight}
                      moduleWidth={design.moduleWidth}
                      showValue={design.showCode}
                      className="mt-0.5 w-full"
                    />
                  ) : (
                    design.showCode && (
                      <p className="mt-0.5 font-mono text-[9px] tracking-[0.18em] text-gray-900">
                        {SAMPLE.code}
                      </p>
                    )
                  )}
                  {design.showPrice && (
                    <p className="mt-0.5 text-[11px] font-bold text-gray-900">{SAMPLE.price}</p>
                  )}
                  {design.showCustom && design.customText && (
                    <p className="mt-0.5 w-full truncate text-[7px] text-gray-600">{design.customText}</p>
                  )}
                </div>
              </div>

              <p className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                <span>
                  {design.widthMm} × {design.heightMm} mm
                </span>
                <span>{perRow} per row on A4</span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className={sectionTitle}>Label size</h3>
                <div className="mt-2 space-y-2">
                  <SizeControl
                    label="Width"
                    unit="mm"
                    value={design.widthMm}
                    onChange={(widthMm) => set({ widthMm })}
                    min={25}
                    max={190}
                  />
                  <SizeControl
                    label="Height"
                    unit="mm"
                    value={design.heightMm}
                    onChange={(heightMm) => set({ heightMm })}
                    min={15}
                    max={120}
                  />
                </div>
              </div>

              <div>
                <h3 className={sectionTitle}>Barcode</h3>
                <div className="mt-2 space-y-2">
                  <SizeControl
                    label="Height"
                    unit="px"
                    value={design.barcodeHeight}
                    onChange={(barcodeHeight) => set({ barcodeHeight })}
                    min={24}
                    max={120}
                    disabled={!design.showBarcode}
                  />
                  <SizeControl
                    label="Thickness"
                    value={design.moduleWidth}
                    onChange={(moduleWidth) => set({ moduleWidth })}
                    min={1}
                    max={4}
                    disabled={!design.showBarcode}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-gray-500">
                  Raise thickness if a scanner struggles with printed labels.
                </p>
              </div>
            </div>
          </div>

          {/* Content checkboxes run the full width in columns, so all seven are
              visible at once instead of a scrolling list. */}
          <div className="mt-5 border-t border-gray-200 pt-4">
            <h3 className={sectionTitle}>Show on the label</h3>

            <div className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
              <Toggle
                checked={design.showCompany}
                onChange={(showCompany) => set({ showCompany })}
                title="Company name / logo"
              />
              <Toggle
                checked={design.showName}
                onChange={(showName) => set({ showName })}
                title="Product name"
                hint="Wraps to two lines, then truncates"
              />
              <Toggle
                checked={design.showSku}
                onChange={(showSku) => set({ showSku })}
                title="SKU"
                hint="Its own line above the barcode"
              />
              <Toggle
                checked={design.showBarcode}
                onChange={(showBarcode) => set({ showBarcode })}
                title="Barcode"
                hint="The scannable bars themselves"
              />
              <Toggle
                checked={design.showCode}
                onChange={(showCode) => set({ showCode })}
                title="Code under barcode"
                hint="The digits a person can read and type"
              />
              <Toggle
                checked={design.showPrice}
                onChange={(showPrice) => set({ showPrice })}
                title="Price"
              />
              <Toggle
                checked={design.showCustom}
                onChange={(showCustom) => set({ showCustom })}
                title="Custom field"
                hint="The same text on every label"
              />
            </div>

            {/* The two options that need a value appear together beneath the grid,
                rather than pushing the checkboxes apart as they are switched on. */}
            {(design.showCompany || design.showCustom) && (
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-md bg-gray-50 p-3 sm:grid-cols-2">
                {design.showCompany && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-[11px] font-medium text-gray-600">Company</span>
                      {["name", "logo"].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => set({ companyMode: mode })}
                          className={`rounded border px-2 py-0.5 text-[11px] font-medium capitalize transition-colors ${
                            design.companyMode === mode
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-300 text-gray-600 hover:border-gray-900"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    {design.companyMode === "name" ? (
                      <input
                        value={design.companyName}
                        onChange={(e) => set({ companyName: e.target.value })}
                        placeholder="Company name"
                        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
                      />
                    ) : (
                      <p className="text-[11px] leading-snug text-gray-500">
                        Uses the shop logo. Check a printed sample — a logo this small can
                        smudge on a thermal printer.
                      </p>
                    )}
                  </div>
                )}

                {design.showCustom && (
                  <div>
                    <span className="mb-1.5 block text-[11px] font-medium text-gray-600">Custom text</span>
                    <input
                      value={design.customText}
                      onChange={(e) => set({ customText: e.target.value })}
                      placeholder="e.g. Made in Pakistan"
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-900 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-gray-200 px-5 py-3">
          <button
            onClick={() => onChange({ ...DEFAULT_LABEL_DESIGN })}
            className="text-xs font-medium text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline"
          >
            Reset to default
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-gray-900 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default LabelDesigner
