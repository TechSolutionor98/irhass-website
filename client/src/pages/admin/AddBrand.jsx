"use client"

import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useToast } from "../../context/ToastContext"
import AdminSidebar from "../../components/admin/AdminSidebar"
import ImageUpload from "../../components/ImageUpload"
import { ArrowLeft } from "lucide-react"
import axios from "axios"
import { isSeoUnlockTokenValid } from "../../utils/seoUnlock"

import config from "../../config/config"
const REQUEST_TIMEOUT_MS = 30000
const ROBOTS_OPTIONS = ["index, follow", "noindex, follow", "index, nofollow", "noindex, nofollow"]
const BRAND_SEO_FIELDS = [
  "metaTitle",
  "metaDescription",
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "seoCanonicalUrl",
  "seoRobots",
  "customSchema",
  "ogTitle",
  "ogDescription",
  "ogImage",
]

const AddBrand = () => {
  const navigate = useNavigate()
  const { id } = useParams() // id for edit mode
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [isSeoUnlocked, setIsSeoUnlocked] = useState(isSeoUnlockTokenValid())
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    logo: "",
    website: "",
    metaTitle: "",
    metaDescription: "",
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    seoCanonicalUrl: "",
    seoRobots: "index, follow",
    customSchema: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    isActive: true,
  })
  const [isEdit, setIsEdit] = useState(false)

  useEffect(() => {
    if (id) {
      setIsEdit(true)
      fetchBrand(id)
    } else {
      setIsEdit(false)
      setFormData({
        name: "",
        description: "",
        logo: "",
        website: "",
        metaTitle: "",
        metaDescription: "",
        seoTitle: "",
        seoDescription: "",
        seoKeywords: "",
        seoCanonicalUrl: "",
        seoRobots: "index, follow",
        customSchema: "",
        ogTitle: "",
        ogDescription: "",
        ogImage: "",
        isActive: true,
      })
    }
  }, [id])

  useEffect(() => {
    const syncSeoLockState = () => setIsSeoUnlocked(isSeoUnlockTokenValid())
    syncSeoLockState()
    const intervalId = window.setInterval(syncSeoLockState, 1000)
    window.addEventListener("storage", syncSeoLockState)
    window.addEventListener("focus", syncSeoLockState)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("storage", syncSeoLockState)
      window.removeEventListener("focus", syncSeoLockState)
    }
  }, [])

  const fetchBrand = async (brandId) => {
    setLoading(true)
    try {
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/brands/${brandId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setFormData({
        name: data.name || "",
        description: data.description || "",
        logo: data.logo || "",
        website: data.website || "",
        metaTitle: data.metaTitle || "",
        metaDescription: data.metaDescription || "",
        seoTitle: data.seoTitle || "",
        seoDescription: data.seoDescription || "",
        seoKeywords: data.seoKeywords || "",
        seoCanonicalUrl: data.seoCanonicalUrl || "",
        seoRobots: data.seoRobots || "index, follow",
        customSchema: data.customSchema || "",
        ogTitle: data.ogTitle || "",
        ogDescription: data.ogDescription || "",
        ogImage: data.ogImage || "",
        isActive: data.isActive !== undefined ? data.isActive : true,
      })
    } catch (error) {
      showToast("Failed to load brand for editing", "error")
      navigate("/admin/brands")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleLogoUpload = (imageUrl) => {
    setFormData((prev) => ({
      ...prev,
      logo: imageUrl,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = localStorage.getItem("adminToken")
      const submitData = { ...formData }
      if (!isSeoUnlocked) {
        BRAND_SEO_FIELDS.forEach((field) => {
          delete submitData[field]
        })
      }

      if (isEdit && id) {
        await axios.put(`${config.API_URL}/api/brands/${id}`, submitData, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          timeout: REQUEST_TIMEOUT_MS,
        })
        showToast("Brand updated successfully!", "success")
      } else {
        await axios.post(`${config.API_URL}/api/brands`, submitData, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          timeout: REQUEST_TIMEOUT_MS,
        })
        showToast("Brand added successfully!", "success")
      }
      navigate("/admin/brands")
    } catch (error) {
      const isTimeout = error.code === "ECONNABORTED" || error.response?.status === 504
      if (isTimeout) {
        showToast("Request timed out. Please try again in a few seconds.", "error")
      } else {
        showToast(error.response?.data?.message || "Failed to save brand", "error")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 ml-64 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <button onClick={() => navigate("/admin/brands")} className="hover:text-blue-600 flex items-center gap-1">
                <ArrowLeft size={16} />
                Brands
              </button>
              <span>/</span>
              <span className="text-gray-900">{isEdit ? "Edit Brand" : "Add Brand"}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{isEdit ? "Edit Brand" : "Add New Brand"}</h1>
          </div>
          {/* Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter brand description..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand Logo (WebP only)</label>
                <ImageUpload onImageUpload={handleLogoUpload} currentImage={formData.logo} label="Brand Logo" isProduct={true} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website URL</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">SEO Settings</h2>
                {!isSeoUnlocked && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
                    SEO fields are locked. Use Unlock Potential from the sidebar.
                  </p>
                )}

                <div className={`space-y-4 ${isSeoUnlocked ? "" : "pointer-events-none opacity-60"}`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Meta Title</label>
                    <input
                      type="text"
                      name="metaTitle"
                      value={formData.metaTitle}
                      onChange={handleChange}
                      maxLength={180}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">{formData.metaTitle.length}/180</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Meta Description</label>
                    <textarea
                      name="metaDescription"
                      value={formData.metaDescription}
                      onChange={handleChange}
                      rows={3}
                      maxLength={300}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">{formData.metaDescription.length}/300</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SEO Title</label>
                    <input
                      type="text"
                      name="seoTitle"
                      value={formData.seoTitle}
                      onChange={handleChange}
                      maxLength={180}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">{formData.seoTitle.length}/180</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SEO Description</label>
                    <textarea
                      name="seoDescription"
                      value={formData.seoDescription}
                      onChange={handleChange}
                      rows={3}
                      maxLength={300}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">{formData.seoDescription.length}/300</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SEO Keywords</label>
                    <input
                      type="text"
                      name="seoKeywords"
                      value={formData.seoKeywords}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="keyword1, keyword2, keyword3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Canonical URL</label>
                    <input
                      type="text"
                      name="seoCanonicalUrl"
                      value={formData.seoCanonicalUrl}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="/brands/apple or https://www.irhaas.com/brands/apple"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Robots</label>
                    <select
                      name="seoRobots"
                      value={formData.seoRobots}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ROBOTS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Open Graph Title</label>
                    <input
                      type="text"
                      name="ogTitle"
                      value={formData.ogTitle}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Open Graph Description</label>
                    <textarea
                      name="ogDescription"
                      value={formData.ogDescription}
                      onChange={handleChange}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Open Graph Image URL</label>
                    <input
                      type="text"
                      name="ogImage"
                      value={formData.ogImage}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custom Schema (JSON-LD / script)</label>
                    <textarea
                      name="customSchema"
                      value={formData.customSchema}
                      onChange={handleChange}
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                      placeholder='{"@context":"https://schema.org","@type":"Brand","name":"Brand Name"}'
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">Active Brand</label>
              </div>
              <div className="flex justify-end gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => navigate("/admin/brands")}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save Changes" : "Add Brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddBrand
