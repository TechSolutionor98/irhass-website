"use client"

import { useRef, useState } from "react"
import axios from "axios"
import { ImageIcon, RotateCcw, Upload } from "lucide-react"

import config from "../../../config/config"
import { getFullImageUrl } from "../../../utils/imageUtils"

const MAX_BYTES = 5 * 1024 * 1024

// What the upload endpoint accepts (server/config/multer.js). SVG is
// deliberately not uploadable -- an SVG can carry script -- but an SVG already
// served from public/ can still be used by pasting its path in the box below.
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]

/**
 * Upload or paste one logo, and set the width it renders at.
 *
 * The stored value is whatever the upload endpoint returns (a /uploads/... path
 * or a Cloudinary URL) or a hand-typed path; getFullImageUrl turns any of those
 * into something the preview and the storefront can display.
 */
const ThemeLogoField = ({
  label,
  hint,
  value,
  defaultValue,
  width,
  defaultWidth,
  onChange,
  onWidthChange,
  previewBackground = "#ffffff",
}) => {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const upload = async (file) => {
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(
        "Uploads must be PNG, JPG, GIF or WebP. To use an SVG, put it in the site's public folder and paste its path below.",
      )
      return
    }
    if (file.size > MAX_BYTES) {
      setError("That image is over 5MB. Use a smaller file.")
      return
    }

    const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
    if (!token) {
      setError("Your admin session has expired. Sign in again and retry.")
      return
    }

    try {
      setUploading(true)
      setError("")

      const formData = new FormData()
      formData.append("image", file)

      const { data } = await axios.post(`${config.API_URL}/api/upload/single`, formData, {
        headers: { "Content-Type": "multipart/form-data", Authorization: `Bearer ${token}` },
      })

      const url = data?.url || data?.files?.[0]
      if (!url) throw new Error("The upload succeeded but returned no image URL.")

      onChange(url)
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Upload failed.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const preview = getFullImageUrl(value)
  const isDirty = defaultValue && value && value !== defaultValue

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
          {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
        </div>
        {isDirty && (
          <button
            type="button"
            onClick={() => {
              onChange(defaultValue)
              if (onWidthChange && defaultWidth) onWidthChange(defaultWidth)
            }}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
      </div>

      <div
        className="flex items-center justify-center rounded border border-dashed border-gray-300 p-4 min-h-[88px]"
        style={{ backgroundColor: previewBackground }}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            className="max-h-14 object-contain"
            style={{ width: width ? `${width}px` : undefined, maxWidth: "100%" }}
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <ImageIcon className="w-6 h-6" />
            <span className="text-xs mt-1">No logo set</span>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          placeholder="/logo.png or https://..."
          className="w-full px-2 py-1.5 text-sm font-mono rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload image"}
          </button>
          <span className="text-xs text-gray-500">PNG, JPG, GIF or WebP &middot; up to 5MB</span>
        </div>

        {onWidthChange && (
          <label className="block">
            <span className="text-xs text-gray-600">Display width: {width || defaultWidth}px</span>
            <input
              type="range"
              min={40}
              max={400}
              step={2}
              value={width || defaultWidth || 128}
              onChange={(e) => onWidthChange(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </label>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}

export default ThemeLogoField
