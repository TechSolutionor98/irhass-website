import express from "express"
import asyncHandler from "express-async-handler"
import { checkLineStock } from "../utils/stockGuard.js"
import mongoose from "mongoose"
import Order from "../models/orderModel.js"
import DeliveryCharge from "../models/deliveryChargeModel.js"
import Product from "../models/productModel.js"
import BuyerProtection from "../models/buyerProtectionModel.js"
import Coupon from "../models/couponModel.js"
import { protect, admin } from "../middleware/authMiddleware.js"
import { logActivity } from "../middleware/permissionMiddleware.js"
import { sendOrderPlacedEmail, sendOrderStatusUpdateEmail, sendGuestAccountCreatedEmail } from "../utils/emailService.js"
import { sendOrderPlaced as sendWhatsAppOrderPlaced, sendOrderStatusUpdate as sendWhatsAppStatusUpdate } from "../services/whatsappNotifications.js"
import { postOrderOut, postOrderReturn } from "../services/stockLedger.js"
import crypto from "crypto"
import { resolveAppDiscountForOrder } from "../services/appDiscountService.js"
import Country from "../models/countryModel.js"
import Settings from "../models/settingsModel.js"
import { resolveCountryPaymentMethods } from "./countryPaymentMethodRoutes.js"
import { selectDeliveryMethod, describeDeliveryBlock } from "../utils/deliveryCharge.js"
import { resolvePaymentCharges } from "../utils/paymentCharges.js"
import LoyaltyTransaction from "../models/loyaltyTransactionModel.js"
import User from "../models/userModel.js"
import {
  getLoyaltySettings,
  getCategoryRuleMap,
  computeRedemption,
  calculateEarnedPoints,
  redeemPointsForOrder,
  recordPendingEarn,
  syncOrderLoyaltyForStatus,
  getUserLoyaltySummary,
} from "../utils/loyalty.js"
import ReferralReward from "../models/referralRewardModel.js"


/**
 * Give a guest who just ordered an account, and email them the password.
 *
 * Runs after the order is saved and never throws: the customer has already placed
 * (and possibly paid for) the order, so a mail outage or a duplicate email must not
 * turn a successful checkout into a failure. An address that already has an account
 * is left alone -- overwriting a known customer's password from a checkout form
 * would be an account takeover.
 */
const createAccountForGuest = async ({ email, name, phone, address }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase()
  if (!normalizedEmail) return

  const existing = await User.findOne({ email: normalizedEmail })
  if (existing) return

  // base64 of 9 random bytes, trimmed to 12 chars: mixed case and digits, and short
  // enough to retype off a phone screen.
  const password = crypto.randomBytes(9).toString("base64").slice(0, 12)

  const resolvedName = name || normalizedEmail.split("@")[0]

  // Two address shapes exist on the user: `address` (one object, shown on the profile)
  // and `addresses` (the list the checkout address picker reads). Writing only the
  // first meant the delivery address never came back on the next visit, so both are
  // filled from the same order.
  const addressFields = address
    ? {
        address: {
          street: address.address || address.street || "",
          city: address.city || "",
          state: address.state || "",
          zipCode: address.zipCode || "",
          country: address.country || "Pakistan",
        },
        addresses: [
          {
            name: resolvedName,
            phone: phone || address.phone || "",
            email: normalizedEmail,
            address: address.address || address.street || "",
            city: address.city || "",
            state: address.state || "",
            zipCode: address.zipCode || "",
            country: address.country || "Pakistan",
            isDefault: true,
          },
        ],
      }
    : {}

  const user = await User.create({
    name: resolvedName,
    email: normalizedEmail,
    password,
    // They proved control of the address by receiving the order confirmation at it.
    isEmailVerified: true,
    phone: phone || "",
    ...addressFields,
  })

  try {
    await sendGuestAccountCreatedEmail(normalizedEmail, user.name, password)
    console.log(`[GUEST ACCOUNT] Created and credentials emailed to ${normalizedEmail}`)
  } catch (error) {
    // The password only ever existed in that email. An account left behind with a
    // password nobody has is worse than no account: the address is now taken, so the
    // shopper can neither log in nor have one created on their next order. Roll it
    // back and let the next order try again.
    await User.deleteOne({ _id: user._id }).catch(() => {})
    console.error(
      `[GUEST ACCOUNT] Mail failed for ${normalizedEmail}; account rolled back so a later order can retry:`,
      error.message,
    )
  }
}

// Mirrors DEFAULT_VAT_RATE in client/src/utils/vat.js: the rate an invoice falls back to
// when a document records none of its own. Zero because this store sells in Pakistan
// and quotes prices the customer pays as-is.
const DEFAULT_VAT_RATE = 0
import { sendMetaPurchase, readMetaAttribution } from "../utils/metaConversions.js"
import {
  getReferralSettings,
  computeRewardDiscount,
  claimRewardForOrder,
  releaseClaimedReward,
  hasPreviousOrder,
  syncOrderReferralForStatus,
} from "../utils/referral.js"

const router = express.Router()
const ORDER_DOCUMENT_QUERY = {
  $or: [{ documentType: "order" }, { documentType: { $exists: false } }],
}

const resolveOrderSource = (payloadSource, headers = {}) => {
  const headerSource = headers["x-order-source"] || headers["x-client-source"]
  const normalized = String(payloadSource || headerSource || "")
    .trim()
    .toLowerCase()

  return normalized === "app" ? "app" : "web"
}

// Map every stored spelling of a payment method onto its canonical id.
const normalizePaymentMethodId = (value) => {
  const method = String(value || "").trim().toLowerCase()

  if (method === "cod" || method === "cash on delivery") return "cod"
  if (method === "card" || method === "credit card" || method === "debit card") return "card"
  if (method === "tamara") return "tamara"
  if (method === "tabby") return "tabby"

  return ""
}

// Work out which country an order belongs to, so its payment rules can be applied
// and its currency recorded. Falls back to the currency when the client did not
// send a country code.
const resolveOrderCountry = async ({ countryCode, currency, currencySymbol }) => {
  const fields = "code name currencyCode currencySymbol"

  try {
    const explicit = String(countryCode || "").trim().toUpperCase()
    if (explicit) {
      return await Country.findOne({ code: explicit }, fields).lean()
    }

    const currencyCode = String(currency || currencySymbol || "").trim().toUpperCase()
    if (!currencyCode) return null

    return await Country.findOne({ currencyCode }, fields).lean()
  } catch (error) {
    console.error("Failed to resolve order country:", error.message)
    return null
  }
}

const PAYMENT_METHOD_LABELS = {
  card: "Pay by Card",
  cod: "Cash on Delivery",
  tamara: "Tamara",
  tabby: "Tabby",
}

