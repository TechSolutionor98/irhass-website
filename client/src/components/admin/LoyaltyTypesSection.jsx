"use client"

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { Award, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, X, Sparkles, TrendingUp, Zap } from "lucide-react"
import config from "../../config/config"
import { describeApiError } from "../../utils/apiError"

const PRESET_COLORS = [
  { name: "Silver", color: "#94a3b8" },
  { name: "Gold", color: "#eab308" },
  { name: "Platinum", color: "#a855f7" },
  { name: "Diamond", color: "#38bdf8" },
  { name: "Emerald", color: "#10b981" },
  { name: "Bronze", color: "#cd7f32" },
  { name: "Ruby", color: "#ef4444" },
  { name: "Indigo", color: "#6366f1" },
]

const DEFAULT_FORM = {
  name: "",
  description: "",
  color: "#10b981",
  badgeText: "",
  earnMultiplier: 1.0,
  customEarnPointsPerAed: "",
  redeemPointsPerAed: "",
  minPointsToRedeem: "",
  maxRedeemPercentOfOrder: "",
  isDefault: false,
  isActive: true,
}

const LoyaltyTypesSection = ({ standalone = false }) => {
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
      const { data } = await axios.get(`${config.API_URL}/api/loyalty/admin/types`, authHeader)
      setTypes(data || [])
      setError("")
    } catch (err) {
      setError(describeApiError(err, "Failed to load loyalty point types"))
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
      color: type.color || "#10b981",
      badgeText: type.badgeText || "",
      earnMultiplier: type.earnMultiplier ?? 1.0,
      customEarnPointsPerAed: type.customEarnPointsPerAed ?? "",
      redeemPointsPerAed: type.redeemPointsPerAed ?? "",
      minPointsToRedeem: type.minPointsToRedeem ?? "",
      maxRedeemPercentOfOrder: type.maxRedeemPercentOfOrder ?? "",
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

      const payload = {
        ...form,
        earnMultiplier: Number(form.earnMultiplier) || 1.0,
        customEarnPointsPerAed: form.customEarnPointsPerAed === "" ? null : Number(form.customEarnPointsPerAed),
        redeemPointsPerAed: form.redeemPointsPerAed === "" ? null : Number(form.redeemPointsPerAed),
        minPointsToRedeem: form.minPointsToRedeem === "" ? null : Number(form.minPointsToRedeem),
        maxRedeemPercentOfOrder: form.maxRedeemPercentOfOrder === "" ? null : Number(form.maxRedeemPercentOfOrder),
      }

      if (editingType) {
        await axios.put(`${config.API_URL}/api/loyalty/admin/types/${editingType._id}`, payload, authHeader)
        setSuccess(`Updated "${form.name}" successfully`)
      } else {
        await axios.post(`${config.API_URL}/api/loyalty/admin/types`, payload, authHeader)
        setSuccess(`Created "${form.name}" successfully`)
      }

      setModalOpen(false)
      loadTypes()
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(describeApiError(err, "Failed to save loyalty point type"))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const res = await axios.delete(
        `${config.API_URL}/api/loyalty/admin/types/${deleteTarget._id}`,
        authHeader,
      )
      setSuccess(
        `Deleted "${deleteTarget.name}"${res.data?.unlinkedUsers ? ` (unlinked from ${res.data.unlinkedUsers} users)` : ""}`,
      )
      setDeleteTarget(null)
      loadTypes()
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(describeApiError(err, "Failed to delete loyalty type"))
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
            <h2 className="text-base font-semibold text-gray-900">Loyalty Types & Tiers</h2>
            <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
              {types.length} {types.length === 1 ? "Tier" : "Tiers"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Create loyalty tiers (e.g. Silver, Gold, Platinum). Assign these tiers to users in the Users section to give them custom earn multipliers (e.g. 1.5x, 2.0x points) and redemption perks.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          <Plus size={14} />
          Create Loyalty Type
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
          <h4 className="text-sm font-bold text-gray-800">No Loyalty Types Yet</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto mb-3 mt-1">
            Create tiers like Silver (1.0x), Gold (1.5x), Platinum (2.0x) to reward your VIP customers with accelerated point earning.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"
          >
            Create First Loyalty Type
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 text-left uppercase text-gray-500 font-semibold">
              <tr>
                <th className="px-4 py-2.5">Tier / Name</th>
                <th className="px-4 py-2.5">Earn Multiplier</th>
                <th className="px-4 py-2.5">Redemption Override</th>
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
                        style={{ backgroundColor: type.color || "#10b981" }}
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
                    <div className="inline-flex items-center gap-1 font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      <Zap size={12} className="text-green-600" />
                      <span>{type.earnMultiplier || 1.0}x Points</span>
                    </div>
                    {type.customEarnPointsPerAed ? (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Fixed: {type.customEarnPointsPerAed} pts / Rs
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-400 mt-0.5">Applies to base rate</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {type.redeemPointsPerAed || type.minPointsToRedeem || type.maxRedeemPercentOfOrder ? (
                      <div className="space-y-0.5 text-[10px]">
                        {type.redeemPointsPerAed && (
                          <div>{type.redeemPointsPerAed} pts = 1 Rs</div>
                        )}
                        {type.minPointsToRedeem && (
                          <div>Min redeem: {type.minPointsToRedeem} pts</div>
                        )}
                        {type.maxRedeemPercentOfOrder && (
                          <div>Max {type.maxRedeemPercentOfOrder}% of order</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Uses global rules</span>
                    )}
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
                        className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto my-8">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full shadow-sm"
                  style={{ backgroundColor: form.color || "#10b981" }}
                />
                <h2 className="text-lg font-bold text-gray-900">
                  {editingType ? `Edit Loyalty Tier: ${editingType.name}` : "New Loyalty Tier"}
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
                    Tier / Type Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Silver, Gold, Platinum, VIP"
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
                    placeholder="Short description of this tier"
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

              {/* Earn Multiplier */}
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-3">
                <h3 className="font-bold text-emerald-950 text-xs flex items-center gap-1.5 uppercase">
                  <TrendingUp size={14} className="text-emerald-600" />
                  Earning Booster & Multiplier
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Point Multiplier (e.g. 1.0, 1.5, 2.0)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={form.earnMultiplier}
                      onChange={(e) => setForm({ ...form, earnMultiplier: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Multiplies base points earned on purchases (e.g. 2.0 = Double points)
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Custom Earn Rate (Optional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Leave blank to use multiplier"
                      value={form.customEarnPointsPerAed}
                      onChange={(e) => setForm({ ...form, customEarnPointsPerAed: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Direct points per 1 Rs (overrides the multiplier if specified)
                    </p>
                  </div>
                </div>
              </div>

              {/* Redemption Perks (Optional overrides) */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <h3 className="font-bold text-gray-900 text-xs flex items-center gap-1.5 uppercase">
                  <Award size={14} className="text-green-600" />
                  Redemption Perks (Optional Overrides)
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Points per 1 Rs
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Default"
                      value={form.redeemPointsPerAed}
                      onChange={(e) => setForm({ ...form, redeemPointsPerAed: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Min Pts to Redeem
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="Default"
                      value={form.minPointsToRedeem}
                      onChange={(e) => setForm({ ...form, minPointsToRedeem: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Max Order %
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="Default"
                      value={form.maxRedeemPercentOfOrder}
                      onChange={(e) => setForm({ ...form, maxRedeemPercentOfOrder: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                    />
                  </div>
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
            <h3 className="text-base font-bold text-gray-900">Delete Loyalty Type?</h3>
            <p className="text-xs text-gray-600">
              Are you sure you want to delete <span className="font-bold text-gray-900">"{deleteTarget.name}"</span>? Any users currently assigned to this tier will safely fall back to the default tier or global rules.
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

export default LoyaltyTypesSection
