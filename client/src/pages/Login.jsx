"use client"

import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { Eye, EyeOff } from "lucide-react"
import { useLanguage } from "../context/LanguageContext"
import TranslatedText from "../components/TranslatedText"
import { resolvePostAuthPath, clearReturnPath } from "../utils/authRedirect"

/**
 * Sign-in.
 *
 * Two panes: the form on the left, a full-height photograph on the right. The form
 * pane stays centred and narrow at every width, so the fields never stretch into a
 * shape nobody reads comfortably.
 */
const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const { showToast } = useToast()
  const { getLocalizedPath } = useLanguage()

  // Carried through to the sign-up link so a shopper interrupted at checkout is
  // returned there rather than to the home page.
  const isFromCheckout =
    Boolean(
      location.state?.from?.pathname?.includes("checkout") ||
      (typeof location.state?.from === "string" && location.state?.from?.includes("checkout"))
    )

  const [formData, setFormData] = useState({ email: "", password: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError("")

      const result = await login({
        // Addresses are stored lower-case, so "Fahad@..." has to match "fahad@...".
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      })

      if (result.success) {
        showToast && showToast("Logged in successfully!", "success")
        const redirectTo = resolvePostAuthPath(location.state, getLocalizedPath)
        clearReturnPath()
        navigate(redirectTo, { replace: true })
      } else {
        setError(result.message)
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const field =
    "w-full border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-stone-900 focus:outline-none"
  const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-stone-500"

  return (
    <div className="grid min-h-[calc(100vh-80px)] grid-cols-1 lg:grid-cols-2">
      {/* Form */}
      <div className="flex items-center justify-center px-6 py-14 sm:px-10 lg:px-16">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.12em] text-stone-900">
            <TranslatedText>Sign in</TranslatedText>
          </h1>
          <p className="mt-3 text-sm text-stone-500">
            <TranslatedText>Welcome back. Enter your details to continue.</TranslatedText>
          </p>

          {error && (
            <p
              role="alert"
              className="mt-6 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <form className="mt-8" onSubmit={handleSubmit}>
            <div>
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
                className={field}
                placeholder="you@example.com"
              />
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
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`${field} pr-12`}
                  placeholder="••••••••"
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
            </div>

            <div className="mt-4 flex items-center justify-between">
              <label htmlFor="remember-me" className="flex items-center gap-2 text-sm text-stone-600">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 border-stone-300 text-stone-900 accent-stone-900 focus:ring-stone-900"
                />
                <TranslatedText>Remember me</TranslatedText>
              </label>

              <Link
                to={getLocalizedPath("/forgot-password")}
                className="text-sm text-stone-900 underline underline-offset-4 transition-colors hover:text-brand-600"
              >
                <TranslatedText>Forgot password?</TranslatedText>
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-7 w-full bg-footer-bg px-6 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
            >
              {loading ? <TranslatedText>Signing in…</TranslatedText> : <TranslatedText>Sign in</TranslatedText>}
            </button>
          </form>

          <div className="my-8 flex items-center gap-4">
            <span className="h-px flex-1 bg-stone-200" />
            <span className="text-xs uppercase tracking-[0.18em] text-stone-400">
              <TranslatedText>New here</TranslatedText>
            </span>
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          <Link
            to={getLocalizedPath("/register")}
            state={isFromCheckout ? { from: location.state?.from || { pathname: getLocalizedPath("/checkout") } } : undefined}
            className="block w-full border border-stone-900 px-6 py-4 text-center text-sm font-semibold uppercase tracking-[0.16em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
          >
            <TranslatedText>Create an account</TranslatedText>
          </Link>

          {/* Checkout no longer asks anyone to sign in, so this is a shortcut rather
              than the escape hatch it used to be. */}
          <p className="mt-6 text-center text-sm text-stone-500">
            <TranslatedText>Just browsing?</TranslatedText>{" "}
            <Link
              to={getLocalizedPath("/shop")}
              className="text-stone-900 underline underline-offset-4 transition-colors hover:text-brand-600"
            >
              <TranslatedText>Continue shopping</TranslatedText>
            </Link>
          </p>
        </div>
      </div>

      {/* Brand poster. Hidden below lg -- on a phone it would push the form off screen.
          `object-cover` with a top-biased focal point keeps the logo and headline in
          frame on short windows, where centring would crop the wordmark away. */}
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

export default Login
