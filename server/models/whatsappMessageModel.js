import mongoose from "mongoose"

/**
 * Every message in and out, kept as the audit trail.
 *
 * `wamid` is WhatsApp's own id and is unique: delivery receipts and read receipts
 * arrive as separate webhook calls referring back to it, and Meta retries a webhook
 * it thinks failed. Without the unique index a retry would duplicate the message in
 * the agent's inbox.
 */
const whatsappMessageSchema = mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WhatsAppConversation",
      required: true,
      index: true,
    },
    phone: { type: String, required: true, index: true, trim: true },
    direction: { type: String, enum: ["in", "out"], required: true },

    wamid: { type: String, default: "", trim: true, index: true, sparse: true, unique: true },

    type: {
      type: String,
      enum: ["text", "template", "button", "interactive", "image", "document", "audio", "video", "system"],
      default: "text",
    },
    body: { type: String, default: "" },

    // For outbound templates: which one, and what was filled into it.
    templateName: { type: String, default: "" },
    templateParams: { type: [String], default: [] },

    status: {
      type: String,
      enum: ["queued", "sent", "delivered", "read", "failed"],
      default: "queued",
      index: true,
    },
    errorMessage: { type: String, default: "" },

    // Set when an agent sent it; absent for automated notifications.
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
  },
  { timestamps: true },
)

whatsappMessageSchema.index({ conversation: 1, createdAt: -1 })

const WhatsAppMessage = mongoose.model("WhatsAppMessage", whatsappMessageSchema)

export default WhatsAppMessage
