import BackInStockSubscription from "../models/backInStockModel.js"
import Product from "../models/productModel.js"
import { sendBackInStockEmail, BRAND_ASSETS } from "../utils/emailService.js"

/**
 * Service to handle customer back-in-stock alerts.
 */

export const subscribeToBackInStock = async ({ productId, email, name = "", phone = "", size = "", user = null }) => {
  if (!productId || !email) {
    throw new Error("Product ID and email are required.")
  }

  const cleanEmail = String(email).trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
    throw new Error("Please provide a valid email address.")
  }

  const product = await Product.findById(productId).select("name image price slug sizes stockStatus countInStock")
  if (!product) {
    throw new Error("Product not found.")
  }

  const cleanSize = String(size || "").trim()
  const cleanPhone = String(phone || "").trim()

  // Check if an unnotified subscription already exists for this email + product (+ size if specified)
  const query = {
    product: productId,
    email: cleanEmail,
    notified: false,
  }
  if (cleanSize) {
    query.size = cleanSize
  }

  const existing = await BackInStockSubscription.findOne(query)

  if (existing) {
    let updated = false
    if (cleanPhone && existing.phone !== cleanPhone) {
      existing.phone = cleanPhone
      updated = true
    }
    if (name && !existing.name) {
      existing.name = String(name).trim()
      updated = true
    }
    if (updated) {
      await existing.save()
    }

    const sizeNote = cleanSize ? ` in size ${cleanSize}` : ""
    return {
      success: true,
      alreadySubscribed: true,
      message: `You're already on the waitlist! We will email you at ${cleanEmail} as soon as this item${sizeNote} is back in stock.`,
      subscription: existing,
    }
  }

  const subscription = await BackInStockSubscription.create({
    product: productId,
    user: user ? user._id || user : null,
    email: cleanEmail,
    name: (name || user?.name || "").trim(),
    phone: cleanPhone,
    size: cleanSize,
    notified: false,
    metadata: {
      productName: product.name,
      productImage: product.image,
      productPrice: product.price,
      slug: product.slug || product._id.toString(),
    },
  })

  console.log(`[BackInStock] New subscription registered: ${cleanEmail} for product "${product.name}"${cleanSize ? ` (Size: ${cleanSize})` : ""}`)

  const sizeNote = cleanSize ? ` in size ${cleanSize}` : ""
  return {
    success: true,
    alreadySubscribed: false,
    message: `You're on the list! We will email ${cleanEmail} as soon as this item${sizeNote} is back in stock.`,
    subscription,
  }
}

export const checkSubscriptionStatus = async (productId, email, size = "", userId = null) => {
  if (!productId) return { subscribed: false }

  const cleanEmail = email ? String(email).trim().toLowerCase() : ""
  const cleanSize = String(size || "").trim()

  const query = {
    product: productId,
    notified: false,
  }
  if (cleanSize) {
    query.size = cleanSize
  }

  const orConditions = []
  if (cleanEmail) {
    orConditions.push({ email: cleanEmail })
  }
  if (userId) {
    orConditions.push({ user: userId })
  }

  if (orConditions.length === 0) {
    return { subscribed: false }
  }

  query.$or = orConditions

  const sub = await BackInStockSubscription.findOne(query).lean()

  return {
    subscribed: !!sub,
    size: sub?.size || "",
    email: sub?.email || "",
    createdAt: sub?.createdAt || null,
  }
}

export const unsubscribeFromBackInStock = async (productId, email) => {
  if (!productId || !email) return { success: false }

  const cleanEmail = String(email).trim().toLowerCase()
  const result = await BackInStockSubscription.deleteMany({
    product: productId,
    email: cleanEmail,
    notified: false,
  })

  return {
    success: true,
    deletedCount: result.deletedCount,
  }
}

/**
 * Triggers notification to all customers waiting for this product.
 * Called when stock is updated from 0 to >0 or stockStatus changes to "In Stock".
 */
export const notifyBackInStockSubscribers = async (productId) => {
  try {
    if (!productId) return

    const product = await Product.findById(productId).select("name image price slug stockStatus countInStock sizes isActive")
    if (!product || !product.isActive) {
      console.log(`[BackInStock] Product ${productId} not found or inactive, skipping notification`)
      return
    }

    const pendingSubscribers = await BackInStockSubscription.find({
      product: productId,
      notified: false,
    })

    if (!pendingSubscribers.length) {
      return
    }

    console.log(`[BackInStock] Found ${pendingSubscribers.length} customer(s) waiting for "${product.name}". Evaluating restock status...`)

    const cleanOrigin = (BRAND_ASSETS.websiteUrl || "https://irhaas.com").replace("://www.irhaas.com", "://irhaas.com")
    const productUrl = `${cleanOrigin}/product/${product.slug || product._id}`

    for (const sub of pendingSubscribers) {
      try {
        // If subscriber requested a specific size, verify that exact size is currently in stock!
        if (sub.size && product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
          const cleanSubSize = String(sub.size).replace(/^size[:\s-]*/i, "").trim().toLowerCase()
          const matchingSize = product.sizes.find(
            (s) =>
              (s.code && String(s.code).replace(/^size[:\s-]*/i, "").trim().toLowerCase() === cleanSubSize) ||
              (s.name && String(s.name).replace(/^size[:\s-]*/i, "").trim().toLowerCase() === cleanSubSize),
          )

          // If size not found or remaining stock <= 0, keep waiting
          if (!matchingSize || (matchingSize.countInStock !== undefined && Number(matchingSize.countInStock) <= 0)) {
            console.log(`[BackInStock] Size "${sub.size}" for "${product.name}" is still out of stock. Keeping ${sub.email} on waitlist.`)
            continue
          }
        } else {
          // General product check
          const isNowInStock =
            product.stockStatus === "In Stock" ||
            (Number(product.countInStock) > 0 && product.stockStatus !== "Out of Stock")

          if (!isNowInStock) {
            continue
          }
        }

        await sendBackInStockEmail({
          email: sub.email,
          name: sub.name,
          productName: product.name,
          productImage: product.image,
          productPrice: product.price,
          productUrl,
          size: sub.size,
        })

        sub.notified = true
        sub.notifiedAt = new Date()
        await sub.save()

        console.log(`[BackInStock] Alert sent to ${sub.email} for "${product.name}" (Size: ${sub.size || "All"})`)
      } catch (err) {
        console.error(`[BackInStock] Error sending notification to ${sub.email}:`, err.message)
      }
    }
  } catch (error) {
    console.error("[BackInStock] Global error in notifyBackInStockSubscribers:", error)
  }
}

export default {
  subscribeToBackInStock,
  checkSubscriptionStatus,
  unsubscribeFromBackInStock,
  notifyBackInStockSubscribers,
}

