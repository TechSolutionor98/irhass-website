import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import axios from "axios"
import { Save, Eye, EyeOff, Palette, Lock, Globe, DollarSign } from "lucide-react"
import AdminCountryManager from "./AdminCountryManager"

import config from "../../config/config"
const AdminSettings = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get("tab")

  const [settings, setSettings] = useState({})
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [activeTab, setActiveTab] = useState(tabFromUrl || "countries")

  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId)
    setSearchParams({ tab: tabId })
  }

  const themes = [
    { id: "blue", name: "Blue", primary: "#3B82F6", secondary: "#1F2937", accent: "#10B981" },
    { id: "green", name: "Green", primary: "#10B981", secondary: "#1F2937", accent: "#3B82F6" },
    { id: "purple", name: "Purple", primary: "#8B5CF6", secondary: "#1F2937", accent: "#F59E0B" },
    { id: "red", name: "Red", primary: "#EF4444", secondary: "#1F2937", accent: "#10B981" },
    { id: "orange", name: "Orange", primary: "#F97316", secondary: "#1F2937", accent: "#3B82F6" },
    { id: "custom", name: "Custom", primary: "#000000", secondary: "#666666", accent: "#FF0000" },
  ]

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${config.API_URL}/api/settings`)
      setSettings(data)
      setLoading(false)
    } catch (error) {
      setError("Failed to load settings. Please try again later.")
      setLoading(false)
    }
  }

  const handleSettingsSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      await axios.put(`${config.API_URL}/api/settings`, settings)
      setSuccess("Settings updated successfully!")
      setTimeout(() => setSuccess(""), 3000)
    } catch (error) {
      setError("Failed to update settings. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match")
      return
    }

    try {
      setSaving(true)
      await axios.put(`${config.API_URL}/api/settings/password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })
      setSuccess("Password updated successfully!")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
      setTimeout(() => setSuccess(""), 3000)
    } catch (error) {
      setError(error.response?.data?.message || "Failed to update password. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleThemeChange = (themeId) => {
    const theme = themes.find((t) => t.id === themeId)
    setSettings({
      ...settings,
      theme: themeId,
      primaryColor: theme.primary,
      secondaryColor: theme.secondary,
      accentColor: theme.accent,
    })
  }

  const tabs = [
    { id: "countries", name: "GCC Countries & Currencies", icon: DollarSign },
    { id: "security", name: "Security", icon: Lock },
  ]

  return (
    <div className="ml-64 mt-16 p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-md">{error}</div>}

        {success && <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-md">{success}</div>}

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabSelect(tab.id)}
                    className={`py-3 px-2 border-b-2 font-semibold text-sm flex items-center transition ${
                      activeTab === tab.id
                        ? "border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-lg"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* GCC Countries & Currencies Tab */}
        {activeTab === "countries" && <AdminCountryManager />}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Security Settings */}
            {activeTab === "security" && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-6">Security Settings</h2>

                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter current password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPasswords ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter new password"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Confirm new password"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      {saving ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AdminSettings
