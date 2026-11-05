/**
 * Whether a line may be sold.
 *
 * The naive version of this check -- `countInStock > 0` -- refuses real sales, and it
 * is worth being precise about why. `countInStock` is `required: true, default: 0` on
 * the product and defaults to `0` on every colour and DOS variation. A product added
 * without a stock figure therefore reads as zero while actually sitting on the shelf,
 * and a variation row created as a placeholder reads as zero while its parent is fully
 * stocked. A guard that trusted the number would turn those into "out of stock" at
 * checkout, which is a worse failure than the one it was added to prevent.
 *
 * So the rule is: **the admin-set status decides.**
 *
 *   - Marked "Out of Stock" -> refused, whatever the count says.
 *   - Marked "In Stock" or "PreOrder" -> allowed, whatever the count says.
 *   - A variation's own count speaks only when it was actually set. Blank, null or
 *     undefined means "nobody has said", not "none left".
 *
 * The count is a figure staff maintain; the status is a decision staff made. When they
 * disagree, the decision wins.
 */

/** A value that someone actually entered, as opposed to a schema default nobody touched. */
const isSet = (value) => value !== null && value !== undefined && value !== ""

/**
 * @param {object} product the product document
 * @param {object} [variation] the chosen colour or DOS variation, if any
 * @param {string} [variationLabel] e.g. "Champagne", for the message
 * @returns {{ ok: boolean, reason?: string }}
 */
export const checkLineStock = (product, variation = null, variationLabel = "") => {
  if (!product) return { ok: false, reason: "Product not found" }

  const name = product.name || "This item"

  // A chosen variation with its own figure is the most specific answer available.
  if (variation && isSet(variation.countInStock)) {
    if (!(Number(variation.countInStock) > 0)) {
      return {
        ok: false,
        reason: variationLabel ? `${name} (${variationLabel}) is out of stock` : `${name} is out of stock`,
      }
    }
    return { ok: true }
  }

  // Otherwise the product's status, which is the decision somebody made.
  if (product.stockStatus === "Out of Stock") {
    return { ok: false, reason: `${name} is out of stock` }
  }

  return { ok: true }
}

/** True when the shopper-facing UI should let this line be chosen at all. */
export const isSellable = (product, variation = null) => checkLineStock(product, variation).ok

export default { checkLineStock, isSellable }
