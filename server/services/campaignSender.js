/**
 * The paced sender.
 *
 * Three things here are not optional:
 *
 *   1. Pacing. A loop that hands thousands of messages to the SMTP server at once is
 *      how a sending domain gets rate-limited and then blocked. The default is 30 a
 *      minute, and the gap between messages is computed from it.
 *   2. Re-checking the opt-out immediately before each message. The queue may have
 *      been built an hour ago; somebody who clicks unsubscribe in message 200 must
 *      not receive message 900. The check is one indexed lookup per message.
 *   3. Recording the outcome per person, including the reason for a failure. "3,000
 *      sent" with no detail is not a record anybody can act on.
 *
 * A campaign runs in this process. If the process dies mid-send, the campaign is left
 * `sending` in the database and nothing is running -- so on boot `recoverInterrupted`
 * marks it `paused` rather than restarting it. Resuming is a decision a person makes:
 * an automatic restart after a crash is how a list gets mailed twice.
 */

import EmailCampaign from "../models/emailCampaignModel.js"
import EmailCampaignRecipient from "../models/emailCampaignRecipientModel.js"
import { isUnsubscribed } from "./emailAudience.js"
import { applyMergeFields } from "./emailMergeFields.js"
import { createUnsubscribeToken } from "../utils/unsubscribeToken.js"
import { getSiteOrigin } from "../utils/publicSiteUrl.js"
import { sendEmail } from "../utils/emailService.js"

// Campaign ids currently being worked through by this process.
const running = new Set()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const buildUnsubscribeUrl = (email, campaignId) =>
  `${getSiteOrigin()}/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(email, campaignId))}`

/**
 * Guarantee an unsubscribe link exists.
 *
 * A campaign without one is a complaint and, in most jurisdictions, unlawful. Rather
 * than refuse to send a template that forgot it, one is appended -- the shop still
 * gets its mail out and the recipient still gets their way out.
 */
export const ensureUnsubscribeLink = (html) => {
  const source = String(html || "")
  if (source.includes("{{unsubscribe_url}}")) return source

  const footer = `
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#faf6f0;">
  <tr><td align="center" style="padding:20px 32px;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#78716c;">
    You are receiving this because you shopped with us or signed up for our news.<br />
    <a href="{{unsubscribe_url}}" style="color:#78716c;text-decoration:underline;">Unsubscribe</a>
  </td></tr>
</table>`

  // Inside </body> when there is one, appended otherwise -- a stray table after
  // </html> is dropped by some clients.
  return source.includes("</body>") ? source.replace("</body>", `${footer}\n</body>`) : source + footer
}

/**
 * Build the queue. Rows are inserted unordered so one duplicate cannot abort the rest;
 * duplicate-key errors are the expected outcome for someone on several lists and are
 * counted, not thrown.
 *
 * @returns {Promise<number>} how many people were queued
 */
export const queueRecipients = async (campaignId, people = []) => {
  if (!people.length) return 0

  const docs = people.map((p) => ({
    campaign: campaignId,
    email: p.email,
    name: p.name || "",
    sources: p.sources || [],
    status: "pending",
  }))

  try {
    const inserted = await EmailCampaignRecipient.insertMany(docs, { ordered: false })
    return inserted.length
  } catch (error) {
    // E11000 on the (campaign, email) index means the address was already queued.
    // That is the index doing its job, so the inserts that did succeed still count.
    if (error?.writeErrors || error?.code === 11000) {
      return error.result?.insertedCount ?? error.insertedDocs?.length ?? 0
    }
    throw error
  }
}

