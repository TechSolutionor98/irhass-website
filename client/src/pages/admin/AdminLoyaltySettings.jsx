"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { Award, Save, AlertTriangle, TrendingUp, Users, Wallet, Clock } from "lucide-react"
import config from "../../config/config"
import { describeApiError } from "../../utils/apiError"
import LoyaltyTypesSection from "../../components/admin/LoyaltyTypesSection"

// Every rate on this screen is expressed against AED, the currency product prices are
// stored in. Other countries derive from it through their exchange rate, so one setting
// covers the whole storefront.
const AdminLoyaltySettings = () => {
  const [form, setForm] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
  const authHeader = { headers: { Authorization: `Bearer ${token}` } }

  const load = async () => {
    try {
      setLoading(true)
      const [settingsRes, statsRes] = await Promise.all([
        axios.get(`${config.API_URL}/api/loyalty/admin/settings`, authHeader),
        axios.get(`${config.API_URL}/api/loyalty/admin/stats`, authHeader).catch(() => ({ data: null })),
      ])
      setForm(settingsRes.data)
      setStats(statsRes.data)
      setError("")
    } catch (err) {
      setError(describeApiError(err, "Failed to load loyalty settings"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    try {
      setSaving(true)
      setError("")
      setSuccess("")
      const { data } = await axios.put(`${config.API_URL}/api/loyalty/admin/settings`, form, authHeader)
      setForm(data)
      setSuccess("Loyalty settings saved")
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(describeApiError(err, "Failed to save loyalty settings"))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="ml-64 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="ml-64 p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error || "Loyalty settings could not be loaded."}
          <button onClick={load} className="ml-3 underline font-medium">
            Try again
          </button>
        </div>
      </div>
    )
  }

  const pointsName = form.pointsName || "Points"
  // The two headline rates, spelled out the way the admin thinks about them.
  const earnExample = `Rs 1 spent = ${form.earnPointsPerAed || 0} ${pointsName}`
  const redeemExample = `${form.redeemPointsPerAed || 0} ${pointsName} = Rs 1 off`

  return (
    <div className="ml-64 p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Award className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Loyalty Programme</h1>
            <p className="text-sm text-gray-500">Earning rates, redemption value and payout rules</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">{success}</div>
      )}

      {/* Outstanding points are a liability: what the business owes if everyone spends. */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Wallet} label="Points outstanding" value={stats.outstandingPoints?.toLocaleString()} />
          <StatCard
            icon={AlertTriangle}
            label="Liability if all spent"
            value={`Rs ${Number(stats.outstandingLiabilityAed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            tone="amber"
          />
          <StatCard icon={Clock} label="Pending (undelivered)" value={stats.pendingPoints?.toLocaleString()} />
          <StatCard icon={Users} label="Customers with points" value={stats.customersWithPoints?.toLocaleString()} />
        </div>
      )}

      <div className="space-y-5">
        <Section title="Programme">
          <Toggle
            label="Loyalty programme is live"
            hint="While this is off, no points are shown, earned or redeemable anywhere on the site."
            checked={Boolean(form.isEnabled)}
            onChange={(v) => setField("isEnabled", v)}
          />
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Points name (plural)" hint="Shown throughout the storefront">
              <input
                type="text"
                value={form.pointsName || ""}
                onChange={(e) => setField("pointsName", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Points name (singular)">
              <input
                type="text"
                value={form.pointsNameSingular || ""}
                onChange={(e) => setField("pointsNameSingular", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Points name (Arabic)">
              <input
                type="text"
                dir="rtl"
                value={form.pointsNameAr || ""}
                onChange={(e) => setField("pointsNameAr", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        {/* Loyalty Types / Tiers Management */}
        <LoyaltyTypesSection />

        <Section title="Base Earning Rules" subtitle={`${earnExample} (Default when no tier assigned)`}>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Points per Rs 1 spent" hint="The base rate. Categories and products can multiply it.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.earnPointsPerAed ?? 0}
                onChange={(e) => setField("earnPointsPerAed", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Rounding" hint="Applied to each unit, so the product page number is exact">
              <select
                value={form.earnRounding || "floor"}
                onChange={(e) => setField("earnRounding", e.target.value)}
                className={inputClass}
              >
                <option value="floor">Round down</option>
                <option value="round">Round to nearest</option>
                <option value="ceil">Round up</option>
              </select>
            </Field>
            <Field label="Award points when order is">
              <select
                value={form.awardOnOrderStatus || "Delivered"}
                onChange={(e) => setField("awardOnOrderStatus", e.target.value)}
                className={inputClass}
              >
                {["Delivered", "Confirmed", "Shipped", "Processing"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Toggle
            label="The part of an order paid with points still earns points"
            hint="Leave off so the programme does not slowly refund itself."
            checked={Boolean(form.earnOnRedeemedPortion)}
            onChange={(v) => setField("earnOnRedeemedPortion", v)}
          />
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-3">
            Points are held pending from the moment an order is placed and become spendable only when it reaches
            <strong> {form.awardOnOrderStatus || "Delivered"}</strong>. Cancelled and returned orders never pay out,
            and any points spent on them are refunded automatically.
          </p>
        </Section>

        <Section title="Redemption" subtitle={redeemExample}>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label={`${pointsName} needed for Rs 1 off`} hint="Higher number = each point is worth less">
              <input
                type="number"
                min="1"
                step="1"
                value={form.redeemPointsPerAed ?? 1}
                onChange={(e) => setField("redeemPointsPerAed", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Minimum balance before redeeming" hint="0 allows redeeming any amount">
              <input
                type="number"
                min="0"
                step="1"
                value={form.minPointsToRedeem ?? 0}
                onChange={(e) => setField("minPointsToRedeem", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field
              label="Maximum share of an order points may cover (%)"
              hint="Stops points driving a card payment to zero"
            >
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.maxRedeemPercentOfOrder ?? 0}
                onChange={(e) => setField("maxRedeemPercentOfOrder", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Maximum points per order" hint="0 means no ceiling">
              <input
                type="number"
                min="0"
                step="1"
                value={form.maxPointsPerOrder ?? 0}
                onChange={(e) => setField("maxPointsPerOrder", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Redeem in blocks of" hint="1 allows any amount">
              <input
                type="number"
                min="1"
                step="1"
                value={form.redeemStep ?? 1}
                onChange={(e) => setField("redeemStep", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Points expire after (days)" hint="0 means points never expire">
              <input
                type="number"
                min="0"
                step="1"
                value={form.pointsExpiryDays ?? 0}
                onChange={(e) => setField("pointsExpiryDays", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-3">
            Points only come off the goods total, never delivery or payment fees.
          </p>
        </Section>

        <Section title="Storefront display">
          <Toggle
            label="Show points earned on product pages"
            checked={Boolean(form.showOnProductPage)}
            onChange={(v) => setField("showOnProductPage", v)}
          />
          <Toggle
            label="Show points earned in the cart"
            checked={Boolean(form.showOnCart)}
            onChange={(v) => setField("showOnCart", v)}
          />
          <Field label="Programme terms" hint="Shown to customers on their points page">
            <textarea
              rows={3}
              value={form.programmeTerms || ""}
              onChange={(e) => setField("programmeTerms", e.target.value)}
              className={inputClass}
            />
          </Field>
        </Section>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  )
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"

const Section = ({ title, subtitle, children }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5">
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {subtitle && (
        <p className="text-sm text-green-700 font-medium mt-0.5 inline-flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          {subtitle}
        </p>
      )}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
)

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
)

const Toggle = ({ label, hint, checked, onChange }) => (
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
    />
    <span>
      <span className="block text-sm font-medium text-gray-800">{label}</span>
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
    </span>
  </label>
)

const StatCard = ({ icon: Icon, label, value, tone = "gray" }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-1">
      <Icon className={`h-4 w-4 ${tone === "amber" ? "text-amber-500" : "text-gray-400"}`} />
      {label}
    </div>
    <div className={`text-xl font-bold ${tone === "amber" ? "text-amber-700" : "text-gray-900"}`}>{value ?? "—"}</div>
  </div>
)

export default AdminLoyaltySettings
