"use client"

import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { setPendingReferralCode } from "../context/ReferralContext"

/**
 * Remembers a referral code arriving on any URL as ?ref=CODE.
 *
 * It listens everywhere rather than only on the registration page because a customer
 * sharing their link often edits it into something more interesting first -- a product,
 * an offer page -- and the invite has to survive that, plus the browse-then-sign-up
 * journey that follows. The code is parked in sessionStorage and read back when the
 * registration form is submitted.
 */
const ReferralLinkCatcher = () => {
  const location = useLocation()

  useEffect(() => {
    const code = new URLSearchParams(location.search).get("ref")
    if (code) setPendingReferralCode(code)
  }, [location.search])

  return null
}

export default ReferralLinkCatcher
