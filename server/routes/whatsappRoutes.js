import express from "express"
import asyncHandler from "express-async-handler"
import { protect, admin } from "../middleware/authMiddleware.js"
import WhatsAppSettings from "../models/whatsappSettingsModel.js"
import WhatsAppConversation from "../models/whatsappConversationModel.js"
import WhatsAppMessage from "../models/whatsappMessageModel.js"
import Order from "../models/orderModel.js"
import { sendOrderStatusUpdateEmail } from "../utils/emailService.js"
import { postOrderReturn } from "../services/stockLedger.js"
import {
  sendText,
  sendTemplate,
  recordInbound,
  verifyWebhookSignature,
  normalizePhone,
  isConfigured,
} from "../services/whatsappService.js"

const router = express.Router()

/* ------------------------------------------------------------------ webhook -- */
/* Meta calls these. They are public by necessity, so the GET proves we know the
   verify token and the POST proves the payload was signed with the app secret.   */

// @desc    Webhook verification handshake
// @route   GET /api/whatsapp/webhook
// @access  Public (Meta)
router.get(
  "/webhook",
  asyncHandler(async (req, res) => {
    const settings = await WhatsAppSettings.load({ withSecrets: true })
    const mode = req.query["hub.mode"]
    const token = req.query["hub.verify_token"]
    const challenge = req.query["hub.challenge"]

    if (mode === "subscribe" && token && settings.verifyToken && token === settings.verifyToken) {
      console.log("[WHATSAPP] Webhook verified by Meta")
      return res.status(200).send(challenge)
    }

    console.warn("[WHATSAPP] Webhook verification failed")
    return res.sendStatus(403)
  }),
)

// @desc    Inbound messages and delivery receipts
// @route   POST /api/whatsapp/webhook
// @access  Public (Meta, signature verified)
router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const settings = await WhatsAppSettings.load({ withSecrets: true })

    // Meta retries anything that is not acknowledged quickly, so this answers first
    // and does the work afterwards. A slow webhook gets retried and duplicated.
    const signatureOk = verifyWebhookSignature(
      req.rawBody || JSON.stringify(req.body || {}),
      req.get("x-hub-signature-256"),
      settings.appSecret,
    )

    if (!signatureOk) {
      console.warn("[WHATSAPP] Rejected a webhook with a bad signature")
      return res.sendStatus(401)
    }

    res.sendStatus(200)

    try {
      const entries = req.body?.entry || []
      for (const entry of entries) {
        for (const change of entry.changes || []) {
          const value = change.value || {}

          // Delivery and read receipts.
          for (const status of value.statuses || []) {
            await WhatsAppMessage.updateOne(
              { wamid: status.id },
              {
                $set: {
                  status: status.status,
                  ...(status.errors?.[0]?.title ? { errorMessage: status.errors[0].title } : {}),
                },
              },
            )
          }

          // Inbound messages.
          const contactName = value.contacts?.[0]?.profile?.name || ""
          for (const message of value.messages || []) {
            const phone = message.from
            // A quick-reply button arrives as its own type; the payload is what we set
            // on the template, which is how "Confirm"/"Cancel" come back.
            const buttonPayload =
              message.button?.payload || message.interactive?.button_reply?.id || ""
            const body =
              message.text?.body ||
              message.button?.text ||
              message.interactive?.button_reply?.title ||
              `[${message.type}]`

            const recorded = await recordInbound({
              phone,
              name: contactName,
              wamid: message.id,
              type: message.type === "button" || message.interactive ? "button" : message.type,
              body,
            })

            if (buttonPayload && recorded?.conversation) {
              await handleOrderButton(recorded.conversation, buttonPayload)
            }
          }
        }
      }
    } catch (error) {
      console.error("[WHATSAPP] Failed to process webhook:", error.message)
    }
  }),
)

/**
 * A customer tapping Confirm or Cancel on an order template.
 *
 * Payload format is `confirm:<orderId>` / `cancel:<orderId>`, set when the template
 * is sent. The order is re-checked against the conversation's phone number so a
 * guessed id cannot cancel somebody else's order.
 */
const handleOrderButton = async (conversation, payload) => {
  const [action, orderId] = String(payload).split(":")
  if (!orderId || !["confirm", "cancel"].includes(action)) return

  const order = await Order.findById(orderId).catch(() => null)
  if (!order) return

  const orderPhone = normalizePhone(order.shippingAddress?.phone || order.pickupDetails?.phone)
  if (!orderPhone || orderPhone !== conversation.phone) {
    console.warn(`[WHATSAPP] Button payload for order ${orderId} did not match ${conversation.phone}`)
    return
  }

  // Only an order still awaiting confirmation can be moved from WhatsApp. Anything
  // already shipped is a conversation for an agent, not a button.
  const movable = ["Pending", "New", "Received", "Confirmed"]
  if (!movable.includes(order.status)) return

  const oldStatus = order.status
  order.status = action === "confirm" ? "Confirmed" : "Cancelled"
  await order.save()

  if (oldStatus !== order.status) {
    sendOrderStatusUpdateEmail(order).catch((err) =>
      console.error("[WHATSAPP] Failed to send status update email:", err.message),
    )
    if (order.status === "Cancelled") {
      postOrderReturn(order).catch((err) =>
        console.error("[WHATSAPP] Failed to restore stock:", err.message),
      )
    }
  }

  await WhatsAppMessage.create({
    conversation: conversation._id,
    phone: conversation.phone,
    direction: "in",
    type: "system",
    body: `Customer ${action === "confirm" ? "confirmed" : "cancelled"} order ${order._id}`,
    status: "delivered",
    order: order._id,
  })

  console.log(`[WHATSAPP] Order ${order._id} ${order.status.toLowerCase()} by customer`)
}

/* -------------------------------------------------------------------- admin -- */

router.use(protect, admin)

// @desc    Connection status and settings (never returns the secrets themselves)
// @route   GET /api/whatsapp/settings
router.get(
  "/settings",
  asyncHandler(async (req, res) => {
    const settings = await WhatsAppSettings.load({ withSecrets: true })
    res.json({
      phoneNumberId: settings.phoneNumberId,
      wabaId: settings.wabaId,
      displayPhoneNumber: settings.displayPhoneNumber,
      isEnabled: settings.isEnabled,
      templates: settings.templates,
      templateLanguage: settings.templateLanguage,
      notify: settings.notify,
      lastVerifiedAt: settings.lastVerifiedAt,
      lastError: settings.lastError,
      // Whether a secret is set, not what it is.
      hasAccessToken: Boolean(settings.accessToken),
      hasVerifyToken: Boolean(settings.verifyToken),
      hasAppSecret: Boolean(settings.appSecret),
      connected: isConfigured(settings),
    })
  }),
)

// @desc    Save connection settings
// @route   PUT /api/whatsapp/settings
router.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const settings = await WhatsAppSettings.load({ withSecrets: true })
    const body = req.body || {}

    const assignIfPresent = (field, value) => {
      if (value !== undefined) settings[field] = value
    }

    assignIfPresent("phoneNumberId", body.phoneNumberId?.trim())
    assignIfPresent("wabaId", body.wabaId?.trim())
    assignIfPresent("displayPhoneNumber", body.displayPhoneNumber?.trim())
    assignIfPresent("isEnabled", body.isEnabled)
    assignIfPresent("templateLanguage", body.templateLanguage?.trim())

    // Secrets are only written when a non-empty value is sent, so saving the form
    // without retyping a token does not wipe it.
    if (body.accessToken) settings.accessToken = body.accessToken.trim()
    if (body.verifyToken) settings.verifyToken = body.verifyToken.trim()
    if (body.appSecret) settings.appSecret = body.appSecret.trim()

    if (body.templates) settings.templates = { ...settings.templates.toObject(), ...body.templates }
    if (body.notify) settings.notify = { ...settings.notify.toObject(), ...body.notify }

    settings.lastError = ""
    await settings.save()

    res.json({ message: "Saved", connected: isConfigured(settings) })
  }),
)

// @desc    Send a test message to prove the connection works
// @route   POST /api/whatsapp/test
router.post(
  "/test",
  asyncHandler(async (req, res) => {
    const { phone, templateName } = req.body || {}
    if (!phone) {
      res.status(400)
      throw new Error("A phone number is required")
    }

    const settings = await WhatsAppSettings.load({ withSecrets: true })
    // A test goes out as a template, because a number that has never written in has
    // no open service window -- exactly like a real order notification.
    const name = templateName || settings.templates?.orderConfirmation || "hello_world"
    const result = await sendTemplate(phone, name, [])

    if (!result.ok) {
      await WhatsAppSettings.updateOne(
        { _id: settings._id },
        { $set: { lastError: result.error || result.reason } },
      )
      res.status(400)
      throw new Error(result.error || `Could not send: ${result.reason}`)
    }

    await WhatsAppSettings.updateOne(
      { _id: settings._id },
      { $set: { lastVerifiedAt: new Date(), lastError: "" } },
    )
    res.json({ message: "Test message sent", wamid: result.wamid })
  }),
)

// @desc    Conversation list for the agent inbox
// @route   GET /api/whatsapp/conversations
router.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const limit = Math.min(100, Number(req.query.limit) || 50)
    const search = String(req.query.search || "").trim()

    const filter = { archived: { $ne: true } }
    if (search) {
      filter.$or = [
        { phone: { $regex: search.replace(/\D/g, ""), $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ]
    }

    const conversations = await WhatsAppConversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(limit)
      .lean({ virtuals: true })

    res.json({ conversations })
  }),
)

// @desc    Messages in one conversation
// @route   GET /api/whatsapp/conversations/:id/messages
router.get(
  "/conversations/:id/messages",
  asyncHandler(async (req, res) => {
    const conversation = await WhatsAppConversation.findById(req.params.id)
    if (!conversation) {
      res.status(404)
      throw new Error("Conversation not found")
    }

    const messages = await WhatsAppMessage.find({ conversation: conversation._id })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean()

    // Opening the thread is reading it.
    await WhatsAppConversation.updateOne({ _id: conversation._id }, { $set: { unreadCount: 0 } })

    res.json({ conversation: conversation.toJSON(), messages })
  }),
)

// @desc    Agent reply
// @route   POST /api/whatsapp/conversations/:id/reply
router.post(
  "/conversations/:id/reply",
  asyncHandler(async (req, res) => {
    const { body } = req.body || {}
    if (!body?.trim()) {
      res.status(400)
      throw new Error("Message cannot be empty")
    }

    const conversation = await WhatsAppConversation.findById(req.params.id)
    if (!conversation) {
      res.status(404)
      throw new Error("Conversation not found")
    }

    const result = await sendText(conversation.phone, body.trim(), { sentBy: req.user?._id })

    if (!result.ok) {
      res.status(400)
      // The window message is the one an agent will actually hit, so it explains
      // itself rather than returning a code.
      const explain = {
        window_closed:
          "This customer has not messaged in the last 24 hours, so WhatsApp only allows an approved template. Send an order update instead.",
        opted_out: "This customer asked to stop receiving messages.",
        not_configured: "WhatsApp is not connected yet.",
        invalid_number: "That number is not a valid WhatsApp number.",
      }
      throw new Error(explain[result.reason] || result.error || "Could not send the message")
    }

    res.json({ message: "Sent", wamid: result.wamid })
  }),
)

export default router
