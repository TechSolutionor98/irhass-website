import { useState, useEffect } from "react"
import { Save, Trash2, Edit2, AlertCircle, CheckCircle2, Search, Layers, Package, Tag, Palette, Shield, X } from "lucide-react"
import axios from "axios"
import config from "../../config/config"

const ENTITY_TYPES = [
  { id: "product", name: "Product", icon: Package },
  { id: "category", name: "Category (Parent)", icon: Tag },
  { id: "subcategory", name: "Subcategory (Levels 1-4)", icon: Layers },
  { id: "brand", name: "Brand", icon: Palette },
]

const PAYMENT_METHODS = [
  { id: "card", name: "Pay By Card", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "cod", name: "Cash on Delivery", color: "bg-green-100 text-green-800 border-green-200" },
  { id: "tamara", name: "Tamara", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "tabby", name: "Tabby", color: "bg-teal-100 text-teal-800 border-teal-200" },
]

export default function ProductPaymentMethods() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Configurations loaded from API
  const [configs, setConfigs] = useState({ products: [], categories: [], subCategories: [], brands: [] })

  // Form State
  const [selectedEntityType, setSelectedEntityType] = useState("product")
  const [selectedEntityId, setSelectedEntityId] = useState("")
  const [selectedProducts, setSelectedProducts] = useState([])
  const [productSelectionMode, setProductSelectionMode] = useState("specific") // "specific" or "all"
  const [selectedTableRows, setSelectedTableRows] = useState([])
  const [selectedMethods, setSelectedMethods] = useState(["card", "cod"]) // default

  // Lists for dropdowns
  const [productsList, setProductsList] = useState([])
  const [categoriesList, setCategoriesList] = useState([])
  const [subCategoriesList, setSubCategoriesList] = useState([])
  const [brandsList, setBrandsList] = useState([])

  // Search queries
  const [productSearch, setProductSearch] = useState("")
  const [searchingProducts, setSearchingProducts] = useState(false)

  useEffect(() => {
    fetchConfigs()
    fetchDropdownData()
  }, [])

  // Refetch products when search query changes
  useEffect(() => {
    if (selectedEntityType !== "product") return

    const delayDebounce = setTimeout(() => {
      searchProducts()
    }, 500)

    return () => clearTimeout(delayDebounce)
  }, [productSearch, selectedEntityType])

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
      const { data } = await axios.get(`${config.API_URL}/api/product-payment-methods/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setConfigs(data)
      setError(null)
    } catch (err) {
      setError("Failed to fetch payment method configurations")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDropdownData = async () => {
    try {
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
      const headers = { Authorization: `Bearer ${token}` }

      // Fetch categories, subcategories, brands
      const [catsRes, subsRes, brandsRes] = await Promise.all([
        axios.get(`${config.API_URL}/api/categories`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${config.API_URL}/api/subcategories/admin`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${config.API_URL}/api/brands`, { headers }).catch(() => ({ data: [] })),
      ])

      setCategoriesList(catsRes.data)
      setSubCategoriesList(subsRes.data)
      setBrandsList(brandsRes.data)
    } catch (err) {
      console.error("Failed to load list data", err)
    }
  }

  const searchProducts = async () => {
    if (!productSearch.trim()) {
      setProductsList([])
      return
    }
    try {
      setSearchingProducts(true)
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
      const { data } = await axios.get(`${config.API_URL}/api/products/admin?search=${encodeURIComponent(productSearch)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      // The admin products API usually returns { products: [], pages, page }
      if (data && Array.isArray(data.products)) {
        setProductsList(data.products)
      } else if (Array.isArray(data)) {
        setProductsList(data)
      } else {
        setProductsList([])
      }
    } catch (err) {
      console.error("Error searching products", err)
    } finally {
      setSearchingProducts(false)
    }
  }

  const handleMethodCheckboxChange = (methodId) => {
    if (selectedMethods.includes(methodId)) {
      setSelectedMethods(selectedMethods.filter((id) => id !== methodId))
    } else {
      setSelectedMethods([...selectedMethods, methodId])
    }
  }

  const handleSave = async () => {
    if (selectedEntityType === "product" ? (productSelectionMode === "specific" && selectedProducts.length === 0) : !selectedEntityId) {
      setError("Please select a specific item to configure")
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token")

      const payload = {
        entityType: selectedEntityType,
        entityId: selectedEntityType === "product" ? (productSelectionMode === "all" ? "all" : selectedProducts.map(p => p._id)) : selectedEntityId,
        paymentMethods: selectedMethods,
      }

      await axios.post(`${config.API_URL}/api/product-payment-methods/save`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setSuccess("Payment method configuration saved successfully")
      // Clear form except type
      setSelectedEntityId("")
      setSelectedProducts([])
      setProductSearch("")
      setProductsList([])
      setProductSelectionMode("specific")
      setSelectedMethods(["card", "cod"])

      // Refetch
      fetchConfigs()

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save configuration")
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (entityType, entityId) => {
    if (!window.confirm("Are you sure you want to reset payment methods for this item? It will revert to default inheritance.")) {
      return
    }

    try {
      setError(null)
      setSuccess(null)
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token")

      await axios.post(
        `${config.API_URL}/api/product-payment-methods/reset`,
        { entityType, entityId },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      setSuccess("Configuration reset successfully")
      fetchConfigs()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset configuration")
      console.error(err)
    }
  }

  const handleSelectRow = (item) => {
    const isSelected = selectedTableRows.some((r) => r.entityType === item.entityType && r.entityId === item._id)
    if (isSelected) {
      setSelectedTableRows(selectedTableRows.filter((r) => !(r.entityType === item.entityType && r.entityId === item._id)))
    } else {
      setSelectedTableRows([...selectedTableRows, { entityType: item.entityType, entityId: item._id }])
    }
  }

  const handleSelectAllRows = (e, currentConfigs) => {
    if (e.target.checked) {
      setSelectedTableRows(currentConfigs.map((item) => ({ entityType: item.entityType, entityId: item._id })))
    } else {
      setSelectedTableRows([])
    }
  }

  const handleBulkReset = async () => {
    if (!window.confirm(`Are you sure you want to reset payment methods for ${selectedTableRows.length} items?`)) {
      return
    }
    try {
      setError(null)
      setSuccess(null)
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token")

      await axios.post(
        `${config.API_URL}/api/product-payment-methods/bulk-reset`,
        { items: selectedTableRows },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      setSuccess("Bulk reset completed successfully")
      setSelectedTableRows([])
      fetchConfigs()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to bulk reset configuration")
      console.error(err)
    }
  }

  const handleEdit = (entityType, item) => {
    setSelectedEntityType(entityType)
    setSelectedEntityId(item._id)
    setSelectedMethods(item.paymentMethods || [])
    
    // For product, populate search or product options
    if (entityType === "product") {
      setProductSelectionMode("specific")
      setSelectedProducts([{ _id: item._id, name: item.name, sku: item.sku }])
    } else {
      setSelectedProducts([])
    }
    
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const getEntityName = (entityType, id) => {
    if (entityType === "category") {
      return categoriesList.find((c) => c._id === id)?.name || id
    }
    if (entityType === "subcategory") {
      const sub = subCategoriesList.find((s) => s._id === id)
      return sub ? `${sub.name} (L${sub.level})` : id
    }
    if (entityType === "brand") {
      return brandsList.find((b) => b._id === id)?.name || id
    }
    return id
  }

  if (loading && configs.products.length === 0 && configs.categories.length === 0) {
    return (
      <div className="ml-64 p-8 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-lime-500 border-t-transparent"></div>
      </div>
    )
  }

  // Flatten configurations for easy listing in the table
  const allConfigs = [
    ...configs.products.map((p) => ({ ...p, entityType: "product", typeLabel: "Product" })),
    ...configs.categories.map((c) => ({ ...c, entityType: "category", typeLabel: "Category" })),
    ...configs.subCategories.map((s) => ({ ...s, entityType: "subcategory", typeLabel: `Subcategory (L${s.level || 1})` })),
    ...configs.brands.map((b) => ({ ...b, entityType: "brand", typeLabel: "Brand" })),
  ]

  return (
    <div className="ml-64 p-8 min-h-screen bg-gray-50 space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Payment Methods Manager</h1>
          <p className="text-gray-500 mt-1">Configure customized payment options individually by product, category, subcategory, or brand</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2 border border-green-200">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-medium">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration Form */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6 self-start">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
            <Save className="w-5 h-5 text-lime-500" />
            Set Custom Rule
          </h2>

          {/* 1. Entity Type Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">Entity Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ENTITY_TYPES.map((type) => {
                const IconComponent = type.icon
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setSelectedEntityType(type.id)
                      setSelectedEntityId("")
                      setSelectedProducts([])
                      setProductSearch("")
                      setProductSelectionMode("specific")
                    }}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-all ${
                      selectedEntityType === type.id
                        ? "border-lime-500 bg-lime-50 text-lime-700"
                        : "border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                    {type.name.split(" ")[0]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Specific Entity Selection Dropdown */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 flex items-center justify-between">
              <span>Select {selectedEntityType === "product" ? "Products" : `Specific ${selectedEntityType.charAt(0).toUpperCase() + selectedEntityType.slice(1)}`}</span>
              {selectedEntityType === "product" && productSelectionMode === "specific" && selectedProducts.length > 0 && (
                <span className="text-xs text-lime-600 bg-lime-100 px-2 py-0.5 rounded-full font-medium">
                  {selectedProducts.length} Selected
                </span>
              )}
            </label>

            {/* Product Selection Mode Radio Buttons */}
            {selectedEntityType === "product" && (
              <div className="flex gap-6 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="productSelectionMode"
                    value="specific"
                    checked={productSelectionMode === "specific"}
                    onChange={() => setProductSelectionMode("specific")}
                    className="accent-lime-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Specific Products</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="productSelectionMode"
                    value="all"
                    checked={productSelectionMode === "all"}
                    onChange={() => setProductSelectionMode("all")}
                    className="accent-lime-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">All Products</span>
                </label>
              </div>
            )}

            {/* Product Autocomplete Search */}
            {selectedEntityType === "product" && productSelectionMode === "specific" && (
              <div className="space-y-2 relative">
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search product by name or SKU..."
                    className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent text-sm"
                  />
                </div>

                {searchingProducts && (
                  <div className="absolute z-10 w-full bg-white border border-gray-100 rounded-lg shadow-lg p-3 text-center text-xs text-gray-500">
                    Searching products...
                  </div>
                )}

                {!searchingProducts && productsList.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {productsList.map((prod) => (
                      <button
                        key={prod._id}
                        type="button"
                        onClick={() => {
                          if (!selectedProducts.find((p) => p._id === prod._id)) {
                            setSelectedProducts([...selectedProducts, prod])
                          }
                          setProductSearch("")
                          setProductsList([])
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0 ${
                          selectedProducts.some((p) => p._id === prod._id) ? "bg-lime-50 font-semibold text-lime-700" : "text-gray-700"
                        }`}
                      >
                        {prod.name}
                        {prod.sku && <span className="text-xs text-gray-400 ml-2">({prod.sku})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Display Selected Products */}
            {selectedEntityType === "product" && productSelectionMode === "specific" && selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 p-3 bg-gray-50 border border-gray-100 rounded-lg max-h-40 overflow-y-auto">
                {selectedProducts.map((prod) => (
                  <span
                    key={prod._id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-lime-100 text-lime-800 shadow-sm border border-lime-200"
                  >
                    {prod.name}
                    <button
                      type="button"
                      onClick={() => setSelectedProducts(selectedProducts.filter((p) => p._id !== prod._id))}
                      className="text-lime-600 hover:text-lime-900 hover:bg-lime-200 rounded-full p-0.5 transition-colors"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Category Dropdown */}
            {selectedEntityType === "category" && (
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">-- Choose Category --</option>
                {categoriesList.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}

            {/* Subcategory Dropdown */}
            {selectedEntityType === "subcategory" && (
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">-- Choose Subcategory --</option>
                {subCategoriesList.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} (Level {sub.level})
                  </option>
                ))}
              </select>
            )}

            {/* Brand Dropdown */}
            {selectedEntityType === "brand" && (
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent text-sm bg-white"
              >
                <option value="">-- Choose Brand --</option>
                {brandsList.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 3. Payment Methods Selector Checkboxes */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">Allowed Payment Methods</label>
            <div className="space-y-2">
              {PAYMENT_METHODS.map((method) => {
                const checked = selectedMethods.includes(method.id)
                return (
                  <label
                    key={method.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      checked ? "bg-lime-50/50 border-lime-200" : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleMethodCheckboxChange(method.id)}
                      className="accent-lime-500 w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-sm text-gray-800">{method.name}</span>
                    </div>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1 italic">
              * Unchecking all options will fallback to Card and Cash on Delivery.
            </p>
          </div>

          {/* 4. Action Buttons */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={
                saving || 
                (selectedEntityType === "product" 
                  ? (productSelectionMode === "specific" && selectedProducts.length === 0)
                  : !selectedEntityId)
              }
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-lime-500 text-white rounded-lg font-bold hover:bg-lime-600 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Configuration
            </button>
          </div>
        </div>

        {/* Right Column: Custom Rules Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-lime-500" />
              Active Customized Settings
            </h2>
            {selectedTableRows.length > 0 && (
              <button
                onClick={handleBulkReset}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-semibold transition-colors border border-red-100"
              >
                <Trash2 className="w-4 h-4" />
                Reset Selected ({selectedTableRows.length})
              </button>
            )}
          </div>

          {allConfigs.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <p className="text-gray-500 font-medium">No customized payment method rules are configured.</p>
              <p className="text-sm text-gray-400 mt-1">All items are using the default (Card + Cash on Delivery).</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase bg-gray-50/50">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedTableRows.length > 0 && selectedTableRows.length === allConfigs.length}
                        onChange={(e) => handleSelectAllRows(e, allConfigs)}
                        className="accent-lime-500 w-4 h-4 rounded border-gray-300 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Entity Type</th>
                    <th className="py-3 px-4">Name / ID</th>
                    <th className="py-3 px-4">Allowed Methods</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                  {allConfigs.map((item) => (
                    <tr key={item._id} className={`transition-colors ${selectedTableRows.some((r) => r.entityType === item.entityType && r.entityId === item._id) ? 'bg-lime-50/30' : 'hover:bg-gray-50/50'}`}>
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={selectedTableRows.some((r) => r.entityType === item.entityType && r.entityId === item._id)}
                          onChange={() => handleSelectRow(item)}
                          className="accent-lime-500 w-4 h-4 rounded border-gray-300 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 font-medium">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          {item.entityType === "product" && <Package className="w-3.5 h-3.5" />}
                          {item.entityType === "category" && <Tag className="w-3.5 h-3.5" />}
                          {item.entityType === "subcategory" && <Layers className="w-3.5 h-3.5" />}
                          {item.entityType === "brand" && <Palette className="w-3.5 h-3.5" />}
                          {item.typeLabel}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-900 max-w-xs truncate">
                        {item.name || getEntityName(item.entityType, item._id)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {item.paymentMethods && item.paymentMethods.length > 0 ? (
                            item.paymentMethods.map((methodId) => {
                              const found = PAYMENT_METHODS.find((m) => m.id === methodId)
                              return (
                                <span
                                  key={methodId}
                                  className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                                    found?.color || "bg-gray-100 text-gray-600 border-gray-200"
                                  }`}
                                >
                                  {found?.name || methodId}
                                </span>
                              )
                            })
                          ) : (
                            <span className="text-gray-400 italic text-xs">Inherited</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEdit(item.entityType, item)}
                            className="p-1.5 text-gray-600 hover:text-lime-600 hover:bg-lime-50 rounded transition-colors"
                            title="Edit rule"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReset(item.entityType, item._id)}
                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Reset rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
