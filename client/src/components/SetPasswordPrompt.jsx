"use client"

import { useState } from "react"
import { KeyRound, Eye, EyeOff, Loader2 } from "lucide-react"
import { useAuth } from "../context/AuthContext"

// Asks a customer to choose their own password.
//
// Shown only to accounts an admin opened on their behalf -- someone who came in
// for a quotation and was registered so the office could find them again. They
// are signed in with a password they never chose and that a member of staff has
// seen, so this is the first thing they meet.
//
// It cannot be dismissed, but it is not a trap either: signing out is offered,
// and the account keeps working. The prompt simply returns next time.

const SetPasswordPrompt = () => {
  const { isAuthenticated, user, setPassword, logout } = useAuth()

  const [password, setPasswordValue] = useState("")
  const [confirm, setConfirm] = useState("")
  const [reveal, setReveal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  if (!isAuthenticated || !user?.mustChangePassword) return null

  const submit = async (event) => {
    event.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("Use at least 6 characters.")
      return
    }
    if (password !== confirm) {
      setError("The two passwords do not match.")
      return
    }

    try {
      setSaving(true)
      await setPassword(password)
    } catch (err) {
      setError(err?.message || "Could not save the password. Try again.")
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-100 text-lime-700">
              <KeyRound size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Choose your password</h2>
              <p className="mt-1 text-sm text-gray-600">
                Your account was set up for you, so the password you signed in with was not chosen by you. Pick
                your own to finish setting up {user?.email}.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <div className="relative">
              <input
                id="new-password"
                type={reveal ? "text" : "password"}
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-lime-500"
              />
              <button
                type="button"
                onClick={() => setReveal((shown) => !shown)}
                aria-label={reveal ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
              >
                {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <input
              id="confirm-password"
              type={reveal ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-lime-500"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-lime-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-lime-700 disabled:opacity-60"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? "Saving..." : "Save password"}
            </button>
          </form>
        </div>

        <div className="border-t border-gray-100 bg-gray-50/70 px-6 py-3 text-center">
          <button type="button" onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  )
}

export default SetPasswordPrompt
