"use client"

import { useCallback, useEffect, useState } from "react"
import axios from "axios"
import AdminSidebar from "../../components/admin/AdminSidebar"
import BarcodeModal from "../../components/admin/BarcodeModal"
import LabelDesigner, { DEFAULT_LABEL_DESIGN, labelsPerRow } from "../../components/admin/LabelDesigner"
import { Search, Barcode, RefreshCw, X, Minus, Plus, Sliders, Boxes, Wallet, Tags } from "lucide-react"
import { getFullImageUrl } from "../../utils/imageUtils"
import config from "../../config/config"

/**
 * Pick products, set how many labels each needs, print the sheet.
 *
 * Laid out as the same table as Store Stats on purpose: it is the same list of
 * products, and someone moving between the two screens should not have to relearn
 * where things are. The columns differ because the job differs -- this one carries
 * the product code and a label count instead of stock movements.
 */

const PER_PAGE = 25

const money = (value) =>
  `Rs ${(Number(value) || 0).toLocaleString("en-PK", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`

const units = (value) => (Number(value) || 0).toLocaleString()

const authHeaders = () => {
  const token =
    localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const SummaryTile = ({ icon: Icon, label, value, hint }) => (
  <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
      <Icon size={14} className="text-lime-600" />
      {label}
    </div>
    <p className="mt-2 text-xl font-bold tabular-nums text-gray-900">{value}</p>
    {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
  </div>
)

const CreateLabels = () => {
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [products, setProducts] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  // Keyed by id, holding the whole product: the sheet needs name and price, and
  // those are gone once the search moves on.
  const [selected, setSelected] = useState({})
  // How many labels each product needs. Separate from `selected` so changing the
  // count does not deselect, and so a count survives being unticked and reticked.
  const [quantities, setQuantities] = useState({})

  const [design, setDesign] = useState(DEFAULT_LABEL_DESIGN)
  const [designerOpen, setDesignerOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const { data } = await axios.get(`${config.API_URL}/api/products/admin/inventory`, {
        params: { search: debounced, page, limit: PER_PAGE, sort: "newest" },
        headers: authHeaders(),
      })
      setProducts(data.products || [])
      setSummary(data.summary || null)
      setPages(data.pages || 1)
    } catch (err) {
      setError(err.response?.data?.message || "Could not load products")
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [debounced, page])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const selectedList = Object.values(selected)
  const allOnPage = products.length > 0 && products.every((p) => selected[p._id])
  const someOnPage = products.some((p) => selected[p._id])

  const qtyFor = (id) => quantities[id] ?? 1
  const setQty = (id, next) =>
    setQuantities((prev) => ({ ...prev, [id]: Math.min(99, Math.max(1, next)) }))

  const toggleOne = (product) =>
    setSelected((prev) => {
      const next = { ...prev }
      if (next[product._id]) delete next[product._id]
      else next[product._id] = product
      return next
    })

  const togglePage = () =>
    setSelected((prev) => {
      const next = { ...prev }
      if (allOnPage) products.forEach((p) => delete next[p._id])
      else products.forEach((p) => { next[p._id] = p })
      return next
    })

  const codeFor = (product) => product.barcode || product.gtin || product.sku || ""
  const totalLabels = selectedList.reduce((sum, p) => sum + (codeFor(p) ? qtyFor(p._id) : 0), 0)

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Label / Barcode</h1>
            <p className="mt-1 text-gray-600">Choose products, set how many labels each needs, then print.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setDesignerOpen(true)}
              className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-900 hover:text-gray-900"
            >
              <Sliders size={15} />
              Design label
            </button>

            {selectedList.length > 0 && (
              <button
                onClick={() => setSelected({})}
                className="text-sm font-medium text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline"
              >
                Clear {selectedList.length}
              </button>
            )}

            <button
              onClick={() => setSheetOpen(true)}
              disabled={selectedList.length === 0}
              className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Barcode className="h-4 w-4" />
              Generate{totalLabels > 0 ? ` ${totalLabels} label${totalLabels === 1 ? "" : "s"}` : ""}
            </button>

            <button
              onClick={fetchProducts}
              disabled={loading}
              className="flex items-center gap-2 rounded-md bg-lime-500 px-4 py-2 text-white transition-colors hover:bg-lime-600 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <SummaryTile icon={Boxes} label="Products" value={units(summary?.skus)} hint={`${units(summary?.units)} units in stock`} />
          <SummaryTile icon={Tags} label="Selected" value={units(selectedList.length)} hint="Across all searches" />
          <SummaryTile icon={Wallet} label="Labels to print" value={units(totalLabels)} hint={`${design.widthMm} × ${design.heightMm} mm · ${labelsPerRow(design.widthMm)} per row`} />
        </div>

        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, barcode or GTIN..."
              className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-10 focus:border-gray-900 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-6 rounded-md bg-red-50 p-4 text-red-600">{error}</div>}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          </div>
        ) : (
          <div className="rounded-lg bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select all products on this page"
                        checked={allOnPage}
                        ref={(el) => {
                          if (el) el.indeterminate = someOnPage && !allOnPage
                        }}
                        onChange={togglePage}
                        className="h-4 w-4 cursor-pointer accent-gray-900"
                      />
                    </th>
                    {["Product", "Product code", "Price", "Stock value", "Labels"].map((heading) => (
                      <th
                        key={heading}
                        className={`px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 ${
                          ["Product", "Product code"].includes(heading)
                            ? "text-left"
                            : heading === "Labels"
                              ? "text-center"
                              : "text-right"
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 bg-white">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                        No products match this search.
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const isSelected = Boolean(selected[product._id])
                      const code = codeFor(product)
                      const stockValue = (Number(product.countInStock) || 0) * (Number(product.price) || 0)

                      return (
                        <tr
                          key={product._id}
                          className={`hover:bg-gray-50 ${isSelected ? "bg-amber-50/60" : ""}`}
                        >
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              aria-label={`Select ${product.name}`}
                              checked={isSelected}
                              onChange={() => toggleOne(product)}
                              className="h-4 w-4 cursor-pointer accent-gray-900"
                            />
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {product.image ? (
                                <img
                                  src={getFullImageUrl(product.image)}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded object-cover ring-1 ring-gray-200"
                                />
                              ) : (
                                <div className="h-10 w-10 shrink-0 rounded bg-gray-100 ring-1 ring-gray-200" />
                              )}
                              <div className="min-w-0">
                                <p className="line-clamp-2 max-w-md text-sm font-medium text-gray-900">
                                  {product.name}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-500">
                                  {[product.brand?.name, product.parentCategory?.name].filter(Boolean).join(" · ") || "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {/* No code means no label, so it is said here rather than
                                discovered after the paper is loaded. */}
                            {code ? (
                              <p className="font-mono text-sm text-gray-900">{code}</p>
                            ) : (
                              <p className="text-xs font-medium text-amber-600">No code — cannot label</p>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right text-sm tabular-nums text-gray-900">
                            {money(product.price)}
                          </td>

                          <td className="px-6 py-4 text-right text-sm font-semibold tabular-nums text-gray-900">
                            {money(stockValue)}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              <div
                                className={`flex items-center rounded border ${
                                  isSelected && code ? "border-gray-300" : "border-gray-200 opacity-40"
                                }`}
                              >
                                <button
                                  onClick={() => setQty(product._id, qtyFor(product._id) - 1)}
                                  disabled={!isSelected || !code}
                                  aria-label={`Fewer labels for ${product.name}`}
                                  className="px-2.5 py-1.5 text-gray-600 hover:text-black disabled:cursor-not-allowed"
                                >
                                  <Minus size={13} />
                                </button>
                                <span className="min-w-[38px] border-x border-gray-300 py-1.5 text-center text-sm tabular-nums">
                                  {qtyFor(product._id)}
                                </span>
                                <button
                                  onClick={() => setQty(product._id, qtyFor(product._id) + 1)}
                                  disabled={!isSelected || !code}
                                  aria-label={`More labels for ${product.name}`}
                                  className="px-2.5 py-1.5 text-gray-600 hover:text-black disabled:cursor-not-allowed"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-6 py-4">
                <p className="text-sm text-gray-600">
                  Page <span className="font-semibold">{page}</span> of {pages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    disabled={page === pages}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {designerOpen && (
        <LabelDesigner design={design} onChange={setDesign} onClose={() => setDesignerOpen(false)} />
      )}

      {sheetOpen && (
        <BarcodeModal
          products={selectedList}
          money={money}
          quantities={quantities}
          design={design}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  )
}

export default CreateLabels
