import Product from "../models/productModel.js"
import StockMovement from "../models/stockMovementModel.js"

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
export const postMovement = async ({ product, type, quantity, reason = "", order = null, createdBy = null }) => {
  try {
    const qty = Math.abs(Number(quantity) || 0)
    if (!product || !DIRECTION[type] || qty === 0) return null

    // $inc so two orders landing together cannot read the same figure and both write
    // it back; the database does the arithmetic.
    const updated = await Product.findByIdAndUpdate(
      product,
      { $inc: { countInStock: DIRECTION[type] * qty } },
      { new: true, select: "countInStock" },
    )
    if (!updated) return null

    return await StockMovement.create({
      product,
      type,
      quantity: qty,
      reason,
      order,
      createdBy,
      balanceAfter: updated.countInStock,
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
    })
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
    })
  }
}

export default { postMovement, postOrderOut, postOrderReturn }
