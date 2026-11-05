"use client"

import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { Edit, Eye, EyeOff, Plus, Trash2 } from "lucide-react"
import AdminSidebar from "../../components/admin/AdminSidebar"
import { useToast } from "../../context/ToastContext"
import config from "../../config/config"

const AdminProductOptionManager = ({ routeType, title, singularTitle, openFormOnLoad = false }) => {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(openFormOnLoad)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    isActive: true,
  })

  const token = useMemo(
    () => localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken"),
    [],
  )

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token],
  )

  const resetForm = () => {
    setFormData({ name: "", isActive: true })
    setEditingItem(null)
    setShowForm(false)
  }

  const fetchItems = async () => {
    try {
      setLoading(true)
      setError("")
      if (!token) {
        setError("No authentication token found. Please login again.")
        setLoading(false)
        return
      }

      const response = await fetch(`${config.API_URL}/api/product-system-options/admin/${routeType}`, { headers: authHeaders })

      if (!response.ok) {
        setError("Failed to load data. Please try again.")
        setLoading(false)
        return
      }

      const data = await response.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (fetchError) {
      console.error(`Failed to load ${title}:`, fetchError)
      setError("Failed to load data. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeType])

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name || "",
      isActive: item.isActive !== false,
    })
    setShowForm(true)
  }

  const handleToggleStatus = async (itemId) => {
    try {
      const current = items.find((item) => item._id === itemId)
      if (!current) return

      const nextStatus = !current.isActive
      await axios.put(
        `${config.API_URL}/api/product-system-options/${routeType}/${itemId}`,
        { isActive: nextStatus },
        { headers: authHeaders },
      )
      setItems((prev) => prev.map((item) => (item._id === itemId ? { ...item, isActive: nextStatus } : item)))
      showToast(`${singularTitle} ${nextStatus ? "activated" : "deactivated"} successfully`, "success")
    } catch (toggleError) {
      console.error(`Failed to toggle ${title}:`, toggleError)
      showToast("Failed to update status", "error")
    }
  }

  const handleDelete = async (itemId) => {
    if (!window.confirm(`Are you sure you want to delete this ${singularTitle.toLowerCase()}?`)) return

    try {
      await axios.delete(`${config.API_URL}/api/product-system-options/${routeType}/${itemId}`, { headers: authHeaders })
      showToast(`${singularTitle} deleted successfully`, "success")
      fetchItems()
    } catch (deleteError) {
      console.error(`Failed to delete ${title}:`, deleteError)
      showToast(`Failed to delete ${singularTitle.toLowerCase()}`, "error")
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      if (editingItem) {
        await axios.put(`${config.API_URL}/api/product-system-options/${routeType}/${editingItem._id}`, formData, {
          headers: authHeaders,
        })
        showToast(`${singularTitle} updated successfully`, "success")
      } else {
        await axios.post(`${config.API_URL}/api/product-system-options/${routeType}`, formData, {
          headers: authHeaders,
        })
        showToast(`${singularTitle} added successfully`, "success")
      }

      resetForm()
      fetchItems()
    } catch (saveError) {
      console.error(`Failed to save ${title}:`, saveError)
      const message = saveError?.response?.data?.message || `Failed to save ${singularTitle.toLowerCase()}`
      showToast(message, "error")
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="ml-64 min-h-screen">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <button
              onClick={() => {
                setEditingItem(null)
                setFormData({ name: "", isActive: true })
                setShowForm(true)
              }}
              className="bg-lime-400 text-black font-medium py-2 px-4 rounded-md flex items-center"
            >
              <Plus size={18} className="mr-1" />
              Add {singularTitle}
            </button>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-md">{error}</div>}

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">{editingItem ? `Edit ${singularTitle}` : `Add ${singularTitle}`}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{singularTitle} Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Enter ${singularTitle.toLowerCase()} name`}
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(event) => setFormData({ ...formData, isActive: event.target.checked })}
                        className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      Active
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    {editingItem ? "Update" : "Create"} {singularTitle}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {singularTitle}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.length > 0 ? (
                      items.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{item.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                item.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}
                            >
                              {item.isActive ? (
                                <>
                                  <Eye className="h-3 w-3 mr-1" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  Inactive
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleToggleStatus(item._id)}
                                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                  item.isActive
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : "bg-red-100 text-red-800 hover:bg-red-200"
                                }`}
                              >
                                {item.isActive ? "Active" : "Inactive"}
                              </button>
                              <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-900">
                                <Edit size={18} />
                              </button>
                              <button onClick={() => handleDelete(item._id)} className="text-red-600 hover:text-red-900">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="px-6 py-4 text-center text-gray-500">
                          No {title.toLowerCase()} found
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
    </div>
  )
}

export default AdminProductOptionManager
