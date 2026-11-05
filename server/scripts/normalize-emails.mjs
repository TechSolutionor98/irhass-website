/**
 * Lower-case every stored email address.
 *
 * The schema plugin (models/plugins/normalizeEmail.js) fixes everything written from
 * now on and makes every lookup case-insensitive. It cannot fix what is already in
 * the database: an account stored as "Fahad@Gmail.com" still carries that spelling,
 * and so does the newsletter row, the callback request and the review.
 *
 * Two reasons to clean it up rather than leave it to the plugin:
 *   - A campaign audience is deduplicated by address. "Fahad@Gmail.com" from the user
 *     list and "fahad@gmail.com" from the newsletter are one person who would
 *     otherwise receive two copies.
 *   - The unique index on users treats the two spellings as two accounts, so the same
 *     person can sign up twice.
 *
 * Dry run by default. See scripts/lib/bulkWrite.mjs for why.
 *
 *   node scripts/normalize-emails.mjs                      # report only
 *   node scripts/normalize-emails.mjs --write              # apply
 *   node scripts/normalize-emails.mjs --restore <file>     # undo
 */

import "dotenv/config"
import mongoose from "mongoose"
import connectDB from "../config/db.js"
import { runBulkScript } from "./lib/bulkWrite.mjs"

import User from "../models/userModel.js"
import NewsletterSubscriber from "../models/newsletterSubscriberModel.js"
import RequestCallback from "../models/requestCallbackModel.js"
import BulkPurchase from "../models/bulkPurchaseModel.js"
import Review from "../models/reviewModel.js"

const COLLECTIONS = [
  { model: User, label: "User" },
  { model: NewsletterSubscriber, label: "Newsletter" },
  { model: RequestCallback, label: "Callback" },
  { model: BulkPurchase, label: "Bulk purchase" },
  { model: Review, label: "Review" },
]

await connectDB()

await runBulkScript({
  name: "normalize-emails",
  plan: async () => {
    const entries = []

    for (const { model, label } of COLLECTIONS) {
      // .lean() so the plugin's setters do not quietly normalise the value before we
      // can see whether it needed normalising.
      const rows = await model.find({ email: { $exists: true, $ne: "" } }, "email").lean()

      for (const row of rows) {
        const current = String(row.email || "")
        const normalized = current.trim().toLowerCase()

        if (current === normalized) {
          entries.push({ model, _id: row._id, skip: true, label: `${label} ${current} (already correct)` })
          continue
        }

        entries.push({
          model,
          _id: row._id,
          label: `${label}: ${current}  ->  ${normalized}`,
          after: { email: normalized },
        })
      }
    }

    // A clash means two rows already exist for what is one address once case is
    // ignored. Merging accounts is a decision for a person, not for a script, so
    // these are reported and left alone.
    const seen = new Map()
    for (const entry of entries) {
      if (entry.skip) continue
      const key = `${entry.model.collection.collectionName}:${entry.after.email}`
      if (seen.has(key)) {
        entry.skip = true
        entry.label = `SKIPPED (would collide with an existing row) ${entry.label}`
      } else {
        seen.set(key, entry._id)
      }
    }

    return entries
  },
})

await mongoose.disconnect()
process.exit(0)
