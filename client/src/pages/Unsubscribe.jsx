"use client"

import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import axios from "axios"
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import config from "../config/config"
import SEO from "../components/SEO"

/**
 * The page the unsubscribe link lands on.
 *
 * It confirms rather than acting on arrival, because mail clients and security
 * scanners follow links in messages without anyone having clicked them -- an opt-out
 * that happened on GET would remove customers who never asked to leave. The inbox's
 * own one-click button is the exception and goes to a separate POST endpoint, which
 * is what the specification requires.
 *
 * The address is never read from the URL directly. The token is signed, the server
 * checks the signature, and the address comes back from the server.
 */
const Unsubscribe = () => {
  const [params] = useSearchParams()
  const token = params.get("token") || ""

  const [state, setState] = useState("loading")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [reason, setReason] = useState("")

  useEffect(() => {
    if (!token) {
      setState("invalid")
      setMessage("This link is missing its code.")
      return
    }

    let cancelled = false
    axios
      .get(`${config.API_URL}/api/unsubscribe`, { params: { token } })
      .then(({ data }) => {
        if (cancelled) return
        setEmail(data.email)
        setState(data.alreadyUnsubscribed ? "done" : "confirm")
        if (data.alreadyUnsubscribed) setMessage(`${data.email} is already off our mailing list.`)
      })
      .catch((error) => {
        if (cancelled) return
        setState("invalid")
        setMessage(error?.response?.data?.message || "This unsubscribe link is not valid.")
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const confirm = async () => {
    setState("working")
    try {
      const { data } = await axios.post(`${config.API_URL}/api/unsubscribe`, { token, reason })
      setMessage(data.message)
      setState("done")
    } catch (error) {
      setMessage(error?.response?.data?.message || "We could not complete that. Please try again.")
      setState("invalid")
    }
  }

  return (
    <>
      <SEO title="Unsubscribe" noindex />
      <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center px-4 py-16">
        <div className="border border-stone-200 bg-white p-8">
          {state === "loading" && (
            <p className="flex items-center gap-2 text-sm text-stone-600">
              <Loader2 size={16} className="animate-spin" /> Checking your link…
            </p>
          )}

          {state === "confirm" && (
            <>
              <h1 className="mb-2 text-xl text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                Stop receiving our emails?
              </h1>
              <p className="mb-5 text-sm text-stone-600">
                We will remove <strong className="text-stone-900">{email}</strong> from our mailing list. Order
                confirmations and anything else about a purchase will still reach you.
              </p>

              <label className="mb-1 block text-xs uppercase tracking-wider text-stone-500">
                Anything you would like to tell us? (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mb-5 w-full border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
                placeholder="Too many emails, not relevant, …"
              />

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={confirm}
                  className="bg-footer-bg px-6 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-brand-700"
                >
                  Unsubscribe
                </button>
                <Link
                  to="/"
                  className="border border-stone-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
                >
                  Keep them coming
                </Link>
              </div>
            </>
          )}

          {state === "working" && (
            <p className="flex items-center gap-2 text-sm text-stone-600">
              <Loader2 size={16} className="animate-spin" /> Removing you…
            </p>
          )}

          {state === "done" && (
            <>
              <CheckCircle2 size={28} className="mb-3 text-green-600" />
              <h1 className="mb-2 text-xl text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                You are off the list
              </h1>
              <p className="mb-6 text-sm text-stone-600">{message}</p>
              <Link
                to="/"
                className="inline-block border border-stone-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
              >
                Back to the shop
              </Link>
            </>
          )}

          {state === "invalid" && (
            <>
              <AlertTriangle size={28} className="mb-3 text-amber-600" />
              <h1 className="mb-2 text-xl text-stone-900" style={{ fontFamily: "Georgia, serif" }}>
                We could not read that link
              </h1>
              <p className="mb-6 text-sm text-stone-600">{message}</p>
              <p className="mb-6 text-sm text-stone-600">
                Write to <a href="mailto:info@irhaas.com" className="underline">info@irhaas.com</a> and we will take you
                off the list by hand.
              </p>
              <Link
                to="/"
                className="inline-block border border-stone-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
              >
                Back to the shop
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default Unsubscribe
