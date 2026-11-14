import express from "express"
import asyncHandler from "express-async-handler"
import jwt from "jsonwebtoken"
import User from "../models/userModel.js"
import BackInStockSubscription from "../models/backInStockModel.js"
import {
  subscribeToBackInStock,
  checkSubscriptionStatus,
  unsubscribeFromBackInStock,
  notifyBackInStockSubscribers,
} from "../services/backInStockService.js"
import { sendBackInStockEmail, BRAND_ASSETS } from "../utils/emailService.js"
import { protect, admin } from "../middleware/authMiddleware.js"

const router = express.Router()

// Optional auth middleware: sets req.user if valid bearer token is provided, otherwise leaves it undefined
const optionalAuth = async (req, res, next) => {
  try {
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      const token = req.headers.authorization.split(" ")[1]
      if (token && token !== "null" && token !== "undefined") {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = await User.findById(decoded.id).select("-password")
      }
    }
  } catch {
    // Non-fatal for optional auth
  }
  next()
}

// @desc    Subscribe to back in stock alert
// @route   POST /api/back-in-stock/subscribe
// @access  Public
router.post(
  "/subscribe",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { productId, size, name, phone } = req.body
    let email = req.body.email

    // If user is logged in and didn't specify an email, use logged in account email
    if (req.user?.email && (!email || !String(email).trim())) {
      email = req.user.email
    }

    if (!email || !String(email).trim()) {
      res.status(400)
      throw new Error("Email address is required.")
    }

    if (!productId) {
      res.status(400)
      throw new Error("Product ID is required.")
    }

    const result = await subscribeToBackInStock({
      productId,
      email,
      name: name || req.user?.name || "",
      phone: phone || req.user?.phone || "",
      size,
      user: req.user || null,
    })

    res.status(201).json(result)
  }),
)

// @desc    Check subscription status
// @route   GET /api/back-in-stock/status/:productId
// @access  Public
router.get(
  "/status/:productId",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { productId } = req.params
    const email = req.query.email || req.user?.email
    const size = req.query.size || ""

    if (!email && !req.user?._id) {
      return res.json({ subscribed: false })
    }

    const status = await checkSubscriptionStatus(productId, email, size, req.user?._id)
    res.json(status)
  }),
)

// @desc    Unsubscribe from alert
// @route   POST /api/back-in-stock/unsubscribe
// @access  Public
router.post(
  "/unsubscribe",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { productId } = req.body
    const email = req.body.email || req.user?.email

    if (!productId || !email) {
      res.status(400)
      throw new Error("Product ID and email are required.")
    }

    const result = await unsubscribeFromBackInStock(productId, email)
    res.json(result)
  }),
)

// @desc    Manually trigger notification (Admin only)
// @route   POST /api/back-in-stock/trigger/:productId
// @access  Private/Admin
router.post(
  "/trigger/:productId",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const { productId } = req.params
    await notifyBackInStockSubscribers(productId)
    res.json({ success: true, message: "Alerts dispatched to waiting customers." })
  }),
)

// ==========================================
// ADMIN MANAGEMENT ROUTES FOR "NOTIFY ME"
// ==========================================

// @desc    Get all back in stock subscriptions (Admin only)
// @route   GET /api/back-in-stock/admin/list
// @access  Private/Admin
router.get(
  "/admin/list",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const { search = "", status = "all", productId } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit) || 25))
    const skip = (page - 1) * limit

    const filter = {}

    if (status === "pending") {
      filter.notified = false
    } else if (status === "notified") {
      filter.notified = true
    }

    if (productId) {
      filter.product = productId
    }

    if (search && String(search).trim()) {
      const term = String(search).trim()
      const regex = new RegExp(term, "i")
      filter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { size: regex },
        { "metadata.productName": regex },
      ]
    }

    const [total, subscriptions, totalCount, pendingCount, notifiedCount] = await Promise.all([
      BackInStockSubscription.countDocuments(filter),
      BackInStockSubscription.find(filter)
        .populate("product", "name image price slug stockStatus countInStock sizes isActive")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BackInStockSubscription.countDocuments(),
      BackInStockSubscription.countDocuments({ notified: false }),
      BackInStockSubscription.countDocuments({ notified: true }),
    ])

    res.json({
      subscriptions,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      stats: {
        total: totalCount,
        pending: pendingCount,
        notified: notifiedCount,
      },
    })
  }),
)

// @desc    Toggle or update notification status (Admin only)
// @route   PATCH /api/back-in-stock/admin/:id/status
// @access  Private/Admin
router.patch(
  "/admin/:id/status",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const sub = await BackInStockSubscription.findById(req.params.id)
    if (!sub) {
      res.status(404)
      throw new Error("Subscription not found.")
    }

    if (req.body.notified !== undefined) {
      sub.notified = Boolean(req.body.notified)
    } else {
      sub.notified = !sub.notified
    }

    sub.notifiedAt = sub.notified ? new Date() : null
    await sub.save()

    res.json({
      success: true,
      message: `Status updated to ${sub.notified ? "Notified" : "Pending"}.`,
      subscription: sub,
    })
  }),
)

// @desc    Manually send restock email to a single subscriber (Admin only)
// @route   POST /api/back-in-stock/admin/:id/send-email
// @access  Private/Admin
router.post(
  "/admin/:id/send-email",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const sub = await BackInStockSubscription.findById(req.params.id).populate("product")
    if (!sub) {
      res.status(404)
      throw new Error("Subscription not found.")
    }

    const cleanOrigin = (BRAND_ASSETS.websiteUrl || "https://irhaas.com").replace("://www.irhaas.com", "://irhaas.com")
    const productUrl = `${cleanOrigin}/product/${sub.product?.slug || sub.metadata?.slug || sub.product?._id || sub.product}`

    await sendBackInStockEmail({
      email: sub.email,
      name: sub.name,
      productName: sub.product?.name || sub.metadata?.productName || "Product",
      productImage: sub.product?.image || sub.metadata?.productImage || "",
      productPrice: sub.product?.price ?? sub.metadata?.productPrice ?? 0,
      productUrl,
      size: sub.size,
    })

    sub.notified = true
    sub.notifiedAt = new Date()
    await sub.save()

    res.json({
      success: true,
      message: `Restock alert email sent to ${sub.email}.`,
      subscription: sub,
    })
  }),
)

// @desc    Delete a back in stock subscription (Admin only)
// @route   DELETE /api/back-in-stock/admin/:id
// @access  Private/Admin
router.delete(
  "/admin/:id",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const sub = await BackInStockSubscription.findById(req.params.id)
    if (!sub) {
      res.status(404)
      throw new Error("Subscription not found.")
    }

    await sub.deleteOne()
    res.json({ success: true, message: "Subscription deleted successfully." })
  }),
)

export default router

