/**
 * Bulk Mails: pick who, pick a design, review, send.
 *
 * The guards that matter are the ones a hurried admin would otherwise walk straight
 * past -- a sent campaign cannot be edited, a campaign cannot be queued twice, and
 * the number shown before sending is the number of people, not the number of rows.
 */

import express from "express"
import asyncHandler from "express-async-handler"
import { protect, admin } from "../middleware/authMiddleware.js"
import EmailCampaign, { AUDIENCE_LISTS } from "../models/emailCampaignModel.js"
import EmailCampaignRecipient from "../models/emailCampaignRecipientModel.js"
import EmailCampaignTemplate from "../models/emailCampaignTemplateModel.js"
import EmailUnsubscribe from "../models/emailUnsubscribeModel.js"
import { resolveAudience, listAllContacts, AUDIENCE_LABELS } from "../services/emailAudience.js"
import { runCampaign, queueRecipients, ensureUnsubscribeLink, buildUnsubscribeUrl } from "../services/campaignSender.js"
import { renderEmail } from "../services/emailRenderer.js"
import { applyMergeFields } from "../services/emailMergeFields.js"
import { normalizeEmail } from "../utils/unsubscribeToken.js"
import { sendEmail } from "../utils/emailService.js"

const router = express.Router()
router.use(protect, admin)

// Statuses after which the campaign is a record of what happened, not a plan.
const LOCKED = new Set(["sending", "sent"])

/* ----------------------------------------------------------------- audience -- */

/**
 * The honest count.
 *
 * Returns the rows across the chosen lists AND the number of people, because they are
 * different numbers and only one of them is how many emails get sent.
 */
// @route   POST /api/email-campaigns/audience/preview
router.post(
  "/audience/preview",
  asyncHandler(async (req, res) => {
    const { audiences = [], manualEmails = [] } = req.body
    const result = await resolveAudience(audiences, manualEmails)

    res.json({
      people: result.people.length,
      rowsAcrossLists: result.rowsAcrossLists,
      overlapping: result.overlapping,
      unsubscribed: result.unsubscribed,
      perList: result.perList,
      labels: AUDIENCE_LABELS,
      // Enough to eyeball, not the whole list -- some of these run to thousands.
      sample: result.people.slice(0, 25),
    })
  }),
)

// @desc    Every contact the shop holds, for picking addresses by hand
// @route   GET /api/email-campaigns/contacts
router.get(
  "/contacts",
  asyncHandler(async (req, res) => {
    res.json(await listAllContacts())
  }),
)

/* ---------------------------------------------------------------- campaigns -- */

// @route   GET /api/email-campaigns
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const campaigns = await EmailCampaign.find({}, "-html").sort({ createdAt: -1 }).lean()
    res.json(campaigns)
  }),
)

// @route   GET /api/email-campaigns/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const campaign = await EmailCampaign.findById(req.params.id).lean()
    if (!campaign) return res.status(404).json({ message: "Campaign not found" })
    res.json(campaign)
  }),
)

// @desc    Per-person outcomes, filterable by status
// @route   GET /api/email-campaigns/:id/recipients
router.get(
  "/:id/recipients",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || "").trim()
    const filter = { campaign: req.params.id }
    if (["pending", "sent", "failed", "unsubscribed"].includes(status)) filter.status = status

    const recipients = await EmailCampaignRecipient.find(filter)
      .sort({ updatedAt: -1 })
      .limit(1000)
      .lean()

    res.json(recipients)
  }),
)

// @route   POST /api/email-campaigns
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, subject, preheader, template, audiences, manualEmails, ratePerMinute } = req.body

    const campaign = await EmailCampaign.create({
      name: String(name || "Untitled campaign").trim(),
      subject: String(subject || ""),
      preheader: String(preheader || ""),
      template: template || null,
      audiences: (audiences || []).filter((a) => AUDIENCE_LISTS.includes(a)),
      manualEmails: (manualEmails || []).map(normalizeEmail).filter(Boolean),
      ratePerMinute: Number(ratePerMinute) || 30,
      status: "draft",
      createdBy: req.user?._id || null,
    })

    res.status(201).json(campaign)
  }),
)

