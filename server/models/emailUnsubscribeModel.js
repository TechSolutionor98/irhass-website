import mongoose from "mongoose"

/**
 * The opt-out list.
 *
 * Kept as its own collection rather than a flag on the user, because most of the
 * people a campaign reaches are not users: newsletter subscribers, callback
 * requests and bulk-purchase enquiries are all just addresses. An opt-out has to
 * apply to the address, whatever list it came from, or someone who unsubscribes
 * keeps hearing from us through another one.
 */
const emailUnsubscribeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    reason: { type: String, default: "" },
    // Which campaign the opt-out link came from, when it came from one.
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "EmailCampaign", default: null },
    // "link" (clicked unsubscribe), "one-click" (List-Unsubscribe-Post), "admin".
    source: { type: String, enum: ["link", "one-click", "admin"], default: "link" },
  },
  { timestamps: true },
)

const EmailUnsubscribe = mongoose.model("EmailUnsubscribe", emailUnsubscribeSchema)

export default EmailUnsubscribe