const refreshStats = async (campaignId) => {
  const counts = await EmailCampaignRecipient.aggregate([
    { $match: { campaign: campaignId } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ])

  const stats = { total: 0, sent: 0, failed: 0, unsubscribed: 0 }
  for (const row of counts) {
    stats.total += row.n
    if (row._id === "sent") stats.sent = row.n
    if (row._id === "failed") stats.failed = row.n
    if (row._id === "unsubscribed") stats.unsubscribed = row.n
  }

  await EmailCampaign.updateOne({ _id: campaignId }, { $set: { stats } })
  return stats
}

/**
 * Work through a campaign's pending recipients.
 *
 * Safe to call twice: the second call sees the id in `running` and returns.
 */
export const runCampaign = async (campaignId) => {
  const id = String(campaignId)
  if (running.has(id)) return
  running.add(id)

  try {
    const campaign = await EmailCampaign.findById(campaignId)
    if (!campaign) return

    const perMinute = Math.max(1, Math.min(600, Number(campaign.ratePerMinute) || 30))
    const gapMs = Math.floor(60000 / perMinute)

    const html = ensureUnsubscribeLink(campaign.html)
    const subject = campaign.subject || campaign.name

    await EmailCampaign.updateOne(
      { _id: campaign._id },
      { $set: { status: "sending", startedAt: campaign.startedAt || new Date(), lastError: "" } },
    )

    for (;;) {
      // Re-read the status each pass so Pause takes effect within one message rather
      // than at the end of the run.
      const current = await EmailCampaign.findById(campaign._id, "status").lean()
      if (!current || current.status !== "sending") break

      const next = await EmailCampaignRecipient.findOneAndUpdate(
        { campaign: campaign._id, status: "pending" },
        { $set: { status: "pending" } },
        { sort: { createdAt: 1 } },
      )
      if (!next) break

      // Checked again here, not just when the queue was built.
      if (await isUnsubscribed(next.email)) {
        next.status = "unsubscribed"
        next.error = "Opted out before this message was sent"
        await next.save()
        continue
      }

      const unsubscribeUrl = buildUnsubscribeUrl(next.email, String(campaign._id))
      const personalised = applyMergeFields(html, {
        name: next.name,
        email: next.email,
        unsubscribeUrl,
      })

      try {
        await sendEmail(next.email, applyMergeFields(subject, { name: next.name, email: next.email }), personalised, "support", {
          headers: {
            // One-click: the inbox unsubscribes on the recipient's behalf with a POST,
            // without making them open the mail and hunt for the link.
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        })
        next.status = "sent"
        next.sentAt = new Date()
        next.error = ""
      } catch (error) {
        next.status = "failed"
        // The reason, not just the fact. "Mailbox full" and "domain does not exist"
        // call for completely different responses.
        next.error = String(error?.message || error).slice(0, 500)
      }

      await next.save()
      await refreshStats(campaign._id)
      await sleep(gapMs)
    }

    const stats = await refreshStats(campaign._id)
    const remaining = await EmailCampaignRecipient.countDocuments({ campaign: campaign._id, status: "pending" })
    const latest = await EmailCampaign.findById(campaign._id, "status").lean()

    if (!remaining && latest?.status === "sending") {
      await EmailCampaign.updateOne(
        { _id: campaign._id },
        { $set: { status: stats.sent > 0 ? "sent" : "failed", finishedAt: new Date() } },
      )
    }
  } catch (error) {
    console.error("[campaignSender] run failed:", error)
    await EmailCampaign.updateOne(
      { _id: campaignId },
      { $set: { status: "paused", lastError: String(error?.message || error).slice(0, 500) } },
    ).catch(() => {})
  } finally {
    running.delete(id)
  }
}

export const isRunning = (campaignId) => running.has(String(campaignId))

/**
 * Called once on boot.
 *
 * A campaign left `sending` means the process died partway through it. Nothing is
 * running, so it is marked paused and waits for a person. Restarting it here would
 * mean a crash loop mails the same list over and over.
 */
export const recoverInterrupted = async () => {
  const result = await EmailCampaign.updateMany(
    { status: "sending" },
    { $set: { status: "paused", lastError: "Interrupted by a server restart — resume when ready." } },
  )
  if (result.modifiedCount) {
    console.log(`[campaignSender] ${result.modifiedCount} interrupted campaign(s) left paused for review`)
  }
  return result.modifiedCount
}

export default { runCampaign, queueRecipients, recoverInterrupted, ensureUnsubscribeLink, buildUnsubscribeUrl, isRunning }
