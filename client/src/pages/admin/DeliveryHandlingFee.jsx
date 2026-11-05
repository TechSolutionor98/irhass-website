import { useState, useEffect, useMemo } from "react"
import { Save, Plus, Trash2, Edit2, AlertCircle, CheckCircle2, Globe, Info, RotateCcw } from "lucide-react"
import axios from "axios"
import config from "../../config/config"

// "" is the default scope every country inherits until it gets its own rule.
const DEFAULT_SCOPE = ""

const PAYMENT_METHODS = [
  { id: "cod", name: "Cash on Delivery" },
  { id: "card", name: "Pay By Card" },
  { id: "tabby", name: "Tabby" },
  { id: "tamara", name: "Tamara" },
]

export default function DeliveryHandlingFee() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  
  const [selectedMethod, setSelectedMethod] = useState("cod")
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_SCOPE)
  const [countries, setCountries] = useState([])
  // All rows from the API, keyed as "<countryCode>|<paymentMethod>".
  const [chargesData, setChargesData] = useState({})
  const [deleting, setDeleting] = useState(false)
  
  // Current editing state
  const [description, setDescription] = useState("")
  const [charges, setCharges] = useState([])
  const [isActive, setIsActive] = useState(true)
  const [currentId, setCurrentId] = useState(null)

  const scopeKey = (countryCode, method) => `${countryCode || ""}|${method}`

  useEffect(() => {
    fetchCountries()
    fetchCharges()
  }, [])

  useEffect(() => {
    // Populate the form whenever the country scope or payment method changes.
    const data = chargesData[scopeKey(selectedCountry, selectedMethod)]
    if (data) {
      setDescription(data.description || "")
      setCharges(data.charges || [])
      setIsActive(data.isActive !== false)
      setCurrentId(data._id)
    } else {
      setDescription("")
      setCharges([])
      setIsActive(true)
      setCurrentId(null)
    }
  }, [selectedCountry, selectedMethod, chargesData])

  const fetchCountries = async () => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/countries/public`)
      if (Array.isArray(data)) setCountries(data)
    } catch (err) {
      console.error("Failed to load countries", err)
    }
  }

  const fetchCharges = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
      const { data } = await axios.get(`${config.API_URL}/api/payment-charges`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const mapped = {}
      data.forEach(item => {
        mapped[scopeKey(item.countryCode, item.paymentMethod)] = item
      })
      setChargesData(mapped)
      setError(null)
    } catch (err) {
      setError("Failed to fetch payment charges")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCharge = () => {
    setCharges([...charges, { name: "", amount: 0, type: "fixed" }])
  }

  const handleRemoveCharge = (index) => {
    const newCharges = [...charges]
    newCharges.splice(index, 1)
    setCharges(newCharges)
  }

  const handleChargeChange = (index, field, value) => {
    const newCharges = [...charges]
    if (field === "amount") {
      newCharges[index][field] = Number(value)
    } else {
      newCharges[index][field] = value
    }
    setCharges(newCharges)
  }

  const activeCountry = useMemo(
    () => countries.find((c) => c.code === selectedCountry) || null,
    [countries, selectedCountry],
  )

  // Amounts are stored in AED like every other price, then converted for the
  // shopper. Showing the converted figure keeps what the admin types honest.
  const rate = Number(activeCountry?.effectiveRate) > 0 ? Number(activeCountry.effectiveRate) : 1
  const localCurrency = activeCountry?.currencyCode || "PKR"

  const convertedPreview = (amount) => {
    const value = Number(amount) || 0
    if (!activeCountry || localCurrency === "PKR" || rate === 1) return null
    return `${localCurrency} ${(value * rate).toFixed(2)}`
  }

  // What this method falls back to when the selected country has no own rule.
  const inheritedFromDefault = useMemo(() => {
    if (!selectedCountry) return null
    if (chargesData[scopeKey(selectedCountry, selectedMethod)]) return null
    return chargesData[scopeKey(DEFAULT_SCOPE, selectedMethod)] || null
  }, [chargesData, selectedCountry, selectedMethod])

  const handleDeleteScope = async () => {
    if (!currentId || !selectedCountry) return
    if (
      !window.confirm(
        `Remove the ${activeCountry?.name || selectedCountry} rule for this payment method? It will fall back to the default (all countries) configuration.`,
      )
    ) {
      return
    }

    try {
      setDeleting(true)
      setError(null)
      setSuccess(null)
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
      await axios.delete(`${config.API_URL}/api/payment-charges/${currentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const next = { ...chargesData }
      delete next[scopeKey(selectedCountry, selectedMethod)]
      setChargesData(next)
      setSuccess("Country rule removed. This payment method now uses the default configuration.")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove country rule")
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
      
      // Validate charges
      for (const c of charges) {
        if (!c.name.trim()) {
          setError("Charge name cannot be empty")
          setSaving(false)
          return
        }
        if (c.amount < 0) {
          setError("Charge amount cannot be negative")
          setSaving(false)
          return
        }
      }

      const payload = {
        paymentMethod: selectedMethod,
        countryCode: selectedCountry || "",
        description,
        charges,
        isActive
      }

      let res;
      if (currentId) {
        // Update
        res = await axios.put(`${config.API_URL}/api/payment-charges/${currentId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
      } else {
        // Create
        res = await axios.post(`${config.API_URL}/api/payment-charges`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }

      setChargesData({
        ...chargesData,
        [scopeKey(res.data.countryCode, res.data.paymentMethod)]: res.data
      })
      setCurrentId(res.data._id)
      setSuccess("Payment charges saved successfully")
      
      // Auto clear success message
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save payment charges")
      console.error(err)
    } finally {
      setSaving(false)
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
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery | Handling Fee</h1>
          <p className="text-gray-500 mt-1">
            Manage dynamic charges and fees per payment method, separately for each country
          </p>
        </div>

        {/* Country scope */}
        <div className="border-t border-gray-100 pt-5">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-3">
            <Globe className="w-4 h-4 text-lime-500" />
            Country
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCountry(DEFAULT_SCOPE)}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                selectedCountry === DEFAULT_SCOPE
                  ? "border-lime-500 bg-lime-50 text-lime-700"
                  : "border-gray-200 hover:bg-gray-50 text-gray-600"
              }`}
            >
              All Countries (Default)
            </button>

            {countries.map((c) => {
              const isSelected = selectedCountry === c.code
              const configuredCount = PAYMENT_METHODS.filter(
                (m) => chargesData[scopeKey(c.code, m.id)],
              ).length

              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setSelectedCountry(c.code)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-all ${
                    isSelected
                      ? "border-lime-500 bg-lime-50 text-lime-700"
                      : "border-gray-200 hover:bg-gray-50 text-gray-600"
                  }`}
                >
                  <span className="w-6 h-4 rounded overflow-hidden inline-flex items-center justify-center border border-gray-200 shrink-0">
                    {c.flagSvg ? (
                      <span
                        className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-cover"
                        dangerouslySetInnerHTML={{ __html: c.flagSvg }}
                      />
                    ) : (
                      <span className="text-[9px] font-bold">{c.code}</span>
                    )}
                  </span>
                  {c.name}
                  <span className="text-[10px] font-mono text-gray-400">{c.currencyCode}</span>
                  {configuredCount > 0 && (
                    <span className="text-[10px] font-bold bg-lime-100 text-lime-700 px-1.5 py-0.5 rounded-full">
                      {configuredCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <p className="text-xs text-gray-400 mt-3">
            {selectedCountry
              ? `Editing ${activeCountry?.name || selectedCountry} only. Payment methods without a rule here use the default configuration.`
              : "Editing the default used by every country that has no rule of its own."}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2 border border-green-200">
          <CheckCircle2 className="w-5 h-5" />
          <p className="font-medium">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Payment Methods List */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Payment Methods</h2>
          </div>
          <div className="p-2 space-y-1">
            {PAYMENT_METHODS.map(method => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors text-left ${
                  selectedMethod === method.id 
                    ? "bg-lime-50 border border-lime-200 text-lime-700 font-medium" 
                    : "hover:bg-gray-50 border border-transparent text-gray-700"
                }`}
              >
                <span>{method.name}</span>
                {(() => {
                  const own = chargesData[scopeKey(selectedCountry, method.id)]
                  const fallback = selectedCountry ? chargesData[scopeKey(DEFAULT_SCOPE, method.id)] : null

                  if (own?.charges?.length > 0) {
                    return (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        own.isActive === false ? 'bg-gray-200 text-gray-600' : 'bg-lime-100 text-lime-600'
                      }`}>
                        {own.charges.length} fee(s)
                      </span>
                    )
                  }

                  if (fallback?.charges?.length > 0) {
                    return (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600" title="Inherited from the default configuration">
                        inherited
                      </span>
                    )
                  }

                  return null
                })()}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content: Edit Charges */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-lime-100 rounded-full flex items-center justify-center">
                  <Edit2 className="w-5 h-5 text-lime-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Configure {PAYMENT_METHODS.find(m => m.id === selectedMethod)?.name}
                    <span className="text-sm font-semibold text-gray-400 ml-2">
                      · {selectedCountry ? (activeCountry?.name || selectedCountry) : "All Countries"}
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500">Add custom fees that apply when users select this payment method</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${isActive ? 'bg-lime-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isActive ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <div className="ml-3 font-medium text-gray-700">
                    {isActive ? "Active" : "Inactive"}
                  </div>
                </label>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Explains what this country falls back to today */}
              {inheritedFromDefault && (
                <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold">
                      {activeCountry?.name || selectedCountry} currently uses the default configuration
                    </p>
                    <p className="mt-1 text-blue-700">
                      {inheritedFromDefault.charges?.length > 0
                        ? `Inherited: ${inheritedFromDefault.charges.map((c) => `${c.name} (${c.type === "percentage" ? `${c.amount}%` : `Rs ${c.amount}`})`).join(", ")}.`
                        : "The default has no charges configured."}{" "}
                      Saving below creates a rule for this country only.
                    </p>
                  </div>
                </div>
              )}

              {/* Description field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Description (Shows on checkout page)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-colors"
                  placeholder="e.g. Cash on Delivery includes a handling fee and a shipping fee."
                  rows="2"
                />
              </div>

              {/* Charges List */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Applicable Charges</h3>
                  <button
                    onClick={handleAddCharge}
                    className="flex items-center gap-2 px-4 py-2 bg-lime-50 text-lime-600 rounded-lg font-medium hover:bg-lime-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Charge
                  </button>
                </div>

                {charges.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <p className="text-gray-500 font-medium">No charges configured for this payment method.</p>
                    <p className="text-sm text-gray-400 mt-1">Click "Add Charge" to create one.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {charges.map((charge, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                            Charge Name
                          </label>
                          <input
                            type="text"
                            value={charge.name}
                            onChange={(e) => handleChargeChange(index, "name", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-lime-500"
                            placeholder="e.g. COD Handling Fee (Non-Refundable)"
                          />
                        </div>
                        <div className="w-48">
                          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                            Type
                          </label>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`chargeType-${index}`}
                                checked={charge.type === "fixed" || !charge.type}
                                onChange={() => handleChargeChange(index, "type", "fixed")}
                                className="accent-lime-500"
                              />
                              <span className="text-sm text-gray-700">Fixed</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`chargeType-${index}`}
                                checked={charge.type === "percentage"}
                                onChange={() => handleChargeChange(index, "type", "percentage")}
                                className="accent-lime-500"
                              />
                              <span className="text-sm text-gray-700">Percentage</span>
                            </label>
                          </div>
                        </div>
                        <div className="w-40">
                          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">
                            Amount {charge.type === "percentage" ? "(%)" : "(Rs)"}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={charge.amount}
                            onChange={(e) => handleChargeChange(index, "amount", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-lime-500"
                            placeholder="0.00"
                          />
                          {charge.type !== "percentage" && convertedPreview(charge.amount) && (
                            <p className="text-[11px] text-gray-500 mt-1" dir="ltr">
                              Shopper pays ≈ {convertedPreview(charge.amount)}
                            </p>
                          )}
                        </div>
                        <div className="pt-6">
                          <button
                            onClick={() => handleRemoveCharge(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Remove charge"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-4">
              <div>
                {selectedCountry && currentId && (
                  <button
                    onClick={handleDeleteScope}
                    disabled={deleting || saving}
                    className="flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 text-sm"
                  >
                    {deleting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent"></div>
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Use default instead
                  </button>
                )}
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-lime-500 text-white rounded-lg font-bold hover:bg-lime-600 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
