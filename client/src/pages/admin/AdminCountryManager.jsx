"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { Globe, RefreshCw, Save, PlusCircle, X, ShieldCheck } from "lucide-react"
import { useToast } from "../../context/ToastContext"
import config from "../../config/config"

// Available preset countries for quick addition
const PRESET_COUNTRIES = [
  {
    code: "EG",
    name: "Egypt",
    nameAr: "مصر",
    currencyCode: "EGP",
    currencySymbol: "EGP",
    currencySymbolAr: "ج.م",
    flagSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="100" fill="#ce1126"/><rect y="100" width="600" height="100" fill="#ffffff"/><rect y="200" width="600" height="100" fill="#000000"/><circle cx="300" cy="150" r="30" fill="#c09300"/></svg>`,
    manualExchangeRate: 13.0,
  },
  {
    code: "JO",
    name: "Jordan",
    nameAr: "الأردن",
    currencyCode: "JOD",
    currencySymbol: "JOD",
    currencySymbolAr: "د.أ",
    flagSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="100" fill="#007a3d"/><rect y="100" width="600" height="100" fill="#ffffff"/><rect y="200" width="600" height="100" fill="#000000"/><polygon points="0,0 200,150 0,300" fill="#ce1126"/></svg>`,
    manualExchangeRate: 0.193,
  },
  {
    code: "LB",
    name: "Lebanon",
    nameAr: "لبنان",
    currencyCode: "LBP",
    currencySymbol: "LBP",
    currencySymbolAr: "ل.ل",
    flagSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="75" fill="#ed1c24"/><rect y="75" width="600" height="150" fill="#ffffff"/><rect y="225" width="600" height="75" fill="#ed1c24"/><polygon points="300,90 260,180 340,180" fill="#00a651"/></svg>`,
    manualExchangeRate: 24350.0,
  },
  {
    code: "IQ",
    name: "Iraq",
    nameAr: "العراق",
    currencyCode: "IQD",
    currencySymbol: "IQD",
    currencySymbolAr: "د.ع",
    flagSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="100" fill="#ce1126"/><rect y="100" width="600" height="100" fill="#ffffff"/><rect y="200" width="600" height="100" fill="#000000"/><text x="300" y="170" font-family="sans-serif" font-weight="bold" font-size="40" fill="#007a3d" text-anchor="middle">الله أكبر</text></svg>`,
    manualExchangeRate: 356.5,
  },
  {
    code: "TR",
    name: "Turkey",
    nameAr: "تركيا",
    currencyCode: "TRY",
    currencySymbol: "₺",
    currencySymbolAr: "₺",
    flagSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="300" fill="#e30a17"/><circle cx="260" cy="150" r="75" fill="#ffffff"/><circle cx="280" cy="150" r="60" fill="#e30a17"/></svg>`,
    manualExchangeRate: 9.25,
  },
  {
    code: "GB",
    name: "United Kingdom",
    nameAr: "المملكة المتحدة",
    currencyCode: "GBP",
    currencySymbol: "£",
    currencySymbolAr: "£",
    flagSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="300" fill="#012169"/><path d="M0,0 L600,300 M600,0 L0,300" stroke="#fff" stroke-width="60"/><path d="M0,0 L600,300 M600,0 L0,300" stroke="#C8102E" stroke-width="20"/><path d="M300,0 V300 M0,150 H600" stroke="#fff" stroke-width="100"/><path d="M300,0 V300 M0,150 H600" stroke="#C8102E" stroke-width="60"/></svg>`,
    manualExchangeRate: 0.215,
  },
  {
    code: "US",
    name: "United States",
    nameAr: "الولايات المتحدة",
    currencyCode: "USD",
    currencySymbol: "$",
    currencySymbolAr: "$",
    flagSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="300" fill="#b22234"/><rect y="23" width="600" height="23" fill="#fff"/><rect y="69" width="600" height="23" fill="#fff"/><rect y="115" width="600" height="23" fill="#fff"/><rect y="161" width="600" height="23" fill="#fff"/><rect y="207" width="600" height="23" fill="#fff"/><rect y="253" width="600" height="23" fill="#fff"/><rect width="240" height="161" fill="#3c3b6e"/></svg>`,
    manualExchangeRate: 0.272,
  },
  {
    code: "IN",
    name: "India",
    nameAr: "الهند",
    currencyCode: "INR",
    currencySymbol: "₹",
    currencySymbolAr: "₹",
    flagSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="100" fill="#ff9933"/><rect y="100" width="600" height="100" fill="#ffffff"/><rect y="200" width="600" height="100" fill="#128807"/><circle cx="300" cy="150" r="35" fill="none" stroke="#000080" stroke-width="6"/></svg>`,
    manualExchangeRate: 22.85,
  },
  {
    code: "PK",
    name: "Pakistan",
    nameAr: "باكستان",
    currencyCode: "PKR",
    currencySymbol: "PKR",
    currencySymbolAr: "Rs",
    flagSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><rect width="600" height="300" fill="#01411c"/><rect width="150" height="300" fill="#ffffff"/><circle cx="375" cy="150" r="70" fill="#ffffff"/><circle cx="395" cy="135" r="60" fill="#01411c"/></svg>`,
    manualExchangeRate: 75.8,
  },
]

export default function AdminCountryManager() {
  const { showToast } = useToast()
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState(null)

  // Add country form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [addingCountry, setAddingCountry] = useState(false)
  const [selectedPresetCode, setSelectedPresetCode] = useState("")
  const [newCountryData, setNewCountryData] = useState({
    code: "",
    name: "",
    nameAr: "",
    currencyCode: "",
    currencySymbol: "",
    currencySymbolAr: "",
    manualExchangeRate: 1.0,
    useManualRate: false,
    flagSvg: "",
  })

  const getAuthHeaders = () => {
    const token = localStorage.getItem("adminToken")
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  }

  const fetchCountries = async () => {
    try {
      setLoading(true)
      const res = await axios.get(`${config.API_URL}/api/countries/admin`, {
        headers: getAuthHeaders(),
      })
      if (Array.isArray(res.data)) {
        setCountries(res.data)
      }
    } catch (err) {
      console.error("Error fetching country list:", err)
      showToast(err.response?.data?.message || "Failed to fetch country list", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCountries()
  }, [])

  // Filter out countries that are ALREADY ADDED in MongoDB
  const unaddedPresets = PRESET_COUNTRIES.filter(
    (preset) => !countries.some((c) => c.code.toUpperCase() === preset.code.toUpperCase()),
  )

  const handleSelectPreset = (code) => {
    setSelectedPresetCode(code)
    if (!code) {
      setNewCountryData({
        code: "",
        name: "",
        nameAr: "",
        currencyCode: "",
        currencySymbol: "",
        currencySymbolAr: "",
        manualExchangeRate: 1.0,
        useManualRate: false,
        flagSvg: "",
      })
      return
    }

    const preset = PRESET_COUNTRIES.find((p) => p.code === code)
    if (preset) {
      setNewCountryData({
        code: preset.code,
        name: preset.name,
        nameAr: preset.nameAr,
        currencyCode: preset.currencyCode,
        currencySymbol: preset.currencySymbol,
        currencySymbolAr: preset.currencySymbolAr,
        manualExchangeRate: preset.manualExchangeRate || 1.0,
        useManualRate: false,
        flagSvg: preset.flagSvg || "",
      })
    }
  }

  const handleAddCountrySubmit = async (e) => {
    e.preventDefault()
    if (!newCountryData.code || !newCountryData.name) {
      showToast("Country code and name are required", "error")
      return
    }

    try {
      setAddingCountry(true)
      const res = await axios.post(
        `${config.API_URL}/api/countries/admin`,
        newCountryData,
        { headers: getAuthHeaders() },
      )

      showToast(`Added ${res.data.name} successfully!`, "success")
      setCountries((prev) => [...prev, res.data])
      setShowAddForm(false)
      setSelectedPresetCode("")
      setNewCountryData({
        code: "",
        name: "",
        nameAr: "",
        currencyCode: "",
        currencySymbol: "",
        currencySymbolAr: "",
        manualExchangeRate: 1.0,
        useManualRate: false,
        flagSvg: "",
      })
    } catch (err) {
      console.error("Error adding new country:", err)
      showToast(err.response?.data?.message || "Failed to add new country", "error")
    } finally {
      setAddingCountry(false)
    }
  }

  const handleFieldChange = (id, field, value) => {
    setCountries((prev) =>
      prev.map((c) => (c._id === id ? { ...c, [field]: value } : c)),
    )
  }

  const handleSaveCountry = async (country) => {
    try {
      setSavingId(country._id)
      const payload = {
        isActive: country.isActive,
        useManualRate: country.useManualRate,
        manualExchangeRate: Number(country.manualExchangeRate) || 0,
        currencySymbol: country.currencySymbol,
        currencySymbolAr: country.currencySymbolAr,
        sortOrder: Number(country.sortOrder) || 0,
      }

      const res = await axios.put(
        `${config.API_URL}/api/countries/admin/${country._id}`,
        payload,
        { headers: getAuthHeaders() },
      )

      showToast(`Updated ${country.name} settings successfully!`, "success")
      setCountries((prev) => prev.map((c) => (c._id === country._id ? res.data : c)))
    } catch (err) {
      console.error("Error saving country settings:", err)
      showToast(err.response?.data?.message || `Failed to update ${country.name}`, "error")
    } finally {
      setSavingId(null)
    }
  }

  const handleRefreshLiveRates = async () => {
    try {
      setRefreshing(true)
      const res = await axios.post(
        `${config.API_URL}/api/countries/admin/refresh-rates`,
        {},
        { headers: getAuthHeaders() },
      )
      if (Array.isArray(res.data?.countries)) {
        setCountries(res.data.countries)
      }
      showToast("Live Google conversion rates refreshed successfully!", "success")
    } catch (err) {
      console.error("Error refreshing rates:", err)
      showToast(err.response?.data?.message || "Failed to refresh exchange rates", "error")
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Globe className="text-emerald-600 w-8 h-8" />
              GCC Countries & Currency Management
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Enable or disable countries and configure manual vs live Google currency conversion rates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              {showAddForm ? "Cancel Add" : "Add Country"}
            </button>

            <button
              onClick={handleRefreshLiveRates}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Fetching Rates..." : "Refresh Google Live Rates"}
            </button>
          </div>
        </div>

        {/* Add Country Collapsible Card */}
        {showAddForm && (
          <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-6 mb-6 transition-all shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                Add New Country
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCountrySubmit} className="space-y-4">
              {/* Preset Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Select Country to Add (Already added countries are hidden)
                </label>
                <select
                  value={selectedPresetCode}
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  className="w-full text-sm font-semibold px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">-- Choose a country to add --</option>
                  {unaddedPresets.map((preset) => (
                    <option key={preset.code} value={preset.code}>
                      {preset.name} ({preset.nameAr}) - Code: {preset.code} | Currency: {preset.currencyCode}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Custom Country...</option>
                </select>
              </div>

              {/* Form Input Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Country Code (e.g. EG, JO)
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={newCountryData.code}
                    onChange={(e) =>
                      setNewCountryData({ ...newCountryData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="EG"
                    required
                    className="w-full text-sm font-mono font-bold px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Country Name (English)
                  </label>
                  <input
                    type="text"
                    value={newCountryData.name}
                    onChange={(e) => setNewCountryData({ ...newCountryData, name: e.target.value })}
                    placeholder="Egypt"
                    required
                    className="w-full text-sm font-bold px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Country Name (Arabic)
                  </label>
                  <input
                    type="text"
                    value={newCountryData.nameAr}
                    onChange={(e) => setNewCountryData({ ...newCountryData, nameAr: e.target.value })}
                    placeholder="مصر"
                    className="w-full text-sm font-arabic font-bold px-3 py-2 border rounded-lg bg-white dir-rtl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Currency Code (e.g. EGP)
                  </label>
                  <input
                    type="text"
                    value={newCountryData.currencyCode}
                    onChange={(e) =>
                      setNewCountryData({ ...newCountryData, currencyCode: e.target.value.toUpperCase() })
                    }
                    placeholder="EGP"
                    className="w-full text-sm font-mono font-bold px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Currency Symbol (English)
                  </label>
                  <input
                    type="text"
                    value={newCountryData.currencySymbol}
                    onChange={(e) =>
                      setNewCountryData({ ...newCountryData, currencySymbol: e.target.value })
                    }
                    placeholder="EGP"
                    className="w-full text-sm font-bold px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Currency Symbol (Arabic)
                  </label>
                  <input
                    type="text"
                    value={newCountryData.currencySymbolAr}
                    onChange={(e) =>
                      setNewCountryData({ ...newCountryData, currencySymbolAr: e.target.value })
                    }
                    placeholder="ج.م"
                    className="w-full text-sm font-arabic font-bold px-3 py-2 border rounded-lg bg-white dir-rtl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Initial Manual Rate (1 Rs =)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newCountryData.manualExchangeRate}
                    onChange={(e) =>
                      setNewCountryData({
                        ...newCountryData,
                        manualExchangeRate: Number(e.target.value) || 1.0,
                      })
                    }
                    placeholder="13.0"
                    className="w-full text-sm font-mono font-bold px-3 py-2 border rounded-lg bg-white"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={addingCountry}
                    className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition disabled:opacity-50 shadow-sm"
                  >
                    {addingCountry ? "Adding..." : "Add Country"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Info Alert Box */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-start gap-3 text-emerald-900 text-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">How Conversion Rates Work:</p>
            <p className="text-emerald-800 text-xs mt-0.5">
              All product base prices are stored in <strong>Rs</strong>. If <strong>Use Manual Rate</strong> is turned ON, the site converts 1 Rs using your custom manual rate. If turned OFF, the system automatically uses live Google conversion rates.
            </p>
          </div>
        </div>

        {/* Countries Table / List */}
        {loading ? (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading country settings...
          </div>
        ) : (
          <div className="space-y-4">
            {countries.map((country) => {
              const isSaving = savingId === country._id
              const effectiveRate = country.useManualRate
                ? country.manualExchangeRate
                : country.liveExchangeRate

              return (
                <div
                  key={country._id}
                  className={`bg-white rounded-xl border transition shadow-sm p-5 ${
                    country.isActive ? "border-gray-200" : "border-amber-200 bg-amber-50/30 opacity-75"
                  }`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Country Name & Flag */}
                    <div className="lg:col-span-3 flex items-center gap-4">
                      <div className="w-14 h-10 rounded-lg overflow-hidden border bg-gray-100 flex items-center justify-center shrink-0 shadow-sm">
                        {country.flagSvg ? (
                          <div
                            className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-cover"
                            dangerouslySetInnerHTML={{ __html: country.flagSvg }}
                          />
                        ) : (
                          <span className="font-bold text-gray-700">{country.code}</span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900 text-lg">{country.name}</h3>
                          {country.isDefault && (
                            <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-emerald-100 text-emerald-800 rounded">
                              Base (Default)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-mono">
                          {country.nameAr} | Code: {country.code}
                        </p>
                      </div>
                    </div>

                    {/* Enable/Disable Toggle */}
                    <div className="lg:col-span-2 flex flex-col justify-center">
                      <label className="text-xs font-semibold text-gray-600 mb-1">Status</label>
                      <button
                        type="button"
                        onClick={() => handleFieldChange(country._id, "isActive", !country.isActive)}
                        className={`inline-flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          country.isActive
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-gray-200 text-gray-600 border border-gray-300"
                        }`}
                      >
                        <span>{country.isActive ? "ACTIVE (ENABLED)" : "DISABLED"}</span>
                        <div
                          className={`w-4 h-4 rounded-full transition ${
                            country.isActive ? "bg-emerald-600" : "bg-gray-400"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Conversion Rate Mode & Manual Input */}
                    <div className="lg:col-span-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">
                          Rate Source
                        </label>
                        <select
                          value={country.useManualRate ? "manual" : "google"}
                          onChange={(e) =>
                            handleFieldChange(country._id, "useManualRate", e.target.value === "manual")
                          }
                          disabled={country.isDefault}
                          className="w-full text-xs font-semibold px-2.5 py-2 border rounded-lg bg-white disabled:bg-gray-100"
                        >
                          <option value="google">Google Live Rate</option>
                          <option value="manual">Manual Conversion</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">
                          Manual Rate (1 Rs =)
                        </label>
                        <input
                          type="number"
                          step="0.0001"
                          value={country.manualExchangeRate}
                          onChange={(e) =>
                            handleFieldChange(country._id, "manualExchangeRate", e.target.value)
                          }
                          disabled={!country.useManualRate || country.isDefault}
                          className="w-full text-xs font-mono font-bold px-2.5 py-2 border rounded-lg bg-white disabled:bg-gray-100"
                        />
                      </div>
                    </div>

                    {/* Live & Effective Summary */}
                    <div className="lg:col-span-2 text-xs">
                      <div className="text-gray-500">
                        Live Rate: <span className="font-mono font-semibold text-gray-700">{country.liveExchangeRate}</span>
                      </div>
                      <div className="text-gray-900 font-bold mt-0.5">
                        Active Rate: <span className="font-mono text-emerald-600">{effectiveRate}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">
                        Preview: Rs 100 = {(100 * effectiveRate).toFixed(2)} {country.currencyCode}
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="lg:col-span-1 flex justify-end">
                      <button
                        onClick={() => handleSaveCountry(country)}
                        disabled={isSaving}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50 shadow-sm"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
