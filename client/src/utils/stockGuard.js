/**
 * Whether a product may be offered for sale, in the browser.
 *
 * Mirrors server/utils/stockGuard.js, and the reasoning there is the part that matters:
 * `countInStock` defaults to 0 on both products and variations, so a plain
 * `countInStock > 0` test reads an unfilled field as "none left" and hides things that
 * are actually on the shelf. The admin-set status decides; a count speaks only when
 * somebody actually set it.
 *
 * This is the courtesy layer -- it stops a shopper choosing something they cannot have.
 * The control is the identical check on the server, because a cart can sit in
 * localStorage for a week and the API is reachable without this page.
 */

const isSet = (value) => value !== null && value !== undefined && value !== ""

/**
 * @param {object} product
 * @param {object} [variation] chosen colour or DOS row, if any
 * @returns {boolean}
 */
export const isSellable = (product, variation = null) => {
  if (!product) return false

  if (variation && isSet(variation.countInStock)) {
    return Number(variation.countInStock) > 0
  }

  return product.stockStatus !== "Out of Stock"
}

export default { isSellable }
