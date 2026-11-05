"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Printer, Minus, Plus } from "lucide-react"
import BarcodeLabel from "./BarcodeLabel"

/**
 * Barcode sheet for one or more products.
 *
 * Shows what will print before it prints, because a wasted label sheet is the usual
 * cost of getting this wrong. Each product gets its own copy count: a box of forty
 * needs forty labels, and nobody wants to press print forty times.
 *
 * Printing uses a hidden iframe rather than window.print() on the page, so the admin
 * chrome, sidebar and filters never end up on the sheet.
 */
const BarcodeModal = ({ products = [], money, onClose, quantities = null, design = null }) => {
  // Quantities come from the table when the caller tracks them there; otherwise the
  // modal keeps its own, so it still works standalone from the Store Stats page.
  const [ownCopies, setOwnCopies] = useState(() =>
    Object.fromEntries(products.map((product) => [product._id, 1])),
  )
  const copies = quantities || ownCopies
  const controlsCopies = !quantities
  const sheetRef = useRef(null)

  // Escape closes, and the page behind must not scroll while the sheet is open.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const setCopyCount = (id, next) =>
    setOwnCopies((prev) => ({ ...prev, [id]: Math.min(99, Math.max(1, next)) }))

  const d = {
    widthMm: 60,
    heightMm: 35,
    showCompany: false,
    companyMode: "name",
    companyName: "",
    showName: true,
    showSku: false,
    showBarcode: true,
    showCode: true,
    showPrice: true,
    showCustom: false,
    customText: "",
    barcodeHeight: 52,
    moduleWidth: 2,
    ...(design || {}),
  }

  // The print iframe is its own document, so a root-relative logo path would not
  // resolve inside it.
  const logoUrl = `${window.location.origin}/logo-wide.png`

  // The value actually encoded. A product's own barcode wins; the SKU is the fallback,
  // because scanning back to a SKU still finds the product in this admin.
  const codeFor = (product) => product.barcode || product.gtin || product.sku || ""

  const printable = useMemo(() => products.filter((product) => codeFor(product)), [products])
  const missing = products.length - printable.length
  const totalLabels = printable.reduce((sum, product) => sum + (copies[product._id] || 1), 0)

  const handlePrint = () => {
    const sheet = sheetRef.current
    if (!sheet) return

    const frame = document.createElement("iframe")
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0"
    document.body.appendChild(frame)

    // The preview shows one label per product; the sheet repeats each by its copy
    // count. Building the markup here rather than dumping innerHTML is what makes
    // "40 copies" actually print 40 labels instead of one.
    const labels = Array.from(sheet.querySelectorAll("[data-label-id]"))
      .flatMap((node) => {
        const count = copies[node.dataset.labelId] || 1
        return Array.from({ length: count }, () => node.outerHTML)
      })
      .join("")

    const doc = frame.contentWindow.document
    doc.open()
    doc.write(`<!doctype html><html><head><title>Barcodes</title><style>
      @page { margin: 10mm; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, ${d.widthMm}mm);
        gap: 4mm;
        justify-content: start;
      }
      .label {
        width: ${d.widthMm}mm;
        height: ${d.heightMm}mm;
        box-sizing: border-box;
        border: 1px solid #e7e5e4;
        padding: 2mm;
        text-align: center;
        break-inside: avoid;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .company { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin: 0 0 1mm; }
      .company[src], img.company { height: 5mm; width: auto; object-fit: contain; margin: 0 auto 1mm; display: block; }
      .name { font-size: 9pt; font-weight: 600; margin: 0 0 1mm; }
      .sku { font-size: 7pt; font-family: ui-monospace, monospace; color: #57534e; margin: 0 0 1mm; }
      .code { font-size: 8pt; font-family: ui-monospace, monospace; letter-spacing: .18em; margin: 2mm 0 0; }
      .price { font-size: 11pt; font-weight: 700; margin: 2mm 0 0; }
      .custom { font-size: 6.5pt; color: #57534e; margin: 1mm 0 0; }
      svg { display: block; width: 100%; }
    </style></head><body><div class="grid">${labels}</div></body></html>`)
    doc.close()

    // Give the iframe a tick to lay the SVG out before asking it to print, otherwise
    // Safari prints an empty page.
    frame.contentWindow.focus()
    setTimeout(() => {
      frame.contentWindow.print()
      setTimeout(() => frame.remove(), 1000)
    }, 250)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 md:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Generate barcodes"
        className="w-full max-w-4xl rounded-lg bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Generate barcodes</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {printable.length} product{printable.length === 1 ? "" : "s"} · {totalLabels} label
              {totalLabels === 1 ? "" : "s"} to print
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <X size={22} />
          </button>
        </div>

        {missing > 0 && (
          <p className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800">
            {missing} selected product{missing === 1 ? " has" : "s have"} no barcode, GTIN or SKU, so
            {missing === 1 ? " it is" : " they are"} left out. Add a SKU on the product and try again.
          </p>
        )}

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <div ref={sheetRef}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {printable.map((product) => (
                <div
                  key={product._id}
                  data-label-id={product._id}
                  className="label rounded-md border border-gray-200 p-4 text-center"
                >
                  {d.showCompany &&
                    (d.companyMode === "logo" ? (
                      <img src={logoUrl} alt="" className="company mb-1 h-4 w-auto object-contain" />
                    ) : (
                      <p className="company text-[9px] font-bold uppercase tracking-wide text-gray-900">
                        {d.companyName}
                      </p>
                    ))}
                  {d.showName && <p className="name line-clamp-2 text-xs font-semibold text-gray-900">{product.name}</p>}
                  {d.showSku && product.sku && (
                    <p className="sku font-mono text-[9px] text-gray-600">{product.sku}</p>
                  )}
                  {d.showBarcode ? (
                    <BarcodeLabel
                      value={codeFor(product)}
                      height={d.barcodeHeight}
                      moduleWidth={d.moduleWidth}
                      showValue={d.showCode}
                      className="mt-2"
                    />
                  ) : (
                    d.showCode && (
                      <p className="code mt-2 font-mono text-[11px] tracking-[0.18em] text-gray-900">
                        {codeFor(product)}
                      </p>
                    )
                  )}
                  {d.showPrice && <p className="price mt-2 text-sm font-bold text-gray-900">{money(product.price)}</p>}
                  {d.showCustom && d.customText && (
                    <p className="custom mt-1 text-[8px] text-gray-600">{d.customText}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {printable.length > 0 && controlsCopies && (
            <div className="mt-6 border-t border-gray-200 pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Copies per product</h3>
              <ul className="mt-3 divide-y divide-gray-100">
                {printable.map((product) => (
                  <li key={product._id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-900">{product.name}</p>
                      <p className="font-mono text-xs text-gray-500">{codeFor(product)}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center rounded border border-gray-300">
                      <button
                        onClick={() => setCopyCount(product._id, (copies[product._id] || 1) - 1)}
                        aria-label={`Fewer copies of ${product.name}`}
                        className="px-2.5 py-1.5 text-gray-600 hover:text-black"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="min-w-[36px] border-x border-gray-300 py-1.5 text-center text-sm tabular-nums">
                        {copies[product._id] || 1}
                      </span>
                      <button
                        onClick={() => setCopyCount(product._id, (copies[product._id] || 1) + 1)}
                        aria-label={`More copies of ${product.name}`}
                        className="px-2.5 py-1.5 text-gray-600 hover:text-black"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={printable.length === 0}
            className="flex items-center gap-2 rounded-md bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Printer size={16} />
            Print {totalLabels} label{totalLabels === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BarcodeModal
