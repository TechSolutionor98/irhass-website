"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Smartphone,
  Calendar,
  Layers,
} from "lucide-react"
import AdminSidebar from "../../components/admin/AdminSidebar"
import config from "../../config/config"

const PopupSettings = () => {
  const navigate = useNavigate()

  const [popups, setPopups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const token = localStorage.getItem("adminToken")

  const fetchPopups = async () => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/popup-settings/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setPopups(Array.isArray(data) ? data : [])
    } catch {
      setError("Failed to load popups.")
    }
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await fetchPopups()
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeletePopup = async (id) => {
    if (!window.confirm("Are you sure you want to delete this popup config?")) return
    try {
      await axios.delete(`${config.API_URL}/api/popup-settings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      await fetchPopups()
    } catch {
      setError("Failed to delete popup.")
    }
  }

  const getStatusBadge = (item) => {
    if (!item.isEnabled) {
      return (
        <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-red-100 text-red-800">
          <EyeOff className="h-3 w-3 mr-1 mt-0.5" /> Disabled
        </span>
      )
    }
    return (
      <span className="px-2 py-1 inline-flex text-xs font-semibold rounded-full bg-green-100 text-green-800">
        <Eye className="h-3 w-3 mr-1 mt-0.5" /> Enabled
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/admin/app-discount-settings")}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
            >
              <ArrowLeft size={18} />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Smartphone size={22} className="text-lime-600" />
                Promo Popups Settings
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage and display multiple App Download Popups on target pages.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate("/admin/app-discount-settings/popup-settings/add")}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-lime-500 text-white font-medium hover:bg-lime-600 transition-colors shadow-sm text-sm"
          >
            <Plus size={16} />
            Add Popup
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-lime-500" />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Popup Name
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Display Target Pages
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Frequency
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Banner Image
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {popups.length > 0 ? (
                    popups.map((item) => (
                      <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4">
                          <div>
                            <div className="font-semibold text-gray-900 text-sm">
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-400 font-mono mt-0.5">
                              {item.sectionTitle}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(item.showOnPages) && item.showOnPages.length > 0 ? (
                              item.showOnPages.map((page, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-100 capitalize"
                                >
                                  {page}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2 border-t border-gray-100 pt-1.5">
                            {Array.isArray(item.platforms) && item.platforms.length > 0 ? (
                              item.platforms.map((plat, index) => (
                                <span
                                  key={index}
                                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                    plat === "web"
                                      ? "bg-blue-50 text-blue-600 border border-blue-100"
                                      : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                  } uppercase`}
                                >
                                  {plat}
                                </span>
                              ))
                            ) : (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-50 text-gray-500 border border-gray-100 uppercase">
                                WEB & APP
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-gray-700">
                          {item.showLimit === "always" ? (
                            <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                              Show Always
                            </span>
                          ) : (
                            <span className="text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                              Once per session
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {item.leftImageUrl ? (
                            <div className="w-16 h-10 rounded border overflow-hidden bg-gray-50">
                              <img
                                src={
                                  item.leftImageUrl.startsWith("http")
                                    ? item.leftImageUrl
                                    : `${config.API_URL}${item.leftImageUrl}`
                                }
                                alt="banner thumbnail"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No image</span>
                          )}
                        </td>
                        <td className="px-5 py-4">{getStatusBadge(item)}</td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              className="text-blue-500 hover:text-blue-700 transition-colors"
                              onClick={() =>
                                navigate(`/admin/app-discount-settings/popup-settings/edit/${item._id}`)
                              }
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              className="text-red-500 hover:text-red-700 transition-colors"
                              onClick={() => handleDeletePopup(item._id)}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                        No popups configured.{" "}
                        <button
                          className="text-lime-600 font-medium hover:underline"
                          onClick={() =>
                            navigate("/admin/app-discount-settings/popup-settings/add")
                          }
                        >
                          Add one now
                        </button>
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

export default PopupSettings
