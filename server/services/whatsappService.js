import crypto from "crypto"
import WhatsAppSettings from "../models/whatsappSettingsModel.js"
import WhatsAppConversation from "../models/whatsappConversationModel.js"
import WhatsAppMessage from "../models/whatsappMessageModel.js"

/**
 * WhatsApp Business Platform (Cloud API) client.
 *
 * Everything here is built around not getting the number banned, which is a function
 * of four things Meta actually measures:
 *
 *   1. Use the official API. Driving WhatsApp Web through a QR session is a terms
 *      breach; that is what gets numbers banned, not sending volume.
 *   2. Only message people who gave you their number for this purpose. Every send
 *      path here starts from an order or from the customer writing first.
 *   3. Respect the 24-hour service window. Outside it, approved templates only --
 *      free-form sends are rejected, and a pile of rejections lowers quality rating.
 *   4. Honour opt-out immediately and permanently.
 *
 * Nothing in this module can send to a number that has not transacted or written in.
 */

const GRAPH_VERSION = "v21.0"
const GRAPH_URL = "https://graph.facebook.com"

// How long a customer's message keeps the free-form window open.
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000

// Words a customer can send to stop all messages. Checked case-insensitively against
// the whole trimmed message, so "stop sending me the wrong size" is not an opt-out.
const OPT_OUT_WORDS = new Set(["stop", "unsubscribe", "cancel all", "opt out", "optout"])

