import mongoose from "mongoose"

/**
 * The shop's WhatsApp Business Platform (Cloud API) connection.
 *
 * One document. Credentials come from Meta's app dashboard rather than from scanning
 * a QR code: QR-based automation drives WhatsApp Web through an unofficial library,
 * which is a terms-of-service breach and the single most common reason numbers get
 * banned. The Cloud API is the sanctioned route and cannot get the number banned for
 * being automated.
 */
const whatsappSettingsSchema = mongoose.Schema(
  {
    // From Meta > WhatsApp > API Setup.
    phoneNumberId: { type: String, default: "", trim: true },
    wabaId: { type: String, default: "", trim: true },
    displayPhoneNumber: { type: String, default: "", trim: true },

    // A permanent System User token. Stored here rather than in .env so the shop owner
    // can rotate it from the admin without a redeploy.
    accessToken: { type: String, default: "", select: false },

    // Echoed back to Meta during webhook verification, and used to check the
    // X-Hub-Signature-256 on every inbound call.
    verifyToken: { type: String, default: "", select: false },
    appSecret: { type: String, default: "", select: false },

    isEnabled: { type: Boolean, default: false },

    // Business-initiated messages must use an approved template. These are the names
    // registered in Meta; a missing one means that notification simply does not send.
    templates: {
      orderConfirmation: { type: String, default: "order_confirmation", trim: true },
      orderShipped: { type: String, default: "order_shipped", trim: true },
      orderDelivered: { type: String, default: "order_delivered", trim: true },
      orderCancelled: { type: String, default: "order_cancelled", trim: true },
    },
    templateLanguage: { type: String, default: "en", trim: true },

    // Which notifications actually go out. Off by default: a shop that turns the
    // connection on should not immediately start messaging every customer.
    notify: {
      onOrderPlaced: { type: Boolean, default: false },
      onOrderShipped: { type: Boolean, default: false },
      onOrderDelivered: { type: Boolean, default: false },
      onOrderCancelled: { type: Boolean, default: false },
    },

    lastVerifiedAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  { timestamps: true },
)

// There is only ever one connection, so reads and writes go through here rather than
// leaving each caller to decide what "the settings" means.
whatsappSettingsSchema.statics.load = async function loadSettings({ withSecrets = false } = {}) {
  const query = this.findOne({})
  if (withSecrets) query.select("+accessToken +verifyToken +appSecret")

  const existing = await query
  if (existing) return existing

  return this.create({})
}

const WhatsAppSettings = mongoose.model("WhatsAppSettings", whatsappSettingsSchema)

export default WhatsAppSettings
