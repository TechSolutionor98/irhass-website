import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Link } from "react-router-dom"
import {
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Globe,
  CreditCard,
  Banknote,
  Wallet,
  Landmark,
  ShieldCheck,
  Info,
  RefreshCw,
  Plus,
} from "lucide-react"
import axios from "axios"
import config from "../../config/config"

const PAYMENT_METHODS = [
  { id: "card", name: "Pay By Card", icon: CreditCard, color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "cod", name: "Cash on Delivery", icon: Banknote, color: "bg-green-100 text-green-800 border-green-200" },
  { id: "tamara", name: "Tamara", icon: Landmark, color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "tabby", name: "Tabby", icon: Wallet, color: "bg-teal-100 text-teal-800 border-teal-200" },
]

const ALL_METHOD_IDS = PAYMENT_METHODS.map((m) => m.id)

const sameMethods = (a = [], b = []) => {
  if (a.length !== b.length) return false
  return ALL_METHOD_IDS.every((id) => a.includes(id) === b.includes(id))
}

const getAuthToken = () => localStorage.getItem("adminToken") || localStorage.getItem("token")

const Toggle = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
      checked ? "bg-lime-500" : "bg-gray-300"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
)

export default function CountryPaymentMethods() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resettingId, setResettingId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Countries as stored on the server, plus the working copy being edited.
  const [countries, setCountries] = useState([])
  const [draft, setDraft] = useState({})

  // Holds the country ids seen on the previous load so a refresh can call out
  // anything that was just added in Country Manager.
  const knownCountryIds = useRef(null)

  const fetchConfig = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (quiet) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const { data } = await axios.get(`${config.API_URL}/api/country-payment-methods/config`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })

      const list = Array.isArray(data?.countries) ? data.countries : []

      // Every country in the database shows up here, so anything added in
      // Country Manager appears with all payment methods enabled by default.
      const previousIds = knownCountryIds.current
      const addedCountries = previousIds
        ? list.filter((country) => !previousIds.has(String(country._id)))
        : []
      knownCountryIds.current = new Set(list.map((country) => String(country._id)))

      setCountries(list)
      setDraft(
        list.reduce((acc, country) => {
          acc[country._id] = [...(country.paymentMethods || ALL_METHOD_IDS)]
          return acc
        }, {}),
      )
      setLastSyncedAt(new Date())
      setError(null)

      if (addedCountries.length > 0) {
        setSuccess(
          `${addedCountries.map((c) => c.name).join(", ")} added from Country Manager — every payment method is enabled by default.`,
        )
      }

      return list
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load country payment method settings")
      console.error(err)
      return null
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const toggleMethod = (countryId, methodId) => {
    setSuccess(null)
    setError(null)
    setDraft((prev) => {
      const current = prev[countryId] || []
      const next = current.includes(methodId)
        ? current.filter((id) => id !== methodId)
        : ALL_METHOD_IDS.filter((id) => id === methodId || current.includes(id))
      return { ...prev, [countryId]: next }
    })
  }

  const dirtyCountries = useMemo(
    () => countries.filter((country) => !sameMethods(draft[country._id] || [], country.paymentMethods || [])),
    [countries, draft],
  )

  const emptyCountries = useMemo(
    () => dirtyCountries.filter((country) => (draft[country._id] || []).length === 0),
    [dirtyCountries, draft],
  )

  const restrictedCount = useMemo(
    () => countries.filter((country) => (draft[country._id] || []).length < ALL_METHOD_IDS.length).length,
    [countries, draft],
  )

  // Pull in countries added in another tab when this one comes back into focus.
  // Skipped while there are unsaved toggles so nothing in progress is discarded.
  const hasUnsavedChanges = dirtyCountries.length > 0

  useEffect(() => {
    const syncIfIdle = () => {
      if (document.visibilityState !== "visible") return
      if (hasUnsavedChanges) return
      fetchConfig({ quiet: true })
    }

    window.addEventListener("focus", syncIfIdle)
    document.addEventListener("visibilitychange", syncIfIdle)

    return () => {
      window.removeEventListener("focus", syncIfIdle)
      document.removeEventListener("visibilitychange", syncIfIdle)
    }
  }, [fetchConfig, hasUnsavedChanges])

  const handleRefresh = async () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Refreshing will discard your unsaved changes. Continue?")
    ) {
      return
    }
    setSuccess(null)
    await fetchConfig({ quiet: true })
  }

  const handleSave = async () => {
    if (dirtyCountries.length === 0) return

    if (emptyCountries.length > 0) {
      setError(
        `${emptyCountries
          .map((c) => c.name)
          .join(", ")} would be left with no payment method. Keep at least one enabled, or deactivate the country in Country Manager.`,
      )
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const { data } = await axios.put(
        `${config.API_URL}/api/country-payment-methods`,
        {
          updates: dirtyCountries.map((country) => ({
            countryId: country._id,
            paymentMethods: draft[country._id],
          })),
        },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } },
      )

      setSuccess(data?.message || "Country payment methods updated")
      await fetchConfig({ quiet: true })
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save country payment methods")
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setDraft(
      countries.reduce((acc, country) => {
        acc[country._id] = [...(country.paymentMethods || ALL_METHOD_IDS)]
        return acc
      }, {}),
    )
    setError(null)
    setSuccess(null)
  }

  const handleReset = async (country) => {
    // Resetting refetches from the server, which would wipe edits waiting to be saved.
    if (dirtyCountries.length > 0) {
      setError("Save or discard your unsaved changes before resetting a country.")
      return
    }

    if (
      !window.confirm(
        `Enable every payment method for ${country.name} again? This removes the country rule so checkout falls back to the product level settings.`,
      )
    ) {
      return
    }

    try {
      setResettingId(country._id)
      setError(null)
      setSuccess(null)

      const { data } = await axios.post(
        `${config.API_URL}/api/country-payment-methods/reset`,
        { countryId: country._id },
        { headers: { Authorization: `Bearer ${getAuthToken()}` } },
      )

      setSuccess(data?.message || "Country rule reset")
      await fetchConfig({ quiet: true })
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset country rule")
      console.error(err)
    } finally {
      setResettingId(null)
    }
  }

  if (loading) {
    return (
      <div className="ml-64 p-8 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-lime-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="ml-64 p-8 min-h-screen bg-gray-50 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-4 justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-6 h-6 text-lime-500" />
            Country Payment Methods
          </h1>
          <p className="text-gray-500 mt-1">
            Turn any payment method on or off per country. Disabled methods disappear from checkout and are rejected on
            the server.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Every country from{" "}
            <Link to="/admin/countries" className="text-lime-600 font-semibold hover:underline">
              GCC Countries &amp; Rates
            </Link>{" "}
            appears here automatically, with all methods enabled until you change them.
            {lastSyncedAt && (
              <span className="ml-1">
                Synced {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing || saving}
            className="flex items-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            title="Pull in countries added in Country Manager"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {dirtyCountries.length > 0 && (
            <button
              onClick={handleDiscard}
              disabled={saving}
              className="px-4 py-3 rounded-lg font-semibold text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || dirtyCountries.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-lime-500 text-white rounded-lg font-bold hover:bg-lime-600 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <Save className="w-5 h-5" />
            )}
            {dirtyCountries.length > 0 ? `Save Changes (${dirtyCountries.length})` : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start gap-2 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2 border border-green-200">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-medium">{success}</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Countries</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{countries.length}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">With Restrictions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{restrictedCount}</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Unsaved Changes</p>
          <p className={`text-2xl font-bold mt-1 ${dirtyCountries.length > 0 ? "text-lime-600" : "text-gray-900"}`}>
            {dirtyCountries.length}
          </p>
        </div>
      </div>

      {/* How it combines with product rules */}
      <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold">How this works with Product Payment Method</p>
          <p className="mt-1 text-blue-700">
            A customer only sees a method allowed by <strong>both</strong> the product rule and the country rule. A
            country switch-off always wins, so a method disabled here never appears no matter what the product allows.
          </p>
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-lime-500" />
            Availability By Country
          </h2>
        </div>

        {countries.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-gray-500 font-medium">No countries found.</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              Countries are managed in GCC Countries &amp; Rates. Add one there and it will show up here.
            </p>
            <Link
              to="/admin/countries"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-lime-500 text-white rounded-lg font-semibold text-sm hover:bg-lime-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add a country
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase bg-gray-50/50">
                  <th className="py-3 px-4">Country</th>
                  {PAYMENT_METHODS.map((method) => {
                    const IconComponent = method.icon
                    return (
                      <th key={method.id} className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <IconComponent className="w-4 h-4 text-gray-400" />
                          <span>{method.name}</span>
                        </div>
                      </th>
                    )
                  })}
                  <th className="py-3 px-4">Enabled</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {countries.map((country) => {
                  const current = draft[country._id] || []
                  const isDirty = !sameMethods(current, country.paymentMethods || [])
                  const isEmpty = current.length === 0

                  return (
                    <tr
                      key={country._id}
                      className={`transition-colors ${
                        isEmpty ? "bg-red-50/40" : isDirty ? "bg-lime-50/40" : "hover:bg-gray-50/50"
                      }`}
                    >
                      {/* Country */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-7 rounded overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0">
                            {country.flagSvg ? (
                              <div
                                className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-cover"
                                dangerouslySetInnerHTML={{ __html: country.flagSvg }}
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-gray-700">{country.code}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{country.name}</span>
                              {country.isDefault && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-lime-100 text-lime-700 border border-lime-200">
                                  DEFAULT
                                </span>
                              )}
                              {!country.isActive && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-600">
                                  INACTIVE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              {country.code} &middot; {country.currencyCode}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* One toggle per method */}
                      {PAYMENT_METHODS.map((method) => (
                        <td key={method.id} className="py-3.5 px-4 text-center">
                          <div className="flex justify-center">
                            <Toggle
                              checked={current.includes(method.id)}
                              onChange={() => toggleMethod(country._id, method.id)}
                              label={`${method.name} in ${country.name}`}
                            />
                          </div>
                        </td>
                      ))}

                      {/* Resulting list */}
                      <td className="py-3.5 px-4">
                        {isEmpty ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                            <AlertCircle className="w-3.5 h-3.5" />
                            None enabled
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {PAYMENT_METHODS.filter((m) => current.includes(m.id)).map((method) => (
                              <span
                                key={method.id}
                                className={`px-2 py-0.5 rounded text-xs font-semibold border ${method.color}`}
                              >
                                {method.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {current.length === ALL_METHOD_IDS.length && !country.isConfigured && (
                          <p className="text-[11px] text-gray-400 italic mt-1">No restriction set</p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleReset(country)}
                          disabled={resettingId === country._id || !country.isConfigured}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-gray-600 hover:text-lime-600 hover:bg-lime-50 rounded transition-colors text-xs font-semibold disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-600"
                          title={
                            country.isConfigured
                              ? "Enable every method again"
                              : "This country has no restriction to reset"
                          }
                        >
                          {resettingId === country._id ? (
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-lime-500 border-t-transparent"></div>
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Enable all
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 italic pt-2 border-t border-gray-100">
          * Every country must keep at least one payment method enabled. To stop selling in a country altogether,
          deactivate it in Country Manager.
        </p>
      </div>
    </div>
  )
}
