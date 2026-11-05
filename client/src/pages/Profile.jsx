import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"
import { 
  User, 
  Mail, 
  Phone, 
  LogOut, 
  Trash2, 
  Shield, 
  Settings, 
  Package, 
  Heart, 
  AlertTriangle, 
  MapPin, 
  Lock, 
  Edit2, 
  Plus, 
  Check, 
  X, 
  Calendar,
  Layers,
  Gift,
  BellOff,
} from "lucide-react"
import { useToast } from "../context/ToastContext"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import { getProvincesForCountry } from "../utils/countryStates"
import AddressAutocomplete from "../components/AddressAutocomplete"
import axios from "axios"
import config from "../config/config"
import LoyaltyPointsPanel from "../components/LoyaltyPointsPanel"
import GrabCoin from "../components/GrabCoin"
import { useLoyalty } from "../context/LoyaltyContext"
import ReferralPanel from "../components/ReferralPanel"
import { useReferral } from "../context/ReferralContext"

const API_BASE_URL = `${config.API_URL}/api`

const Profile = () => {
  const { user, logout, token, updateProfile: updateGlobalProfile } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { getLocalizedPath } = useLanguage()
  const { countries, currentCountry } = useCurrency()

  // Tabs state
  const [activeTab, setActiveTab] = useState("overview")
  // Email subscription. Held here rather than on the user record because the opt-out
  // list is keyed by address and covers people who have no account at all -- the
  // profile is just one more way of reading and setting the same thing.
  const [emailPref, setEmailPref] = useState(null)
  const [emailPrefSaving, setEmailPrefSaving] = useState(false)
  const { isEnabled: loyaltyEnabled, settings: loyaltySettings } = useLoyalty()
  const { isEnabled: referralEnabled, settings: referralSettings } = useReferral()

  // Profile data state
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
  })
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // Password fields
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  // Address Modal state
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)
  const [addressDetails, setAddressDetails] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    isDefault: false,
  })

  // Deletion modals state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [isRequestingDelete, setIsRequestingDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (token) {
      fetchFullProfile()
    }
  }, [token])

  // Loaded when the tab is opened rather than on mount: most visits to the profile
  // are about an order, and this is one request nobody asked for on those.
  useEffect(() => {
    if (activeTab !== "email-preferences" || !token || emailPref) return
    axios
      .get(`${config.API_URL}/api/unsubscribe/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setEmailPref(data))
      .catch(() => setEmailPref({ error: true }))
  }, [activeTab, token, emailPref])

  const setSubscription = async (subscribed) => {
    setEmailPrefSaving(true)
    try {
      const { data } = await axios.put(
        `${config.API_URL}/api/unsubscribe/me`,
        { subscribed },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setEmailPref({ ...data })
      showToast(data.message, "success")
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not update your preference", "error")
    } finally {
      setEmailPrefSaving(false)
    }
  }

  const fetchFullProfile = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API_BASE_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setProfile({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        gender: data.gender || "",
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split("T")[0] : "",
      })
      setAddresses(data.addresses || [])
    } catch (err) {
      showToast("Failed to load profile details", "error")
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault()
    setUpdating(true)
    try {
      const payload = {
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        gender: profile.gender || undefined,
        dateOfBirth: profile.dateOfBirth || undefined,
      }
      const { data } = await axios.put(`${API_BASE_URL}/users/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      // Update local and context state
      setProfile({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        gender: data.gender || "",
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split("T")[0] : "",
      })
      if (updateGlobalProfile) {
        updateGlobalProfile(data)
      }
      showToast("Profile details updated successfully!", "success")
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update profile", "error")
    } finally {
      setUpdating(false)
    }
  }

  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast("New passwords do not match", "error")
      return
    }

    setUpdating(true)
    try {
      // In the backend, PUT /profile handles updating password directly if passed in body
      const payload = {
        password: passwordForm.newPassword,
        currentPassword: passwordForm.currentPassword,
      }
      await axios.put(`${API_BASE_URL}/users/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      })
      showToast("Password updated successfully!", "success")
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update password", "error")
    } finally {
      setUpdating(false)
    }
  }

  // Address CRUD Handlers
  const handleOpenAddAddress = () => {
    setEditingAddressId(null)
    setAddressDetails({
      name: "",
      phone: profile.phone || "",
      email: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: currentCountry?.name || (countries && countries[0]?.name) || "Pakistan",
      isDefault: false,
    })
    setShowAddressModal(true)
  }

  const handleOpenEditAddress = (addr) => {
    setEditingAddressId(addr._id)
    setAddressDetails({
      name: addr.name || "",
      phone: addr.phone || "",
      email: addr.email || "",
      address: addr.address || "",
      city: addr.city || "",
      state: addr.state || "",
      zipCode: addr.zipCode || "",
      country: addr.country || currentCountry?.name || "Pakistan",
      isDefault: addr.isDefault || false,
    })
    setShowAddressModal(true)
  }

  const handleSaveAddress = async (e) => {
    e.preventDefault()
    setUpdating(true)
    try {
      let response
      if (editingAddressId) {
        // Edit existing address
        response = await axios.put(
          `${API_BASE_URL}/users/addresses/${editingAddressId}`,
          addressDetails,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        showToast("Address updated successfully!", "success")
      } else {
        // Add new address
        response = await axios.post(
          `${API_BASE_URL}/users/addresses`,
          addressDetails,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        showToast("New address added successfully!", "success")
      }
      setAddresses(response.data)
      setShowAddressModal(false)
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save address", "error")
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm("Are you sure you want to delete this address?")) return
    setUpdating(true)
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/users/addresses/${addressId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setAddresses(response.data)
      showToast("Address deleted successfully", "success")
    } catch (err) {
      showToast("Failed to delete address", "error")
    } finally {
      setUpdating(false)
    }
  }

  const handleSetDefaultAddress = async (addressId) => {
    setUpdating(true)
    try {
      const response = await axios.put(
        `${API_BASE_URL}/users/addresses/${addressId}/default`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setAddresses(response.data)
      showToast("Default address updated", "success")
    } catch (err) {
      showToast("Failed to update default address", "error")
    } finally {
      setUpdating(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate(getLocalizedPath("/"))
  }

  const handleRequestDeletion = async () => {
    setIsRequestingDelete(true)
    try {
      const response = await axios.post(
        `${API_BASE_URL}/users/request-account-deletion`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      showToast(response.data.message + " (Check spam if not received.)", "success")
      setShowDeleteModal(false)
      setShowVerifyModal(true)
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to send verification code. Please try again.",
        "error"
      )
    } finally {
      setIsRequestingDelete(false)
    }
  }

  const handleVerifyDeletion = async (e) => {
    e.preventDefault()
    if (verificationCode.length !== 6) {
      showToast("Please enter a valid 6-digit code", "error")
      return
    }

    setIsDeleting(true)
    try {
      const response = await axios.post(
        `${API_BASE_URL}/users/verify-account-deletion`,
        { code: verificationCode },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      showToast(response.data.message, "success")
      setTimeout(() => {
        logout()
        navigate(getLocalizedPath("/"))
      }, 2000)
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to verify code. Please try again.",
        "error"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancelDeletion = () => {
    setShowDeleteModal(false)
    setShowVerifyModal(false)
    setVerificationCode("")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lime-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Upper Welcome Banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        {/* Decorative vertical green bar on the far right */}
        <div className="absolute right-0 top-0 bottom-0 w-2 bg-lime-600"></div>

        <div className="flex items-center space-x-4">
          <h1 className="text-lg md:text-xl font-extrabold text-gray-800 tracking-tight capitalize">
            {profile.name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:gap-x-6 pr-4">
          <button
            onClick={() => setActiveTab("overview")}
            className="text-gray-900 font-bold text-xs md:text-sm hover:opacity-80 transition"
          >
            Profile
          </button>
          <button
            onClick={() => navigate(getLocalizedPath("/orders"))}
            className="text-gray-600 hover:text-gray-900 font-semibold text-xs md:text-sm transition"
          >
            My Orders
          </button>
          <button
            onClick={() => navigate(getLocalizedPath("/track-order"))}
            className="text-gray-600 hover:text-gray-900 font-semibold text-xs md:text-sm transition"
          >
            Track Order
          </button>
          <button
            onClick={handleLogout}
            className="text-red-600 hover:text-red-700 font-bold text-xs md:text-sm transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Hand Navigation Menu */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2 h-fit">
          <div className="px-4 py-3 border-b mb-2">
            <h2 className="font-bold text-gray-800 text-sm tracking-wider uppercase">Profile Menu</h2>
          </div>
          
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "overview"
                ? "bg-lime-50 text-lime-700 border-l-4 border-lime-600"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
            }`}
          >
            <User size={18} />
            <span>Account Details</span>
          </button>

          <button
            onClick={() => setActiveTab("edit-profile")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "edit-profile"
                ? "bg-lime-50 text-lime-700 border-l-4 border-lime-600"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
            }`}
          >
            <Edit2 size={18} />
            <span>Edit Profile</span>
          </button>

          <button
            onClick={() => setActiveTab("change-password")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "change-password"
                ? "bg-lime-50 text-lime-700 border-l-4 border-lime-600"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
            }`}
          >
            <Lock size={18} />
            <span>Security & Password</span>
          </button>

          <button
            onClick={() => setActiveTab("addresses")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "addresses"
                ? "bg-lime-50 text-lime-700 border-l-4 border-lime-600"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
            }`}
          >
            <MapPin size={18} />
            <span>Saved Addresses</span>
          </button>

          {loyaltyEnabled && (
            <button
              onClick={() => setActiveTab("loyalty")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
                activeTab === "loyalty"
                  ? "bg-lime-50 text-lime-700 border-l-4 border-lime-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
              }`}
            >
              <GrabCoin size={18} />
              <span>My {loyaltySettings.pointsName || "Points"}</span>
            </button>
          )}

          {referralEnabled && referralSettings.showInProfile !== false && (
            <button
              onClick={() => setActiveTab("referrals")}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
                activeTab === "referrals"
                  ? "bg-lime-50 text-lime-700 border-l-4 border-lime-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
              }`}
            >
              <Gift size={18} />
              <span>{referralSettings.programmeName || "Refer a Friend"}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("email-preferences")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "email-preferences"
                ? "bg-lime-50 text-lime-700 border-l-4 border-lime-600"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
            }`}
          >
            <Mail size={18} />
            <span>Email Preferences</span>
          </button>

          <button
            onClick={() => setActiveTab("danger-zone")}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
              activeTab === "danger-zone"
                ? "bg-red-50 text-red-700 border-l-4 border-red-600"
                : "text-gray-600 hover:bg-gray-50 hover:text-red-700 border-l-4 border-transparent"
            }`}
          >
            <AlertTriangle size={18} />
            <span>Danger Zone</span>
          </button>
        </div>

        {/* Right Hand Profile Content Cards */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
          
          {/* TAB: EMAIL PREFERENCES */}
          {activeTab === "email-preferences" && (
            <div>
              <h2 className="text-xl font-bold text-gray-900">Email Preferences</h2>
              <p className="mt-1 text-sm text-gray-500">
                News, offers and new arrivals. This does not affect order confirmations or anything
                else about a purchase — those always reach you.
              </p>

              {!emailPref ? (
                <p className="mt-6 text-sm text-gray-500">Loading…</p>
              ) : emailPref.error ? (
                <p className="mt-6 text-sm text-red-600">We could not load your preference. Please try again.</p>
              ) : (
                <div className="mt-6 rounded-xl border border-gray-200 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold text-gray-900">
                        {emailPref.subscribed ? (
                          <>
                            <Mail size={17} className="text-lime-600" />
                            You are subscribed
                          </>
                        ) : (
                          <>
                            <BellOff size={17} className="text-gray-400" />
                            You are unsubscribed
                          </>
                        )}
                      </p>
                      <p className="mt-1 truncate text-sm text-gray-500">{emailPref.email}</p>

                      {!emailPref.subscribed && emailPref.unsubscribedAt && (
                        <p className="mt-2 text-xs text-gray-400">
                          Since {new Date(emailPref.unsubscribedAt).toLocaleDateString()}
                          {emailPref.reason ? ` — “${emailPref.reason}”` : ""}
                        </p>
                      )}
                    </div>

                    {/* Resubscribing has to be possible from here. The opt-out is
                        absolute by design, so nothing else will ever put somebody
                        back on the list — without this they would have to email us. */}
                    <button
                      type="button"
                      disabled={emailPrefSaving}
                      onClick={() => setSubscription(!emailPref.subscribed)}
                      className={`flex-shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                        emailPref.subscribed
                          ? "border border-gray-300 text-gray-700 hover:border-gray-900"
                          : "bg-lime-600 text-white hover:bg-lime-700"
                      }`}
                    >
                      {emailPrefSaving ? "Saving…" : emailPref.subscribed ? "Unsubscribe" : "Resubscribe"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: LOYALTY */}
          {activeTab === "loyalty" && loyaltyEnabled && <LoyaltyPointsPanel />}

          {/* TAB: REFERRALS */}
          {activeTab === "referrals" && referralEnabled && <ReferralPanel />}

          {/* TAB: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">Account Details</h2>
              <p className="text-gray-500 -mt-4 text-sm">Full overview of your account information.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                  <div className="bg-lime-100 p-3 rounded-full text-lime-700">
                    <User size={20} />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-medium block">Full Name</span>
                    <span className="font-bold text-gray-800 text-sm md:text-base">{profile.name}</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                  <div className="bg-blue-100 p-3 rounded-full text-blue-700">
                    <Mail size={20} />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-medium block">Email Address</span>
                    <span className="font-bold text-gray-800 text-sm md:text-base">{profile.email}</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                  <div className="bg-purple-100 p-3 rounded-full text-purple-700">
                    <Phone size={20} />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-medium block">Phone Number</span>
                    <span className="font-bold text-gray-800 text-sm md:text-base">{profile.phone || "Not specified"}</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                  <div className="bg-orange-100 p-3 rounded-full text-orange-700">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-medium block">Date of Birth</span>
                    <span className="font-bold text-gray-800 text-sm md:text-base">{profile.dateOfBirth || "Not specified"}</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                  <div className="bg-teal-100 p-3 rounded-full text-teal-700">
                    <Settings size={20} />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-medium block">Gender</span>
                    <span className="font-bold text-gray-800 capitalize text-sm md:text-base">{profile.gender || "Not specified"}</span>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                  <div className="bg-indigo-100 p-3 rounded-full text-indigo-700">
                    <Layers size={20} />
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 font-medium block">Account Type</span>
                    <span className="font-bold text-gray-800 text-sm md:text-base">{user?.isAdmin ? "Administrator" : "Customer"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EDIT PROFILE */}
          {activeTab === "edit-profile" && (
            <div className="space-y-6">
              <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">Edit Profile Details</h2>
              <p className="text-gray-500 -mt-4 text-sm">Keep your personal information up to date.</p>

              <form onSubmit={handleProfileUpdate} className="space-y-5 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none animate-none"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                    <input
                      type="email"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none animate-none"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none animate-none"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none animate-none"
                      value={profile.dateOfBirth}
                      onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Gender</label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none animate-none"
                      value={profile.gender}
                      onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={updating}
                    className="bg-lime-600 hover:bg-lime-700 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    {updating ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB: CHANGE PASSWORD */}
          {activeTab === "change-password" && (
            <div className="space-y-6">
              <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">Security & Password</h2>
              <p className="text-gray-500 -mt-4 text-sm">Update your password to keep your account safe.</p>

              <form onSubmit={handlePasswordUpdate} className="space-y-5 pt-4 max-w-lg">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Enter new password"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none animate-none"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updating}
                    className="bg-lime-600 hover:bg-lime-700 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md disabled:opacity-50"
                  >
                    {updating ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB: ADDRESS BOOK */}
          {activeTab === "addresses" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-gray-900">Saved Addresses</h2>
                  <p className="text-gray-500 text-sm">Manage multiple delivery locations.</p>
                </div>
                <button
                  onClick={handleOpenAddAddress}
                  className="flex items-center gap-2 bg-lime-600 hover:bg-lime-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm self-start sm:self-auto"
                >
                  <Plus size={16} />
                  Add Address
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                  <MapPin className="mx-auto text-gray-300 mb-3" size={40} />
                  <p className="text-gray-500 font-medium">No saved addresses yet.</p>
                  <button 
                    onClick={handleOpenAddAddress} 
                    className="text-lime-600 hover:text-lime-700 font-bold text-sm mt-1 hover:underline"
                  >
                    Add your first address now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  {addresses.map((addr) => (
                    <div 
                      key={addr._id} 
                      className={`relative border-2 rounded-2xl p-5 transition-all ${
                        addr.isDefault 
                          ? "border-lime-600 bg-lime-50/20" 
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">{addr.name}</span>
                          {addr.isDefault && (
                            <span className="bg-lime-100 text-lime-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <Check size={10} />
                              Default
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenEditAddress(addr)}
                            className="p-1.5 text-gray-500 hover:text-lime-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit Address"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteAddress(addr._id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Delete Address"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <p>{addr.address}</p>
                        <p>{addr.city}, {addr.state || ""} {addr.zipCode || ""} ({addr.country || "Pakistan"})</p>
                        <p className="flex items-center gap-1 text-gray-500 mt-2 text-xs">
                          <Phone size={12} /> {addr.phone}
                        </p>
                        {addr.email && (
                          <p className="flex items-center gap-1 text-gray-500 text-xs">
                            <Mail size={12} /> {addr.email}
                          </p>
                        )}
                      </div>

                      {!addr.isDefault && (
                        <button
                          onClick={() => handleSetDefaultAddress(addr._id)}
                          className="w-full text-xs font-bold text-lime-600 hover:text-lime-700 mt-4 border border-lime-300 rounded-lg py-1.5 hover:bg-lime-50 transition-colors"
                        >
                          Set as Default
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: DANGER ZONE */}
          {activeTab === "danger-zone" && (
            <div className="space-y-6">
              <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 text-red-600">Danger Zone</h2>
              <p className="text-gray-500 -mt-4 text-sm font-medium">Critical actions regarding your account status.</p>

              <div className="bg-red-50/50 border border-red-200 rounded-2xl p-6 space-y-4 pt-4">
                <h3 className="font-bold text-red-700 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Delete Account Permanently
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Once you delete your account, there is no going back. All of your personal details, order histories, wishlists, and preferences will be permanently wiped out. Please proceed with caution.
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-sm"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* SAVED ADDRESS MODAL */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative animate-none">
            <button
              onClick={() => setShowAddressModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-extrabold text-gray-900 mb-6">
              {editingAddressId ? "Edit Address Details" : "Add Address Details"}
            </h3>

            <form onSubmit={handleSaveAddress} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Address Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Home, Office, Work"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none text-sm animate-none"
                  value={addressDetails.name}
                  onChange={(e) => setAddressDetails({ ...addressDetails, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50XXXXXXX"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none text-sm animate-none"
                  value={addressDetails.phone}
                  onChange={(e) => setAddressDetails({ ...addressDetails, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Country *</label>
                <select
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none text-sm"
                  value={addressDetails.country || currentCountry?.name || "Pakistan"}
                  onChange={(e) => setAddressDetails({ ...addressDetails, country: e.target.value })}
                >
                  {(countries || []).map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Address Street *</label>
                <AddressAutocomplete
                  value={addressDetails.address}
                  onChange={(v) => setAddressDetails({ ...addressDetails, address: v })}
                  onSelect={(s) =>
                    setAddressDetails({
                      ...addressDetails,
                      address: s.address,
                      city: s.city || addressDetails.city,
                      state: s.state || addressDetails.state,
                      zipCode: s.zipCode || addressDetails.zipCode,
                    })
                  }
                  countryName={addressDetails.country || currentCountry?.name || "Pakistan"}
                  countryCode={(countries || []).find((c) => c.name === (addressDetails.country || currentCountry?.name))?.code || currentCountry?.code}
                  inputClassName="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none text-sm"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Start typing your street or building and pick it from the list, then add your villa or flat number.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">State / Province *</label>
                  {(() => {
                    const selectedCountryName = addressDetails.country || currentCountry?.name || "Pakistan"
                    const provinces = getProvincesForCountry(selectedCountryName)
                    if (provinces && provinces.length > 0) {
                      return (
                        <select
                          required
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none text-sm"
                          value={addressDetails.state}
                          onChange={(e) => setAddressDetails({ ...addressDetails, state: e.target.value })}
                        >
                          <option value="">Select State / Province</option>
                          {provinces.map((prov) => (
                            <option key={prov} value={prov}>
                              {prov}
                            </option>
                          ))}
                        </select>
                      )
                    }
                    return (
                      <input
                        type="text"
                        required
                        placeholder="State / Province"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none text-sm animate-none"
                        value={addressDetails.state}
                        onChange={(e) => setAddressDetails({ ...addressDetails, state: e.target.value })}
                      />
                    )
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="City"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none text-sm animate-none"
                    value={addressDetails.city}
                    onChange={(e) => setAddressDetails({ ...addressDetails, city: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Zip Code / Post Code</label>
                <input
                  type="text"
                  placeholder="00000"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none text-sm animate-none"
                  value={addressDetails.zipCode}
                  onChange={(e) => setAddressDetails({ ...addressDetails, zipCode: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="defaultAddressCheckbox"
                  checked={addressDetails.isDefault}
                  onChange={(e) => setAddressDetails({ ...addressDetails, isDefault: e.target.checked })}
                  className="accent-lime-600 rounded"
                />
                <label htmlFor="defaultAddressCheckbox" className="text-sm font-semibold text-gray-700 cursor-pointer">
                  Set as Default Address
                </label>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-2.5 rounded-xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 bg-lime-600 hover:bg-lime-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-md disabled:opacity-50"
                >
                  {updating ? "Saving..." : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-none">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Delete Account</h3>
            </div>
            
            <p className="text-gray-700 mb-6 leading-relaxed">
              Are you absolutely sure you want to delete your account? This action cannot be undone and will:
            </p>
            
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2 text-sm">
              <li>Permanently delete all your personal data</li>
              <li>Remove your order history</li>
              <li>Delete your wishlist and preferences</li>
              <li>Close your account permanently</li>
            </ul>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <p className="text-xs text-yellow-800 leading-normal">
                <strong>⚠️ Warning:</strong> You will receive a 6-digit verification code via email. You must enter this code to complete the deletion.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleCancelDeletion}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestDeletion}
                disabled={isRequestingDelete}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold text-sm disabled:opacity-50 shadow-md"
              >
                {isRequestingDelete ? "Sending..." : "Send Code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION CODE MODAL */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-none">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <Mail size={24} className="text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">Enter Verification Code</h3>
            </div>
            
            <p className="text-gray-700 mb-4 leading-relaxed text-sm">
              We've sent a 6-digit verification code to <strong>{profile.email}</strong>. Please enter it below to confirm account deletion.
            </p>

            <form onSubmit={handleVerifyDeletion}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                  Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-center text-2xl tracking-widest font-bold outline-none"
                  placeholder="000000"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  The code will expire in 10 minutes.
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handleCancelDeletion}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || verificationCode.length !== 6}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold text-sm disabled:opacity-50 shadow-md"
                >
                  {isDeleting ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </form>

            <button
              onClick={handleRequestDeletion}
              disabled={isRequestingDelete}
              className="w-full mt-4 text-xs text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-50 text-center"
            >
              {isRequestingDelete ? "Sending..." : "Resend Code"}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

export default Profile