/** E.164 digits, no plus. Local Pakistani numbers get the country code added. */
export const normalizePhone = (value, defaultCountryCode = "92") => {
  let digits = String(value ?? "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.startsWith("00")) digits = digits.slice(2)
  // A leading 0 is the local trunk prefix; swap it for the country code.
  if (digits.startsWith("0")) digits = `${defaultCountryCode}${digits.slice(1)}`
  // A bare 10-digit mobile with no country code at all.
  if (digits.length === 10 && !digits.startsWith(defaultCountryCode)) digits = `${defaultCountryCode}${digits}`
  return digits.length >= 10 ? digits : ""
}

export const isConfigured = (settings) =>
  Boolean(settings?.isEnabled && settings?.phoneNumberId && settings?.accessToken)

/**
 * Meta signs every webhook with the app secret. An unverified webhook endpoint is an
 * open door for anyone who learns the URL to inject messages into the inbox.
 */
export const verifyWebhookSignature = (rawBody, signatureHeader, appSecret) => {
  if (!appSecret) return false
  const signature = String(signatureHeader || "")
  if (!signature.startsWith("sha256=")) return false

  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")
  const provided = signature.slice("sha256=".length)

  // Lengths must match before timingSafeEqual, which throws on a mismatch.
  if (expected.length !== provided.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
}

const graphRequest = async (settings, path, body) => {
  const res = await fetch(`${GRAPH_URL}/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.error?.message || `WhatsApp API returned ${res.status}`
    const error = new Error(message)
    error.code = data?.error?.code
    error.details = data?.error
    throw error
  }
  return data
}

/** Finds or creates the thread for a number, without touching the service window. */
export const getConversation = async (phone, { name, user, order } = {}) => {
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  const update = { $setOnInsert: { phone: normalized } }
  const set = {}
  if (name) set.name = name
  if (user) set.user = user
  if (order) set.lastOrder = order
  if (Object.keys(set).length) update.$set = set

  return WhatsAppConversation.findOneAndUpdate({ phone: normalized }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  })
}

const recordMessage = async (fields) => {
  try {
    return await WhatsAppMessage.create(fields)
  } catch (error) {
    // A duplicate wamid means Meta retried a webhook we already handled.
    if (error?.code === 11000) return null
    throw error
  }
}

const touchConversation = async (conversation, { preview, direction, incrementUnread = false, windowOpens = false }) => {
  const update = {
    lastMessageAt: new Date(),
    lastMessagePreview: String(preview || "").slice(0, 160),
    lastDirection: direction,
  }
  if (windowOpens) update.serviceWindowExpiresAt = new Date(Date.now() + SERVICE_WINDOW_MS)

  const ops = { $set: update }
  if (incrementUnread) ops.$inc = { unreadCount: 1 }
  else if (direction === "out") ops.$set.unreadCount = 0

  await WhatsAppConversation.updateOne({ _id: conversation._id }, ops)
}

/**
 * Free-form text. Only valid inside the 24-hour window, so it refuses rather than
 * letting Meta reject it.
 */
export const sendText = async (phone, body, { sentBy = null, order = null } = {}) => {
  const settings = await WhatsAppSettings.load({ withSecrets: true })
  if (!isConfigured(settings)) return { ok: false, reason: "not_configured" }

  const conversation = await getConversation(phone)
  if (!conversation) return { ok: false, reason: "invalid_number" }
  if (conversation.optedOut) return { ok: false, reason: "opted_out" }
  if (!conversation.serviceWindowExpiresAt || conversation.serviceWindowExpiresAt <= new Date()) {
    return { ok: false, reason: "window_closed" }
  }

  const message = await recordMessage({
    conversation: conversation._id,
    phone: conversation.phone,
    direction: "out",
    type: "text",
    body,
    status: "queued",
    sentBy,
    order,
  })

  try {
    const data = await graphRequest(settings, `${settings.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: conversation.phone,
      type: "text",
      text: { preview_url: false, body },
    })

    const wamid = data?.messages?.[0]?.id || ""
    if (message) await WhatsAppMessage.updateOne({ _id: message._id }, { $set: { status: "sent", wamid } })
    await touchConversation(conversation, { preview: body, direction: "out" })
    return { ok: true, wamid }
  } catch (error) {
    if (message) {
      await WhatsAppMessage.updateOne(
        { _id: message._id },
        { $set: { status: "failed", errorMessage: error.message } },
      )
    }
    return { ok: false, reason: "send_failed", error: error.message }
  }
}

/**
 * An approved template. This is the only thing a business may send outside the
 * service window, and the only thing used for order notifications.
 *
 * `params` fill the template's {{1}}, {{2}} ... placeholders in order.
 */
export const sendTemplate = async (phone, templateName, params = [], { order = null, name, buttons = [] } = {}) => {
  const settings = await WhatsAppSettings.load({ withSecrets: true })
  if (!isConfigured(settings)) return { ok: false, reason: "not_configured" }
  if (!templateName) return { ok: false, reason: "no_template" }

  const conversation = await getConversation(phone, { name, order })
  if (!conversation) return { ok: false, reason: "invalid_number" }
  if (conversation.optedOut) return { ok: false, reason: "opted_out" }

  const components = []
  if (params.length) {
    components.push({ type: "body", parameters: params.map((text) => ({ type: "text", text: String(text) })) })
  }

  // Quick-reply buttons carry a payload that comes back on the webhook when tapped.
  // Without this the buttons still render, but their payload is whatever was typed
  // into the template at design time -- the same string for every customer, with no
  // order id in it, so there would be no way to know which order was confirmed.
  buttons.forEach((payload, index) => {
    components.push({
      type: "button",
      sub_type: "quick_reply",
      index: String(index),
      parameters: [{ type: "payload", payload: String(payload) }],
    })
  })

  const message = await recordMessage({
    conversation: conversation._id,
    phone: conversation.phone,
    direction: "out",
    type: "template",
    body: `[${templateName}] ${params.join(" · ")}`,
    templateName,
    templateParams: params.map(String),
    status: "queued",
    order,
  })

  try {
    const data = await graphRequest(settings, `${settings.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: conversation.phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: settings.templateLanguage || "en" },
        ...(components.length ? { components } : {}),
      },
    })

    const wamid = data?.messages?.[0]?.id || ""
    if (message) await WhatsAppMessage.updateOne({ _id: message._id }, { $set: { status: "sent", wamid } })
    await touchConversation(conversation, { preview: `Sent: ${templateName}`, direction: "out" })
    return { ok: true, wamid }
  } catch (error) {
    if (message) {
      await WhatsAppMessage.updateOne(
        { _id: message._id },
        { $set: { status: "failed", errorMessage: error.message } },
      )
    }
    await WhatsAppSettings.updateOne({ _id: settings._id }, { $set: { lastError: error.message } })
    return { ok: false, reason: "send_failed", error: error.message }
  }
}

/** True when the customer's reply is a request to stop being messaged. */
export const isOptOut = (text) => OPT_OUT_WORDS.has(String(text || "").trim().toLowerCase())

/**
 * Records an inbound message and opens the service window.
 *
 * Returns the conversation and the stored message so the webhook can decide what to
 * do next -- confirm an order, hand off to an agent, or nothing at all.
 */
export const recordInbound = async ({ phone, name, wamid, type, body }) => {
  const conversation = await getConversation(phone, { name })
  if (!conversation) return null

  if (isOptOut(body)) {
    await WhatsAppConversation.updateOne(
      { _id: conversation._id },
      { $set: { optedOut: true, optedOutAt: new Date() } },
    )
  } else if (conversation.optedOut) {
    // Writing in again is consent to be replied to.
    await WhatsAppConversation.updateOne(
      { _id: conversation._id },
      { $set: { optedOut: false, optedOutAt: null } },
    )
  }

  const message = await recordMessage({
    conversation: conversation._id,
    phone: conversation.phone,
    direction: "in",
    type: type || "text",
    body: body || "",
    wamid,
    status: "delivered",
  })

  await touchConversation(conversation, {
    preview: body,
    direction: "in",
    incrementUnread: true,
    windowOpens: true,
  })

  return { conversation, message }
}

export default {
  normalizePhone,
  isConfigured,
  verifyWebhookSignature,
  getConversation,
  sendText,
  sendTemplate,
  recordInbound,
  isOptOut,
}
