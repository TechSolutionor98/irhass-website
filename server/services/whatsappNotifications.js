import WhatsAppSettings from "../models/whatsappSettingsModel.js"
import { sendTemplate, isConfigured } from "./whatsappService.js"

/**
 * Order notifications over WhatsApp.
 *
 * Every one of these is business-initiated, so it must be an approved template --
 * free-form sends outside the customer's 24-hour window are rejected by Meta, and
 * a run of rejections is what drops a number's quality rating towards a ban.
 *
 * Nothing here throws. An order must never fail because a notification did not send.
 */

const phoneFor = (order) =>
  order?.shippingAddress?.phone || order?.pickupDetails?.phone || ""

const nameFor = (order) =>
  order?.shippingAddress?.name || order?.pickupDetails?.name || "Customer"

const shortId = (order) => String(order?._id || "").slice(-6).toUpperCase()

const money = (order) => {
  const symbol = order?.currencySymbol || "Rs"
  const amount = Number(order?.totalPrice || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })
  return `${symbol} ${amount}`
}

/**
 * Sends one order template if that notification is switched on.
 *
 * `templateKey` and the matching `notify` flag are deliberately paired: turning a
 * notification off in the admin stops it here, not in the caller.
 */
const notify = async (order, templateKey, notifyKey, params, buttons = []) => {
  try {
    const settings = await WhatsAppSettings.load({ withSecrets: true })
    if (!isConfigured(settings)) return { ok: false, reason: "not_configured" }
    if (!settings.notify?.[notifyKey]) return { ok: false, reason: "disabled" }

    const templateName = settings.templates?.[templateKey]
    if (!templateName) return { ok: false, reason: "no_template" }

    const phone = phoneFor(order)
    if (!phone) return { ok: false, reason: "no_phone" }

    return await sendTemplate(phone, templateName, params, { order: order._id, name: nameFor(order), buttons })
  } catch (error) {
    console.error(`[WHATSAPP] ${templateKey} failed for order ${order?._id}:`, error.message)
    return { ok: false, reason: "error", error: error.message }
  }
}

export const sendOrderPlaced = (order) =>
  // The two payloads map to the template's first and second quick-reply buttons, in
  // that order. The webhook reads them back to move the order.
  notify(
    order,
    "orderConfirmation",
    "onOrderPlaced",
    [nameFor(order), shortId(order), money(order)],
    [`confirm:${order._id}`, `cancel:${order._id}`],
  )

export const sendOrderShipped = (order) =>
  notify(order, "orderShipped", "onOrderShipped", [
    nameFor(order),
    shortId(order),
    order?.trackingId || "—",
  ])

export const sendOrderDelivered = (order) =>
  notify(order, "orderDelivered", "onOrderDelivered", [nameFor(order), shortId(order)])

export const sendOrderCancelled = (order) =>
  notify(order, "orderCancelled", "onOrderCancelled", [nameFor(order), shortId(order)])

/** Routes a status change to the right template. Unknown statuses send nothing. */
export const sendOrderStatusUpdate = (order) => {
  const status = String(order?.status || "").toLowerCase()
  if (status.includes("ship") || status.includes("way")) return sendOrderShipped(order)
  if (status.includes("delivered")) return sendOrderDelivered(order)
  if (status.includes("cancel")) return sendOrderCancelled(order)
  return Promise.resolve({ ok: false, reason: "no_template_for_status" })
}

export default {
  sendOrderPlaced,
  sendOrderShipped,
  sendOrderDelivered,
  sendOrderCancelled,
  sendOrderStatusUpdate,
}