// Middleware to optionally protect routes (sets req.user if token exists)
const optionalProtect = asyncHandler(async (req, res, next) => {
  let token

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1]
      const jwt = await import('jsonwebtoken')
      const User = await import('../models/userModel.js')
      
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET)
      req.user = await User.default.findById(decoded.id).select('-password')
    } catch (error) {
      console.log('Optional auth failed:', error.message)
      // Don't throw error, just continue without user
    }
  }
  next()
})

// Helper function to get display name for payment method
// Undo a redemption that was debited but never made it onto an order. The ledger row is
// removed rather than offset, because it describes a checkout that did not happen.
const refundUnlinkedRedemption = async (transaction) => {
  if (!transaction?._id) return
  const removed = await LoyaltyTransaction.findOneAndDelete({ _id: transaction._id, order: null })
  // Only credit back if this call is the one that removed the row, so a retry cannot
  // refund the same points twice.
  if (!removed) return
  await User.updateOne({ _id: removed.user }, { $inc: { loyaltyPoints: Math.abs(removed.points) } })
}

const getPaymentMethodDisplay = (actualPaymentMethod, paymentMethod) => {
  const method = actualPaymentMethod || paymentMethod
  switch (method?.toLowerCase()) {
    case 'tabby':
      return 'Tabby'
    case 'tamara':
      return 'Tamara'
    case 'card':
      return 'Pay by Card'
    case 'cod':
    case 'cash on delivery':
      return 'Cash on Delivery'
    default:
      return paymentMethod || 'Cash on Delivery'
  }
}

