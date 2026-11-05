import mongoose from "mongoose"

/**
 * One row per person per campaign -- who, from which list, and what happened.
 *
 * The compound unique index is the whole point. Someone on the user list, the
 * newsletter list and the callback list is one human being, and must receive one
 * email. Relying on code to remember that it has already queued an address fails the
 * moment two requests race, a retry re-runs, or a campaign resumes after a restart.
 * The database refuses the duplicate instead, so "one person, one email" holds
 * however the queue is built.
 *
 * `sources` records every list the address appeared on, because the admin screen has
 * to be able to explain the difference between the number of rows across the lists
 * and the number of people who will actually be written to.
 */
const emailCampaignRecipientSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "EmailCampaign", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, default: "" },
    sources: [{ type: String }],

    status: {
      type: String,
      enum: ["pending", "sent", "failed", "unsubscribed"],
      default: "pending",
      index: true,
    },
    error: { type: String, default: "" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true },
)

emailCampaignRecipientSchema.index({ campaign: 1, email: 1 }, { unique: true })
// The sender asks for the next pending row over and over; this is that query.
emailCampaignRecipientSchema.index({ campaign: 1, status: 1 })

const EmailCampaignRecipient = mongoose.model("EmailCampaignRecipient", emailCampaignRecipientSchema)

export default EmailCampaignRecipient
