import mongoose from "mongoose"

/**
 * A saved email design.
 *
 * `blocks` is the source of truth; `html` is a cached render of it, kept so a
 * campaign can be previewed and queued without re-rendering, and so the exact
 * markup that went out is recoverable. The renderer owns the conversion
 * (services/emailRenderer.js) -- nothing else writes `html`.
 *
 * The three built-in designs are NOT rows here. They live in
 * data/defaultEmailTemplates.js, so there is no edit path to them at all and no
 * way for one admin to wreck a starting point for everyone else.
 */
const emailCampaignTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, default: "" },
    // Shown after the subject line in most inboxes. Left out, clients pull the first
    // words of the body instead, which is usually "View in browser".
    preheader: { type: String, default: "" },
    blocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
    html: { type: String, default: "" },
    // Which built-in design this was started from, for display only.
    basedOn: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
)

const EmailCampaignTemplate = mongoose.model("EmailCampaignTemplate", emailCampaignTemplateSchema)

export default EmailCampaignTemplate