// @desc    Update a draft
// @route   PUT /api/email-campaigns/:id
router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const campaign = await EmailCampaign.findById(req.params.id)
    if (!campaign) return res.status(404).json({ message: "Campaign not found" })

    // A sent campaign is the record of what went out. Changing it would make that
    // record a lie, so it is refused and the admin is pointed at Duplicate instead.
    if (LOCKED.has(campaign.status)) {
      return res.status(409).json({
        message: `This campaign is ${campaign.status} and can no longer be edited. Duplicate it to make a new one.`,
      })
    }

    const { name, subject, preheader, template, audiences, manualEmails, ratePerMinute } = req.body
    if (name !== undefined) campaign.name = String(name).trim()
    if (subject !== undefined) campaign.subject = String(subject)
    if (preheader !== undefined) campaign.preheader = String(preheader)
    if (template !== undefined) campaign.template = template || null
    if (Array.isArray(audiences)) campaign.audiences = audiences.filter((a) => AUDIENCE_LISTS.includes(a))
    if (Array.isArray(manualEmails)) campaign.manualEmails = manualEmails.map(normalizeEmail).filter(Boolean)
    if (ratePerMinute !== undefined) campaign.ratePerMinute = Number(ratePerMinute) || 30

    await campaign.save()
    res.json(campaign)
  }),
)

// @desc    Copy a campaign back to a draft -- the way to re-run a sent one
// @route   POST /api/email-campaigns/:id/duplicate
router.post(
  "/:id/duplicate",
  asyncHandler(async (req, res) => {
    const source = await EmailCampaign.findById(req.params.id).lean()
    if (!source) return res.status(404).json({ message: "Campaign not found" })

    const copy = await EmailCampaign.create({
      name: `${source.name} (copy)`,
      subject: source.subject,
      preheader: source.preheader,
      template: source.template,
      templateName: source.templateName,
      audiences: source.audiences,
      manualEmails: source.manualEmails,
      ratePerMinute: source.ratePerMinute,
      // Deliberately not the html: the copy re-renders from the design when it is
      // queued, so a correction made to the template since is picked up.
      status: "draft",
      createdBy: req.user?._id || null,
    })

    res.status(201).json(copy)
  }),
)

// @route   DELETE /api/email-campaigns/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const campaign = await EmailCampaign.findById(req.params.id)
    if (!campaign) return res.status(404).json({ message: "Campaign not found" })
    if (campaign.status === "sending") {
      return res.status(409).json({ message: "Pause the campaign before deleting it." })
    }

    await EmailCampaignRecipient.deleteMany({ campaign: campaign._id })
    await campaign.deleteOne()
    res.json({ message: "Campaign deleted" })
  }),
)

/* ------------------------------------------------------------------ sending -- */

/**
 * Send a single test to one address.
 *
 * Does not touch the recipient list and is not recorded as part of the campaign --
 * it exists so an admin can look at the thing in a real inbox before committing.
 */
// @route   POST /api/email-campaigns/:id/test
router.post(
  "/:id/test",
  asyncHandler(async (req, res) => {
    const to = normalizeEmail(req.body.email)
    if (!to) return res.status(400).json({ message: "A valid address is required" })

    const campaign = await EmailCampaign.findById(req.params.id).lean()
    if (!campaign) return res.status(404).json({ message: "Campaign not found" })

    const html = await renderCampaignHtml(campaign)
    if (!html) return res.status(400).json({ message: "Choose a design before sending a test" })

    const personalised = applyMergeFields(ensureUnsubscribeLink(html), {
      name: "Test recipient",
      email: to,
      unsubscribeUrl: buildUnsubscribeUrl(to, String(campaign._id)),
    })

    await sendEmail(to, `[TEST] ${campaign.subject || campaign.name}`, personalised, "support")
    res.json({ message: `Test sent to ${to}` })
  }),
)

