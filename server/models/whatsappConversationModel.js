import mongoose from "mongoose"

/**
 * One thread per customer phone number.
 *
 * `serviceWindowExpiresAt` is the whole reason this collection exists. WhatsApp only
 * allows free-form replies for 24 hours after the customer's last message; outside
 * that window a business may send approved templates only. Storing the deadline lets
 * the agent inbox grey out the reply box instead of letting someone write a message
 * that Meta will reject -- repeated rejected sends are what damages a number's
 * quality rating.
 */
const whatsappConversationSchema = mongoose.Schema(
  {
    // E.164 without the plus, as WhatsApp returns it: 923214980835.
    phone: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, default: "", trim: true },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },

    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, default: "", trim: true },
    lastDirection: { type: String, enum: ["in", "out"], default: "in" },

    unreadCount: { type: Number, default: 0 },

    // Set from the customer's most recent inbound message.
    serviceWindowExpiresAt: { type: Date, default: null },

    // A customer who replies STOP is never messaged again. Honoured before every
    // send, including automated order notifications.
    optedOut: { type: Boolean, default: false },
    optedOutAt: { type: Date, default: null },

    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
)

whatsappConversationSchema.virtual("isWindowOpen").get(function isWindowOpen() {
  return Boolean(this.serviceWindowExpiresAt && this.serviceWindowExpiresAt > new Date())
})

whatsappConversationSchema.set("toJSON", { virtuals: true })
whatsappConversationSchema.set("toObject", { virtuals: true })

const WhatsAppConversation = mongoose.model("WhatsAppConversation", whatsappConversationSchema)

export default WhatsAppConversation
