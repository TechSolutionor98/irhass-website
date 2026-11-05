"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import AdminSidebar from "../../components/admin/AdminSidebar"
import { Plus, Edit, Trash2, Percent, Calendar, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react"
import Select from 'react-select'

import config from "../../config/config"
const AllCoupons = () => {
  const [coupons, setCoupons] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [filter, setFilter] = useState("all")
  const [rules, setRules] = useState([])

  const handleAddRule = () => {
    setRules((prev) => [...prev, { minCartAmount: "", maxCartAmount: "", discountType: "percentage", discountValue: "" }])
  }

  const handleUpdateRule = (index, field, value) => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  const handleDeleteRule = (index) => {
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

  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "",
    categories: [],
    minOrderAmount: "",
    maxDiscountAmount: "",
    usageLimit: "",
    validFrom: "",
    validUntil: "",
    isActive: true,
    visibility: "public", // <-- add this line
  })

  useEffect(() => {
    fetchCoupons()
    fetchCategories()
  }, [])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/coupons/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setCoupons(data)
      setLoading(false)
    } catch (error) {
      setError("Failed to load coupons. Please try again later.")
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/categories`)
      setCategories(data)
    } catch (error) {
      console.error("Failed to load categories:", error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // Validate rules if any exist
    if (rules.length > 0) {
      const parsedRules = []
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i]
        const min = parseFloat(r.minCartAmount)
        const max = parseFloat(r.maxCartAmount)
        const val = parseFloat(r.discountValue)

        if (Number.isNaN(min) || min < 0) {
          setError(`Rule ${i + 1}: Minimum Cart Amount must be a valid number >= 0.`)
          return
        }
        if (Number.isNaN(max) || max < min) {
          setError(`Rule ${i + 1}: Maximum Cart Amount must be greater than or equal to Minimum Cart Amount (${min}).`)
          return
        }
        if (Number.isNaN(val) || val < 0) {
          setError(`Rule ${i + 1}: Discount value is required and must be >= 0.`)
          return
        }
        if (r.discountType === "percentage" && val > 100) {
          setError(`Rule ${i + 1}: Percentage discount cannot exceed 100%.`)
          return
        }
        if (r.discountType === "fixed" && val > min) {
          setError(`Rule ${i + 1}: Fixed discount amount (Rs ${val}) cannot exceed the minimum cart amount (Rs ${min}) for this slab.`)
          return
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
          setError(`Overlapping ranges: Slab [Rs ${prevRule.minCartAmount} - Rs ${prevRule.maxCartAmount}] overlaps with Slab [Rs ${rules[curr.index].minCartAmount} - Rs ${rules[curr.index].maxCartAmount}].`)
          return
        }
      }
    }

    try {
      const token = localStorage.getItem("adminToken")
      const formattedRules = rules.map((r) => ({
        minCartAmount: parseFloat(r.minCartAmount),
        maxCartAmount: parseFloat(r.maxCartAmount),
        discountType: r.discountType,
        discountValue: parseFloat(r.discountValue),
      }))

      const couponData = {
        ...formData,
        discountValue: Number.parseFloat(formData.discountValue),
        minOrderAmount: Number.parseFloat(formData.minOrderAmount) || 0,
        maxDiscountAmount: formData.maxDiscountAmount ? Number.parseFloat(formData.maxDiscountAmount) : null,
        usageLimit: formData.usageLimit ? Number.parseInt(formData.usageLimit) : null,
        categories: formData.categories.includes("ALL") ? [] : formData.categories,
        visibility: formData.visibility || "public",
        rules: formattedRules,
      }

      if (editingCoupon) {
        await axios.put(`${config.API_URL}/api/coupons/${editingCoupon._id}`, couponData, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        await axios.post(`${config.API_URL}/api/coupons`, couponData, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }

      fetchCoupons()
      setShowForm(false)
      setEditingCoupon(null)
      resetForm()
    } catch (error) {
      setError(error.response?.data?.message || "Failed to save coupon. Please try again.")
    }
  }

  const resetForm = () => {
    setFormData({
      code: "",
      description: "",
      discountType: "percentage",
      discountValue: "",
      categories: [],
      minOrderAmount: "",
      maxDiscountAmount: "",
      usageLimit: "",
      validFrom: "",
      validUntil: "",
      isActive: true,
      visibility: "public",
    })
    setRules([])
  }

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon)
    setFormData({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      categories: coupon.categories ? coupon.categories.map(cat => cat._id || cat) : [],
      minOrderAmount: coupon.minOrderAmount.toString(),
      maxDiscountAmount: coupon.maxDiscountAmount?.toString() || "",
      usageLimit: coupon.usageLimit?.toString() || "",
      validFrom: new Date(coupon.validFrom).toISOString().split("T")[0],
      validUntil: new Date(coupon.validUntil).toISOString().split("T")[0],
      isActive: coupon.isActive,
      visibility: coupon.visibility || "public",
    })
    setRules(
      coupon.rules
        ? coupon.rules.map((r) => ({
            minCartAmount: String(r.minCartAmount),
            maxCartAmount: String(r.maxCartAmount),
            discountType: r.discountType,
            discountValue: String(r.discountValue),
          }))
        : []
    )
    setShowForm(true)
  }

  const handleDelete = async (couponId) => {
    if (window.confirm("Are you sure you want to delete this coupon?")) {
      try {
        const token = localStorage.getItem("adminToken")
        await axios.delete(`${config.API_URL}/api/coupons/${couponId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        fetchCoupons()
      } catch (error) {
        setError("Failed to delete coupon. Please try again.")
      }
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingCoupon(null)
    resetForm()
  }

  const getStatusBadge = (coupon) => {
    const isExpired = new Date(coupon.validUntil) < new Date()
    const isActive = coupon.isActive && !isExpired

    if (isExpired) {
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
          <EyeOff className="h-3 w-3 mr-1" />
          Expired
        </span>
      )
    } else if (!coupon.isActive) {
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
          <EyeOff className="h-3 w-3 mr-1" />
          Inactive
        </span>
      )
    } else {
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
          <Eye className="h-3 w-3 mr-1" />
          Active
        </span>
      )
    }
  }

  // Filtering logic
  const filteredCoupons = coupons.filter(coupon => {
    const isExpired = new Date(coupon.validUntil) < new Date();
    const isActive = coupon.isActive && !isExpired;
    if (filter === "all") return true;
    if (filter === "active") return isActive;
    if (filter === "expired") return isExpired || !coupon.isActive;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">All Coupons</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-lime-400 text-black font-medium py-2 px-4 rounded-md flex items-center"
          >
            <Plus size={18} className="mr-1" />
            Add New Coupon
          </button>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            className={`px-4 py-2 rounded-md font-medium border ${filter === "all" ? "bg-lime-500 text-white border-lime-500" : "bg-white text-gray-700 border-gray-300"}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={`px-4 py-2 rounded-md font-medium border ${filter === "active" ? "bg-lime-500 text-white border-lime-500" : "bg-white text-gray-700 border-gray-300"}`}
            onClick={() => setFilter("active")}
          >
            Active
          </button>
          <button
            className={`px-4 py-2 rounded-md font-medium border ${filter === "expired" ? "bg-lime-500 text-white border-lime-500" : "bg-white text-gray-700 border-gray-300"}`}
            onClick={() => setFilter("expired")}
          >
            Expired/Disabled
          </button>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-md">{error}</div>}

        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{editingCoupon ? "Edit Coupon" : "Add New Coupon"}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="SAVE20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categories</label>
                  <Select
                    isMulti
                    options={[
                      { value: "ALL", label: "All Categories" },
                      ...categories.map(cat => ({ value: cat._id, label: cat.name }))
                    ]}
                    value={
                      formData.categories.includes("ALL")
                        ? [{ value: "ALL", label: "All Categories" }]
                        : categories.filter(cat => formData.categories.includes(cat._id)).map(cat => ({ value: cat._id, label: cat.name }))
                    }
                    onChange={selected => {
                      if (!selected || selected.length === 0) {
                        setFormData({ ...formData, categories: [] })
                      } else if (Array.isArray(selected) && selected.some(option => option.value === "ALL")) {
                        setFormData({ ...formData, categories: ["ALL"] })
                      } else {
                        setFormData({ ...formData, categories: selected.map(option => option.value) })
                      }
                    }}
                    classNamePrefix="react-select"
                    placeholder="Select categories..."
                  />
                </div>
              </div>

              {/* Visibility Radio Buttons */}
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                <div className="flex gap-6">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={formData.visibility === "public"}
                      onChange={() => setFormData({ ...formData, visibility: "public" })}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Public</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={formData.visibility === "private"}
                      onChange={() => setFormData({ ...formData, visibility: "private" })}
                      className="form-radio h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2">Private</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the coupon offer"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value</label>
                  <input
                    type="number"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={formData.discountType === "percentage" ? "20" : "500"}
                    min="0"
                    step={formData.discountType === "percentage" ? "1" : "0.01"}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">{formData.discountType === "percentage" ? "%" : "PKR"}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Amount</label>
                  <input
                    type="number"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1000"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.discountType === "percentage" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Discount Amount (Optional)
                    </label>
                    <input
                      type="number"
                      value={formData.maxDiscountAmount}
                      onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="1000"
                      min="0"
                      step="0.01"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit (Optional)</label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="100"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Discount Slabs & Rules (Optional) */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">
                      Discount Slabs & Rules (Optional)
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Define spending tiers. Ensure cart slab ranges are continuous and do not overlap. If no rules are added, the default Min Order Amount and Discount Value will be used.
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                  Active
                </label>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  {editingCoupon ? "Update" : "Create"} Coupon
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coupon
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Discount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Validity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCoupons.length > 0 ? (
                    filteredCoupons.map((coupon) => (
                      <tr key={coupon._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <Percent className="h-5 w-5 text-blue-600" />
                              </div>
                            </div>
                            <div className="ml-4 max-w-xs xl:max-w-sm">
                              <div className="text-sm font-medium text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded inline-block">
                                {coupon.code}
                              </div>
                              <div className="text-sm text-gray-500 mt-1 truncate" title={coupon.description}>{coupon.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                            {coupon.categories.length === 0
                              ? "All Categories"
                              : coupon.categories.map(cat => cat.name).join(", ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {coupon.rules && coupon.rules.length > 0 ? (
                            <div>
                              <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                Tiered: {coupon.rules.length} slab(s)
                              </span>
                              <div className="text-xs text-gray-500 mt-1">
                                Rs {coupon.rules[0].minCartAmount}+
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm text-gray-900">
                                {coupon.discountType === "percentage"
                                  ? `${coupon.discountValue}%`
                                  : `Rs ${coupon.discountValue}`}
                              </div>
                              {coupon.minOrderAmount > 0 && (
                                <div className="text-xs text-gray-500">Min: Rs {coupon.minOrderAmount}</div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {coupon.usedCount}/{coupon.usageLimit || "∞"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="flex items-center mb-1">
                              <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                              {new Date(coupon.validFrom).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              to {new Date(coupon.validUntil).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(coupon)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => handleEdit(coupon)} className="text-blue-600 hover:text-blue-900 mr-4">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => handleDelete(coupon._id)} className="text-red-600 hover:text-red-900">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                        No coupons found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AllCoupons
