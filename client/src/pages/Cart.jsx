"use client"

import { Link } from "react-router-dom"
import { useCart } from "../context/CartContext"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import {
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
  Package,
  X,
  Percent,
  Gift,
  Shield,
  Tag,
  Truck,
  Lock,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  Info,
  CheckCircle2,
} from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import axios from "axios"
import { getFullImageUrl } from "../utils/imageUtils"
import TranslatedText from "../components/TranslatedText"
import PromoPopup from "../components/PromoPopup"

import config from "../config/config"
import { selectDeliveryMethod, describeDeliveryBlock } from "../utils/deliveryCharge"
import { useLoyalty } from "../context/LoyaltyContext"
import LoyaltyEarnBadge from "../components/LoyaltyEarnBadge"
import LoyaltyRedeemPanel from "../components/LoyaltyRedeemPanel"
import GrabCoin from "../components/GrabCoin"
import { useReferral } from "../context/ReferralContext"
import ReferralRewardCheckbox from "../components/ReferralRewardCheckbox"

const CartQuantityInput = ({ value, onChange, max }) => {
  const [localVal, setLocalVal] = useState(value)

  useEffect(() => {
    setLocalVal(value)
  }, [value])

  const handleInputChange = (e) => {
    const valStr = e.target.value
    if (valStr === "") {
      setLocalVal("")
      return
    }
    const num = parseInt(valStr, 10)
    if (isNaN(num)) return

    const finalNum = max ? Math.min(num, max) : num
    setLocalVal(finalNum)

    if (finalNum >= 1) {
      onChange(finalNum)
    }
  }

  const handleBlur = () => {
    if (localVal === "" || localVal < 1) {
      setLocalVal(1)
      onChange(1)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur()
    }
  }

  const handleDecrease = () => {
    const newVal = Math.max(1, (typeof localVal === "number" ? localVal : 1) - 1)
    setLocalVal(newVal)
    onChange(newVal)
  }

  const handleIncrease = () => {
    const current = typeof localVal === "number" ? localVal : 1
    const newVal = max ? Math.min(max, current + 1) : current + 1
    setLocalVal(newVal)
    onChange(newVal)
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white">
      <button
        type="button"
        onClick={handleDecrease}
        aria-label="Decrease quantity"
        className="h-9 w-8 sm:w-9 flex items-center justify-center rounded-l-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={value <= 1}
      >
        <Minus size={15} />
      </button>
      <input
        type="number"
        value={localVal}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label="Quantity"
        className="h-9 w-10 sm:w-12 text-center text-sm font-semibold text-gray-900 border-x border-gray-200 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        min="1"
        max={max}
      />
      <button
        type="button"
        onClick={handleIncrease}
        aria-label="Increase quantity"
        className="h-9 w-8 sm:w-9 flex items-center justify-center rounded-r-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={max ? value >= max : false}
      >
        <Plus size={15} />
      </button>
    </div>
  )
}

// One line of the order summary: label left, amount right, the same shape every time.
const SummaryRow = ({ label, value, tone = "", strong = false }) => (
  <div className={`flex items-start justify-between gap-4 text-sm ${tone}`}>
    <span className={strong ? "font-semibold text-gray-900" : tone ? "" : "text-gray-600"}>{label}</span>
    <span className={`text-right whitespace-nowrap ${strong ? "font-semibold text-gray-900" : tone ? "font-medium" : "font-medium text-gray-900"}`}>
      {value}
    </span>
  </div>
)

const Cart = () => {
  const {
    cartItems,
    cartTotal,
    removeFromCart,
    removeBundleFromCart,
    updateQuantity,
    getGroupedCartItems,
    deliveryOptions,
    setDeliveryOptions,
    selectedDelivery,
    setSelectedDelivery,
    setTax,
    coupon,
    setCoupon,
    couponDiscount,
    setCouponDiscount,
    loyaltyPointsToRedeem,
    loyaltyDiscount,
    applyLoyaltyRedemption,
  } = useCart()
  const { getLocalizedPath, isArabic } = useLanguage()
  const { formatPrice: formatCurrencyPrice, currentCountry } = useCurrency()
  const {
    isEnabled: referralEnabled,
    selectedRewardId: referralRewardId,
    referralDiscount,
    applyReward: applyReferralReward,
    clearReward: clearReferralReward,
  } = useReferral()

  const [couponInput, setCouponInput] = useState("")
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState("")

  // Coupon modal states
  const [showCouponsModal, setShowCouponsModal] = useState(false)
  const [publicCoupons, setPublicCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [couponModalError, setCouponModalError] = useState(null)
  const [couponCopied, setCouponCopied] = useState(null)

  const { grouped, standaloneItems } = getGroupedCartItems()

  // Protection plans are priced and listed separately from the products they cover.
  const protectionItems = cartItems.filter((item) => item.isProtection)
  const regularCartItems = cartItems.filter((item) => !item.isProtection)
  const filteredStandaloneItems = standaloneItems.filter((item) => !item.isProtection)

  useEffect(() => {
    // Fetch country-specific delivery options
    const fetchDeliveryOptions = async () => {
      try {
        const { data } = await axios.get(`${config.API_URL}/api/delivery-charges`, {
          params: {
            country: currentCountry?.name || "Pakistan",
            countryCode: currentCountry?.code,
          },
        })
        setDeliveryOptions(data)
        if (!selectedDelivery && data.length > 0) {
          setSelectedDelivery(data[0])
        }
      } catch (err) {
        console.error("Error fetching country delivery options:", err)
      }
    }
    // Fetch tax
    const fetchTax = async () => {
      try {
        const { data } = await axios.get(`${config.API_URL}/api/tax`, {
          params: { countryCode: currentCountry?.code },
        })
        // Use first active tax
        if (data && data.length > 0) setTax(data[0])
      } catch (err) {
        console.error("Error fetching tax:", err)
      }
    }
    fetchDeliveryOptions()
    fetchTax()
  }, [currentCountry?.name, currentCountry?.code])

  useEffect(() => {
    if (cartItems.length > 0) {
      // Push view cart event to data layer
      window.dataLayer = window.dataLayer || []
      window.dataLayer.push({
        event: "view_cart",
        ecommerce: {
          currency: "PKR",
          value: cartTotal,
          items: cartItems.map((item) => ({
            item_id: item._id,
            item_name: item.name,
            item_category: item.parentCategory?.name || item.category?.name || "Uncategorized",
            item_brand: item.brand?.name || "Unknown",
            price: item.price,
            quantity: item.quantity,
          })),
        },
      })
    }
  }, [cartItems, cartTotal])

  // Escape closes the coupons modal.
  useEffect(() => {
    if (!showCouponsModal) return
    const onKey = (e) => {
      if (e.key === "Escape") handleCloseCouponsModal()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showCouponsModal])

  const handleQuantityChange = (productId, newQuantity, bundleId = null) => {
    updateQuantity(productId, newQuantity, bundleId)
  }

  // Removing any item from a bundle removes the whole bundle.
  const removeItemFromBundle = (itemId, bundleId) => {
    removeBundleFromCart(bundleId)
  }

  // Tax is included in prices, no separate calculation needed
  const taxAmount = 0

  // Coupon logic. Takes the code so the coupons modal can apply one directly.
  const applyCouponCode = async (code) => {
    const trimmed = String(code || "").trim()
    if (!trimmed) return false
    setCouponLoading(true)
    setCouponError("")
    try {
      // Filter out protection items for coupon validation (only validate actual products)
      const cartApiItems = cartItems
        .filter((item) => !item.isProtection)
        .map((item) => ({ product: item._id, qty: item.quantity }))
      const { data } = await axios.post(`${config.API_URL}/api/coupons/validate`, {
        code: trimmed,
        cartItems: cartApiItems,
      })
      // Only ONE discount at a time: coupon, referral OR Grabian Points. Applying a coupon
      // drops any referral reward and any redeemed points so the total never counts two.
      clearReferralReward()
      applyLoyaltyRedemption(0, 0)
      setCoupon(data.coupon)
      setCouponDiscount(data.discountAmount)
      setCouponInput(trimmed)
      setCouponError("")
      return true
    } catch (err) {
      setCoupon(null)
      setCouponDiscount(0)
      setCouponError(err.response?.data?.message || "Invalid coupon")
      return false
    } finally {
      setCouponLoading(false)
    }
  }

  const handleApplyCoupon = () => applyCouponCode(couponInput)

  const handleRemoveCoupon = () => {
    setCoupon(null)
    setCouponDiscount(0)
    setCouponInput("")
    setCouponError("")
  }

  // Coupon modal functions
  const COUPON_COLORS = [
    { main: "bg-gradient-to-r from-yellow-50 to-yellow-100", stub: "bg-yellow-300", border: "border-yellow-300", text: "text-yellow-800" },
    { main: "bg-gradient-to-r from-blue-50 to-blue-100", stub: "bg-blue-300", border: "border-blue-300", text: "text-blue-800" },
    { main: "bg-gradient-to-r from-green-50 to-green-100", stub: "bg-green-300", border: "border-green-300", text: "text-green-800" },
    { main: "bg-gradient-to-r from-purple-50 to-purple-100", stub: "bg-purple-300", border: "border-purple-300", text: "text-purple-800" },
  ]

  const handleOpenCouponsModal = async () => {
    setShowCouponsModal(true)
    setLoadingCoupons(true)
    setCouponModalError(null)

    try {
      const response = await axios.get(`${config.API_URL}/api/coupons`)
      setPublicCoupons(response.data)
    } catch (error) {
      console.error("Error fetching coupons:", error)
      setCouponModalError("Failed to load coupons")
    } finally {
      setLoadingCoupons(false)
    }
  }

  const handleCloseCouponsModal = () => {
    setShowCouponsModal(false)
    setCouponCopied(null)
  }

  const handleCopyCoupon = (couponCode, couponId) => {
    navigator.clipboard.writeText(couponCode)
    setCouponCopied(couponId)
    setTimeout(() => setCouponCopied(null), 2000)
  }

  const handleUseCoupon = async (couponCode) => {
    const ok = await applyCouponCode(couponCode)
    if (ok) handleCloseCouponsModal()
  }

  const formatPrice = (price) => {
    return formatCurrencyPrice(price, isArabic)
  }

  // Proper pricing calculation for bundle items
  const getItemPrice = (item) => {
    // If it's a bundle item with bundle price, use that
    if (item.isBundleItem && item.bundlePrice) {
      return item.bundlePrice
    }
    // If it has bundle discount, apply 25% discount
    if (item.bundleDiscount && item.originalPrice) {
      return item.originalPrice * 0.75 // 25% discount
    }
    // Otherwise use offer price or regular price
    return item.offerPrice && item.offerPrice > 0 ? item.offerPrice : item.price
  }

  const getItemTotal = (item) => {
    const itemPrice = getItemPrice(item)
    return itemPrice * item.quantity
  }

  const getItemPricingDetails = (item) => {
    const originalPrice = Number(item.originalPrice || item.basePrice || item.price) || 0
    const currentPrice = getItemPrice(item)

    const savings = originalPrice > currentPrice ? originalPrice - currentPrice : 0
    const discountPercentage = savings > 0 ? Math.round((savings / originalPrice) * 100) : 0

    return {
      basePrice: originalPrice,
      currentPrice: currentPrice,
      savings,
      discountPercentage,
      hasDiscount: savings > 0,
      isBundleDiscount: item.bundleDiscount || false,
    }
  }

  // Cart totals (excluding protection items)
  const calculateCartTotals = useMemo(() => {
    let totalBasePrice = 0
    let totalCurrentPrice = 0
    let totalSavings = 0

    regularCartItems.forEach((item) => {
      const pricingDetails = getItemPricingDetails(item)
      totalBasePrice += pricingDetails.basePrice * item.quantity
      totalCurrentPrice += pricingDetails.currentPrice * item.quantity
      totalSavings += pricingDetails.savings * item.quantity
    })

    return {
      totalBasePrice,
      totalCurrentPrice,
      totalSavings,
    }
  }, [regularCartItems])

  const calculateBundleTotals = (bundleItems) => {
    let bundleBaseTotal = 0
    let bundleCurrentTotal = 0
    let bundleSavings = 0

    bundleItems.forEach((item) => {
      const pricingDetails = getItemPricingDetails(item)
      bundleBaseTotal += pricingDetails.basePrice * item.quantity
      bundleCurrentTotal += pricingDetails.currentPrice * item.quantity
      bundleSavings += pricingDetails.savings * item.quantity
    })

    return {
      total: bundleCurrentTotal,
      savings: bundleSavings,
      baseTotal: bundleBaseTotal,
    }
  }

  const cartTotals = calculateCartTotals

  // Calculate protection items total
  const protectionTotal = protectionItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const hasAdminDeliveryCharges = (deliveryOptions?.length || 0) > 0

  // The goods subtotal every delivery band is measured against -- items only, before any
  // coupon or points. Same figure the checkout and the server use, so all three agree on
  // the shipping.
  const deliveryGoodsSubtotal = cartTotals.totalCurrentPrice + protectionTotal

  // Resolved through the shared bands rather than read off the method, so a basket past
  // the maximum shows free here exactly as it will at checkout.
  const resolvedDelivery = useMemo(
    () => selectDeliveryMethod(deliveryOptions || [], deliveryGoodsSubtotal, selectedDelivery?._id),
    [deliveryOptions, deliveryGoodsSubtotal, selectedDelivery?._id],
  )

  const fallbackDelivery = resolvedDelivery.method || selectedDelivery || deliveryOptions?.[0]
  const deliveryCharge = hasAdminDeliveryCharges ? resolvedDelivery.charge : 0

  const deliveryBlocked = hasAdminDeliveryCharges && !resolvedDelivery.available
  const deliveryBlockedMessage = deliveryBlocked ? describeDeliveryBlock(resolvedDelivery, formatPrice) : ""

  // A referral reward comes off the goods only -- never delivery or fees -- and only what
  // is left after any coupon. Same order the checkout and the server apply them in.
  const referralEligibleAmount = Math.max(0, cartTotals.totalCurrentPrice + protectionTotal - couponDiscount)
  const appliedReferralDiscount = Math.min(referralDiscount, referralEligibleAmount)

  // Points only ever discount the goods -- never delivery, tax or fees -- so the panel is
  // capped against this figure and the discount is clamped to it.
  const loyaltyEligibleAmount = Math.max(0, referralEligibleAmount - appliedReferralDiscount)
  const appliedLoyaltyDiscount = Math.min(loyaltyDiscount, loyaltyEligibleAmount)

  const totalBeforeLoyalty =
    cartTotals.totalCurrentPrice + protectionTotal + deliveryCharge + taxAmount - couponDiscount - appliedReferralDiscount
  const totalWithDeliveryTaxCoupon = Math.max(0, totalBeforeLoyalty - appliedLoyaltyDiscount)

  const { isEnabled: loyaltyEnabled, formatPoints, balance: loyaltyBalance, pending: loyaltyPending } = useLoyalty()

  // Products only: the subtotal this sits next to excludes protection plans.
  const itemCount = regularCartItems.reduce((sum, item) => sum + item.quantity, 0)
  const productHref = (item) => getLocalizedPath(`/product/${encodeURIComponent(item.slug || item._id)}`)

  // One cart line. Picture, name and options on top; the price breakdown in a light
  // strip; quantity and the line total on the last row. The same markup serves phones
  // and desktops.
  const renderItem = (item, isInBundle = false, bundleId = null) => {
    const pricingDetails = getItemPricingDetails(item)
    const itemTotal = getItemTotal(item)
    const atMax = item.maxPurchaseQty && item.quantity >= item.maxPurchaseQty

    return (
      <li key={`${item._id}-${bundleId || "standalone"}`} className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex gap-4">
          <Link
            to={productHref(item)}
            className="w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0 rounded-xl border border-gray-100 bg-white overflow-hidden hover:opacity-90 transition"
          >
            <img
              src={getFullImageUrl(item.image) || "/placeholder.svg"}
              alt={item.name}
              className="w-full h-full object-contain p-1"
              loading="lazy"
            />
          </Link>

          <div className="flex-1 min-w-0">
            {/* Name, brand, options */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={productHref(item)} title={item.name} className="block">
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 hover:text-lime-700 transition">
                    <TranslatedText text={item.name} />
                  </h3>
                </Link>
                <p className="mt-0.5 text-xs sm:text-sm text-gray-500">{item.brand?.name || "N/A"}</p>
                {(item.selectedColorData || item.selectedDosData || item.selectedSizeData || isInBundle) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.selectedSizeData && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800 font-medium">
                        <TranslatedText>Size</TranslatedText>: {item.selectedSizeData.code || item.selectedSizeData.name}
                        {Number(item.selectedSizeData.additionalPrice) > 0 && (
                          <span className="text-amber-600 font-normal">(+{formatPrice(item.selectedSizeData.additionalPrice)})</span>
                        )}
                      </span>
                    )}
                    {item.selectedColorData && (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
                        <span
                          className="inline-block w-3 h-3 rounded-full border border-gray-300"
                          style={{ backgroundColor: item.selectedColorData.color?.toLowerCase() || "#9333ea" }}
                        />
                        <TranslatedText>Color</TranslatedText>: {item.selectedColorData.color}
                        {item.selectedColorData.sku && <span className="text-gray-400">({item.selectedColorData.sku})</span>}
                      </span>
                    )}
                    {item.selectedDosData && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
                        <TranslatedText>OS</TranslatedText>: {item.selectedDosData.dosType}
                        {item.selectedDosData.sku && <span className="text-gray-400">({item.selectedDosData.sku})</span>}
                      </span>
                    )}
                    {isInBundle && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5 text-xs font-medium text-lime-800">
                        <Package size={12} />
                        {item.bundleDiscount ? <TranslatedText>Bundle item · 25% off</TranslatedText> : <TranslatedText>Bundle item</TranslatedText>}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => (isInBundle ? removeItemFromBundle(item._id, bundleId) : removeFromCart(item._id))}
                className="flex-shrink-0 p-1.5 -mr-1.5 -mt-1 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                title={isInBundle ? "Remove entire bundle" : "Remove from cart"}
                aria-label={isInBundle ? "Remove entire bundle" : "Remove from cart"}
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* Price breakdown: the same three facts as before, side by side */}
            <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs sm:text-sm">
              {pricingDetails.hasDiscount ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2">
                  <div className="flex justify-between sm:block">
                    <p className="text-gray-500">
                      <TranslatedText>Original Price</TranslatedText>
                    </p>
                    <p className="font-medium text-gray-400 line-through">{formatPrice(pricingDetails.basePrice)}</p>
                  </div>
                  <div className="flex justify-between sm:block">
                    <p className="text-gray-500">
                      <TranslatedText>Our Price</TranslatedText>
                    </p>
                    <p className="font-semibold text-red-600">{formatPrice(pricingDetails.currentPrice)}</p>
                  </div>
                  <div className="flex justify-between sm:block">
                    <p className="text-gray-500">
                      <TranslatedText>You Save</TranslatedText>
                    </p>
                    <p className="text-right sm:text-left font-semibold text-green-600">
                      {formatPrice(pricingDetails.savings)}{" "}
                      <span className="font-medium">({pricingDetails.discountPercentage}%)</span>
                      {pricingDetails.isBundleDiscount && (
                        <span className="block text-[11px] font-normal text-green-700">
                          <TranslatedText>Bundle Discount</TranslatedText>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">
                    <TranslatedText>Price</TranslatedText>
                  </span>
                  <span className="font-semibold text-red-600">{formatPrice(pricingDetails.currentPrice)}</span>
                </div>
              )}
            </div>

            {/* Quantity and line total */}
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <CartQuantityInput
                  value={item.quantity}
                  onChange={(newQty) => handleQuantityChange(item._id, newQty, bundleId)}
                  max={item.maxPurchaseQty}
                />
                {atMax && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    <TranslatedText>Max</TranslatedText> {item.maxPurchaseQty}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm sm:text-base font-bold text-gray-900 whitespace-nowrap">{formatPrice(itemTotal)}</p>
                {pricingDetails.hasDiscount && (
                  <p className="text-xs sm:text-sm font-medium text-green-600">
                    <TranslatedText>Total Save</TranslatedText>: {formatPrice(pricingDetails.savings * item.quantity)}
                  </p>
                )}
              </div>
            </div>

            <LoyaltyEarnBadge
              product={item}
              priceAed={pricingDetails.currentPrice}
              quantity={item.quantity}
              surface="cart"
              className="mt-3 text-xs"
            />
          </div>
        </div>
      </li>
    )
  }

  const isEmpty = cartItems.length === 0

  return (
    <div className="bg-gray-50 min-h-[60vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-28 lg:pb-10 text-sm">
        {isEmpty ? (
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-16 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-lime-50">
              <ShoppingBag size={36} className="text-lime-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              <TranslatedText>Your cart is empty</TranslatedText>
            </h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              <TranslatedText>Looks like you haven't added any items to your cart yet.</TranslatedText>
            </p>
            <Link
              to={getLocalizedPath("/")}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-600 px-6 py-3 text-sm font-semibold text-white hover:bg-lime-700"
            >
              <TranslatedText>Continue Shopping</TranslatedText>
              <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 lg:gap-8 items-start">
            {/* Cart items */}
            <div className="min-w-0 space-y-5">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                <TranslatedText>Shopping Cart</TranslatedText>
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({itemCount} {itemCount === 1 ? <TranslatedText>item</TranslatedText> : <TranslatedText>items</TranslatedText>})
                </span>
              </h1>
              {/* Bundles first */}
              {Object.values(grouped).map((bundle) => {
                const bundleTotals = calculateBundleTotals(bundle.items)

                return (
                  <div key={bundle.bundleId} className="bg-white rounded-2xl border-2 border-lime-200 overflow-hidden">
                    <div className="bg-lime-50 px-4 sm:px-5 py-3 border-b border-lime-200">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Package className="text-lime-600" size={18} />
                          <h3 className="font-semibold text-lime-900">
                            <TranslatedText>Frequently Bought Together</TranslatedText>
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBundleFromCart(bundle.bundleId)}
                          className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                          title="Remove entire bundle"
                        >
                          <Trash2 size={14} />
                          <TranslatedText>Remove Bundle</TranslatedText>
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <span className="text-lime-800">
                          <TranslatedText>Bundle Total</TranslatedText>: <span className="font-semibold">{formatPrice(bundleTotals.total)}</span>
                        </span>
                        <span className="text-green-700">
                          <TranslatedText>You Save</TranslatedText>: <span className="font-semibold">{formatPrice(bundleTotals.savings)}</span>
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-lime-700">
                        <Info size={12} />
                        <TranslatedText>Removing any item will remove the entire bundle</TranslatedText>
                      </p>
                    </div>
                    <ul className="divide-y divide-gray-100">{bundle.items.map((item) => renderItem(item, true, bundle.bundleId))}</ul>
                  </div>
                )
              })}

              {/* Standalone items */}
              {filteredStandaloneItems.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {Object.keys(grouped).length > 0 && (
                    <div className="px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50">
                      <h3 className="font-semibold text-gray-800">
                        <TranslatedText>Individual Items</TranslatedText>
                      </h3>
                    </div>
                  )}
                  <ul className="divide-y divide-gray-100">{filteredStandaloneItems.map((item) => renderItem(item, false, null))}</ul>
                </div>
              )}

              {/* Actions under the products */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
                <Link
                  to={getLocalizedPath("/")}
                  className="inline-flex items-center gap-2 rounded-lg bg-lime-600 px-3 py-2 text-sm font-medium text-white hover:bg-lime-700 transition"
                >
                  <ArrowLeft size={16} />
                  <TranslatedText>Continue Shopping</TranslatedText>
                </Link>
                <button
                  type="button"
                  onClick={handleOpenCouponsModal}
                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-3 py-2 text-sm font-medium text-black hover:bg-yellow-500 transition"
                >
                  <Gift size={16} />
                  <TranslatedText>Available Coupons</TranslatedText>
                </button>
              </div>
            </div>

            {/* Order summary — pinned while the products scroll */}
            <aside className="lg:sticky lg:top-[130px] lg:self-start">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md shadow-lime-100">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-base font-semibold text-gray-900">
                    <TranslatedText>Order Summary</TranslatedText>
                  </h2>
                </div>

                <div className="px-5 py-4 space-y-2">
                  {/* Price breakdown */}
                  {cartTotals.totalSavings > 0 ? (
                    <>
                      <SummaryRow
                        label={<TranslatedText>Original Price</TranslatedText>}
                        value={<span className="font-normal text-gray-400 line-through">{formatPrice(cartTotals.totalBasePrice)}</span>}
                      />
                      <SummaryRow
                        label={<TranslatedText>Discounted Price</TranslatedText>}
                        value={<span className="text-red-600">{formatPrice(cartTotals.totalCurrentPrice)}</span>}
                      />
                      <SummaryRow label={<TranslatedText>Total Savings</TranslatedText>} value={`- ${formatPrice(cartTotals.totalSavings)}`} tone="text-green-600" />
                      <div className="border-t border-gray-100 pt-2">
                        <SummaryRow
                          label={
                            <>
                              <TranslatedText>Subtotal</TranslatedText>{" "}
                              <span className="text-gray-400">
                                ({itemCount} {itemCount === 1 ? <TranslatedText>item</TranslatedText> : <TranslatedText>items</TranslatedText>})
                              </span>
                            </>
                          }
                          value={formatPrice(cartTotals.totalCurrentPrice)}
                        />
                      </div>
                    </>
                  ) : (
                    <SummaryRow
                      label={
                        <>
                          <TranslatedText>Subtotal</TranslatedText>{" "}
                          <span className="text-gray-400">
                            ({itemCount} {itemCount === 1 ? <TranslatedText>item</TranslatedText> : <TranslatedText>items</TranslatedText>})
                          </span>
                        </>
                      }
                      value={formatPrice(cartTotals.totalCurrentPrice)}
                    />
                  )}

                  {/* Delivery method is chosen on the checkout page (beside the products);
                      the cart only shows the resulting shipping line below. */}
                  {hasAdminDeliveryCharges && !deliveryBlocked && (
                    <SummaryRow
                      label={
                        <>
                          <TranslatedText>Shipping</TranslatedText>
                          {fallbackDelivery?.name ? <span className="text-gray-400"> ({fallbackDelivery.name})</span> : null}
                        </>
                      }
                      value={
                        deliveryCharge === 0 ? (
                          <span className="font-semibold text-green-600">
                            <TranslatedText>Free</TranslatedText>
                          </span>
                        ) : (
                          formatPrice(deliveryCharge)
                        )
                      }
                    />
                  )}

                  {/* Too small for every method configured. Said here so the shopper finds
                      out in the cart rather than at the end of checkout. */}
                  {deliveryBlocked && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-800">
                        <TranslatedText>Delivery not available for this order</TranslatedText>
                      </p>
                      <p className="mt-0.5 text-xs text-amber-700">{deliveryBlockedMessage}</p>
                    </div>
                  )}

                  {/* Protection plans */}
                  {protectionItems.length > 0 && (
                    <div className="border-t border-gray-100 pt-2">
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                        <Shield size={15} className="text-blue-600" />
                        <TranslatedText>Protection Plans</TranslatedText>
                      </h3>
                      <ul className="space-y-2">
                        {protectionItems.map((item) => (
                          <li key={item._id} className="flex items-start justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">{item.protectionData?.name || item.name}</p>
                              <p className="text-xs text-gray-600">
                                {item.protectionData?.duration ? `${item.protectionData.duration} · ` : ""}
                                <TranslatedText>For</TranslatedText>: {item.name.split(" for ")[1] || "Product"}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-sm font-semibold text-red-600 whitespace-nowrap">{formatPrice(item.price)}</span>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item._id)}
                                className="p-1 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600"
                                title="Remove protection"
                                aria-label="Remove protection"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Applied discounts shown read-only. The controls live on the checkout
                      page (or the Available Coupons modal); the cart total already reflects
                      them, so they must appear here too. */}
                  {coupon && (
                    <SummaryRow
                      label={
                        <span className="inline-flex items-center gap-2">
                          <TranslatedText>Coupon</TranslatedText>
                          <span className="font-mono text-xs font-semibold text-green-700">{coupon.code}</span>
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            <TranslatedText>Remove</TranslatedText>
                          </button>
                        </span>
                      }
                      value={`- ${formatPrice(couponDiscount)}`}
                      tone="text-green-600"
                    />
                  )}

                  {appliedReferralDiscount > 0 && (
                    <SummaryRow label={<TranslatedText>Referral discount</TranslatedText>} value={`- ${formatPrice(appliedReferralDiscount)}`} tone="text-green-600" />
                  )}

                  {appliedLoyaltyDiscount > 0 && (
                    <SummaryRow label={<TranslatedText>Grabian Points applied</TranslatedText>} value={`- ${formatPrice(appliedLoyaltyDiscount)}`} tone="text-green-600" />
                  )}

                </div>

                {/* Total and checkout */}
                <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/60 rounded-b-2xl">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-base font-semibold text-gray-900">
                      <TranslatedText>Total Amount</TranslatedText>
                    </span>
                    <span className="text-lg font-bold text-gray-900 whitespace-nowrap">{formatPrice(totalWithDeliveryTaxCoupon)}</span>
                  </div>

                  {hasAdminDeliveryCharges && !deliveryBlocked && deliveryCharge === 0 && (
                    <p className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                      <Truck size={14} />
                      <TranslatedText>Free shipping is applied to this order.</TranslatedText>
                    </p>
                  )}

                  <label className="mt-4 flex items-start gap-2 text-xs text-gray-600">
                    <input type="checkbox" className="mt-0.5 rounded border-gray-300 text-lime-600 focus:ring-lime-500" defaultChecked />
                    <span>
                      <TranslatedText>I agree to our</TranslatedText>{" "}
                      <Link to={getLocalizedPath("/terms-conditions")} className="text-lime-700 underline hover:text-lime-800">
                        <TranslatedText>Terms of use</TranslatedText>
                      </Link>{" "}
                      &{" "}
                      <Link to={getLocalizedPath("/privacy-policy")} className="text-lime-700 underline hover:text-lime-800">
                        <TranslatedText>Privacy Policy</TranslatedText>
                      </Link>
                    </span>
                  </label>

                  <Link
                    to={getLocalizedPath("/checkout")}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-lime-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-lime-700 transition"
                  >
                    <Lock size={16} />
                    <TranslatedText>Checkout</TranslatedText>
                  </Link>

                  <div className="mt-3 flex items-center justify-center gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-gray-400">
                      <TranslatedText>We accept</TranslatedText>
                    </span>
                    {["visa.png", "master.png", "tabby.png", "tamara.png", "cod.png"].map((file) => (
                      <img key={file} src={`/${file}`} alt="" className="h-5 w-auto rounded" loading="lazy" />
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Coupons modal */}
        {showCouponsModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
            onClick={handleCloseCouponsModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupons-title"
          >
            <div
              className="bg-white w-full sm:max-w-2xl max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 id="coupons-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Gift size={18} className="text-amber-500" />
                  <TranslatedText>Available Coupons</TranslatedText>
                </h2>
                <button
                  type="button"
                  className="p-2 -mr-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  onClick={handleCloseCouponsModal}
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-4">
                {loadingCoupons ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
                  </div>
                ) : couponModalError ? (
                  <div className="text-red-600 text-center py-8">{couponModalError}</div>
                ) : publicCoupons.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">
                    <TranslatedText>No coupons available at the moment.</TranslatedText>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {publicCoupons.map((item, idx) => {
                      const color = COUPON_COLORS[idx % COUPON_COLORS.length]
                      const categories =
                        item.categories && item.categories.length > 0 ? item.categories.map((cat) => cat.name || cat).join(", ") : "All Categories"
                      const isApplied = coupon?.code === item.code
                      return (
                        <div key={item._id || idx} className={`flex rounded-xl border ${color.border} overflow-hidden`}>
                          {/* Stub */}
                          <div className={`flex flex-col items-center justify-center px-3 py-3 ${color.stub} min-w-[84px] text-center`}>
                            <span className="text-[10px] font-semibold tracking-widest text-gray-700">GIFT COUPON</span>
                            <span className={`mt-1 text-xl font-bold leading-none ${color.text} flex items-center`}>
                              {item.discountType === "percentage" && <Percent className="w-4 h-4 mr-0.5" />}
                              {item.discountType === "percentage" ? `${item.discountValue}%` : `Rs ${item.discountValue}`}
                            </span>
                            <span className="mt-1 text-[10px] font-semibold tracking-widest text-gray-700">OFF</span>
                          </div>
                          {/* Body */}
                          <div className={`flex-1 min-w-0 ${color.main} px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold tracking-widest text-gray-500">PROMO CODE</p>
                              <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <span className={`inline-block bg-white border ${color.border} rounded-md px-2.5 py-1 font-mono text-sm font-bold ${color.text} tracking-widest`}>
                                  {item.code}
                                </span>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                  onClick={() => handleCopyCoupon(item.code, item._id)}
                                >
                                  {couponCopied === item._id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                                  {couponCopied === item._id ? "Copied!" : "Copy"}
                                </button>
                              </div>
                              {item.description && <p className="mt-1.5 text-xs text-gray-700">{item.description}</p>}
                              <p className="mt-1 text-[11px] text-gray-500">
                                Min: Rs {item.minOrderAmount || 0} · Valid: {new Date(item.validFrom).toLocaleDateString()} -{" "}
                                {new Date(item.validUntil).toLocaleDateString()}
                              </p>
                              <p className="text-[11px] font-semibold text-gray-700">{categories}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUseCoupon(item.code)}
                              disabled={couponLoading || isApplied}
                              className="self-start sm:self-center whitespace-nowrap rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isApplied ? <TranslatedText>Applied</TranslatedText> : <TranslatedText>Apply to cart</TranslatedText>}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {couponError && showCouponsModal && <p className="mt-3 text-xs text-red-600 text-center">{couponError}</p>}
              </div>
            </div>
          </div>
        )}

        <PromoPopup pageKey="cart" delayMs={3000} />
      </div>

      {/* Phone: total and checkout always in reach, above the bottom navigation. The
          WhatsApp bubble lifts itself clear of this bar (see Layout), so the bar no
          longer has to reserve a column of empty space on its right for it. */}
      {!isEmpty && (
        <div className="lg:hidden fixed inset-x-0 bottom-[72px] md:bottom-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">
                <TranslatedText>Total Amount</TranslatedText>
              </p>
              <p className="text-lg font-bold text-gray-900 leading-tight">{formatPrice(totalWithDeliveryTaxCoupon)}</p>
            </div>
            <Link
              to={getLocalizedPath("/checkout")}
              className="inline-flex items-center gap-2 rounded-xl bg-lime-600 px-5 py-3 text-sm font-semibold text-white hover:bg-lime-700"
            >
              <TranslatedText>Checkout</TranslatedText>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default Cart
