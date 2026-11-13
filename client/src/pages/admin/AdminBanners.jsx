"use client"

import { useState, useEffect, useRef } from "react"
import axios from "axios"
import AdminSidebar from "../../components/admin/AdminSidebar"
import ImageUpload from "../../components/ImageUpload"
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Video,
  Image as ImageIcon,
  Palette,
  Upload,
  Loader2,
  Sparkles,
  Check,
  X,
} from "lucide-react"
import { getFullImageUrl } from "../../utils/imageUtils"

import config from "../../config/config"

const debugBanners = (...args) => {
  if (import.meta?.env?.VITE_DEBUG_BANNERS === "true") {
    console.log("[DEBUG_BANNERS_ADMIN]", ...args)
  }
}

const DEFAULT_COUNTRIES = [
  { code: "AE", name: "UAE" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "QA", name: "Qatar" },
  { code: "OM", name: "Oman" },
  { code: "BH", name: "Bahrain" },
  { code: "KW", name: "Kuwait" },
]

const HERO_COLOR_PRESETS = [
  { name: "Brand Brown", value: "#8b5e34" },
  { name: "Charcoal", value: "#1f2937" },
  { name: "Midnight Navy", value: "#0f172a" },
  { name: "Burgundy", value: "#581c1c" },
  { name: "Forest Green", value: "#064e3b" },
  { name: "Pure Black", value: "#000000" },
  { name: "Warm Taupe", value: "#7c5c43" },
]

