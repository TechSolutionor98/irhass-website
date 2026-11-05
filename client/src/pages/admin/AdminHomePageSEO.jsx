"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { Save, RefreshCw, Globe, Sparkles, FileText, Code, Share2 } from "lucide-react"
import { useToast } from "../../context/ToastContext"
import TipTapEditor from "../../components/TipTapEditor"
import config from "../../config/config"
import { getSeoUnlockTokenIfValid, isSeoUnlockTokenValid } from "../../utils/seoUnlock"

const ROBOTS_OPTIONS = ["index, follow", "noindex, follow", "index, nofollow", "noindex, nofollow"]

// An empty country code is the default record every country falls back to.
const DEFAULT_COUNTRY = ""

const AdminHomePageSEO = () => {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isSeoUnlocked, setIsSeoUnlocked] = useState(isSeoUnlockTokenValid)

  // Which country's home-page SEO is being edited, and what it inherits when blank.
  const [countries, setCountries] = useState([])
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY)
  const [inherited, setInherited] = useState(null)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    keywords: "",
    canonicalUrl: "/",
    robots: "index, follow",
    customSchema: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    seoContent: "",
  })

  const getAuthHeaders = () => {
    const token = localStorage.getItem("adminToken")
    const seoUnlockToken = getSeoUnlockTokenIfValid()
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(seoUnlockToken ? { "X-SEO-Unlock-Token": seoUnlockToken } : {}),
    }
  }

  useEffect(() => {
    const syncLockState = () => setIsSeoUnlocked(isSeoUnlockTokenValid())
    syncLockState()
    window.addEventListener("storage", syncLockState)
    const interval = setInterval(syncLockState, 5000)
    return () => {
      window.removeEventListener("storage", syncLockState)
      clearInterval(interval)
    }
  }, [])

  // The country list drives the tabs. A failure here is not fatal -- the default record
  // can still be edited.
  useEffect(() => {
    axios
      .get(`${config.API_URL}/api/countries/public`)
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data?.countries || []
        setCountries(list.filter((c) => c && c.code))
      })
      .catch(() => setCountries([]))
  }, [])

  // The admin endpoint returns this country's own values raw (blank = inherits) plus the
  // values it would inherit. The public one merges them, which would bake the defaults
  // into the country row on save.
  const fetchHomePageSEO = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${config.API_URL}/api/seo-pages/static`, {
        headers: getAuthHeaders(),
        params: { country: countryCode || undefined },
      })
      const entry = (data?.staticPages || []).find((page) => page.pageKey === "home")
      const seo = entry?.seo || {}
      setInherited(entry?.inheritedSeo || null)
      setFormData({
        title: seo.title || "",
        description: seo.description || "",
        keywords: seo.keywords || "",
        canonicalUrl: seo.canonicalUrl || (countryCode ? "" : "/"),
        robots: seo.robots || "index, follow",
        customSchema: seo.customSchema || "",
        ogTitle: seo.ogTitle || "",
        ogDescription: seo.ogDescription || "",
        ogImage: seo.ogImage || "",
        seoContent: seo.seoContent || "",
      })
    } catch (error) {
      console.error("Error fetching home page SEO:", error)
      showToast("Failed to load Home Page SEO settings", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHomePageSEO()
    // Switching country reloads that country's record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  // While editing a country, show what an empty field would inherit from the default.
  const placeholderFor = (field, fallback) => {
    const value = countryCode ? inherited?.[field] : ""
    return value ? `Inherits: ${value}` : fallback
  }

  const handleEditorChange = (newContent) => {
    setFormData((prev) => ({
      ...prev,
      seoContent: newContent,
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!isSeoUnlocked) {
      showToast("SEO settings are locked. Please click Unlock Potential in the sidebar.", "error")
      return
    }

    try {
      setSaving(true)
      await axios.put(
        `${config.API_URL}/api/seo-pages/static/home`,
        formData,
        { headers: getAuthHeaders(), params: { country: countryCode || undefined } }
      )
      const label = countryCode
        ? countries.find((c) => c.code === countryCode)?.name || countryCode
        : "all countries"
      showToast(`Home Page SEO saved for ${label}!`, "success")
    } catch (error) {
      console.error("Error saving home page SEO:", error)
      showToast(error.response?.data?.message || "Failed to save Home Page SEO settings", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ml-64 mt-16 p-6 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-8 h-8 text-lime-600" />
              Home Page SEO
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage metadata &amp; rich SEO content for each country's home page.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchHomePageSEO}
              disabled={loading || saving}
              className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Reload
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving || !isSeoUnlocked}
              className="px-6 py-2.5 bg-lime-600 hover:bg-lime-700 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Country tabs — one home-page SEO record per country, plus a default that any
            country without its own record inherits. */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Country</h2>
            <span className="text-xs text-slate-500">
              Editing {countryCode ? `the ${countryCode} home page` : "the default used by every country"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCountryCode(DEFAULT_COUNTRY)}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition disabled:opacity-50 ${
                countryCode === DEFAULT_COUNTRY
                  ? "bg-lime-600 text-white border-lime-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Default (all countries)
            </button>
            {countries.map((country) => (
              <button
                key={country.code}
                type="button"
                onClick={() => setCountryCode(country.code)}
                disabled={saving}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition disabled:opacity-50 ${
                  countryCode === country.code
                    ? "bg-lime-600 text-white border-lime-600"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {country.name} ({country.code})
              </button>
            ))}
          </div>
          {countryCode && (
            <p className="mt-3 text-xs text-slate-500">
              Leave a field empty to inherit it from the default record. Anything you fill in here
              is used only on <span className="font-semibold">/{countryCode.toLowerCase()}-en</span> and{" "}
              <span className="font-semibold">/{countryCode.toLowerCase()}-ar</span>.
            </p>
          )}
        </div>

        {!isSeoUnlocked && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 flex items-center justify-between">
            <div>
              <strong>SEO Locked:</strong> Please click <strong>Unlock Potential</strong> in the left sidebar to enable editing and saving SEO content.
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-lime-600"></div>
          </div>
        ) : (
          <div className="space-y-6">

            {/* 1. TipTap Editor Section - Home Page SEO Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-lime-600" />
                  <h2 className="text-lg font-bold text-slate-900">Home Page SEO Content (Above Footer)</h2>
                </div>
                <span className="text-xs bg-lime-100 text-lime-800 font-semibold px-2.5 py-1 rounded-full">
                  TipTap Editor Enabled
                </span>
              </div>
              <p className="text-sm text-slate-600">
                This rich content will be rendered prominently above the home page footer for SEO optimization and customer information.
              </p>

              <div className="mt-2 min-h-[350px]">
                <TipTapEditor
                  content={formData.seoContent}
                  onChange={handleEditorChange}
                  placeholder="Type or paste your rich SEO content here (headings, paragraphs, internal links, formatted text)..."
                />
              </div>
            </div>

            {/* 2. Metadata Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Meta Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    disabled={!isSeoUnlocked}
                    placeholder={placeholderFor("title", "e.g., Buy Laptops & Electronics Online in UAE | Irhaas")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-lime-500 focus:border-lime-500 disabled:bg-slate-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Meta Description
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                    disabled={!isSeoUnlocked}
                    placeholder={placeholderFor("description", "Enter meta description for search engines...")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-lime-500 focus:border-lime-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Keywords
                  </label>
                  <input
                    type="text"
                    name="keywords"
                    value={formData.keywords}
                    onChange={handleInputChange}
                    disabled={!isSeoUnlocked}
                    placeholder={placeholderFor("keywords", "laptops, electronics, gaming pc, dubai online shop")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-lime-500 focus:border-lime-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Canonical URL
                  </label>
                  <input
                    type="text"
                    name="canonicalUrl"
                    value={formData.canonicalUrl}
                    onChange={handleInputChange}
                    disabled={!isSeoUnlocked}
                    placeholder="/"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-lime-500 focus:border-lime-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Robots Directive
                  </label>
                  <select
                    name="robots"
                    value={formData.robots}
                    onChange={handleInputChange}
                    disabled={!isSeoUnlocked}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-lime-500 focus:border-lime-500 disabled:bg-slate-100"
                  >
                    {ROBOTS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Open Graph (Social Sharing) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Share2 className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-bold text-slate-900">Open Graph (Social Media)</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    OG Title
                  </label>
                  <input
                    type="text"
                    name="ogTitle"
                    value={formData.ogTitle}
                    onChange={handleInputChange}
                    disabled={!isSeoUnlocked}
                    placeholder={placeholderFor("ogTitle", "Title for Facebook, Twitter, WhatsApp sharing")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-lime-500 focus:border-lime-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    OG Image URL
                  </label>
                  <input
                    type="text"
                    name="ogImage"
                    value={formData.ogImage}
                    onChange={handleInputChange}
                    disabled={!isSeoUnlocked}
                    placeholder={placeholderFor("ogImage", "https://www.irhaas.com/banner.jpg")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-lime-500 focus:border-lime-500 disabled:bg-slate-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    OG Description
                  </label>
                  <textarea
                    name="ogDescription"
                    rows={2}
                    value={formData.ogDescription}
                    onChange={handleInputChange}
                    disabled={!isSeoUnlocked}
                    placeholder={placeholderFor("ogDescription", "Description for social cards...")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-lime-500 focus:border-lime-500 disabled:bg-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* 4. Custom JSON-LD Schema */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Code className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-bold text-slate-900">Custom JSON-LD Schema</h2>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Structured Data (JSON-LD script)
                </label>
                <textarea
                  name="customSchema"
                  rows={4}
                  value={formData.customSchema}
                  onChange={handleInputChange}
                  disabled={!isSeoUnlocked}
                  placeholder='{"@context": "https://schema.org", "@type": "WebSite", "name": "Irhaas"}'
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-lime-500 focus:border-lime-500 disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Submit Button Bar */}
            <div className="flex justify-end pt-2 pb-12">
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || saving || !isSeoUnlocked}
                className="px-6 py-3 bg-lime-600 hover:bg-lime-700 text-white text-base font-semibold rounded-xl shadow transition flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? "Saving Changes..." : "Save Home Page SEO"}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

export default AdminHomePageSEO
