/**
 * Absolute, publicly reachable URLs for anything that goes inside an email.
 *
 * This is the single most common way an email campaign breaks. A picture resolved
 * against whatever host the browser happens to be talking to is "http://localhost:5000/..."
 * on a developer machine: it looks perfect on screen, and every recipient gets a
 * broken image. Once the mail is sent there is nothing that can fix it.
 *
 * So: nothing in a rendered email may carry a relative path, and nothing may point
 * at a host that is not reachable from the open internet.
 */

import { getSiteOrigin } from "./publicSiteUrl.js"

// An address only this machine can resolve is never valid in an email.
const PRIVATE_HOST_PATTERN = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i

const normalizeOrigin = (value) => {
  const raw = String(value || "").trim()
  if (!raw) return ""

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    if (PRIVATE_HOST_PATTERN.test(url.hostname)) return ""
    return `${url.protocol}//${url.host}`
  } catch {
    return ""
  }
}

/**
 * Where uploaded files live. Images are served by the API process out of /uploads,
 * so this is the API's own public address -- not the storefront's.
 */
export const getAssetOrigin = () =>
  normalizeOrigin(process.env.ASSET_PUBLIC_URL) ||
  normalizeOrigin(process.env.PUBLIC_BASE_URL) ||
  normalizeOrigin(process.env.SERVER_PUBLIC_URL) ||
  normalizeOrigin(process.env.API_BASE_URL) ||
  "https://api.irhaas.com"

/**
 * Turn anything an editor might have stored into a URL a mail client can fetch.
 * Returns "" for input that cannot be made absolute, so a caller can drop the
 * element rather than ship a broken image icon.
 */
export const toAbsoluteEmailUrl = (src) => {
  const raw = String(src || "").trim()
  if (!raw) return ""

  // A data: URI is self-contained, but Gmail refuses to render one. Treat it as unusable.
  if (/^data:/i.test(raw)) return ""

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      return PRIVATE_HOST_PATTERN.test(url.hostname) ? "" : url.toString()
    } catch {
      return ""
    }
  }

  if (raw.startsWith("//")) return `https:${raw}`

  const base = raw.startsWith("/uploads") || raw.startsWith("uploads/") ? getAssetOrigin() : getSiteOrigin()
  return raw.startsWith("/") ? `${base}${raw}` : `${base}/${raw}`
}

/**
 * The masthead logo.
 *
 * Deliberately not WebP, not SVG and not the white version: Outlook cannot decode
 * WebP, Gmail strips SVG, and a white mark disappears against the light background
 * every one of these templates uses. /logo-wide.png is a colour PNG, which all three
 * handle. It is served from the storefront, which is public.
 */
export const getEmailLogoUrl = () =>
  String(process.env.EMAIL_LOGO_URL || "").trim() || `${getSiteOrigin()}/logo-wide.png`

export default { getAssetOrigin, toAbsoluteEmailUrl, getEmailLogoUrl }