/**
 * Queue and start.
 *
 * The HTML is frozen onto the campaign here. From this moment the design can be
 * edited freely without changing what this send puts in anybody's inbox.
 */
// @route   POST /api/email-campaigns/:id/send
router.post(
  "/:id/send",
  asyncHandler(async (req, res) => {
    const campaign = await EmailCampaign.findById(req.params.id)
    if (!campaign) return res.status(404).json({ message: "Campaign not found" })
    if (LOCKED.has(campaign.status)) {
      return res.status(409).json({ message: `This campaign is already ${campaign.status}.` })
    }

    const html = await renderCampaignHtml(campaign)
    if (!html) return res.status(400).json({ message: "Choose a design before sending" })

    const { people } = await resolveAudience(campaign.audiences, campaign.manualEmails)
    if (!people.length) {
      return res.status(400).json({ message: "Nobody to send to — every address is opted out or the lists are empty." })
    }

    campaign.html = html
    campaign.status = "queued"
    campaign.lastError = ""
    await campaign.save()

    await queueRecipients(campaign._id, people)

    // Started in the background: a send of thousands at 30 a minute runs for hours,
    // and the admin's browser is not going to wait for it.
    runCampaign(campaign._id).catch((error) => console.error("[campaign] start failed:", error))

    res.json({ message: `Sending to ${people.length} people`, queued: people.length })
  }),
)

// @route   POST /api/email-campaigns/:id/pause
router.post(
  "/:id/pause",
  asyncHandler(async (req, res) => {
    const campaign = await EmailCampaign.findById(req.params.id)
    if (!campaign) return res.status(404).json({ message: "Campaign not found" })
    if (!["sending", "queued"].includes(campaign.status)) {
      return res.status(409).json({ message: "Only a running campaign can be paused." })
    }

    // The sender re-reads this between messages, so it stops within one message.
    campaign.status = "paused"
    await campaign.save()
    res.json({ message: "Paused", status: campaign.status })
  }),
)

// @route   POST /api/email-campaigns/:id/resume
router.post(
  "/:id/resume",
  asyncHandler(async (req, res) => {
    const campaign = await EmailCampaign.findById(req.params.id)
    if (!campaign) return res.status(404).json({ message: "Campaign not found" })
    if (campaign.status !== "paused") {
      return res.status(409).json({ message: "Only a paused campaign can be resumed." })
    }

    const remaining = await EmailCampaignRecipient.countDocuments({ campaign: campaign._id, status: "pending" })
    if (!remaining) {
      campaign.status = "sent"
      campaign.finishedAt = new Date()
      await campaign.save()
      return res.json({ message: "Nothing left to send — marked as sent.", status: campaign.status })
    }

    campaign.status = "sending"
    campaign.lastError = ""
    await campaign.save()

    runCampaign(campaign._id).catch((error) => console.error("[campaign] resume failed:", error))
    res.json({ message: `Resuming — ${remaining} still to send`, status: campaign.status })
  }),
)

/* ------------------------------------------------------------- unsubscribes -- */

// @desc    The opt-out list, for the admin to see and search
// @route   GET /api/email-campaigns/unsubscribes/list
router.get(
  "/unsubscribes/list",
  asyncHandler(async (req, res) => {
    res.json(await EmailUnsubscribe.find({}).sort({ createdAt: -1 }).limit(1000).lean())
  }),
)

/* ------------------------------------------------------------------ helpers -- */

/**
 * The campaign's HTML: re-rendered from its design if it has one, so a correction
 * made to the design after the campaign was drafted is picked up.
 */
async function renderCampaignHtml(campaign) {
  if (campaign.template) {
    const template = await EmailCampaignTemplate.findById(campaign.template).lean()
    if (template) {
      return renderEmail({
        subject: campaign.subject || template.subject,
        preheader: campaign.preheader || template.preheader,
        blocks: template.blocks,
      })
    }
  }
  return campaign.html || ""
}

export default router
