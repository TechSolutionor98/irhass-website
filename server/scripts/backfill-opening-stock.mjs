/**
 * Gives every product an opening balance in the stock ledger.
 *
 * The ledger started empty, so without this the "in" column would read zero while
 * the stock column showed hundreds of units -- the two would not reconcile and the
 * page would look broken. This posts one "in" movement per product equal to the
 * stock it already holds, dated as its opening count.
 *
 * Idempotent: a product that already has an opening entry is skipped, so running it
 * twice cannot double anyone's stock.
 *
 *   node scripts/backfill-opening-stock.mjs [--dry-run]
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import Product from "../models/productModel.js"
import StockMovement from "../models/stockMovementModel.js"

dotenv.config()

const DRY_RUN = process.argv.includes("--dry-run")
const REASON = "Opening stock"

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set -- check server/.env")
    process.exit(1)
  }

  const conn = await mongoose.connect(process.env.MONGO_URI)
  console.log(`Connected: ${conn.connection.host}/${conn.connection.db.databaseName}`)
  if (DRY_RUN) console.log("DRY RUN -- nothing will be written\n")

  const products = await Product.find({}).select("_id name countInStock").lean()
  console.log(`Products: ${products.length}`)

  let created = 0
  let skipped = 0
  let zero = 0

  for (const product of products) {
    const existing = await StockMovement.exists({ product: product._id, reason: REASON })
    if (existing) {
      skipped++
      continue
    }

    const quantity = Number(product.countInStock) || 0
    if (quantity === 0) {
      // Nothing to open with. Left alone so a later delivery is its first entry.
      zero++
      continue
    }

    if (!DRY_RUN) {
      await StockMovement.create({
        product: product._id,
        type: "in",
        quantity,
        reason: REASON,
        // balanceAfter matches the stock it already has: this records history, it
        // does not change the figure.
        balanceAfter: quantity,
      })
    }
    created++
  }

  console.log(`\nOpening entries: ${created} created, ${skipped} already had one, ${zero} had no stock`)
  if (DRY_RUN) console.log("DRY RUN -- nothing was written.")

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error("Backfill failed:", err.message)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
