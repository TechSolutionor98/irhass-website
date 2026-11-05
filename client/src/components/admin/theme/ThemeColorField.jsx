"use client"

import { useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"

import { isValidHex } from "../../../theme/palette"

/**
 * One colour input: swatch, native picker, and a hex box you can type or paste
 * into.
 *
 * The typed value is held locally while it is being edited so a half-finished
 * hex ("#84c") never reaches the form and repaints the preview mid-keystroke;
 * it is committed the moment it becomes a valid colour.
 */
const ThemeColorField = ({ label, value, defaultValue, onChange, hint }) => {
  const [draft, setDraft] = useState(value || "")

  useEffect(() => {
    setDraft(value || "")
  }, [value])

  const commit = (next) => {
    setDraft(next)
    if (isValidHex(next)) onChange(next.toLowerCase())
  }

  const isDirty = defaultValue && value && value.toLowerCase() !== defaultValue.toLowerCase()
  const invalid = draft !== "" && !isValidHex(draft)

  return (
    <div className="flex items-start gap-3">
      <label
        className="relative w-10 h-10 shrink-0 rounded-lg border border-gray-300 overflow-hidden cursor-pointer shadow-sm"
        style={{ backgroundColor: isValidHex(value) ? value : "#ffffff" }}
        title={`Pick ${label}`}
      >
        <input
          type="color"
          value={isValidHex(value) ? value : "#ffffff"}
          onChange={(e) => commit(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          aria-label={label}
        />
      </label>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-700 truncate">{label}</span>
          {isDirty && (
            <button
              type="button"
              onClick={() => commit(defaultValue)}
              className="text-gray-400 hover:text-gray-700 shrink-0"
              title={`Reset to ${defaultValue}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <input
          type="text"
          value={draft}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => setDraft(value || "")}
          spellCheck={false}
          className={`mt-1 w-full px-2 py-1 text-sm font-mono rounded border focus:outline-none focus:ring-2 ${
            invalid
              ? "border-red-400 focus:ring-red-400"
              : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
          }`}
          placeholder="#000000"
        />

        {invalid ? (
          <p className="mt-1 text-xs text-red-600">Enter a hex colour like #b4874a.</p>
        ) : (
          hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>
        )}
      </div>
    </div>
  )
}

export default ThemeColorField
