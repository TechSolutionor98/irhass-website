"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X, Loader2, PackageSearch } from "lucide-react"
import { searchProducts, errorMessage } from "../../../services/emailBuilderApi"
import { getFullImageUrl } from "../../../utils/imageUtils"

/**
 * Search the live catalogue and copy a product into a block.
 *
 * What it copies is a SNAPSHOT -- name, picture, price, the struck-through old price,
 * the discount badge, category and link, all as plain values on the block.
 *
 * It is worth being clear about why it is not a reference to the product. An email
 * can be opened months after it was sent. If the block pointed at the live product,
 * tomorrow's price change would silently rewrite what a customer was promised in a
 * message they can still open, and the record of what was sent would no longer match
 * what they see. A snapshot can go stale; a live link can make the shop appear to
 * have lied.
 */
const ProductPicker = ({ open, onClose, onPick }) => {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setError("")
      // Focused after the dialog paints, so typing can start immediately.
      const id = window.setTimeout(() => inputRef.current?.focus(), 50)
      return () => window.clearTimeout(id)
    }
  }, [open])

  // Debounced: a request per keystroke floods the catalogue search for no benefit.
  useEffect(() => {
    if (!open) return
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      return
    }

    let cancelled = false
    const id = window.setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        const data = await searchProducts(term)
        if (!cancelled) setResults(data)
      } catch (err) {
        if (!cancelled) setError(errorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [query, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-4 pt-[8vh]" role="dialog" aria-modal="true">
      <div className="flex max-h-[76vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-stone-200 px-4 py-3">
          <Search size={18} className="flex-shrink-0 text-stone-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or SKU…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
          />
          {loading && <Loader2 size={16} className="animate-spin text-stone-400" />}
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}

          {!error && query.trim().length < 2 && (
            <div className="px-4 py-12 text-center text-sm text-stone-500">
              <PackageSearch size={28} className="mx-auto mb-3 text-stone-300" />
              Type at least two characters to search your catalogue.
            </div>
          )}

          {!error && query.trim().length >= 2 && !loading && !results.length && (
            <p className="px-4 py-12 text-center text-sm text-stone-500">Nothing matched “{query.trim()}”.</p>
          )}

          <ul className="divide-y divide-stone-100">
            {results.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(product)
                    onClose()
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50"
                >
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-50">
                    {product.image ? (
                      <img src={getFullImageUrl(product.image)} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900">{product.name}</p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {[product.sku, product.category].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold text-stone-900">{product.price}</p>
                    {product.oldPrice && <p className="text-xs text-stone-400 line-through">{product.oldPrice}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex-shrink-0 border-t border-stone-200 px-4 py-2.5 text-[11px] text-stone-500">
          Details are copied into the block, not linked. A later price change will not rewrite an email already sent.
        </p>
      </div>
    </div>
  )
}

export default ProductPicker
