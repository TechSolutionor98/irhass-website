"use client"

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { Gift, Plus, Edit2, Trash2, CheckCircle2, Shield, AlertCircle, X, Sparkles } from "lucide-react"
import config from "../../config/config"
import { describeApiError } from "../../utils/apiError"

const PRESET_COLORS = [
  { name: "Silver", color: "#94a3b8" },
  { name: "Gold", color: "#eab308" },
  { name: "Platinum", color: "#a855f7" },
  { name: "Bronze", color: "#cd7f32" },
  { name: "Emerald", color: "#10b981" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Indigo", color: "#6366f1" },
  { name: "Rose", color: "#f43f5e" },
]

const DEFAULT_FORM = {
  name: "",
  description: "",
  color: "#94a3b8",
  badgeText: "",
  refereeDiscountType: "percentage",
  refereeDiscountValue: 20,
  refereeMaxDiscountAed: 0,
  refereeMinOrderAed: 0,
  refereeExpiryDays: 30,
  refereeFirstOrderOnly: true,
  referrerDiscountType: "percentage",
  referrerDiscountValue: 10,
  referrerMaxDiscountAed: 0,
  referrerMinOrderAed: 0,
  referrerExpiryDays: 60,
  qualifyMinOrderAed: 0,
  maxQualifiedReferralsPerUser: 0,
  isDefault: false,
  isActive: true,
}

const ReferralTypesSection = ({ standalone = false }) => {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingType, setEditingType] = useState(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
  const authHeader = { headers: { Authorization: `Bearer ${token}` } }

  const loadTypes = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${config.API_URL}/api/referrals/admin/types`, authHeader)
      setTypes(data || [])
      setError("")
    } catch (err) {
      setError(describeApiError(err, "Failed to load referral types"))
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTypes()
  }, [loadTypes])

  const openCreateModal = () => {
    setEditingType(null)
    setForm(DEFAULT_FORM)
    setModalOpen(true)
  }

  const openEditModal = (type) => {
    setEditingType(type)
    setForm({
      name: type.name || "",
      description: type.description || "",
      color: type.color || "#94a3b8",
      badgeText: type.badgeText || "",
      refereeDiscountType: type.refereeDiscountType || "percentage",
      refereeDiscountValue: type.refereeDiscountValue ?? 20,
      refereeMaxDiscountAed: type.refereeMaxDiscountAed ?? 0,
      refereeMinOrderAed: type.refereeMinOrderAed ?? 0,
      refereeExpiryDays: type.refereeExpiryDays ?? 0,
      refereeFirstOrderOnly: type.refereeFirstOrderOnly !== undefined ? type.refereeFirstOrderOnly : true,
      referrerDiscountType: type.referrerDiscountType || "percentage",
      referrerDiscountValue: type.referrerDiscountValue ?? 10,
      referrerMaxDiscountAed: type.referrerMaxDiscountAed ?? 0,
      referrerMinOrderAed: type.referrerMinOrderAed ?? 0,
      referrerExpiryDays: type.referrerExpiryDays ?? 0,
      qualifyMinOrderAed: type.qualifyMinOrderAed ?? 0,
      maxQualifiedReferralsPerUser: type.maxQualifiedReferralsPerUser ?? 0,
      isDefault: Boolean(type.isDefault),
      isActive: type.isActive !== undefined ? type.isActive : true,
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      setError("")
      setSuccess("")

      if (!form.name.trim()) {
        setError("Type name is required")
        setSaving(false)
        return
      }

      if (editingType) {
        await axios.put(`${config.API_URL}/api/referrals/admin/types/${editingType._id}`, form, authHeader)
        setSuccess(`Updated "${form.name}" successfully`)
      } else {
        await axios.post(`${config.API_URL}/api/referrals/admin/types`, form, authHeader)
        setSuccess(`Created "${form.name}" successfully`)
      }

      setModalOpen(false)
      loadTypes()
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(describeApiError(err, "Failed to save referral type"))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await axios.delete(
        `${config.API_URL}/api/referrals/admin/types/${deleteTarget._id}`,
        authHeader,
      )
      setSuccess(
        `Deleted "${deleteTarget.name}"${res.data?.unlinkedUsers ? ` (unlinked from ${res.data.unlinkedUsers} users)` : ""}`,
      )
      setDeleteTarget(null)
      loadTypes()
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(describeApiError(err, "Failed to delete referral type"))
    } finally {
      setDeleting(false)
    }
  }

  const containerClass = standalone
    ? "bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm p-6"
    : "bg-white border border-gray-200 rounded-xl p-5"

  return (
    <div className={containerClass}>
      <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Referral Types & Tiers</h2>
            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
              {types.length} {types.length === 1 ? "Tier" : "Tiers"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Create tiers (e.g. Silver, Gold, Platinum). Assign these tiers to users in the Users section to give them custom friend discounts and inviter rewards.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <Plus size={14} />
          Create Referral Type
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-600"></div>
        </div>
      ) : types.length === 0 ? (
        <div className="rounded-lg p-6 text-center border border-dashed border-gray-300 bg-gray-50/60">
          <div className="inline-flex p-3 rounded-full bg-green-100 text-green-700 mb-2">
            <Sparkles className="h-5 w-5" />
          </div>
          <h4 className="text-sm font-bold text-gray-800">No Referral Types Yet</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto mb-3 mt-1">
            Create your first referral tier (like Silver, Gold, Platinum) to assign custom rewards to specific users.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"
          >
            Create First Referral Type
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 text-left uppercase text-gray-500 font-semibold">
              <tr>
                <th className="px-4 py-2.5">Tier Name</th>
                <th className="px-4 py-2.5">Friend's Welcome Reward</th>
                <th className="px-4 py-2.5">Referrer's Reward</th>
                <th className="px-4 py-2.5">Qualify Min Order</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {types.map((type) => (
                <tr key={type._id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: type.color || "#3b82f6" }}
                      />
                      <div>
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          <span>{type.name}</span>
                          {type.isDefault && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        {type.description && (
                          <p className="text-[11px] text-gray-400 line-clamp-1">{type.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">
                      {type.refereeDiscountType === "fixed"
                        ? `${type.refereeDiscountValue} Rs off`
                        : `${type.refereeDiscountValue}% off`}
                      {type.refereeDiscountType !== "fixed" && type.refereeMaxDiscountAed > 0 && (
                        <span className="text-[10px] font-normal text-gray-500 ml-1">
                          (cap {type.refereeMaxDiscountAed} Rs)
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 flex gap-2">
                      {type.refereeFirstOrderOnly && <span>1st order</span>}
                      {type.refereeExpiryDays > 0 && <span>Exp {type.refereeExpiryDays}d</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">
                      {type.referrerDiscountType === "fixed"
                        ? `${type.referrerDiscountValue} Rs off`
                        : `${type.referrerDiscountValue}% off`}
                      {type.referrerDiscountType !== "fixed" && type.referrerMaxDiscountAed > 0 && (
                        <span className="text-[10px] font-normal text-gray-500 ml-1">
                          (cap {type.referrerMaxDiscountAed} Rs)
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {type.referrerExpiryDays > 0 ? `Exp ${type.referrerExpiryDays}d` : "No expiry"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>
                      {type.qualifyMinOrderAed > 0 ? `${type.qualifyMinOrderAed} Rs` : "Any amount"}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {type.maxQualifiedReferralsPerUser > 0
                        ? `Max ${type.maxQualifiedReferralsPerUser} invites`
                        : "Unlimited invites"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        type.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {type.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(type)}
                        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Edit Tier"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(type)}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete Tier"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto my-8">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full shadow-sm"
                  style={{ backgroundColor: form.color || "#3b82f6" }}
                />
                <h2 className="text-lg font-bold text-gray-900">
                  {editingType ? `Edit Referral Type: ${editingType.name}` : "New Referral Type"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5 text-sm">
              {/* Basic Info */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Type / Tier Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Silver, Gold, Platinum, VIP Partner"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Short description of this tier perk"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Badge Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      className="w-9 h-9 p-0.5 border border-gray-300 rounded-lg cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => setForm({ ...form, color: c.color })}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            form.color === c.color ? "border-black scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c.color }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Badge Label (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GOLD"
                    value={form.badgeText}
                    onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Referee Section */}
              <div className="p-4 bg-green-50/40 rounded-xl border border-green-100 space-y-3">
                <h3 className="font-bold text-green-950 text-xs flex items-center gap-1.5 uppercase">
                  <Gift size={14} className="text-green-600" />
                  Friend's Reward (Granted to invitee at signup)
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Discount Type</label>
                    <select
                      value={form.refereeDiscountType}
                      onChange={(e) => setForm({ ...form, refereeDiscountType: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (Rs)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Discount Value {form.refereeDiscountType === "percentage" ? "(%)" : "(Rs)"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.refereeDiscountValue}
                      onChange={(e) => setForm({ ...form, refereeDiscountValue: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Max Discount (Rs, 0 = no cap)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.refereeMaxDiscountAed}
                      onChange={(e) => setForm({ ...form, refereeMaxDiscountAed: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Minimum Order (Rs)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.refereeMinOrderAed}
                      onChange={(e) => setForm({ ...form, refereeMinOrderAed: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Expiry Days (0 = never)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={form.refereeExpiryDays}
                      onChange={(e) => setForm({ ...form, refereeExpiryDays: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-gray-700 pt-1">
                  <input
                    type="checkbox"
                    checked={form.refereeFirstOrderOnly}
                    onChange={(e) => setForm({ ...form, refereeFirstOrderOnly: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Only valid on friend's very first order
                </label>
              </div>

              {/* Referrer Section */}
              <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-100 space-y-3">
                <h3 className="font-bold text-amber-950 text-xs flex items-center gap-1.5 uppercase">
                  <Shield size={14} className="text-amber-600" />
                  Referrer's Reward (Granted when friend's order qualifies)
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Discount Type</label>
                    <select
                      value={form.referrerDiscountType}
                      onChange={(e) => setForm({ ...form, referrerDiscountType: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (Rs)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Discount Value {form.referrerDiscountType === "percentage" ? "(%)" : "(Rs)"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.referrerDiscountValue}
                      onChange={(e) => setForm({ ...form, referrerDiscountValue: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Max Discount (Rs, 0 = no cap)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.referrerMaxDiscountAed}
                      onChange={(e) => setForm({ ...form, referrerMaxDiscountAed: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Minimum Order (Rs)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.referrerMinOrderAed}
                      onChange={(e) => setForm({ ...form, referrerMinOrderAed: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Expiry Days (0 = never)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={form.referrerExpiryDays}
                      onChange={(e) => setForm({ ...form, referrerExpiryDays: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Qualification Rules */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Friend's Min Order to Qualify (Rs)
                  </label>
                  <input
                    type="number"
                      step="0.01"
                    min="0"
                    placeholder="0 = any order"
                    value={form.qualifyMinOrderAed}
                    onChange={(e) => setForm({ ...form, qualifyMinOrderAed: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Friend's order must be at least this value for referral to pay out
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Max Rewarded Invites Per User
                  </label>
                  <input
                    type="number"
                      step="1"
                    min="0"
                    placeholder="0 = unlimited"
                    value={form.maxQualifiedReferralsPerUser}
                    onChange={(e) =>
                      setForm({ ...form, maxQualifiedReferralsPerUser: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-green-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Cap on how many friends this user can be rewarded for (0 = unlimited)
                  </p>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Default Tier (for users without an assigned tier)
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingType ? "Save Changes" : "Create Tier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-3">
            <h3 className="text-base font-bold text-gray-900">Delete Referral Type?</h3>
            <p className="text-xs text-gray-600">
              Are you sure you want to delete <span className="font-bold text-gray-900">"{deleteTarget.name}"</span>? Any users currently assigned to this type will safely fall back to the default tier.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReferralTypesSection
