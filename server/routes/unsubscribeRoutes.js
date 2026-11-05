/**
 * Opting out.
 *
 * Public by necessity: the recipient is not signed in, may never have been, and may
 * be reading on a device that has never visited the site. What makes it safe is the
 * signature on the token -- the address is not taken from the URL unless the URL was
 * issued by us.
 *
 * Three ways in, all landing in the same place:
 *   GET  /api/unsubscribe?token=   the link in the footer, via the storefront page
 *   POST /api/unsubscribe          the page confirming
 *   POST /api/unsubscribe/one-click  the inbox's own button (RFC 8058)
 */

import express from "express"
import asyncHandler from "express-async-handler"
import EmailUnsubscribe from "../models/emailUnsubscribeModel.js"
import EmailCampaignRecipient from "../models/emailCampaignRecipientModel.js"
import { verifyUnsubscribeToken } from "../utils/unsubscribeToken.js"
import { protect } from "../middleware/authMiddleware.js"

const router = express.Router()

/**
 * Record the opt-out.
 *
 * Idempotent: clicking the link twice, or an inbox firing one-click after the person
 * already used the page, must not fail. Any message still queued for them in the
 * campaign they came from is marked so it will not be sent.
 */
const recordUnsubscribe = async (email, campaignId, source, reason = "") => {
  await EmailUnsubscribe.updateOne(
    { email },
    {
      $setOnInsert: {
        email,
        campaign: campaignId || null,
        source,
        reason: String(reason || "").slice(0, 300),
      },
    },
    { upsert: true },
  )

  // Not strictly required -- the sender checks the opt-out list before every message
  // anyway -- but it makes the campaign's own report tell the truth immediately.
  await EmailCampaignRecipient.updateMany(
    { email, status: "pending" },
    { $set: { status: "unsubscribed", error: "Opted out" } },
  )
}

// @desc    Who a token belongs to, so the page can say which address it is about
// @route   GET /api/unsubscribe
// @access  Public
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const payload = verifyUnsubscribeToken(req.query.token)
    if (!payload) {
      return res.status(400).json({ message: "This unsubscribe link is not valid or has been altered." })
    }

    const already = await EmailUnsubscribe.exists({ email: payload.email })
    res.json({ email: payload.email, alreadyUnsubscribed: Boolean(already) })
  }),
)

// @desc    Confirm the opt-out
// @route   POST /api/unsubscribe
// @access  Public
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = verifyUnsubscribeToken(req.body.token)
    if (!payload) {
      return res.status(400).json({ message: "This unsubscribe link is not valid or has been altered." })
    }

    await recordUnsubscribe(payload.email, payload.campaignId, "link", req.body.reason)
    res.json({ message: `${payload.email} has been removed from our mailing list.`, email: payload.email })
  }),
)

/**
 * One-click, as Gmail and Outlook call it.
 *
 * They POST here from the List-Unsubscribe-Post header without the person opening
 * the email. There is no confirmation step by design -- the specification requires
 * the opt-out to take effect on this single request.
 */
// @route   POST /api/unsubscribe/one-click
// @access  Public (mail provider)
router.post(
  "/one-click",
  asyncHandler(async (req, res) => {
    const token = req.query.token || req.body?.token
    const payload = verifyUnsubscribeToken(token)
    // A mail provider is not a person and cannot act on an error page, so an
    // unreadable token still gets a 200. Nothing is recorded.
    if (!payload) return res.status(200).send("OK")

    await recordUnsubscribe(payload.email, payload.campaignId, "one-click")
    res.status(200).send("OK")
  }),
)

/* ------------------------------------------------- signed-in preferences -- */

/**
 * A signed-in shopper's own email setting.
 *
 * Separate from the token flow because there is no token: the person is on the site,
 * in their profile, and the address comes from their session rather than a URL.
 *
 * Resubscribing matters. Someone who opted out during a busy week and later wants the
 * news back has, without this, no way to ask for it -- the opt-out is deliberately
 * absolute, so nothing else will re-add them. Leaving that as an email to support
 * means most people simply never come back on.
 */

// @desc    Whether this account's address is on the opt-out list
// @route   GET /api/unsubscribe/me
// @access  Private
router.get(
  "/me",
  protect,
  asyncHandler(async (req, res) => {
    const email = String(req.user?.email || "").trim().toLowerCase()
    if (!email) return res.status(400).json({ message: "This account has no email address." })

    const record = await EmailUnsubscribe.findOne({ email }).lean()
    res.json({
      email,
      subscribed: !record,
      unsubscribedAt: record?.createdAt || null,
      reason: record?.reason || "",
    })
  }),
)

// @desc    Opt in or out from the profile page
// @route   PUT /api/unsubscribe/me
// @access  Private
router.put(
  "/me",
  protect,
  asyncHandler(async (req, res) => {
    const email = String(req.user?.email || "").trim().toLowerCase()
    if (!email) return res.status(400).json({ message: "This account has no email address." })

    const subscribe = Boolean(req.body?.subscribed)

    if (subscribe) {
      // Resubscribing is just removing the suppression -- the lists themselves were
      // never edited, so the person returns to exactly the audiences they were in.
      await EmailUnsubscribe.deleteOne({ email })
      return res.json({ email, subscribed: true, message: "You will receive our news again." })
    }

    await recordUnsubscribe(email, null, "admin", req.body?.reason)
    res.json({ email, subscribed: false, message: "You have been removed from our mailing list." })
  }),
)

export default router
