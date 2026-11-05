import mongoose from "mongoose";

import normalizeEmailPlugin from "./plugins/normalizeEmail.js"
const newsletterSubscriberSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  preferences: [{ type: String, enum: ["all", "promotions", "events"] }],
  createdAt: { type: Date, default: Date.now },
});

// Addresses are matched case-insensitively. See the plugin for why the schema's
// own `lowercase: true` is not enough on its own.
newsletterSubscriberSchema.plugin(normalizeEmailPlugin)

const NewsletterSubscriber = mongoose.model("NewsletterSubscriber", newsletterSubscriberSchema);

export default NewsletterSubscriber; 