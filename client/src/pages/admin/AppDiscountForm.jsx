"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  AlertCircle,
} from "lucide-react"
import Select from "react-select"
import AdminSidebar from "../../components/admin/AdminSidebar"
import config from "../../config/config"

const EMPTY_RULE = {
  minCartAmount: "",
  maxCartAmount: "",
  discountType: "percentage",
  discountValue: "",
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 text-sm"

const AppDiscountForm = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const token = localStorage.getItem("adminToken")

  const [name, setName] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [appliesTo, setAppliesTo] = useState("all")
  const [selectedProducts, setSelectedProducts] = useState([])
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedSubcategories, setSelectedSubcategories] = useState([])
  const [userEligibility, setUserEligibility] = useState("all") // "all" | "new"
  const [usageLimitType, setUsageLimitType] = useState("one-time") // "one-time" | "unlimited"
  const [applicationMode, setApplicationMode] = useState("manual") // "manual" | "automatic"
  
  // Date-times
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")

  // Dynamic Rule Builder Slabs
  const [rules, setRules] = useState([
    { minCartAmount: "0", maxCartAmount: "300", discountType: "percentage", discountValue: "10" }
  ])

  // Option lists for selects
  const [productsList, setProductsList] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [categoriesList, setCategoriesList] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [subcategoriesList, setSubcategoriesList] = useState([])
  const [loadingSubcategories, setLoadingSubcategories] = useState(false)

  // Loading/Status
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // ── Load product options ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true)
      try {
        const { data } = await axios.get(`${config.API_URL}/api/products`, {
          params: { limit: 1000 },
        })
        const items = data.products || data || []
        setProductsList(
          items.map((p) => ({
            value: p._id,
            label: `${p.name} (SKU: ${p.sku || "N/A"}) - Rs ${p.price}`,
          }))
        )
      } catch (err) {
        console.error("Failed to load products list", err)
      } finally {
        setLoadingProducts(false)
      }
    }
    fetchProducts()
  }, [])

  // ── Load categories options ────────────────────────────────────────────────
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true)
      try {
        const { data } = await axios.get(`${config.API_URL}/api/categories`)
        const items = data || []
        setCategoriesList(
          items.map((c) => ({
            value: c._id,
            label: c.name,
          }))
        )
      } catch (err) {
        console.error("Failed to load categories list", err)
      } finally {
        setLoadingCategories(false)
      }
    }
    fetchCategories()
  }, [])

  // ── Load subcategories options ─────────────────────────────────────────────
  useEffect(() => {
    const fetchSubcategories = async () => {
      setLoadingSubcategories(true)
      try {
        const { data } = await axios.get(`${config.API_URL}/api/subcategories`)
        const items = data || []
        setSubcategoriesList(
          items.map((sc) => ({
            value: sc._id,
            label: `${sc.name} ${sc.parentCategory ? `(${sc.parentCategory.name || ""})` : ""}`,
          }))
        )
      } catch (err) {
        console.error("Failed to load subcategories list", err)
      } finally {
        setLoadingSubcategories(false)
      }
    }
    fetchSubcategories()
  }, [])

  // ── Load discount details if editing ──────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    const fetchDiscount = async () => {
      setLoading(true)
      try {
        const { data } = await axios.get(`${config.API_URL}/api/app-discounts/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setName(data.name || "")
        setIsActive(data.isActive !== false)
        setAppliesTo(data.appliesTo || "all")
        setUserEligibility(data.userEligibility || (data.onlyNewAppUsers ? "new" : "all"))
        setUsageLimitType(data.usageLimitType || (data.singleUsePerUser ? "one-time" : "unlimited"))
        setApplicationMode(data.applicationMode || "manual")

        if (data.startsAt) {
          setStartsAt(new Date(data.startsAt).toISOString().slice(0, 16))
        }
        if (data.endsAt) {
          setEndsAt(new Date(data.endsAt).toISOString().slice(0, 16))
        }

        if (Array.isArray(data.products)) {
          setSelectedProducts(
            data.products.map((p) => ({
              value: p._id || p,
              label: p.name ? `${p.name} - Rs ${p.price}` : String(p),
            }))
          )
        }

        if (Array.isArray(data.categories)) {
          setSelectedCategories(
            data.categories.map((c) => ({
              value: c._id || c,
              label: c.name || String(c),
            }))
          )
        }

        if (Array.isArray(data.subcategories)) {
          setSelectedSubcategories(
            data.subcategories.map((sc) => ({
              value: sc._id || sc,
              label: sc.name || String(sc),
            }))
          )
        }

        if (Array.isArray(data.rules) && data.rules.length > 0) {
          setRules(
            data.rules.map((r) => ({
              minCartAmount: String(r.minCartAmount),
              maxCartAmount: String(r.maxCartAmount),
              discountType: r.discountType,
              discountValue: String(r.discountValue),
            }))
          )
        } else {
          // Fallback from legacy values if rules list is empty
          setRules([
            {
              minCartAmount: String(data.minOrderAmount || 0),
              maxCartAmount: "999999", // High fallback
              discountType: data.discountType || "percentage",
              discountValue: String(data.discountValue || 0),
            },
          ])
        }
      } catch (err) {
        setError("Failed to load app discount details.")
      } finally {
        setLoading(false)
      }
    }
    fetchDiscount()
  }, [id, isEdit, token])

  // ── Rule Slab handlers ──────────────────────────────────────────────────────
  const handleAddRule = () => {
    setRules((prev) => [...prev, { ...EMPTY_RULE }])
  }

  const handleUpdateRule = (index, field, value) => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  const handleDeleteRule = (index) => {
    if (rules.length <= 1) {
      alert("At least one discount rule slab is required.")
      return
    }
    setRules((prev) => prev.filter((_, i) => i !== index))
  }

  const handleMoveRule = (index, direction) => {
    const nextIndex = direction === "up" ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= rules.length) return
    setRules((prev) => {
      const copy = [...prev]
      const temp = copy[index]
      copy[index] = copy[nextIndex]
      copy[nextIndex] = temp
      return copy
    })
  }

  // ── Validation logic ────────────────────────────────────────────────────────
  const validateForm = () => {
    if (!name.trim()) return "Discount name is required."
    if (!startsAt) return "Valid start date & time is required."
    if (!endsAt) return "Valid end date & time is required."
    if (new Date(endsAt) <= new Date(startsAt)) return "End date must be after start date."

    if (appliesTo === "products" && selectedProducts.length === 0) {
      return "Please select at least one product when scope is set to 'Specific Products'."
    }
    if (appliesTo === "categories" && selectedCategories.length === 0) {
      return "Please select at least one category when scope is set to 'Specific Categories'."
    }
    if (appliesTo === "subcategories" && selectedSubcategories.length === 0) {
      return "Please select at least one subcategory when scope is set to 'Specific Subcategories'."
    }

    if (rules.length === 0) return "At least one discount rule slab must be configured."

    const parsedRules = []

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i]
      const min = parseFloat(r.minCartAmount)
      const max = parseFloat(r.maxCartAmount)
      const val = parseFloat(r.discountValue)

      if (Number.isNaN(min) || min < 0) {
        return `Rule ${i + 1}: Minimum Cart Amount must be a valid number >= 0.`
      }
      if (Number.isNaN(max) || max < min) {
        return `Rule ${i + 1}: Maximum Cart Amount must be greater than or equal to Minimum Cart Amount (${min}).`
      }
      if (Number.isNaN(val) || val < 0) {
        return `Rule ${i + 1}: Discount value is required and must be >= 0.`
      }
      if (r.discountType === "percentage" && val > 100) {
        return `Rule ${i + 1}: Percentage discount cannot exceed 100%.`
      }
      if (r.discountType === "fixed" && val > min) {
        return `Rule ${i + 1}: Fixed discount amount (Rs ${val}) cannot exceed the minimum cart amount (Rs ${min}) for this slab.`
      }

      parsedRules.push({ min, max, index: i })
    }

    // Check for range overlaps
    parsedRules.sort((a, b) => a.min - b.min)
    for (let i = 1; i < parsedRules.length; i++) {
      const prev = parsedRules[i - 1]
      const curr = parsedRules[i]
      const prevRule = rules[prev.index]
      if (curr.min <= prev.max) {
        return `Overlapping ranges: Slab [Rs ${prevRule.minCartAmount} - Rs ${prevRule.maxCartAmount}] overlaps with Slab [Rs ${rules[curr.index].minCartAmount} - Rs ${rules[curr.index].maxCartAmount}].`
      }
    }

    return null
  };

  // ── Submission ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    setSaving(true)

    try {
      const formattedRules = rules.map((r) => ({
        minCartAmount: parseFloat(r.minCartAmount),
        maxCartAmount: parseFloat(r.maxCartAmount),
        discountType: r.discountType,
        discountValue: parseFloat(r.discountValue),
      }))

      const payload = {
        name: name.trim(),
        isActive,
        appliesTo,
        products: appliesTo === "products" ? selectedProducts.map((p) => p.value) : [],
        categories: appliesTo === "categories" ? selectedCategories.map((c) => c.value) : [],
        subcategories: appliesTo === "subcategories" ? selectedSubcategories.map((sc) => sc.value) : [],
        userEligibility,
        usageLimitType,
        applicationMode,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        rules: formattedRules,
      }

      if (isEdit) {
        await axios.put(`${config.API_URL}/api/app-discounts/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        await axios.post(`${config.API_URL}/api/app-discounts`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }

      navigate("/admin/app-discount-settings")
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save app discount config.")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/admin/app-discount-settings")}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? "Edit App Discount" : "Create App Discount"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Define target audience, eligibility, usage limit, and tiered discount rules.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-2 shadow-sm">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lime-500" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. GENERAL INFORMATION */}
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800 border-b pb-3 mb-4">
                General Information
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Coupon Code *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  className={inputClass}
                  placeholder="e.g. EID10"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  This acts as the coupon code the user must type in the mobile app to get the discount (case-insensitive).
                </p>
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Discount Application Method
                </label>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="applicationMode"
                      value="manual"
                      checked={applicationMode === "manual"}
                      onChange={() => setApplicationMode("manual")}
                      className="mt-1 h-4 w-4 text-lime-500 focus:ring-lime-400"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800">Enter Manually</span>
                      <p className="text-xs text-gray-400 mt-0.5">User must manually enter the coupon code at checkout.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="applicationMode"
                      value="automatic"
                      checked={applicationMode === "automatic"}
                      onChange={() => setApplicationMode("automatic")}
                      className="mt-1 h-4 w-4 text-lime-500 focus:ring-lime-400"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800">Apply Automatically</span>
                      <p className="text-xs text-gray-400 mt-0.5">Discount is automatically applied on eligible pages/checkout.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded text-lime-500 focus:ring-lime-400"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Activate this discount configuration
                </label>
              </div>
            </div>

            {/* 2. AUDIENCE & LIMITS */}
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
              <h2 className="text-base font-semibold text-gray-800 border-b pb-3 mb-4">
                Audience & Limits
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* User Eligibility */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    User Eligibility
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="userEligibility"
                        value="all"
                        checked={userEligibility === "all"}
                        onChange={() => setUserEligibility("all")}
                        className="mt-1 h-4 w-4 text-lime-500 focus:ring-lime-400"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">All Users</span>
                        <p className="text-xs text-gray-400 mt-0.5">Any registered app user can apply this discount.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="userEligibility"
                        value="new"
                        checked={userEligibility === "new"}
                        onChange={() => setUserEligibility("new")}
                        className="mt-1 h-4 w-4 text-lime-500 focus:ring-lime-400"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">New Users Only</span>
                        <p className="text-xs text-gray-400 mt-0.5">Only applicable on a user's first order placed in the app.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Usage Limit */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Usage Limit
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="usageLimitType"
                        value="one-time"
                        checked={usageLimitType === "one-time"}
                        onChange={() => setUsageLimitType("one-time")}
                        className="mt-1 h-4 w-4 text-lime-500 focus:ring-lime-400"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">One Time Use</span>
                        <p className="text-xs text-gray-400 mt-0.5">A single customer can only redeem this discount once.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="usageLimitType"
                        value="unlimited"
                        checked={usageLimitType === "unlimited"}
                        onChange={() => setUsageLimitType("unlimited")}
                        className="mt-1 h-4 w-4 text-lime-500 focus:ring-lime-400"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">Unlimited Usage</span>
                        <p className="text-xs text-gray-400 mt-0.5">Customers can redeem this discount on multiple checkouts.</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. TARGETING SCOPE */}
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800 border-b pb-3 mb-4">
                Targeting Scope
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Applies To
                  </label>
                  <select
                    value={appliesTo}
                    onChange={(e) => setAppliesTo(e.target.value)}
                    className={inputClass}
                  >
                    <option value="all">All Products</option>
                    <option value="categories">Specific Categories</option>
                    <option value="subcategories">Specific Subcategories</option>
                    <option value="products">Specific Products</option>
                  </select>
                </div>

                {appliesTo === "products" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Products *
                    </label>
                    <Select
                      isMulti
                      options={productsList}
                      value={selectedProducts}
                      onChange={setSelectedProducts}
                      isLoading={loadingProducts}
                      placeholder="Search and select products..."
                      classNamePrefix="react-select"
                      className="text-sm"
                    />
                  </div>
                )}

                {appliesTo === "categories" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Categories *
                    </label>
                    <Select
                      isMulti
                      options={categoriesList}
                      value={selectedCategories}
                      onChange={setSelectedCategories}
                      isLoading={loadingCategories}
                      placeholder="Search and select categories..."
                      classNamePrefix="react-select"
                      className="text-sm"
                    />
                  </div>
                )}

                {appliesTo === "subcategories" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Select Subcategories *
                    </label>
                    <Select
                      isMulti
                      options={subcategoriesList}
                      value={selectedSubcategories}
                      onChange={setSelectedSubcategories}
                      isLoading={loadingSubcategories}
                      placeholder="Search and select subcategories..."
                      classNamePrefix="react-select"
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 4. VALIDITY PERIOD */}
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800 border-b pb-3 mb-4">
                Validity Period
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Starts At *
                  </label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ends At *
                  </label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            </div>

            {/* 5. DYNAMIC RULE slabs */}
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">
                    Discount Slabs & Rules
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Define spending tiers. Ensure cart slab ranges are continuous and do not overlap.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-lime-500 hover:bg-lime-600 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                >
                  <Plus size={14} />
                  Add Rule Slab
                </button>
              </div>

              <div className="space-y-4">
                {rules.map((rule, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-xl bg-gray-50/50 flex flex-col md:flex-row items-center gap-4 relative"
                  >
                    {/* Indicator */}
                    <div className="hidden md:flex flex-col items-center justify-center bg-gray-200 text-gray-600 w-8 h-8 rounded-full font-mono text-xs font-bold">
                      {index + 1}
                    </div>

                    {/* Spend range */}
                    <div className="grid grid-cols-2 gap-2 flex-1 w-full">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">
                          Min Cart Amount (Rs)
                        </label>
                        <input
                          type="number"
                          value={rule.minCartAmount}
                          onChange={(e) => handleUpdateRule(index, "minCartAmount", e.target.value)}
                          className={inputClass}
                          placeholder="e.g. 0"
                          min="0"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">
                          Max Cart Amount (Rs)
                        </label>
                        <input
                          type="number"
                          value={rule.maxCartAmount}
                          onChange={(e) => handleUpdateRule(index, "maxCartAmount", e.target.value)}
                          className={inputClass}
                          placeholder="e.g. 300"
                          min="0"
                          required
                        />
                      </div>
                    </div>

                    {/* Discount config */}
                    <div className="grid grid-cols-2 gap-2 flex-1 w-full">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">
                          Discount Type
                        </label>
                        <select
                          value={rule.discountType}
                          onChange={(e) => handleUpdateRule(index, "discountType", e.target.value)}
                          className={inputClass}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (Rs)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-0.5">
                          Value
                        </label>
                        <input
                          type="number"
                          value={rule.discountValue}
                          onChange={(e) => handleUpdateRule(index, "discountValue", e.target.value)}
                          className={inputClass}
                          placeholder={rule.discountType === "percentage" ? "15" : "50"}
                          min="0"
                          step={rule.discountType === "percentage" ? "1" : "0.01"}
                          required
                        />
                      </div>
                    </div>

                    {/* Reorder and Delete controls */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveRule(index, "up")}
                          disabled={index === 0}
                          className="p-1 rounded bg-white border hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                          title="Move up"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveRule(index, "down")}
                          disabled={index === rules.length - 1}
                          className="p-1 rounded bg-white border hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                          title="Move down"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(index)}
                        className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FORM CONTROLS */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => navigate("/admin/app-discount-settings")}
                className="px-5 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-lime-500 hover:bg-lime-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
              >
                <Save size={16} />
                {saving ? "Saving Configuration..." : "Save Discount Config"}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  )
}

export default AppDiscountForm