// @desc    Create new order
// @route   POST /api/orders
// @access  Public (supports both authenticated and guest checkout)
router.post(
  "/",
  optionalProtect,
  asyncHandler(async (req, res) => {
    const {
      orderItems,
      shippingAddress,
      pickupDetails,
      deliveryType,
      itemsPrice,
      shippingPrice,
      deliveryChargeId,
      totalPrice,
      orderSource,
      customerNotes,
      paymentMethod,
      actualPaymentMethod,
      billingAddress,
      currency,
      currencySymbol,
      countryCode,
    } = req.body

    if (!orderItems || orderItems.length === 0) {
      res.status(400)
      throw new Error("No order items")
    }

    if (!deliveryType || !["home", "pickup"].includes(deliveryType)) {
      res.status(400)
      throw new Error("Invalid or missing delivery type")
    }

    if (deliveryType === "home") {
      // The post code is NOT required.
      //
      // The address form labels it "(optional)", and most Pakistani addresses are
      // given without one. It was required here anyway, so a shopper who believed
      // the label got a 400 from the server -- and the client-side check could be
      // skipped entirely on the card path, which meant the first they heard of it
      // was the order failing.
      const REQUIRED_ADDRESS_FIELDS = [
        ["name", "full name"],
        ["email", "email address"],
        ["phone", "phone number"],
        ["address", "street address"],
        ["city", "city"],
        ["state", "province"],
      ]

      // Named, not counted. "Missing shipping address details" sends someone back to
      // a form that looks filled in, with nothing marked and nothing to act on.
      const missing = shippingAddress
        ? REQUIRED_ADDRESS_FIELDS.filter(([key]) => !String(shippingAddress[key] || "").trim()).map(([, label]) => label)
        : REQUIRED_ADDRESS_FIELDS.map(([, label]) => label)

      if (missing.length) {
        res.status(400)
        throw new Error(
          missing.length === 1
            ? `Your delivery address is missing a ${missing[0]}.`
            : `Your delivery address is missing: ${missing.join(", ")}.`,
        )
      }
    }

    if (deliveryType === "pickup") {
      // Validate pickup details fields
      if (!pickupDetails || !pickupDetails.phone || !pickupDetails.location || !pickupDetails.storeId) {
        res.status(400)
        throw new Error("Missing pickup details for store pickup")
      }
    }

    const requestedShippingPrice = Number.isFinite(Number(shippingPrice)) ? Number(shippingPrice) : 0
    const normalizedItemsPrice = Number.isFinite(Number(itemsPrice)) ? Number(itemsPrice) : 0

    const normalizedOrderSource = resolveOrderSource(orderSource, req.headers)

    // Server-side validation of the country payment method rules.
    // The storefront hides disabled methods, but the rule is enforced here too so
    // a direct API call cannot pay by a method the country has switched off.
    const orderCountry = await resolveOrderCountry({ countryCode, currency, currencySymbol })
    const requestedPaymentMethod = normalizePaymentMethodId(actualPaymentMethod || paymentMethod)

    if (orderCountry?.code && requestedPaymentMethod) {
      const countryPaymentMethods = await resolveCountryPaymentMethods(orderCountry.code)

      if (!countryPaymentMethods.includes(requestedPaymentMethod)) {
        const available = countryPaymentMethods.map((m) => PAYMENT_METHOD_LABELS[m] || m).join(", ")
        res.status(400)
        throw new Error(
          `${PAYMENT_METHOD_LABELS[requestedPaymentMethod] || requestedPaymentMethod} is not available in this country. Available options: ${available}`,
        )
      }
    }

    // Server-side Recalculation & Validation of Items
    let calculatedItemsPrice = 0
    const verifiedOrderItems = []
    const requestedStockMap = new Map()
    // Loyalty needs the product document (for its earning rule) alongside the price
    // actually charged, so it is collected here rather than re-fetched later.
    const loyaltyEarnItems = []

    for (const item of orderItems) {
      if (item.isProtection) {
        // Buyer protection item
        const protection = await BuyerProtection.findById(item.protectionData)
        if (!protection || !protection.isActive) {
          res.status(400)
          throw new Error(`Invalid or inactive buyer protection item: ${item.name}`)
        }

        let protectionPrice = 0
        // Find parent item in the order
        const parentItem = verifiedOrderItems.find(
          (oi) => oi.product && oi.product.toString() === item.protectionFor?.toString()
        )
        if (parentItem) {
          const parentPrice = parentItem.price
          if (protection.pricingType === "percentage") {
            protectionPrice = (parentPrice * protection.pricePercentage) / 100
            if (protection.minPrice && protectionPrice < protection.minPrice) {
              protectionPrice = protection.minPrice
            }
            if (protection.maxPrice && protectionPrice > protection.maxPrice) {
              protectionPrice = protection.maxPrice
            }
          } else {
            protectionPrice = protection.price
          }
        } else {
          res.status(400)
          throw new Error(`Parent product for buyer protection item not found in order items`)
        }

        verifiedOrderItems.push({
          name: item.name,
          quantity: Number(item.quantity) || 1,
          image: item.image,
          price: protectionPrice,
          isProtection: true,
          protectionFor: item.protectionFor,
          protectionData: item.protectionData,
        })
        calculatedItemsPrice += protectionPrice * (Number(item.quantity) || 1)
      } else {
        // Regular product item
        const product = await Product.findById(item.product)
        if (!product || !product.isActive) {
          res.status(400)
          throw new Error(`Product not found or inactive: ${item.name}`)
        }

        let dbPrice = 0
        // The variation actually being bought, so stock and price are read from the
        // same row rather than one from the variation and the other from the parent.
        let chosenVariation = null
        let variationLabel = ""

        // Check DOS variation
        if (
          item.selectedDosIndex !== null &&
          item.selectedDosIndex !== undefined &&
          product.dosVariations &&
          product.dosVariations[item.selectedDosIndex]
        ) {
          const dosVar = product.dosVariations[item.selectedDosIndex]
          dbPrice = dosVar.offerPrice > 0 ? dosVar.offerPrice : dosVar.price
          chosenVariation = dosVar
          variationLabel = dosVar.dosType || ""
        }
        // Check Color variation
        else if (
          item.selectedColorIndex !== null &&
          item.selectedColorIndex !== undefined &&
          product.colorVariations &&
          product.colorVariations[item.selectedColorIndex]
        ) {
          const colorVar = product.colorVariations[item.selectedColorIndex]
          dbPrice = colorVar.offerPrice > 0 ? colorVar.offerPrice : colorVar.price
          chosenVariation = colorVar
          variationLabel = colorVar.color || ""
        }
        // Default product price
        else {
          dbPrice = product.offerPrice > 0 ? product.offerPrice : product.price
        }

        // Check Size variation
        let chosenSize = null
        if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
          if (item.selectedSizeData) {
            chosenSize = product.sizes.find(
              (s) =>
                (item.selectedSizeData.sizeId && String(s.size || s._id) === String(item.selectedSizeData.sizeId)) ||
                (item.selectedSizeData.code && s.code && s.code.toLowerCase() === String(item.selectedSizeData.code).toLowerCase()) ||
                (item.selectedSizeData.name && s.name && s.name.toLowerCase() === String(item.selectedSizeData.name).toLowerCase()),
            )
          }
          if (!chosenSize && item.selectedSizeIndex !== null && item.selectedSizeIndex !== undefined && product.sizes[item.selectedSizeIndex]) {
            chosenSize = product.sizes[item.selectedSizeIndex]
          }
        }

        if (chosenSize && Number(chosenSize.additionalPrice) > 0) {
          dbPrice += Number(chosenSize.additionalPrice)
        }

        // Nothing out of stock gets sold, however the request reached us.
        const stock = checkLineStock(product, chosenVariation, variationLabel, chosenSize)
        if (!stock.ok) {
          res.status(400)
          throw new Error(stock.reason)
        }

        const quantity = Number(item.quantity) || 1

        const stockKey = chosenSize
          ? `${product._id}_size_${chosenSize.size || chosenSize._id || chosenSize.code}`
          : (chosenVariation ? `${product._id}_var_${chosenVariation.sku || chosenVariation.color || chosenVariation.dosType}` : `${product._id}_general`)
        const cumulativeQty = (requestedStockMap.get(stockKey) || 0) + quantity
        requestedStockMap.set(stockKey, cumulativeQty)

        if (chosenSize && chosenSize.countInStock !== undefined && cumulativeQty > Number(chosenSize.countInStock)) {
          const sizeLabel = chosenSize.code || chosenSize.name || ""
          res.status(400)
          throw new Error(`Only ${chosenSize.countInStock} items available for ${product.name}${sizeLabel ? ` (Size: ${sizeLabel})` : ""}`)
        }

        if (!chosenSize && !chosenVariation && product.countInStock !== undefined && product.countInStock !== null && product.stockStatus !== "PreOrder") {
          if (cumulativeQty > Number(product.countInStock)) {
            res.status(400)
            throw new Error(`Only ${product.countInStock} items available for ${product.name}`)
          }
        }
        
        const verifiedItem = {
          name: product.name,
          quantity,
          image: product.image,
          price: dbPrice,
          product: product._id,
        }

        if (item.selectedColorIndex !== null && item.selectedColorIndex !== undefined) {
          verifiedItem.selectedColorIndex = item.selectedColorIndex
          const cv = product.colorVariations[item.selectedColorIndex]
          if (cv) {
            verifiedItem.selectedColorData = {
              color: cv.color,
              image: cv.image,
              price: cv.price,
              offerPrice: cv.offerPrice,
              sku: cv.sku,
            }
          }
        }

        if (item.selectedDosIndex !== null && item.selectedDosIndex !== undefined) {
          verifiedItem.selectedDosIndex = item.selectedDosIndex
          const dv = product.dosVariations[item.selectedDosIndex]
          if (dv) {
            verifiedItem.selectedDosData = {
              dosType: dv.dosType,
              image: dv.image,
              price: dv.price,
              offerPrice: dv.offerPrice,
              sku: dv.sku,
            }
          }
        }

        if (chosenSize || item.selectedSizeData || (item.selectedSizeIndex !== null && item.selectedSizeIndex !== undefined)) {
          verifiedItem.selectedSizeIndex = item.selectedSizeIndex !== undefined ? item.selectedSizeIndex : null
          verifiedItem.selectedSizeData = {
            sizeId: chosenSize?.size || chosenSize?._id || item.selectedSizeData?.sizeId || undefined,
            name: chosenSize?.name || item.selectedSizeData?.name || "",
            code: chosenSize?.code || item.selectedSizeData?.code || "",
            additionalPrice: chosenSize?.additionalPrice !== undefined ? Number(chosenSize.additionalPrice) : (Number(item.selectedSizeData?.additionalPrice) || 0),
          }
        }

        verifiedOrderItems.push(verifiedItem)
        calculatedItemsPrice += dbPrice * quantity
        loyaltyEarnItems.push({ product, price: dbPrice, quantity })
      }
    }

    // ---- Delivery charge ----
    //
    // Resolved here rather than earlier because every band is measured against the goods
    // subtotal, which is only known once the items have been priced from the database.
    // Discounts deliberately play no part: a shipping band is about the size of the
    // basket, not about what the shopper knocked off it.
    let normalizedShippingPrice = 0
    let selectedAdminDeliveryCharge = null

    if (deliveryType === "home") {
      const countryFilter = orderCountry?.code
        ? {
            isActive: true,
            $or: [
              { countryCode: { $regex: new RegExp(`^${orderCountry.code}$`, "i") } },
              { isInternational: true },
            ],
          }
        : { isActive: true }

      let candidates = await DeliveryCharge.find(countryFilter).sort({ createdAt: -1 }).lean()
      // Nothing set up for this country: fall back to every active method rather than
      // refusing an order over a gap in the configuration.
      if (candidates.length === 0) {
        candidates = await DeliveryCharge.find({ isActive: true }).sort({ createdAt: -1 }).lean()
      }

      const preferredId =
        typeof deliveryChargeId === "string" && /^[a-fA-F0-9]{24}$/.test(deliveryChargeId) ? deliveryChargeId : null

      const resolved = selectDeliveryMethod(candidates, calculatedItemsPrice, preferredId)

      // The basket is too small for every method that exists. The storefront blocks this
      // too, but it is refused here as well so a direct API call cannot slip past a
      // minimum the shop has set.
      if (!resolved.available) {
        res.status(400)
        throw new Error(describeDeliveryBlock(resolved))
      }

      normalizedShippingPrice = resolved.charge
      selectedAdminDeliveryCharge = resolved.method
    }

    // Read from the database like the item prices and delivery band above, not
    // taken from the request -- a browser could otherwise skip the COD handling
    // fee by posting an empty list. Percentage fees are settled into money here,
    // against the goods before any discount, the same base the storefront shows.
    const { charges: resolvedPaymentCharges, total: paymentChargesTotal } = await resolvePaymentCharges({
      paymentMethod: actualPaymentMethod || paymentMethod,
      countryCode: orderCountry?.code,
      goodsAmount: calculatedItemsPrice,
    })

    const normalizedBaseTotal = calculatedItemsPrice + normalizedShippingPrice

    // Server-side App Discount validation
    let appDiscountMeta = null
    let appliedAppDiscountAmount = 0
    if (normalizedOrderSource === "app" && req.user) {
      const appDiscountResult = await resolveAppDiscountForOrder({
        user: req.user,
        orderItems: verifiedOrderItems,
        code: req.body.couponCode,
      })

      if (appDiscountResult?.applied) {
        appDiscountMeta = appDiscountResult.discount
        appliedAppDiscountAmount = Math.min(
          Math.max(0, Number(appDiscountResult.discountAmount || 0)),
          normalizedBaseTotal,
        )
      }
    }

    // Server-side Web Coupon validation
    let couponDiscount = 0
    if (req.body.couponCode && normalizedOrderSource === "web") {
      const searchCode = String(req.body.couponCode).trim().toUpperCase()
      const coupon = await Coupon.findOne({
        code: searchCode,
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
      })

      if (coupon) {
        let totalEligibleAmount = 0
        if (coupon.appliesTo === "products") {
          const targetProductIds = new Set((coupon.products || []).map((id) => id.toString()))
          for (const item of verifiedOrderItems) {
            if (item.product && targetProductIds.has(item.product.toString())) {
              totalEligibleAmount += item.price * item.quantity
            }
          }
        } else if (coupon.appliesTo === "categories") {
          const targetCategoryIds = new Set((coupon.categories || []).map((id) => id.toString()))
          for (const item of verifiedOrderItems) {
            if (item.product) {
              const product = await Product.findById(item.product).lean()
              if (product && product.parentCategory && targetCategoryIds.has(product.parentCategory.toString())) {
                totalEligibleAmount += item.price * item.quantity
              }
            }
          }
        } else if (coupon.appliesTo === "subcategories") {
          const targetSubcategoryIds = new Set((coupon.subcategories || []).map((id) => id.toString()))
          for (const item of verifiedOrderItems) {
            if (item.product) {
              const product = await Product.findById(item.product).lean()
              const subCatId = product && (product.category || product.subCategory)
              if (product && subCatId && targetSubcategoryIds.has(subCatId.toString())) {
                totalEligibleAmount += item.price * item.quantity
              }
            }
          }
        } else {
          totalEligibleAmount = verifiedOrderItems.reduce(
            (sum, item) => sum + (item.isProtection ? 0 : item.price * item.quantity),
            0
          )
        }

        if (totalEligibleAmount > 0 && (!coupon.minOrderAmount || totalEligibleAmount >= coupon.minOrderAmount)) {
          if (coupon.discountType === "percentage") {
            couponDiscount = (totalEligibleAmount * coupon.discountValue) / 100
            if (coupon.maxDiscountAmount && couponDiscount > coupon.maxDiscountAmount) {
              couponDiscount = coupon.maxDiscountAmount
            }
          } else {
            couponDiscount = Math.min(coupon.discountValue, totalEligibleAmount)
          }
        }
      }
    }

    const finalDiscountAmount = appliedAppDiscountAmount > 0 ? appliedAppDiscountAmount : couponDiscount

    // ---- Referral reward ----
    //
    // The client sends which reward the shopper chose; everything else is recalculated
    // here. The reward is claimed -- an atomic update that both checks it is still active
    // and marks it spent -- before the order is written, so two checkouts cannot spend the
    // same reward, and it is handed back below if the order itself cannot be saved.
    const referralSettings = await getReferralSettings()
    const requestedRewardId = String(req.body.referralRewardId || "").trim()

    // A referral reward comes off the goods only -- never shipping or payment fees -- and
    // only what is left after any coupon or app discount.
    const referralEligibleAmount = Math.max(0, calculatedItemsPrice - finalDiscountAmount)

    let referralReward = null
    let referralDiscountAmount = 0

    if (requestedRewardId) {
      if (!req.user) {
        res.status(401)
        throw new Error("Sign in to use your referral discount")
      }
      if (!referralSettings.isEnabled) {
        res.status(400)
        throw new Error("The referral programme is not currently active")
      }
      if (!mongoose.Types.ObjectId.isValid(requestedRewardId)) {
        res.status(400)
        throw new Error("That referral discount could not be found")
      }

      // Scoped to the caller, so a guessed id can never spend somebody else's reward.
      const candidate = await ReferralReward.findOne({ _id: requestedRewardId, user: req.user._id }).lean()
      if (!candidate) {
        res.status(400)
        throw new Error("That referral discount could not be found on your account")
      }

      const isFirstOrder = candidate.firstOrderOnly ? !(await hasPreviousOrder(req.user._id)) : true
      const quote = computeRewardDiscount({
        reward: candidate,
        eligibleAmountAed: referralEligibleAmount,
        isFirstOrder,
      })

      if (quote.discountAed <= 0) {
        res.status(400)
        const reasons = {
          not_active: "That referral discount has already been used or is no longer valid",
          expired: "That referral discount has expired",
          first_order_only: "That welcome discount can only be used on your first order",
          below_minimum: `Your order must be at least ${candidate.minOrderAed} Rs to use this discount`,
          empty_cart: "There is nothing to apply the discount to",
          no_value: "That referral discount cannot be applied to this order",
        }
        throw new Error(reasons[quote.blockedReason] || "That referral discount cannot be applied to this order")
      }

      referralReward = await claimRewardForOrder({
        rewardId: candidate._id,
        userId: req.user._id,
        discountAed: quote.discountAed,
      })

      if (!referralReward) {
        // It was spent between the quote and the claim -- another checkout got there first.
        res.status(400)
        throw new Error("That referral discount has just been used. Please review your order and try again.")
      }

      referralDiscountAmount = quote.discountAed
    }

    // ---- Loyalty points ----
    //
    // The client sends how many points the shopper chose to spend; everything else is
    // recalculated here. Points are debited before the order is written so a shortfall
    // fails the checkout outright rather than quietly charging full price, and the debit
    // is refunded below if the order itself cannot be saved.
    const loyaltySettings = await getLoyaltySettings()
    const requestedLoyaltyPoints = Math.max(
      0,
      Math.floor(Number(req.body.loyaltyPointsRedeemed ?? req.body.loyaltyPoints ?? 0) || 0),
    )

    // Points come off the goods only -- never shipping or payment fees -- and only what is
    // left after any coupon and any referral reward, so the three together can never take
    // off more than the goods are worth.
    const loyaltyEligibleAmount = Math.max(
      0,
      calculatedItemsPrice - finalDiscountAmount - referralDiscountAmount,
    )

    let loyaltyPointsRedeemed = 0
    let loyaltyDiscountAmount = 0
    let loyaltyRedeemTransaction = null

    // Guarded so that any failure from here on hands the referral reward back: it has
    // already been claimed, and an order that is never placed must not consume it.
    try {
      if (requestedLoyaltyPoints > 0) {
        if (!req.user) {
          res.status(401)
          throw new Error("Sign in to pay with points")
        }
        if (!loyaltySettings.isEnabled) {
          res.status(400)
          throw new Error("The points programme is not currently active")
        }

        const summary = await getUserLoyaltySummary(req.user._id)
        const quote = computeRedemption({
          eligibleAmountAed: loyaltyEligibleAmount,
          availablePoints: summary.balance,
          requestedPoints: requestedLoyaltyPoints,
          settings: loyaltySettings,
        })

        // Asking for more than the cap allows is refused rather than quietly trimmed. The
        // checkout screen priced the order against the number it asked for, so applying
        // less would charge the customer more than they were shown.
        if (requestedLoyaltyPoints > quote.maxPoints) {
          res.status(400)
          throw new Error(
            quote.maxPoints > 0
              ? `You can use at most ${quote.maxPoints} points on this order. Please review your order and try again.`
              : "Your points cannot be applied to this order. Please review your order and try again.",
          )
        }

        if (quote.appliedPoints <= 0) {
          res.status(400)
          const reasons = {
            no_points: "You do not have any points to redeem",
            below_minimum: `You need at least ${loyaltySettings.minPointsToRedeem} points to redeem`,
            cap_below_minimum: "This order is too small to redeem points against",
            empty_cart: "There is nothing to redeem points against",
            disabled: "The points programme is not currently active",
          }
          throw new Error(reasons[quote.blockedReason] || "These points cannot be applied to this order")
        }

        loyaltyRedeemTransaction = await redeemPointsForOrder({
          userId: req.user._id,
          points: quote.appliedPoints,
          order: null,
          settings: loyaltySettings,
        })

        if (!loyaltyRedeemTransaction) {
          // The balance moved between the quote and the debit -- another order spent them.
          res.status(400)
          throw new Error("Your points balance changed. Please review your order and try again.")
        }

        loyaltyPointsRedeemed = quote.appliedPoints
        loyaltyDiscountAmount = quote.discountAed
      }
    } catch (error) {
      // A points failure happens after the referral reward was already claimed, so hand
      // the reward back rather than burning it on an order that was never placed.
      if (referralReward) {
        await releaseClaimedReward(referralReward._id).catch((releaseError) =>
          console.error("Failed to release referral reward after loyalty redemption failed:", releaseError),
        )
      }
      throw error
    }

    let userLoyaltyType = null
    if (req.user) {
      const userDoc = await User.findById(req.user._id).populate("loyaltyType").lean()
      if (userDoc?.loyaltyType && userDoc.loyaltyType.isActive) {
        userLoyaltyType = userDoc.loyaltyType
      }
    }

    // What this order will pay out, held pending until it is delivered.
    const { totalPoints: loyaltyPointsEarned } = req.user
      ? calculateEarnedPoints({
          items: loyaltyEarnItems,
          settings: loyaltySettings,
          ruleMap: await getCategoryRuleMap(),
          redeemedAmountAed: loyaltyDiscountAmount + referralDiscountAmount,
          loyaltyType: userLoyaltyType,
        })
      : { totalPoints: 0 }

    const discountedTotal = Math.max(
      0,
      normalizedBaseTotal - finalDiscountAmount - referralDiscountAmount - loyaltyDiscountAmount,
    )

    // Product prices already carry their VAT, but delivery and handling fees are held
    // exclusive of it, so VAT on those two is worked out here and charged on top.
    // The rate is read from Settings so the storefront (which reads the same public
    // settings) and this calculation can never drift apart; DEFAULT_VAT_RATE stands in
    // only when no rate has been configured, matching what the invoice assumes.
    const storeSettings = await Settings.findOne({}).lean()
    const configuredVatRate = Number(storeSettings?.taxRate)
    // `>= 0`, not `> 0`: a rate deliberately configured as zero has to survive, and the
    // old test quietly replaced it with the fallback rate.
    const vatRate = Number.isFinite(configuredVatRate) && configuredVatRate >= 0 ? configuredVatRate : DEFAULT_VAT_RATE
    const feesExcludingVat = normalizedShippingPrice + paymentChargesTotal
    const feesVat = Number(((feesExcludingVat * vatRate) / 100).toFixed(2))

    // Payment fees sit outside the discountable part of an order: a coupon
    // reduces the goods, never the cost of paying on delivery or by instalment.
    const normalizedTotalPrice = Number((discountedTotal + paymentChargesTotal + feesVat).toFixed(2))

    const order = new Order({
      orderItems: verifiedOrderItems,
      user: req.user ? req.user._id : null,
      orderSource: normalizedOrderSource,
      deliveryType,
      shippingAddress: deliveryType === "home" ? shippingAddress : undefined,
      billingAddress: billingAddress || (deliveryType === "home" ? shippingAddress : undefined),
      pickupDetails: deliveryType === "pickup" ? pickupDetails : undefined,
      // Fall back to the country's currency when the client omitted it, so an order
      // placed outside the UAE is never silently recorded as AED.
      currency: currency || orderCountry?.currencyCode || "PKR",
      currencySymbol: currencySymbol || currency || orderCountry?.currencySymbol || orderCountry?.currencyCode || "PKR",
      itemsPrice: calculatedItemsPrice,
      shippingPrice: normalizedShippingPrice,
      // Recorded so the invoice splits every line at the rate this order was priced at,
      // rather than assuming the store default forever.
      taxRate: vatRate,
      discountAmount: finalDiscountAmount,
      appDiscountApplied: Boolean(appDiscountMeta && appliedAppDiscountAmount > 0),
      appDiscountId: appDiscountMeta?._id || null,
      appDiscountName: appDiscountMeta?.name || "",
      appDiscountType: appDiscountMeta?.discountType || "",
      appDiscountValue: Number(appDiscountMeta?.discountValue || 0),
      appDiscountAmount: appliedAppDiscountAmount,
      referralRewardId: referralReward?._id || null,
      referralRewardRole: referralReward?.role || "",
      referralDiscountType: referralReward?.discountType || "",
      referralDiscountValue: Number(referralReward?.discountValue || 0),
      referralDiscountAmount,
      loyaltyPointsRedeemed,
      loyaltyDiscountAmount,
      loyaltyPointsEarned,
      totalPrice: normalizedTotalPrice,
      couponCode: appDiscountMeta ? appDiscountMeta.name : (req.body.couponCode || ""),
      customerNotes,
      paymentMethod: paymentMethod || "cod",
      actualPaymentMethod: actualPaymentMethod || paymentMethod || "cod",
      // The resolved charges, not the client's -- these are the figures the
      // total above was built from, so the invoice always reconciles.
      paymentCharges: resolvedPaymentCharges,
      // Kept for the Meta Conversions API, which reports the sale from here
      // rather than from the customer's browser.
      metaAttribution: readMetaAttribution(req, req.body),
      status: "New",
    })

    // Concurrency & real-time stock safety check:
    // Re-verify the latest database stock right before saving the order to prevent race conditions and overselling.
    for (const item of verifiedOrderItems) {
      const freshProduct = await Product.findById(item.product)
      if (!freshProduct) {
        res.status(400)
        throw new Error(`Product ${item.name} is no longer available`)
      }

      if (freshProduct.sizes && Array.isArray(freshProduct.sizes) && (item.selectedSizeData || (item.selectedSizeIndex !== null && item.selectedSizeIndex !== undefined))) {
        let sizeIdx = -1
        if (item.selectedSizeData) {
          sizeIdx = freshProduct.sizes.findIndex(
            (s) =>
              (item.selectedSizeData.sizeId && String(s.size || s._id) === String(item.selectedSizeData.sizeId)) ||
              (item.selectedSizeData.code && s.code && s.code.toLowerCase() === String(item.selectedSizeData.code).toLowerCase()) ||
              (item.selectedSizeData.name && s.name && s.name.toLowerCase() === String(item.selectedSizeData.name).toLowerCase()),
          )
        }
        if (sizeIdx === -1 && item.selectedSizeIndex !== null && item.selectedSizeIndex !== undefined && freshProduct.sizes[item.selectedSizeIndex]) {
          sizeIdx = item.selectedSizeIndex
        }

        if (sizeIdx !== -1) {
          const freshSize = freshProduct.sizes[sizeIdx]
          const sizeStock = Number(freshSize.countInStock) || 0
          if (sizeStock < item.quantity) {
            const sizeLabel = freshSize.code || freshSize.name || ""
            res.status(400)
            throw new Error(
              sizeStock <= 0
                ? `${freshProduct.name} (${sizeLabel}) is out of stock`
                : `Only ${sizeStock} items available for ${freshProduct.name} (${sizeLabel})`
            )
          }
        }
      } else if (!item.selectedColorIndex && !item.selectedDosIndex && freshProduct.stockStatus !== "PreOrder" && freshProduct.countInStock !== undefined && freshProduct.countInStock !== null) {
        if ((Number(freshProduct.countInStock) || 0) < item.quantity) {
          res.status(400)
          throw new Error(`Only ${freshProduct.countInStock} items available for ${freshProduct.name}`)
        }
      }
    }

    let createdOrder
    try {
      createdOrder = await order.save()
    } catch (error) {
      // The reward was already claimed, so give it back rather than burning it on an
      // order that does not exist.
      if (referralReward) {
        await releaseClaimedReward(referralReward._id).catch((releaseError) =>
          console.error("Failed to release referral reward after order save failed:", releaseError),
        )
      }

      // The points were already debited, so give them back rather than leaving the
      // customer short for an order that does not exist.
      if (loyaltyRedeemTransaction) {
        await refundUnlinkedRedemption(loyaltyRedeemTransaction).catch((refundError) =>
          console.error("Failed to refund loyalty points after order save failed:", refundError),
        )
      }
      throw error
    }

    console.log(`[ORDER CREATED] Order ID: ${createdOrder._id}, User: ${req.user ? req.user._id : 'GUEST'}, Email: ${deliveryType === 'home' ? shippingAddress?.email : pickupDetails?.email}`)

    // A guest who leaves an email gets an account with a generated password, mailed to
    // them, so their next visit has an order history. Deliberately not awaited: the
    // response must not wait on SMTP, and nothing here can invalidate the order.
    if (!req.user) {
      const contact = deliveryType === "home" ? shippingAddress : pickupDetails
      createAccountForGuest({
        email: contact?.email,
        name: contact?.name,
        phone: contact?.phone,
        address: deliveryType === "home" ? shippingAddress : null,
      }).catch((error) => console.error("[GUEST ACCOUNT] Could not create account:", error.message))
    }

    // Attach the redemption to the order now that it has an id, and register the pending
    // award. Neither is allowed to fail the order the customer has already paid for.
    if (loyaltyRedeemTransaction) {
      await LoyaltyTransaction.updateOne(
        { _id: loyaltyRedeemTransaction._id },
        {
          $set: {
            order: createdOrder._id,
            description: `Redeemed on order #${createdOrder._id.toString().slice(-6)}`,
          },
        },
      ).catch((error) => console.error("Failed to link loyalty redemption to order:", error))
    }

    // Point the reward at the order it paid for, now that the order has an id. It is
    // already marked spent, so this only completes the audit trail.
    if (referralReward) {
      await ReferralReward.updateOne(
        { _id: referralReward._id },
        { $set: { order: createdOrder._id } },
      ).catch((error) => console.error("Failed to link referral reward to order:", error))
    }

    if (req.user && loyaltyPointsEarned > 0) {
      await recordPendingEarn({
        userId: req.user._id,
        points: loyaltyPointsEarned,
        order: createdOrder,
        settings: loyaltySettings,
        description: `Pending on order #${createdOrder._id.toString().slice(-6)}`,
        loyaltyType: userLoyaltyType,
      }).catch((error) => console.error("Failed to record pending loyalty points:", error))
    }

    // Populate the user information for the created order
    await createdOrder.populate("user", "name email")
    await createdOrder.populate("orderItems.product", "name nameAr image")

    // Populate order items for email
    await createdOrder.populate("orderItems.product", "name nameAr image")

    // Send order confirmation email
    try {
      await sendOrderPlacedEmail(createdOrder)
      console.log(`Order confirmation email sent for order ${createdOrder._id}`)
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError)
      // Don't fail the order creation if email fails
    }

    // Stock leaves the shelf. Awaited, unlike the notifications: an order that does
    // not move stock leaves the shop overselling the next customer.
    await postOrderOut(createdOrder).catch((error) =>
      console.error("[STOCK] Could not record order out:", error.message),
    )

    // WhatsApp confirmation, when the shop has connected a number and switched this
    // notification on. Not awaited: the customer is waiting on the response, and a
    // notification must never be the reason an order fails.
    sendWhatsAppOrderPlaced(createdOrder).catch((error) =>
      console.error("[WHATSAPP] Order confirmation failed:", error.message),
    )

    // A cash order is a confirmed sale the moment it is placed; a card, Tabby or
    // Tamara order is not, and is reported by the gateway's own route once the
    // charge clears. The browser pixel reports the same sale under the same id,
    // and Meta counts the pair once.
    const isConfirmedSale =
      createdOrder.isPaid || String(createdOrder.paymentMethod || "").toLowerCase() === "cod"

    if (isConfirmedSale) {
      await sendMetaPurchase(createdOrder, { Order }).catch((error) =>
        console.error("Failed to report purchase to Meta:", error),
      )
    }

    res.status(201).json(createdOrder)
  }),
)

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
router.put(
  "/:id/status",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const { status, trackingId } = req.body

    const order = await Order.findById(req.params.id)
      .populate("user", "name email")
      .populate("orderItems.product", "name nameAr image")

    if (!order) {
      res.status(404)
      throw new Error("Order not found")
    }
    if (order.documentType === "quotation") {
      res.status(400)
      throw new Error("Quotation cannot be updated from order endpoint")
    }

    const oldStatus = order.status

    // Normalize incoming status to match schema enum values (case-insensitive)
    if (typeof status === "string" && status.trim().length > 0) {
      const allowedStatuses = Order.schema.path("status").enumValues || []
      const normalized = allowedStatuses.find(
        (s) => s.toLowerCase() === status.toLowerCase().trim(),
      )

      if (!normalized) {
        res.status(400)
        throw new Error(
          `Invalid status '${status}'. Allowed values: ${allowedStatuses.join(", ")}`,
        )
      }

      order.status = normalized
    }

    if (trackingId) {
      order.trackingId = trackingId
    }

    const updatedOrder = await order.save()

    // Points earned on an order stay pending until it reaches the award status, so a
    // cancelled or returned order never pays out.
    if (oldStatus !== updatedOrder.status) {
      await syncOrderLoyaltyForStatus(updatedOrder._id, updatedOrder.status)
      // A referral only pays the referrer once the friend's order is actually delivered,
      // and is unwound if it is later cancelled or returned.
      await syncOrderReferralForStatus(updatedOrder._id, updatedOrder.status)
    }

    // Send status update email only when status actually changes
    if (oldStatus !== updatedOrder.status) {
      try {
        await sendOrderStatusUpdateEmail(updatedOrder)
        console.log(`Order status update email sent for order ${updatedOrder._id}`)
      } catch (emailError) {
        console.error("Failed to send order status update email:", emailError)
        // Don't fail the status update if email fails
      }

      sendWhatsAppStatusUpdate(updatedOrder).catch((error) =>
        console.error("[WHATSAPP] Status update failed:", error.message),
      )

      // A cancelled order puts its stock back. postOrderReturn is guarded against
      // running twice, so re-saving a cancelled order cannot inflate stock.
      if (String(updatedOrder.status).toLowerCase().includes("cancel")) {
        await postOrderReturn(updatedOrder).catch((error) =>
          console.error("[STOCK] Could not restore cancelled order stock:", error.message),
        )
      }
    }

    // Log activity
    if (req.user) {
      await logActivity({
        user: req.user,
        action: "STATUS_CHANGE",
        module: "ORDERS",
        description: `Changed order #${order._id.toString().slice(-6)} status from "${oldStatus}" to "${updatedOrder.status}"`,
        targetId: order._id.toString(),
        targetName: `Order #${order._id.toString().slice(-6)}`,
        previousData: { status: oldStatus },
        newData: { status: updatedOrder.status, trackingId },
        req,
      })
    }

    res.json(updatedOrder)
  }),
)

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
router.get(
  "/myorders",
  protect,
  asyncHandler(async (req, res) => {
    console.log(`[MYORDERS] Fetching orders for user: ${req.user._id}, email: ${req.user.email}`)
    
    // Find orders directly associated with user
    const userOrders = await Order.find({ $and: [ORDER_DOCUMENT_QUERY, { user: req.user._id }] })
      .populate('orderItems.product', 'name image slug')
      .sort({ createdAt: -1 })
    
    console.log(`[MYORDERS] Found ${userOrders.length} orders directly associated with user`)

    // Find orders that might be associated through email (for orphaned orders)
    const emailOrders = await Order.find({
      $and: [
        ORDER_DOCUMENT_QUERY,
        {
          user: null,
          $or: [{ "shippingAddress.email": req.user.email }, { "pickupDetails.email": req.user.email }],
        },
      ],
    })
      .populate('orderItems.product', 'name image slug')
      .sort({ createdAt: -1 })
    
    console.log(`[MYORDERS] Found ${emailOrders.length} orphaned orders with null user`)
    
    // Also check for orders with undefined user field
    const undefinedUserOrders = await Order.find({
      $and: [
        ORDER_DOCUMENT_QUERY,
        {
          user: { $exists: false },
          $or: [{ "shippingAddress.email": req.user.email }, { "pickupDetails.email": req.user.email }],
        },
      ],
    })
      .populate('orderItems.product', 'name image slug')
      .sort({ createdAt: -1 })
    
    console.log(`[MYORDERS] Found ${undefinedUserOrders.length} orders with undefined user field`)

    // Update orphaned orders to associate them with the user
    const ordersToUpdate = [...emailOrders, ...undefinedUserOrders]
    if (ordersToUpdate.length > 0) {
      console.log(`[MYORDERS] Updating ${ordersToUpdate.length} orphaned orders to associate with user ${req.user._id}`)
      
      await Order.updateMany(
        {
          _id: { $in: ordersToUpdate.map(order => order._id) }
        },
        { user: req.user._id }
      )
      
      // Update the user field in the returned orders
      ordersToUpdate.forEach(order => {
        order.user = req.user._id
      })
    }

    // Combine, filter out Deleted orders, and sort all orders
    const allOrders = [...userOrders, ...ordersToUpdate]
      .filter(order => order.status !== "Deleted")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    
    console.log(`[MYORDERS] Returning total of ${allOrders.length} orders to user`)
    
    res.json(allOrders)
  }),
)

