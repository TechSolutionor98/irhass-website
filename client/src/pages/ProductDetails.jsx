"use client"
import { useState, useEffect, useRef, useMemo } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import axios from "axios"
import { useCart } from "../context/CartContext"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../context/ToastContext"
import { useWishlist } from "../context/WishlistContext"
import { useCurrency } from "../context/CurrencyContext"
import LoyaltyEarnBadge from "../components/LoyaltyEarnBadge"
import { getFullImageUrl, getOptimizedImageUrl } from "../utils/imageUtils"
import { swatchBackground } from "../utils/colorSwatch"
import { isSellable } from "../utils/stockGuard"
import { rememberReturnPath } from "../utils/authRedirect"
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import '../styles/phoneInput.css'
import { Helmet } from "react-helmet-async"
import {
  Star,
  Minus,
  Plus,
  ShoppingCart,
  MessageCircle,
  Phone,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  ZoomIn,
  User,
  Heart,
  Truck,
  Award,
  Mail,
  Percent,
  CheckCircle,
  Bell,
  Loader2,
} from "lucide-react"
import { productsAPI } from "../services/api.js"
import { trackProductView } from "../utils/gtmTracking"
import { generateShopURL } from "../utils/urlUtils"
import { isProductVisibleInCountry, getProductEffectiveStock } from "../utils/productCategory"

import config from "../config/config"
import ProductSchema from "../components/ProductSchema"
import ReviewSection from "../components/ReviewSection"
import { useLanguage } from "../context/LanguageContext"
import PromoPopup from "../components/PromoPopup"

import SEO from "../components/SEO"
import TranslatedTipTapRenderer, { preloadTipTapHtmlTranslation } from "../components/TranslatedTipTapRenderer"
import BuyerProtectionSection from "../components/BuyerProtectionSection"
import FeaturedProducts from "../components/FeaturedProducts"
import TranslatedText from "../components/TranslatedText"
import { preloadTranslations } from "../LanguageModel/translationService"

const WHATSAPP_NUMBER = "923214980835" // Replace with your WhatsApp number
const TRANSLATION_SKIP_TAGS = new Set(["CODE", "PRE", "KBD", "SAMP", "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "OPTION"])

const isWorthTranslating = (text) => {
  if (!text || typeof text !== "string") return false
  const normalized = text.trim()
  if (!normalized) return false
  if (/[\u0600-\u06FF]/.test(normalized)) return false
  if (!/[A-Za-z]/.test(normalized)) return false
  if (/(https?:\/\/|www\.|@)/i.test(normalized)) return false
  if (!normalized.includes(" ") && /\d/.test(normalized)) return false
  return true
}

const extractTranslatableTextsFromHtml = (html) => {
  if (!html || typeof html !== "string") return []
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false)
    const texts = []
    let node
    while ((node = walker.nextNode())) {
      const parentTag = node.parentElement?.tagName
      if (parentTag && TRANSLATION_SKIP_TAGS.has(parentTag)) continue
      const text = (node.textContent || "").trim()
      if (isWorthTranslating(text)) {
        texts.push(text)
      }
    }
    return texts
  } catch {
    return []
  }
}

/**
 * A single colour circle.
 *
 * The ring is on the outer element and the fill on an inner circle, so selecting a
 * colour never changes the swatch's footprint and the row cannot shift under the
 * cursor. Pale colours get a faint inset edge -- ivory on white is otherwise just a
 * gap. Renders as a button for in-page colour swaps and as a Link where each colour
 * is its own product.
 */
const ColorSwatch = ({ name, selected = false, soldOut = false, as: Tag = "button", ...rest }) => {
  const extra = Tag === "button" ? { type: "button" } : {}

  return (
    <Tag
      title={name}
      aria-label={name}
      aria-current={selected ? "true" : undefined}
      className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
        selected ? "border-stone-900" : "border-transparent hover:border-stone-300"
      } ${soldOut ? "opacity-45" : ""}`}
      {...extra}
      {...rest}
    >
      <span
        className="h-7 w-7 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)]"
        style={{ background: swatchBackground(name) }}
      />
      {soldOut && <span aria-hidden="true" className="absolute h-px w-8 rotate-45 bg-stone-600" />}
    </Tag>
  )
}

/**
 * One collapsible row in the "Product Details" stack.
 *
 * Kept uncontrolled: each row owns its open state, so opening one never closes
 * another -- shoppers comparing delivery against sizing want both visible.
 */
const PdpAccordion = ({ title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-stone-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-stone-900">
          <TranslatedText>{title}</TranslatedText>
        </span>
        <ChevronDown
          size={18}
          strokeWidth={1.5}
          className={`flex-shrink-0 text-stone-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="pb-5">{children}</div>}
    </div>
  )
}

const ProductDetails = () => {
  const { id, slug } = useParams()
  const navigate = useNavigate()
  const { addToCart, openCart } = useCart()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist()
  const { getLocalizedPath, isArabic } = useLanguage()
  const { formatPrice: formatCurrencyPrice, currentCountry } = useCurrency()
  const [product, setProduct] = useState(null)
  const [relatedProducts, setRelatedProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [quantity, setQuantity] = useState(1)

  const handleCheckoutClick = () => {
    const checkoutPath = getLocalizedPath("/checkout")
    if (!user) {
      rememberReturnPath(checkoutPath)
      navigate(getLocalizedPath("/login"), {
        state: { from: { pathname: checkoutPath } },
      })
      return
    }
    navigate(checkoutPath)
  }
  // Set when a line goes into the bag from this page. The drawer is told to stay shut
  // (see the silent flag in CartContext) and this shows the confirmation instead, so
  // the shopper is not thrown out of the product they are still reading about.
  const [justAdded, setJustAdded] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedColorIndex, setSelectedColorIndex] = useState(null)
  const [selectedDosIndex, setSelectedDosIndex] = useState(null)
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [modalImageIndex, setModalImageIndex] = useState(0)
  const [isImageZoomed, setIsImageZoomed] = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 })
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const thumbnailRowRef = useRef(null)
  const [thumbScroll, setThumbScroll] = useState(0)
  const [showRatingDropdown, setShowRatingDropdown] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const ratingDropdownRef = useRef(null)

  // The confirmation clears itself: it is an acknowledgement, not a step, and leaving
  // it up permanently would just be a second banner competing with the buy buttons.
  useEffect(() => {
    if (!justAdded) return
    const timer = window.setTimeout(() => setJustAdded(false), 6000)
    return () => window.clearTimeout(timer)
  }, [justAdded])

  const [reviewStats, setReviewStats] = useState({
    averageRating: 0,
    totalReviews: 0,
    ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  })

  // New state variables
  const [frequentlyBought, setFrequentlyBought] = useState([])
  const [frequentlyBoughtLoading, setFrequentlyBoughtLoading] = useState(true)
  const [selectedBundleItems, setSelectedBundleItems] = useState({})

  const [showVideoModal, setShowVideoModal] = useState(false)
  
  // Buyer Protection state
  const [selectedProtections, setSelectedProtections] = useState([])
  const [hasProtectionPlans, setHasProtectionPlans] = useState(false)

  // Back-in-Stock Notification state
  const [isSubscribedToStock, setIsSubscribedToStock] = useState(false)
  const [stockSubEmail, setStockSubEmail] = useState("")
  const [stockSubLoading, setStockSubLoading] = useState(false)
  const [showStockSubModal, setShowStockSubModal] = useState(false)

  // Sync user email when logged in
  useEffect(() => {
    if (user?.email) {
      setStockSubEmail(user.email)
    } else {
      const saved = localStorage.getItem("lastStockSubEmail") || ""
      if (saved) setStockSubEmail(saved)
    }
  }, [user?.email])

  // Check if current user is already subscribed to this product's restock alerts (per size if selected)
  useEffect(() => {
    if (!product?._id) return
    const emailToCheck = (stockSubEmail || user?.email || localStorage.getItem("lastStockSubEmail") || "").trim()

    const curSize = getCurrentSize()
    const sizeParam = curSize ? `&size=${encodeURIComponent(curSize.code || curSize.name || "")}` : ""

    const token = localStorage.getItem("token")
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    axios
      .get(`${config.API_URL}/api/back-in-stock/status/${product._id}?email=${encodeURIComponent(emailToCheck)}${sizeParam}`, { headers })
      .then((res) => {
        if (res.data?.subscribed) {
          setIsSubscribedToStock(true)
        } else {
          setIsSubscribedToStock(false)
        }
      })
      .catch(() => {})
  }, [product?._id, user?.email, selectedSizeIndex])

  const handleSubscribeStock = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    // User-entered email in modal takes priority over account login email
    const targetEmail = (stockSubEmail || user?.email || "").trim()

    if (!targetEmail) {
      setShowStockSubModal(true)
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(targetEmail)) {
      showToast("Please enter a valid email address.", "error")
      return
    }

    try {
      setStockSubLoading(true)
      const currentSize = getCurrentSize()
      const sizeLabel = currentSize ? (currentSize.name || currentSize.code || "") : ""

      const token = localStorage.getItem("token")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await axios.post(
        `${config.API_URL}/api/back-in-stock/subscribe`,
        {
          productId: product._id,
          email: targetEmail,
          name: user?.name || "",
          size: sizeLabel,
        },
        { headers },
      )

      localStorage.setItem("lastStockSubEmail", targetEmail)
      setStockSubEmail(targetEmail)
      setIsSubscribedToStock(true)
      setShowStockSubModal(false)
      showToast(
        response.data?.message || `We will email ${targetEmail} as soon as this item is back in stock!`,
        "success",
      )
    } catch (err) {
      console.error("Back in stock subscription error:", err)
      showToast(err.response?.data?.message || "Failed to register alert. Please try again.", "error")
    } finally {
      setStockSubLoading(false)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showImageModal || !product) return

      const productImages =
        product.galleryImages && product.galleryImages.length > 0
          ? [product.image, ...product.galleryImages.filter((img) => img)]
          : [product.image]

      if (e.key === "ArrowLeft") {
        setModalImageIndex((prev) => (prev > 0 ? prev - 1 : productImages.length - 1))
      } else if (e.key === "ArrowRight") {
        setModalImageIndex((prev) => (prev < productImages.length - 1 ? prev + 1 : 0))
      } else if (e.key === "Escape") {
        setShowImageModal(false)
        setIsImageZoomed(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [showImageModal, product])

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || "ontouchstart" in window)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Handle click outside to close dropdown on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isMobile &&
        showRatingDropdown &&
        ratingDropdownRef.current &&
        !ratingDropdownRef.current.contains(event.target)
      ) {
        setShowRatingDropdown(false)
      }
    }

    if (isMobile && showRatingDropdown) {
      document.addEventListener("touchstart", handleClickOutside)
      document.addEventListener("click", handleClickOutside)
    }

    return () => {
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("click", handleClickOutside)
    }
  }, [isMobile, showRatingDropdown])

  const [showCallbackModal, setShowCallbackModal] = useState(false)
  const [callbackForm, setCallbackForm] = useState({ 
    name: user?.name || "", 
    email: user?.email || "", 
    phone: "",
    customerNote: ""
  })
  const [callbackLoading, setCallbackLoading] = useState(false)
  const [callbackSuccess, setCallbackSuccess] = useState(false)
  const [emailChanged, setEmailChanged] = useState(false)
  const [verificationCode, setVerificationCode] = useState("")
  const [verificationSent, setVerificationSent] = useState(false)
  const [verificationVerified, setVerificationVerified] = useState(false)
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [phoneValue, setPhoneValue] = useState("")

  const [relatedLoading, setRelatedLoading] = useState(true)
  const [showCouponsModal, setShowCouponsModal] = useState(false)
  const [publicCoupons, setPublicCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [couponError, setCouponError] = useState(null)
  const [couponCopied, setCouponCopied] = useState(null)

  const formatPriceValue = (price) => {
    const num = Number(price)
    const safeNumber = Number.isFinite(num) ? num : 0
    return formatCurrencyPrice(safeNumber, isArabic)
  }

  const formatPrice = (price) => {
    return (
      <span lang="en" dir="ltr">
        {formatPriceValue(price)}
      </span>
    )
  }

  const calculateDiscountedPrice = (price, discountPercent = 25) => {
    const numericPrice = typeof price === "number" ? price : Number(price) || 0
    return numericPrice * (1 - discountPercent / 100)
  }

  const formatDiscountedPrice = (price, discountPercent = 25) => {
    const discountedPrice = calculateDiscountedPrice(price, discountPercent)
    return formatPrice(discountedPrice)
  }

  // Get current color variation
  const getCurrentColor = () => {
    if (selectedColorIndex !== null && product?.colorVariations && product.colorVariations.length > 0) {
      return product.colorVariations[selectedColorIndex]
    }
    return null
  }

  // Get current DOS/Windows variation
  const getCurrentDos = () => {
    if (selectedDosIndex !== null && product?.dosVariations && product.dosVariations.length > 0) {
      return product.dosVariations[selectedDosIndex]
    }
    return null
  }

  // Get current Size variation
  const getCurrentSize = () => {
    if (selectedSizeIndex !== null && product?.sizes && product.sizes[selectedSizeIndex]) {
      return product.sizes[selectedSizeIndex] || null
    }
    return null
  }

  // Determine effective stock status considering sizes and other variations
  const getEffectiveStockStatus = () => {
    const currentSize = getCurrentSize()
    if (currentSize && currentSize.countInStock !== undefined) {
      return Number(currentSize.countInStock) > 0 ? "In Stock" : "Out of Stock"
    }
    if (product?.sizes && product.sizes.length > 0) {
      const anyInStock = product.sizes.some((s) => s.countInStock === undefined || Number(s.countInStock) > 0)
      return anyInStock ? "In Stock" : "Out of Stock"
    }
    return product?.stockStatus || "In Stock"
  }

  const isEffectiveOutOfStock = () => {
    const currentColor = getCurrentColor()
    const currentDos = getCurrentDos()
    const currentSize = getCurrentSize()

    if (currentDos && currentDos.countInStock <= 0) return true
    if (currentColor && currentColor.countInStock <= 0) return true
    if (currentSize && currentSize.countInStock !== undefined && Number(currentSize.countInStock) <= 0) return true
    if (product?.sizes && product.sizes.length > 0 && selectedSizeIndex === null) {
      const anyInStock = product.sizes.some((s) => s.countInStock === undefined || Number(s.countInStock) > 0)
      if (!anyInStock) return true
    }
    if (
      !currentColor &&
      !currentDos &&
      !currentSize &&
      (product?.stockStatus === "Out of Stock" || (product?.countInStock !== undefined && Number(product?.countInStock) <= 0))
    )
      return true
    return false
  }

  const getMaxQuantity = () => {
    const currentSize = getCurrentSize()
    const maxPurchase = product?.maxPurchaseQty || 10
    if (currentSize && currentSize.countInStock !== undefined) {
      const stock = Number(currentSize.countInStock) || 0
      return Math.max(0, Math.min(maxPurchase, stock))
    }
    return maxPurchase
  }

  const handleSelectSize = (index) => {
    setSelectedSizeIndex(index)
    const sizeObj = product?.sizes?.[index]
    if (sizeObj && sizeObj.countInStock !== undefined) {
      const sStock = Number(sizeObj.countInStock) || 0
      if (sStock > 0 && quantity > sStock) {
        setQuantity(sStock)
        showToast(`Quantity adjusted to ${sStock} (available stock for size ${sizeObj.code || sizeObj.name}).`, "info")
      }
    }
  }

  // Helper function to check if a URL is a YouTube URL
  const isYouTubeUrl = (url) => {
    if (!url) return false
    return url.includes('youtube.com') || url.includes('youtu.be')
  }

  // Helper function to get YouTube embed URL
  const getYouTubeEmbedUrl = (url) => {
    if (!url) return ''
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    if (url.includes('youtube.com/watch')) {
      const videoId = url.split('v=')[1]?.split('&')[0]
      return `https://www.youtube.com/embed/${videoId}`
    }
    return url
  }

  // Get current images based on selected color or DOS variation (includes videos)
  const getCurrentImages = () => {
    const currentColor = getCurrentColor()
    const currentDos = getCurrentDos()
    const media = []
    
    // Check DOS variation first (if selected)
    if (currentDos && currentDos.image) {
      media.push({ type: 'image', url: currentDos.image })
      if (currentDos.galleryImages && currentDos.galleryImages.length > 0) {
        currentDos.galleryImages.filter(img => img).forEach(img => {
          media.push({ type: 'image', url: img })
        })
      }
      return media
    }
    
    // Check color variation
    if (currentColor && currentColor.image) {
      media.push({ type: 'image', url: currentColor.image })
      if (currentColor.galleryImages && currentColor.galleryImages.length > 0) {
        currentColor.galleryImages.filter(img => img).forEach(img => {
          media.push({ type: 'image', url: img })
        })
      }
      return media
    }
    
    // Fallback to product images and videos
    if (product?.image) {
      media.push({ type: 'image', url: product.image })
    }
    
    if (product?.galleryImages && product.galleryImages.length > 0) {
      product.galleryImages.filter(img => img).forEach(img => {
        media.push({ type: 'image', url: img })
      })
    }
    
    // Add main product video if exists
    if (product?.video) {
      media.push({ type: 'video', url: product.video })
    }
    
    // Add video gallery if exists
    if (product?.videoGallery && product.videoGallery.length > 0) {
      product.videoGallery.filter(vid => vid).forEach(vid => {
        media.push({ type: 'video', url: vid })
      })
    }
    
    return media
  }

  const getEffectivePrice = () => {
    const currentColor = getCurrentColor()
    const currentDos = getCurrentDos()
    const currentSize = getCurrentSize()
    
    // Get base price (from color if selected, otherwise from product)
    let basePrice = 0
    if (currentColor) {
      const colorBasePrice = Number(currentColor.price) || 0
      const colorOfferPrice = Number(currentColor.offerPrice) || 0
      basePrice = (colorOfferPrice > 0 && colorOfferPrice < colorBasePrice) ? colorOfferPrice : colorBasePrice
    } else {
      const productBasePrice = Number(product?.price) || 0
      const productOfferPrice = Number(product?.offerPrice) || 0
      basePrice = (productOfferPrice > 0 && productOfferPrice < productBasePrice) ? productOfferPrice : productBasePrice
    }
    
    // Add DOS price if selected (additive)
    if (currentDos) {
      const dosBasePrice = Number(currentDos.price) || 0
      const dosOfferPrice = Number(currentDos.offerPrice) || 0
      const dosPrice = (dosOfferPrice > 0 && dosOfferPrice < dosBasePrice) ? dosOfferPrice : dosBasePrice
      basePrice += dosPrice
    }

    // Add selected size additional price if selected (additive)
    if (currentSize && Number(currentSize.additionalPrice) > 0) {
      basePrice += Number(currentSize.additionalPrice) || 0
    }
    
    return basePrice
  }

  const toMerchantPriceContent = (price) => {
    const numericPrice = Number(price)
    return Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice.toFixed(2) : ""
  }

  const getMerchantAvailabilityUrl = () => {
    if (product?.stockStatus === "PreOrder") return "https://schema.org/PreOrder"
    if (product?.stockStatus === "Out of Stock") return "https://schema.org/OutOfStock"
    return "https://schema.org/InStock"
  }


  const getRatingDistribution = () => {
    return reviewStats.ratingDistribution
  }

  // Handle rating interaction (hover for desktop, click for mobile)
  const handleRatingInteraction = () => {
    if (isMobile) {
      setShowRatingDropdown(!showRatingDropdown)
    }
  }

  const fetchReviewStats = async () => {
    if (!product?._id) return

    try {
      const response = await axios.get(`${config.API_URL}/api/reviews/product/${product._id}?page=1&limit=1`)
      if (response.data.stats) {
        setReviewStats({
          averageRating: response.data.stats.averageRating || 0,
          totalReviews: response.data.stats.totalReviews || 0,
          ratingDistribution: response.data.stats.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        })
      }
    } catch (error) {
      console.error("Error fetching review stats:", error)
    }
  }

  const scrollToReviewSection = () => {
    setTimeout(() => {
      const reviewSection = document.querySelector("[data-review-section]")
      if (reviewSection) {
        reviewSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest",
        })
      }
    }, 100)
    // Close the dropdown after clicking
    setShowRatingDropdown(false)
  }

  const handleStarRatingClick = (rating) => {
    scrollToReviewSection()
    // You could also filter reviews by rating here if needed
  }

  useEffect(() => {
    if (!slug) return
    let normalizedSlug = slug
    try {
      normalizedSlug = decodeURIComponent(slug)
    } catch (decodeError) {
      console.warn("Slug already decoded or invalid encoding", slug, decodeError.message)
    }
    console.log("ProductDetails param slug:", slug, "using:", normalizedSlug)
    fetchProduct(normalizedSlug)
  }, [slug])

  useEffect(() => {
    if (product) {
      fetchRelatedProducts()
      fetchReviewStats()
      fetchFrequentlyBought() // Add this line
    }
  }, [product])

  const preloadProductTexts = async (productData, targetLang = "ar", options = {}) => {
    const { primeHtmlCache = false } = options
    if (!productData || targetLang !== "ar") return

    const texts = []
    const pushText = (value) => {
      if (isWorthTranslating(value)) {
        texts.push(value.trim())
      }
    }

    pushText(productData.name)
    pushText(productData.brand?.name || productData.brand)
    pushText(productData.category?.name || productData.category)
    pushText(productData.warranty)

    if (Array.isArray(productData.specifications)) {
      productData.specifications.forEach((spec) => {
        pushText(spec?.key)
        pushText(spec?.value)
      })
    }

    extractTranslatableTextsFromHtml(productData.shortDescription).forEach(pushText)
    extractTranslatableTextsFromHtml(productData.description).forEach(pushText)

    const uniqueTexts = Array.from(new Set(texts))

    try {
      if (uniqueTexts.length > 0) {
        await preloadTranslations(uniqueTexts, targetLang)
      }

      // Prime full HTML cache for TipTap-rendered blocks (short + long description).
      // This avoids waiting for HTML parsing + translation after language switch.
      if (primeHtmlCache) {
        await Promise.allSettled([
          preloadTipTapHtmlTranslation(productData.shortDescription, targetLang),
          preloadTipTapHtmlTranslation(productData.description, targetLang),
        ])
      }
    } catch (error) {
      console.error("Preload product translations error:", error)
    }
  }

  const fetchProduct = async (rawSlug) => {
    try {
      const attemptSlug = (rawSlug || slug || '').trim()
      console.log("Fetching product for slug:", attemptSlug)
      let data
      try {
        data = await productsAPI.getBySlug(attemptSlug)
      } catch (e) {
        // If slug contains unsafe chars or lookup failed, try a sanitized variant
        console.warn("Primary slug fetch failed, trying fallback sanitization", e.message)
        const fallback = attemptSlug
          .toLowerCase()
          .replace(/[^a-z0-9\-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
        if (fallback && fallback !== attemptSlug) {
          try {
            data = await productsAPI.getBySlug(fallback)
          } catch (e2) {
            console.warn("Fallback slug also failed", e2.message)
          }
        }
      }
      // If still no data and looks like an ObjectId, attempt by ID
      if (!data && attemptSlug.match(/^[0-9a-fA-F]{24}$/)) {
        try {
          data = await productsAPI.getById(attemptSlug)
        } catch (e3) {
          console.warn("ID fetch attempt failed", e3.message)
        }
      }
      if (!data) throw new Error("Product not found via slug or ID attempts")
      console.log("API response for product:", data)

      // Warm translation cache before first Arabic render to reduce visible delay.
      if (isArabic) {
        await Promise.race([
          preloadProductTexts(data, "ar", { primeHtmlCache: true }),
          new Promise((resolve) => setTimeout(resolve, 1800)),
        ])
      }

      setProduct(data)
      if (data?.sizes && data.sizes.length > 0) {
        const firstInStockIdx = data.sizes.findIndex((s) => s.countInStock === undefined || Number(s.countInStock) > 0)
        setSelectedSizeIndex(firstInStockIdx !== -1 ? firstInStockIdx : 0)
      } else {
        setSelectedSizeIndex(null)
      }
      setError(null)

      // Add GTM tracking here - after product is successfully loaded
      if (data && data._id) {
        try {
          trackProductView(data)
        } catch (trackingError) {
          console.error("GTM tracking error:", trackingError)
        }
      }
    } catch (error) {
      console.error("Error fetching product after fallbacks:", error)
      setError("Failed to load product details. Please check the URL or try again later.")
    } finally {
      setLoading(false)
    }
  }

  // While viewing English product page, pre-warm Arabic description translations in idle time.
  // This makes EN -> AR switch feel instant for short/long description without blocking initial render.
  useEffect(() => {
    if (!product || isArabic) return

    let cancelled = false
    let idleId = null
    let timeoutId = null

    const runPrewarm = async () => {
      if (cancelled) return
      await preloadProductTexts(product, "ar", { primeHtmlCache: true })
    }

    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(() => {
        runPrewarm()
      }, { timeout: 1200 })
    } else {
      timeoutId = window.setTimeout(() => {
        runPrewarm()
      }, 700)
    }

    return () => {
      cancelled = true
      if (idleId !== null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [product, isArabic])

  const fetchRelatedProducts = async () => {
    setRelatedLoading(true)
    try {
      // Try to get related products from the same category
      const { data } = await axios.get(`${config.API_URL}/api/products?category=${product.category._id}&limit=12`)
      let filtered = data.filter((p) => p._id !== product._id)
      if (filtered.length === 0) { 
        // If no related products, fetch all products and pick random ones (excluding current)
        const allRes = await axios.get(`${config.API_URL}/api/products`)
        filtered = allRes.data.filter((p) => p._id !== product._id)
      }

      if (isArabic && filtered.length > 0) {
        const relatedTexts = Array.from(
          new Set(
            filtered
              .flatMap((item) => [item?.name, item?.brand?.name, item?.category?.name])
              .filter((value) => isWorthTranslating(value))
              .map((value) => value.trim())
          )
        )
        if (relatedTexts.length > 0) {
          await preloadTranslations(relatedTexts, "ar")
        }
      }

      setRelatedProducts(filtered)
    } catch (error) {
      console.error("Error fetching related products:", error)
    } finally {
      setRelatedLoading(false)
    }
  }

  // Function to handle bundle item selection
  const handleBundleItemToggle = (itemId) => {
    // Belt as well as braces: the checkbox is already disabled for an out-of-stock
    // item, but the handler is reachable from a label click and from any future
    // caller, and this is the path that put unsellable lines into an order.
    const candidate = frequentlyBought.find((item) => item._id === itemId)
    if (candidate && !isSellable(candidate)) return

    console.log("Toggling bundle item:", itemId)
    setSelectedBundleItems((prev) => {
      const newState = {
        ...prev,
        [itemId]: !prev[itemId],
      }
      console.log("Updated selectedBundleItems:", newState)
      return newState
    })
  }

  // Function to calculate total bundle price
  const calculateBundleTotal = () => {
    let total = 0

    // Add current product if selected (no discount on main product)
    if (selectedBundleItems[product._id]) {
      total += product.offerPrice && product.offerPrice > 0 ? product.offerPrice : product.price
    }

    // Add selected bundle items with 25% discount.
    // Filtered on stock as well as the tick: an item can sell out between the page
    // loading and the button being pressed, and a stale tick must not become a line.
    frequentlyBought.forEach((item) => {
      if (selectedBundleItems[item._id] && isSellable(item)) {
        const originalPrice = item.offerPrice && item.offerPrice > 0 ? item.offerPrice : item.price
        const discountedPrice = calculateDiscountedPrice(originalPrice, 25)
        total += discountedPrice
      }
    })

    return total
  }

  // New function to calculate savings
  const calculateBundleSavings = () => {
    let originalTotal = 0
    let discountedTotal = 0

    // Add current product if selected
    if (selectedBundleItems[product._id]) {
      const productPrice = product.offerPrice && product.offerPrice > 0 ? product.offerPrice : product.price
      originalTotal += productPrice
      discountedTotal += productPrice
    }

    // Add selected bundle items
    frequentlyBought.forEach((item) => {
      if (selectedBundleItems[item._id]) {
        const originalPrice = item.offerPrice && item.offerPrice > 0 ? item.offerPrice : item.price
        const discountedPrice = calculateDiscountedPrice(originalPrice, 25)
        originalTotal += originalPrice
        discountedTotal += discountedPrice
      }
    })

    return {
      originalTotal,
      discountedTotal,
      savings: originalTotal - discountedTotal,
    }
  }

  // Replace your existing FrequentlyBoughtTogether component (around line 658)
  const FrequentlyBoughtTogether = () => {
    if (frequentlyBoughtLoading) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-300 rounded mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gray-300 rounded"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (!frequentlyBought || frequentlyBought.length === 0) {
      return null
    }

    const selectedCount = Object.values(selectedBundleItems).filter(Boolean).length
    const bundleTotals = calculateBundleSavings()

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900"><TranslatedText>Frequently Bought Together</TranslatedText></h3>
          <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">25% <TranslatedText>OFF BUNDLE</TranslatedText></div>
        </div>

        <div className="space-y-4">
          {/* Current Product - Always Selected */}
          <div className="flex items-center space-x-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <input
              type="checkbox"
              checked={true}
              disabled={true}
              className="w-5 h-5 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500 focus:ring-2"
            />
            <img
              src={getOptimizedImageUrl(product.image, { width: 140, height: 140, quality: 70 }) || "/placeholder.svg"}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-16 h-16 object-cover rounded-md"
            />
            <div className="flex-1">
              <h4 className="font-medium text-gray-900"><TranslatedText text={product.name} sourceDoc={product} fieldName="name">{product.name}</TranslatedText></h4>
              <p className="text-yellow-600 font-semibold">
                {formatPrice(product.offerPrice && product.offerPrice > 0 ? product.offerPrice : product.price)}
              </p>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full"><TranslatedText>Current Item</TranslatedText></span>
            </div>
          </div>

          {/* Bundle Items with 25% Discount */}
          {frequentlyBought.map((item) => {
            const originalPrice = item.offerPrice && item.offerPrice > 0 ? item.offerPrice : item.price
            const discountedPrice = calculateDiscountedPrice(originalPrice, 25)
            const savings = originalPrice - discountedPrice
            // Shown and marked rather than hidden: a suggestion that silently
            // disappears looks like the page is broken, and the shopper may well
            // want to know the piece exists and come back for it.
            const sellable = isSellable(item)

            return (
              <div
                key={item._id}
                className={`flex items-center space-x-4 p-4 border rounded-lg ${
                  sellable ? "border-gray-200 hover:bg-gray-50" : "border-gray-200 bg-gray-50 opacity-70"
                }`}
              >
                <input
                  type="checkbox"
                  checked={sellable ? selectedBundleItems[item._id] || false : false}
                  disabled={!sellable}
                  onChange={() => handleBundleItemToggle(item._id)}
                  title={sellable ? undefined : "Out of stock"}
                  className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
                />
                <img
                  src={getOptimizedImageUrl(item.image, { width: 140, height: 140, quality: 70 }) || "/placeholder.svg"}
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                  className={`w-16 h-16 object-cover rounded-md ${sellable ? "" : "grayscale"}`}
                />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    <TranslatedText text={item.name} sourceDoc={item} fieldName="name">{item.name}</TranslatedText>
                    {!sellable && (
                      <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-600">
                        <TranslatedText>Out of stock</TranslatedText>
                      </span>
                    )}
                  </h4>
                  <div className="flex items-center gap-2">
                    <p className="text-green-600 font-semibold">{formatDiscountedPrice(originalPrice, 25)}</p>
                    <p className="text-sm text-gray-500 line-through">{formatPrice(originalPrice)}</p>
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium"><TranslatedText>Save</TranslatedText> 25%</span>
                  </div>
                  <p className="text-sm text-green-600 font-medium"><TranslatedText>You save</TranslatedText> {formatPrice(savings)}</p>

                  {/* Show original offer details if any */}
                  {item.offerPrice && item.offerPrice > 0 && item.offerPrice < item.price && (
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="line-through">{formatPrice(item.price)}</span>
                      <span className="ml-2 text-blue-600"><TranslatedText>Already discounted</TranslatedText></span>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Total and Add to Cart */}
        <div className="border-t pt-4 mt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-lg mb-2">
                <span className="text-gray-700"><TranslatedText>Bundle price</TranslatedText>: </span>
                <span className="font-bold text-xl text-green-600">{formatPrice(bundleTotals.discountedTotal)}</span>
                {bundleTotals.savings > 0 && (
                  <span className="text-sm text-gray-500 line-through ml-2">
                    {formatPrice(bundleTotals.originalTotal)}
                  </span>
                )}
              </div>
              {bundleTotals.savings > 0 && (
                <div className="text-sm text-red-600 font-medium">
                  <TranslatedText>You save</TranslatedText> {formatPrice(bundleTotals.savings)} <TranslatedText>with bundle discount!</TranslatedText>
                </div>
              )}
              <div className="text-sm text-gray-600 mt-1">
                <TranslatedText>For</TranslatedText> {selectedCount} <TranslatedText>{selectedCount !== 1 ? "items" : "item"}</TranslatedText>
              </div>
            </div>

            <button
              data-add-bundle-btn
              onClick={handleAddBundleToCart}
              disabled={selectedCount === 0}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <ShoppingCart size={20} />
              <TranslatedText>Add all</TranslatedText> {selectedCount} <TranslatedText>to Cart</TranslatedText>
              {bundleTotals.savings > 0 && (
                <span className="text-xs bg-white text-red-600 px-2 py-1 rounded-full">
                  <TranslatedText>Save</TranslatedText> {formatPrice(bundleTotals.savings)}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Returns true only when the line actually went in, so Buy Now does not send a
  // shopper to the cart after an out-of-stock add left it empty.
  const handleAddToCart = () => {
    // Check stock status based on selected color, DOS variation, or main product
    const currentColor = getCurrentColor()
    const currentDos = getCurrentDos()
    const currentSize = getCurrentSize()
    
    if (currentDos && currentDos.countInStock <= 0) {
      showToast("Selected OS option is out of stock", "error")
      return false
    }
    if (currentColor && currentColor.countInStock <= 0) {
      showToast("Selected color is out of stock", "error")
      return false
    }
    if (currentSize && currentSize.countInStock !== undefined && Number(currentSize.countInStock) <= 0) {
      showToast(`Selected size (${currentSize.code || currentSize.name}) is out of stock`, "error")
      return false
    }
    if (currentSize && currentSize.countInStock !== undefined && quantity > Number(currentSize.countInStock)) {
      showToast(`Only ${currentSize.countInStock} items available in size ${currentSize.code || currentSize.name}`, "error")
      return false
    }
    if (!currentColor && !currentDos && !currentSize && product.stockStatus === "Out of Stock") {
      showToast("Product is out of stock", "error")
      return false
    }

    if (product.sizes && product.sizes.length > 0 && selectedSizeIndex === null) {
      showToast("Please select a size", "error")
      return false
    }
    
    // Calculate the final price based on variations:
    // If color is selected: use color price as base
    // If DOS is selected: add DOS price to base price (additive)
    let finalPrice = 0
    let baseImageUrl = product.image
    
    // Get base price from color or product
    if (currentColor) {
      const colorPrice = currentColor.offerPrice > 0 ? currentColor.offerPrice : currentColor.price
      finalPrice = Number(colorPrice) || 0
      baseImageUrl = currentColor.image || product.image
    } else {
      finalPrice = product.offerPrice > 0 ? Number(product.offerPrice) : Number(product.price) || 0
    }
    
    // Add DOS price if selected (additive)
    if (currentDos) {
      const dosPrice = currentDos.offerPrice > 0 ? currentDos.offerPrice : currentDos.price
      finalPrice += Number(dosPrice) || 0
    }

    // Add Size additional price if selected (additive)
    if (currentSize && Number(currentSize.additionalPrice) > 0) {
      finalPrice += Number(currentSize.additionalPrice) || 0
    }
    
    // Prepare product with variation data
    const productToAdd = {
      ...product,
      selectedColorIndex,
      selectedColorData: currentColor ? {
        color: currentColor.color,
        image: currentColor.image,
        price: currentColor.price,
        offerPrice: currentColor.offerPrice,
        sku: currentColor.sku,
      } : null,
      selectedDosIndex,
      selectedDosData: currentDos ? {
        dosType: currentDos.dosType,
        image: currentDos.image,
        price: currentDos.price,
        offerPrice: currentDos.offerPrice,
        sku: currentDos.sku,
      } : null,
      selectedSizeIndex,
      selectedSizeData: currentSize ? {
        sizeId: currentSize.size?._id || currentSize.size || currentSize._id,
        name: currentSize.name,
        code: currentSize.code,
        additionalPrice: Number(currentSize.additionalPrice) || 0,
        countInStock: currentSize.countInStock !== undefined ? Number(currentSize.countInStock) : undefined,
      } : null,
      // Final calculated price (color/product base + DOS + Size if selected)
      // Clear offerPrice so CartContext uses 'price' as the effective price
      price: finalPrice,
      offerPrice: 0, // Reset so computeUnit uses price field
      // Override image with color-specific image if available
      image: baseImageUrl,
    }
    
    // Add main product to cart
    const qtyToUse = (quantity === "" || isNaN(quantity) || quantity < 1) ? 1 : quantity
    // Silent: the page shows its own confirmation panel, so the drawer does not fly
    // over the product the shopper is still looking at.
    addToCart(productToAdd, qtyToUse, null, { silent: true })
    
    // Add selected protections to cart as separate items linked to the product
    if (selectedProtections.length > 0) {
      selectedProtections.forEach((protection) => {
        const protectionItem = {
          _id: `protection_${protection._id}_${product._id}_${Date.now()}`,
          name: `${protection.name} for ${product.name}`,
          price: protection.calculatedPrice || protection.price,
          image: product.image, // Use product image as reference
          isProtection: true,
          protectionFor: product._id,
          protectionData: protection,
          countInStock: 999, // Protection plans don't have stock limits
          quantity: 1, // Always 1 per product
        }
        addToCart(protectionItem, 1, null, { silent: true })
      })
    }

    setJustAdded(true)
    return true
  }

  const handleBuyNow = () => {
    if (handleAddToCart()) navigate(getLocalizedPath("/cart"))
  }

  const handleQuantityChange = (delta) => {
    setQuantity((prev) => {
      const current = (prev === "" || isNaN(prev)) ? 1 : prev
      const newQuantity = current + delta
      const maxQty = getMaxQuantity()
      if (maxQty === 0) return 1
      if (newQuantity < 1) return 1
      if (newQuantity > maxQty) return maxQty
      return newQuantity
    })
  }

  const handleQuantityInput = (e) => {
    const valStr = e.target.value
    if (valStr === "") {
      setQuantity("")
      return
    }
    const num = parseInt(valStr, 10)
    if (isNaN(num)) return

    const maxQty = getMaxQuantity()
    if (num < 1) {
      setQuantity(1)
    } else if (maxQty > 0 && num > maxQty) {
      setQuantity(maxQty)
    } else {
      setQuantity(num)
    }
  }

  const handleQuantityBlur = () => {
    if (quantity === "" || quantity < 1) {
      setQuantity(1)
    }
  }

  const handleQuantityKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur()
    }
  }

  const handleImageClick = (index) => {
    setModalImageIndex(index)
    setShowImageModal(true)
  }

  // const fetchFrequentlyBought = async () => {
  //   setFrequentlyBoughtLoading(true)
  //   try {
  //     const complementaryProducts = []

  //     // Get product category and name to determine what accessories to show
  //     const productName = product.name?.toLowerCase() || ""
  //     const categoryName = product.category?.name?.toLowerCase() || ""
  //     const brandName = product.brand?.name?.toLowerCase() || ""

  //     console.log("Product details:", { productName, categoryName, brandName })

  //     // Define complementary product logic based on main product type
  //     if (categoryName.includes("laptop") || productName.includes("laptop")) {
  //       // For laptops, get exactly 2 diverse accessories - one from each category
  //       const accessoryCategories = [
  //         {
  //           name: "mouse",
  //           searches: ["wireless mouse", "bluetooth mouse", "gaming mouse"],
  //           keywords: ["mouse"],
  //         },
  //         {
  //           name: "headphones",
  //           searches: ["bluetooth headphones", "wireless headset", "gaming headset", "earbuds"],
  //           keywords: ["headphone", "headset", "earbuds", "earphone"],
  //         },
  //         {
  //           name: "keyboard",
  //           searches: ["wireless keyboard", "bluetooth keyboard", "mechanical keyboard"],
  //           keywords: ["keyboard"],
  //         },
  //         {
  //           name: "accessories",
  //           searches: ["laptop bag", "laptop stand", "cooling pad", "webcam", "usb hub", "portable speaker"],
  //           keywords: ["bag", "stand", "cooling", "webcam", "hub", "speaker", "charger"],
  //         },
  //       ]

  //       // Get one product from each category to ensure diversity - LIMIT TO 2
  //       for (const category of accessoryCategories) {
  //         let foundInCategory = false

  //         for (const searchTerm of category.searches) {
  //           if (foundInCategory) break

  //           try {
  //             const response = await axios.get(
  //               `${config.API_URL}/api/products?search=${encodeURIComponent(searchTerm)}&limit=10`,
  //             )
  //             const accessories = response.data.filter(
  //               (p) =>
  //                 p._id !== product._id &&
  //                 // Exclude main product categories
  //                 !p.name?.toLowerCase().includes("laptop") &&
  //                 !p.name?.toLowerCase().includes("desktop") &&
  //                 !p.name?.toLowerCase().includes("computer") &&
  //                 !p.name?.toLowerCase().includes("pc") &&
  //                 !p.name?.toLowerCase().includes("monitor") &&
  //                 !p.name?.toLowerCase().includes("aio") &&
  //                 // Include only relevant accessories
  //                 category.keywords.some(
  //                   (keyword) =>
  //                     p.name?.toLowerCase().includes(keyword) || p.category?.name?.toLowerCase().includes(keyword),
  //                 ),
  //             )

  //             if (accessories.length > 0) {
  //               // Add first matching product from this category
  //               complementaryProducts.push(accessories[0])
  //               foundInCategory = true
  //               console.log(`Found ${category.name}:`, accessories[0].name)
  //             }
  //           } catch (error) {
  //             console.log(`Search failed for: ${searchTerm}`)
  //           }
  //         }

  //         // Stop when we have exactly 2 diverse products
  //         if (complementaryProducts.length >= 2) break
  //       }
  //     } else if (categoryName.includes("desktop") || productName.includes("desktop")) {
  //       // For desktops, get exactly 2 accessories
  //       const desktopCategories = [
  //         {
  //           name: "monitor",
  //           searches: ["monitor", "display"],
  //           keywords: ["monitor", "display"],
  //         },
  //         {
  //           name: "keyboard",
  //           searches: ["wireless keyboard", "mechanical keyboard"],
  //           keywords: ["keyboard"],
  //         },
  //         {
  //           name: "mouse",
  //           searches: ["wireless mouse", "gaming mouse"],
  //           keywords: ["mouse"],
  //         },
  //       ]

  //       for (const category of desktopCategories) {
  //         let foundInCategory = false

  //         for (const searchTerm of category.searches) {
  //           if (foundInCategory) break

  //           try {
  //             const response = await axios.get(
  //               `${config.API_URL}/api/products?search=${encodeURIComponent(searchTerm)}&limit=10`,
  //             )
  //             const accessories = response.data.filter(
  //               (p) =>
  //                 p._id !== product._id &&
  //                 !p.name?.toLowerCase().includes("desktop") &&
  //                 !p.name?.toLowerCase().includes("laptop") &&
  //                 category.keywords.some((keyword) => p.name?.toLowerCase().includes(keyword)),
  //             )

  //             if (accessories.length > 0) {
  //               complementaryProducts.push(accessories[0])
  //               foundInCategory = true
  //             }
  //           } catch (error) {
  //             console.log(`Search failed for: ${searchTerm}`)
  //           }
  //         }

  //         // Stop when we have exactly 2 products
  //         if (complementaryProducts.length >= 2) break
  //       }
  //     } else if (categoryName.includes("mobile") || categoryName.includes("phone") || productName.includes("phone")) {
  //       // For phones, get exactly 2 phone accessories
  //       const phoneCategories = [
  //         {
  //           name: "case",
  //           searches: ["phone case", "mobile case"],
  //           keywords: ["case", "cover"],
  //         },
  //         {
  //           name: "charger",
  //           searches: ["wireless charger", "phone charger", "power bank"],
  //           keywords: ["charger", "power bank", "charging"],
  //         },
  //         {
  //           name: "audio",
  //           searches: ["wireless earbuds", "bluetooth headphones"],
  //           keywords: ["earbuds", "headphone", "earphone"],
  //         },
  //       ]

  //       for (const category of phoneCategories) {
  //         let foundInCategory = false

  //         for (const searchTerm of category.searches) {
  //           if (foundInCategory) break

  //           try {
  //             const response = await axios.get(
  //               `${config.API_URL}/api/products?search=${encodeURIComponent(searchTerm)}&limit=10`,
  //             )
  //             const accessories = response.data.filter(
  //               (p) =>
  //                 p._id !== product._id &&
  //                 !p.name?.toLowerCase().includes("phone") &&
  //                 !p.name?.toLowerCase().includes("mobile") &&
  //                 category.keywords.some((keyword) => p.name?.toLowerCase().includes(keyword)),
  //             )

  //             if (accessories.length > 0) {
  //               complementaryProducts.push(accessories[0])
  //               foundInCategory = true
  //             }
  //           } catch (error) {
  //             console.log(`Search failed for: ${searchTerm}`)
  //           }
  //         }

  //         // Stop when we have exactly 2 products
  //         if (complementaryProducts.length >= 2) break
  //       }
  //     }

  //     // Remove duplicates and ensure exactly 2 items
  //     const uniqueProducts = complementaryProducts
  //       .filter((product, index, self) => index === self.findIndex((p) => p._id === product._id))
  //       .slice(0, 2) // LIMIT TO EXACTLY 2 ACCESSORIES

  //     console.log("Found complementary products:", uniqueProducts.length)
  //     console.log(
  //       "Products:",
  //       uniqueProducts.map((p) => ({
  //         name: p.name,
  //         category: p.category?.name,
  //         type: p.name?.toLowerCase().includes("mouse")
  //           ? "mouse"
  //           : p.name?.toLowerCase().includes("keyboard")
  //             ? "keyboard"
  //             : p.name?.toLowerCase().includes("headphone") || p.name?.toLowerCase().includes("headset")
  //               ? "audio"
  //               : "other",
  //       })),
  //     )

  //     // If we don't have exactly 2, try fallback
  //     if (uniqueProducts.length < 2) {
  //       console.log(`Only found ${uniqueProducts.length} accessories, trying fallback...`)

  //       try {
  //         const fallbackResponse = await axios.get(`${config.API_URL}/api/products?limit=50`)
  //         const fallbackAccessories = fallbackResponse.data.filter(
  //           (p) =>
  //             p._id !== product._id &&
  //             (p.category?.name?.toLowerCase().includes("accessories") ||
  //               p.name?.toLowerCase().includes("mouse") ||
  //               p.name?.toLowerCase().includes("keyboard") ||
  //               p.name?.toLowerCase().includes("headphone") ||
  //               p.name?.toLowerCase().includes("speaker")) &&
  //             // Exclude main product categories
  //             !p.name?.toLowerCase().includes("laptop") &&
  //             !p.name?.toLowerCase().includes("desktop") &&
  //             !p.name?.toLowerCase().includes("computer") &&
  //             !p.name?.toLowerCase().includes("phone") &&
  //             !p.name?.toLowerCase().includes("tablet") &&
  //             !p.name?.toLowerCase().includes("monitor") &&
  //             !uniqueProducts.some((existing) => existing._id === p._id), // Don't duplicate
  //         )

  //         // Add fallback products to reach exactly 2 total
  //         const needed = 2 - uniqueProducts.length
  //         uniqueProducts.push(...fallbackAccessories.slice(0, needed))

  //         console.log(
  //           "Added fallback accessories:",
  //           fallbackAccessories.slice(0, needed).map((p) => p.name),
  //         )
  //       } catch (error) {
  //         console.error("Fallback accessories search failed:", error)
  //       }
  //     }

  //     // Final check - ensure we have exactly 2 or hide the section
  //     if (uniqueProducts.length === 0) {
  //       console.log("No accessories found at all, hiding section")
  //       setFrequentlyBought([])
  //       setSelectedBundleItems({})
  //       return
  //     }

  //     // Set the found products (limit to exactly 2)
  //     const finalProducts = uniqueProducts.slice(0, 2)
  //     setFrequentlyBought(finalProducts)

  //     console.log(
  //       "Final selected products:",
  //       finalProducts.map((p) => ({ name: p.name, category: p.category?.name })),
  //     )

  //     // Auto-select ALL bundle items (current product + exactly 2 accessories = 3 total)
  //     const autoSelectedItems = {
  //       [product._id]: true, // Current product always selected
  //     }

  //     // Auto-select all found accessories (exactly 2)
  //     finalProducts.forEach((item) => {
  //       autoSelectedItems[item._id] = true
  //     })

  //     console.log("Auto-selected bundle items (total 3):", autoSelectedItems)
  //     console.log("Bundle will have:", Object.keys(autoSelectedItems).length, "items total")
  //     setSelectedBundleItems(autoSelectedItems)
  //   } catch (error) {
  //     console.error("Error fetching frequently bought products:", error)
  //     setFrequentlyBought([])
  //   } finally {
  //     setFrequentlyBoughtLoading(false)
  //   }
  // }




































// CHANGE: replace frequently-bought logic with category-specific accessory mapping
  // const fetchFrequentlyBought = async () => {
  //   setFrequentlyBoughtLoading(true)
  //   try {
  //     if (!product) {
  //       setFrequentlyBought([])
  //       setSelectedBundleItems({})
  //       return
  //     }

  //     const name = (product.name || "").toLowerCase()
  //     const catName = (product.category?.name || "").toLowerCase()

  //     // Helper: check if a text includes any of the words
  //     const includesAny = (txt, words) => words.some((w) => txt.includes(w))

  //     // Map primary product types to targeted accessory groups
  //     const GROUPS = [
  //       {
  //         match: ["laptop", "notebook", "macbook"],
  //         suggestions: [
  //           {
  //             label: "keyboard",
  //             keywords: ["keyboard"],
  //             searches: ["keyboard", "wireless keyboard", "bluetooth keyboard", "mechanical keyboard"],
  //           },
  //           {
  //             label: "mouse",
  //             keywords: ["mouse"],
  //             searches: ["mouse", "wireless mouse", "gaming mouse", "bluetooth mouse"],
  //           },
  //           {
  //             label: "laptop bag",
  //             keywords: ["bag", "sleeve", "backpack"],
  //             searches: ["laptop bag", "laptop sleeve", "laptop backpack"],
  //           },
  //           { label: "mouse pad", keywords: ["pad", "mat"], searches: ["mouse pad", "gaming mouse pad", "mouse mat"] },
  //           {
  //             label: "headphones",
  //             keywords: ["headphone", "headset", "earbuds", "earphone"],
  //             searches: ["headphones", "headset", "earbuds"],
  //           },
  //           { label: "hdmi cable", keywords: ["hdmi"], searches: ["hdmi cable"] },
  //         ],
  //         excludeMain: ["laptop", "desktop", "monitor", "aio", "computer", "pc"],
  //       },
  //       {
  //         match: ["printer"],
  //         suggestions: [
  //           { label: "usb cable", keywords: ["usb", "cable"], searches: ["usb cable", "printer cable"] },
  //           { label: "router", keywords: ["router"], searches: ["router"] },
  //           { label: "switch", keywords: ["switch"], searches: ["network switch", "gigabit switch"] },
  //           {
  //             label: "ethernet cable",
  //             keywords: ["ethernet", "lan", "network"],
  //             searches: ["ethernet cable", "lan cable", "network cable"],
  //           },
  //         ],
  //         excludeMain: ["printer"],
  //       },
  //       {
  //         match: ["monitor", "lcd", "led"],
  //         suggestions: [
  //           { label: "hdmi cable", keywords: ["hdmi"], searches: ["hdmi cable"] },
  //           {
  //             label: "displayport cable",
  //             keywords: ["displayport", "dp"],
  //             searches: ["displayport cable", "dp cable"],
  //           },
  //           {
  //             label: "network cable",
  //             keywords: ["ethernet", "lan", "network"],
  //             searches: ["ethernet cable", "lan cable", "network cable"],
  //           },
  //           { label: "keyboard", keywords: ["keyboard"], searches: ["keyboard", "wireless keyboard"] },
  //           { label: "mouse", keywords: ["mouse"], searches: ["mouse", "wireless mouse"] },
  //         ],
  //         excludeMain: ["monitor", "laptop", "desktop", "aio", "computer", "pc"],
  //       },
  //       {
  //         match: ["desktop", "pc", "computer"],
  //         suggestions: [
  //           { label: "monitor", keywords: ["monitor", "display"], searches: ["monitor", "display"] },
  //           { label: "keyboard", keywords: ["keyboard"], searches: ["keyboard", "mechanical keyboard"] },
  //           { label: "mouse", keywords: ["mouse"], searches: ["mouse", "gaming mouse"] },
  //           { label: "ram", keywords: ["ram", "memory", "ddr"], searches: ["ram", "ddr4", "ddr5 memory"] },
  //           { label: "ssd", keywords: ["ssd", "nvme", "solid state"], searches: ["ssd", "nvme ssd"] },
  //           { label: "hdmi cable", keywords: ["hdmi"], searches: ["hdmi cable"] },
  //           { label: "network cable", keywords: ["ethernet", "lan", "network"], searches: ["ethernet cable"] },
  //         ],
  //         excludeMain: ["desktop", "laptop", "monitor", "computer", "pc"],
  //       },
  //     ]

  //     // Determine which group applies
  //     const activeGroup = GROUPS.find((g) => includesAny(name, g.match) || includesAny(catName, g.match)) || null

  //     // If nothing matched, show a safe set of generic accessories
  //     const fallbackSuggestions = [
  //       { label: "mouse", keywords: ["mouse"], searches: ["mouse", "wireless mouse"] },
  //       { label: "keyboard", keywords: ["keyboard"], searches: ["keyboard"] },
  //       { label: "hdmi cable", keywords: ["hdmi"], searches: ["hdmi cable"] },
  //       { label: "network cable", keywords: ["ethernet", "lan", "network"], searches: ["ethernet cable"] },
  //     ]

  //     const suggestions = activeGroup?.suggestions || fallbackSuggestions
  //     const excludeWords = activeGroup?.excludeMain || []

  //     const results = []
  //     const seen = new Set()
  //     const MAX_ITEMS = 8

  //     // Helper: add product if unique and relevant
  //     const tryAddProduct = (p) => {
  //       if (!p || seen.has(p._id) || p._id === product._id) return
  //       const pname = (p.name || "").toLowerCase()
  //       const pcat = (p.category?.name || "").toLowerCase()
  //       // Exclude main-category items
  //       if (includesAny(pname, excludeWords) || includesAny(pcat, excludeWords)) return
  //       seen.add(p._id)
  //       results.push(p)
  //     }

  //     // For each suggestion, query with its search terms and filter by keywords to stay relevant
  //     for (const s of suggestions) {
  //       for (const term of s.searches) {
  //         if (results.length >= MAX_ITEMS) break
  //         try {
  //           const { data } = await axios.get(
  //             `${config.API_URL}/api/products?search=${encodeURIComponent(term)}&limit=20`,
  //           )
  //           data
  //             .filter((p) => {
  //               const pname = (p.name || "").toLowerCase()
  //               const pcat = (p.category?.name || "").toLowerCase()
  //               return s.keywords.some((kw) => pname.includes(kw) || pcat.includes(kw))
  //             })
  //             .forEach(tryAddProduct)
  //         } catch {
  //           // ignore individual search errors and continue
  //         }
  //         if (results.length >= MAX_ITEMS) break
  //       }
  //       if (results.length >= MAX_ITEMS) break
  //     }

  //     // If still empty, do a broad fallback scan
  //     if (results.length === 0) {
  //       try {
  //         const { data } = await axios.get(`${config.API_URL}/api/products?limit=100`)
  //         data
  //           .filter((p) => {
  //             const pname = (p.name || "").toLowerCase()
  //             const pcat = (p.category?.name || "").toLowerCase()
  //             return (
  //               [
  //                 "mouse",
  //                 "keyboard",
  //                 "headphone",
  //                 "earbuds",
  //                 "bag",
  //                 "hdmi",
  //                 "ethernet",
  //                 "router",
  //                 "switch",
  //                 "ssd",
  //                 "ram",
  //               ].some((kw) => pname.includes(kw) || pcat.includes(kw)) &&
  //               !includesAny(pname, excludeWords) &&
  //               !includesAny(pcat, excludeWords)
  //             )
  //           })
  //           .slice(0, MAX_ITEMS)
  //           .forEach(tryAddProduct)
  //       } catch {
  //         // ignore
  //       }
  //     }

  //     setFrequentlyBought(results)
  //     // Pre-select up to 3 accessories plus the current product
  //     const autoSelected = { [product._id]: true }
  //     results.slice(0, 3).forEach((p) => (autoSelected[p._id] = true))
  //     setSelectedBundleItems(autoSelected)
  //   } catch (err) {
  //     setFrequentlyBought([])
  //     setSelectedBundleItems({})
  //   } finally {
  //     setFrequentlyBoughtLoading(false)
  //   }
  // }





  const fetchFrequentlyBought = async () => {
  setFrequentlyBoughtLoading(true);
  try {
    if (!product) {
      setFrequentlyBought([]);
      setSelectedBundleItems({});
      return;
    }

    const productName = (product.name || "").toLowerCase();
    const categoryName = (product.category?.name || "").toLowerCase();
    const brandName = (product.brand?.name || "").toLowerCase();

    console.log("Finding accessories for:", { productName, categoryName, brandName });

    // Enhanced accessory mapping with multiple options for each category
    const ACCESSORY_MAPPING = {
      laptop: [
        // First combination set
        [
          {
            category: "mouse",
            searches: ["wireless mouse", "bluetooth mouse", "gaming mouse"],
            keywords: ["mouse", "wireless", "bluetooth"],
            exclude: ["laptop", "desktop", "computer", "monitor"],
          },
          {
            category: "laptop bag",
            searches: ["laptop bag", "laptop backpack", "laptop case"],
            keywords: ["bag", "backpack", "case", "sleeve"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ],
        // Second combination set
        [
          {
            category: "keyboard",
            searches: ["wireless keyboard", "bluetooth keyboard"],
            keywords: ["keyboard", "wireless", "bluetooth"],
            exclude: ["laptop", "desktop", "monitor"],
          },
          {
            category: "headphones",
            searches: ["wireless headphones", "bluetooth headset"],
            keywords: ["headphone", "headset", "wireless"],
            exclude: ["laptop", "desktop", "monitor", "phone"],
          }
        ],
        // Third combination set
        [
          {
            category: "laptop stand",
            searches: ["laptop stand", "laptop cooler"],
            keywords: ["stand", "cooler", "cooling", "pad"],
            exclude: ["laptop", "desktop", "monitor"],
          },
          {
            category: "usb hub",
            searches: ["usb hub", "type c hub", "docking station"],
            keywords: ["hub", "adapter", "docking", "usb"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ],
        // Fourth combination set
        [
          {
            category: "mouse",
            searches: ["wireless mouse", "gaming mouse"],
            keywords: ["mouse", "wireless", "gaming"],
            exclude: ["laptop", "desktop", "computer", "monitor"],
          },
          {
            category: "usb hub",
            searches: ["usb hub", "type c hub"],
            keywords: ["hub", "adapter", "usb"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ]
      ],

      printer: [
        // First combination set
        [
          {
            category: "cables",
            searches: ["usb cable", "printer cable", "usb type b cable"],
            keywords: ["cable", "usb", "printer"],
            exclude: ["laptop", "desktop", "monitor"],
          },
          {
            category: "ink",
            searches: ["printer ink", "ink cartridge"],
            keywords: ["ink", "cartridge", "toner"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ],
        // Second combination set
        [
          {
            category: "router",
            searches: ["wifi router", "wireless router"],
            keywords: ["router", "wifi", "wireless"],
            exclude: ["laptop", "desktop", "monitor"],
          },
          {
            category: "paper",
            searches: ["a4 paper", "photo paper"],
            keywords: ["paper", "a4", "photo"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ],
        // Third combination set
        [
          {
            category: "switch",
            searches: ["network switch", "ethernet switch"],
            keywords: ["switch", "network", "ethernet"],
            exclude: ["laptop", "desktop", "monitor"],
          },
          {
            category: "cables",
            searches: ["power cable", "extension cord"],
            keywords: ["cable", "power", "extension"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ]
      ],

      lcd: [
        // First combination set
        [
          {
            category: "hdmi cable",
            searches: ["hdmi cable", "hdmi to hdmi"],
            keywords: ["hdmi", "cable"],
            exclude: ["laptop", "desktop", "monitor"],
          },
          {
            category: "keyboard",
            searches: ["wired keyboard", "usb keyboard"],
            keywords: ["keyboard", "wired", "usb"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ],
        // Second combination set
        [
          {
            category: "vga cable",
            searches: ["vga cable", "vga to vga"],
            keywords: ["vga", "cable"],
            exclude: ["laptop", "desktop", "monitor"],
          },
          {
            category: "mouse",
            searches: ["wired mouse", "usb mouse"],
            keywords: ["mouse", "wired", "usb"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ],
        // Third combination set
        [
          {
            category: "network cable",
            searches: ["ethernet cable", "lan cable"],
            keywords: ["ethernet", "lan", "cable"],
            exclude: ["laptop", "desktop", "monitor"],
          },
          {
            category: "monitor stand",
            searches: ["monitor stand", "vesa mount"],
            keywords: ["stand", "mount", "vesa"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ]
      ],

      desktop: [
        // First combination set
        [
          {
            category: "keyboard",
            searches: ["gaming keyboard", "mechanical keyboard"],
            keywords: ["keyboard", "gaming", "mechanical"],
            exclude: ["laptop", "desktop", "monitor"],
          },
          {
            category: "mouse",
            searches: ["gaming mouse", "optical mouse"],
            keywords: ["mouse", "gaming", "optical"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ],
        // Second combination set
        [
          {
            category: "ram",
            searches: ["ddr4 ram", "desktop ram"],
            keywords: ["ram", "ddr4", "memory"],
            exclude: ["laptop", "monitor"],
          },
          {
            category: "ssd",
            searches: ["ssd", "solid state drive"],
            keywords: ["ssd", "solid state", "nvme"],
            exclude: ["laptop", "monitor"],
          }
        ],
        // Third combination set
        [
          {
            category: "monitor",
            searches: ["led monitor", "computer monitor"],
            keywords: ["monitor", "led", "display"],
            exclude: ["laptop", "desktop", "computer"],
          },
          {
            category: "hdmi cable",
            searches: ["hdmi cable", "hdmi 2.0"],
            keywords: ["hdmi", "cable"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ],
        // Fourth combination set
        [
          {
            category: "hard disk",
            searches: ["hard disk", "internal hdd"],
            keywords: ["hard disk", "hdd", "internal"],
            exclude: ["laptop", "monitor", "external"],
          },
          {
            category: "network cable",
            searches: ["ethernet cable", "lan cable"],
            keywords: ["ethernet", "lan", "cable"],
            exclude: ["laptop", "desktop", "monitor"],
          }
        ]
      ]
    };

    // Determine product type
    const getProductType = () => {
      if (productName.includes('laptop') || categoryName.includes('laptop')) {
        return 'laptop';
      } else if (productName.includes('printer') || categoryName.includes('printer')) {
        return 'printer';
      } else if (productName.includes('lcd') || productName.includes('led') || 
                 productName.includes('monitor') || categoryName.includes('monitor')) {
        return 'lcd';
      } else if (productName.includes('desktop') || categoryName.includes('desktop') ||
                 productName.includes('computer') && !productName.includes('laptop')) {
        return 'desktop';
      }
      return 'laptop';
    };

    const productType = getProductType();
    console.log(`Detected product type: ${productType}`);

    const complementaryProducts = [];
    const seenProductIds = new Set([product._id]);

    // Get all combination sets for this product type
    const combinationSets = ACCESSORY_MAPPING[productType] || ACCESSORY_MAPPING.laptop;
    
    // Rotate through different combinations (you can use timestamp, random, or store in state)
    const rotationIndex = Math.floor(Date.now() / 60000) % combinationSets.length; // Changes every minute
    // Alternative: const rotationIndex = Math.floor(Math.random() * combinationSets.length);
    
    const selectedCombination = combinationSets[rotationIndex];
    console.log(`Using combination set ${rotationIndex + 1} of ${combinationSets.length}`);

    // Find products for the selected combination
    for (const accessory of selectedCombination) {
      if (complementaryProducts.length >= 2) break;

      for (const searchTerm of accessory.searches) {
        if (complementaryProducts.length >= 2) break;

        try {
          const response = await axios.get(
            `${config.API_URL}/api/products?search=${encodeURIComponent(searchTerm)}&limit=8`
          );

          // Find the most relevant product from this search
          const relevantProduct = response.data.find(p => {
            if (!p || seenProductIds.has(p._id)) return false;
            
            const pName = (p.name || "").toLowerCase();
            const pCategory = (p.category?.name || "").toLowerCase();
            
            // Must match at least one keyword
            const matchesKeywords = accessory.keywords.some(keyword => 
              pName.includes(keyword) || pCategory.includes(keyword)
            );
            
            // Must NOT contain any excluded words
            const isExcluded = accessory.exclude.some(excludeWord =>
              pName.includes(excludeWord) || pCategory.includes(excludeWord)
            );

            const isRelevantPrice = p.price > 0 && p.price < 2000;

            return matchesKeywords && !isExcluded && isRelevantPrice;
          });

          if (relevantProduct) {
            complementaryProducts.push({
              ...relevantProduct,
              accessoryType: accessory.category
            });
            seenProductIds.add(relevantProduct._id);
            console.log(`Found ${accessory.category}: ${relevantProduct.name}`);
            break;
          }
        } catch (error) {
          console.log(`Search failed for: ${searchTerm}`, error);
        }
      }
    }

    // If we couldn't find both items from the selected combination, try other combinations
    if (complementaryProducts.length < 2) {
      console.log("Trying alternative combinations...");
      
      for (let i = 0; i < combinationSets.length && complementaryProducts.length < 2; i++) {
        if (i === rotationIndex) continue; // Skip the already tried combination
        
        const altCombination = combinationSets[i];
        
        for (const accessory of altCombination) {
          if (complementaryProducts.length >= 2) break;

          for (const searchTerm of accessory.searches) {
            if (complementaryProducts.length >= 2) break;

            try {
              const response = await axios.get(
                `${config.API_URL}/api/products?search=${encodeURIComponent(searchTerm)}&limit=8`
              );

              const relevantProduct = response.data.find(p => {
                if (!p || seenProductIds.has(p._id)) return false;
                
                const pName = (p.name || "").toLowerCase();
                const pCategory = (p.category?.name || "").toLowerCase();
                
                const matchesKeywords = accessory.keywords.some(keyword => 
                  pName.includes(keyword) || pCategory.includes(keyword)
                );
                
                const isExcluded = accessory.exclude.some(excludeWord =>
                  pName.includes(excludeWord) || pCategory.includes(excludeWord)
                );

                const isRelevantPrice = p.price > 0 && p.price < 2000;

                return matchesKeywords && !isExcluded && isRelevantPrice;
              });

              if (relevantProduct) {
                complementaryProducts.push({
                  ...relevantProduct,
                  accessoryType: accessory.category
                });
                seenProductIds.add(relevantProduct._id);
                console.log(`Found alternative ${accessory.category}: ${relevantProduct.name}`);
                break;
              }
            } catch (error) {
              console.log(`Alternative search failed for: ${searchTerm}`, error);
            }
          }
        }
      }
    }

    console.log("Final frequently bought together (1+2):", [
      { name: product.name, type: 'main' },
      ...complementaryProducts.map(p => ({
        name: p.name,
        accessoryType: p.accessoryType,
        price: p.price
      }))
    ]);

    if (isArabic && complementaryProducts.length > 0) {
      const bundleTexts = Array.from(
        new Set(
          complementaryProducts
            .flatMap((item) => [item?.name, item?.brand?.name, item?.category?.name])
            .filter((value) => isWorthTranslating(value))
            .map((value) => value.trim())
        )
      )
      if (bundleTexts.length > 0) {
        await preloadTranslations(bundleTexts, "ar")
      }
    }

    setFrequentlyBought(complementaryProducts);

    // Auto-select current product + found accessories
    const autoSelectedItems = {
      [product._id]: true,
    };

    complementaryProducts.forEach(item => {
      autoSelectedItems[item._id] = true;
    });

    setSelectedBundleItems(autoSelectedItems);

  } catch (error) {
    console.error("Error fetching frequently bought products:", error);
    setFrequentlyBought([]);
  } finally {
    setFrequentlyBoughtLoading(false);
  }
};






































































































  const handleAddBundleToCart = async () => {
    console.log("=== Add Bundle to Cart Started ===")
    console.log("Selected bundle items:", selectedBundleItems)

    const selectedItems = []
    const bundleId = `bundle_${product._id}_${Date.now()}`

    // Add current product if selected (no discount)
    if (selectedBundleItems[product._id]) {
      selectedItems.push({
        ...product,
        bundleId,
        isBundleItem: false,
        bundleDiscount: false,
      })
    }

    // Add selected bundle items with 25% discount.
    // Filtered on stock as well as the tick: an item can sell out between the page
    // loading and the button being pressed, and a stale tick must not become a line.
    frequentlyBought.forEach((item) => {
      if (selectedBundleItems[item._id] && isSellable(item)) {
        const originalPrice = item.offerPrice && item.offerPrice > 0 ? item.offerPrice : item.price
        const discountedPrice = calculateDiscountedPrice(originalPrice, 25)

        selectedItems.push({
          ...item,
          price: discountedPrice,
          originalPrice: originalPrice,
          bundleId,
          isBundleItem: true,
          bundleDiscount: true,
          bundlePrice: discountedPrice,
        })
      }
    })

    if (selectedItems.length === 0) {
      showToast("No items selected", "error")
      return
    }

    try {
      for (const item of selectedItems) {
        addToCart(item, 1, bundleId)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      showToast(`${selectedItems.length} items added to cart with bundle discount!`, "success")
    } catch (error) {
      console.error("Error adding bundle to cart:", error)
      showToast("Failed to add items to cart", "error")
    }
  }

  const handleWhatsAppChat = () => {
    const productLink = `${window.location.origin}${getLocalizedPath(
      `/product/${encodeURIComponent(product.slug || product._id)}`,
    )}`
    const message = `Hi, I need help with this product: ${product.name}\n${productLink}`
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank")
  }

  const handleCallbackSubmit = async (e) => {
    e.preventDefault()
    
    // Check if email verification is needed and completed
    if (emailChanged && !verificationVerified) {
      showToast("Please verify your email address", "error")
      return
    }
    
    setCallbackLoading(true)

    try {
      // Get product link
      const productLink = `${window.location.origin}/product/${product.slug || product._id}`
      
      // Extract country code from phone number (e.g., "+92 3XX XXXXXXX" -> "+92")
      const countryCode = phoneValue ? phoneValue.split(/\d/)[0] : ""
      
      await axios.post(`${config.API_URL}/api/request-callback`, {
        name: callbackForm.name,
        email: callbackForm.email,
        phone: phoneValue,
        countryCode: countryCode,
        customerNote: callbackForm.customerNote,
        productId: product._id,
        productName: product.name,
        productLink: productLink,
      })
      setCallbackSuccess(true)
      setTimeout(() => {
        setShowCallbackModal(false)
        setCallbackSuccess(false)
        setCallbackForm({ 
          name: user?.name || "", 
          email: user?.email || "", 
          phone: "",
          customerNote: ""
        })
        setPhoneValue("")
        setEmailChanged(false)
        setVerificationCode("")
        setVerificationSent(false)
        setVerificationVerified(false)
      }, 2000)
    } catch (error) {
      console.error("Error submitting callback request:", error)
      showToast("Failed to submit callback request", "error")
    } finally {
      setCallbackLoading(false)
    }
  }

  const handleCallbackChange = (e) => {
    const { name, value } = e.target
    
    // Check if email is being changed
    if (name === 'email') {
      // Get the logged-in user's email (if logged in)
      const loggedInEmail = user?.email || ""
      
      // If user is logged in
      if (loggedInEmail !== "") {
        // Compare entered email with logged-in user's email ONLY
        if (value.trim().toLowerCase() === loggedInEmail.trim().toLowerCase()) {
          // Email matches logged-in email - no verification needed
          setEmailChanged(false)
          setVerificationVerified(true)
          setVerificationSent(false)
          setVerificationCode("")
        } else {
          // Email is different from logged-in email - verification required
          setEmailChanged(true)
          setVerificationVerified(false)
          setVerificationSent(false)
          setVerificationCode("")
        }
      } else {
        // User is NOT logged in - verification required for any email
        if (value.trim() !== "") {
          setEmailChanged(true)
          setVerificationVerified(false)
          setVerificationSent(false)
          setVerificationCode("")
        } else {
          setEmailChanged(false)
          setVerificationVerified(false)
        }
      }
    }
    
    setCallbackForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }
  
  const handleSendVerificationCode = async () => {
    setVerificationLoading(true)
    try {
      await axios.post(`${config.API_URL}/api/request-callback/send-verification`, {
        email: callbackForm.email
      })
      setVerificationSent(true)
      showToast("Verification code sent to your email", "success")
    } catch (error) {
      console.error("Error sending verification code:", error)
      showToast("Failed to send verification code", "error")
    } finally {
      setVerificationLoading(false)
    }
  }
  
  const handleVerifyCode = async () => {
    setVerificationLoading(true)
    try {
      await axios.post(`${config.API_URL}/api/request-callback/verify-code`, {
        email: callbackForm.email,
        code: verificationCode
      })
      setVerificationVerified(true)
      showToast("Email verified successfully", "success")
    } catch (error) {
      console.error("Error verifying code:", error)
      showToast(error.response?.data?.message || "Invalid verification code", "error")
    } finally {
      setVerificationLoading(false)
    }
  }

  const handleOpenCouponsModal = async () => {
    setShowCouponsModal(true)
    setLoadingCoupons(true)
    setCouponError(null)

    try {
      const response = await axios.get(`${config.API_URL}/api/coupons`)
      setPublicCoupons(response.data)
    } catch (error) {
      console.error("Error fetching coupons:", error)
      setCouponError("Failed to load coupons")
    } finally {
      setLoadingCoupons(false)
    }
  }

  const handleCloseCouponsModal = () => {
    setShowCouponsModal(false)
    setPublicCoupons([])
    setCouponCopied(null)
  }

  const handleCopyCoupon = async (code, couponId) => {
    try {
      await navigator.clipboard.writeText(code)
      setCouponCopied(couponId)
      showToast("Coupon code copied!", "success")
      setTimeout(() => setCouponCopied(null), 2000)
    } catch (error) {
      console.error("Failed to copy coupon:", error)
      showToast("Failed to copy coupon code", "error")
    }
  }

  // Helper function for shuffling array
  const shuffleArray = (array) => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Shuffled once per fetch. Calling shuffleArray straight in the JSX reorders the
  // rail on every re-render, so the cards jumped whenever an accordion opened.
  const shuffledRelated = useMemo(() => shuffleArray(relatedProducts).slice(0, 8), [relatedProducts])

  // Add coupon colors constant
  const COUPON_COLORS = [
    {
      main: "bg-gradient-to-r from-yellow-100 to-yellow-200",
      stub: "bg-yellow-300",
      border: "border-yellow-400",
      text: "text-yellow-800",
      barcode: "bg-yellow-200",
    },
    {
      main: "bg-gradient-to-r from-blue-100 to-blue-200",
      stub: "bg-blue-300",
      border: "border-blue-400",
      text: "text-blue-800",
      barcode: "bg-blue-200",
    },
    {
      main: "bg-gradient-to-r from-green-100 to-green-200",
      stub: "bg-green-300",
      border: "border-green-400",
      text: "text-green-800",
      barcode: "bg-green-200",
    },
    {
      main: "bg-gradient-to-r from-purple-100 to-purple-200",
      stub: "bg-purple-300",
      border: "border-purple-400",
      text: "text-purple-800",
      barcode: "bg-purple-200",
    },
  ]

  console.log("Render: loading =", loading, ", product =", product, ", error =", error)

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <img src="/logo.png" alt="Loading" className="w-24 h-24 animate-bounce" style={{ animationDuration: "1.5s" }} />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error || "Product not found"}</p>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Return to Home
        </Link>
      </div>
    )
  }

  // SEO: Use custom SEO fields if provided, otherwise fall back to auto-generated values
  const pdTitle = product.seoTitle || `${product.name} — Irhaas`
  const pdDescription =
    product.seoDescription ||
    (product.shortDescription &&
      String(product.shortDescription)
        .replace(/<[^>]+>/g, "")
        .slice(0, 160)) ||
    (product.description &&
      String(product.description)
        .replace(/<[^>]+>/g, "")
        .slice(0, 160)) ||
    `${product.name} available at Irhaas.`

  const pdCanonicalPath = product.seoCanonicalUrl || getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)
  const pdKeywords = product.seoKeywords || (product.tags && product.tags.length > 0 ? product.tags.join(", ") : undefined)
  const pdRobots = product.seoRobots || "index, follow"
  const pdOgTitle = product.ogTitle || pdTitle
  const pdOgDescription = product.ogDescription || pdDescription
  const pdOgImage = product.ogImage || product.image
  const hasShortDescription = typeof product.shortDescription === "string" && product.shortDescription.trim().length > 0
  const hasDescription = typeof product.description === "string" && product.description.trim().length > 0
  const keyFeaturesContent = hasShortDescription ? product.shortDescription : hasDescription ? product.description : ""
  const keyFeaturesFieldName = hasShortDescription ? "shortDescription" : "description"

  const productImages = getCurrentImages()
  const merchantPrice = getEffectivePrice()
  const merchantPriceContent = toMerchantPriceContent(merchantPrice)
  const merchantAvailabilityUrl = getMerchantAvailabilityUrl()

  // Helper function to get stock badge
  const getStockBadge = () => {
    // Unified badge style for all stock statuses
    const baseClass =
      "inline-flex items-center justify-center px-3 py-[5px] text-[10px] font-semibold uppercase tracking-[0.12em] leading-none";
    
    // Use the stockStatusAr if available, otherwise fallback to TranslatedText dictionary
    const effectiveStock = getEffectiveStockStatus()
    const StockLabel = (
      <TranslatedText 
        text={effectiveStock} 
        sourceDoc={product} 
        fieldName="stockStatus"
      >
        {effectiveStock === "PreOrder" ? "Pre-order" : effectiveStock}
      </TranslatedText>
    );

    switch (effectiveStock) {
      case "In Stock":
        return (
          <span className={baseClass + " bg-emerald-700 text-white"}>{StockLabel}</span>
        );
      case "Out of Stock":
        return (
          <span className={baseClass + " bg-stone-800 text-white"}>{StockLabel}</span>
        );
      case "PreOrder":
        return (
          <span className={baseClass + " bg-amber-600 text-white"}>{StockLabel}</span>
        );
      default:
        return null;
    }
  } // end getStockBadge

  // Helper function to get discount badge
  const getDiscountBadge = () => {
    const basePrice = Number(product.price) || 0;
    const offerPrice = Number(product.offerPrice) || 0;
    const buyingPrice = Number(product.buyingPrice) || 0;
    const hasValidOffer = offerPrice > 0 && basePrice > 0 && offerPrice < basePrice;
    // Unified badge style for discount
    const badgeClass =
      "inline-flex items-center justify-center px-3 py-[5px] text-[10px] font-semibold uppercase tracking-[0.12em] leading-none bg-brand-600 text-white";
    if (hasValidOffer) {
      const discountPercentage = Math.round(((basePrice - offerPrice) / basePrice) * 100);
      return (
        <span className={badgeClass}>
          -{discountPercentage}%
        </span>
      );
    } else if (buyingPrice > 0 && basePrice > 0 && buyingPrice > basePrice) {
      const discountPercentage = Math.round(((buyingPrice - basePrice) / buyingPrice) * 100);
      return (
        <span className={badgeClass}>
          -{discountPercentage}%
        </span>
      );
    } else if (product.discount > 0) {
      // Fallback if only discount percentage is provided
      return (
        <span className={badgeClass}>
          -{product.discount}%
        </span>
      );
    }
    return null;
  } // end getDiscountBadge

  return (
    <div className="bg-white min-h-screen pb-28 md:pb-20 lg:pb-0" itemScope itemType="https://schema.org/Product">
      <SEO 
        title={pdTitle} 
        description={pdDescription} 
        canonicalPath={pdCanonicalPath} 
        image={pdOgImage} 
        keywords={pdKeywords}
        noindex={pdRobots.includes("noindex")}
        ogTitle={pdOgTitle}
        ogDescription={pdOgDescription}
        customSchema={product.customSchema}
      />
      {merchantPriceContent && (
        <Helmet prioritizeSeoTags>
          <meta property="product:price:amount" content={merchantPriceContent} />
          <meta property="product:price:currency" content="PKR" />
          <meta name="product:price:amount" content={merchantPriceContent} />
          <meta name="product:price:currency" content="PKR" />
        </Helmet>
      )}
      <meta itemProp="name" content={product.name || ""} />
      {product.sku && <meta itemProp="sku" content={product.sku} />}
      {pdDescription && <meta itemProp="description" content={pdDescription} />}
      {product.image && <meta itemProp="image" content={getFullImageUrl(product.image) || product.image} />}
      <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 overflow-x-auto text-xs text-stone-500">
          <Link to={getLocalizedPath("/")} className="whitespace-nowrap transition-colors hover:text-stone-900">
            <TranslatedText>Home</TranslatedText>
          </Link>
          <span aria-hidden="true" className="text-stone-300">|</span>
          <Link to={getLocalizedPath("/shop")} className="whitespace-nowrap transition-colors hover:text-stone-900">
            <TranslatedText>Shop</TranslatedText>
          </Link>
          
          {/* Parent Category */}
          {product.parentCategory && (
            <>
              <span aria-hidden="true" className="text-stone-300">|</span>
              <Link
                to={getLocalizedPath(generateShopURL({ parentCategory: product.parentCategory.slug || product.parentCategory._id }))}
                className="whitespace-nowrap transition-colors hover:text-stone-900"
              >
                <TranslatedText text={product.parentCategory.name} sourceDoc={product.parentCategory} fieldName="name" />
              </Link>
            </>
          )}
          
          {/* Subcategory Level 1 */}
          {product.category && (
            <>
              <span aria-hidden="true" className="text-stone-300">|</span>
              <Link
                to={getLocalizedPath(generateShopURL({ 
                  parentCategory: product.parentCategory?.slug || product.parentCategory?._id || "all", 
                  subcategory: product.category.slug || product.category._id 
                }))}
                className="whitespace-nowrap transition-colors hover:text-stone-900"
              >
                <TranslatedText text={product.category.name} sourceDoc={product.category} fieldName="name" />
              </Link>
            </>
          )}
          
          {/* Subcategory Level 2 */}
          {product.subCategory2 && (
            <>
              <span aria-hidden="true" className="text-stone-300">|</span>
              <Link
                to={getLocalizedPath(generateShopURL({ 
                  parentCategory: product.parentCategory?.slug || product.parentCategory?._id || "all", 
                  subcategory: product.category?.slug || product.category?._id,
                  subcategory2: product.subCategory2.slug || product.subCategory2._id 
                }))}
                className="whitespace-nowrap transition-colors hover:text-stone-900"
              >
                <TranslatedText text={product.subCategory2.name} sourceDoc={product.subCategory2} fieldName="name" />
              </Link>
            </>
          )}
          
          {/* Subcategory Level 3 */}
          {product.subCategory3 && (
            <>
              <span aria-hidden="true" className="text-stone-300">|</span>
              <Link
                to={getLocalizedPath(generateShopURL({ 
                  parentCategory: product.parentCategory?.slug || product.parentCategory?._id || "all", 
                  subcategory: product.category?.slug || product.category?._id,
                  subcategory2: product.subCategory2?.slug || product.subCategory2?._id,
                  subcategory3: product.subCategory3.slug || product.subCategory3._id 
                }))}
                className="whitespace-nowrap transition-colors hover:text-stone-900"
              >
                <TranslatedText text={product.subCategory3.name} sourceDoc={product.subCategory3} fieldName="name" />
              </Link>
            </>
          )}
          
          {/* Subcategory Level 4 */}
          {product.subCategory4 && (
            <>
              <span aria-hidden="true" className="text-stone-300">|</span>
              <Link
                to={getLocalizedPath(generateShopURL({ 
                  parentCategory: product.parentCategory?.slug || product.parentCategory?._id || "all", 
                  subcategory: product.category?.slug || product.category?._id,
                  subcategory2: product.subCategory2?.slug || product.subCategory2?._id,
                  subcategory3: product.subCategory3?.slug || product.subCategory3?._id,
                  subcategory4: product.subCategory4.slug || product.subCategory4._id 
                }))}
                className="whitespace-nowrap transition-colors hover:text-stone-900"
              >
                <TranslatedText text={product.subCategory4.name} sourceDoc={product.subCategory4} fieldName="name" />
              </Link>
            </>
          )}
          
          <span aria-hidden="true" className="text-stone-300">|</span>
          <span className="block max-w-[140px] truncate whitespace-nowrap text-stone-900 sm:max-w-none">
            <TranslatedText text={product.name} sourceDoc={product} fieldName="name" />
          </span>
        </nav>

        {/* Product Images and Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14">
          {/* Product Images - Left Side */}
          <div className="lg:col-span-7">
            {/* Main Image/Video */}
            <div className="group relative w-full overflow-hidden bg-[#efece7]">
              <div className="relative aspect-[4/5] w-full">
                {productImages[selectedImage]?.type === 'video' ? (
                  isYouTubeUrl(productImages[selectedImage]?.url) ? (
                    <iframe
                      key={selectedImage}
                      src={getYouTubeEmbedUrl(productImages[selectedImage]?.url)}
                      title="YouTube video player"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                    ></iframe>
                  ) : (
                    <video
                      key={selectedImage}
                      src={getFullImageUrl(productImages[selectedImage]?.url) || ""}
                      controls
                      autoPlay
                      className="absolute inset-0 h-full w-full object-contain"
                      poster={getFullImageUrl(product.image)}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )
                ) : (
                  <img
                    src={getOptimizedImageUrl(productImages[selectedImage]?.url, { width: 900, quality: 78 }) || "/placeholder.svg?height=400&width=400"}
                    alt={product.name}
                    decoding="async"
                    className="absolute inset-0 h-full w-full cursor-zoom-in object-contain"
                    onClick={() => handleImageClick(selectedImage)}
                  />
                )}

                {/* Zoom affordance. Ted Baker keeps it permanently visible top-right; it
                    doubles as the only hint on touch that the image opens full screen. */}
                <button
                  type="button"
                  onClick={() => handleImageClick(selectedImage)}
                  aria-label="Zoom image"
                  className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-stone-800 transition hover:bg-white"
                >
                  <ZoomIn size={18} strokeWidth={1.5} />
                </button>

                {productImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setSelectedImage(selectedImage > 0 ? selectedImage - 1 : productImages.length - 1)}
                      aria-label="Previous image"
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-stone-700 transition hover:text-black md:opacity-0 md:group-hover:opacity-100"
                    >
                      <ChevronLeft size={26} strokeWidth={1.25} />
                    </button>
                    <button
                      onClick={() => setSelectedImage((selectedImage + 1) % productImages.length)}
                      aria-label="Next image"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-stone-700 transition hover:text-black md:opacity-0 md:group-hover:opacity-100"
                    >
                      <ChevronRight size={26} strokeWidth={1.25} />
                    </button>
                  </>
                )}

                {/* Position bar + counter. The bar is a plain flex track rather than a
                    scrollbar, so it stays in step with the arrows and the thumbnails. */}
                {productImages.length > 1 && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 px-5 pb-4">
                    <div className="flex h-[2px] flex-1 overflow-hidden bg-stone-300">
                      {productImages.map((_, index) => (
                        <span
                          key={index}
                          className={`h-full flex-1 ${index === selectedImage ? "bg-stone-900" : "bg-transparent"}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs tabular-nums text-stone-700">
                      {selectedImage + 1} | {productImages.length}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail Images */}
            {productImages.length > 1 && (
              <div className="relative mt-3 w-full">
                {thumbScroll > 0 && (
                  <button
                    className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-1 shadow"
                    aria-label="Scroll thumbnails left"
                    onClick={() => {
                      if (thumbnailRowRef.current) {
                        thumbnailRowRef.current.scrollBy({ left: -120, behavior: "smooth" })
                      }
                    }}
                  >
                    <ChevronLeft size={18} className="text-stone-800" />
                  </button>
                )}
                <div
                  ref={thumbnailRowRef}
                  className="hide-scrollbar flex w-full gap-2 overflow-x-auto"
                  onScroll={(e) => setThumbScroll(e.target.scrollLeft)}
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {productImages.map((media, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      aria-label={`View image ${index + 1}`}
                      className={`relative h-20 w-16 flex-shrink-0 overflow-hidden bg-[#efece7] transition-all ${
                        selectedImage === index ? "ring-1 ring-stone-900" : "ring-1 ring-transparent hover:ring-stone-300"
                      }`}
                    >
                      {media?.type === 'video' ? (
                        <>
                          {isYouTubeUrl(media.url) ? (
                            <img
                              src={`https://img.youtube.com/vi/${media.url.includes('youtu.be/')
                                ? media.url.split('youtu.be/')[1]?.split('?')[0]
                                : media.url.split('v=')[1]?.split('&')[0]}/mqdefault.jpg`}
                              alt="Video thumbnail"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <video src={getFullImageUrl(media.url)} className="h-full w-full object-cover" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </div>
                        </>
                      ) : (
                        <img
                          src={getOptimizedImageUrl(media?.url, { width: 140, height: 175, quality: 70 }) || "/placeholder.svg?height=64&width=64"}
                          alt={`${product.name} - view ${index + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
                {thumbnailRowRef.current &&
                  thumbnailRowRef.current.scrollLeft + thumbnailRowRef.current.offsetWidth <
                    thumbnailRowRef.current.scrollWidth && (
                    <button
                      className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-1 shadow"
                      aria-label="Scroll thumbnails right"
                      onClick={() => {
                        if (thumbnailRowRef.current) {
                          thumbnailRowRef.current.scrollBy({ left: 120, behavior: "smooth" })
                        }
                      }}
                    >
                      <ChevronRight size={18} className="text-stone-800" />
                    </button>
                  )}
                <style>{`
                  .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
                  .hide-scrollbar::-webkit-scrollbar { display: none; }
                `}</style>
              </div>
            )}

            {/* Product Video Section - Only show if product has video */}
            {product?.video && (
              <div
                className="group mt-6 cursor-pointer overflow-hidden border border-stone-200"
                onClick={() => setShowVideoModal(true)}
              >
                <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-4 py-2">
                  <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-900">
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    <TranslatedText>Product Video</TranslatedText>
                  </h4>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-stone-500">
                    <TranslatedText>Click to expand</TranslatedText>
                  </span>
                </div>
                <div className="relative aspect-video w-full bg-black">
                  {isYouTubeUrl(product.video) ? (
                    <iframe
                      src={`${getYouTubeEmbedUrl(product.video)}?autoplay=1&mute=1`}
                      title="Product Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="pointer-events-none h-full w-full"
                    ></iframe>
                  ) : (
                    <video
                      src={getFullImageUrl(product.video)}
                      autoPlay
                      muted
                      loop
                      className="pointer-events-none h-full w-full object-contain"
                      poster={getFullImageUrl(product.image)}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-transparent transition-all group-hover:bg-black/20">
                    <div className="rounded-full bg-white/90 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <ZoomIn size={22} className="text-stone-800" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Product Info - Right Side */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              {/* Status Badges */}
              {(getStockBadge() || getDiscountBadge()) && (
                <div className="mb-4 flex items-center gap-2">
                  {getStockBadge()}
                  {getDiscountBadge()}
                </div>
              )}

              <h1 className="text-2xl font-semibold leading-snug text-stone-900 md:text-[28px]">
                <TranslatedText text={product.name} sourceDoc={product} fieldName="name" />
              </h1>

              {/* Price */}
              <div className="mt-3" itemProp="offers" itemScope itemType="https://schema.org/Offer">
                {(() => {
                  const currentColor = getCurrentColor()
                  const currentDos = getCurrentDos()
                  const currentSize = getCurrentSize()
                  let basePrice = 0
                  let offerPrice = 0
                  let buyingPrice = 0

                  if (currentColor) {
                    basePrice = Number(currentColor.price) || 0
                    offerPrice = Number(currentColor.offerPrice) || 0
                    buyingPrice = Number(currentColor.buyingPrice) || Number(product.buyingPrice) || 0
                  } else {
                    basePrice = Number(product.price) || 0
                    offerPrice = Number(product.offerPrice) || 0
                    buyingPrice = Number(product.buyingPrice) || 0
                  }

                  if (currentDos && Number(currentDos.buyingPrice) > 0) {
                    buyingPrice += Number(currentDos.buyingPrice)
                  }

                  const sizeAdditional = currentSize && Number(currentSize.additionalPrice) > 0 ? Number(currentSize.additionalPrice) : 0
                  basePrice += sizeAdditional
                  if (offerPrice > 0) {
                    offerPrice += sizeAdditional
                  }

                  const hasValidOffer = offerPrice > 0 && basePrice > 0 && offerPrice < basePrice
                  const priceToShow = getEffectivePrice()
                  const priceContent = toMerchantPriceContent(priceToShow)

                  // Crossed-out price: show actual Buying Price (strikethrough)
                  const crossedPrice = buyingPrice > 0 ? buyingPrice : (hasValidOffer ? basePrice : 0)
                  const showOldPrice = crossedPrice > 0
                  const discount = hasValidOffer
                    ? Math.round(((basePrice - offerPrice) / basePrice) * 100)
                    : (buyingPrice > 0 && priceToShow > 0 && buyingPrice > priceToShow
                      ? Math.round(((buyingPrice - priceToShow) / buyingPrice) * 100)
                      : 0)

                  return (
                    <>
                      {priceContent && (
                        <>
                          <meta itemProp="price" content={priceContent} />
                          <meta itemProp="priceCurrency" content="PKR" />
                          <link itemProp="availability" href={merchantAvailabilityUrl} />
                        </>
                      )}
                      <div className="flex flex-wrap items-baseline gap-3">
                        <span className="text-2xl font-semibold text-stone-900">{formatPrice(priceToShow)}</span>
                        {showOldPrice && (
                          <span className="text-base font-normal text-stone-400 line-through">{formatPrice(crossedPrice)}</span>
                        )}
                        {discount > 0 && (
                          <span className="bg-brand-600 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            {discount}% <TranslatedText>off</TranslatedText>
                          </span>
                        )}
                      </div>
                      {crossedPrice > priceToShow && (
                        <p className="mt-1 text-sm text-brand-700">
                          <TranslatedText>You Save</TranslatedText> {formatPrice(crossedPrice - priceToShow)}
                        </p>
                      )}
                      <LoyaltyEarnBadge product={product} priceAed={priceToShow} className="mt-3" />
                    </>
                  )
                })()}
              </div>

              {/* Rating */}
              <div className="mt-4 flex items-center gap-2">
                <div
                  ref={ratingDropdownRef}
                  className={`relative flex items-center ${isMobile ? "cursor-pointer" : ""}`}
                  onMouseEnter={() => !isMobile && setShowRatingDropdown(true)}
                  onMouseLeave={() => !isMobile && setShowRatingDropdown(false)}
                  onClick={handleRatingInteraction}
                >
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={`${
                        i < Math.floor(reviewStats.averageRating || 0) ? "fill-current text-brand-500" : "text-stone-300"
                      } cursor-pointer transition-transform duration-200 hover:scale-110`}
                      onClick={(e) => {
                        e.stopPropagation()
                        scrollToReviewSection()
                      }}
                    />
                  ))}

                  {/* Rating Breakdown Dropdown */}
                  {showRatingDropdown && (
                    <div className="absolute left-0 top-full z-50 mt-2 min-w-[200px] border border-stone-200 bg-white p-4 shadow-lg">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700">
                        <TranslatedText>Rating Breakdown</TranslatedText>
                      </div>
                      {(() => {
                        const distribution = getRatingDistribution()
                        return [5, 4, 3, 2, 1].map((rating) => (
                          <div
                            key={rating}
                            className="flex cursor-pointer items-center justify-between rounded px-2 py-1 transition-colors hover:bg-stone-50"
                            onClick={() => handleStarRatingClick(rating)}
                          >
                            <div className="flex items-center space-x-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  size={13}
                                  className={i < rating ? "fill-current text-brand-500" : "text-stone-300"}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-stone-700">({distribution[rating] || 0})</span>
                          </div>
                        ))
                      })()}
                      {isMobile && (
                        <div className="mt-2 border-t pt-2 text-xs text-stone-500">
                          <TranslatedText>Tap outside to close</TranslatedText>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs text-stone-600 underline-offset-4 transition-colors hover:underline"
                  onClick={scrollToReviewSection}
                >
                  ({reviewStats.totalReviews || 0} {reviewStats.totalReviews === 1 ? "review" : "reviews"})
                </button>
              </div>

              {/* Brand / Category / SKU */}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs uppercase tracking-[0.1em] text-stone-500">
                <span>
                  <TranslatedText>Brand</TranslatedText>:{" "}
                  <span className="text-stone-900">
                    <TranslatedText
                      text={product.brand?.name || product.brand || "N/A"}
                      sourceDoc={product.brand}
                      fieldName="name"
                    />
                  </span>
                </span>
                <span>
                  <TranslatedText>Category</TranslatedText>:{" "}
                  <span className="text-stone-900">
                    <TranslatedText
                      text={product.category?.name || product.category || "N/A"}
                      sourceDoc={product.category}
                      fieldName="name"
                    />
                  </span>
                </span>
                <span>
                  <TranslatedText>SKU</TranslatedText>: <span className="text-stone-900">{product.sku || "N/A"}</span>
                </span>
              </div>

              {/* Stock Status */}
              <div className="mt-4">
                {(() => {
                  const currentSize = getCurrentSize()
                  const availableQuantity = currentSize && currentSize.countInStock !== undefined
                    ? Number(currentSize.countInStock)
                    : (product.countInStock !== undefined ? Number(product.countInStock) : 0)

                  const isAvailable = availableQuantity > 0

                  return (
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          isAvailable
                            ? "bg-emerald-600 animate-pulse"
                            : "bg-red-500"
                        }`}
                      />
                      <span
                        className={`text-sm font-semibold ${
                          isAvailable ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {isAvailable ? (
                          <>
                            <TranslatedText>Available in Stock</TranslatedText>: {availableQuantity}
                            {currentSize ? ` (${currentSize.code || currentSize.name})` : ""}
                          </>
                        ) : (
                          <>
                            <TranslatedText>Out of Stock</TranslatedText>
                            {currentSize ? ` (${currentSize.code || currentSize.name}: 0)` : ": 0"}
                          </>
                        )}
                      </span>
                    </div>
                  )
                })()}
              </div>

              <div className="mt-6" />

              {/* Product Sizes */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mb-6">
                  <div className="mb-2.5">
                    <h3 className="text-sm uppercase tracking-[0.1em] font-bold text-stone-900">
                      <TranslatedText>Size</TranslatedText>
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {product.sizes.map((sizeItem, index) => {
                      const isSelected = selectedSizeIndex === index
                      const displayLabel = sizeItem.code || sizeItem.name
                      const isOutOfStock = sizeItem.countInStock !== undefined && Number(sizeItem.countInStock) <= 0
                      return (
                        <button
                          key={sizeItem._id || index}
                          type="button"
                          onClick={() => handleSelectSize(index)}
                          className={`min-w-[48px] h-11 px-4 rounded-md border text-sm font-semibold transition-all duration-200 flex items-center justify-center relative cursor-pointer ${
                            isOutOfStock
                              ? isSelected
                                ? "border-stone-900 bg-stone-900 text-white shadow-sm ring-2 ring-rose-500/50"
                                : "border-dashed border-stone-300 bg-stone-50 text-stone-500 hover:border-stone-500 hover:bg-stone-100"
                              : isSelected
                                ? "border-stone-900 bg-stone-900 text-white shadow-sm ring-2 ring-stone-900/20"
                                : "border-stone-300 bg-white text-stone-800 hover:border-stone-500 hover:bg-stone-50"
                          }`}
                          title={
                            isOutOfStock
                              ? `${displayLabel} - Out of Stock (Click to get restock alert)`
                              : `${displayLabel} (${sizeItem.countInStock || 0} available)`
                          }
                        >
                          <span>{displayLabel}</span>
                          {isOutOfStock && (
                            <span
                              className={`absolute -top-1.5 -right-1 text-[8px] font-bold px-1 rounded uppercase tracking-wider ${
                                isSelected ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-700 border border-rose-300"
                              }`}
                            >
                              Out
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Color Variations */}
              {product.colorVariations && product.colorVariations.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.1em]">
                    <span className="font-bold text-stone-900">
                      <TranslatedText>Color</TranslatedText>:
                    </span>
                    <span className="text-stone-800">
                      {selectedColorIndex !== null && product.colorVariations[selectedColorIndex]?.color ? (
                        <TranslatedText text={product.colorVariations[selectedColorIndex].color}>
                          {product.colorVariations[selectedColorIndex].color}
                        </TranslatedText>
                      ) : (
                        <TranslatedText>Select Color</TranslatedText>
                      )}
                    </span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {product.colorVariations
                      .filter((colorVar) => colorVar.color)
                      .map((colorVar, index) => (
                        <ColorSwatch
                          key={index}
                          name={colorVar.color}
                          selected={index === selectedColorIndex}
                          soldOut={colorVar.countInStock <= 0}
                          onClick={() => {
                            // Toggle: clicking the selected colour returns to the base product.
                            setSelectedColorIndex(index === selectedColorIndex ? null : index)
                            setSelectedImage(0)
                          }}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* DOS/Windows Variations */}
              {product.dosVariations && product.dosVariations.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                    
                    Windows: {selectedDosIndex !== null && product.dosVariations[selectedDosIndex]?.dosType ? product.dosVariations[selectedDosIndex].dosType : "Select Option"}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {product.dosVariations
                      .filter(dosVar => dosVar.dosType)
                      .map((dosVar, index) => {
                        const isSelected = index === selectedDosIndex
                        const dosPrice = dosVar.offerPrice > 0 ? dosVar.offerPrice : dosVar.price
                        
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              // Toggle: if already selected, deselect to show original product
                              setSelectedDosIndex(isSelected ? null : index)
                              setSelectedImage(0)
                            }}
                            className={`relative border p-2 transition-all duration-200 ${
                              isSelected 
                                ? 'border-stone-900 bg-white' 
                                : 'border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            {/* Product Image */}
                           
                            
                            {/* OS Type Name */}
                            <p className={`text-xs font-semibold text-center mb-1 ${
                              isSelected ? 'text-stone-900' : 'text-stone-600'
                            }`}>
                              {dosVar.dosType}
                            </p>
                            
                            {/* Price */}
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold text-center text-stone-900">
                                {formatPrice(dosPrice)}
                              </p>
                              {Number(dosVar.buyingPrice) > 0 && (
                                <p className="text-xs text-stone-400 line-through">
                                  {formatPrice(Number(dosVar.buyingPrice))}
                                </p>
                              )}
                            </div>
                            
                            {/* Current Selection Indicator */}
                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-stone-900 text-white rounded-full p-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                            
                            {/* Stock Badge */}
                            {dosVar.countInStock <= 0 && (
                              <div className="absolute bottom-2 left-2 right-2 bg-red-500 text-white text-xs py-1 px-2 rounded text-center">
                                Out of Stock
                              </div>
                            )}
                          </button>
                        )
                      })}
                  </div>
                  <p className="mt-3 text-xs text-stone-500">
                    Select an OS option to view its image and price
                  </p>
                </div>
              )}

              {/* Product Variations */}
              {product.variations && product.variations.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.1em]">
                    <span className="font-bold text-stone-900">
                      <TranslatedText>Color</TranslatedText>:
                    </span>
                    {product.selfVariationText && (
                      <span className="text-stone-800">
                        <TranslatedText text={product.selfVariationText} sourceDoc={product} fieldName="selfVariationText" />
                      </span>
                    )}
                  </h3>
                  {(() => {
                    // Build array of all variations including current product
                    const allVariations = []
                    
                    // Add current product if it has selfVariationText (or fallback to reverseVariationText)
                    const currentProductText = product.selfVariationText || product.reverseVariationText
                    if (currentProductText) {
                      allVariations.push({
                        id: product._id,
                        text: currentProductText,
                        slug: product.slug,
                        isCurrent: true,
                        image: product.image,
                        price: product.price,
                        offerPrice: product.offerPrice,
                        sku: product.sku
                      })
                    }
                    
                    // Add other variations - use their selfVariationText, fallback to variationText
                    product.variations
                      .filter(variation => {
                        const varProduct = variation.product
                        if (!varProduct) return false
                        // Get the text: prefer selfVariationText from the product, fallback to variationText
                        const varText = (typeof varProduct === 'object' && (varProduct.selfVariationText || varProduct.reverseVariationText)) 
                          || variation.variationText 
                          || ""
                        return varText.trim() !== ""
                      })
                      .forEach(variation => {
                        const varProduct = variation.product
                        const varId = typeof varProduct === 'object' ? varProduct._id : varProduct
                        const varSlug = typeof varProduct === 'object' ? varProduct.slug : null
                        // Get the text: prefer selfVariationText from the product, fallback to variationText
                        const varText = (typeof varProduct === 'object' && (varProduct.selfVariationText || varProduct.reverseVariationText)) 
                          || variation.variationText 
                          || ""
                        
                        allVariations.push({
                          id: varId,
                          text: varText,
                          slug: varSlug || varId,
                          isCurrent: false,
                          image: typeof varProduct === 'object' ? varProduct.image : null,
                          price: typeof varProduct === 'object' ? varProduct.price : null,
                          offerPrice: typeof varProduct === 'object' ? varProduct.offerPrice : null,
                          sku: typeof varProduct === 'object' ? varProduct.sku : null
                        })
                      })
                    
                    // Sort alphabetically by text to maintain consistent order
                    allVariations.sort((a, b) => a.text.localeCompare(b.text))
                    
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        {allVariations.map((variation) =>
                          variation.isCurrent ? (
                            <ColorSwatch key={variation.id} name={variation.text} selected />
                          ) : (
                            <ColorSwatch
                              key={variation.id}
                              name={variation.text}
                              as={Link}
                              to={getLocalizedPath(`/product/${encodeURIComponent(variation.slug)}`)}
                            />
                          ),
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}                {/* Available Models */}
              {product.availableModels && product.availableModels.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                    
                    <TranslatedText>Available Models</TranslatedText>:
                  </h3>
                  {(() => {
                    const allModels = []

                    const currentModelText = product.selfAvailableModelText
                    if (currentModelText) {
                      allModels.push({
                        id: product._id,
                        text: currentModelText,
                        slug: product.slug,
                        isCurrent: true,
                        image: product.image,
                        price: product.price,
                        buyingPrice: product.buyingPrice,
                        offerPrice: product.offerPrice,
                        sku: product.sku
                      })
                    }

                    product.availableModels
                      .filter((model) => {
                        const modelProduct = model.product
                        if (!modelProduct) return false
                        const modelText =
                          (typeof modelProduct === "object" && modelProduct.selfAvailableModelText) ||
                          model.variationText ||
                          ""
                        return modelText.trim() !== ""
                      })
                      .forEach((model) => {
                        const modelProduct = model.product
                        const modelId = typeof modelProduct === "object" ? modelProduct._id : modelProduct
                        const modelSlug = typeof modelProduct === "object" ? modelProduct.slug : null
                        const modelText =
                          (typeof modelProduct === "object" && modelProduct.selfAvailableModelText) ||
                          model.variationText ||
                          ""

                        allModels.push({
                          id: modelId,
                          text: modelText,
                          slug: modelSlug || modelId,
                          isCurrent: false,
                          image: typeof modelProduct === "object" ? modelProduct.image : null,
                          price: typeof modelProduct === "object" ? modelProduct.price : null,
                          buyingPrice: typeof modelProduct === "object" ? modelProduct.buyingPrice : null,
                          offerPrice: typeof modelProduct === "object" ? modelProduct.offerPrice : null,
                          sku: typeof modelProduct === "object" ? modelProduct.sku : null
                        })
                      })

                    allModels.sort((a, b) => a.text.localeCompare(b.text))

                    if (product.availableModelsDisplayType === "card") {
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                          {allModels.map((model) => {
                            const isSelected = model.isCurrent
                            const modelPrice = model.offerPrice > 0 ? model.offerPrice : model.price
                            const matchingModel = product.availableModels?.find(
                              (item) => (item.product?._id || item.product || "").toString() === (model.id || "").toString()
                            )

                            return (
                              <div key={model.id} className="relative">
                                {model.isCurrent ? (
                                  <div className="relative border-2 rounded-lg p-3 bg-blue-50 border-blue-500 cursor-default text-center">
                                    {/* Product Image */}
                                    <div className="aspect-square mb-2 overflow-hidden bg-[#efece7]">
                                      <img
                                        src={getFullImageUrl(model.image) || "/placeholder.svg"}
                                        alt={model.text}
                                        className="w-full h-full object-contain"
                                      />
                                    </div>
                                    
                                    {/* Model Text */}
                                    <p className="text-xs font-semibold text-center mb-1 text-blue-700">
                                      <TranslatedText text={model.text} sourceDoc={product} fieldName="selfAvailableModelText" />
                                    </p>
                                    
                                    {/* Price */}
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                      <p className="text-sm font-semibold text-center text-stone-900">
                                        {formatPrice(modelPrice)}
                                      </p>
                                      {Number(model.buyingPrice) > 0 && (
                                        <p className="text-xs text-stone-400 line-through">
                                          {formatPrice(Number(model.buyingPrice))}
                                        </p>
                                      )}
                                    </div>
                                    
                                    {/* Selection Indicator */}
                                    <div className="absolute top-1 right-1 bg-stone-900 text-white rounded-full p-1">
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  </div>
                                ) : (
                                  <Link
                                    to={getLocalizedPath(`/product/${encodeURIComponent(model.slug)}`)}
                                    className="block relative border-2 rounded-lg p-3 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 text-center"
                                  >
                                    {/* Product Image */}
                                    <div className="aspect-square mb-2 overflow-hidden bg-[#efece7]">
                                      <img
                                        src={getFullImageUrl(model.image) || "/placeholder.svg"}
                                        alt={model.text}
                                        className="w-full h-full object-contain"
                                      />
                                    </div>
                                    
                                    {/* Model Text */}
                                    <p className="text-xs font-semibold text-center mb-1 text-gray-700">
                                      <TranslatedText text={model.text} sourceDoc={matchingModel} fieldName="variationText" />
                                    </p>
                                    
                                    {/* Price */}
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                      <p className="text-sm font-semibold text-center text-stone-900">
                                        {formatPrice(modelPrice)}
                                      </p>
                                      {Number(model.buyingPrice) > 0 && (
                                        <p className="text-xs text-stone-400 line-through">
                                          {formatPrice(Number(model.buyingPrice))}
                                        </p>
                                      )}
                                    </div>
                                  </Link>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    }

                    return (
                      <div className="flex flex-wrap gap-3">
                        {allModels.map((model) => {
                          const matchingModel = product.availableModels?.find(
                            (item) => (item.product?._id || item.product || "").toString() === (model.id || "").toString()
                          )

                          return (
                            <div key={model.id} className="relative">
                              {model.isCurrent ? (
                                <div className="px-5 py-2 bg-blue-200 text-gray-700 rounded-lg font-medium text-sm border-2 border-blue-400 cursor-default">
                                  <TranslatedText
                                    text={model.text}
                                    sourceDoc={product}
                                    fieldName="selfAvailableModelText"
                                  />
                                </div>
                              ) : (
                                <Link
                                  to={getLocalizedPath(`/product/${encodeURIComponent(model.slug)}`)}
                                  className="block px-5 py-2 bg-white text-gray-700 rounded-lg font-medium text-sm border border-gray-400 hover:bg-blue-100 hover:border-blue-400 transition-all duration-200"
                                >
                                  <TranslatedText
                                    text={model.text}
                                    sourceDoc={matchingModel}
                                    fieldName="variationText"
                                  />
                                </Link>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                  <p className="mt-3 text-xs text-stone-500">
                    <TranslatedText>Click on any model to view its details</TranslatedText>
                  </p>
                </div>
              )}


                  {/* Key Features */}
              {keyFeaturesContent && (
                <div className="mb-6">
                  <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-stone-500"><TranslatedText>Key Features</TranslatedText></h3>
                  <div className="prose prose-sm md:prose-base max-w-none leading-relaxed text-stone-700">
                  <TranslatedTipTapRenderer 
                    content={keyFeaturesContent}
                    sourceDoc={product} 
                    fieldName={keyFeaturesFieldName}
                  />
                </div>
                </div>
              )}
              {/* Delivery promise. This is where the reference layout puts its
                  instalment row -- we sell in Pakistan, so it carries the delivery
                  promise instead. */}
              <button
                type="button"
                onClick={() => navigate(getLocalizedPath('/delivery-terms'))}
                className="mb-5 flex w-full items-center gap-3 bg-stone-100 px-4 py-4 text-left transition-colors hover:bg-stone-200/70"
              >
                <Truck className="flex-shrink-0 text-stone-700" size={22} strokeWidth={1.4} />
                <span className="text-sm text-stone-800">
                  <TranslatedText>Free standard delivery nationwide, with cash on delivery available</TranslatedText>
                </span>
              </button>

              {/* Quantity, saving, and the buy actions.

                  The two buy buttons are desktop-only: on a phone they live in the
                  sticky bar pinned to the bottom of the screen, so showing them here
                  as well put two identical Add to Bag buttons a thumb apart.

                  The wishlist heart used to be a 56px block welded to the side of Add
                  to Bag, which read as a second primary action. It is a secondary one,
                  so it now sits at the other end of the quantity row. */}
              <div className="mb-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {!isEffectiveOutOfStock() ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs uppercase tracking-[0.14em] text-stone-500">
                        <TranslatedText>Quantity</TranslatedText>
                      </span>
                      <div className="flex items-center border border-stone-300">
                        <button
                          onClick={() => handleQuantityChange(-1)}
                          className="px-3 py-2 text-stone-600 transition-colors hover:text-black disabled:opacity-40"
                          disabled={quantity === "" || quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          value={quantity}
                          onChange={handleQuantityInput}
                          onBlur={handleQuantityBlur}
                          onKeyDown={handleQuantityKeyDown}
                          aria-label="Quantity"
                          className="w-12 border-l border-r border-stone-300 bg-transparent py-2 text-center text-sm focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          min="1"
                          max={getMaxQuantity()}
                        />
                        <button
                          onClick={() => {
                            const maxQ = getMaxQuantity()
                            if (quantity !== "" && quantity >= maxQ) {
                              const cur = getCurrentSize()
                              showToast(cur ? `Only ${maxQ} units are available in size ${cur.code || cur.name}.` : `Only ${maxQ} units are available.`, "error")
                              return
                            }
                            handleQuantityChange(1)
                          }}
                          className="px-3 py-2 text-stone-600 transition-colors hover:text-black disabled:opacity-40"
                          disabled={quantity !== "" && quantity >= getMaxQuantity()}
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-rose-600 inline-block animate-pulse"></span>
                      <TranslatedText>Currently Sold Out</TranslatedText>
                    </div>
                  )}

                  <button
                    onClick={() => (isInWishlist(product._id) ? removeFromWishlist(product._id) : addToWishlist(product))}
                    className="flex items-center gap-2 border border-stone-300 px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-stone-700 transition-colors hover:border-stone-900 hover:text-stone-900"
                    aria-label={isInWishlist(product._id) ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    <Heart
                      size={16}
                      strokeWidth={1.6}
                      className={isInWishlist(product._id) ? "fill-brand-600 text-brand-600" : "text-stone-700"}
                    />
                    {isInWishlist(product._id) ? (
                      <TranslatedText>Saved</TranslatedText>
                    ) : (
                      <TranslatedText>Save</TranslatedText>
                    )}
                  </button>
                </div>

                {isEffectiveOutOfStock() ? (
                  <div className="w-full space-y-3 pt-1">
                    {isSubscribedToStock ? (
                      <div className="w-full flex items-center justify-between gap-2 py-3.5 px-4 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold uppercase tracking-[0.12em]">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
                          <span className="truncate">
                            <TranslatedText>
                              {getCurrentSize()
                                ? `Alert Active for Size ${getCurrentSize().code || getCurrentSize().name}`
                                : "Alert Active — We'll Email You"}
                            </TranslatedText>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowStockSubModal(true)}
                          className="text-[11px] underline text-emerald-700 hover:text-emerald-900 tracking-normal capitalize flex-shrink-0 cursor-pointer font-medium"
                          title="Change alert email"
                        >
                          <TranslatedText>Change email</TranslatedText>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowStockSubModal(true)}
                        disabled={stockSubLoading}
                        className="w-full flex items-center justify-center gap-2.5 bg-footer-bg hover:bg-stone-800 text-white px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
                      >
                        {stockSubLoading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Bell size={16} className="text-amber-300" />
                        )}
                        <TranslatedText>
                          {getCurrentSize()
                            ? `Remind Me When Size ${getCurrentSize().code || getCurrentSize().name} is Available`
                            : "Remind Me When Available"}
                        </TranslatedText>
                      </button>
                    )}
                    <p className="text-center text-[11px] text-stone-500 font-medium">
                      <TranslatedText>
                        {isSubscribedToStock
                          ? `We will notify you at ${stockSubEmail || user?.email || "your email"} as soon as ${
                              getCurrentSize() ? `Size ${getCurrentSize().code || getCurrentSize().name}` : "this item"
                            } is restocked.`
                          : getCurrentSize()
                          ? `Size ${getCurrentSize().code || getCurrentSize().name} is currently out of stock. Activate alert to get an instant email when restocked.`
                          : "This item is currently out of stock. Activate alert to get an instant email when restocked."}
                      </TranslatedText>
                    </p>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleAddToCart}
                      disabled={isEffectiveOutOfStock()}
                      className="hidden w-full items-center justify-center gap-2 bg-footer-bg px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 lg:flex"
                    >
                      <ShoppingCart size={18} strokeWidth={1.6} />
                      <TranslatedText>Add to Bag</TranslatedText>
                    </button>

                    <button
                      disabled={isEffectiveOutOfStock()}
                      className="hidden w-full border border-stone-900 px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:text-stone-400 disabled:hover:bg-transparent disabled:hover:text-stone-400 lg:block"
                      onClick={handleBuyNow}
                    >
                      <TranslatedText>Buy Now</TranslatedText>
                    </button>
                  </>
                )}
              </div>

              {/* Added-to-bag confirmation, desktop. On a phone the sticky bar below
                  turns into this instead -- a panel up here would be off-screen by the
                  time the shopper has reached the button at the bottom. */}
              {justAdded && (
                <div className="mb-5 hidden items-start gap-3 border border-brand-600/40 bg-brand-50 px-4 py-4 lg:flex">
                  <CheckCircle size={20} strokeWidth={1.6} className="mt-0.5 flex-shrink-0 text-brand-700" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-stone-900">
                      <TranslatedText>Added to your bag</TranslatedText>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-600">{product.name}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={openCart}
                        className="border border-stone-900 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
                      >
                        <TranslatedText>View bag</TranslatedText>
                      </button>
                      <button
                        onClick={handleCheckoutClick}
                        className="bg-footer-bg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-brand-700"
                      >
                        <TranslatedText>Checkout</TranslatedText>
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setJustAdded(false)}
                    className="flex-shrink-0 text-stone-400 transition-colors hover:text-stone-900"
                    aria-label="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Quick actions */}
              <div className="mb-8 grid grid-cols-3 gap-2 border-y border-stone-200 py-4 text-center">
                <button
                  className="group flex flex-col items-center gap-2 px-1"
                  onClick={handleWhatsAppChat}
                >
                  <MessageCircle size={20} strokeWidth={1.4} className="text-stone-700 transition-colors group-hover:text-brand-600" />
                  <span className="text-[11px] uppercase tracking-[0.1em] text-stone-700 transition-colors group-hover:text-brand-600">
                    <TranslatedText>Chat With Specialist</TranslatedText>
                  </span>
                </button>
                <button
                  className="group flex flex-col items-center gap-2 border-x border-stone-200 px-1"
                  onClick={() => setShowCallbackModal(true)}
                >
                  <Phone size={20} strokeWidth={1.4} className="text-stone-700 transition-colors group-hover:text-brand-600" />
                  <span className="text-[11px] uppercase tracking-[0.1em] text-stone-700 transition-colors group-hover:text-brand-600">
                    <TranslatedText>Request a Callback</TranslatedText>
                  </span>
                </button>
                <button
                  type="button"
                  className="group flex flex-col items-center gap-2 px-1"
                  onClick={() => navigate(getLocalizedPath("/bulk-purchase"))}
                >
                  <Shield size={20} strokeWidth={1.4} className="text-stone-700 transition-colors group-hover:text-brand-600" />
                  <span className="text-[11px] uppercase tracking-[0.1em] text-stone-700 transition-colors group-hover:text-brand-600">
                    <TranslatedText>Request Bulk Purchase</TranslatedText>
                  </span>
                </button>
              </div>

              {/* Protect Your Purchase - only when plans exist, and kept out of the
                  accordions because it changes what goes in the cart. */}
              {hasProtectionPlans && (
                <div className="mb-8 border border-stone-200 p-4">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-stone-900">
                    <Shield className="text-brand-600" size={18} strokeWidth={1.6} />
                    <TranslatedText>Protect Your Purchase</TranslatedText>
                  </h3>
                  <BuyerProtectionSection
                    productId={product._id}
                    productPrice={product.salePrice || product.price}
                    onSelectProtection={setSelectedProtections}
                    selectedProtections={selectedProtections}
                  />
                </div>
              )}

              {/* Hidden loader to check for protection plans availability */}
              {!hasProtectionPlans && (
                <BuyerProtectionSection
                  productId={product._id}
                  productPrice={product.salePrice || product.price}
                  onSelectProtection={setSelectedProtections}
                  selectedProtections={selectedProtections}
                  onProtectionsLoaded={setHasProtectionPlans}
                />
              )}

              {/* Product Details accordions */}
              <h2 className="mb-1 text-lg font-semibold text-stone-900">
                <TranslatedText>Product Details</TranslatedText>
              </h2>
              <div className="border-t border-stone-200">
                <PdpAccordion title="Item Information" defaultOpen>
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      <tr>
                        <td className="w-2/5 py-2 pr-3 align-top text-stone-500">
                          <TranslatedText>Brand</TranslatedText>
                        </td>
                        <td className="py-2 align-top text-stone-800">
                          <TranslatedText text={product.brand?.name || product.brand || "N/A"}>
                            {product.brand?.name || product.brand || "N/A"}
                          </TranslatedText>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-3 align-top text-stone-500">
                          <TranslatedText>Model Number</TranslatedText>
                        </td>
                        <td className="py-2 align-top text-stone-800">{product.sku || "N/A"}</td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-3 align-top text-stone-500">
                          <TranslatedText>Category</TranslatedText>
                        </td>
                        <td className="py-2 align-top text-stone-800">
                          <TranslatedText text={product.category?.name || product.category || "N/A"}>
                            {product.category?.name || product.category || "N/A"}
                          </TranslatedText>
                        </td>
                      </tr>
                      {product.warranty && (
                        <tr>
                          <td className="py-2 pr-3 align-top text-stone-500">
                            <TranslatedText>Warranty</TranslatedText>
                          </td>
                          <td className="py-2 align-top text-stone-800">
                            <TranslatedText text={product.warranty}>{product.warranty}</TranslatedText>
                          </td>
                        </tr>
                      )}
                      {product.specifications?.map((spec, index) => (
                        <tr key={index}>
                          <td className="py-2 pr-3 align-top text-stone-500">
                            <TranslatedText text={spec.key}>{spec.key}</TranslatedText>
                          </td>
                          <td className="py-2 align-top text-stone-800">
                            <TranslatedText text={spec.value}>{spec.value}</TranslatedText>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PdpAccordion>

                <PdpAccordion title="Delivery & Return Policy">
                  <div className="space-y-4 text-sm text-stone-700">
                    <div>
                      <h4 className="mb-1 font-semibold text-stone-900">
                        <TranslatedText>Delivery</TranslatedText>
                      </h4>
                      <ul className="list-disc space-y-1 pl-4">
                        <li><TranslatedText>Free shipping is available on all orders for a limited period.</TranslatedText></li>
                        <li><TranslatedText>Standard delivery takes 2-4 business days across Pakistan.</TranslatedText></li>
                        <li><TranslatedText>Deliveries to remote areas may require an additional 1-2 business days.</TranslatedText></li>
                        <li><TranslatedText>Cash on delivery is available nationwide.</TranslatedText></li>
                      </ul>
                      <button
                        type="button"
                        onClick={() => navigate(getLocalizedPath('/delivery-terms'))}
                        className="mt-2 text-xs uppercase tracking-[0.12em] text-stone-900 underline underline-offset-4"
                      >
                        <TranslatedText>Full delivery terms</TranslatedText>
                      </button>
                    </div>
                    <div>
                      <h4 className="mb-1 font-semibold text-stone-900">
                        <TranslatedText>Returns & Refunds</TranslatedText>
                      </h4>
                      <p>
                        <TranslatedText>Irhaas offers a 7-day return policy. Customers may request a return or refund if the received product is different from the product description, defective, or damaged.</TranslatedText>
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate(getLocalizedPath('/refund-return'))}
                        className="mt-2 text-xs uppercase tracking-[0.12em] text-stone-900 underline underline-offset-4"
                      >
                        <TranslatedText>Return policy</TranslatedText>
                      </button>
                    </div>
                    <div>
                      <h4 className="mb-1 flex items-center gap-2 font-semibold text-stone-900">
                        <Award size={16} strokeWidth={1.6} />
                        <TranslatedText>Warranty Information</TranslatedText>
                      </h4>
                      <p>
                        <TranslatedText text={product.warranty || "Standard warranty applies as per manufacturer terms"}>
                          {product.warranty || "Standard warranty applies as per manufacturer terms"}
                        </TranslatedText>
                      </p>
                    </div>
                  </div>
                </PdpAccordion>

                <PdpAccordion title="Offers & Payment">
                  <div className="space-y-5 text-sm text-stone-700">
                    <div>
                      <h4 className="mb-1 font-semibold text-stone-900">
                        <TranslatedText>Get My Coupon</TranslatedText>
                      </h4>
                      <p className="mb-3">
                        <TranslatedText>Looking for offers and discounts? Open the coupon list to see everything available right now.</TranslatedText>
                      </p>
                      <button
                        type="button"
                        className="border border-stone-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
                        onClick={handleOpenCouponsModal}
                      >
                        <TranslatedText>Get Coupons</TranslatedText>
                      </button>
                    </div>
                    <div>
                      <h4 className="mb-2 font-semibold text-stone-900">
                        <TranslatedText>Payment Methods</TranslatedText>
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {["Cash on Delivery", "Visa", "Mastercard", "Bank Transfer"].map((method) => (
                          <span
                            key={method}
                            className="border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-stone-700"
                          >
                            <TranslatedText>{method}</TranslatedText>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </PdpAccordion>
              </div>
            </div>
          </div>
        </div>

        {/* Add Frequently Bought Together Section Here */}
        <FrequentlyBoughtTogether />

        {/* Description */}
        {product.description && (
          <section className="mt-14 border-t border-stone-200 pt-10">
            <h2 className="mb-5 text-base font-semibold uppercase tracking-[0.14em] text-stone-900">
              <TranslatedText>Description</TranslatedText>
            </h2>
            <div className="prose prose-sm md:prose-base max-w-3xl text-stone-700">
              <TranslatedTipTapRenderer content={product.description} sourceDoc={product} fieldName="description" />
            </div>
          </section>
        )}

        {/* Reviews */}
        <section className="mt-14 border-t border-stone-200 pt-10" data-review-section>
          <h2 className="mb-5 text-base font-semibold uppercase tracking-[0.14em] text-stone-900">
            <TranslatedText>Reviews</TranslatedText> ({reviewStats.totalReviews || 0})
          </h2>
          <ReviewSection productId={product._id} onStatsUpdate={setReviewStats} />
        </section>












































































        {/* More Like This */}
        <section className="mt-14">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-base font-semibold uppercase tracking-[0.14em] text-stone-900">
              <TranslatedText>More Like This</TranslatedText>
            </h2>
            {!relatedLoading && relatedProducts.length > 0 && (
              <span className="text-xs text-stone-500">
                {Math.min(relatedProducts.length, 8)} <TranslatedText>items</TranslatedText>
              </span>
            )}
          </div>

          {relatedLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="aspect-[3/4] w-full animate-pulse bg-stone-100" />
                  <div className="mt-3 h-4 w-3/4 animate-pulse bg-stone-100" />
                  <div className="mt-2 h-4 w-1/3 animate-pulse bg-stone-100" />
                </div>
              ))}
            </div>
          ) : relatedProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {shuffledRelated
                .map((relatedProduct) => {
                  const base = Number(relatedProduct.price) || 0
                  const offer = Number(relatedProduct.offerPrice) || 0
                  const buying = Number(relatedProduct.buyingPrice) || 0
                  const onOffer = offer > 0 && base > 0 && offer < base
                  const sellingPrice = onOffer ? offer : base
                  const crossedPrice = buying > 0 ? buying : (onOffer ? base : 0)
                  const showCrossed = crossedPrice > 0
                  const discountPct = onOffer
                    ? Math.round(((base - offer) / base) * 100)
                    : (buying > 0 && sellingPrice > 0 && buying > sellingPrice
                      ? Math.round(((buying - sellingPrice) / buying) * 100)
                      : 0)

                  return (
                    <Link
                      key={relatedProduct._id}
                      to={getLocalizedPath(`/product/${encodeURIComponent(relatedProduct.slug || relatedProduct._id)}`)}
                      className="group"
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#efece7]">
                        <img
                          src={getOptimizedImageUrl(relatedProduct.image, { width: 400, quality: 72 }) || "/placeholder.svg?height=400&width=300"}
                          alt={relatedProduct.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                        {discountPct > 0 && (
                          <span className="absolute left-3 top-3 bg-brand-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                            {discountPct}% <TranslatedText>off</TranslatedText>
                          </span>
                        )}

                        {/* Quick add -- same control as the rails, so the card behaves the
                            same wherever it appears. Nested in a Link, hence the two stops. */}
                        {relatedProduct.stockStatus !== "Out of Stock" &&
                          Number(relatedProduct.countInStock) !== 0 && (
                            <button
                              type="button"
                              aria-label={`Add ${relatedProduct.name} to cart`}
                              title="Add to cart"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                addToCart(relatedProduct, 1)
                              }}
                              className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-900 shadow-md transition hover:bg-footer-bg hover:text-white md:opacity-0 md:group-hover:opacity-100"
                            >
                              <Plus size={18} strokeWidth={1.8} />
                            </button>
                          )}
                      </div>
                      <h3 className="mt-3 line-clamp-2 text-sm font-medium text-stone-900 group-hover:underline">
                        <TranslatedText text={relatedProduct.name}>{relatedProduct.name}</TranslatedText>
                      </h3>
                      <p className="mt-1 flex items-baseline gap-2 text-sm">
                        <span className="font-semibold text-stone-900">{formatPrice(sellingPrice)}</span>
                        {showCrossed && <span className="text-xs text-stone-400 line-through">{formatPrice(crossedPrice)}</span>}
                      </p>
                    </Link>
                  )
                })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-stone-500">
              <TranslatedText>No related products found. Check back later for more recommendations.</TranslatedText>
            </p>
          )}
        </section>
      </div>

      {/* You May Also Like -- outside the padded container, so the rail can run
          to the edge of the page gutter rather than stopping short of it. */}
      <FeaturedProducts title="You May Also Like" limit={12} viewAllHref="/shop" />

      {/* ADD ONLY THIS LINE */}
      <ProductSchema product={product} price={merchantPrice} />

      {/* Video Modal */}
      {showVideoModal && product?.video && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowVideoModal(false)
            }
          }}
        >
          <div className="relative w-[85vw] max-w-3xl">
            {/* Close Button */}
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors z-10"
            >
              <X size={28} />
            </button>
            
            {/* Video Container */}
            <div className="aspect-video w-full bg-black rounded-lg overflow-hidden shadow-2xl">
              {isYouTubeUrl(product.video) ? (
                <iframe
                  src={`${getYouTubeEmbedUrl(product.video)}?autoplay=1`}
                  title="Product Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              ) : (
                <video
                  src={getFullImageUrl(product.video)}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                  poster={getFullImageUrl(product.image)}
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
            
            {/* Product Name */}
            <div className="mt-3 text-center">
              <h3 className="text-white text-base font-medium">{product.name}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowImageModal(false)
              setIsImageZoomed(false)
            }
          }}
        >
          <div className="relative flex h-[90vh] w-[90vw] max-w-7xl bg-white rounded-lg overflow-hidden">
            {/* Sidebar with all images/videos (vertical on desktop, horizontal on mobile) */}
            <div className="hidden md:block w-64 bg-gray-100 p-4 overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">All Media</h3>
              <div className="space-y-2">
                {productImages.map((media, index) => (
                  <div
                    key={index}
                    className={`relative cursor-pointer border-2 rounded-lg overflow-hidden ${
                      index === modalImageIndex ? "border-lime-500" : "border-gray-300"
                    }`}
                    onClick={() => {
                      setModalImageIndex(index)
                      setIsImageZoomed(false)
                    }}
                  >
                    {media?.type === 'video' ? (
                      <>
                        {isYouTubeUrl(media.url) ? (
                          <img
                            src={`https://img.youtube.com/vi/${media.url.includes('youtu.be/') 
                              ? media.url.split('youtu.be/')[1]?.split('?')[0] 
                              : media.url.split('v=')[1]?.split('&')[0]}/mqdefault.jpg`}
                            alt="YouTube video thumbnail"
                            className="w-full h-24 object-cover"
                          />
                        ) : (
                          <video
                            src={getFullImageUrl(media.url)}
                            className="w-full h-24 object-cover"
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <img
                        src={getOptimizedImageUrl(media?.url, { width: 150, height: 150, quality: 70 }) || "/placeholder.svg?height=150&width=150"}
                        alt={`${product.name} ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-24 object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Horizontal thumbnails for mobile */}
            <div className="md:hidden absolute bottom-0 left-0 w-full bg-gray-100 p-2 flex space-x-2 overflow-x-auto z-10">
              {productImages.map((media, index) => (
                <div
                  key={index}
                  className={`relative flex-shrink-0 w-16 h-16 border-2 rounded-lg overflow-hidden ${
                    index === modalImageIndex ? "border-lime-500" : "border-gray-300"
                  }`}
                  onClick={() => {
                    setModalImageIndex(index)
                    setIsImageZoomed(false)
                  }}
                >
                  {media?.type === 'video' ? (
                    <>
                      {isYouTubeUrl(media.url) ? (
                        <img
                          src={`https://img.youtube.com/vi/${media.url.includes('youtu.be/') 
                            ? media.url.split('youtu.be/')[1]?.split('?')[0] 
                            : media.url.split('v=')[1]?.split('&')[0]}/mqdefault.jpg`}
                          alt="YouTube video thumbnail"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={getFullImageUrl(media.url)}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <img
                      src={getOptimizedImageUrl(media?.url, { width: 120, height: 120, quality: 70 }) || "/placeholder.svg?height=64&width=64"}
                      alt={`${product.name} ${index + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Main media area */}
            <div className="flex-1 flex items-center justify-center relative">
              {productImages[modalImageIndex]?.type === 'video' ? (
                isYouTubeUrl(productImages[modalImageIndex]?.url) ? (
                  <iframe
                    key={modalImageIndex}
                    src={getYouTubeEmbedUrl(productImages[modalImageIndex]?.url)}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full max-w-4xl max-h-[80vh]"
                  ></iframe>
                ) : (
                  <video
                    key={modalImageIndex}
                    src={getFullImageUrl(productImages[modalImageIndex]?.url) || ""}
                    controls
                    autoPlay
                    className="max-h-full max-w-full object-contain bg-white"
                    poster={getFullImageUrl(product.image)}
                  >
                    Your browser does not support the video tag.
                  </video>
                )
              ) : (
                <img
                  src={getFullImageUrl(productImages[modalImageIndex]?.url) || "/placeholder.svg?height=600&width=600"}
                  alt={product.name}
                  className={`object-contain bg-white cursor-pointer transition-transform duration-300 ${
                    isImageZoomed ? "max-h-none max-w-none scale-150" : "max-h-full max-w-full"
                  }`}
                  style={{
                    transformOrigin: isImageZoomed ? `${mousePosition.x}% ${mousePosition.y}%` : "center",
                  }}
                  onClick={(e) => {
                    if (!isImageZoomed) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = ((e.clientX - rect.left) / rect.width) * 100
                      const y = ((e.clientY - rect.top) / rect.height) * 100
                      setMousePosition({ x, y })
                    }
                    setIsImageZoomed(!isImageZoomed)
                  }}
                  onMouseMove={(e) => {
                    if (isImageZoomed) {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = ((e.clientX - rect.left) / rect.width) * 100
                      const y = ((e.clientY - rect.top) / rect.height) * 100
                      setMousePosition({ x, y })
                    }
                  }}
                />
              )}

              {/* Navigation arrows */}
              <button
                onClick={() => setModalImageIndex((prev) => (prev > 0 ? prev - 1 : productImages.length - 1))}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => setModalImageIndex((prev) => (prev < productImages.length - 1 ? prev + 1 : 0))}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75"
              >
                <ChevronRight size={24} />
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={() => {
                setShowImageModal(false)
                setIsImageZoomed(false)
              }}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Float Button */}
      {/* <div className="fixed bottom-6 right-6 z-40">
        <button className="bg-green-500 text-white p-3 rounded-full shadow-lg hover:bg-green-600 transition-colors">
          <MessageCircle size={4} />
        </button>
      </div> */}

      {showCallbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              onClick={() => {
                setShowCallbackModal(false)
                setEmailChanged(false)
                setVerificationCode("")
                setVerificationSent(false)
                setVerificationVerified(false)
              }}
            >
              <X size={24} />
            </button>
            <div className="flex flex-col gap-4">
              <h2 className="text-xl text-center font-bold mb-2">Request a Callback</h2>
              {callbackSuccess ? (
                <div className="text-green-600 font-medium text-center py-8 flex flex-col items-center gap-2">
                  <CheckCircle size={48} className="text-green-500" />
                  <p>Request submitted successfully!</p>
                  <p className="text-sm text-gray-600">We will contact you soon.</p>
                </div>
              ) : (
                <form onSubmit={handleCallbackSubmit} className="space-y-4">
                  {/* Full Name Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <div className="flex items-center gap-3">
                      <div className="text-lime-600">
                        <User size={24} />
                      </div>
                      <input
                        type="text"
                        name="name"
                        value={callbackForm.name}
                        onChange={handleCallbackChange}
                        className="flex-1 py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-500"
                        placeholder="Enter your full name"
                        required
                      />
                    </div>
                  </div>

                  {/* Email Field with Verification */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <div className="flex items-center gap-3">
                      <div className="text-lime-600">
                        <Mail size={24} />
                      </div>
                      <div className="flex-1">
                        <input
                          type="email"
                          name="email"
                          value={callbackForm.email}
                          onChange={handleCallbackChange}
                          className="w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-500"
                          placeholder="Enter your email"
                          required
                        />
                      </div>
                      {verificationVerified && (
                        <CheckCircle size={24} className="text-green-500" />
                      )}
                    </div>
                    
                    {/* Email Verification Section */}
                    {emailChanged && !verificationVerified && (
                      <div className="mt-3 ml-9 space-y-3">
                        {!verificationSent ? (
                          <button
                            type="button"
                            onClick={handleSendVerificationCode}
                            disabled={verificationLoading}
                            className="text-sm bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
                          >
                            {verificationLoading ? "Sending..." : "Send Verification Code"}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-600">Enter the verification code sent to your email:</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                className="flex-1 py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-500"
                                placeholder="Enter 6-digit code"
                                maxLength={6}
                              />
                              <button
                                type="button"
                                onClick={handleVerifyCode}
                                disabled={verificationLoading || verificationCode.length !== 6}
                                className="bg-lime-500 text-white px-4 py-2 rounded-md hover:bg-lime-600 disabled:opacity-50"
                              >
                                {verificationLoading ? "..." : "Verify"}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={handleSendVerificationCode}
                              disabled={verificationLoading}
                              className="text-sm text-blue-500 hover:underline"
                            >
                              Resend Code
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Phone Number with Country Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <div className="flex items-center gap-3">
                      <div className="text-lime-600">
                        <Phone size={24} />
                      </div>
                      <PhoneInput
                        international
                        defaultCountry="PK"
                        value={phoneValue}
                        onChange={setPhoneValue}
                        className="flex-1"
                        placeholder="Enter phone number"
                        required
                      />
                    </div>
                  </div>

                  {/* Customer Note */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Customer Note (Optional)</label>
                    <textarea
                      name="customerNote"
                      value={callbackForm.customerNote}
                      onChange={handleCallbackChange}
                      rows={4}
                      className="w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-500"
                      placeholder="Any specific requirements or questions..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-lime-500 text-white py-3 rounded-md font-medium hover:bg-lime-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={callbackLoading || (emailChanged && !verificationVerified)}
                  >
                    {callbackLoading ? "Submitting..." : "Submit Request"}
                  </button>
                  
                  {emailChanged && !verificationVerified && (
                    <p className="text-sm text-red-500 text-center">
                      Please verify your email before submitting
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Coupons Modal */}
      {showCouponsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-lg relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={handleCloseCouponsModal}
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-4 text-center">Available Coupons</h2>
            {loadingCoupons ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-500"></div>
              </div>
            ) : couponError ? (
              <div className="text-red-500 text-center">{couponError}</div>
            ) : publicCoupons.length === 0 ? (
              <div className="text-gray-500 text-center">No coupons available at the moment.</div>
            ) : (
              <div className="space-y-4">
                {publicCoupons.map((coupon, idx) => {
                  const color = COUPON_COLORS[idx % COUPON_COLORS.length]
                  const categories =
                    coupon.categories && coupon.categories.length > 0
                      ? coupon.categories.map((cat) => cat.name || cat).join(", ")
                      : "All Categories"
                  return (
                    <div key={coupon._id} className="relative flex items-center w-full">
                      {/* Ticket Style - Horizontal Layout */}
                      <div
                        className={`w-full flex shadow-md relative overflow-visible transition-all duration-500 ease-out opacity-0 translate-y-8 animate-fadeInUp ${color.border}`}
                        style={{ minHeight: 100, animationDelay: `${idx * 80}ms`, animationFillMode: "forwards" }}
                      >
                        {/* Left stub - Compact */}
                        <div
                          className={`flex flex-col items-center justify-center py-2 px-2 ${color.stub} border-l-2 border-t-2 border-b-2 ${color.border} rounded-l-lg relative`}
                          style={{ minWidth: 60 }}
                        >
                          <span
                            className="text-[8px] font-bold tracking-widest text-gray-700 rotate-180"
                            style={{ writingMode: "vertical-rl" }}
                          >
                            DISCOUNT
                          </span>
                          {/* Barcode effect - Smaller */}
                          <div
                            className={`w-4 h-6 mt-1 flex flex-col justify-between ${color.barcode}`}
                            style={{ borderRadius: 2 }}
                          >
                            {[...Array(5)].map((_, i) => (
                              <div
                                key={i}
                                className={`h-0.5 ${i % 2 === 0 ? "bg-gray-700" : "bg-gray-400"} w-full rounded`}
                              ></div>
                            ))}
                          </div>
                        </div>
                        {/* Main ticket - Responsive Layout */}
                        <div
                          className={`flex-1 ${color.main} border-r-2 border-t-2 border-b-2 ${color.border} rounded-r-lg p-3 flex flex-col md:flex-row md:items-center relative overflow-hidden`}
                        >
                          {/* Cut edges */}
                          <div
                            className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border-2 ${color.border}`}
                          ></div>
                          <div
                            className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full border-2 ${color.border}`}
                          ></div>

                          {/* Mobile: Vertical Layout, Desktop: Horizontal Layout */}
                          <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-4 flex-1">
                            {/* Discount Info */}
                            <div className="flex items-center justify-between md:flex-col md:items-center md:justify-center">
                              <span className="text-xs font-semibold text-gray-500 tracking-widest">GIFT COUPON</span>
                              <span className={`text-xl font-bold flex items-center ${color.text}`}>
                                {coupon.discountType === "percentage" && <Percent className="w-4 h-4 mr-1" />}
                                {coupon.discountType === "percentage"
                                  ? `${coupon.discountValue}`
                                  : formatCurrencyPrice(coupon.discountValue, isArabic)}
                              </span>
                            </div>

                            {/* Promo Code */}
                            <div className="flex flex-col items-center flex-1">
                              <span className="block text-sm font-bold text-gray-900 mb-2">PROMO CODE</span>
                              <div className="flex items-center w-full justify-center">
                                <span
                                  className={`inline-block bg-white border ${color.border} rounded px-3 py-1 font-mono text-sm font-bold ${color.text} tracking-widest`}
                                >
                                  {coupon.code}
                                </span>
                                <button
                                  className={`ml-2 px-2 py-1 text-xs ${color.stub} hover:brightness-110 text-black rounded transition-colors font-semibold border ${color.border} focus:outline-none focus:ring-2 focus:ring-yellow-300`}
                                  onClick={() => handleCopyCoupon(coupon.code, coupon._id)}
                                >
                                  {couponCopied === coupon._id ? "Copied!" : "Copy"}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Details - Mobile: Full width, Desktop: Right aligned */}
                          <div className="flex flex-col md:items-end text-left md:text-right space-y-1 mt-3 md:mt-0">
                            <div className="text-xs text-gray-600 md:max-w-xs">{coupon.description}</div>
                            <div className="flex flex-col md:items-end space-y-1">
                              <div className="text-xs text-gray-500">Min: {formatCurrencyPrice(coupon.minOrderAmount || 0, isArabic)}</div>
                              <div className="text-xs text-gray-500">
                                Valid: {new Date(coupon.validFrom).toLocaleDateString()} -{" "}
                                {new Date(coupon.validUntil).toLocaleDateString()}
                              </div>
                              <div className="text-xs font-semibold text-gray-700">{categories}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <style>{`
              @keyframes fadeInUp {
                0% { opacity: 0; transform: translateY(32px); }
                100% { opacity: 1; transform: translateY(0); }
              }
              .animate-fadeInUp {
                animation: fadeInUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) both;
              }
            `}</style>
          </div>
        </div>
      )}

      {/* Phone: Add to Bag and Buy Now pinned within reach.

          This page is long -- images, description, specification, reviews -- and the
          buy buttons sat at the top of it, so a shopper who read to the bottom had to
          scroll all the way back up to buy. The bar sits above the bottom navigation,
          and the WhatsApp bubble lifts itself clear of it (see Layout).

          After an add it becomes the confirmation, so the acknowledgement appears
          where the thumb already is rather than somewhere up the page. */}
      <div className="lg:hidden fixed inset-x-0 bottom-[72px] md:bottom-0 z-30 border-t border-stone-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur">
        {justAdded ? (
          <div className="mx-auto flex max-w-[1360px] items-center gap-3">
            <CheckCircle size={20} strokeWidth={1.6} className="flex-shrink-0 text-brand-700" />
            <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-[0.12em] text-stone-900">
              <TranslatedText>Added to your bag</TranslatedText>
            </p>
            <button
              onClick={openCart}
              className="flex-shrink-0 border border-stone-900 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-900"
            >
              <TranslatedText>View bag</TranslatedText>
            </button>
            <button
              onClick={handleCheckoutClick}
              className="flex-shrink-0 bg-footer-bg px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              <TranslatedText>Checkout</TranslatedText>
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[1360px] items-center gap-2">
            <div className="min-w-0 flex-shrink">
              <p className="text-[10px] uppercase tracking-[0.12em] text-stone-500">
                <TranslatedText>Total</TranslatedText>
              </p>
              <p className="text-sm font-bold leading-tight text-stone-900">
                {formatPrice(getEffectivePrice() * ((quantity === "" || isNaN(quantity) || quantity < 1) ? 1 : quantity))}
              </p>
            </div>
            {isEffectiveOutOfStock() ? (
              isSubscribedToStock ? (
                <div
                  onClick={() => setShowStockSubModal(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 border border-emerald-300 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-900 text-center cursor-pointer"
                  title="Click to change email"
                >
                  <CheckCircle size={15} className="text-emerald-600 flex-shrink-0" />
                  <span>
                    <TranslatedText>
                      {getCurrentSize()
                        ? `Alert Active (${getCurrentSize().code || getCurrentSize().name})`
                        : "We'll Email You"}
                    </TranslatedText>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowStockSubModal(true)}
                  disabled={stockSubLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-footer-bg px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-60 cursor-pointer"
                >
                  {stockSubLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Bell size={15} className="text-amber-300" />
                  )}
                  <TranslatedText>
                    {getCurrentSize()
                      ? `Remind Me (${getCurrentSize().code || getCurrentSize().name})`
                      : "Remind Me When Available"}
                  </TranslatedText>
                </button>
              )
            ) : (
              <>
                <button
                  onClick={handleAddToCart}
                  disabled={isEffectiveOutOfStock()}
                  className="flex flex-1 items-center justify-center gap-1.5 border border-stone-900 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-900 disabled:cursor-not-allowed disabled:border-stone-300 disabled:text-stone-400"
                >
                  <ShoppingCart size={15} strokeWidth={1.8} />
                  <TranslatedText>Add to Bag</TranslatedText>
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={isEffectiveOutOfStock()}
                  className="flex-1 bg-footer-bg px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
                >
                  <TranslatedText>Buy Now</TranslatedText>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Back In Stock Notification Modal */}
      {showStockSubModal && product && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowStockSubModal(false)
          }}
        >
          <div className="relative w-full max-w-md bg-white p-6 sm:p-8 shadow-2xl border border-stone-200">
            <button
              type="button"
              onClick={() => setShowStockSubModal(false)}
              className="absolute right-4 top-4 text-stone-400 hover:text-stone-700 transition"
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900">
                  <TranslatedText>Remind Me When Available</TranslatedText>
                </h3>
                <p className="text-xs text-stone-500">
                  <TranslatedText>Irha's Wardrobe Restock Alert</TranslatedText>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 mb-5">
              {product.image && (
                <img
                  src={getFullImageUrl(product.image)}
                  alt={product.name}
                  className="w-12 h-14 object-cover border border-stone-200 flex-shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-semibold text-stone-900 truncate">{product.name}</h4>
                <div className="text-xs font-bold text-brand-700 mt-0.5">
                  {formatCurrencyPrice ? formatCurrencyPrice(getEffectivePrice()) : `${getEffectivePrice()} Rs`}
                </div>
                {getCurrentSize() && (
                  <span className="inline-block mt-1 text-[10px] font-medium bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded">
                    Size: {getCurrentSize().code || getCurrentSize().name}
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleSubscribeStock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1.5">
                  <TranslatedText>Your Email Address</TranslatedText>
                </label>
                {user?.email && (
                  <p className="text-[11px] text-stone-500 mb-2">
                    <TranslatedText>Logged in as</TranslatedText> <span className="font-semibold text-stone-800">{user.email}</span>. <TranslatedText>You can keep this or type a different email below.</TranslatedText>
                  </p>
                )}
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={stockSubEmail}
                    onChange={(e) => setStockSubEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full pl-10 pr-4 py-3 border border-stone-300 text-sm focus:border-stone-900 focus:outline-none"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1.5">
                  <TranslatedText>We will send an email to this address as soon as this item is back in stock.</TranslatedText>
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStockSubModal(false)}
                  className="w-1/3 py-3 border border-stone-300 text-xs font-semibold uppercase tracking-wider text-stone-700 hover:border-stone-900 transition"
                >
                  <TranslatedText>Cancel</TranslatedText>
                </button>
                <button
                  type="submit"
                  disabled={stockSubLoading}
                  className="w-2/3 py-3 bg-footer-bg hover:bg-stone-800 text-white text-xs font-semibold uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {stockSubLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Bell size={16} className="text-amber-300" />
                  )}
                  <TranslatedText>Notify Me</TranslatedText>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PromoPopup pageKey="product" delayMs={3000} />
    </div>
  )
}

export default ProductDetails
