// VAT on this store is always *inside* the price a customer sees, so it is
// extracted from a line total rather than added on top of it. Every invoice
// column and every total comes through here, so a document can never show a
// per-line VAT that disagrees with its own footer.

// Used only when a document records no rate of its own and none can be backed
// out of what it stored -- almost always an older order. Zero: this store sells in
// Pakistan and charges no VAT, so a document with no rate had none applied.
export const DEFAULT_VAT_RATE = 0

/**
 * The VAT rate that applies to one order or quotation, as a percentage.
 *
 * A document created after the Tax/Vat field shipped carries its own rate, so
 * changing the rate on a quotation flows straight through to each line. Older
 * documents recorded only the split, so the rate is backed out of that; if even
 * that is missing, the store default stands in.
 */
export const resolveVatRate = (order = {}) => {
  const stored = Number(order?.taxRate)
  // A deliberate 0% has to survive, so this tests for a number rather than
  // truthiness.
  if (Number.isFinite(stored) && stored >= 0) return stored

  const net = Number(order?.itemsPrice) || 0
  const tax = Number(order?.taxPrice) || 0
  if (net > 0 && tax > 0) return (tax / net) * 100

  return DEFAULT_VAT_RATE
}

/**
 * Split a VAT-inclusive amount into what the goods cost and the VAT inside it.
 *
 * net + vat === gross for any rate, so a column of nets and a column of VATs
 * always add back up to the column of totals.
 */
export const splitVatInclusive = (grossAmount, rate) => {
  const gross = Number(grossAmount) || 0
  const resolvedRate = Number(rate) || 0

  if (resolvedRate <= 0) {
    return { gross, net: gross, vat: 0 }
  }

  const net = gross / (1 + resolvedRate / 100)
  return { gross, net, vat: gross - net }
}

/**
 * Per-line VAT split for a list of order items, plus the column totals.
 *
 * The totals are summed from the same per-line figures the invoice prints, so
 * the footer always matches what is above it.
 */
export const splitItemsVat = (items = [], rate) => {
  const lines = (Array.isArray(items) ? items : []).map((item) => {
    const quantity = Number(item?.quantity) || 0
    const unitPrice = Number(item?.price) || 0
    return { item, quantity, unitPrice, ...splitVatInclusive(unitPrice * quantity, rate) }
  })

  return {
    lines,
    net: lines.reduce((sum, line) => sum + line.net, 0),
    vat: lines.reduce((sum, line) => sum + line.vat, 0),
    gross: lines.reduce((sum, line) => sum + line.gross, 0),
  }
}

/**
 * "VAT 5%" / "VAT 0%" -- the rate belongs in the column heading so the reader
 * can see which rate produced the numbers underneath it.
 */
export const formatVatRateLabel = (rate) => {
  const resolved = Number(rate) || 0
  const rounded = Math.round(resolved * 100) / 100
  return `VAT ${rounded}%`
}
