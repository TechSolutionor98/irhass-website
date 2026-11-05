/**
 * Merge fields.
 *
 * They sit in a template as literal text -- {{first_name}} -- and are swapped for a
 * real value once per person, at send time. Nothing is resolved while editing: the
 * template is one document that goes to thousands of different people, so there is no
 * single correct value to show until there is a recipient.
 */

import { getSiteOrigin } from "../utils/publicSiteUrl.js"

export const MERGE_FIELDS = [
  { token: "first_name", label: "First name", sample: "Ayesha" },
  { token: "name", label: "Full name", sample: "Ayesha Khan" },
  { token: "email", label: "Email address", sample: "ayesha@example.com" },
  { token: "shop_url", label: "Shop link", sample: "https://www.irhaas.com" },
  { token: "unsubscribe_url", label: "Unsubscribe link", sample: "#" },
  { token: "year", label: "Current year", sample: String(new Date().getFullYear()) },
]

/**
 * @param {string} html
 * @param {{ name?: string, email?: string, unsubscribeUrl?: string }} recipient
 */
export const applyMergeFields = (html, recipient = {}) => {
  const fullName = String(recipient.name || "").trim()
  // "Hi ," is worse than "Hi there,". A blank name gets a greeting that still reads.
  const firstName = fullName ? fullName.split(/\s+/)[0] : "there"

  const values = {
    first_name: firstName,
    name: fullName || "there",
    email: String(recipient.email || ""),
    shop_url: getSiteOrigin(),
    unsubscribe_url: String(recipient.unsubscribeUrl || ""),
    year: String(new Date().getFullYear()),
  }

  return String(html || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, token) => {
    const key = String(token).toLowerCase()
    // An unknown token is left as written rather than blanked, so a typo is visible
    // in a test send instead of silently leaving a hole in the sentence.
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  })
}

/** The sample values the editor's preview uses, so an admin can see the shape of it. */
export const sampleRecipient = () => ({ name: "Ayesha Khan", email: "ayesha@example.com", unsubscribeUrl: "#" })

export default { MERGE_FIELDS, applyMergeFields, sampleRecipient }
