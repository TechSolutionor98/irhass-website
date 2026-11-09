"use client"

import { useState, useRef, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { useLanguage } from "../context/LanguageContext"
import TranslatedText from "../components/TranslatedText"
import { resolvePostAuthPath, clearReturnPath } from "../utils/authRedirect"

/**
 * Verify Your Email Page
 *
 * Matches the site-wide luxury design theme (split-screen layout, editorial typography,
 * uppercase tracking, and brand palette as seen in Login and Register).
 */
const EmailVerification = () => {
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const inputRefs = useRef([])
  const navigate = useNavigate()
  const location = useLocation()
  const { verifyEmail, resendVerification } = useAuth()
  const { getLocalizedPath } = useLanguage()

  const queryEmail = new URLSearchParams(location.search).get("email")
  const storedEmail = sessionStorage.getItem("pendingVerificationEmail")
  const email = (location.state?.email || queryEmail || storedEmail || "").trim().toLowerCase()

  // Remember email in sessionStorage so page reload won't lose it
  useEffect(() => {
    if (email) {
      sessionStorage.setItem("pendingVerificationEmail", email)
    }
  }, [email])

  // Countdown timer for resend code cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  // Auto-focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const handleInputChange = (index, value) => {
    // Only accept numeric digits
    if (!/^\d*$/.test(value)) return

    const singleDigit = value.slice(-1)
    const newCode = [...code]
    newCode[index] = singleDigit

    setCode(newCode)
    if (error) setError("")

    // Move to next input if digit entered
    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit when all 6 digits are complete
    if (newCode.every((digit) => digit !== "") && newCode.join("").length === 6) {
      handleVerification(newCode.join(""))
    }
  }

  const handleKeyDown = (index, e) => {
    // Backspace: clear and jump to previous field
    if (e.key === "Backspace") {
      if (!code[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)

    if (pastedData.length === 6) {
      const newCode = pastedData.split("")
      setCode(newCode)
      if (error) setError("")

      // Focus last input
      inputRefs.current[5]?.focus()

      // Auto-submit code
      handleVerification(pastedData)
    } else if (pastedData.length > 0) {
      // Partial paste
      const newCode = [...code]
      for (let i = 0; i < pastedData.length; i++) {
        newCode[i] = pastedData[i]
      }
      setCode(newCode)
      inputRefs.current[Math.min(pastedData.length, 5)]?.focus()
    }
  }

  const handleVerification = async (verificationCode) => {
    if (!email) {
      setError("Email address not found. Please register first.")
      return
    }

    if (verificationCode.length !== 6) {
      setError("Please enter all 6 digits of the verification code.")
      return
    }

    setLoading(true)
    setError("")

    try {
      await verifyEmail({
        email,
        code: verificationCode,
      })

      setSuccess("Email verified successfully! Redirecting…")
      sessionStorage.removeItem("pendingVerificationEmail")

      setTimeout(() => {
        const redirectTo = resolvePostAuthPath(location.state, getLocalizedPath)
        clearReturnPath()
        navigate(redirectTo, { replace: true })
      }, 1600)
    } catch (err) {
      setError(err.message || "Verification failed. Please check your code and try again.")
      setCode(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!email) {
      setError("Email address not found. Please register first.")
      return
    }

    setResendLoading(true)
    setError("")
    setSuccess("")

    try {
      const res = await resendVerification(email)
      setSuccess(res?.message || "A new 6-digit verification code has been sent to your email!")
      setResendCooldown(60)
      setCode(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } catch (err) {
      setError(err.message || "Unable to resend verification code. Please try again shortly.")
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const verificationCode = code.join("")
    handleVerification(verificationCode)
  }

  const isCodeComplete = code.every((digit) => digit !== "") && code.join("").length === 6

  // If no email could be resolved, present branded fallback
  if (!email) {
    return (
      <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 lg:grid-cols-2">
        <div className="flex items-center justify-center px-6 py-14 sm:px-10 lg:px-16">
          <div className="w-full max-w-[420px]">
            <h1 className="text-2xl font-semibold uppercase tracking-[0.12em] text-stone-900">
              <TranslatedText>Email Not Found</TranslatedText>
            </h1>
            <p className="mt-3 text-sm text-stone-500">
              <TranslatedText>
                No pending email verification was found for this session. Please register or sign in to continue.
              </TranslatedText>
            </p>

            <div className="mt-8 space-y-3">
              <Link
                to={getLocalizedPath("/register")}
                className="block w-full bg-footer-bg px-6 py-4 text-center text-sm font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-brand-700"
              >
                <TranslatedText>Create an account</TranslatedText>
              </Link>
              <Link
                to={getLocalizedPath("/login")}
                className="block w-full border border-stone-900 px-6 py-4 text-center text-sm font-semibold uppercase tracking-[0.16em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
              >
                <TranslatedText>Sign in</TranslatedText>
              </Link>
            </div>
          </div>
        </div>

        <div className="relative hidden bg-[#e9e5df] lg:block">
          <img
            src="/media/auth-poster.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 lg:grid-cols-2">
      {/* Form pane */}
      <div className="flex items-center justify-center px-6 py-14 sm:px-10 lg:px-16">
        <div className="w-full max-w-[420px]">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.12em] text-stone-900">
            <TranslatedText>Verify Your Email</TranslatedText>
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            <TranslatedText>We've sent a 6-digit verification code to</TranslatedText>
            <br />
            <span className="font-semibold text-stone-900">{email}</span>
          </p>

          {/* Error Message Banner */}
          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="flex-1 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Success Message Banner */}
          {success && (
            <div
              role="status"
              className="mt-6 flex items-start gap-3 border-l-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <p className="flex-1 leading-relaxed">{success}</p>
            </div>
          )}

          <form className="mt-8" onSubmit={handleSubmit}>
            <div>
              <label className="mb-3 block text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                <TranslatedText>Enter 6-Digit Code</TranslatedText>
              </label>

              {/* 6 Luxury OTP Inputs */}
              <div className="flex justify-between gap-2 sm:gap-2.5">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={loading}
                    aria-label={`Digit ${index + 1}`}
                    className={`h-14 w-12 text-center text-2xl font-bold border transition-colors sm:h-16 sm:w-14 focus:outline-none ${
                      digit
                        ? "border-stone-900 bg-white text-stone-900"
                        : "border-stone-300 bg-white text-stone-900 focus:border-stone-900"
                    } ${error ? "border-red-400" : ""}`}
                  />
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !isCodeComplete}
              className="mt-7 w-full bg-footer-bg px-6 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <TranslatedText>Verifying…</TranslatedText>
                </span>
              ) : (
                <TranslatedText>Verify Email</TranslatedText>
              )}
            </button>
          </form>

          {/* Resend Code Section */}
          <div className="mt-6 text-center text-sm text-stone-500">
            <span>
              <TranslatedText>Didn't receive the code?</TranslatedText>
            </span>{" "}
            {resendCooldown > 0 ? (
              <span className="font-medium text-stone-400">
                <TranslatedText>Resend in</TranslatedText> {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendLoading || loading}
                className="font-medium text-stone-900 underline underline-offset-4 transition-colors hover:text-brand-600 disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
              >
                {resendLoading ? (
                  <TranslatedText>Sending code…</TranslatedText>
                ) : (
                  <TranslatedText>Resend Code</TranslatedText>
                )}
              </button>
            )}
          </div>

          {/* Visual Divider */}
          <div className="my-8 flex items-center gap-4">
            <span className="h-px flex-1 bg-stone-200" />
            <span className="text-xs uppercase tracking-[0.18em] text-stone-400">
              <TranslatedText>Options</TranslatedText>
            </span>
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          {/* Secondary Actions */}
          <div className="space-y-3">
            <Link
              to={getLocalizedPath("/register")}
              className="block w-full border border-stone-900 px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.16em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
            >
              <TranslatedText>Register with a different email</TranslatedText>
            </Link>

            <div className="text-center">
              <Link
                to={getLocalizedPath("/login")}
                className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500 underline underline-offset-4 transition-colors hover:text-stone-900"
              >
                <TranslatedText>Already verified? Sign in</TranslatedText>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Poster Column */}
      <div className="relative hidden bg-[#e9e5df] lg:block">
        <img
          src="/media/auth-poster.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
      </div>
    </div>
  )
}

export default EmailVerification
