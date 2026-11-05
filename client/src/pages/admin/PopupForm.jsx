"use client"

import { useState, useEffect, useRef } from "react"
import axios from "axios"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ImageIcon,
  Save,
  Eye,
  EyeOff,
  Upload,
  ToggleLeft,
  ToggleRight,
  CheckSquare,
  Square,
  Tag,
  Zap,
  Percent,
  Smartphone,
} from "lucide-react"
import AdminSidebar from "../../components/admin/AdminSidebar"
import config from "../../config/config"

// ── Constants ────────────────────────────────────────────────────────────────
const PAGE_OPTIONS = [
  { key: "home", label: "Home Page" },
  { key: "shop", label: "Shop Page" },
  { key: "category", label: "Categories and Subcategories" },
  { key: "offer", label: "Offer Page" },
  { key: "product", label: "Product Details Page" },
  { key: "cart", label: "Cart Page" },
  { key: "checkout", label: "Checkout Page" },
  { key: "wishlist", label: "Wishlist Page" },
]

const EMPTY_SETTINGS = {
  name: "New Promo Popup",
  isEnabled: true,
  showOnPages: ["home"],
  showLimit: "once",
  platforms: ["web", "app"],
  leftImageUrl: "",
  mobileImageUrl: "",
  sectionTitle: "Why Download Our App?",
  feature1Label: "Exclusive\nApp Discounts",
  feature2Label: "Faster &\nSmooth Checkout",
  feature3Label: "Early Access to\nDeals & Offers",
  discountTopText: "DOWNLOAD NOW & GET",
  discountValue: "10% Off",
  discountBottomText: "On Your First App Order!",
  discountNote: "*T&C Apply",
  googlePlayLink: "https://play.google.com/store/apps/details?id=ae.grabatoz1.grabatoz1",
  appStoreLink: "https://apps.apple.com/pk/app/irhaas/id6742447046",
  continueButtonText: "Continue to Website",
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 text-sm"

// ── Sub-components defined OUTSIDE the page component ───────────────────────
const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
  </div>
)

const Card = ({ title, icon: Icon, iconColor = "text-lime-600", children }) => (
  <div className="bg-white rounded-xl shadow-sm p-6">
    <h2 className="text-base font-semibold text-gray-800 mb-5 flex items-center gap-2">
      {Icon && <Icon size={16} className={iconColor} />}
      {title}
    </h2>
    <div className="space-y-4">{children}</div>
  </div>
)

