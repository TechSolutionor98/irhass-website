/**
 * Who a campaign goes to.
 *
 * Four lists feed it, and they overlap heavily: a customer who bought something, then
 * signed up for the newsletter, then asked for a callback is on three of them and is
 * still one person who must receive one email. Deduplication happens here when the
 * numbers are shown, and again in the database when the queue is built -- the unique
 * index on (campaign, email) is what actually enforces it.
 *
 * The counting is deliberately honest. "319 across the lists you chose, 305 people,
 * 14 on more than one list" tells an admin what they are about to do. A single number
 * hides the overlap and makes a 300-person send look like a 320-person one.
 */

import User from "../models/userModel.js"
import NewsletterSubscriber from "../models/newsletterSubscriberModel.js"
import RequestCallback from "../models/requestCallbackModel.js"
import BulkPurchase from "../models/bulkPurchaseModel.js"
import EmailUnsubscribe from "../models/emailUnsubscribeModel.js"
import { normalizeEmail } from "../utils/unsubscribeToken.js"

export const AUDIENCE_LABELS = {
  users: "Users",
  newsletter: "Newsletter Subscribers",
  callbacks: "Request Callbacks",
  bulk: "Bulk Purchase",
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim())

// Each loader returns { email, name } rows. Spam-marked enquiries are left out: a
// flagged address is one someone already decided not to correspond with.
const LOADERS = {
  users: () => User.find({ email: { $exists: true, $ne: "" } }, "email name").lean(),
  newsletter: () => NewsletterSubscriber.find({}, "email").lean(),
  callbacks: () => RequestCallback.find({ status: { $ne: "spam" } }, "email name").lean(),
  bulk: () => BulkPurchase.find({ status: { $ne: "spam" } }, "email name company").lean(),
}

/**
 * Collapse the chosen lists into one row per address.
 *
 * @param {string[]} audiences
 * @param {string[]} manualEmails addresses typed or ticked by hand
 * @returns {Promise<{
 *   people: Array<{ email: string, name: string, sources: string[] }>,
 *   rowsAcrossLists: number,
 *   overlapping: number,
 *   unsubscribed: number,
 *   perList: Record<string, number>
 * }>}
 */
export const resolveAudience = async (audiences = [], manualEmails = []) => {
  const chosen = (Array.isArray(audiences) ? audiences : []).filter((a) => LOADERS[a])

  const byEmail = new Map()
  const perList = {}
  let rowsAcrossLists = 0

  const add = (email, name, source) => {
    const normalized = normalizeEmail(email)
    if (!isEmail(normalized)) return

    rowsAcrossLists += 1
    perList[source] = (perList[source] || 0) + 1

    const existing = byEmail.get(normalized)
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source)
      // Keep the first real name we saw; a later blank must not overwrite it.
      if (!existing.name && name) existing.name = String(name).trim()
      return
    }
    byEmail.set(normalized, { email: normalized, name: String(name || "").trim(), sources: [source] })
  }

  for (const list of chosen) {
    const rows = await LOADERS[list]()
    for (const r of rows) add(r.email, r.name || r.company, list)
  }

  for (const email of Array.isArray(manualEmails) ? manualEmails : []) {
    add(email, "", "manual")
  }

  // Opt-out is absolute and is applied before anything is queued. It is checked a
  // second time immediately before each message is sent, so someone who opts out
  // while a send is running stops receiving it.
  const suppressed = await getUnsubscribedSet([...byEmail.keys()])
  let unsubscribed = 0
  for (const email of suppressed) {
    if (byEmail.delete(email)) unsubscribed += 1
  }

  const people = [...byEmail.values()]
  const overlapping = people.filter((p) => p.sources.length > 1).length

  return { people, rowsAcrossLists, overlapping, unsubscribed, perList }
}

/**
 * @param {string[]} emails
 * @returns {Promise<Set<string>>} the subset that has opted out
 */
export const getUnsubscribedSet = async (emails = []) => {
  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))]
  if (!normalized.length) return new Set()

  const rows = await EmailUnsubscribe.find({ email: { $in: normalized } }, "email").lean()
  return new Set(rows.map((r) => r.email))
}

/** True when this one address has opted out. Called again just before each send. */
export const isUnsubscribed = async (email) => {
  const normalized = normalizeEmail(email)
  if (!normalized) return true
  return Boolean(await EmailUnsubscribe.exists({ email: normalized }))
}

/**
 * Every address the shop holds, for the pick-by-hand screen. Opted-out addresses are
 * included and flagged rather than filtered out -- a customer who has vanished from
 * the list with no explanation looks like a bug, and the admin goes looking for them.
 */
export const listAllContacts = async () => {
  const byEmail = new Map()

  for (const list of Object.keys(LOADERS)) {
    const rows = await LOADERS[list]()
    for (const r of rows) {
      const email = normalizeEmail(r.email)
      if (!isEmail(email)) continue
      const existing = byEmail.get(email)
      if (existing) {
        if (!existing.sources.includes(list)) existing.sources.push(list)
        if (!existing.name && (r.name || r.company)) existing.name = String(r.name || r.company).trim()
      } else {
        byEmail.set(email, { email, name: String(r.name || r.company || "").trim(), sources: [list] })
      }
    }
  }

  const contacts = [...byEmail.values()]
  const suppressed = await getUnsubscribedSet(contacts.map((c) => c.email))

  return contacts
    .map((c) => ({ ...c, unsubscribed: suppressed.has(c.email) }))
    .sort((a, b) => a.email.localeCompare(b.email))
}

export default { resolveAudience, getUnsubscribedSet, isUnsubscribed, listAllContacts, AUDIENCE_LABELS }
