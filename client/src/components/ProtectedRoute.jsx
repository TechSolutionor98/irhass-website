"use client"

import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useLanguage } from "../context/LanguageContext"

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  const { getLocalizedPath } = useLanguage()
  const location = useLocation()

  // Check for guest info in localStorage
  const isGuest = typeof window !== 'undefined' && localStorage.getItem('guestInfo')

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (!isAuthenticated && !isGuest) {
    // Localized so the language prefix rewrite does not replace this entry and
    // discard the "from" hint on the way through.
    return <Navigate to={getLocalizedPath("/login")} state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
