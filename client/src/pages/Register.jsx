"use client"

import { useState, useEffect } from "react"
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom"
import axios from "axios"
import { Eye, EyeOff, Gift } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import TranslatedText from "../components/TranslatedText"
import config from "../config/config"
import { useReferral, getPendingReferralCode, setPendingReferralCode, clearPendingReferralCode } from "../context/ReferralContext"

const Register = () => {
  const { getLocalizedPath } = useLanguage()
  const location = useLocation()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const navigate = useNavigate()
  const { register } = useAuth()
  const { formatPrice } = useCurrency()
  const { isEnabled: referralEnabled } = useReferral()
  const [searchParams] = useSearchParams()

  // The code the visitor arrived with, and what it is worth. Checked against the server so
  // a mistyped or retired link says so on the form rather than silently signing somebody
  // up with no discount.
  const [referral, setReferral] = useState(null)

  // A code that arrived on a link (or was parked from one earlier in the session) fills
  // the field and locks it: the invite is the reason the visitor is here. Otherwise the
  // field is free for a code a friend passed on by hand.
  const [linkCode, setLinkCode] = useState("")
  const [manualCode, setManualCode] = useState("")
  // idle | checking | valid | invalid -- for the code in the field, whichever way it got there.
  const [codeStatus, setCodeStatus] = useState("idle")

  const checkReferralCode = (code, { fromLink }) => {
    let cancelled = false
    setCodeStatus("checking")
    axios
      .get(`${config.API_URL}/api/referrals/validate/${encodeURIComponent(code)}`)
      .then(({ data }) => {
        if (cancelled) return
        if (data?.valid) {
          setReferral({ ...data, code: data.code })
          setCodeStatus("valid")
        } else {
          setReferral(null)
          setCodeStatus("invalid")
          // A dead link is not worth an error message -- it just does not earn anything --
          // but it must not stay parked and mis-attribute a later registration either.
          if (fromLink) {
            clearPendingReferralCode()
            setLinkCode("")
          }
        }
      })
      .catch(() => {
        // The programme could be unreachable rather than the code wrong, so the code is
        // left in place and still sent; the server decides.
        if (!cancelled) {
          setReferral(null)
          setCodeStatus("idle")
        }
      })
    return () => {
      cancelled = true
    }
  }

  useEffect(() => {
    // A code in the URL wins over one parked earlier in the session: it is the link the
    // visitor is on right now.
    const fromUrl = searchParams.get("ref")
    if (fromUrl) setPendingReferralCode(fromUrl)

    const code = fromUrl || getPendingReferralCode()
    if (!code) return

    setLinkCode(code.toUpperCase())
    return checkReferralCode(code, { fromLink: true })
  }, [searchParams])

  // A hand-typed code is checked once the visitor pauses, so the form can say who it
  // belongs to and what it is worth before they submit.
  useEffect(() => {
    if (linkCode) return
    const code = manualCode.trim()
    if (!code) {
      setReferral(null)
      setCodeStatus("idle")
      return
    }
    let cancel = () => {}
    const timer = setTimeout(() => {
      cancel = checkReferralCode(code, { fromLink: false })
    }, 500)
    return () => {
      clearTimeout(timer)
      cancel()
    }
  }, [manualCode, linkCode])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters"
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid"
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters"
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password"
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    // A typed code that was not recognised is not silently dropped: the visitor typed it
    // to get something, so they are told before the account exists without it.
    if (!linkCode && manualCode.trim() && codeStatus === "invalid") {
      setErrors((prev) => ({ ...prev, referralCode: "That referral code was not recognised. Check it or leave the field empty." }))
      return
    }

    setLoading(true)

    try {
      const normalizedEmail = formData.email.trim().toLowerCase()
      const referralCode = referral?.code || (linkCode ? getPendingReferralCode() : manualCode.trim().toUpperCase())

      await register({
        name: formData.name.trim(),
        email: normalizedEmail,
        password: formData.password,
        ...(referralCode ? { referralCode } : {}),
      })

      // The invite has been used. Leaving it parked would attribute the next person to
      // register on this device to the same friend.
      clearPendingReferralCode()

      // Keep email available even if route state is dropped (e.g. redirects/reloads)
      sessionStorage.setItem("pendingVerificationEmail", normalizedEmail)

      // Navigate to email verification page
      navigate(getLocalizedPath(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`), {
        state: { email: normalizedEmail, from: location.state?.from },
        replace: true,
      })
    } catch (error) {
      setErrors({
        submit: error.message || "Registration failed. Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }

  const field =
    "w-full border bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:outline-none"
  const fieldState = (bad) => `${field} ${bad ? "border-red-400 focus:border-red-500" : "border-stone-300 focus:border-stone-900"}`
  const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-stone-500"
  const fieldError = "mt-1.5 text-xs text-red-600"

  return (
    <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 lg:grid-cols-2">
      {/* Photograph first in the source on desktop, so the eye lands on it before the
          form; hidden below lg where it would only push the fields off screen. */}
      <div className="relative hidden bg-[#efece7] lg:block">
        <img
          src="/media/signup.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="flex items-center justify-center px-6 py-14 sm:px-10 lg:px-16">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.12em] text-stone-900">
            <TranslatedText>Create account</TranslatedText>
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            <TranslatedText>Already have one?</TranslatedText>{" "}
            <Link
              to={getLocalizedPath("/login")}
              className="text-stone-900 underline underline-offset-4 transition-colors hover:text-brand-600"
            >
              <TranslatedText>Sign in</TranslatedText>
            </Link>
          </p>

          {/* An invited visitor is told what the link is worth before they fill anything
              in -- it is the reason they clicked it. */}
          {referral?.valid && (
            <div className="mt-7 border-l-2 border-brand-500 bg-brand-50 px-4 py-4">
              <div className="flex items-start gap-3">
                <Gift size={18} className="mt-0.5 shrink-0 text-brand-600" strokeWidth={1.5} />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-stone-900">
                    {referral.referrerName} <TranslatedText>invited you</TranslatedText>
                  </p>
                  <p className="mt-1 text-stone-700">
                    <TranslatedText>Sign up to get</TranslatedText>{" "}
                    <strong className="text-brand-700">
                      {referral.reward?.discountType === "fixed"
                        ? formatPrice(referral.reward?.discountValue)
                        : `${referral.reward?.discountValue}%`}{" "}
                      <TranslatedText>off your first order</TranslatedText>
                    </strong>
                    {referral.reward?.discountType !== "fixed" && referral.reward?.maxDiscountAed > 0 && (
                      <> ({`up to ${formatPrice(referral.reward.maxDiscountAed)}`})</>
                    )}
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          <form className="mt-8" onSubmit={handleSubmit} noValidate>
            {errors.submit && (
              <p role="alert" className="mb-6 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errors.submit}
              </p>
            )}

            <div>
              <label htmlFor="name" className={label}>
                <TranslatedText>Full name</TranslatedText>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleChange}
                className={fieldState(errors.name)}
                placeholder="Your name"
              />
              {errors.name && <p className={fieldError}>{errors.name}</p>}
            </div>

            <div className="mt-5">
              <label htmlFor="email" className={label}>
                <TranslatedText>Email address</TranslatedText>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={fieldState(errors.email)}
                placeholder="you@example.com"
              />
              {errors.email && <p className={fieldError}>{errors.email}</p>}
            </div>

            <div className="mt-5">
              <label htmlFor="password" className={label}>
                <TranslatedText>Password</TranslatedText>
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`${fieldState(errors.password)} pr-12`}
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-stone-400 transition-colors hover:text-stone-900"
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                </button>
              </div>
              {errors.password && <p className={fieldError}>{errors.password}</p>}
            </div>

            <div className="mt-5">
              <label htmlFor="confirmPassword" className={label}>
                <TranslatedText>Confirm password</TranslatedText>
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`${fieldState(errors.confirmPassword)} pr-12`}
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-stone-400 transition-colors hover:text-stone-900"
                >
                  {showConfirmPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                </button>
              </div>
              {errors.confirmPassword && <p className={fieldError}>{errors.confirmPassword}</p>}
            </div>

            {referralEnabled && (
              <div className="mt-5">
                <label htmlFor="referralCode" className={label}>
                  <TranslatedText>Referral code</TranslatedText>{" "}
                  <span className="normal-case tracking-normal text-stone-400">
                    (<TranslatedText>optional</TranslatedText>)
                  </span>
                </label>
                <div className="relative">
                  <Gift
                    size={16}
                    strokeWidth={1.5}
                    className="pointer-events-none absolute inset-y-0 left-4 my-auto text-brand-600"
                  />
                  <input
                    id="referralCode"
                    name="referralCode"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    value={linkCode || manualCode}
                    readOnly={Boolean(linkCode)}
                    onChange={(e) => {
                      setManualCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                      if (errors.referralCode) setErrors((prev) => ({ ...prev, referralCode: "" }))
                    }}
                    className={`w-full border bg-white py-3 pl-11 pr-4 font-mono text-sm uppercase tracking-wider transition-colors focus:outline-none ${
                      errors.referralCode || codeStatus === "invalid"
                        ? "border-red-400"
                        : codeStatus === "valid"
                          ? "border-emerald-500"
                          : "border-stone-300 focus:border-stone-900"
                    } ${linkCode ? "cursor-not-allowed bg-stone-50 text-stone-600" : "text-stone-900"}`}
                    placeholder="FRIEND CODE"
                  />
                </div>
                {linkCode ? (
                  <p className="mt-1.5 text-xs text-stone-500">
                    <TranslatedText>Applied from your invite link.</TranslatedText>
                  </p>
                ) : codeStatus === "checking" ? (
                  <p className="mt-1.5 text-xs text-stone-500">
                    <TranslatedText>Checking your code…</TranslatedText>
                  </p>
                ) : codeStatus === "invalid" || errors.referralCode ? (
                  <p className={fieldError}>
                    {errors.referralCode || <TranslatedText>That referral code was not recognised.</TranslatedText>}
                  </p>
                ) : codeStatus === "valid" ? (
                  <p className="mt-1.5 text-xs text-emerald-700">
                    <TranslatedText>Code applied. Your discount is shown above.</TranslatedText>
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-stone-500">
                    <TranslatedText>Have a friend&apos;s code? Enter it for a discount on your first order.</TranslatedText>
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-7 w-full bg-footer-bg px-6 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
            >
              {loading ? (
                <TranslatedText>Creating account…</TranslatedText>
              ) : (
                <TranslatedText>Create account</TranslatedText>
              )}
            </button>

            <p className="mt-5 text-center text-xs leading-relaxed text-stone-500">
              <TranslatedText>By creating an account, you agree to our</TranslatedText>{" "}
              <Link
                to={getLocalizedPath("/terms-conditions")}
                className="text-stone-900 underline underline-offset-2 hover:text-brand-600"
              >
                <TranslatedText>Terms &amp; Conditions</TranslatedText>
              </Link>{" "}
              <TranslatedText>and</TranslatedText>{" "}
              <Link
                to={getLocalizedPath("/privacy-policy")}
                className="text-stone-900 underline underline-offset-2 hover:text-brand-600"
              >
                <TranslatedText>Privacy Policy</TranslatedText>
              </Link>
              .
            </p>
          </form>

          {/* Checkout takes guests now, so there is no interstitial to send anyone to. */}
          <p className="mt-8 border-t border-stone-200 pt-6 text-center text-sm text-stone-500">
            <TranslatedText>Prefer not to sign up?</TranslatedText>{" "}
            <Link
              to={getLocalizedPath("/shop")}
              className="text-stone-900 underline underline-offset-4 transition-colors hover:text-brand-600"
            >
              <TranslatedText>Continue shopping</TranslatedText>
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Register