// ── Main page component ──────────────────────────────────────────────────────
const PopupForm = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const fileInputRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const [settings, setSettings] = useState(EMPTY_SETTINGS)

  // Separate state for image preview
  const [previewImage, setPreviewImage] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [previewMobileImage, setPreviewMobileImage] = useState(null)
  const [mobileImageFile, setMobileImageFile] = useState(null)

  const token = localStorage.getItem("adminToken")

  // ── Load settings if editing ───────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit) return
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await axios.get(`${config.API_URL}/api/popup-settings/admin/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setSettings({
          name: data.name || "Unnamed Popup",
          isEnabled: data.isEnabled !== false,
          showOnPages: Array.isArray(data.showOnPages) ? data.showOnPages : ["home"],
          showLimit: data.showLimit || "once",
          leftImageUrl: data.leftImageUrl || "",
          mobileImageUrl: data.mobileImageUrl || "",
          sectionTitle: data.sectionTitle || EMPTY_SETTINGS.sectionTitle,
          feature1Label: data.feature1Label || EMPTY_SETTINGS.feature1Label,
          feature2Label: data.feature2Label || EMPTY_SETTINGS.feature2Label,
          feature3Label: data.feature3Label || EMPTY_SETTINGS.feature3Label,
          discountTopText: data.discountTopText || EMPTY_SETTINGS.discountTopText,
          discountValue: data.discountValue || EMPTY_SETTINGS.discountValue,
          discountBottomText: data.discountBottomText || EMPTY_SETTINGS.discountBottomText,
          discountNote: data.discountNote || EMPTY_SETTINGS.discountNote,
          googlePlayLink: data.googlePlayLink || EMPTY_SETTINGS.googlePlayLink,
          appStoreLink: data.appStoreLink || EMPTY_SETTINGS.appStoreLink,
          continueButtonText: data.continueButtonText || EMPTY_SETTINGS.continueButtonText,
          platforms: Array.isArray(data.platforms) ? data.platforms : ["web", "app"],
        })
      } catch {
        setError("Failed to load popup details.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isEdit, token])

  // ── Field change helper ──────────────────────────────────────────────────────
  const handleChange = (key) => (e) =>
    setSettings((prev) => ({ ...prev, [key]: e.target.value }))

  const togglePage = (key) =>
    setSettings((prev) => ({
      ...prev,
      showOnPages: prev.showOnPages.includes(key)
        ? prev.showOnPages.filter((k) => k !== key)
        : [...prev.showOnPages, key],
    }))

  const togglePlatform = (key) =>
    setSettings((prev) => {
      const current = prev.platforms || ["web", "app"]
      const updated = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key]
      return { ...prev, platforms: updated }
    })

  // ── Image selection (WebP only) ──────────────────────────────────────────────
  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.includes("webp") && !file.name.toLowerCase().endsWith(".webp")) {
      alert("Only WebP images are accepted. Please select a .webp file.")
      e.target.value = ""
      return
    }

    setImageFile(file)
    const objectUrl = URL.createObjectURL(file)
    setPreviewImage(objectUrl)
  }

  const handleMobileImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.includes("webp") && !file.name.toLowerCase().endsWith(".webp")) {
      alert("Only WebP images are accepted. Please select a .webp file.")
      e.target.value = ""
      return
    }

    setMobileImageFile(file)
    const objectUrl = URL.createObjectURL(file)
    setPreviewMobileImage(objectUrl)
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewImage) URL.revokeObjectURL(previewImage)
      if (previewMobileImage) URL.revokeObjectURL(previewMobileImage)
    }
  }, [previewImage, previewMobileImage])

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const fd = new FormData()
      Object.entries(settings).forEach(([k, v]) => {
        if (k === "showOnPages") {
          fd.append(k, JSON.stringify(v))
        } else if (k !== "leftImageUrl" && k !== "mobileImageUrl") {
          fd.append(k, String(v))
        }
      })
      if (imageFile) fd.append("leftImage", imageFile)
      if (mobileImageFile) fd.append("mobileImage", mobileImageFile)
      
      if (!settings.leftImageUrl && !imageFile) fd.append("removeLeftImage", "true")
      if (!settings.mobileImageUrl && !mobileImageFile) fd.append("removeMobileImage", "true")

      const url = isEdit
        ? `${config.API_URL}/api/popup-settings/${id}`
        : `${config.API_URL}/api/popup-settings`

      const method = isEdit ? "put" : "post"

      await axios[method](url, fd, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      })

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        navigate("/admin/app-discount-settings/popup-settings")
      }, 1000)
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save settings.")
    } finally {
      setSaving(false)
    }
  }

  // ── Resolve image src for preview box ──────────────────────────────────────
  const currentImageSrc = previewImage
    ? previewImage
    : settings.leftImageUrl
    ? settings.leftImageUrl.startsWith("http")
      ? settings.leftImageUrl
      : `${config.API_URL}${settings.leftImageUrl}`
    : null

  const currentMobileImageSrc = previewMobileImage
    ? previewMobileImage
    : settings.mobileImageUrl
    ? settings.mobileImageUrl.startsWith("http")
      ? settings.mobileImageUrl
      : `${config.API_URL}${settings.mobileImageUrl}`
    : null

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/admin/app-discount-settings/popup-settings")}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? "Edit Promo Popup" : "Add Promo Popup"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configure layout, targeting, frequency, and custom discount content.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-lime-500" />
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ── LEFT COLUMN ── */}
              <div className="lg:col-span-2 space-y-6">
                {/* Feedback */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    ✓ Popup settings saved successfully. Redirecting...
                  </div>
                )}

                {/* ── Popup Name ── */}
                <Card title="Popup Identifier" icon={Tag}>
                  <Field
                    label="Popup Config Name *"
                    hint="For admin reference in listings (e.g. Eid Promo, Shop Page Banner)"
                  >
                    <input
                      type="text"
                      value={settings.name}
                      onChange={handleChange("name")}
                      className={inputClass}
                      placeholder="e.g. Home Page Main Popup"
                      required
                    />
                  </Field>
                </Card>

                {/* ── Desktop Banner Image ── */}
                <Card title="Left Panel — Desktop Banner Image" icon={ImageIcon}>
                  <p className="text-xs text-gray-400 -mt-2">
                    This is the full-bleed promotional image on the left side of the popup for desktop view.{" "}
                    <strong className="text-gray-600">Only .webp files accepted.</strong>
                  </p>

                  <div className="flex flex-col sm:flex-row gap-5 items-start">
                    {/* Preview box */}
                    <div className="w-full sm:w-[200px] h-[240px] rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {currentImageSrc ? (
                        <img
                          src={currentImageSrc}
                          alt="Left panel preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none"
                          }}
                        />
                      ) : (
                        <div className="text-center text-gray-400">
                          <ImageIcon size={30} className="mx-auto mb-1 opacity-40" />
                          <p className="text-xs">No image uploaded</p>
                        </div>
                      )}
                    </div>

                    {/* Upload controls */}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept=".webp,image/webp"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        className="hidden"
                        id="left-image-input"
                      />
                      <div className="flex gap-2">
                        <label
                          htmlFor="left-image-input"
                          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <Upload size={15} />
                          {currentImageSrc ? "Change Image" : "Upload Image"}
                        </label>
                        {currentImageSrc && (
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null)
                              setPreviewImage(null)
                              setSettings(prev => ({ ...prev, leftImageUrl: "" }))
                              if (fileInputRef.current) fileInputRef.current.value = ""
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-400">
                        Recommended: 500 × 600 px (portrait). Max 10 MB.{" "}
                        <span className="font-medium text-gray-500">WebP format only.</span>
                      </p>
                      {imageFile && (
                        <p className="mt-1 text-xs text-lime-600 font-medium">
                          ✓ Selected: {imageFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* ── Mobile Banner Image ── */}
                <Card title="Mobile Banner Image" icon={ImageIcon}>
                  <p className="text-xs text-gray-400 -mt-2">
                    This is the promotional image displayed on mobile devices.{" "}
                    <strong className="text-gray-600">Only .webp files accepted.</strong>
                  </p>

                  <div className="flex flex-col sm:flex-row gap-5 items-start">
                    {/* Preview box */}
                    <div className="w-full sm:w-[250px] h-[94px] rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {currentMobileImageSrc ? (
                        <img
                          src={currentMobileImageSrc}
                          alt="Mobile banner preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none"
                          }}
                        />
                      ) : (
                        <div className="text-center text-gray-400">
                          <ImageIcon size={30} className="mx-auto mb-1 opacity-40" />
                          <p className="text-xs">No image uploaded</p>
                        </div>
                      )}
                    </div>

                    {/* Upload controls */}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept=".webp,image/webp"
                        onChange={handleMobileImageSelect}
                        className="hidden"
                        id="mobile-image-input"
                      />
                      <div className="flex gap-2">
                        <label
                          htmlFor="mobile-image-input"
                          className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                        >
                          <Upload size={15} />
                          {currentMobileImageSrc ? "Change Image" : "Upload Image"}
                        </label>
                        {currentMobileImageSrc && (
                          <button
                            type="button"
                            onClick={() => {
                              setMobileImageFile(null)
                              setPreviewMobileImage(null)
                              setSettings(prev => ({ ...prev, mobileImageUrl: "" }))
                              const input = document.getElementById("mobile-image-input")
                              if (input) input.value = ""
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-400">
                        Recommended: 800 × 300 px (landscape/banner). Max 10 MB.{" "}
                        <span className="font-medium text-gray-500">WebP format only.</span>
                      </p>
                      {mobileImageFile && (
                        <p className="mt-1 text-xs text-lime-600 font-medium">
                          ✓ Selected: {mobileImageFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* ── Section Title ── */}
                <Card title="Right Panel — Section Title" icon={Tag}>
                  <Field
                    label="Section Heading"
                    hint='Shown as "— Why Download Our App? —" at the top of the right panel.'
                  >
                    <input
                      type="text"
                      value={settings.sectionTitle}
                      onChange={handleChange("sectionTitle")}
                      className={inputClass}
                      placeholder="Why Download Our App?"
                    />
                  </Field>
                </Card>

                {/* ── Feature Tiles ── */}
                <Card title="Right Panel — 3 Feature Tiles" icon={Zap}>
                  <p className="text-xs text-gray-400 -mt-2">
                    Icons are fixed (Tag · Zap · Bell). Use a new line in the text area for the second
                    line of each label.
                  </p>

                  {[
                    {
                      key: "feature1Label",
                      label: "Feature 1 — Tag icon",
                      placeholder: "Exclusive\nApp Discounts",
                    },
                    {
                      key: "feature2Label",
                      label: "Feature 2 — Zap icon",
                      placeholder: "Faster &\nSmooth Checkout",
                    },
                    {
                      key: "feature3Label",
                      label: "Feature 3 — Bell icon",
                      placeholder: "Early Access to\nDeals & Offers",
                    },
                  ].map(({ key, label, placeholder }) => (
                    <Field key={key} label={label}>
                      <textarea
                        value={settings[key]}
                        onChange={handleChange(key)}
                        rows={2}
                        className={`${inputClass} resize-none`}
                        placeholder={placeholder}
                      />
                    </Field>
                  ))}
                </Card>

                {/* ── Discount Box ── */}
                <Card title="Right Panel — Discount Box" icon={Percent}>
                  <p className="text-xs text-gray-400 -mt-2">
                    The dashed-border highlight box: top label · large value · subtitle · small note.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Top Label" hint='e.g. "DOWNLOAD NOW & GET"'>
                      <input
                        type="text"
                        value={settings.discountTopText}
                        onChange={handleChange("discountTopText")}
                        className={inputClass}
                        placeholder="DOWNLOAD NOW & GET"
                      />
                    </Field>

                    <Field label="Discount Value" hint='Large green text, e.g. "10% Off"'>
                      <input
                        type="text"
                        value={settings.discountValue}
                        onChange={handleChange("discountValue")}
                        className={inputClass}
                        placeholder="10% Off"
                      />
                    </Field>

                    <Field label="Bottom Text" hint='e.g. "On Your First App Order!"'>
                      <input
                        type="text"
                        value={settings.discountBottomText}
                        onChange={handleChange("discountBottomText")}
                        className={inputClass}
                        placeholder="On Your First App Order!"
                      />
                    </Field>

                    <Field label="Fine Print / Note" hint="Leave blank to hide.">
                      <input
                        type="text"
                        value={settings.discountNote}
                        onChange={handleChange("discountNote")}
                        className={inputClass}
                        placeholder="*T&C Apply"
                      />
                    </Field>
                  </div>

                  {/* Live preview */}
                  <div className="mt-2 border-2 border-dashed border-green-400 rounded-2xl py-3 text-center bg-gray-50">
                    <p className="text-xs font-black text-gray-900 uppercase tracking-wide">
                      {settings.discountTopText || "DOWNLOAD NOW & GET"}
                    </p>
                    <p className="text-3xl leading-none font-black text-green-600 uppercase my-0.5">
                      {settings.discountValue || "10% Off"}
                    </p>
                    <p className="text-xs font-extrabold text-gray-900 uppercase leading-none">
                      {settings.discountBottomText || "On Your First App Order!"}
                    </p>
                    {settings.discountNote && (
                      <p className="text-[9px] text-gray-400 mt-0.5">{settings.discountNote}</p>
                    )}
                  </div>
                </Card>

                {/* ── Store Links ── */}
                <Card title="Right Panel — App Store Links & Button" icon={Percent}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Google Play Link">
                      <input
                        type="url"
                        value={settings.googlePlayLink}
                        onChange={handleChange("googlePlayLink")}
                        className={inputClass}
                        placeholder="https://play.google.com/..."
                      />
                    </Field>

                    <Field label="App Store Link">
                      <input
                        type="url"
                        value={settings.appStoreLink}
                        onChange={handleChange("appStoreLink")}
                        className={inputClass}
                        placeholder="https://apps.apple.com/..."
                      />
                    </Field>
                  </div>

                  <Field
                    label="Continue to Website Button Text"
                    hint="The dismiss button at the bottom of the popup."
                  >
                    <input
                      type="text"
                      value={settings.continueButtonText}
                      onChange={handleChange("continueButtonText")}
                      className={inputClass}
                      placeholder="Continue to Website"
                    />
                  </Field>
                </Card>
              </div>

              {/* ── RIGHT COLUMN — Status + Pages + Save ── */}
              <div className="space-y-6">
                {/* Popup Status */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-base font-semibold text-gray-800 mb-4">Popup Status</h2>

                  <button
                    type="button"
                    onClick={() => setSettings((p) => ({ ...p, isEnabled: !p.isEnabled }))}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-colors ${
                      settings.isEnabled
                        ? "border-green-400 bg-green-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {settings.isEnabled ? (
                        <Eye size={18} className="text-green-600" />
                      ) : (
                        <EyeOff size={18} className="text-gray-400" />
                      )}
                      <span
                        className={`font-medium text-sm ${
                          settings.isEnabled ? "text-green-700" : "text-gray-500"
                        }`}
                      >
                        {settings.isEnabled ? "Popup Enabled" : "Popup Disabled"}
                      </span>
                    </div>
                    {settings.isEnabled ? (
                      <ToggleRight size={24} className="text-green-500" />
                    ) : (
                      <ToggleLeft size={24} className="text-gray-400" />
                    )}
                  </button>

                  <p className="mt-2 text-xs text-gray-400">
                    {settings.isEnabled
                      ? "Popup will appear on the selected pages."
                      : "Popup is disabled and won't show anywhere."}
                  </p>
                </div>

                {/* Show On Pages */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-base font-semibold text-gray-800 mb-3">Show On Pages</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    Select which pages this popup should appear on.
                  </p>

                  <div className="space-y-2">
                    {PAGE_OPTIONS.map(({ key, label }) => {
                      const checked = settings.showOnPages.includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => togglePage(key)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-sm ${
                            checked
                              ? "border-lime-400 bg-lime-50 text-lime-800"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {checked ? (
                            <CheckSquare size={15} className="text-lime-500 flex-shrink-0" />
                          ) : (
                            <Square size={15} className="text-gray-300 flex-shrink-0" />
                          )}
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Target Platforms */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-base font-semibold text-gray-800 mb-3">Target Platforms</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    Select where this popup should be visible. Select at least one.
                  </p>

                  <div className="space-y-2">
                    {[
                      { key: "web", label: "Web (Mobile/Desktop Browsers)" },
                      { key: "app", label: "Mobile App (WebView)" },
                    ].map(({ key, label }) => {
                      const checked = (settings.platforms || ["web", "app"]).includes(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => togglePlatform(key)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-sm ${
                            checked
                              ? "border-lime-400 bg-lime-50 text-lime-800"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {checked ? (
                            <CheckSquare size={15} className="text-lime-500 flex-shrink-0" />
                          ) : (
                            <Square size={15} className="text-gray-300 flex-shrink-0" />
                          )}
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Display Frequency */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h2 className="text-base font-semibold text-gray-800 mb-3">Popup Frequency</h2>
                  <p className="text-xs text-gray-400 mb-3">
                    Determine how often the popup appears for a user.
                  </p>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="showLimit"
                        value="once"
                        checked={settings.showLimit === "once" || !settings.showLimit}
                        onChange={() => setSettings((p) => ({ ...p, showLimit: "once" }))}
                        className="mt-1 h-4 w-4 text-lime-500 focus:ring-lime-400"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">Once per session</span>
                        <p className="text-xs text-gray-400 mt-0.5">Recommended. Shows once, then remains hidden during their visit.</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="showLimit"
                        value="always"
                        checked={settings.showLimit === "always"}
                        onChange={() => setSettings((p) => ({ ...p, showLimit: "always" }))}
                        className="mt-1 h-4 w-4 text-lime-500 focus:ring-lime-400"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-800">Show on every visit</span>
                        <p className="text-xs text-gray-400 mt-0.5">Forces the popup to display on every single page load or tab visit.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-lime-500 text-white rounded-xl font-semibold hover:bg-lime-600 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Popup Config"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default PopupForm