const AdminBanners = () => {
  const [banners, setBanners] = useState([])
  const [categories, setCategories] = useState([])
  const [availableCountries, setAvailableCountries] = useState(DEFAULT_COUNTRIES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingBanner, setEditingBanner] = useState(null)

  const [videoUploading, setVideoUploading] = useState(false)
  const [videoUploadProgress, setVideoUploadProgress] = useState(0)
  const [videoUploadError, setVideoUploadError] = useState(null)
  const videoInputRef = useRef(null)

  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    description: "",
    image: "",
    video: "",
    backgroundColor: "#8b5e34",
    mediaType: "none", // "none" (solid color), "image", "video"
    showText: true,
    finePrint: "",
    textColor: "#ffffff",
    overlayOpacity: 0,
    heroHeight: "large",
    buttonText: "Shop Now",
    buttonLink: "/shop",
    position: "hero",
    section: "hero-section",
    link: "",
    category: "",
    discount: "",
    isActive: true,
    sortOrder: 0,
    validFrom: "",
    validUntil: "",
    deviceType: "desktop",
    targetCountries: ["ALL"],
  })

  const positions = [
    { value: "hero", label: "🌟 Top Hero Section (Text / Color / Image / Video)" },
    { value: "season-bottom", label: "25% Off New Season – Bottom Image" },
    { value: "sale-bottom", label: "Sale Section – Bottom Image" },
  ]

  useEffect(() => {
    fetchBanners()
    fetchCategories()
    fetchCountries()
  }, [])

  const fetchCountries = async () => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/countries/public`)
      if (Array.isArray(data) && data.length > 0) {
        setAvailableCountries(data.map((c) => ({ code: c.code, name: c.name })))
      }
    } catch (err) {
      console.warn("Could not fetch active countries, using defaults:", err)
    }
  }

  const fetchBanners = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/banners/admin`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setBanners(data)
      setLoading(false)
    } catch (error) {
      console.error("Banner fetch error:", error)
      setError("Failed to load banners. Please try again later.")
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/categories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setCategories(data)
    } catch (error) {
      console.error("Categories fetch error:", error)
    }
  }

  const handleImageUpload = (imageUrl) => {
    setFormData((prev) => ({ ...prev, image: imageUrl }))
  }

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = (file.name || "").substring((file.name || "").lastIndexOf(".")).toLowerCase()
    const isAllowedExt = [".mp4", ".webm", ".mov", ".m4v", ".ogg"].includes(ext)

    if (!file.type.startsWith("video/") && !isAllowedExt) {
      setVideoUploadError("Please select a valid video file (MP4, WebM, MOV).")
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      setVideoUploadError("Video file size must be less than 100MB.")
      return
    }

    try {
      setVideoUploading(true)
      setVideoUploadProgress(0)
      setVideoUploadError(null)

      const token =
        localStorage.getItem("adminToken") ||
        localStorage.getItem("token") ||
        localStorage.getItem("authToken")

      const uploadData = new FormData()
      uploadData.append("video", file)

      const headers = {
        "Content-Type": "multipart/form-data",
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await axios.post(`${config.API_URL}/api/upload/video`, uploadData, {
        headers,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setVideoUploadProgress(percentCompleted)
          }
        },
      })

      if (response.data && response.data.url) {
        setFormData((prev) => ({
          ...prev,
          video: response.data.url,
          mediaType: "video",
        }))
      }
    } catch (err) {
      console.error("Video upload failed:", err)
      let errorMsg = "Failed to upload video."
      if (err.response?.status === 413) {
        errorMsg = "Video file is too large for the server limit. Please compress the video or enter a direct video URL."
      } else if (err.response?.status === 401) {
        errorMsg = "Authentication failed. Please re-login to Admin."
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message
      } else if (err.message) {
        errorMsg = err.message
      }
      setVideoUploadError(errorMsg)
    } finally {
      setVideoUploading(false)
      setVideoUploadProgress(0)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const token = localStorage.getItem("adminToken")

      let finalPosition = formData.position
      let finalSection = formData.position === "hero" ? "hero-section" : formData.section || formData.position

      const bannerData = {
        ...formData,
        title: formData.title?.trim() || (formData.position === "hero" ? "Top Hero Section" : "Banner"),
        position: finalPosition,
        section: finalSection,
        sortOrder: Number.parseInt(formData.sortOrder) || 0,
        discount: formData.discount ? Number.parseFloat(formData.discount) : null,
        validFrom: formData.validFrom ? new Date(formData.validFrom) : new Date(),
        validUntil: formData.validUntil ? new Date(formData.validUntil) : null,
        category: formData.position === "category" ? formData.category : null,
        overlayOpacity: Number.parseInt(formData.overlayOpacity) ?? 35,
      }

      if (
        finalPosition === "season-bottom" ||
        finalPosition === "sale-bottom" ||
        finalPosition === "hero" ||
        String(finalPosition).startsWith("hero-") ||
        String(finalPosition).startsWith("second-banner-")
      ) {
        const heroLink = String(formData.buttonLink || formData.link || "/shop").trim() || "/shop"
        bannerData.buttonLink = heroLink
        bannerData.link = heroLink
      }

      debugBanners("submit:payload", {
        url: editingBanner
          ? `${config.API_URL}/api/banners/${editingBanner._id}`
          : `${config.API_URL}/api/banners`,
        method: editingBanner ? "PUT" : "POST",
        payload: {
          position: bannerData.position,
          section: bannerData.section,
          mediaType: bannerData.mediaType,
          showText: bannerData.showText,
          backgroundColor: bannerData.backgroundColor,
          buttonLink: bannerData.buttonLink,
          title: bannerData.title,
        },
      })

      if (editingBanner) {
        await axios.put(`${config.API_URL}/api/banners/${editingBanner._id}`, bannerData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      } else {
        await axios.post(`${config.API_URL}/api/banners`, bannerData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      }

      fetchBanners()
      setShowForm(false)
      setEditingBanner(null)
      resetForm()
    } catch (error) {
      console.error("Banner save error:", error)
      setError("Failed to save banner. Please try again.")
    }
  }

  const resetForm = () => {
    setFormData({
      title: "",
      subtitle: "",
      description: "",
      image: "",
      video: "",
      backgroundColor: "#8b5e34",
      mediaType: "none",
      showText: true,
      finePrint: "",
      textColor: "#ffffff",
      overlayOpacity: 0,
      heroHeight: "large",
      buttonText: "Shop Now",
      buttonLink: "/shop",
      position: "hero",
      section: "hero-section",
      link: "",
      category: "",
      discount: "",
      isActive: true,
      sortOrder: 0,
      validFrom: "",
      validUntil: "",
      deviceType: "desktop",
      targetCountries: ["ALL"],
    })
    setVideoUploadError(null)
  }

  const handleEdit = (banner) => {
    setEditingBanner(banner)

    let displayPosition = banner.position
    if (banner.position === "hero" || banner.section === "hero-section") {
      displayPosition = "hero"
    } else if (
      displayPosition === "season-bottom" ||
      displayPosition === "hero-desktop" ||
      displayPosition === "hero-mobile" ||
      displayPosition?.includes("season")
    ) {
      displayPosition = "season-bottom"
    } else if (
      displayPosition === "second-banner" ||
      displayPosition === "second-banner-desktop" ||
      displayPosition === "second-banner-mobile" ||
      displayPosition?.includes("sale")
    ) {
      displayPosition = "sale-bottom"
    } else {
      displayPosition = "season-bottom"
    }

    setFormData({
      title: banner.title || "",
      subtitle: banner.subtitle || "",
      description: banner.description || "",
      image: banner.image || "",
      video: banner.video || "",
      backgroundColor: banner.backgroundColor || "#8b5e34",
      mediaType: banner.mediaType || (banner.video ? "video" : banner.image ? "image" : "none"),
      showText: banner.showText !== undefined ? banner.showText : true,
      finePrint: banner.finePrint || banner.description || "",
      textColor: banner.textColor || "#ffffff",
      overlayOpacity: banner.overlayOpacity !== undefined ? banner.overlayOpacity : 0,
      heroHeight: banner.heroHeight || "large",
      buttonText: banner.buttonText || "Shop Now",
      buttonLink: banner.buttonLink || "/shop",
      position: displayPosition,
      section: banner.section || (displayPosition === "hero" ? "hero-section" : displayPosition),
      link: banner.link || banner.buttonLink || "",
      category: banner.category?._id || "",
      discount: banner.discount || "",
      isActive: banner.isActive !== undefined ? banner.isActive : true,
      sortOrder: banner.sortOrder || 0,
      validFrom: banner.validFrom ? new Date(banner.validFrom).toISOString().split("T")[0] : "",
      validUntil: banner.validUntil ? new Date(banner.validUntil).toISOString().split("T")[0] : "",
      deviceType: banner.deviceType || "desktop",
      targetCountries:
        Array.isArray(banner.targetCountries) && banner.targetCountries.length > 0 ? banner.targetCountries : ["ALL"],
    })
    setShowForm(true)
  }

  const handleDelete = async (bannerId) => {
    if (window.confirm("Are you sure you want to delete this banner?")) {
      try {
        const token = localStorage.getItem("adminToken")
        await axios.delete(`${config.API_URL}/api/banners/${bannerId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        fetchBanners()
      } catch (error) {
        console.error("Banner delete error:", error)
        setError("Failed to delete banner. Please try again.")
      }
    }
  }

  const handleToggleStatus = async (banner) => {
    try {
      const token = localStorage.getItem("adminToken")
      const newStatus = !banner.isActive
      await axios.put(
        `${config.API_URL}/api/banners/${banner._id}`,
        { ...banner, isActive: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setBanners((prev) =>
        prev.map((b) => (b._id === banner._id ? { ...b, isActive: newStatus } : b))
      )
    } catch (err) {
      console.error("Banner toggle status error:", err)
      setError("Failed to update banner status. Please try again.")
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingBanner(null)
    resetForm()
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Banners Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage Home Page Top Hero section, bottom banners, and promotional sliders.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="bg-lime-400 text-black font-semibold py-2.5 px-5 rounded-md flex items-center shadow-sm hover:bg-lime-500 transition"
          >
            <Plus size={18} className="mr-1.5" />
            Add New Banner
          </button>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-md">{error}</div>}

        {showForm && (
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8 transition-all">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                {editingBanner ? "Edit Banner" : "Create New Banner"}
              </h2>
              <button
                type="button"
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Position selector at the top */}
              <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/30 p-4 rounded-xl border border-amber-200/70">
                <label className="block text-sm font-bold text-gray-800 mb-1.5">
                  Banner Placement / Position <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.position}
                  onChange={(e) => {
                    const newPos = e.target.value
                    setFormData((prev) => ({
                      ...prev,
                      position: newPos,
                      section: newPos === "hero" ? "hero-section" : newPos,
                    }))
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-lg text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  {positions.map((pos) => (
                    <option key={pos.value} value={pos.value}>
                      {pos.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-amber-800">
                  {formData.position === "hero"
                    ? "✨ Top Hero Section appears at the very top of the home page. Supports background color, background images, background video, and custom text overlays."
                    : "Standard full-width banner placed below home page sections."}
                </p>
              </div>

              {/* ----------------- TOP HERO SECTION CONTROLS ----------------- */}
              {formData.position === "hero" ? (
                <div className="space-y-6">
                  {/* Media Type Selector */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                      Background Display Mode
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      Choose what to display in the background of the Top Hero Section:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, mediaType: "none" })}
                        className={`flex items-center gap-3 p-3.5 rounded-lg border-2 text-left transition-all ${
                          formData.mediaType === "none"
                            ? "border-amber-600 bg-amber-50/50 shadow-sm"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            formData.mediaType === "none"
                              ? "bg-amber-600 text-white"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <Palette size={20} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-gray-900">Solid Color</div>
                          <div className="text-xs text-gray-500">Fast, minimalist color background</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, mediaType: "image" })}
                        className={`flex items-center gap-3 p-3.5 rounded-lg border-2 text-left transition-all ${
                          formData.mediaType === "image"
                            ? "border-amber-600 bg-amber-50/50 shadow-sm"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            formData.mediaType === "image"
                              ? "bg-amber-600 text-white"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <ImageIcon size={20} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-gray-900">Background Image</div>
                          <div className="text-xs text-gray-500">High-res picture with tint overlay</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, mediaType: "video" })}
                        className={`flex items-center gap-3 p-3.5 rounded-lg border-2 text-left transition-all ${
                          formData.mediaType === "video"
                            ? "border-amber-600 bg-amber-50/50 shadow-sm"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            formData.mediaType === "video"
                              ? "bg-amber-600 text-white"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <Video size={20} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-gray-900">Background Video</div>
                          <div className="text-xs text-gray-500">Autoplaying looping MP4 / WebM</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Solid Color Settings */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
                    <label className="block text-sm font-bold text-gray-800">
                      Background Color {formData.mediaType !== "none" && "(Fallback / Underlay)"}
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      {HERO_COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, backgroundColor: preset.value })}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                            formData.backgroundColor.toLowerCase() === preset.value.toLowerCase()
                              ? "border-gray-900 ring-2 ring-gray-900 text-gray-900 bg-white shadow-sm"
                              : "border-gray-300 text-gray-700 bg-white hover:bg-gray-100"
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block"
                            style={{ backgroundColor: preset.value }}
                          />
                          {preset.name}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.backgroundColor || "#8b5e34"}
                        onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                        className="h-10 w-16 p-1 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.backgroundColor}
                        onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                        placeholder="#8b5e34"
                        className="w-36 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono uppercase"
                      />
                      <span className="text-xs text-gray-500">
                        Default: #8b5e34 (Irhaas Warm Brown)
                      </span>
                    </div>
                  </div>

                  {/* Image Upload if mediaType === image */}
                  {formData.mediaType === "image" && (
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-3">
                      <ImageUpload
                        onImageUpload={handleImageUpload}
                        currentImage={formData.image}
                        label="Hero Background Image"
                        isBanner={true}
                      />
                    </div>
                  )}

                  {/* Video Upload if mediaType === video */}
                  {formData.mediaType === "video" && (
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-bold text-gray-800">
                          Hero Background Video (MP4 / WebM)
                        </label>
                        {formData.video && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, video: "" })}
                            className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1"
                          >
                            <Trash2 size={13} /> Remove Video
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                        <input
                          ref={videoInputRef}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,video/*"
                          onChange={handleVideoUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => videoInputRef.current?.click()}
                          disabled={videoUploading}
                          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition"
                        >
                          {videoUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" /> Uploading ({videoUploadProgress}%)...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" /> Upload Video File
                            </>
                          )}
                        </button>

                        <div className="flex-1">
                          <input
                            type="text"
                            value={formData.video}
                            onChange={(e) => setFormData({ ...formData, video: e.target.value })}
                            placeholder="Or enter direct video URL (e.g. /uploads/videos/banner.mp4 or Cloudinary URL)"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>

                      {videoUploading && (
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mt-1">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                            style={{ width: `${videoUploadProgress}%` }}
                          />
                        </div>
                      )}

                      <div className="text-[11px] text-gray-500 mt-1">
                        Supported: MP4, WebM, MOV (up to 100MB). You can also paste an external or hosted video URL directly.
                      </div>

                      {videoUploadError && (
                        <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">
                          {videoUploadError}
                        </div>
                      )}

                      {formData.video && (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="text-xs font-semibold text-gray-700 mb-2">Video Preview:</div>
                          <video
                            src={getFullImageUrl(formData.video)}
                            controls
                            muted
                            playsInline
                            className="w-full max-h-56 rounded bg-black object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dark Overlay Opacity (if image or video) */}
                  {formData.mediaType !== "none" && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-sm font-bold text-gray-800">
                          Dark Overlay Tint: {formData.overlayOpacity}%
                        </label>
                        <span className="text-xs text-gray-500">
                          Adds contrast so headline and button stand out
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="85"
                        step="5"
                        value={formData.overlayOpacity}
                        onChange={(e) =>
                          setFormData({ ...formData, overlayOpacity: Number.parseInt(e.target.value) })
                        }
                        className="w-full cursor-pointer accent-amber-600"
                      />
                    </div>
                  )}

                  {/* Hero Height Selection */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <label className="block text-sm font-bold text-gray-800 mb-1">
                      Hero Section Height
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      Adjusts the vertical height of the hero block so background videos and model photography display fully without top/bottom cropping.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      {[
                        { id: "compact", label: "Compact", height: "~450px", desc: "Short banner" },
                        { id: "medium", label: "Medium", height: "~580px", desc: "Balanced height" },
                        { id: "large", label: "Large (Recommended)", height: "~740px", desc: "Best for full 16:9 video" },
                        { id: "fullscreen", label: "Fullscreen", height: "~90vh", desc: "Full screen height" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, heroHeight: item.id })}
                          className={`p-3 rounded-lg border text-left transition ${
                            (formData.heroHeight || "large") === item.id
                              ? "border-amber-600 bg-amber-50/70 ring-2 ring-amber-600 shadow-sm"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="text-xs font-bold text-gray-900">{item.label}</div>
                          <div className="text-[11px] text-amber-700 font-semibold">{item.height}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Show Text Overlay Checkbox */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="showText"
                      checked={formData.showText}
                      onChange={(e) => setFormData({ ...formData, showText: e.target.checked })}
                      className="mt-1 h-5 w-5 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                    />
                    <label htmlFor="showText" className="cursor-pointer">
                      <div className="text-sm font-bold text-gray-900">
                        Show Text Overlay on Hero (Headline, Subtitle, Button, Fine Print)
                      </div>
                      <div className="text-xs text-gray-500">
                        Turn this off if you want to display <b>ONLY the background video or image</b> without any text on top.
                      </div>
                    </label>
                  </div>

                  {/* Text Overlay Details (Headline, Subtitle, Button, Fine Print) */}
                  {formData.showText && (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4">
                      <div className="font-bold text-sm text-gray-800 pb-2 border-b border-gray-100 flex items-center justify-between">
                        <span>Text Content & Typography</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-normal text-gray-500">Text Color:</span>
                          <input
                            type="color"
                            value={formData.textColor || "#ffffff"}
                            onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                            className="h-7 w-10 p-0 border border-gray-300 rounded cursor-pointer"
                          />
                          <span className="text-xs font-mono">{formData.textColor || "#ffffff"}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Headline / Title
                          </label>
                          <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                            placeholder="e.g. 25% off new season"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Subtitle
                          </label>
                          <input
                            type="text"
                            value={formData.subtitle}
                            onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="e.g. Family & friends event"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Button Text
                          </label>
                          <input
                            type="text"
                            value={formData.buttonText}
                            onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="Shop now"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Button Link
                          </label>
                          <input
                            type="text"
                            value={formData.buttonLink}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                buttonLink: e.target.value,
                                link: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="/shop or shop/abayas-and-modest-wear"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Fine Print / Terms Footnote
                        </label>
                        <input
                          type="text"
                          value={formData.finePrint}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              finePrint: e.target.value,
                              description: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                          placeholder="e.g. Discount applied at checkout on 2 or more items. Cannot be combined with other offers."
                        />
                      </div>
                    </div>
                  )}

                  {/* LIVE REAL-TIME PREVIEW */}
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                      <Eye className="w-4 h-4 text-amber-600" />
                      Live Preview (Exactly how it will look on Home Page):
                    </div>

                    <div
                      className="relative w-full rounded-lg overflow-hidden text-center transition-colors duration-300 min-h-[220px] md:min-h-[280px] flex flex-col justify-center items-center shadow"
                      style={{ backgroundColor: formData.backgroundColor || "#8b5e34" }}
                    >
                      {/* Video in preview */}
                      {formData.mediaType === "video" && formData.video && (
                        <video
                          src={getFullImageUrl(formData.video)}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        />
                      )}

                      {/* Image in preview */}
                      {formData.mediaType === "image" && formData.image && (
                        <img
                          src={getFullImageUrl(formData.image)}
                          alt="Hero Preview"
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        />
                      )}

                      {/* Overlay */}
                      {formData.mediaType !== "none" && (
                        <div
                          className="absolute inset-0 bg-black pointer-events-none"
                          style={{ opacity: (formData.overlayOpacity ?? 35) / 100 }}
                        />
                      )}

                      {/* Content */}
                      <div className="relative z-10 p-6 max-w-2xl mx-auto">
                        {formData.showText ? (
                          <>
                            <h3
                              className="text-xl sm:text-2xl font-bold uppercase tracking-wider"
                              style={{ color: formData.textColor || "#ffffff" }}
                            >
                              {formData.title || "25% OFF NEW SEASON"}
                            </h3>
                            {formData.subtitle && (
                              <p
                                className="mt-1 text-xs uppercase tracking-widest font-medium"
                                style={{ color: formData.textColor || "#ffffff" }}
                              >
                                {formData.subtitle}
                              </p>
                            )}
                            {formData.buttonText && (
                              <div className="mt-3">
                                <span className="inline-block bg-white text-stone-900 px-5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded shadow">
                                  {formData.buttonText}
                                </span>
                              </div>
                            )}
                            {formData.finePrint && (
                              <p
                                className="mt-3 text-[10px] opacity-90 max-w-md mx-auto"
                                style={{ color: formData.textColor || "#ffffff" }}
                              >
                                {formData.finePrint}
                              </p>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-white/80 py-6">
                            [Text hidden — Only media is displayed]
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ----------------- STANDARD BANNER CONTROLS ----------------- */
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Banner title"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                      <input
                        type="text"
                        value={formData.subtitle}
                        onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Banner subtitle"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Banner description"
                    />
                  </div>

                  {/* Image Upload Section */}
                  <div>
                    <ImageUpload
                      onImageUpload={handleImageUpload}
                      currentImage={formData.image}
                      label="Banner Image (WebP only)"
                      isBanner={true}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                      <input
                        type="text"
                        value={formData.buttonText}
                        onChange={(e) => setFormData({ ...formData, buttonText: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Shop Now"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Button Link</label>
                      <input
                        type="text"
                        value={formData.buttonLink}
                        onChange={(e) => setFormData({ ...formData, buttonLink: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="shop (without language prefix)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Banner Device</label>
                      <select
                        value={formData.deviceType}
                        onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="desktop">Desktop</option>
                        <option value="mobile">Mobile</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Direct Link <span className="text-gray-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.link}
                      onChange={(e) =>
                        setFormData({ ...formData, link: e.target.value, buttonLink: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="shop (without language prefix)"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Enter the path WITHOUT language prefix. Examples: shop, shop/dresses, shop/abayas-and-modest-wear
                    </p>
                  </div>
                </div>
              )}

              {/* COMMON SETTINGS: Target Countries & Device */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until (Optional)</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Target Countries Selection */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-800">🌍 Target Countries</label>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, targetCountries: ["ALL"] })}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      Select All
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Choose "All Countries" to show this banner globally, or check one or more specific countries.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className={`inline-flex items-center px-3 py-1.5 rounded-full cursor-pointer text-xs font-semibold border transition-all ${
                      formData.targetCountries.includes("ALL")
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={formData.targetCountries.includes("ALL")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, targetCountries: ["ALL"] })
                        } else {
                          setFormData({
                            ...formData,
                            targetCountries: [availableCountries[0]?.code || "AE"],
                          })
                        }
                      }}
                    />
                    🌐 All Countries
                  </label>

                  {availableCountries.map((country) => {
                    const isChecked =
                      !formData.targetCountries.includes("ALL") &&
                      formData.targetCountries.includes(country.code)

                    return (
                      <label
                        key={country.code}
                        className={`inline-flex items-center px-3 py-1.5 rounded-full cursor-pointer text-xs font-medium border transition-all ${
                          isChecked
                            ? "bg-indigo-100 text-indigo-800 border-indigo-400 font-semibold shadow-sm"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mr-1.5 h-3.5 w-3.5 text-blue-600 rounded"
                          checked={isChecked}
                          onChange={(e) => {
                            let current = formData.targetCountries.filter((c) => c !== "ALL")
                            if (e.target.checked) {
                              current.push(country.code)
                            } else {
                              current = current.filter((c) => c !== country.code)
                            }
                            if (current.length === 0 || current.length === availableCountries.length) {
                              setFormData({ ...formData, targetCountries: ["ALL"] })
                            } else {
                              setFormData({ ...formData, targetCountries: current })
                            }
                          }}
                        />
                        {country.name} ({country.code})
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-gray-700 font-medium">
                  Active (Display on website)
                </label>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-sm transition"
                >
                  {editingBanner ? "Update Banner" : "Create Banner"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* BANNERS LIST TABLE */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Banner Preview / Details
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Position
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Section
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Countries
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {banners.length > 0 ? (
                    banners.map((banner) => (
                      <tr key={banner._id} className="hover:bg-gray-50/80 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="h-14 w-24 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex items-center justify-center">
                              {banner.position === "hero" ? (
                                banner.mediaType === "video" && banner.video ? (
                                  <div className="relative w-full h-full bg-black flex items-center justify-center">
                                    <video
                                      src={getFullImageUrl(banner.video)}
                                      className="w-full h-full object-cover"
                                      muted
                                    />
                                    <span className="absolute bottom-1 right-1 text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">
                                      VIDEO
                                    </span>
                                  </div>
                                ) : banner.mediaType === "image" && banner.image ? (
                                  <img
                                    src={getFullImageUrl(banner.image) || "/placeholder.svg"}
                                    alt={banner.title}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      e.target.src = "/placeholder.svg"
                                    }}
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex flex-col items-center justify-center text-white text-[10px] font-bold shadow-inner"
                                    style={{ backgroundColor: banner.backgroundColor || "#8b5e34" }}
                                  >
                                    <span>COLOR</span>
                                    <span className="text-[9px] font-mono opacity-80">
                                      {banner.backgroundColor || "#8b5e34"}
                                    </span>
                                  </div>
                                )
                              ) : (
                                <img
                                  src={getFullImageUrl(banner.image) || "/placeholder.svg"}
                                  alt={banner.title}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.target.src = "/placeholder.svg"
                                  }}
                                />
                              )}
                            </div>
                            <div className="ml-4 max-w-sm">
                              <div className="text-sm font-bold text-gray-900">{banner.title}</div>
                              {banner.subtitle && (
                                <div className="text-xs text-gray-500 mt-0.5">{banner.subtitle}</div>
                              )}
                              {banner.finePrint && (
                                <div className="text-[11px] text-gray-400 truncate mt-0.5" title={banner.finePrint}>
                                  {banner.finePrint}
                                </div>
                              )}
                              {banner.discount && (
                                <div className="text-xs font-semibold text-green-600 mt-0.5">
                                  {banner.discount}% OFF
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              banner.position === "hero"
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : (banner.deviceType || "desktop").toLowerCase() === "desktop"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {banner.position === "hero"
                              ? "🌟 Top Hero Section"
                              : positions.find((p) => p.value === banner.position)?.label ||
                                (banner.position?.includes("sale")
                                  ? "Sale Section – Bottom Image"
                                  : "25% Off New Season – Bottom Image")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {banner.section ? (
                            <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                              {banner.section}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              (banner.deviceType || "desktop").toLowerCase() === "desktop"
                                ? "bg-green-100 text-green-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {banner.deviceType || "desktop"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {!banner.targetCountries ||
                            banner.targetCountries.length === 0 ||
                            banner.targetCountries.includes("ALL") ? (
                              <span className="px-2 py-0.5 inline-flex text-xs font-semibold rounded bg-sky-100 text-sky-800">
                                🌐 All Countries
                              </span>
                            ) : (
                              banner.targetCountries.map((code) => (
                                <span
                                  key={code}
                                  className="px-2 py-0.5 inline-flex text-xs font-semibold rounded bg-indigo-100 text-indigo-800 border border-indigo-200"
                                >
                                  {code}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(banner)}
                            className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full cursor-pointer transition shadow-sm hover:opacity-85 ${
                              banner.isActive && (!banner.validUntil || new Date(banner.validUntil) >= new Date())
                                ? "bg-green-100 text-green-800 border border-green-300 hover:bg-green-200"
                                : "bg-red-100 text-red-800 border border-red-300 hover:bg-red-200"
                            }`}
                            title="Click to toggle Active / Inactive"
                          >
                            {banner.isActive && (!banner.validUntil || new Date(banner.validUntil) >= new Date()) ? (
                              <>
                                <Eye className="h-3.5 w-3.5 mr-1 text-green-600" />
                                Active
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3.5 w-3.5 mr-1 text-red-600" />
                                Inactive
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEdit(banner)}
                            className="text-blue-600 hover:text-blue-900 mr-4 transition"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(banner._id)}
                            className="text-red-600 hover:text-red-900 transition"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                        No banners found
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

export default AdminBanners
