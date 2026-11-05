"use client"

import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useToast } from "../../context/ToastContext"
import AdminSidebar from "../../components/admin/AdminSidebar"
import { ArrowLeft, Plus, X } from "lucide-react"
import axios from "axios"

import config from "../../config/config"
import { getDeliveryTiers, resolveDeliveryCharge } from "../../utils/deliveryCharge"

const AddDeliveryCharge = () => {
  const navigate = useNavigate()
  const { id } = useParams();
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    charge: "",
    minOrderAmount: "",
    maxOrderAmount: "",
    deliveryTime: "1-2 business days",
    country: "United Arab Emirates",
    countryCode: "AE",
    isInternational: false,
    applicableAreas: [""],
    isActive: true,
    rules: [],
  })
  const [isEdit, setIsEdit] = useState(false);

  const COUNTRY_MAP = {
    "United Arab Emirates": { code: "AE", defaultTime: "1-2 business days", isIntl: false },
    "Oman": { code: "OM", defaultTime: "3-5 business days", isIntl: true },
    "Saudi Arabia": { code: "SA", defaultTime: "3-5 business days", isIntl: true },
    "Qatar": { code: "QA", defaultTime: "3-5 business days", isIntl: true },
    "Bahrain": { code: "BH", defaultTime: "3-5 business days", isIntl: true },
    "Kuwait": { code: "KW", defaultTime: "3-5 business days", isIntl: true },
    "International / Rest of World": { code: "INTL", defaultTime: "5-7 business days", isIntl: true },
  }

  useEffect(() => {
    if (id) {
      setIsEdit(true);
      // Fetch delivery charge by id
      const fetchDeliveryCharge = async () => {
        try {
          const token =
            localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")
          const { data } = await axios.get(`${config.API_URL}/api/delivery-charges/${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          setFormData({
            name: data.name || "",
            description: data.description || "",
            charge: data.charge || "",
            minOrderAmount: data.minOrderAmount || "",
            maxOrderAmount: data.maxOrderAmount || "",
            deliveryTime: data.deliveryTime || "1-2 business days",
            country: data.country || "United Arab Emirates",
            countryCode: data.countryCode || "AE",
            isInternational: typeof data.isInternational === "boolean" ? data.isInternational : (data.country && data.country !== "United Arab Emirates"),
            applicableAreas: data.applicableAreas && data.applicableAreas.length > 0 ? data.applicableAreas : [""],
            isActive: typeof data.isActive === "boolean" ? data.isActive : true,
            rules: Array.isArray(data.rules)
              ? data.rules.map((rule) => ({
                  minOrderAmount: rule.minOrderAmount ?? "",
                  maxOrderAmount: rule.maxOrderAmount ?? "",
                  charge: rule.charge ?? "",
                }))
              : [],
          })
        } catch (error) {
          showToast(error.response?.data?.message || "Failed to fetch delivery charge", "error")
        }
      }
      fetchDeliveryCharge()
    }
  }, [id])

  const handleCountryChange = (countryName) => {
    const info = COUNTRY_MAP[countryName] || { code: "OTHER", defaultTime: "3-7 business days", isIntl: countryName !== "United Arab Emirates" }
    setFormData((prev) => ({
      ...prev,
      country: countryName,
      countryCode: info.code,
      isInternational: info.isIntl,
      deliveryTime: prev.deliveryTime || info.defaultTime,
    }))
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleAreaChange = (index, value) => {
    const newAreas = [...formData.applicableAreas]
    newAreas[index] = value
    setFormData((prev) => ({
      ...prev,
      applicableAreas: newAreas,
    }))
  }

  const addArea = () => {
    setFormData((prev) => ({
      ...prev,
      applicableAreas: [...prev.applicableAreas, ""],
    }))
  }

  const removeArea = (index) => {
    if (formData.applicableAreas.length > 1) {
      const newAreas = formData.applicableAreas.filter((_, i) => i !== index)
      setFormData((prev) => ({
        ...prev,
        applicableAreas: newAreas,
      }))
    }
  }

  const updateRule = (index, field, value) => {
    setFormData((prev) => {
      const rules = [...prev.rules]
      rules[index] = { ...rules[index], [field]: value }
      return { ...prev, rules }
    })
  }

  const addRule = () =>
    setFormData((prev) => ({
      ...prev,
      rules: [...prev.rules, { minOrderAmount: "", maxOrderAmount: "", charge: "" }],
    }))

  const removeRule = (index) =>
    setFormData((prev) => ({ ...prev, rules: prev.rules.filter((_, i) => i !== index) }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")
      if (!token) {
        showToast("Please login as admin first", "error")
        navigate("/irhaasadmin/login")
        return
      }
      const deliveryChargeData = {
        name: formData.name,
        description: formData.description,
        charge: Number.parseFloat(formData.charge),
        minOrderAmount: formData.minOrderAmount ? Number.parseFloat(formData.minOrderAmount) : 0,
        maxOrderAmount: formData.maxOrderAmount ? Number.parseFloat(formData.maxOrderAmount) : null,
        deliveryTime: formData.deliveryTime,
        country: formData.country,
        countryCode: formData.countryCode,
        isInternational: formData.isInternational,
        applicableAreas: formData.applicableAreas.filter((area) => area.trim() !== ""),
        isActive: formData.isActive,
        // Only bands with a charge are sent; the server drops the rest anyway. An empty
        // array means "no bands", which puts the single charge above back in control.
        rules: formData.rules
          .filter((rule) => String(rule.charge).trim() !== "")
          .map((rule) => ({
            minOrderAmount: rule.minOrderAmount === "" ? 0 : Number.parseFloat(rule.minOrderAmount),
            maxOrderAmount: rule.maxOrderAmount === "" ? null : Number.parseFloat(rule.maxOrderAmount),
            charge: Number.parseFloat(rule.charge),
          })),
      }
      if (isEdit) {
        await axios.put(`${config.API_URL}/api/delivery-charges/${id}`, deliveryChargeData, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
        showToast("Delivery charge updated successfully!", "success")
      } else {
        await axios.post(`${config.API_URL}/api/delivery-charges`, deliveryChargeData, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
        showToast("Delivery charge added successfully!", "success")
      }
      navigate("/admin/delivery-charges")
    } catch (error) {
      showToast(error.response?.data?.message || (isEdit ? "Failed to update delivery charge" : "Failed to add delivery charge"), "error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 ml-64 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <button
                onClick={() => navigate("/admin/delivery-charges")}
                className="hover:text-blue-600 flex items-center gap-1"
              >
                <ArrowLeft size={16} />
                Delivery Charges
              </button>
              <span>/</span>
              <span className="text-gray-900">Add Delivery Charge</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Add New Delivery Charge</h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="United Arab Emirates">United Arab Emirates (UAE)</option>
                    <option value="Oman">Oman</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="Qatar">Qatar</option>
                    <option value="Bahrain">Bahrain</option>
                    <option value="Kuwait">Kuwait</option>
                    <option value="International / Rest of World">International / Rest of World</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Type
                  </label>
                  <div className="flex items-center space-x-4 pt-2">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="isInternational"
                        checked={formData.isInternational}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">International Delivery</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Check if this rate applies to cross-border/international shipping</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Standard Delivery, Express GCC, Oman Shipping"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Charge (Rs) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="charge"
                    value={formData.charge}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Describe the delivery service..."
                  />
                </div>
              </div>
            </div>

            {/* Order Amount Criteria */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Amount Criteria</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Order Amount (Rs)</label>
                  <input
                    type="number"
                    name="minOrderAmount"
                    value={formData.minOrderAmount}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty for no minimum</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Order Amount (Rs)</label>
                  <input
                    type="number"
                    name="maxOrderAmount"
                    value={formData.maxOrderAmount}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty for no maximum. Above the maximum, delivery is free.
                  </p>
                </div>
              </div>

              {/* Bands. A shop that charges one price for small baskets and another for
                  large ones needs more than a single figure, and this is where those go. */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Order value bands (optional)</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-2xl">
                      Charge different amounts depending on how big the order is. When you add bands they
                      replace the single charge above. Below the smallest minimum the method cannot be used at
                      all, and above the largest maximum delivery is free.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addRule}
                    className="shrink-0 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                  >
                    + Add band
                  </button>
                </div>

                {formData.rules.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
                    No bands. The single charge above applies to every order that clears the minimum.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {formData.rules.map((rule, index) => (
                      <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Order from (Rs)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rule.minOrderAmount}
                            onChange={(e) => updateRule(index, "minOrderAmount", e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Order up to (Rs)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rule.maxOrderAmount}
                            onChange={(e) => updateRule(index, "maxOrderAmount", e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="No limit"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Delivery charge (Rs)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rule.charge}
                            onChange={(e) => updateRule(index, "charge", e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRule(index)}
                          className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <BandPreview rules={formData.rules} charge={formData.charge} minOrderAmount={formData.minOrderAmount} maxOrderAmount={formData.maxOrderAmount} />
              </div>
            </div>

            {/* Delivery Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Delivery Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Time</label>
                  <select
                    name="deliveryTime"
                    value={formData.deliveryTime}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Same day">Same day</option>
                    <option value="1-2 business days">1-2 business days</option>
                    <option value="2-3 business days">2-3 business days</option>
                    <option value="3-5 business days">3-5 business days</option>
                    <option value="5-7 business days">5-7 business days</option>
                    <option value="1-2 weeks">1-2 weeks</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="isActive"
                        value="true"
                        checked={formData.isActive === true}
                        onChange={() => setFormData((prev) => ({ ...prev, isActive: true }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label className="ml-2 text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="isActive"
                        value="false"
                        checked={formData.isActive === false}
                        onChange={() => setFormData((prev) => ({ ...prev, isActive: false }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label className="ml-2 text-sm text-gray-700">Inactive</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Applicable Areas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Applicable Areas</h2>
                <button
                  type="button"
                  onClick={addArea}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
                >
                  <Plus size={18} className="mr-2" />
                  Add Area
                </button>
              </div>

              <div className="space-y-4">
                {formData.applicableAreas.map((area, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={area}
                        onChange={(e) => handleAreaChange(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Dubai, Abu Dhabi, Sharjah"
                      />
                    </div>
                    {formData.applicableAreas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArea(index)}
                        className="text-red-600 hover:text-red-800 p-2"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {formData.applicableAreas.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 mb-4">No areas added yet</p>
                  <button
                    type="button"
                    onClick={addArea}
                    className="flex items-center mx-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    <Plus size={16} className="mr-2" />
                    Add First Area
                  </button>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pb-8">
              <button
                type="button"
                onClick={() => navigate("/admin/delivery-charges")}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (isEdit ? "Updating..." : "Adding...") : (isEdit ? "Update Delivery Charge" : "Add Delivery Charge")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/**
 * What the configuration above actually does, worked out with the same resolver the
 * storefront and the order endpoint use.
 *
 * Bands are easy to get subtly wrong -- an overlap, a gap, a maximum left blank -- and the
 * consequence is either a shopper charged the wrong shipping or an order that cannot be
 * placed at all. Showing the outcome here means the mistake is visible before it is saved.
 */
const BandPreview = ({ rules, charge, minOrderAmount, maxOrderAmount }) => {
  const method = {
    charge: charge === "" ? 0 : Number(charge),
    minOrderAmount: minOrderAmount === "" ? 0 : Number(minOrderAmount),
    maxOrderAmount: maxOrderAmount === "" ? null : Number(maxOrderAmount),
    rules: rules
      .filter((rule) => String(rule.charge).trim() !== "")
      .map((rule) => ({
        minOrderAmount: rule.minOrderAmount === "" ? 0 : Number(rule.minOrderAmount),
        maxOrderAmount: rule.maxOrderAmount === "" ? null : Number(rule.maxOrderAmount),
        charge: Number(rule.charge),
      })),
  }

  const tiers = getDeliveryTiers(method)
  if (tiers.length === 0) return null

  const lowestMin = tiers[0].minOrderAmount
  const allBounded = tiers.every((tier) => tier.maxOrderAmount !== null)
  const highestMax = tiers.reduce((max, tier) => Math.max(max, tier.maxOrderAmount ?? 0), 0)

  // Sample either side of every boundary, so the row that changes behaviour is the row on
  // screen rather than something the admin has to imagine.
  const samples = new Set()
  if (lowestMin > 0) samples.add(Math.max(0, lowestMin - 1))
  for (const tier of tiers) {
    samples.add(tier.minOrderAmount)
    if (tier.maxOrderAmount !== null) samples.add(tier.maxOrderAmount)
  }
  if (allBounded) samples.add(highestMax + 1)

  const rows = [...samples]
    .sort((a, b) => a - b)
    .map((subtotal) => ({ subtotal, ...resolveDeliveryCharge(method, subtotal) }))

  const money = (n) => `Rs ${Number(n).toFixed(2)}`

  return (
    <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h4 className="text-sm font-semibold text-blue-900">What this will do</h4>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[380px] text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-blue-800">
              <th className="pb-2 pr-4">Order value</th>
              <th className="pb-2">Delivery</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100">
            {rows.map((row) => (
              <tr key={row.subtotal}>
                <td className="py-1.5 pr-4 text-blue-900">{money(row.subtotal)}</td>
                <td className="py-1.5">
                  {!row.available ? (
                    <span className="font-semibold text-red-600">Cannot be delivered</span>
                  ) : row.isFree ? (
                    <span className="font-semibold text-green-700">Free</span>
                  ) : (
                    <span className="text-blue-900">{money(row.charge)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lowestMin > 0 && (
        <p className="mt-3 text-xs text-blue-800">
          Orders under {money(lowestMin)} cannot use this method. If no other method covers them, those
          orders cannot be placed for home delivery at all.
        </p>
      )}
      {!allBounded && (
        <p className="mt-1 text-xs text-blue-800">
          One band has no maximum, so large orders keep being charged. Set a maximum on it to make delivery
          free above that amount.
        </p>
      )}
    </div>
  )
}

export default AddDeliveryCharge