// @desc    Track order by email and order ID
// @route   POST /api/orders/track
// @access  Public
router.post(
  "/track",
  asyncHandler(async (req, res) => {
    const { email, orderId } = req.body

    if (!email || !orderId) {
      res.status(400)
      throw new Error("Email and Order ID are required")
    }

    // Clean the order ID - remove # if present and handle different formats
    const cleanOrderId = orderId.toString().replace(/^#/, "").trim()

    console.log(`Tracking order with email: ${email}, orderId: ${cleanOrderId}`)

    let order = null

    try {
      // First try to find by MongoDB ObjectId if it looks like one
      if (cleanOrderId.match(/^[0-9a-fA-F]{24}$/)) {
        console.log("Searching by MongoDB ObjectId...")

        // Search in multiple ways for the email
        order = await Order.findOne({
          $and: [
            ORDER_DOCUMENT_QUERY,
            {
              _id: cleanOrderId,
              $or: [{ "shippingAddress.email": email }, { "pickupDetails.email": email }],
            },
          ],
        })
          .populate("orderItems.product", "name nameAr image")
          .populate("user", "name email")

        // If not found with address emails, try with user email
        if (!order) {
          const orderWithUser = await Order.findOne({ $and: [ORDER_DOCUMENT_QUERY, { _id: cleanOrderId }] })
            .populate("orderItems.product", "name nameAr image")
            .populate("user", "name email")

          if (orderWithUser && orderWithUser.user && orderWithUser.user.email === email) {
            order = orderWithUser
          }
        }
      }

      // If not found by ObjectId, try other methods
      if (!order) {
        console.log("Searching by other methods...")

        // Get all orders for this email from different sources
        const orders = await Order.find({
          $and: [
            ORDER_DOCUMENT_QUERY,
            { $or: [{ "shippingAddress.email": email }, { "pickupDetails.email": email }] },
          ],
        })
          .populate("orderItems.product", "name nameAr image")
          .populate("user", "name email")

        // Also get orders where user email matches
        const userOrders = await Order.find(ORDER_DOCUMENT_QUERY)
          .populate("orderItems.product", "name nameAr image")
          .populate("user", "name email")

        const userMatchOrders = userOrders.filter((o) => o.user && o.user.email === email)

        // Combine all orders
        const allOrders = [...orders, ...userMatchOrders]

        // Remove duplicates
        const uniqueOrders = allOrders.filter(
          (order, index, self) => index === self.findIndex((o) => o._id.toString() === order._id.toString()),
        )

        console.log(`Found ${uniqueOrders.length} orders for email ${email}`)

        // Find order that matches the ID pattern
        order = uniqueOrders.find((o) => {
          const orderIdStr = o._id.toString()
          return (
            orderIdStr === cleanOrderId ||
            orderIdStr.toLowerCase().includes(cleanOrderId.toLowerCase()) ||
            cleanOrderId.toLowerCase().includes(orderIdStr.toLowerCase()) ||
            (o.trackingId && o.trackingId.includes(cleanOrderId)) ||
            (o.orderNumber && o.orderNumber.includes(cleanOrderId)) ||
            orderIdStr.slice(-6) === cleanOrderId || // Last 6 characters
            orderIdStr.slice(-8) === cleanOrderId // Last 8 characters
          )
        })
      }

      if (!order) {
        console.log("Order not found, trying partial match...")

        // Last resort: try partial matching on all orders
        const allOrders = await Order.find(ORDER_DOCUMENT_QUERY)
          .populate("orderItems.product", "name nameAr image")
          .populate("user", "name email")

        const matchingOrders = allOrders.filter((o) => {
          // Check if email matches in any field
          const emailMatch =
            (o.shippingAddress && o.shippingAddress.email === email) ||
            (o.pickupDetails && o.pickupDetails.email === email) ||
            (o.user && o.user.email === email)

          if (!emailMatch) return false

          // Check if order ID matches in any way
          const orderIdStr = o._id.toString()
          return (
            orderIdStr.includes(cleanOrderId) ||
            cleanOrderId.includes(orderIdStr) ||
            (o.trackingId && (o.trackingId.includes(cleanOrderId) || cleanOrderId.includes(o.trackingId)))
          )
        })

        if (matchingOrders.length > 0) {
          order = matchingOrders[0] // Take the first match
          console.log(`Found order via partial match: ${order._id}`)
        }
      }

      if (!order) {
        console.log("No order found after all attempts")
        res.status(404)
        throw new Error("Order not found with the provided email and order ID. Please check your email and order ID.")
      }

      console.log(`Successfully found order: ${order._id}`)
      res.json(order)
    } catch (error) {
      console.error("Error in order tracking:", error)
      res.status(500)
      throw new Error("Error occurred while tracking order. Please try again.")
    }
  }),
)

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
router.get(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const order = await Order.findOne({ $and: [ORDER_DOCUMENT_QUERY, { _id: req.params.id }] })

    if (order) {
      res.json(order)
    } else {
      res.status(404)
      throw new Error("Order not found")
    }
  }),
)

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
router.get(
  "/",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const orders = await Order.find(ORDER_DOCUMENT_QUERY)
      .populate("user", "name email")
      .populate("orderItems.product", "name nameAr image")
      .sort({ createdAt: -1 })

    res.json(orders)
  }),
)

// @desc    Get order statistics
// @route   GET /api/orders/stats
// @access  Private/Admin
router.get(
  "/stats",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const stats = await Order.aggregate([
      { $match: ORDER_DOCUMENT_QUERY },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$totalPrice" },
        },
      },
    ])

    const totalOrders = await Order.countDocuments(ORDER_DOCUMENT_QUERY)
    const totalRevenue = await Order.aggregate([
      { $match: { ...ORDER_DOCUMENT_QUERY, isPaid: true } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ])

    res.json({
      statusStats: stats,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
    })
  }),
)

export default router
