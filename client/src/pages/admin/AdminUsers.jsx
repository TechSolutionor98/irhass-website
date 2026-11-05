"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { adminAPI } from "../../services/api"
import AdminSidebar from "../../components/admin/AdminSidebar"
import {
  Search,
  Mail,
  Calendar,
  User,
  Shield,
  Download,
  Gift,
  Award,
  Edit3,
  X,
  CheckCircle2,
  AlertCircle,
  Zap,
  Filter,
  RotateCcw,
} from "lucide-react"
import { downloadCsv } from "../../utils/csvExport"
import config from "../../config/config"
import { describeApiError } from "../../utils/apiError"

const AdminUsers = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filtration & Sorting states
  const [filterReferralType, setFilterReferralType] = useState("")
  const [filterLoyaltyType, setFilterLoyaltyType] = useState("")
  const [filterPurchased, setFilterPurchased] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [filterDateRange, setFilterDateRange] = useState("")
  const [sortBy, setSortBy] = useState("newest")

  // Types available for assignment
  const [referralTypes, setReferralTypes] = useState([])
  const [loyaltyTypes, setLoyaltyTypes] = useState([])

  // Modal target
  const [tierModalTarget, setTierModalTarget] = useState(null)
  const [selectedReferralType, setSelectedReferralType] = useState("")
  const [selectedLoyaltyType, setSelectedLoyaltyType] = useState("")
  const [savingTiers, setSavingTiers] = useState(false)

  const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
  const authHeader = { headers: { Authorization: `Bearer ${token}` } }

  const hasActiveFilters = Boolean(
    searchTerm ||
      filterReferralType ||
      filterLoyaltyType ||
      filterPurchased ||
      filterRole ||
      filterDateRange ||
      sortBy !== "newest",
  )

  const handleClearFilters = () => {
    setSearchTerm("")
    setFilterReferralType("")
    setFilterLoyaltyType("")
    setFilterPurchased("")
    setFilterRole("")
    setFilterDateRange("")
    setSortBy("newest")
    setPage(1)
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = {
        page,
        limit: 20,
        search: searchTerm.trim(),
        referralType: filterReferralType,
        loyaltyType: filterLoyaltyType,
        purchased: filterPurchased,
        role: filterRole,
        dateRange: filterDateRange,
        sortBy,
      }
      Object.keys(params).forEach((k) => {
        if (params[k] === "" || params[k] === null || params[k] === undefined) {
          delete params[k]
        }
      })

      const data = await adminAPI.getUsers(params)
      setUsers(data.users || [])
      setPages(data.pages || 1)
      setTotal(data.total || 0)
      setLoading(false)
    } catch (err) {
      setError("Failed to load users. Please try again later.")
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page, searchTerm, filterReferralType, filterLoyaltyType, filterPurchased, filterRole, filterDateRange, sortBy]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Load referral and loyalty types for selection dropdowns
    axios
      .get(`${config.API_URL}/api/referrals/admin/types`, authHeader)
      .then((res) => setReferralTypes(res.data || []))
      .catch((err) => console.error("Could not load referral types:", err))

    axios
      .get(`${config.API_URL}/api/loyalty/admin/types`, authHeader)
      .then((res) => setLoyaltyTypes(res.data || []))
      .catch((err) => console.error("Could not load loyalty types:", err))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openTierModal = (user) => {
    setTierModalTarget(user)
    setSelectedReferralType(user.referralType?._id || user.referralType || "")
    setSelectedLoyaltyType(user.loyaltyType?._id || user.loyaltyType || "")
  }

  const handleSaveTiers = async (e) => {
    e.preventDefault()
    if (!tierModalTarget) return

    try {
      setSavingTiers(true)
      const payload = {
        referralType: selectedReferralType || null,
        loyaltyType: selectedLoyaltyType || null,
      }

      const res = await axios.put(
        `${config.API_URL}/api/admin/users/${tierModalTarget._id}/tier`,
        payload,
        authHeader,
      )

      // Update state locally
      setUsers((prev) =>
        prev.map((u) => (u._id === tierModalTarget._id ? { ...u, ...res.data } : u)),
      )

      setSuccess(`Updated tiers for ${tierModalTarget.name}`)
      setTierModalTarget(null)
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(describeApiError(err, "Failed to update tiers for user"))
    } finally {
      setSavingTiers(false)
    }
  }

  const handleDownloadCsv = async () => {
    try {
      const params = {
        search: searchTerm.trim(),
        referralType: filterReferralType,
        loyaltyType: filterLoyaltyType,
        purchased: filterPurchased,
        role: filterRole,
        dateRange: filterDateRange,
        sortBy,
      }
      Object.keys(params).forEach((k) => {
        if (params[k] === "" || params[k] === null || params[k] === undefined) {
          delete params[k]
        }
      })

      const allUsers = await adminAPI.getUsers(params)
      downloadCsv({
        rows: allUsers,
        columns: [
          { header: "User ID", accessor: (row) => row._id || "" },
          { header: "Name", accessor: (row) => row.name || "N/A" },
          { header: "Email", accessor: (row) => row.email || "N/A" },
          { header: "Referral Tier", accessor: (row) => row.referralType?.name || "Default" },
          { header: "Loyalty Tier", accessor: (row) => row.loyaltyType?.name || "Default" },
          {
            header: "Delivered Purchased Amount (Rs)",
            accessor: (row) => Number(row.deliveredPurchasedAmount || 0).toFixed(2),
          },
          {
            header: "Delivered Orders Count",
            accessor: (row) => row.deliveredOrdersCount || 0,
          },
          { header: "Role", accessor: (row) => (row.isAdmin ? "Admin" : "Customer") },
          {
            header: "Joined Date",
            accessor: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "N/A"),
          },
          { header: "Status", accessor: () => "Active" },
        ],
        filename: "users-management.csv",
      })
    } catch (err) {
      console.error("CSV download error:", err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8 min-w-0">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
            <p className="text-sm text-gray-500">
              Manage accounts, filter customers, view order spend, and assign Referral & Loyalty tiers
            </p>
          </div>
          <button
            onClick={handleDownloadCsv}
            disabled={users.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold shadow-sm transition"
          >
            <Download size={16} />
            Download CSV
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle2 size={16} className="flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 space-y-3">
          {/* Top Row: Search + Summary + Reset */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                className="pl-9 pr-8 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50/50"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("")
                    setPage(1)
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                >
                  <RotateCcw size={13} />
                  Reset Filters
                </button>
              )}
              <div className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600">
                Total Users: <span className="font-bold text-gray-900">{total}</span>
              </div>
            </div>
          </div>

          {/* Filter Dropdowns Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-gray-100">
            {/* Referral Tier */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Referral Tier</label>
              <select
                value={filterReferralType}
                onChange={(e) => {
                  setFilterReferralType(e.target.value)
                  setPage(1)
                }}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Referral Tiers</option>
                <option value="unassigned">Default / None</option>
                {referralTypes.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Loyalty Tier */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Loyalty Tier</label>
              <select
                value={filterLoyaltyType}
                onChange={(e) => {
                  setFilterLoyaltyType(e.target.value)
                  setPage(1)
                }}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Loyalty Tiers</option>
                <option value="unassigned">Default / None</option>
                {loyaltyTypes.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivered Purchases Filter */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Delivered Spend</label>
              <select
                value={filterPurchased}
                onChange={(e) => {
                  setFilterPurchased(e.target.value)
                  setPage(1)
                }}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Purchases</option>
                <option value="has_purchases">Has Delivered Orders</option>
                <option value="no_purchases">Zero Delivered Orders</option>
              </select>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">User Role</label>
              <select
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value)
                  setPage(1)
                }}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Customers (Default)</option>
                <option value="all">All Users</option>
                <option value="admin">Admins Only</option>
              </select>
            </div>

            {/* Registration Date */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Joined Date</label>
              <select
                value={filterDateRange}
                onChange={(e) => {
                  setFilterDateRange(e.target.value)
                  setPage(1)
                }}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="year">This Year</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value)
                  setPage(1)
                }}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="purchases_high">Delivered Spend: High → Low</option>
                <option value="purchases_low">Delivered Spend: Low → High</option>
                <option value="name_asc">Name: A → Z</option>
                <option value="name_desc">Name: Z → A</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <tr>
                    <th className="px-5 py-3.5 text-left">User</th>
                    <th className="px-5 py-3.5 text-left">Email</th>
                    <th className="px-5 py-3.5 text-left">Referral Tier</th>
                    <th className="px-5 py-3.5 text-left">Loyalty Tier</th>
                    <th className="px-5 py-3.5 text-left">Delivered Purchases</th>
                    <th className="px-5 py-3.5 text-left">Role</th>
                    <th className="px-5 py-3.5 text-left">Joined Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {users.length > 0 ? (
                    users.map((user) => (
                      <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-9 w-9 flex-shrink-0">
                              <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                {user.name ? user.name.slice(0, 2).toUpperCase() : <User size={16} />}
                              </div>
                            </div>
                            <div className="ml-3">
                              <div className="font-semibold text-gray-900">{user.name}</div>
                              <div className="text-xs text-gray-400">ID: {user._id.slice(-6)}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center text-gray-700">
                            <Mail className="h-3.5 w-3.5 text-gray-400 mr-1.5" />
                            <span>{user.email}</span>
                          </div>
                        </td>

                        {/* Referral Tier Badge */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {user.referralType ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 border border-gray-200">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: user.referralType.color || "#3b82f6" }}
                              />
                              <span className="text-gray-900">{user.referralType.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Default</span>
                          )}
                        </td>

                        {/* Loyalty Tier Badge */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {user.loyaltyType ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 border border-gray-200">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: user.loyaltyType.color || "#10b981" }}
                              />
                              <span className="text-gray-900">{user.loyaltyType.name}</span>
                              {user.loyaltyType.earnMultiplier > 1 && (
                                <span className="text-[10px] text-green-700 font-bold bg-green-50 px-1 rounded">
                                  {user.loyaltyType.earnMultiplier}x
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Default</span>
                          )}
                        </td>

                        {/* Delivered Purchased Amount (only Delivered orders counted) */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="font-bold text-gray-900">
                            Rs {Number(user.deliveredPurchasedAmount || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {user.deliveredOrdersCount
                              ? `${user.deliveredOrdersCount} delivered ${user.deliveredOrdersCount === 1 ? "order" : "orders"}`
                              : "0 delivered orders"}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${
                              user.isAdmin ? "bg-purple-100 text-purple-800" : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            {user.isAdmin ? "Admin" : "Customer"}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap text-right">
                          <button
                            onClick={() => openTierModal(user)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition inline-flex items-center gap-1.5"
                            title="Assign Referral or Loyalty Tier"
                          >
                            <Edit3 size={13} />
                            Assign Tiers
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pages > 1 && (
              <div className="flex justify-center items-center gap-2 py-4 bg-gray-50 border-t border-gray-200">
                <button
                  className="px-3 py-1 border rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <span className="text-xs text-gray-600 font-medium px-2">
                  Page {page} of {pages}
                </span>
                <button
                  className="px-3 py-1 border rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
                  onClick={() => setPage(page + 1)}
                  disabled={page === pages}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign Tiers Modal */}
      {tierModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <User size={18} className="text-blue-600" />
                  Assign Tiers
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {tierModalTarget.name} ({tierModalTarget.email})
                </p>
              </div>
              <button
                onClick={() => setTierModalTarget(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTiers} className="p-6 space-y-5">
              {/* Referral Tier Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <Gift size={14} className="text-blue-600" />
                  Referral Type / Tier
                </label>
                <select
                  value={selectedReferralType}
                  onChange={(e) => setSelectedReferralType(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                >
                  <option value="">None (Use Default Referral Programme)</option>
                  {referralTypes.map((type) => (
                    <option key={type._id} value={type._id}>
                      {type.name} — Friend:{" "}
                      {type.refereeDiscountType === "fixed"
                        ? `${type.refereeDiscountValue} Rs`
                        : `${type.refereeDiscountValue}%`}{" "}
                      | Referrer:{" "}
                      {type.referrerDiscountType === "fixed"
                        ? `${type.referrerDiscountValue} Rs`
                        : `${type.referrerDiscountValue}%`}
                      {type.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Determines rewards when this user invites friends, or when their invites qualify.
                </p>
              </div>

              {/* Loyalty Tier Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5 flex items-center gap-1.5">
                  <Award size={14} className="text-emerald-600" />
                  Loyalty Point Type / Tier
                </label>
                <select
                  value={selectedLoyaltyType}
                  onChange={(e) => setSelectedLoyaltyType(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:outline-none bg-white"
                >
                  <option value="">None (Use Default Loyalty Programme)</option>
                  {loyaltyTypes.map((type) => (
                    <option key={type._id} value={type._id}>
                      {type.name} — {type.earnMultiplier}x Points Multiplier
                      {type.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Determines point multiplier when this user places orders.
                </p>
              </div>

              {/* Selected Preview Box */}
              {(selectedReferralType || selectedLoyaltyType) && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1">
                  <div className="font-bold text-gray-700 uppercase text-[10px] mb-1">Selected Perks:</div>
                  {selectedReferralType && (
                    <div className="text-blue-900 flex items-center gap-1.5">
                      <Gift size={13} className="text-blue-600" />
                      <span>
                        Referral:{" "}
                        <strong className="font-semibold">
                          {referralTypes.find((t) => t._id === selectedReferralType)?.name}
                        </strong>
                      </span>
                    </div>
                  )}
                  {selectedLoyaltyType && (
                    <div className="text-emerald-900 flex items-center gap-1.5">
                      <Zap size={13} className="text-emerald-600" />
                      <span>
                        Loyalty:{" "}
                        <strong className="font-semibold">
                          {loyaltyTypes.find((t) => t._id === selectedLoyaltyType)?.name} (
                          {loyaltyTypes.find((t) => t._id === selectedLoyaltyType)?.earnMultiplier}x)
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setTierModalTarget(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTiers}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingTiers ? "Saving..." : "Save Tiers"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsers
