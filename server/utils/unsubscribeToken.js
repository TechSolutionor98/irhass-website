/**
 * Signed unsubscribe links.
 *
 * The email address has to travel in the URL -- the recipient is not logged in and
 * may be reading on a device that has never visited the site. An unsigned link means
 * anyone can edit the address in it and unsubscribe a competitor, a colleague, or
 * every customer whose address they can guess. So the address is signed, and the
 * signature is checked before anything is written.
 */

import crypto from "crypto"

const getSecret = () => {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw new Error(
      "UNSUBSCRIBE_SECRET (or JWT_SECRET) must be set before unsubscribe links can be issued",
    )
  }
  return secret
}

const base64url = (buffer) =>
  Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

const fromBase64url = (value) =>
  Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64")

export const normalizeEmail = (email) => String(email || "").trim().toLowerCase()

const sign = (payload) =>
  base64url(crypto.createHmac("sha256", getSecret()).update(payload).digest())

/**
 * @param {string} email
 * @param {string} [campaignId] recorded so we know which send prompted the opt-out
 */
export const createUnsubscribeToken = (email, campaignId = "") => {
  const payload = base64url(JSON.stringify({ e: normalizeEmail(email), c: String(campaignId || "") }))
  return `${payload}.${sign(payload)}`
}

/**
 * @returns {{ email: string, campaignId: string } | null} null when the token was
 *   tampered with, truncated, or simply not ours.
 */
export const verifyUnsubscribeToken = (token) => {
  const raw = String(token || "")
  const dot = raw.lastIndexOf(".")
  if (dot <= 0) return null

  const payload = raw.slice(0, dot)
  const provided = raw.slice(dot + 1)
  const expected = sign(payload)

  // Compare as buffers of equal length. timingSafeEqual throws on a length mismatch,
  // which would itself leak the length, so the lengths are checked first.
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const parsed = JSON.parse(fromBase64url(payload).toString("utf8"))
    const email = normalizeEmail(parsed?.e)
    if (!email) return null
    return { email, campaignId: String(parsed?.c || "") }
  } catch {
    return null
  }
}

export default { createUnsubscribeToken, verifyUnsubscribeToken, normalizeEmail }
