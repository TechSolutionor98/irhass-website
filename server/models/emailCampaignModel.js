import mongoose from "mongoose"

export const AUDIENCE_LISTS = ["users", "newsletter", "callbacks", "bulk"]

/**
 * One bulk send.
 *
 * `html` and `subject` are snapshots taken when the campaign is queued, not links to
 * the template. Editing a template afterwards must not change the record of what was
 * actually sent -- that record is the only answer to "what did this customer receive?".
 *
 * A campaign that has been sent is immutable (see the route guard). To run it again,
 * duplicate it.
 */
const emailCampaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, default: "" },
    preheader: { type: String, default: "" },

    template: { type: mongoose.Schema.Types.ObjectId, ref: "EmailCampaignTemplate", default: null },
    templateName: { type: String, default: "" },
    // The rendered email, frozen at queue time.
    html: { type: String, default: "" },

    // Which saved lists to draw from, and any addresses picked by hand.
    audiences: [{ type: String, enum: AUDIENCE_LISTS }],
    manualEmails: [{ type: String, lowercase: true, trim: true }],

    status: {
      type: String,
      enum: ["draft", "queued", "sending", "paused", "sent", "failed", "cancelled"],
      default: "draft",
      index: true,
    },

    // Messages per minute. A loop that fires thousands at once is how a sending
    // domain gets blocked; the default is deliberately unhurried.
    ratePerMinute: { type: Number, default: 30, min: 1, max: 600 },

    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      unsubscribed: { type: Number, default: 0 },
    },

    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
)

const EmailCampaign = mongoose.model("EmailCampaign", emailCampaignSchema)

export default EmailCampaign
