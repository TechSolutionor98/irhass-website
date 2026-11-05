/**
 * AppDiscounts.jsx — DEPRECATED
 *
 * This page has been replaced by AppDiscountSettings.jsx
 * Route: /admin/app-discount-settings
 *
 * This file is kept as a redirect to avoid broken imports during transition.
 */
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

const AppDiscounts = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate("/admin/app-discount-settings", { replace: true })
  }, [navigate])

  return null
}

export default AppDiscounts
