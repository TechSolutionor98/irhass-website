"use client"

import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { rememberReturnPath } from "../utils/authRedirect"

/**
 * Records the last real page the shopper visited so signing in can return them
 * there. Renders nothing; auth pages and admin routes are skipped by
 * rememberReturnPath itself.
 */
const ReturnPathTracker = () => {
  const location = useLocation()

  useEffect(() => {
    rememberReturnPath(location.pathname, location.search)
  }, [location.pathname, location.search])

  return null
}

export default ReturnPathTracker
