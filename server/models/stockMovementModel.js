import mongoose from "mongoose"

/**
 * Every change to a product's stock level, as an append-only ledger.
 *
 * The stock figure on the product is the running total; this is how it got there.
 * Without it the "in", "out" and "damage" columns on Store Stats would be invented
 * numbers -- there was previously nothing recording a single stock movement.
 *
 * Nothing in here is ever edited or deleted. A mistake is corrected by posting the
 * opposite movement, so the history stays truthful.
 */
const stockMovementSchema = mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    // in     - stock arriving: opening count, a delivery from a supplier, a return
    // out    - stock leaving on a sale
    // damage - written off: broken, lost, stolen, unsellable
    type: {
      type: String,
      enum: ["in", "out", "damage"],
      required: true,
      index: true,
    },

    // Always positive. The type says which direction it moves.
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: { type: String, default: "", trim: true },

    // Set when the movement came from an order rather than from a person.
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // The product's stock level after this movement was applied, so a row can be
    // read on its own without replaying the whole ledger.
    balanceAfter: { type: Number, default: null },
  },
  { timestamps: true },
)

stockMovementSchema.index({ product: 1, createdAt: -1 })

/** Totals per product, shaped for the Store Stats columns. */
stockMovementSchema.statics.totalsByProduct = async function totalsByProduct(productIds = []) {
  const rows = await this.aggregate([
    ...(productIds.length ? [{ $match: { product: { $in: productIds } } }] : []),
    { $group: { _id: { product: "$product", type: "$type" }, total: { $sum: "$quantity" } } },
  ])

  const totals = {}
  for (const row of rows) {
    const id = String(row._id.product)
    if (!totals[id]) totals[id] = { in: 0, out: 0, damage: 0 }
    totals[id][row._id.type] = row.total
  }
  return totals
}

const StockMovement = mongoose.model("StockMovement", stockMovementSchema)

export default StockMovement
