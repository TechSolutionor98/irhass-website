"use client"

import { code128Bars } from "../../utils/barcode"

/**
 * One scannable Code 128 barcode, drawn as SVG.
 *
 * SVG rather than canvas so it prints at the printer's resolution instead of the
 * screen's -- a canvas barcode scaled up for a label sheet gets soft edges, and a
 * scanner needs hard ones.
 */
const BarcodeLabel = ({ value, height = 56, moduleWidth = 2, showValue = true, className = "" }) => {
  const text = String(value || "").trim()
  const { bars, totalModules } = code128Bars(text)

  if (!text || totalModules === 0) {
    return <p className={`text-xs text-gray-400 ${className}`}>No code</p>
  }

  // A quiet zone of 10 modules each side is the minimum the spec asks for; without it
  // a scanner cannot find the start of the symbol.
  const QUIET = 10
  const width = (totalModules + QUIET * 2) * moduleWidth

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Barcode ${text}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block" }}
      >
        <rect width={width} height={height} fill="#ffffff" />
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={(bar.x + QUIET) * moduleWidth}
            y={0}
            width={bar.width * moduleWidth}
            height={height}
            fill="#000000"
          />
        ))}
      </svg>
      {showValue && (
        <p className="mt-1 text-center font-mono text-[11px] tracking-[0.18em] text-gray-900">{text}</p>
      )}
    </div>
  )
}

export default BarcodeLabel
