"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import {
  Smartphone,
  Settings,
  Plus,
  Edit,
  Trash2,
  Percent,
  Calendar,
  Eye,
  EyeOff,
} from "lucide-react"
import AdminSidebar from "../../components/admin/AdminSidebar"
import config from "../../config/config"

const AppDiscountSettings = () => {
  const navigate = useNavigate()

  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState("all")

  const token = localStorage.getItem("adminToken")

  const fetchDiscounts = async () => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/app-discounts/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setDiscounts(Array.isArray(data) ? data : [])
    } catch {
      setError("Failed to load app discounts.")
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchDiscounts()
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteDiscount = async (id) => {
    if (!window.confirm("Are you sure you want to delete this app discount?")) return
    try {
      await axios.delete(`${config.API_URL}/api/app-discounts/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      await fetchDiscounts()
    } catch {
      setError("Failed to delete discount.")
    }
  }

  const getStatusBadge = (item) => {
    const isExpired = item.endsAt && new Date(item.endsAt) < new Date()
    if (isExpired) {
      return (
        <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
          <EyeOff className="h-3 w-3 mr-1 mt-0.5" /> Expired
        </span>
      )
    }
    if (!item.isActive) {
      return (
        <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-red-100 text-red-800">
          <EyeOff className="h-3 w-3 mr-1 mt-0.5" /> Inactive
        </span>
      )
    }
    return (
      <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-green-100 text-green-800">
        <Eye className="h-3 w-3 mr-1 mt-0.5" /> Active
      </span>
    )
  }

  const filteredDiscounts = discounts.filter((item) => {
    const isExpired = item.endsAt && new Date(item.endsAt) < new Date()
    const isActive = item.isActive && !isExpired
    if (filter === "active") return isActive
    if (filter === "expired") return isExpired || !item.isActive
    return true
  })

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Smartphone size={22} className="text-lime-600" />
              App Discount Settings
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage app-exclusive discounts and configure the promotional popup.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/app-discount-settings/popup-settings")}
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Settings size={16} />
              Popup Settings
            </button>
            <button
              onClick={() => navigate("/admin/app-discount-settings/add")}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-lime-500 text-white font-medium hover:bg-lime-600 transition-colors shadow-sm"
            >
              <Plus size={16} />
              Add Discount
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-5">
          {["all", "active", "expired"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filter === f
                  ? "bg-lime-500 text-white border-lime-500"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {f === "all" ? "All" : f === "active" ? "Active" : "Expired / Disabled"}
            </button>
          ))}
        </div>

        {/* Discounts Table */}
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-lime-500" />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Coupon Code
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Scope / Target
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Rules Slabs
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Eligibility
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Validity
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredDiscounts.length > 0 ? (
                    filteredDiscounts.map((item) => (
                      <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-lime-100 flex items-center justify-center flex-shrink-0">
                              <Percent className="text-lime-600" size={16} />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-sm">
                                {item.name}
                              </div>
                              {item.description && (
                                <p className="text-gray-400 text-xs mt-0.5 truncate max-w-[200px]">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-100 font-mono">
                            {item.appliesTo === "products"
                              ? `${item.products?.length || 0} Products`
                              : item.appliesTo === "categories"
                              ? `${item.categories?.length || 0} Categories`
                              : item.appliesTo === "subcategories"
                              ? `${item.subcategories?.length || 0} Subcategories`
                              : "All Products"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {Array.isArray(item.rules) && item.rules.length > 0 ? (
                            <div className="flex flex-col gap-1 max-w-xs">
                              {item.rules.map((r, ri) => (
                                <div key={ri} className="text-xs bg-gray-50 rounded px-2 py-0.5 border border-gray-100 font-mono">
                                  Rs {r.minCartAmount}-{r.maxCartAmount} → {r.discountType === "percentage" ? `${r.discountValue}%` : `Rs ${r.discountValue}`}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs font-mono text-gray-600 bg-gray-50 rounded px-2 py-0.5 border border-gray-100 inline-block">
                              {item.discountType === "percentage"
                                ? `${item.discountValue}%`
                                : `Rs ${item.discountValue}`}
                              {item.minOrderAmount > 0 && ` (Min: Rs ${item.minOrderAmount})`}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-700">
                          <div>User: <span className="font-medium capitalize">{item.userEligibility || (item.onlyNewAppUsers ? "new" : "all")}</span></div>
                          <div className="mt-0.5">Usage: <span className="font-medium capitalize">{item.usageLimitType || (item.singleUsePerUser ? "one-time" : "unlimited")}</span></div>
                          <div className="mt-0.5">Method: <span className="font-medium capitalize">{item.applicationMode || "manual"}</span></div>
                        </td>
                        <td className="px-5 py-4 text-gray-500">
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar size={12} className="text-gray-400" />
                            {new Date(item.startsAt).toLocaleDateString()}
                            {" – "}
                            {new Date(item.endsAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-5 py-4">{getStatusBadge(item)}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              className="text-blue-500 hover:text-blue-700 transition-colors"
                              onClick={() => navigate(`/admin/app-discount-settings/edit/${item._id}`)}
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              className="text-red-500 hover:text-red-700 transition-colors"
                              onClick={() => handleDeleteDiscount(item._id)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">
                        No app discounts found.{" "}
                        <button
                          className="text-lime-600 font-medium hover:underline"
                          onClick={() => navigate("/admin/app-discount-settings/add")}
                        >
                          Add one now
                        </button>
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

export default AppDiscountSettings
