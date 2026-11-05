"use client"

import { useLoyalty } from "../context/LoyaltyContext"
import { useLanguage } from "../context/LanguageContext"
import GrabCoin from "./GrabCoin"

/**
 * "Earn 2,500 Grabian Points with this purchase."
 *
 * Renders nothing when the programme is off, when this product earns no points, or when
 * the admin has turned product-page display off -- so it can be dropped in anywhere
 * without a surrounding conditional.
 *
 * `priceAed` must be the price in AED (the currency prices are stored in), not the
 * converted display price, because the earn rate is defined against AED.
 */
/**
 * `surface` picks which admin display toggle governs this badge -- the programme settings
 * let the product page and the cart be switched on independently.
 */
const LoyaltyEarnBadge = ({
  product,
  priceAed,
  quantity = 1,
  className = "",
  compact = false,
  surface = "product",
}) => {
  const { isEnabled, settings, pointsForProduct, formatPoints } = useLoyalty()
  const { isArabic } = useLanguage() || {}

  const visibleHere = surface === "cart" ? settings.showOnCart : settings.showOnProductPage
  if (!isEnabled || !visibleHere || !product) return null

  const unitPoints = pointsForProduct(product, priceAed)
  const total = unitPoints * Math.max(1, Number(quantity) || 1)
  if (total <= 0) return null

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium text-green-700 ${className}`}
        dir={isArabic ? "rtl" : "ltr"}
      >
        <GrabCoin size={16} />
        {formatPoints(total, { isArabic })}
      </span>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 ${className}`}
      dir={isArabic ? "rtl" : "ltr"}
    >
      <GrabCoin size={22} />
      <span className="text-sm text-green-800">
        {isArabic ? "اكسب" : "Earn"} <strong>{formatPoints(total, { isArabic })}</strong>{" "}
        {isArabic ? "مع هذا الطلب" : "with this purchase"}
      </span>
    </div>
  )
}

export default LoyaltyEarnBadge
