export const resolveOrderItemBasePrice = (item = {}) => {
  const candidates = [
    item.basePrice,
    item.originalPrice,
    item.product?.basePrice,
    item.product?.originalPrice,
    item.product?.oldPrice,
    item.product?.price,
    item.product?.offerPrice,
    item.price,
  ]

  for (const value of candidates) {
    const numeric = Number(value)
    if (!Number.isNaN(numeric) && numeric > 0) {
      return numeric
    }
  }

  return 0
}

export const resolveOrderItemSalePrice = (item = {}) => {
  const candidates = [
    item.price,
    item.offerPrice,
    item.selectedDosData?.offerPrice,
    item.selectedDosData?.price,
    item.selectedColorData?.offerPrice,
    item.selectedColorData?.price,
    item.product?.offerPrice,
    item.product?.price,
    item.basePrice,
    item.originalPrice,
    item.product?.basePrice,
    item.product?.originalPrice,
    item.product?.oldPrice,
  ]

  for (const value of candidates) {
    const numeric = Number(value)
    if (!Number.isNaN(numeric) && numeric > 0) {
      return numeric
    }
  }

  return 0
}

export const computeBaseSubtotal = (items = []) => {
  if (!Array.isArray(items)) {
    return 0
  }

  return items.reduce((sum, item) => {
    const quantity = Number(item?.quantity) || 0
    return sum + resolveOrderItemBasePrice(item) * quantity
  }, 0)
}

export const computeSaleSubtotal = (items = []) => {
  if (!Array.isArray(items)) {
    return 0
  }

  return items.reduce((sum, item) => {
    const quantity = Number(item?.quantity) || 1
    return sum + resolveOrderItemSalePrice(item) * quantity
  }, 0)
}

export const deriveBaseDiscount = (baseSubtotal, offerSubtotal) => {
  const resolvedBaseSubtotal = Number(baseSubtotal) || 0
  const resolvedOfferSubtotal = Number(offerSubtotal) || 0
  const discount = resolvedBaseSubtotal - resolvedOfferSubtotal
  return discount > 0 ? discount : 0
}

export const isProtectionItem = (item = {}) => {
  return Boolean(item?.isProtection || item?.protectionData || item?.protectionFor)
}
