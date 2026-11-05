"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { Gift, Save, Users, CheckCircle2, Clock, Wallet } from "lucide-react"
import config from "../../config/config"
import { describeApiError } from "../../utils/apiError"

import ReferralTypesSection from "../../components/admin/ReferralTypesSection"

// Order statuses a referral can be tied to. Kept in step with the enum on the order
// model -- an admin choosing a status that does not exist would silently stop the
// programme paying out.
const ORDER_STATUSES = [
  "New",
  "Processing",
  "Confirmed",
  "Ready for Shipment",
  "Shipped",
  "On the Way",
  "Out for Delivery",
  "Delivered",
  "On Hold",
  "Cancelled",
  "Returned",
  "Deleted",
]

// Every value on this screen is expressed against AED, the currency product prices are
// stored in. Other countries derive from it through their exchange rate, so one setting
// covers the whole storefront.
const AdminReferralSettings = () => {
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
        axios.get(`${config.API_URL}/api/referrals/admin/settings`, authHeader),
        axios.get(`${config.API_URL}/api/referrals/admin/stats`, authHeader).catch(() => ({ data: null })),
      ])
      setForm(settingsRes.data)
      setStats(statsRes.data)
      setError("")
    } catch (err) {
      setError(describeApiError(err, "Failed to load referral settings"))
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
      const { data } = await axios.put(`${config.API_URL}/api/referrals/admin/settings`, form, authHeader)
      setForm(data)
      setSuccess("Referral settings saved")
      setTimeout(() => setSuccess(""), 4000)
    } catch (err) {
      setError(describeApiError(err, "Failed to save referral settings"))
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
          {error || "Referral settings could not be loaded."}
          <button onClick={load} className="ml-3 underline font-medium">
            Try again
          </button>
        </div>
      </div>
    )
  }

  // The two offers, spelled out the way the admin thinks about them.
  const describe = (type, value, cap) => {
    const headline = type === "fixed" ? `Rs ${value || 0}` : `${value || 0}%`
    return cap > 0 && type !== "fixed" ? `${headline} off, capped at Rs ${cap}` : `${headline} off`
  }
  const refereeExample = `Friend signs up → ${describe(form.refereeDiscountType, form.refereeDiscountValue, form.refereeMaxDiscountAed)}`
  const referrerExample = `Their order is ${form.qualifyOnOrderStatus || "Delivered"} → inviter gets ${describe(form.referrerDiscountType, form.referrerDiscountValue, form.referrerMaxDiscountAed)}`

  return (
    <div className="ml-64 p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Gift className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Referral Programme</h1>
            <p className="text-sm text-gray-500">What each side gets, and when an invite counts</p>
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

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">{success}</div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Users} label="Invites total" value={stats.referrals?.total?.toLocaleString()} />
          <StatCard icon={Clock} label="Waiting to count" value={stats.referrals?.pending?.toLocaleString()} tone="amber" />
          <StatCard icon={CheckCircle2} label="Counted" value={stats.referrals?.qualified?.toLocaleString()} />
          <StatCard
            icon={Wallet}
            label="Discount given"
            value={`Rs ${Number(stats.discountGiven?.totalAed || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            tone="amber"
          />
        </div>
      )}

      <div className="space-y-5">
        <Section title="Programme">
          <Toggle
            label="Referral programme is live"
            hint="While this is off, no invite links are shown, no new invites are recorded and no reward can be spent."
            checked={Boolean(form.isEnabled)}
            onChange={(v) => setField("isEnabled", v)}
          />
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Programme name" hint="Shown throughout the storefront">
              <input
                type="text"
                value={form.programmeName || ""}
                onChange={(e) => setField("programmeName", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Programme name (Arabic)">
              <input
                type="text"
                dir="rtl"
                value={form.programmeNameAr || ""}
                onChange={(e) => setField("programmeNameAr", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        {/* Referral Types / Tiers Management */}
        <ReferralTypesSection />

        <Section title="Base Invited Friend's Discount" subtitle={`${refereeExample} (Used only when the inviter has no tier and no default tier exists)`}>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Discount type">
              <select
                value={form.refereeDiscountType || "percentage"}
                onChange={(e) => setField("refereeDiscountType", e.target.value)}
                className={inputClass}
              >
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off (Rs)</option>
              </select>
            </Field>
            <Field
              label={form.refereeDiscountType === "fixed" ? "Amount off (Rs)" : "Percentage off"}
              hint="Set to 0 to give the friend nothing"
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.refereeDiscountValue ?? 0}
                onChange={(e) => setField("refereeDiscountValue", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Maximum discount (Rs)" hint="0 = no cap. Only applies to a percentage.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.refereeMaxDiscountAed ?? 0}
                onChange={(e) => setField("refereeMaxDiscountAed", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Minimum order to use it (Rs)" hint="0 = any order">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.refereeMinOrderAed ?? 0}
                onChange={(e) => setField("refereeMinOrderAed", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Expires after (days)" hint="0 = never expires">
              <input
                type="number"
                min="0"
                step="1"
                value={form.refereeExpiryDays ?? 0}
                onChange={(e) => setField("refereeExpiryDays", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
          <Toggle
            label="First order only"
            hint="A welcome discount usually only makes sense on the friend's very first order. Turn this off to let them save it for later."
            checked={Boolean(form.refereeFirstOrderOnly)}
            onChange={(v) => setField("refereeFirstOrderOnly", v)}
          />
        </Section>

        <Section title="The inviter's reward" subtitle={referrerExample}>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Discount type">
              <select
                value={form.referrerDiscountType || "percentage"}
                onChange={(e) => setField("referrerDiscountType", e.target.value)}
                className={inputClass}
              >
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off (Rs)</option>
              </select>
            </Field>
            <Field
              label={form.referrerDiscountType === "fixed" ? "Amount off (Rs)" : "Percentage off"}
              hint="Set to 0 to give the inviter nothing"
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.referrerDiscountValue ?? 0}
                onChange={(e) => setField("referrerDiscountValue", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Maximum discount (Rs)" hint="0 = no cap. Only applies to a percentage.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.referrerMaxDiscountAed ?? 0}
                onChange={(e) => setField("referrerMaxDiscountAed", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Minimum order to use it (Rs)" hint="0 = any order">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.referrerMinOrderAed ?? 0}
                onChange={(e) => setField("referrerMinOrderAed", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Expires after (days)" hint="0 = never expires">
              <input
                type="number"
                min="0"
                step="1"
                value={form.referrerExpiryDays ?? 0}
                onChange={(e) => setField("referrerExpiryDays", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="When an invite counts">
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Count the invite when the friend's order is"
              hint="Nothing is paid to the inviter before this. Delivered is the safe choice: a cancelled order never pays out."
            >
              <select
                value={form.qualifyOnOrderStatus || "Delivered"}
                onChange={(e) => setField("qualifyOnOrderStatus", e.target.value)}
                className={inputClass}
              >
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Minimum order value to count (Rs)"
              hint="0 = any order. A smaller order leaves the invite waiting; a later, larger one can still count it."
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.qualifyMinOrderAed ?? 0}
                onChange={(e) => setField("qualifyMinOrderAed", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
          <Field
            label="Undo the invite when the order becomes"
            hint="Comma separated. An unspent inviter reward is withdrawn and the invite goes back to waiting."
          >
            <input
              type="text"
              value={(form.cancelOnOrderStatuses || []).join(", ")}
              onChange={(e) =>
                setField(
                  "cancelOnOrderStatuses",
                  e.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                )
              }
              className={inputClass}
            />
          </Field>
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Maximum rewarded invites per customer"
              hint="0 = unlimited. Past the limit invites still show on their list, they just stop paying out."
            >
              <input
                type="number"
                min="0"
                step="1"
                value={form.maxQualifiedReferralsPerUser ?? 0}
                onChange={(e) => setField("maxQualifiedReferralsPerUser", Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
          <Toggle
            label="Only count invites from verified email addresses"
            hint="Stops one person farming rewards with throwaway accounts they never confirm."
            checked={Boolean(form.requireEmailVerified)}
            onChange={(v) => setField("requireEmailVerified", v)}
          />
        </Section>

        <Section title="Storefront">
          <Toggle
            label="Show the programme in the customer's account"
            checked={form.showInProfile !== false}
            onChange={(v) => setField("showInProfile", v)}
          />
          <Field label="Share message" hint="Prefilled when a customer taps Share. {{link}} is replaced with their link.">
            <textarea
              rows={2}
              value={form.shareMessage || ""}
              onChange={(e) => setField("shareMessage", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Programme terms" hint="Shown to customers under their invite link">
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
      {subtitle && <p className="text-sm text-green-700 font-medium mt-0.5">{subtitle}</p>}
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

export default AdminReferralSettings
