"use client"

import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import axios from "axios"
import { Search, Save, RefreshCw, ArrowLeftRight, Settings2 } from "lucide-react"
import { useToast } from "../../context/ToastContext"
import config from "../../config/config"
import { getSeoUnlockTokenIfValid, isSeoUnlockTokenValid } from "../../utils/seoUnlock"

const ROBOTS_OPTIONS = ["index, follow", "noindex, follow", "index, nofollow", "noindex, nofollow"]

const EMPTY_FORM = {
  title: "",
  description: "",
  keywords: "",
  canonicalUrl: "",
  robots: "index, follow",
  customSchema: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  seoContent: "",
}

const AdminPageSEOManager = () => {
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState("static")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [staticPages, setStaticPages] = useState([])
  const [dynamicItems, setDynamicItems] = useState([])
  const [availableEntities, setAvailableEntities] = useState([])

  const [dynamicEntityType, setDynamicEntityType] = useState("product")
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0, limit: 20 })

  const [selectedItem, setSelectedItem] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [isSeoUnlocked, setIsSeoUnlocked] = useState(isSeoUnlockTokenValid)

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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearchTerm(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  const fetchStaticPages = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${config.API_URL}/api/seo-pages/static`, {
        headers: getAuthHeaders(),
      })

      const pages = Array.isArray(response.data?.staticPages) ? response.data.staticPages : []
      setStaticPages(pages)

      if (activeTab === "static") {
        if (!selectedItem && pages.length > 0) {
          selectStaticItem(pages[0])
        } else if (selectedItem?.pageKey) {
          const refreshed = pages.find((item) => item.pageKey === selectedItem.pageKey)
          if (refreshed) selectStaticItem(refreshed)
        }
      }
    } catch (error) {
      console.error("Error fetching static SEO pages:", error)
      showToast(error.response?.data?.message || "Failed to fetch static SEO pages", "error")
    } finally {
      setLoading(false)
    }
  }

  const fetchDynamicItems = async () => {
    try {
      setLoading(true)

      const params = {
        entityType: dynamicEntityType,
        page,
        limit: 20,
      }
      if (searchTerm) {
        params.search = searchTerm
      }

      const response = await axios.get(`${config.API_URL}/api/seo-pages/dynamic`, {
        params,
        headers: getAuthHeaders(),
      })

      const items = Array.isArray(response.data?.items) ? response.data.items : []
      const entities = Array.isArray(response.data?.availableEntities) ? response.data.availableEntities : []

      setDynamicItems(items)
      setAvailableEntities(entities)
      setPagination(response.data?.pagination || { page: 1, totalPages: 0, total: 0, limit: 20 })

      if (activeTab === "dynamic") {
        if (!selectedItem && items.length > 0) {
          selectDynamicItem(items[0])
        } else if (selectedItem?.id) {
          const refreshed = items.find((item) => item.id === selectedItem.id && item.entityType === selectedItem.entityType)
          if (refreshed) selectDynamicItem(refreshed)
        }
      }
    } catch (error) {
      console.error("Error fetching dynamic SEO items:", error)
      showToast(error.response?.data?.message || "Failed to fetch dynamic SEO records", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "static") {
      fetchStaticPages()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === "dynamic") {
      fetchDynamicItems()
    }
  }, [activeTab, dynamicEntityType, page, searchTerm])

  const prepareFormData = (seo = {}) => ({
    title: seo.title || "",
    description: seo.description || "",
    keywords: seo.keywords || "",
    canonicalUrl: seo.canonicalUrl || "",
    robots: seo.robots || "index, follow",
    customSchema: seo.customSchema || "",
    ogTitle: seo.ogTitle || "",
    ogDescription: seo.ogDescription || "",
    ogImage: seo.ogImage || "",
    seoContent: seo.seoContent || "",
  })

  const selectStaticItem = (item) => {
    setSelectedItem({ ...item, mode: "static" })
    setFormData(prepareFormData(item.seo))
  }

  const selectDynamicItem = (item) => {
    setSelectedItem({ ...item, mode: "dynamic" })
    setFormData(prepareFormData(item.seo))
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const supportsField = (field) => {
    if (!selectedItem) return false
    if (!selectedItem.supports) return true
    return Boolean(selectedItem.supports[field])
  }

  const handleSave = async () => {
    if (!selectedItem) {
      showToast("Select a page first", "error")
      return
    }
    if (!isSeoUnlocked) {
      showToast("SEO settings are locked. Click Unlock Potential first.", "error")
      return
    }

    try {
      setSaving(true)
      let response

      if (selectedItem.mode === "static") {
        response = await axios.put(`${config.API_URL}/api/seo-pages/static/${selectedItem.pageKey}`, formData, {
          headers: getAuthHeaders(),
        })

        const updated = response.data
        setStaticPages((prev) =>
          prev.map((item) =>
            item.pageKey === updated.pageKey
              ? {
                  ...item,
                  seo: updated.seo,
                  updatedAt: updated.updatedAt,
                }
              : item,
          ),
        )

        setSelectedItem((prev) =>
          prev
            ? {
                ...prev,
                seo: updated.seo,
                updatedAt: updated.updatedAt,
              }
            : prev,
        )
      } else {
        response = await axios.put(
          `${config.API_URL}/api/seo-pages/dynamic/${selectedItem.entityType}/${selectedItem.id}`,
          formData,
          {
            headers: getAuthHeaders(),
          },
        )

        const updated = response.data
        setDynamicItems((prev) =>
          prev.map((item) =>
            item.id === updated.id && item.entityType === updated.entityType
              ? {
                  ...item,
                  seo: updated.seo,
                  updatedAt: updated.updatedAt,
                }
              : item,
          ),
        )

        setSelectedItem((prev) =>
          prev
            ? {
                ...prev,
                seo: updated.seo,
                updatedAt: updated.updatedAt,
              }
            : prev,
        )
      }

      showToast("SEO settings updated successfully", "success")
    } catch (error) {
      console.error("Error updating SEO settings:", error)
      showToast(error.response?.data?.message || "Failed to update SEO settings", "error")
    } finally {
      setSaving(false)
    }
  }

  const entityCounts = useMemo(() => {
    const map = {}
    availableEntities.forEach((entity) => {
      map[entity.entityType] = entity.total
    })
    return map
  }, [availableEntities])

  const list = activeTab === "static" ? staticPages : dynamicItems

  return (
    <div className="ml-64 mt-16 p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Page SEO Manager</h1>
            <p className="text-sm text-gray-600 mt-1">Manage SEO for static and dynamic pages from one place.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/seo-settings/redirects"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-sm"
            >
              <ArrowLeftRight size={16} />
              Redirects
            </Link>
            <button
              type="button"
              onClick={() => {
                if (activeTab === "static") {
                  fetchStaticPages()
                } else {
                  fetchDynamicItems()
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-sm"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-2 mb-4 inline-flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("static")
              setSelectedItem(null)
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === "static" ? "bg-lime-500 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Static Pages ({staticPages.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("dynamic")
              setSelectedItem(null)
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === "dynamic" ? "bg-lime-500 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Dynamic Pages
          </button>
        </div>

        {activeTab === "dynamic" && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
              <select
                value={dynamicEntityType}
                onChange={(e) => {
                  setDynamicEntityType(e.target.value)
                  setSelectedItem(null)
                  setPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {availableEntities.length === 0 ? (
                  <option value={dynamicEntityType}>{dynamicEntityType}</option>
                ) : (
                  availableEntities.map((entity) => (
                    <option key={entity.entityType} value={entity.entityType}>
                      {entity.label} ({entityCounts[entity.entityType] || 0})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search by Name / Slug</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search dynamic pages..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">Pages</h2>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-gray-500">Loading...</div>
            ) : list.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">No pages found</div>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto">
                {list.map((item) => {
                  const isSelected =
                    selectedItem &&
                    ((activeTab === "static" && selectedItem.pageKey === item.pageKey) ||
                      (activeTab === "dynamic" && selectedItem.id === item.id && selectedItem.entityType === item.entityType))

                  return (
                    <button
                      key={activeTab === "static" ? item.pageKey : `${item.entityType}-${item.id}`}
                      onClick={() => (activeTab === "static" ? selectStaticItem(item) : selectDynamicItem(item))}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition ${
                        isSelected ? "bg-lime-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-gray-900 truncate">{item.pageName}</div>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 whitespace-nowrap">
                          {activeTab === "static" ? "Static" : item.entityLabel}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 font-mono truncate">{item.routePath || "(no route)"}</div>
                    </button>
                  )
                })}
              </div>
            )}

            {activeTab === "dynamic" && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 text-sm rounded border border-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          <div className="xl:col-span-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">SEO Settings</h2>
                {selectedItem && (
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedItem.pageName} ({selectedItem.routePath || "no route"})
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={!selectedItem || saving || !isSeoUnlocked}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-lime-500 text-white text-sm font-medium hover:bg-lime-600 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save SEO"}
              </button>
            </div>

            {!selectedItem ? (
              <div className="p-6 text-sm text-gray-500">Select a page from the left to edit SEO settings.</div>
            ) : (
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {!isSeoUnlocked && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    SEO is locked. Use <strong>Unlock Potential</strong> from sidebar to edit and save.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SEO Title</label>
                    <input
                      name="title"
                      value={formData.title}
                      onChange={handleFormChange}
                      disabled={!supportsField("title") || !isSeoUnlocked}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Canonical URL</label>
                    <input
                      name="canonicalUrl"
                      value={formData.canonicalUrl}
                      onChange={handleFormChange}
                      disabled={!supportsField("canonicalUrl") || !isSeoUnlocked}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      placeholder="/about or https://www.example.com/about"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SEO Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    disabled={!supportsField("description") || !isSeoUnlocked}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                    <input
                      name="keywords"
                      value={formData.keywords}
                      onChange={handleFormChange}
                      disabled={!supportsField("keywords") || !isSeoUnlocked}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Robots</label>
                    <select
                      name="robots"
                      value={formData.robots}
                      onChange={handleFormChange}
                      disabled={!supportsField("robots") || !isSeoUnlocked}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                    >
                      {ROBOTS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {supportsField("seoContent") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SEO Content (Visible Content)</label>
                    <textarea
                      name="seoContent"
                      value={formData.seoContent}
                      onChange={handleFormChange}
                      disabled={!isSeoUnlocked}
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                      placeholder="This field is used on category/subcategory pages."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Open Graph Title</label>
                  <input
                    name="ogTitle"
                    value={formData.ogTitle}
                    onChange={handleFormChange}
                      disabled={!supportsField("ogTitle") || !isSeoUnlocked}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Open Graph Description</label>
                  <textarea
                    name="ogDescription"
                    value={formData.ogDescription}
                    onChange={handleFormChange}
                    disabled={!supportsField("ogDescription") || !isSeoUnlocked}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Open Graph Image URL</label>
                  <input
                    name="ogImage"
                    value={formData.ogImage}
                    onChange={handleFormChange}
                    disabled={!supportsField("ogImage") || !isSeoUnlocked}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Settings2 size={14} />
                    Custom Schema (JSON-LD / script)
                  </label>
                  <textarea
                    name="customSchema"
                    value={formData.customSchema}
                    onChange={handleFormChange}
                    disabled={!supportsField("customSchema") || !isSeoUnlocked}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-xs disabled:bg-gray-100"
                    placeholder='{"@context":"https://schema.org","@type":"WebPage","name":"Page Name"}'
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPageSEOManager
