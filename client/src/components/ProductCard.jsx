"use client"

import { Link } from "react-router-dom"
import { useCart } from "../context/CartContext"
import { ShoppingCart, Heart, Star, ShoppingBag } from "lucide-react"
import { useWishlist } from "../context/WishlistContext"
import { useToast } from "../context/ToastContext"
import { getOptimizedImageUrl } from "../utils/imageUtils"
import { resolveProductCategoryInfo, getProductEffectiveStock } from "../utils/productCategory"
import TranslatedText from "./TranslatedText"
import { useLanguage } from "../context/LanguageContext"

import { useCurrency } from "../context/CurrencyContext"

const ProductCard = ({ product, offerPageName }) => {
  const { addToCart } = useCart()
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist()
  const { showToast } = useToast()
  const { getLocalizedPath, isArabic } = useLanguage()
  const { formatPrice: formatCurrencyPrice, currentCountry } = useCurrency()

  const effectiveStockInfo = getProductEffectiveStock(product, currentCountry?.code)
  const stockStatus = effectiveStockInfo.stockStatus

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    addToCart({
      ...product,
      countInStock: effectiveStockInfo.countInStock,
      stockStatus: effectiveStockInfo.stockStatus,
    })
    showToast && showToast("Added to cart", "success")
  }

  const formatPrice = (price) => {
    const normalizedPrice = Number(price)
    const safePrice = Number.isFinite(normalizedPrice) ? normalizedPrice : 0
    return (
      <span lang={isArabic ? "ar" : "en"} dir={isArabic ? "rtl" : "ltr"}>
        {formatCurrencyPrice(safePrice, isArabic)}
      </span>
    )
  }

  // Use slug if available, otherwise fall back to ID
  const productUrl = getLocalizedPath(`/product/${product.slug || product._id}`)

  // Determine which price to show
  const hasDiscount = product.discount && Number(product.discount) > 0
  const basePrice = Number(product.price) || 0
  const offerPrice = Number(product.offerPrice) || 0
  const buyingPrice = Number(product.buyingPrice) || 0

  // Show offer price if it exists and is less than base price
  const hasValidOffer = offerPrice > 0 && basePrice > 0 && offerPrice < basePrice

  // Determine which price to display as main selling price (existing Base Price)
  let priceToShow = 0
  if (hasValidOffer) {
    priceToShow = offerPrice
  } else if (basePrice > 0) {
    priceToShow = basePrice
  } else if (offerPrice > 0) {
    priceToShow = offerPrice
  }

  // Display Buying Price as crossed-out (strikethrough) price
  const crossedPrice = buyingPrice > 0 ? buyingPrice : (hasValidOffer ? basePrice : 0)
  const showOldPrice = crossedPrice > 0

  // Fix rating and reviews display
  const rating = Number(product.rating) || 0
  const numReviews = Number(product.numReviews) || 0

  // Compute final discount label
  let finalDiscountLabel = null
  if (hasDiscount) {
    finalDiscountLabel = `${Number(product.discount)}% Off`
  } else if (hasValidOffer && basePrice > 0 && offerPrice > 0) {
    const pct = Math.round(((basePrice - offerPrice) / basePrice) * 100)
    if (pct > 0) finalDiscountLabel = `${pct}% Off`
  } else if (buyingPrice > 0 && priceToShow > 0 && buyingPrice > priceToShow) {
    const pct = Math.round(((buyingPrice - priceToShow) / buyingPrice) * 100)
    if (pct > 0) finalDiscountLabel = `${pct}% Off`
  }
  
  const { name: categoryName, sourceDoc: categorySourceDoc, fieldName: categoryFieldName } =
    resolveProductCategoryInfo(product)

  return (
    <div className="border border-page-border p-2 h-[410px] flex flex-col justify-between bg-page-surface">
      <div className="relative mb-2 flex justify-center items-center" style={{height:190}}>
        <Link to={productUrl} className="w-full h-full flex items-center justify-center">
          <img
            src={getOptimizedImageUrl(product.image, { width: 220, height: 220, quality: 68 }) || "/placeholder.svg"}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width="165"
            height="165"
            className="w-full h-full object-contain bg-white rounded mx-auto mb-4"
            style={{maxHeight:165}}
          />
        </Link>
        <button
          className="absolute top-1 right-1 text-gray-400 hover:text-red-500"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (isInWishlist(product._id)) {
              removeFromWishlist(product._id)
              showToast && showToast("Removed from wishlist", "info")
            } else {
              addToWishlist(product)
              showToast && showToast("Added to wishlist", "success")
            }
          }}
          aria-label={isInWishlist(product._id) ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={12} className={isInWishlist(product._id) ? "text-red-500 fill-red-500" : "text-gray-400"} />
        </button>
        {/* Offer Page Name badge at top-left */}
        {offerPageName && (
          <div 
            className="absolute top-2 left-2 text-black px-2 py-1 rounded text-[10px] font-medium shadow-sm z-10"
            style={{ backgroundColor: "#ffd900" }}
          >
            {offerPageName}
          </div>
        )}
        {/* Status & Discount badges overlayed at bottom of image, always inside image area */}
        <div className="absolute inset-x-0 -bottom-2 px-2 flex flex-wrap items-center gap-2 z-10">
          <div className={`${stockStatus === "In Stock" ? "bg-brand-600" : stockStatus === "PreOrder" ? "bg-brand-400" : "bg-stone-700"} text-white px-1 py-0.5 rounded text-[10px] font-medium shadow-sm`}>
            <TranslatedText text={stockStatus} sourceDoc={product} fieldName="stockStatus" />
          </div>
          {finalDiscountLabel && (
            <div className="bg-yellow-400 text-white px-1 py-0.5 rounded text-[10px] font-medium shadow-sm">
              <TranslatedText text={finalDiscountLabel}>{finalDiscountLabel}</TranslatedText>
            </div>
          )}
        </div>
      </div>
      
      <Link to={productUrl}>
        <h3 className="text-xs font-sm text-page-heading line-clamp-3 hover:text-page-link h-[50px]">
          <TranslatedText text={product.name} sourceDoc={product} fieldName="name" />
        </h3>
      </Link>
      {categoryName && (
        <div className="text-xs text-yellow-600">
          <TranslatedText>Category</TranslatedText>:{" "}
          {categorySourceDoc && categoryFieldName ? (
            <TranslatedText text={categoryName} sourceDoc={categorySourceDoc} fieldName={categoryFieldName} />
          ) : (
            <TranslatedText text={categoryName}>{categoryName}</TranslatedText>
          )}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-x-2 gap-y-0">
        <div className="text-page-price font-bold text-sm">
          {formatPrice(priceToShow)}
        </div>
        {showOldPrice && (
          <div className="text-page-old-price line-through text-xs font-medium">
            {formatPrice(crossedPrice)}
          </div>
        )}
      </div>

      {/* Rating and Reviews Section */}
      <div className="flex items-center min-h-[24px]">
        <div className="flex items-center">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={16}
              className={`${i < Math.round(rating) ? "text-yellow-400 fill-current" : "text-gray-300"}`}
            />
          ))}
        </div>
        <span className="text-xs text-page-muted ml-1">({numReviews})</span>
      </div>
      
      <button
        onClick={handleAddToCart}
        className="w-full bg-btn-primary hover:bg-btn-primary-hover border border-btn-primary hover:border-transparent text-btn-primary-text text-xs font-medium py-2 px-1 rounded flex items-center justify-center gap-1 transition-all duration-100"
        disabled={stockStatus === "Out of Stock"}
      >
        <ShoppingBag size={12} />
        <TranslatedText>Add to Cart</TranslatedText>
      </button>
    </div>
  )
}

export default ProductCard
