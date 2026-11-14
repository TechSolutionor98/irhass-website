import Product from "../models/productModel.js"
import StockMovement from "../models/stockMovementModel.js"
import cacheService from "./cacheService.js"
import { notifyBackInStockSubscribers } from "./backInStockService.js"

/**
 * Posting to the stock ledger.
 *
 * One place that writes a movement AND moves the product's stock figure, so the two
 * can never disagree. Call these rather than touching countInStock directly.
 */

const DIRECTION = { in: 1, out: -1, damage: -1 }

/**
 * Records one movement and applies it to the product.
 *
 * Returns null rather than throwing on bad input: this is called from order
 * creation, and a ledger problem must never fail a sale the customer has paid for.
 */
export const postMovement = async ({
  product,
  type,
  quantity,
  reason = "",
  order = null,
  createdBy = null,
  selectedSizeData = null,
  selectedSizeIndex = null,
}) => {
  try {
    const qty = Math.abs(Number(quantity) || 0)
    if (!product || !DIRECTION[type] || qty === 0) return null

    const prodDoc = await Product.findById(product)
    if (!prodDoc) return null

    const delta = DIRECTION[type] * qty

    // Check if this product has size variations and a size was selected
    let sizeMatched = false
    if (prodDoc.sizes && Array.isArray(prodDoc.sizes) && prodDoc.sizes.length > 0) {
      let sizeIdx = -1
      if (selectedSizeData) {
        sizeIdx = prodDoc.sizes.findIndex(
          (s) =>
            (selectedSizeData.sizeId && String(s.size || s._id) === String(selectedSizeData.sizeId)) ||
            (selectedSizeData.code && s.code && s.code.toLowerCase() === String(selectedSizeData.code).toLowerCase()) ||
            (selectedSizeData.name && s.name && s.name.toLowerCase() === String(selectedSizeData.name).toLowerCase()),
        )
      }
      if (sizeIdx === -1 && selectedSizeIndex !== null && selectedSizeIndex !== undefined && prodDoc.sizes[selectedSizeIndex]) {
        sizeIdx = selectedSizeIndex
      }

      if (sizeIdx !== -1) {
        sizeMatched = true
        const currentSizeStock = Number(prodDoc.sizes[sizeIdx].countInStock) || 0
        const newSizeStock = Math.max(0, currentSizeStock + delta)
        prodDoc.sizes[sizeIdx].countInStock = newSizeStock

        // Recalculate total product countInStock from all sizes
        const totalSizeStock = prodDoc.sizes.reduce((sum, s) => sum + (Number(s.countInStock) || 0), 0)
        prodDoc.countInStock = Math.max(0, totalSizeStock)

        // Automatically update stockStatus based on available quantity of sizes
        if (prodDoc.stockStatus !== "PreOrder") {
          prodDoc.stockStatus = totalSizeStock > 0 ? "In Stock" : "Out of Stock"
        }
        await prodDoc.save()
      }
    }

    if (!sizeMatched) {
      prodDoc.countInStock = Math.max(0, (Number(prodDoc.countInStock) || 0) + delta)
      if (prodDoc.stockStatus !== "PreOrder") {
        if (prodDoc.countInStock === 0 && delta < 0) {
          prodDoc.stockStatus = "Out of Stock"
        } else if (prodDoc.countInStock > 0 && prodDoc.stockStatus === "Out of Stock") {
          prodDoc.stockStatus = "In Stock"
        }
      }
      await prodDoc.save()
    }

    try {
      await cacheService.invalidateEntity("products")
    } catch (cacheErr) {
      console.error("[STOCK] Cache invalidation failed:", cacheErr.message)
    }

    if (type === "in" && Number(prodDoc.countInStock) > 0 && prodDoc.stockStatus !== "Out of Stock") {
      notifyBackInStockSubscribers(prodDoc._id).catch((err) =>
        console.error("[STOCK] Back in stock trigger error:", err.message),
      )
    }

    return await StockMovement.create({
      product,
      type,
      quantity: qty,
      reason,
      order,
      createdBy,
      balanceAfter: prodDoc.countInStock,
    })
  } catch (error) {
    console.error("[STOCK] Could not post movement:", error.message)
    return null
  }
}

/** Every line on an order leaving as a sale. */
export const postOrderOut = async (order) => {
  if (!order?.orderItems?.length) return
  for (const item of order.orderItems) {
    if (item.isProtection) continue // not a physical thing
    await postMovement({
      product: item.product,
      type: "out",
      quantity: item.quantity,
      reason: `Order ${String(order._id).slice(-6).toUpperCase()}`,
      order: order._id,
      selectedSizeData: item.selectedSizeData || null,
      selectedSizeIndex: item.selectedSizeIndex ?? null,
    })
  }
  try {
    await cacheService.invalidateEntity("products")
  } catch (cacheErr) {
    console.error("[STOCK] Cache invalidation failed:", cacheErr.message)
  }
}

/**
 * Puts an order's stock back when it is cancelled.
 *
 * Guarded against running twice: a cancelled order that is cancelled again would
 * otherwise return the stock a second time and inflate what the shop thinks it holds.
 */
export const postOrderReturn = async (order) => {
  if (!order?.orderItems?.length) return

  const alreadyReturned = await StockMovement.exists({
    order: order._id,
    type: "in",
    reason: { $regex: "^Cancelled" },
  })
  if (alreadyReturned) return

  for (const item of order.orderItems) {
    if (item.isProtection) continue
    await postMovement({
      product: item.product,
      type: "in",
      quantity: item.quantity,
      reason: `Cancelled order ${String(order._id).slice(-6).toUpperCase()}`,
      order: order._id,
      selectedSizeData: item.selectedSizeData || null,
      selectedSizeIndex: item.selectedSizeIndex ?? null,
    })
  }
  try {
    await cacheService.invalidateEntity("products")
  } catch (cacheErr) {
    console.error("[STOCK] Cache invalidation failed:", cacheErr.message)
  }
}

export default { postMovement, postOrderOut, postOrderReturn }
