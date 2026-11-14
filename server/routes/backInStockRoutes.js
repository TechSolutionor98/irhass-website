import express from "express"
import asyncHandler from "express-async-handler"
import jwt from "jsonwebtoken"
import User from "../models/userModel.js"
import {
  subscribeToBackInStock,
  checkSubscriptionStatus,
  unsubscribeFromBackInStock,
  notifyBackInStockSubscribers,
} from "../services/backInStockService.js"
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
    const { productId, size, name } = req.body
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

    if (!email) {
      return res.json({ subscribed: false })
    }

    const status = await checkSubscriptionStatus(productId, email, size)
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

export default router

