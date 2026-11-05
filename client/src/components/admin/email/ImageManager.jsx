"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, Upload, Trash2, Copy, Check, FolderPlus, Loader2, ImageOff } from "lucide-react"
import { fetchImages, uploadImage, updateImage, deleteImage, errorMessage } from "../../../services/emailBuilderApi"
import { getFullImageUrl } from "../../../utils/imageUtils"

/**
 * The image library: folders, upload, drag-and-drop, copy URL, delete.
 *
 * Uploads go to their own endpoint rather than the one the rest of the admin uses,
 * because that one converts everything to WebP. Outlook cannot decode WebP and Gmail
 * strips SVG, so an email picture has to stay a JPEG, PNG or GIF -- the server
 * refuses anything else rather than let it be discovered in a recipient's inbox.
 */
const ImageManager = ({ open, onClose, onSelect }) => {
  const [images, setImages] = useState([])
  const [folders, setFolders] = useState([])
  const [folder, setFolder] = useState("All")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState("")
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await fetchImages(folder === "All" ? "" : folder)
      setImages(data.images || [])
      setFolders(data.folders || [])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [folder])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleFiles = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"))
    if (!list.length) return

    setUploading(true)
    setError("")
    try {
      for (const file of list) {
        await uploadImage(file, folder === "All" ? "General" : folder)
      }
      await load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const copyUrl = async (url) => {
    const absolute = getFullImageUrl(url)
    try {
      await navigator.clipboard.writeText(absolute)
      setCopied(url)
      window.setTimeout(() => setCopied(""), 1500)
    } catch {
      // Clipboard access is refused outside a secure context; the picker still works.
      setError("Could not copy — select the image instead.")
    }
  }

  const move = async (image) => {
    const next = window.prompt("Move to folder:", image.folder || "General")
    if (!next) return
    try {
      await updateImage(image._id, { folder: next.trim() })
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const remove = async (image) => {
    if (!window.confirm(`Delete “${image.name}”? Any email still using it will show a broken picture.`)) return
    try {
      await deleteImage(image._id)
      await load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-200 px-5 py-3">
          <h3 className="text-sm font-bold text-stone-900">Images</h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 px-5 py-2.5">
          {["All", ...folders.filter((f) => f !== "All")].map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setFolder(name)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                folder === name ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("New folder name:")
              if (name?.trim()) {
                setFolders((prev) => [...new Set([...prev, name.trim()])].sort())
                setFolder(name.trim())
              }
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-stone-300 px-3 py-1 text-xs text-stone-500 hover:border-stone-500 hover:text-stone-900"
          >
            <FolderPlus size={13} /> New folder
          </button>

          <span className="flex-1" />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#8e6937] disabled:opacity-50"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Upload
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ""
            }}
          />
        </div>

        {error && <p className="flex-shrink-0 bg-red-50 px-5 py-2 text-xs text-red-700">{error}</p>}

        <div
          className={`min-h-0 flex-1 overflow-y-auto p-5 ${dragging ? "bg-stone-50 ring-2 ring-inset ring-stone-900" : ""}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
        >
          {loading ? (
            <p className="py-12 text-center text-sm text-stone-500">Loading…</p>
          ) : !images.length ? (
            <div className="py-12 text-center text-sm text-stone-500">
              <ImageOff size={28} className="mx-auto mb-3 text-stone-300" />
              Nothing here yet. Drop files anywhere in this panel, or use Upload.
              <p className="mt-2 text-xs text-stone-400">JPEG, PNG or GIF — those are what every mail client can show.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((image) => (
                <div key={image._id} className="group overflow-hidden rounded border border-stone-200">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect?.(image.url)
                      onClose()
                    }}
                    className="block aspect-[4/3] w-full bg-stone-50"
                  >
                    <img src={getFullImageUrl(image.url)} alt={image.name} className="h-full w-full object-contain" />
                  </button>
                  <div className="flex items-center justify-between gap-1 border-t border-stone-200 px-2 py-1.5">
                    <p className="min-w-0 flex-1 truncate text-[11px] text-stone-600" title={image.name}>
                      {image.name}
                    </p>
                    <button type="button" onClick={() => copyUrl(image.url)} title="Copy URL" className="text-stone-400 hover:text-stone-900">
                      {copied === image.url ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    </button>
                    <button type="button" onClick={() => move(image)} title="Move to folder" className="text-stone-400 hover:text-stone-900">
                      <FolderPlus size={13} />
                    </button>
                    <button type="button" onClick={() => remove(image)} title="Delete" className="text-stone-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageManager
