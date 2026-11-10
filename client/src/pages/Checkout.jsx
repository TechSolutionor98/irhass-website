
"use client"

import { useState, useEffect, useMemo } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useLocation } from "react-router-dom"
import axios from "axios"
import { useCart } from "../context/CartContext"
import { useAuth } from "../context/AuthContext"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import { useLoyalty } from "../context/LoyaltyContext"
import LoyaltyRedeemModal from "../components/LoyaltyRedeemModal"
import GrabCoin from "../components/GrabCoin"
import { useToast } from "../context/ToastContext"
import { useReferral } from "../context/ReferralContext"
import ReferralRewardModal from "../components/ReferralRewardModal"
import { getProvincesForCountry } from "../utils/countryStates"
import { DEFAULT_VAT_RATE } from "../utils/vat"
import AddressAutocomplete from "../components/AddressAutocomplete"
import { resolveDeliveryCharge, selectDeliveryMethod, describeDeliveryBlock } from "../utils/deliveryCharge"
import { rememberReturnPath } from "../utils/authRedirect"
import { Truck, Shield, MapPin, ChevronDown, ChevronUp, Banknote, Clock, X, Plus, Minus, Trash2, Gift, Percent, Copy, Check, Ticket } from "lucide-react"
import { Dialog } from "@headlessui/react"
import { Fragment } from "react"
import { getFullImageUrl } from "../utils/imageUtils"
import { pushPurchase } from "../utils/gtmTracking"
import { readMetaAttribution } from "../utils/metaAttribution"
import TranslatedText from "../components/TranslatedText"
import PhoneInput from 'react-phone-number-input'
import PromoPopup from "../components/PromoPopup"
import 'react-phone-number-input/style.css'
import '../styles/phoneInput.css'

import config from "../config/config"
import { STORES } from "../data/stores"
// One look for every field in the address modal.
const addressLabelClass = "mb-1 block text-xs font-medium text-gray-700"
const addressInputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-lime-500 focus:outline-none focus:ring-2 focus:ring-lime-200"
const addressSelectClass = addressInputClass + " appearance-none pr-9"

// The phone inputs store numbers in international form (+923001234567). Older saved
// profiles may still hold a bare local number, so the code is added only when missing.
const withDialCode = (phone, dial = "+92") => {
  const raw = String(phone || "").trim().replace(/[\s-]/g, "")
  if (!raw) return ""
  if (raw.startsWith("+")) return raw
  if (raw.startsWith("00")) return `+${raw.slice(2)}`
  return `${dial}${raw.replace(/^0+/, "")}`
}


const PAYMENT_METHODS = [
  {
    id: "card",
    name: "Debit/Credit Card",
    description: "You'll be redirected to Debit/Credit Card to complete your purchase.",
    iconUrls: [
      {
        src: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1757764222/master_visa_card_q9zo4b.webp",
        size: "big",
      },
    ],
    color: "",
  },
  {
    id: "tabby",
    name: "Pay later with Tabby",
    description: "You'll be redirected to Tabby to complete your purchase.",
    iconUrls: [
      { src: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1757764220/tabby_card_lpsmhh.webp", size: "big" },
    ],
    color: "",
  },
  {
    id: "tamara",
    name: "Tamara - Monthly payments. Sharia compliant",
    description: "You'll be redirected to Tamara to complete your purchase.",
    iconUrls: [
      { src: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1757764221/tamara_card_lh6vev.webp", size: "big" },
    ],
    color: "",
  },
  {
    id: "cod",
    name: "Cash on Delivery (COD)",
    description: "Pay with cash upon delivery.",
    iconUrls: [{ src: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1757764221/cash_qk1cws.webp", size: "big" }],
    color: "",
  },
]

const bounceKeyframes = `
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-30px); }
}`
if (typeof document !== "undefined" && !document.getElementById("bounce-keyframes")) {
  const style = document.createElement("style")
  style.id = "bounce-keyframes"
  style.innerHTML = bounceKeyframes
  document.head.appendChild(style)
}

const renderPaymentLogos = (id) => {
  switch (id) {
    case "card":
      return (
        <div className="flex items-center gap-1.5">
          {/* Visa */}
          <div className="bg-[#0033a0] text-white px-2 py-0.5 rounded font-extrabold italic text-[9px] tracking-wider flex items-center justify-center h-5 w-10 select-none">
            VISA
          </div>
          {/* Mastercard */}
          <div className="bg-[#141414] px-1.5 py-0.5 rounded flex items-center justify-center h-5 w-10 select-none">
            <svg width="20" height="12" viewBox="0 0 24 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7.5" r="7" fill="#EB001B"/>
              <circle cx="17" cy="7.5" r="7" fill="#F79E1B" fillOpacity="0.8"/>
            </svg>
          </div>
          {/* Samsung Pay */}
          <div className="bg-white border border-gray-200 px-1 py-0.5 rounded flex flex-col items-center justify-center h-5 w-10 select-none leading-none">
            <span className="text-[5px] font-black text-black tracking-tighter">SAMSUNG</span>
            <span className="text-[4px] font-medium text-gray-500 tracking-tighter">Pay</span>
          </div>
          {/* UnionPay */}
          <div className="bg-[#007989] rounded flex items-center justify-center h-5 w-10 select-none">
            <svg width="22" height="12" viewBox="0 0 28 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4H12L9 12H4V4Z" fill="#D0121B"/>
              <path d="M11.5 4H18.5L15.5 12H11.5L11.5 4Z" fill="#002D62"/>
              <path d="M18 4H24L21 12H15L18 4Z" fill="#0A5B9B"/>
            </svg>
          </div>
        </div>
      );
    case "tabby":
      return (
        <div className="bg-[#39F3BB] text-[#040404] font-black px-2 py-0.5 rounded flex items-center justify-center h-5 w-11 text-[9px] tracking-tighter select-none">
          tabby
        </div>
      );
    case "tamara":
      return (
        <div className="bg-black text-white px-2 py-0.5 rounded flex items-center justify-center h-5 w-11 select-none">
          <svg width="18" height="10" viewBox="0 0 20 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 5C7 7.2 5.2 9 3 9C0.8 9 0 7.2 0 5C0 2.8 2.2 1 4 1C6.2 1 7 2.8 7 5Z" fill="white"/>
            <circle cx="14" cy="5" r="4" fill="white"/>
          </svg>
        </div>
      );
    default:
      return null;
  }
};

// A completed checkout step shown folded on the payment step: number, title and a
// one-line readback in the header, the full editable form underneath when opened.
/**
 * One block of the checkout form.
 *
 * Flat, not an accordion: the whole form is visible at once, so a shopper can see
 * what is still being asked of them before they start typing. `number`, `summary`,
 * `open` and `onToggle` are accepted and ignored so the call sites did not all have
 * to change when the stepper came out.
 */
const ReviewSection = ({ id, title, action, children }) => (
  <section id={id} className="scroll-mt-24 pt-8 first:pt-0">
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      {action}
    </div>
    {children}
  </section>
)

const Checkout = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const {
    cartItems,
    setCartItems,
    cartTotal,
    clearCart,
    calculateFinalTotal,
    deliveryOptions,
    setDeliveryOptions,
    selectedDelivery,
    setSelectedDelivery,
    coupon,
    setCoupon,
    couponDiscount,
    setCouponDiscount,
    removeFromCart,
    updateQuantity,
    loyaltyPointsToRedeem,
    loyaltyDiscount,
    applyLoyaltyRedemption,
    clearLoyaltyRedemption,
    orderNote,
  } = useCart()
  const { showToast } = useToast()

  // Live stock sync on Checkout mount to ensure cart quantities adhere to current inventory
  useEffect(() => {
    if (!cartItems || cartItems.length === 0) return

    let isMounted = true
    const syncStock = async () => {
      try {
        const uniqueProductIds = [...new Set(cartItems.map((item) => item._id).filter(Boolean))]
        if (uniqueProductIds.length === 0) return

        const responses = await Promise.all(
          uniqueProductIds.map(async (id) => {
            try {
              const res = await axios.get(`${config.API_URL}/api/products/${id}?_t=${Date.now()}`)
              return { id, product: res.data }
            } catch {
              return { id, product: null }
            }
          })
        )

        if (!isMounted) return

        const productMap = new Map()
        responses.forEach(({ id, product }) => {
          if (product) productMap.set(String(id), product)
        })

        let hasAdjustments = false
        const adjustments = []

        const updatedItems = cartItems.map((item) => {
          const freshProd = productMap.get(String(item._id))
          if (!freshProd) return item

          let updatedItem = { ...item }

          if (item.selectedSizeData && freshProd.sizes && Array.isArray(freshProd.sizes)) {
            const freshSize = freshProd.sizes.find(
              (s) =>
                (item.selectedSizeData.sizeId && String(s.size || s._id) === String(item.selectedSizeData.sizeId)) ||
                (item.selectedSizeData.code && s.code && s.code.toLowerCase() === String(item.selectedSizeData.code).toLowerCase()) ||
                (item.selectedSizeData.name && s.name && s.name.toLowerCase() === String(item.selectedSizeData.name).toLowerCase())
            )

            if (freshSize) {
              const freshCount = Number(freshSize.countInStock) || 0
              updatedItem.selectedSizeData = {
                ...updatedItem.selectedSizeData,
                countInStock: freshCount,
              }

              if (freshCount <= 0 && item.quantity > 0) {
                hasAdjustments = true
                adjustments.push(`${item.name} (${freshSize.code || freshSize.name}) is currently out of stock.`)
              } else if (item.quantity > freshCount) {
                hasAdjustments = true
                adjustments.push(`Quantity for ${item.name} (${freshSize.code || freshSize.name}) was adjusted to ${freshCount} based on available stock.`)
                updatedItem.quantity = freshCount
              }
            }
          } else if (freshProd.countInStock !== undefined) {
            const freshCount = Number(freshProd.countInStock) || 0
            updatedItem.countInStock = freshCount
            if (freshCount <= 0 && item.quantity > 0) {
              hasAdjustments = true
              adjustments.push(`${item.name} is currently out of stock.`)
            } else if (item.quantity > freshCount) {
              hasAdjustments = true
              adjustments.push(`Quantity for ${item.name} was adjusted to ${freshCount} based on available stock.`)
              updatedItem.quantity = freshCount
            }
          }

          return updatedItem
        })

        if (hasAdjustments && typeof setCartItems === "function") {
          setCartItems(updatedItems)
          adjustments.forEach((msg) => showToast(msg, "error"))
        }
      } catch (err) {
        console.error("Failed to sync live stock on checkout:", err)
      }
    }

    syncStock()
    return () => {
      isMounted = false
    }
  }, [])
  const { getLocalizedPath, isArabic } = useLanguage()
  const { formatPrice: formatCurrencyPrice, countries, currentCountry } = useCurrency()
  const { isEnabled: loyaltyEnabled, refreshBalance: refreshLoyaltyBalance } = useLoyalty()
  const {
    isEnabled: referralEnabled,
    selectedRewardId: referralRewardId,
    referralDiscount,
    applyReward: applyReferralReward,
    clearReward: clearReferralReward,
    refreshSummary: refreshReferralSummary,
  } = useReferral()
  const location = useLocation()

  // Enforce customer login before proceeding to checkout
  useEffect(() => {
    if (!authLoading && !user) {
      rememberReturnPath(location.pathname, location.search)
      navigate(getLocalizedPath("/login"), {
        state: { from: { pathname: location.pathname, search: location.search } },
        replace: true,
      })
    }
  }, [authLoading, user, navigate, getLocalizedPath, location.pathname, location.search])

  const [tax, setTax] = useState(null)
  const [paymentChargesList, setPaymentChargesList] = useState({})

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: currentCountry?.name || "Pakistan",
  })

  // Fetch tax and payment charges on mount
  useEffect(() => {
    const fetchTax = async () => {
      try {
        const { data } = await axios.get(`${config.API_URL}/api/tax`, {
          params: { countryCode: currentCountry?.code },
        })
        if (data && data.length > 0) setTax(data[0])
      } catch (err) {
        // handle error
      }
    }
    fetchTax()

    const fetchPaymentCharges = async () => {
      try {
        // Country specific fees where configured, otherwise the default rule.
        const { data } = await axios.get(`${config.API_URL}/api/payment-charges/active`, {
          params: { countryCode: currentCountry?.code },
        })
        const chargesMap = {}
        data.forEach(item => {
          chargesMap[item.paymentMethod] = item
        })
        setPaymentChargesList(chargesMap)
      } catch (err) {
        console.error("Failed to fetch payment charges", err)
      }
    }
    fetchPaymentCharges()
  }, [currentCountry?.code])

  // The VAT rate charged on delivery/handling fees. Same source and same fallback as
  // the server, so the amount shown here is the amount the order is created with.
  useEffect(() => {
    axios
      .get(`${config.API_URL}/api/settings`)
      .then(({ data }) => {
        const rate = Number(data?.taxRate)
        // `>= 0`, matching the server: a configured zero is a real rate, not a missing one.
        setStoreVatRate(Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_VAT_RATE)
      })
      .catch(() => setStoreVatRate(DEFAULT_VAT_RATE))
  }, [])

  // Fetch country-specific delivery options when country changes or on mount
  useEffect(() => {
    const activeCountry = formData.country || currentCountry?.name || "Pakistan"
    const fetchDeliveryOptions = async () => {
      try {
        const { data } = await axios.get(`${config.API_URL}/api/delivery-charges`, {
          params: {
            country: activeCountry,
            countryCode: currentCountry?.code,
          },
        })
        setDeliveryOptions(data)
        if (data.length > 0) {
          setSelectedDelivery(data[0])
        } else {
          setSelectedDelivery(null)
        }
      } catch (err) {
        console.error("Error fetching country delivery charges:", err)
      }
    }
    fetchDeliveryOptions()
  }, [formData.country, currentCountry?.name, currentCountry?.code])

  const [savedAddresses, setSavedAddresses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [deliveryType, setDeliveryType] = useState("home")
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState(null)
  const [addressDetails, setAddressDetails] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    isDefault: false,
  })
  const [pickupDetails, setPickupDetails] = useState({
    phone: "",
    location: "",
    storeId: "",
  })
  const [selectedStore, setSelectedStore] = useState(null)
  // The store list and its map used to sit open in the page. Three stores with a map
  // each is taller than a phone screen, so the phone number above it and the Continue
  // button below it were never visible at the same time. It opens on demand now.
  const [showStorePicker, setShowStorePicker] = useState(false)
  const [step, setStep] = useState(1)
  // On the payment step the two earlier steps sit folded above the payment methods;
  // this is the one currently opened for editing (1, 2 or null).
  const [openReviewStep, setOpenReviewStep] = useState(null)
  // The accordion: which stacked section is open (1 Delivery · 2 Order notes · 3 Payment).
  // Only one is open at a time, Amazon-style; saving a section opens the next.
  // On the delivery step the saved-address grid stays hidden -- only the chosen address
  // shows -- until the shopper taps "Change" to pick another.
  const [showAddressList, setShowAddressList] = useState(false)
  // The item pending removal from the review list, shown in a confirmation modal.
  const [itemToDelete, setItemToDelete] = useState(null)
  // The store's VAT rate, used to charge VAT on delivery and handling fees. Read from
  // the same public settings the order endpoint uses so both totals agree.
  const [storeVatRate, setStoreVatRate] = useState(DEFAULT_VAT_RATE)
  // "Use Grabian Points" modal, opened from the payment section.
  const [showPointsModal, setShowPointsModal] = useState(false)
  // "Use Referral Discount" modal, opened from the payment section.
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [showAllItems, setShowAllItems] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("")
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState(["card", "cod"])

  useEffect(() => {
    // Country rules still apply when there is nothing to price against the cart,
    // so ask for the country list rather than assuming card + cash on delivery.
    const fetchCountryFallbackMethods = async () => {
      try {
        const { data } = await axios.get(`${config.API_URL}/api/country-payment-methods/resolve`, {
          params: { countryCode: currentCountry?.code },
        })
        if (Array.isArray(data?.paymentMethods) && data.paymentMethods.length > 0) {
          return data.paymentMethods
        }
      } catch (err) {
        console.error("Failed to fetch country payment methods:", err)
      }
      return ["card", "cod"]
    }

    const fetchAllowedPaymentMethods = async () => {
      if (!cartItems || cartItems.length === 0) {
        setAllowedPaymentMethods(await fetchCountryFallbackMethods())
        return
      }

      try {
        const productIds = cartItems
          .filter(item => !item.isProtection && item._id)
          .map(item => item._id)

        if (productIds.length === 0) {
          setAllowedPaymentMethods(await fetchCountryFallbackMethods())
          return
        }

        const { data } = await axios.post(`${config.API_URL}/api/product-payment-methods/resolve`, {
          productIds,
          countryCode: currentCountry?.code,
        })

        if (data && Array.isArray(data.paymentMethods)) {
          setAllowedPaymentMethods(data.paymentMethods)
          if (selectedPaymentMethod && !data.paymentMethods.includes(selectedPaymentMethod)) {
            setSelectedPaymentMethod(data.paymentMethods[0] || "")
          } else if (!selectedPaymentMethod && data.paymentMethods.length > 0) {
            setSelectedPaymentMethod(data.paymentMethods[0])
          }
        }
      } catch (err) {
        console.error("Failed to fetch allowed payment methods:", err)
        setAllowedPaymentMethods(await fetchCountryFallbackMethods())
      }
    }

    fetchAllowedPaymentMethods()
  }, [cartItems, currentCountry?.code])
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardholderName: "",
  })
  // Seeded from the note typed in the cart drawer, so writing one there and then
  // continuing to checkout does not silently lose it.
  const [customerNotes, setCustomerNotes] = useState(orderNote || "")
  const [couponInput, setCouponInput] = useState("")
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState("")

  // "Available Coupons" modal — the public list of coupons a shopper can browse and apply.
  const [showCouponsModal, setShowCouponsModal] = useState(false)
  const [publicCoupons, setPublicCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [couponModalError, setCouponModalError] = useState(null)
  const [couponCopied, setCouponCopied] = useState(null)

  const COUPON_COLORS = [
    { main: "bg-gradient-to-r from-yellow-50 to-yellow-100", stub: "bg-yellow-300", border: "border-yellow-300", text: "text-yellow-800" },
    { main: "bg-gradient-to-r from-blue-50 to-blue-100", stub: "bg-blue-300", border: "border-blue-300", text: "text-blue-800" },
    { main: "bg-gradient-to-r from-green-50 to-green-100", stub: "bg-green-300", border: "border-green-300", text: "text-green-800" },
    { main: "bg-gradient-to-r from-purple-50 to-purple-100", stub: "bg-purple-300", border: "border-purple-300", text: "text-purple-800" },
  ]

  // Tax is included in prices, no separate calculation needed
  const taxAmount = "included"

  const formatPrice = (price) => {
    return formatCurrencyPrice(price, isArabic)
  }

  // Respect bundlePrice, bundleDiscount (25%), then offerPrice, then base price
  const getItemPrice = (item) => {
    const original = Number(item.originalPrice)
    const bundlePrice = Number(item.bundlePrice)
    const hasBundlePrice = item.isBundleItem && !Number.isNaN(bundlePrice) && bundlePrice > 0

    if (hasBundlePrice) {
      return bundlePrice
    }
    if (item.bundleDiscount && !Number.isNaN(original) && original > 0) {
      return original * 0.75
    }
    const offer = Number(item.offerPrice)
    if (!Number.isNaN(offer) && offer > 0) {
      return offer
    }
    return Number(item.price) || 0
  }

  const getItemPricingDetails = (item) => {
    const basePrice = Number(item.originalPrice || item.basePrice || item.price) || 0
    const currentPrice = getItemPrice(item)

    const savings = basePrice > currentPrice ? basePrice - currentPrice : 0
    const discountPercentage = savings > 0 ? Math.round((savings / (basePrice || 1)) * 100) : 0

    return {
      basePrice,
      currentPrice,
      savings,
      discountPercentage,
      hasDiscount: savings > 0,
    }
  }

  const calculateCartTotals = () => {
    let totalBasePrice = 0
    let totalOfferPrice = 0
    let totalSavings = 0

    cartItems.forEach((item) => {
      const pricingDetails = getItemPricingDetails(item)
      totalBasePrice += pricingDetails.basePrice * item.quantity
      totalOfferPrice += pricingDetails.currentPrice * item.quantity
      totalSavings += pricingDetails.savings * item.quantity
    })

    return {
      totalBasePrice,
      totalOfferPrice,
      totalSavings,
    }
  }

  const cartTotals = calculateCartTotals()

  // Filter out protection items from cart display
  const protectionItems = cartItems.filter(item => item.isProtection)
  const regularCartItems = cartItems.filter(item => !item.isProtection)

  // Calculate protection items total
  const protectionTotal = protectionItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const hasAdminDeliveryCharges = (deliveryOptions?.length || 0) > 0

  // The goods subtotal every delivery band is measured against. Items only -- the same
  // figure the server derives from the database, so the two agree on the shipping.
  // Discounts are deliberately excluded: a band is about the size of the basket.
  const deliveryGoodsSubtotal = cartTotals.totalOfferPrice + protectionTotal

  // Resolved through the shared rules, so what the shopper is quoted is what the order
  // endpoint will charge. Honours their pick while it is still valid for this basket and
  // otherwise falls to the cheapest usable method.
  const resolvedDelivery = useMemo(
    () => selectDeliveryMethod(deliveryOptions || [], deliveryGoodsSubtotal, selectedDelivery?._id),
    [deliveryOptions, deliveryGoodsSubtotal, selectedDelivery?._id],
  )

  const fallbackDelivery = resolvedDelivery.method || selectedDelivery || deliveryOptions?.[0]
  const deliveryCharge = deliveryType === "home" && hasAdminDeliveryCharges ? resolvedDelivery.charge : 0

  // Home delivery is off the table for this basket -- too small for every method the shop
  // has configured. Store pickup, which has no charge and no bands, stays available.
  const deliveryBlocked = deliveryType === "home" && hasAdminDeliveryCharges && !resolvedDelivery.available
  const deliveryBlockedMessage = deliveryBlocked ? describeDeliveryBlock(resolvedDelivery, formatPrice) : ""

  // Dynamic payment charges calculation
  const currentPaymentChargesData = selectedPaymentMethod ? paymentChargesList[selectedPaymentMethod] : null;
  const paymentChargesTotal = currentPaymentChargesData?.charges?.reduce((sum, charge) => {
    let amount = Number(charge.amount) || 0;
    if (charge.type === "percentage") {
      amount = (cartTotals.totalOfferPrice + protectionTotal) * (amount / 100);
    }
    return sum + amount;
  }, 0) || 0;
  
  // A referral reward comes off the goods only -- never delivery or payment fees -- and
  // only what is left after any coupon. Same order the server applies them in.
  const referralEligibleAmount = Math.max(0, cartTotals.totalOfferPrice + protectionTotal - couponDiscount)
  const appliedReferralDiscount = Math.min(referralDiscount, referralEligibleAmount)

  // Points come off the goods only -- never delivery or payment fees -- so the panel is
  // capped against this figure and the discount is clamped to it.
  const loyaltyEligibleAmount = Math.max(0, referralEligibleAmount - appliedReferralDiscount)
  const appliedLoyaltyDiscount = Math.min(loyaltyDiscount, loyaltyEligibleAmount)

  // Only ONE discount may be active at a time: coupon OR referral OR Grabian Points.
  // Each control is blocked while another is applied.
  const couponApplied = !!coupon
  const referralApplied = !!referralRewardId
  const pointsApplied = loyaltyPointsToRedeem > 0
  const blockCoupon = !couponApplied && (referralApplied || pointsApplied)
  const blockReferral = !referralApplied && (couponApplied || pointsApplied)
  const blockPoints = !pointsApplied && (couponApplied || referralApplied)

  // Product prices already carry their VAT, but delivery and handling fees are held
  // exclusive of it, so VAT on those two is added on top. The rate comes from the same
  // public settings the order endpoint reads, so this total and the one the server
  // recalculates can never disagree -- a mismatch would charge the card a different
  // amount from the order it is paying for.
  const feesExcludingVat = deliveryCharge + paymentChargesTotal
  const feesVat = Number(((feesExcludingVat * storeVatRate) / 100).toFixed(2))

  const finalTotal = Math.max(
    0,
    cartTotals.totalOfferPrice +
      protectionTotal +
      deliveryCharge +
      paymentChargesTotal +
      feesVat -
      couponDiscount -
      appliedReferralDiscount -
      appliedLoyaltyDiscount,
  )

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
      clearLoyaltyRedemption()
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

  // Available Coupons modal
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleCardDetailsChange = (e) => {
    const { name, value } = e.target
    setCardDetails({
      ...cardDetails,
      [name]: value,
    })
  }

  const validateHomeDelivery = () => {
    // Validates full customer delivery details before order placement
    const required = [
      ["name", "full name"],
      ["email", "email address"],
      ["phone", "phone number"],
      ["country", "country"],
      ["address", "street address"],
      ["city", "city"],
      ["state", "province / state"],
    ]

    const missing = required.filter(([key]) => !String(formData[key] || "").trim()).map(([, label]) => label)

    if (missing.length) {
      const msg =
        missing.length === 1
          ? `Please add your ${missing[0]}.`
          : `Please add your ${missing.join(", ")}.`
      setError(msg)
      showToast(msg, "error")
      return false
    }
    return true
  }

  const validatePickup = () => {
    if (!pickupDetails.phone || !pickupDetails.storeId) {
      setError("Please fill in phone number and select a store")
      return false
    }
    return true
  }

  const validatePayment = () => {
    if (!selectedPaymentMethod) {
      setError("Please select a payment method")
      return false
    }
    // Card details validation removed for N-Genius redirect flow
    return true
  }

  const processPayment = async (orderData) => {
    try {
      switch (selectedPaymentMethod) {
        case "tamara":
          return await processTamaraPayment(orderData)
        case "tabby":
          return await processTabbyPayment(orderData)
        case "card":
          return await processCardPayment(orderData)
        case "cod":
          return await processCODPayment(orderData)
        default:
          throw new Error("Invalid payment method")
      }
    } catch (error) {
      console.error("Payment processing error:", error)
      throw error
    }
  }

  const processTamaraPayment = async (orderData) => {
    const tamaraPayload = {
      total_amount: {
        amount: finalTotal,
        currency: "PKR",
      },
      shipping_amount: {
        amount: deliveryCharge,
        currency: "PKR",
      },
      tax_amount: {
        amount: 0, // VAT is included in prices
        currency: "PKR",
      },
      order_reference_id: `ORDER_${Date.now()}`,
      order_number: `ORD_${Date.now()}`,
      description: `Order for ${cartItems.length} items from Irhaas`,
      country_code: "AE",
      payment_type: "PAY_BY_INSTALMENTS",
      instalments: 3,
      locale: "en_US",
      platform: "Irhaas Online Store",
      is_mobile: window.innerWidth <= 768,
      consumer: {
        first_name: formData.name.split(" ")[0] || "Customer",
        last_name: formData.name.split(" ").slice(1).join(" ") || "User",
        phone_number: withDialCode(formData.phone),
        email: formData.email,
      },
      billing_address: {
        city: formData.city || "Karachi",
        country_code: "AE",
        first_name: formData.name.split(" ")[0] || "Customer",
        last_name: formData.name.split(" ").slice(1).join(" ") || "User",
        line1: formData.address || "Pakistan",
        line2: "",
        phone_number: withDialCode(formData.phone),
        region: formData.state || "Sindh",
      },
      shipping_address: {
        city: formData.city || "Karachi",
        country_code: "AE",
        first_name: formData.name.split(" ")[0] || "Customer",
        last_name: formData.name.split(" ").slice(1).join(" ") || "User",
        line1: formData.address || "Pakistan",
        line2: "",
        phone_number: withDialCode(formData.phone),
        region: formData.state || "Sindh",
      },
      items: cartItems.map((item) => ({
        name: item.name,
        type: "Physical",
        reference_id: item._id,
        sku: item._id,
        quantity: item.quantity,
        unit_price: {
          amount: item.price,
          currency: "PKR",
        },
        total_amount: {
          amount: item.price * item.quantity,
          currency: "PKR",
        },
      })),
      merchant_url: {
        success: `${window.location.origin}${getLocalizedPath("/payment/success")}`,
        failure: `${window.location.origin}${getLocalizedPath("/payment/cancel")}`,
        cancel: `${window.location.origin}${getLocalizedPath("/payment/cancel")}`,
        notification: `${config.API_URL}/api/payment/tamara/webhook`,
      },
    }

    const token = localStorage.getItem("token")
    const axiosConfig = {}
    if (token) {
      axiosConfig.headers = { Authorization: `Bearer ${token}` }
    }

    const response = await axios.post(`${config.API_URL}/api/payment/tamara/checkout`, tamaraPayload, axiosConfig)
    return response.data
  }

  const processTabbyPayment = async (orderData) => {
    const tabbyPayload = {
      payment: {
        amount: finalTotal.toString(),
        currency: "PKR",
        description: `Order payment for ${cartItems.length} items`,
        buyer: {
          phone: withDialCode(formData.phone),
          email: formData.email,
          name: formData.name,
        },
        shipping_address: {
          city: formData.city,
          address: formData.address,
          zip: formData.zipCode,
        },
        order: {
          tax_amount: taxAmount.toString(),
          shipping_amount: deliveryCharge.toString(),
          discount_amount: "0.00",
          updated_at: new Date().toISOString(),
          reference_id: `ORDER_${Date.now()}`,
          items: cartItems.map((item) => ({
            title: item.name,
            description: item.description || item.name,
            quantity: item.quantity,
            unit_price: item.price.toString(),
            discount_amount: "0.00",
            reference_id: item._id,
            image_url: item.image,
            product_url: `${window.location.origin}${getLocalizedPath("/product/" + (item.slug || item._id))}`,
            category: item.category || "Electronics",
          })),
        },
        order_history: [],
        meta: {
          order_id: `ORDER_${Date.now()}`,
          customer: formData.email,
        },
      },
      lang: "en",
      merchant_code: process.env.REACT_APP_TABBY_MERCHANT_CODE,
      merchant_urls: {
        success: `${window.location.origin}${getLocalizedPath("/orders")}?success=true`,
        cancel: `${window.location.origin}${getLocalizedPath("/checkout")}`,
        failure: `${window.location.origin}${getLocalizedPath("/checkout")}?error=payment_failed`,
      },
    }

    const response = await axios.post(`${config.API_URL}/api/payment/tabby/checkout`, tabbyPayload)
    return response.data
  }

  const processCardPayment = async (orderData) => {
    // Call backend to create N-Genius order using the correct API URL
    const response = await axios.post(`${config.API_URL}/api/payment/ngenius/card`, {
      amount: finalTotal,
      currencyCode: "PKR",
    })

    // Redirect user to N-Genius payment page
    const paymentUrl = response.data?.paymentUrl
    if (paymentUrl) {
      window.location.href = paymentUrl
    } else {
      throw new Error("Payment URL not received from N-Genius")
    }
  }

  const processCODPayment = async (orderData) => {
    const token = localStorage.getItem("token")
    try {
      const axiosConfig = {}
      if (token) {
        axiosConfig.headers = { Authorization: `Bearer ${token}` }
      }
      const response = await axios.post(
        `${config.API_URL}/api/orders`,
        {
          ...orderData,
          paymentMethod: "cod",
          actualPaymentMethod: "cod",
          paymentStatus: "pending",
          isPaid: false,
        },
        axiosConfig,
      )
      return { success: true, order: response.data }
    } catch (error) {
      console.error("[Checkout] Order error:", error, error.response?.data)
      throw error
    }
  }

  // New function to create order first, then initiate payment
  const createOrderThenPay = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem("token")
      // No auth gate here. Guests order without an account; the server accepts an order
      // with no user attached and creates one from the delivery details afterwards.

      const actualPaymentMethod = selectedPaymentMethod

      // Prepare order data
      const orderData = {
        orderItems: cartItems.map((item) => {
          const orderItem = {
            name: item.name,
            image: item.image,
            // Persist the same effective unit price used for checkout totals.
            price: getItemPrice(item),
            quantity: item.quantity,
          }
          
          // Add color variation data if present
          if (item.selectedColorData) {
            orderItem.selectedColorIndex = item.selectedColorIndex
            orderItem.selectedColorData = {
              color: item.selectedColorData.color,
              image: item.selectedColorData.image,
              price: item.selectedColorData.price,
              offerPrice: item.selectedColorData.offerPrice,
              sku: item.selectedColorData.sku,
            }
          }
          
          // Add DOS/Windows variation data if present
          if (item.selectedDosData) {
            orderItem.selectedDosIndex = item.selectedDosIndex
            orderItem.selectedDosData = {
              dosType: item.selectedDosData.dosType,
              image: item.selectedDosData.image,
              price: item.selectedDosData.price,
              offerPrice: item.selectedDosData.offerPrice,
              sku: item.selectedDosData.sku,
            }
          }

          // Add size variation data if present
          if (item.selectedSizeData) {
            orderItem.selectedSizeIndex = item.selectedSizeIndex
            orderItem.selectedSizeData = {
              sizeId: item.selectedSizeData.sizeId,
              name: item.selectedSizeData.name,
              code: item.selectedSizeData.code,
              additionalPrice: Number(item.selectedSizeData.additionalPrice) || 0,
            }
          }
          
          // Handle buyer protection items separately
          if (item.isProtection) {
            orderItem.isProtection = true
            orderItem.protectionFor = item.protectionFor
            orderItem.protectionData = item.protectionData?._id
          } else {
            orderItem.product = item._id
          }
          
          return orderItem
        }),
        itemsPrice: cartTotal,
        // The server recomputes the discount from this code -- it never trusts the
        // total we send -- so a coupon the shopper applied has to travel with the order
        // or it is silently lost and the two sides disagree on what is owed.
        couponCode: coupon?.code || undefined,
        referralRewardId: referralRewardId || undefined,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem,
        shippingPrice: deliveryCharge,
        deliveryChargeId: deliveryType === "home" ? (fallbackDelivery?._id || undefined) : undefined,
        totalPrice: finalTotal,
        deliveryType: deliveryType,
        paymentMethod: actualPaymentMethod, // Use actual payment method (card for tabby)
        actualPaymentMethod: selectedPaymentMethod, // Store the original selected payment method (tabby, tamara, card, cod)
        paymentStatus: "pending",
        isPaid: false,
        customerNotes: customerNotes.trim() || undefined,
        // Dynamic payment charges
        paymentCharges: currentPaymentChargesData?.charges || [],
        currency: currentCountry?.currencyCode || "PKR",
        currencySymbol: currentCountry?.currencySymbol || currentCountry?.currencyCode || "PKR",
        // Lets the server enforce the country payment method rules.
        countryCode: currentCountry?.code,
        // The pixel cookies, so the server can report this sale to Meta as the
        // same person the browser pixel reported.
        metaAttribution: readMetaAttribution(),
      }

      if (deliveryType === "home") {
        const activeCountryName = currentCountry?.name || "Pakistan"
        orderData.shippingAddress = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: (formData.country && formData.country !== "Pakistan") ? formData.country : activeCountryName,
        }
        orderData.billingAddress = { ...orderData.shippingAddress }
      } else if (deliveryType === "pickup") {
        const store = STORES.find((s) => s.storeId === pickupDetails.storeId)
        orderData.pickupDetails = {
          phone: pickupDetails.phone,
          // A collection has no shippingAddress, so the customer is recorded
          // here or the order has no record of who placed it.
          name: formData.name,
          email: formData.email,
          location: store?.name || pickupDetails.location,
          storeId: pickupDetails.storeId,
          storeAddress: store?.address,
          storePhone: store?.phone,
        }
      }

      // Create order first
      const axiosConfig = {}
      if (token) {
        axiosConfig.headers = { Authorization: `Bearer ${token}` }
      }
      const orderRes = await axios.post(`${config.API_URL}/api/orders`, orderData, axiosConfig)
      const createdOrder = orderRes.data
      const orderId = createdOrder._id

      // Card / Tamara / Tabby orders are tracked on the payment success page,
      // once the gateway has confirmed the charge.

      // Now initiate payment based on selected method
      if (selectedPaymentMethod === "card") {
        const response = await axios.post(`${config.API_URL}/api/payment/ngenius/card`, {
          amount: finalTotal,
          currencyCode: "PKR",
          orderId: orderId,
          paymentMethod: selectedPaymentMethod,
          redirectUrl: `${window.location.origin}${getLocalizedPath("/payment/success")}`,
          cancelUrl: `${window.location.origin}${getLocalizedPath("/payment/cancel")}`,
        })
        const paymentUrl = response.data?.paymentUrl
        if (paymentUrl) {
          window.location.href = paymentUrl
        } else {
          throw new Error("Payment URL not received from N-Genius")
        }
      } else if (selectedPaymentMethod === "tabby") {
        const tabbyPayload = {
          payment: {
            amount: Number(finalTotal).toFixed(2),
            currency: "PKR",
            description: `Order payment for ${cartItems.length} items`,
            buyer: {
              phone: withDialCode(formData.phone),
              email: formData.email,
              name: formData.name,
            },
            shipping_address: {
              city: formData.city,
              address: formData.address,
              zip: formData.zipCode || "00000",
            },
            order: {
              tax_amount: taxAmount === "included" ? "0.00" : Number(taxAmount).toFixed(2),
              shipping_amount: Number(deliveryCharge).toFixed(2),
              discount_amount: "0.00",
              updated_at: new Date().toISOString(),
              reference_id: orderId,
              items: cartItems.map((item) => ({
                title: item.name,
                description: item.description || item.name,
                quantity: item.quantity,
                unit_price: Number(getItemPrice(item)).toFixed(2),
                discount_amount: "0.00",
                reference_id: item._id,
                image_url: item.image,
                product_url: `${window.location.origin}${getLocalizedPath("/product/" + (item.slug || item._id))}`,
                category: item.category?.name || "Electronics",
              })),
            },
            order_history: [],
            meta: {
              order_id: orderId,
              customer: formData.email,
            },
          },
          lang: "en",
          merchant_code: "AE",
          merchant_urls: {
            // The order id has to travel back, or the returning page cannot confirm
            // the order or report the purchase to GTM.
            success: `${window.location.origin}${getLocalizedPath("/orders")}?success=true&orderId=${orderId}&payment_method=tabby`,
            cancel: `${window.location.origin}${getLocalizedPath("/checkout")}`,
            failure: `${window.location.origin}${getLocalizedPath("/checkout")}?error=payment_failed`,
          },
        }

        const tabbyConfig = {}
        if (token) {
          tabbyConfig.headers = { Authorization: `Bearer ${token}` }
        }

        const response = await axios.post(`${config.API_URL}/api/payment/tabby/checkout`, tabbyPayload, tabbyConfig)
        
        const configuration = response.data?.configuration
        const webUrl = configuration?.available_products?.installments?.[0]?.web_url 
          || response.data?.payment?.instructions?.web_url

        if (webUrl) {
          window.location.href = webUrl
        } else {
          throw new Error("Payment URL not received from Tabby")
        }
      } else if (selectedPaymentMethod === "tamara") {
        // Tamara payment logic
        const tamaraPayload = {
          total_amount: {
            amount: finalTotal,
            currency: "PKR",
          },
          shipping_amount: {
            amount: deliveryCharge,
            currency: "PKR",
          },
          tax_amount: {
            amount: 0, // VAT is included in prices
            currency: "PKR",
          },
          order_reference_id: orderId,
          order_number: `ORD_${orderId}`,
          description: `Order for ${cartItems.length} items from Irhaas`,
          country_code: "AE",
          payment_type: "PAY_BY_INSTALMENTS",
          instalments: 3,
          locale: "en_US",
          platform: "Irhaas Online Store",
          is_mobile: window.innerWidth <= 768,
          consumer: {
            first_name: formData.name.split(" ")[0] || "Customer",
            last_name: formData.name.split(" ").slice(1).join(" ") || "User",
            phone_number: withDialCode(formData.phone),
            email: formData.email,
          },
          billing_address: {
            city: formData.city || "Karachi",
            country_code: "AE",
            first_name: formData.name.split(" ")[0] || "Customer",
            last_name: formData.name.split(" ").slice(1).join(" ") || "User",
            line1: formData.address || "Pakistan",
            line2: "",
            phone_number: withDialCode(formData.phone),
            region: formData.state || "Sindh",
          },
          shipping_address: {
            city: formData.city || "Karachi",
            country_code: "AE",
            first_name: formData.name.split(" ")[0] || "Customer",
            last_name: formData.name.split(" ").slice(1).join(" ") || "User",
            line1: formData.address || "Pakistan",
            line2: "",
            phone_number: withDialCode(formData.phone),
            region: formData.state || "Sindh",
          },
          items: cartItems.map((item) => ({
            name: item.name,
            type: "Physical",
            reference_id: item._id,
            sku: item._id,
            quantity: item.quantity,
            unit_price: {
              amount: item.price,
              currency: "PKR",
            },
            total_amount: {
              amount: item.price * item.quantity,
              currency: "PKR",
            },
          })),
          merchant_url: {
            success: `${window.location.origin}${getLocalizedPath("/payment/success")}?orderId=${orderId}&payment_method=tamara&amount=${finalTotal}`,
            failure: `${window.location.origin}${getLocalizedPath("/payment/cancel")}?orderId=${orderId}&payment_method=tamara`,
            cancel: `${window.location.origin}${getLocalizedPath("/payment/cancel")}?orderId=${orderId}&payment_method=tamara`,
            notification: `${config.API_URL}/api/payment/tamara/webhook`,
          },
        }

        const axiosConfig = {}
        if (token) {
          axiosConfig.headers = { Authorization: `Bearer ${token}` }
        }

        const response = await axios.post(`${config.API_URL}/api/payment/tamara/checkout`, tamaraPayload, axiosConfig)
        const paymentUrl = response.data?.checkout_url || response.data?.payment_url
        if (paymentUrl) {
          window.location.href = paymentUrl
        } else {
          throw new Error("Payment URL not received from Tamara")
        }
      }
    } catch (error) {
      setError(
        error.response?.data?.message ||
          // The payment endpoints report failures as `error`, the order endpoints as
          // `message`. Without both, a real reason becomes "Request failed with status
          // code 400" on screen.
          error.response?.data?.error ||
          error.message ||
          "Failed to process order/payment. Please try again.",
      )
      setLoading(false)
    }
  }

  const handlePaymentMethodSelect = (paymentMethod) => {
    // Keep the visual selection as-is, but map tabby to card internally for processing
    setSelectedPaymentMethod(paymentMethod)

    // For tracking purposes, use actual payment method (map tabby to card)
    const actualPaymentMethod = paymentMethod === "tabby" ? "card" : paymentMethod

    // Track add payment info event
    if (cartItems.length > 0) {
      const paymentChargesData = paymentChargesList[paymentMethod];
      const methodPaymentChargesTotal = paymentChargesData?.charges?.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0) || 0;
      const trackedTotal = cartTotal + deliveryCharge + methodPaymentChargesTotal - couponDiscount
      window.dataLayer = window.dataLayer || []
      window.dataLayer.push({
        event: "add_payment_info",
        ecommerce: {
          currency: "PKR",
          value: trackedTotal,
          payment_type: actualPaymentMethod, // Use the actual payment method for tracking
          items: cartItems.map((item) => ({
            item_id: item._id,
            item_name: item.name,
            item_category: item.parentCategory?.name || item.category?.name || "Uncategorized",
            item_brand: item.brand?.name || "Unknown",
            price: item.offerPrice && item.offerPrice > 0 ? item.offerPrice : item.price,
            quantity: item.quantity,
          })),
        },
      })

      console.log("Add payment info tracked:", actualPaymentMethod) // For debugging
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (cartItems.length === 0) {
      setError("Your cart is empty")
      return
    }

    // Validate based on delivery type
    if (deliveryType === "home" && !validateHomeDelivery()) {
      return
    }

    if (deliveryType === "pickup" && !validatePickup()) {
      return
    }

    // Validate payment method
    if (!validatePayment()) {
      return
    }

    // Validate stock availability before proceeding with order placement
    for (const item of cartItems) {
      if (item.isProtection) continue

      const sizeLabel = item.selectedSizeData?.code || item.selectedSizeData?.name
      const sizeStock = item.selectedSizeData?.countInStock !== undefined && item.selectedSizeData?.countInStock !== null
        ? Number(item.selectedSizeData.countInStock)
        : null

      if (sizeStock !== null) {
        if (sizeStock <= 0) {
          const msg = sizeLabel
            ? `${item.name} (Size: ${sizeLabel}) is out of stock. Please remove it from your cart to proceed.`
            : `${item.name} is out of stock. Please remove it from your cart to proceed.`
          setError(msg)
          showToast(msg, "error")
          return
        }
        if (item.quantity > sizeStock) {
          const msg = sizeLabel
            ? `Only ${sizeStock} units are available in size ${sizeLabel}. Please adjust the quantity to proceed.`
            : `Only ${sizeStock} units are available for ${item.name}. Please adjust the quantity to proceed.`
          setError(msg)
          showToast(msg, "error")
          return
        }
      } else if (item.countInStock !== undefined && item.countInStock !== null && item.stockStatus !== "PreOrder") {
        const productStock = Number(item.countInStock)
        if (productStock <= 0) {
          const msg = `${item.name} is out of stock. Please remove it from your cart to proceed.`
          setError(msg)
          showToast(msg, "error")
          return
        }
        if (item.quantity > productStock) {
          const msg = `Only ${productStock} units are available for ${item.name}. Please adjust the quantity to proceed.`
          setError(msg)
          showToast(msg, "error")
          return
        }
      }
    }

    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem("token")
      // No auth gate here. Guests order without an account; the server accepts an order
      // with no user attached and creates one from the delivery details afterwards.

      const orderData = {
        orderItems: cartItems.map((item) => {
          const orderItem = {
            name: item.name,
            image: item.image,
            // Persist the same effective unit price used for checkout totals.
            price: getItemPrice(item),
            quantity: item.quantity,
          }
          
          // Add color variation data if present
          if (item.selectedColorData) {
            orderItem.selectedColorIndex = item.selectedColorIndex
            orderItem.selectedColorData = {
              color: item.selectedColorData.color,
              image: item.selectedColorData.image,
              price: item.selectedColorData.price,
              offerPrice: item.selectedColorData.offerPrice,
              sku: item.selectedColorData.sku,
            }
          }
          
          // Add DOS/Windows variation data if present
          if (item.selectedDosData) {
            orderItem.selectedDosIndex = item.selectedDosIndex
            orderItem.selectedDosData = {
              dosType: item.selectedDosData.dosType,
              image: item.selectedDosData.image,
              price: item.selectedDosData.price,
              offerPrice: item.selectedDosData.offerPrice,
              sku: item.selectedDosData.sku,
            }
          }

          // Add size variation data if present
          if (item.selectedSizeData) {
            orderItem.selectedSizeIndex = item.selectedSizeIndex
            orderItem.selectedSizeData = {
              sizeId: item.selectedSizeData.sizeId,
              name: item.selectedSizeData.name,
              code: item.selectedSizeData.code,
              additionalPrice: Number(item.selectedSizeData.additionalPrice) || 0,
            }
          }
          
          // Handle buyer protection items separately
          if (item.isProtection) {
            orderItem.isProtection = true
            orderItem.protectionFor = item.protectionFor
            orderItem.protectionData = item.protectionData?._id
          } else {
            orderItem.product = item._id
          }
          
          return orderItem
        }),
        itemsPrice: cartTotal,
        // The server recomputes the discount from this code -- it never trusts the
        // total we send -- so a coupon the shopper applied has to travel with the order
        // or it is silently lost and the two sides disagree on what is owed.
        couponCode: coupon?.code || undefined,
        referralRewardId: referralRewardId || undefined,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem,
        shippingPrice: deliveryCharge, // Include delivery charge
        deliveryChargeId: deliveryType === "home" ? (fallbackDelivery?._id || undefined) : undefined,
        totalPrice: finalTotal, // Include delivery charge + COD fees
        deliveryType: deliveryType,
        paymentMethod: selectedPaymentMethod,
        customerNotes: customerNotes.trim() || undefined, // Only include if not empty
        // Dynamic payment charges
        paymentCharges: currentPaymentChargesData?.charges || [],
        currency: currentCountry?.currencyCode || "PKR",
        currencySymbol: currentCountry?.currencySymbol || currentCountry?.currencyCode || "PKR",
        // Lets the server enforce the country payment method rules.
        countryCode: currentCountry?.code,
        // The pixel cookies, so the server can report this sale to Meta as the
        // same person the browser pixel reported.
        metaAttribution: readMetaAttribution(),
      }

      if (deliveryType === "home") {
        orderData.shippingAddress = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
        }
        // For COD, billing address is same as shipping
        if (selectedPaymentMethod === "cod") {
          orderData.billingAddress = { ...orderData.shippingAddress }
        }
      } else if (deliveryType === "pickup") {
        const store = STORES.find((s) => s.storeId === pickupDetails.storeId)
        orderData.pickupDetails = {
          phone: pickupDetails.phone,
          // A collection has no shippingAddress, so the customer is recorded
          // here or the order has no record of who placed it.
          name: formData.name,
          email: formData.email,
          location: store?.name || pickupDetails.location,
          storeId: pickupDetails.storeId,
          storeAddress: store?.address,
          storePhone: store?.phone,
        }
      }

      // Process payment
      let paymentResult
      if (!token) {
        // Guest order: do not send Authorization header
        paymentResult = await processPayment(orderData)
      } else {
        // Logged-in user: send Authorization header
        paymentResult = await processPayment(orderData)
      }

      if (selectedPaymentMethod === "cod") {
        // For COD, order is created directly

        // Fire the GA4/Google Ads purchase event while the cart is still in
        // hand -- once clearCart() runs there is nothing left to report.
        pushPurchase({
          orderId: paymentResult?.order?._id,
          value: finalTotal,
          items: cartItems,
          paymentMethod: "cod",
          shipping: deliveryCharge,
          tax: 0, // VAT is included in the prices
          coupon: coupon?.code || null,
          currency: currentCountry?.currencyCode || "PKR",
        })

        clearCart()
        // The order just spent points and queued more as pending, so the header balance
        // would otherwise show the pre-checkout figure. The redemption is cleared too, or
        // the next basket would open with points already applied.
        clearLoyaltyRedemption()
        refreshLoyaltyBalance()
        // The reward has been spent on this order. Clearing it stops the next basket
        // opening with a discount the customer no longer holds.
        clearReferralReward()
        refreshReferralSummary()
        localStorage.removeItem("guestInfo")
        localStorage.removeItem("savedShippingAddress")
        if (!token) {
          // Guest: redirect to GuestOrder page
          if (paymentResult && paymentResult.order && paymentResult.order._id) {
            navigate(
              getLocalizedPath(`/guest-order?success=true&orderId=${paymentResult.order._id}&email=${encodeURIComponent(formData.email)}`),
            )
          } else {
            navigate(getLocalizedPath(`/guest-order?success=true&email=${encodeURIComponent(formData.email)}`))
          }
        } else {
          // Logged-in user
          if (paymentResult && paymentResult.order && paymentResult.order._id) {
            navigate(getLocalizedPath(`/orders?success=true&orderId=${paymentResult.order._id}`))
          } else {
            navigate(getLocalizedPath(`/orders?success=true`))
          }
        }
      } else {
        // For other payment methods, redirect to payment gateway
        if (
          paymentResult &&
          (paymentResult.checkout_url ||
            paymentResult.payment_url ||
            paymentResult._links?.payment?.href ||
            paymentResult.paymentUrl)
        ) {
          const paymentUrl =
            paymentResult.checkout_url ||
            paymentResult.payment_url ||
            paymentResult._links?.payment?.href ||
            paymentResult.paymentUrl
          window.location.href = paymentUrl
        } else {
          throw new Error("Payment URL not received")
        }
      }
    } catch (error) {
      console.error("Error processing order:", error)
      setError(
        error.response?.data?.message ||
          // The payment endpoints report failures as `error`, the order endpoints as
          // `message`. Without both, a real reason becomes "Request failed with status
          // code 400" on screen.
          error.response?.data?.error ||
          error.message ||
          "Failed to process order. Please try again.",
      )
    } finally {
      setLoading(false)
    }
  }

  // Place your order action
  const handlePlaceOrder = (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault()
    if (cartItems.length === 0) {
      setError("Your cart is empty")
      return
    }

    // Always validate delivery details before order placement
    if (deliveryType === "home") {
      if (!validateHomeDelivery()) return
      if (user && savedAddresses.length === 0 && formData.address) {
        handleSaveInlineAddress().catch(() => {})
      }
    } else if (deliveryType === "pickup") {
      if (!validatePickup()) return
    }

    if (!validatePayment()) return

    if (selectedPaymentMethod === "cod") {
      handleSubmit(e || { preventDefault() {} })
      return
    }

    setError(null)
    createOrderThenPay()
  }

  // Opens the edit address modal populated with address details
  const handleEditAddress = (addrToEdit) => {
    const targetAddr =
      addrToEdit ||
      savedAddresses.find((a) => a.address === formData.address && a.city === formData.city) ||
      savedAddresses.find((a) => a.isDefault) ||
      savedAddresses[0]

    if (targetAddr) {
      setEditingAddressId(targetAddr._id || null)
      setAddressDetails({
        name: targetAddr.name || formData.name || user?.name || "Home",
        phone: targetAddr.phone || formData.phone || user?.phone || "",
        address: targetAddr.address || formData.address || "",
        city: targetAddr.city || formData.city || "",
        state: targetAddr.state || formData.state || "",
        zipCode: targetAddr.zipCode || formData.zipCode || "",
        country: targetAddr.country || formData.country || currentCountry?.name || "Pakistan",
        isDefault: targetAddr.isDefault ?? true,
      })
    } else {
      setEditingAddressId(null)
      setAddressDetails({
        name: formData.name || user?.name || "Home",
        phone: formData.phone || user?.phone || "",
        address: formData.address || "",
        city: formData.city || "",
        state: formData.state || "",
        zipCode: formData.zipCode || "",
        country: formData.country || currentCountry?.name || "Pakistan",
        isDefault: true,
      })
    }
    setShowAddressModal(true)
  }

  const handleEditAddressClick = (e, addr) => {
    if (e && typeof e.stopPropagation === "function") e.stopPropagation()
    handleEditAddress(addr)
  }

  // Save or update address in user account
  const handleAddressModalSubmit = async (e) => {
    e.preventDefault()
    const newAddress = {
      name: (addressDetails.name || formData.name || user?.name || "Home").trim(),
      phone: (addressDetails.phone || formData.phone || user?.phone || "").trim(),
      address: (addressDetails.address || "").trim(),
      city: (addressDetails.city || "").trim(),
      state: (addressDetails.state || "").trim(),
      zipCode: (addressDetails.zipCode || "").trim(),
      country: addressDetails.country || currentCountry?.name || "Pakistan",
    }

    if (!newAddress.address || !newAddress.city || !newAddress.state) {
      setError("Please fill in street address, city, and province/state.")
      showToast("Please fill in all required address fields", "error")
      return
    }

    if (user) {
      try {
        const token = localStorage.getItem("token")
        const payload = {
          name: newAddress.name,
          phone: newAddress.phone,
          email: formData.email || user.email || "",
          address: newAddress.address,
          city: newAddress.city,
          state: newAddress.state,
          zipCode: newAddress.zipCode,
          country: newAddress.country,
          isDefault: addressDetails.isDefault,
        }
        
        let response
        if (editingAddressId && editingAddressId !== "root-address") {
          response = await axios.put(`${config.API_URL}/api/users/addresses/${editingAddressId}`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          })
        } else {
          response = await axios.post(`${config.API_URL}/api/users/addresses`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          })
        }

        if (response?.data && Array.isArray(response.data)) {
          setSavedAddresses(response.data)
        }

        // Also update the root user address and phone on profile so it is persisted
        try {
          await axios.put(
            `${config.API_URL}/api/users/profile`,
            {
              phone: newAddress.phone,
              address: {
                street: newAddress.address,
                city: newAddress.city,
                state: newAddress.state,
                zipCode: newAddress.zipCode,
                country: newAddress.country,
              },
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          )
        } catch (profErr) {
          console.error("Profile sync error:", profErr)
        }
      } catch (err) {
        console.error("Error saving address:", err)
        showToast(err?.response?.data?.message || "Failed to save address", "error")
        return
      }
    }

    // Update formData immediately so checkout updates right away
    setFormData((prev) => ({
      ...prev,
      name: newAddress.name,
      phone: newAddress.phone,
      address: newAddress.address,
      city: newAddress.city,
      state: newAddress.state,
      zipCode: newAddress.zipCode,
      country: newAddress.country,
    }))

    setError(null)
    setShowAddressModal(false)
    setEditingAddressId(null)
    showToast("Address saved successfully!", "success")
  }

  // Save address entered directly into the inline form fields
  const handleSaveInlineAddress = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault()

    const newAddress = {
      name: (formData.name || user?.name || "Home").trim(),
      phone: (formData.phone || user?.phone || "").trim(),
      address: (formData.address || "").trim(),
      city: (formData.city || "").trim(),
      state: (formData.state || "").trim(),
      zipCode: (formData.zipCode || "").trim(),
      country: formData.country || currentCountry?.name || "Pakistan",
    }

    if (!newAddress.name) {
      setError("Please enter your full name")
      showToast("Please enter your full name", "error")
      return false
    }
    if (!newAddress.phone) {
      setError("Please enter your phone number")
      showToast("Please enter your phone number", "error")
      return false
    }
    if (!newAddress.address || !newAddress.city || !newAddress.state) {
      setError("Please provide street address, city, and province/state")
      showToast("Please provide street address, city, and province/state", "error")
      return false
    }

    if (user) {
      try {
        const token = localStorage.getItem("token")
        const payload = {
          name: newAddress.name,
          phone: newAddress.phone,
          email: formData.email || user.email || "",
          address: newAddress.address,
          city: newAddress.city,
          state: newAddress.state,
          zipCode: newAddress.zipCode,
          country: newAddress.country,
          isDefault: true,
        }

        const response = await axios.post(`${config.API_URL}/api/users/addresses`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (response?.data && Array.isArray(response.data)) {
          setSavedAddresses(response.data)
        }

        try {
          await axios.put(
            `${config.API_URL}/api/users/profile`,
            {
              phone: newAddress.phone,
              address: {
                street: newAddress.address,
                city: newAddress.city,
                state: newAddress.state,
                zipCode: newAddress.zipCode,
                country: newAddress.country,
              },
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          )
        } catch (profErr) {
          console.error("Profile sync error:", profErr)
        }
      } catch (err) {
        console.error("Error saving inline address:", err)
        showToast(err?.response?.data?.message || "Failed to save address", "error")
        return false
      }
    }

    setError(null)
    showToast("Delivery address saved successfully!", "success")
    return true
  }

  const handleContinueToSummary = async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault()
    if (deliveryType === "home") {
      if (!validateHomeDelivery()) return

      if (user && savedAddresses.length === 0 && formData.address) {
        await handleSaveInlineAddress()
      } else if (user && formData.address) {
        try {
          const token = localStorage.getItem("token")
          const payload = {
            phone: formData.phone,
            address: {
              street: formData.address,
              city: formData.city,
              state: formData.state,
              zipCode: formData.zipCode,
              country: formData.country || currentCountry?.name || "Pakistan",
            },
          }
          await axios.put(`${config.API_URL}/api/users/profile`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          })
        } catch (err) {
          // ignore error
        }
      }
    } else if (deliveryType === "pickup") {
      if (!validatePickup()) return
      if (user && pickupDetails.phone) {
        try {
          const token = localStorage.getItem("token")
          await axios.put(`${config.API_URL}/api/users/profile`, { phone: pickupDetails.phone }, {
            headers: { Authorization: `Bearer ${token}` },
          })
        } catch (err) {
          // ignore error
        }
      }
    }
    setError(null)
    if (step === 3) {
      setOpenReviewStep(null)
      return
    }
    setStep(2)
  }

  const handleContinueToPayment = () => {
    setStep(3)
  }

  // Save the delivery section of the stacked accordion: validate the essentials, run the
  // existing backend save, collapse this section and open the next one (Order notes).
  const handleSaveDelivery = (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault()
    if (deliveryType === "home") {
      if (!formData.email || !formData.phone) {
        setError("Please fill in email and phone number")
        return
      }
      if (!formData.address) {
        setShowAddressModal(true)
        return
      }
    } else if (deliveryType === "pickup") {
      if (!pickupDetails.phone || !pickupDetails.storeId) {
        setError("Please fill in phone number and select a store")
        return
      }
    }
    setError(null)
    // Reuse the existing side effects (saves phone/address to the profile for logged-in
    // users). It re-validates the same way and its internal setStep is harmless here.
    handleContinueToSummary(e || { preventDefault() {} })
    setShowAddressList(false)
  }

  const handleStoreSelection = (store) => {
    setPickupDetails({
      ...pickupDetails,
      storeId: store.storeId,
      location: store.name,
    })
    setSelectedStore(store)
  }

  const toggleShowAllItems = () => {
    setShowAllItems(!showAllItems)
  }

  useEffect(() => {
    // Load address from localStorage if available
    const savedAddress = localStorage.getItem("savedShippingAddress")
    if (savedAddress) {
      const parsed = JSON.parse(savedAddress)
      setFormData((prev) => ({ ...prev, ...parsed }))
    }
  }, [])

  useEffect(() => {
    if (!user) {
      const guestInfo = localStorage.getItem("guestInfo")
      if (guestInfo) {
        try {
          const parsed = JSON.parse(guestInfo)
          setFormData((prev) => ({
            ...prev,
            email: parsed.email || prev.email,
            phone: parsed.phone || prev.phone,
          }))
          setPickupDetails((prev) => ({
            ...prev,
            phone: prev.phone || parsed.phone || "",
          }))
        } catch { }
      }
    }
  }, [user])

  // On mount, check for step query param
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const stepParam = Number.parseInt(params.get("step"), 10)
    if ([1, 2, 3].includes(stepParam)) {
      setStep(stepParam)
    }
  }, [location.search])

  // Fetch user profile and pre-fill address/phone if logged in
  useEffect(() => {
    let isMounted = true
    const fetchUserProfile = async () => {
      if (!user) return
      try {
        const token = localStorage.getItem("token")
        if (!token) return

        const { data } = await axios.get(`${config.API_URL}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!isMounted) return

        const userAddresses = Array.isArray(data.addresses) && data.addresses.length > 0
          ? data.addresses
          : (data.address?.street
            ? [{
                _id: "root-address",
                name: data.name || user?.name || "Home",
                phone: data.phone || user?.phone || "",
                address: data.address.street,
                city: data.address.city || "",
                state: data.address.state || "",
                zipCode: data.address.zipCode || "",
                country: data.address.country || currentCountry?.name || "Pakistan",
                isDefault: true,
              }]
            : [])
        setSavedAddresses(userAddresses)

        const defaultAddr = userAddresses.find((a) => a.isDefault) || userAddresses[0]

        // Pre-fill formData
        setFormData((prev) => ({
          ...prev,
          name: defaultAddr?.name || data.name || prev.name || user?.name || "",
          email: defaultAddr?.email || data.email || prev.email || user?.email || "",
          phone: defaultAddr?.phone || data.phone || prev.phone || user?.phone || "",
          address: defaultAddr ? defaultAddr.address : (data.address?.street || prev.address || ""),
          city: defaultAddr ? defaultAddr.city : (data.address?.city || prev.city || ""),
          state: defaultAddr ? defaultAddr.state : (data.address?.state || prev.state || ""),
          zipCode: defaultAddr ? defaultAddr.zipCode : (data.address?.zipCode || prev.zipCode || ""),
          country: currentCountry?.name || defaultAddr?.country || data.address?.country || prev.country || "Pakistan",
        }))
        setPickupDetails((prev) => ({
          ...prev,
          phone: defaultAddr?.phone || data.phone || prev.phone || user?.phone || "",
        }))
      } catch (err) {
        console.error("Error loading user profile:", err)
      }
    }
    fetchUserProfile()
    return () => {
      isMounted = false
    }
  }, [user, currentCountry?.name])

  // Sync phone number between forms when switching delivery type
  useEffect(() => {
    if (deliveryType === "pickup" && !pickupDetails.phone && formData.phone) {
      setPickupDetails((prev) => ({ ...prev, phone: formData.phone }))
    } else if (deliveryType === "home" && !formData.phone && pickupDetails.phone) {
      setFormData((prev) => ({ ...prev, phone: pickupDetails.phone }))
    }
  }, [deliveryType])

  // Switching to pickup with no store chosen yet auto-selects the first available store, so
  // the shopper lands on a usable selection instead of an empty picker.
  useEffect(() => {
    if (deliveryType !== "pickup" || pickupDetails.storeId) return
    const first = STORES.find((s) => s.visible !== false)
    if (first) handleStoreSelection(first)
    // handleStoreSelection is stable within a render; re-running on its identity is unwanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryType])

  const bounceStyle = {
    animation: "bounce 1s infinite",
  }

  // Track begin_checkout event
  useEffect(() => {
    if (cartItems.length > 0) {
      window.dataLayer = window.dataLayer || []
      window.dataLayer.push({
        event: "begin_checkout",
        ecommerce: {
          currency: "PKR",
          value: finalTotal,
          coupon: coupon?.code || undefined,
          items: cartItems.map((item) => ({
            item_id: item._id,
            item_name: item.name,
            item_category: item.parentCategory?.name || item.category?.name || "Uncategorized",
            item_brand: item.brand?.name || "Unknown",
            price: item.offerPrice && item.offerPrice > 0 ? item.offerPrice : item.price,
            quantity: item.quantity,
          })),
        },
      })

      console.log("Begin checkout tracked, total:", finalTotal) // For debugging
    }
  }, []) // Run only once when component mounts

  if (cartItems.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 text-center">
        <h2 className="text-2xl font-bold mb-4"><TranslatedText>Your cart is empty</TranslatedText></h2>
        <p className="text-gray-600 mb-6"><TranslatedText>Add some items to your cart before checkout.</TranslatedText></p>
        <button onClick={() => navigate(getLocalizedPath("/"))} className="bg-lime-500 hover:bg-lime-600 text-white rounded-lg px-6 py-2">
          <TranslatedText>Continue Shopping</TranslatedText>
        </button>
      </div>
    )
  }

  // Determine which items to show (exclude protections)
  const itemsToShow = showAllItems ? regularCartItems : regularCartItems.slice(0, 2)
  const remainingItemsCount = regularCartItems.length - 2

  // ---- The three steps' bodies, as functions so the payment step can show the first
  //      two folded up and still editable. `inline` swaps the navigation buttons for
  //      Save/Done and drops what the folded section already shows.
  // Collection is only offered when there is somewhere to collect from. With no stores
  // on file the radio pair would lead to an empty picker and a dead end.
  const hasPickupStores = STORES.some((store) => store.visible !== false)

  // Two buttons rather than two radios. A radio and its label give a thumb a target a
  // few pixels tall; this is the first choice on the page and it has to be hit without
  // aiming. The picked one is filled, so the state is still obvious at a glance.
  const renderDeliveryTypeRadios = () =>
    hasPickupStores ? (
      <div className="mb-6 grid grid-cols-2 gap-3">
        {[
          { id: "home", label: "Home Delivery", hint: "Delivered to your address", Icon: Truck },
          { id: "pickup", label: "Pickup From Store", hint: "Collect in person", Icon: MapPin },
        ].map(({ id, label, hint, Icon }) => {
          const active = deliveryType === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setDeliveryType(id)}
              aria-pressed={active}
              className={`flex flex-col items-start gap-1 border px-4 py-3 text-left transition-colors ${
                active
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white text-stone-900 hover:border-stone-500"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon size={16} strokeWidth={1.8} />
                <TranslatedText>{label}</TranslatedText>
              </span>
              <span className={`text-xs ${active ? "text-white/70" : "text-stone-500"}`}>
                <TranslatedText>{hint}</TranslatedText>
              </span>
            </button>
          )
        })}
      </div>
    ) : null

  const renderShippingForm = (inline = false, hideActions = false) => (
    <>
      {deliveryType === "home" && (
        <form onSubmit={handleContinueToSummary}>
          <h3 className="font-bold text-sm mb-3"><TranslatedText>Contact Details</TranslatedText></h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium mb-1"><TranslatedText>Full Name</TranslatedText> *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Full Name"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1"><TranslatedText>E-mail</TranslatedText> *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email address"
                className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1"><TranslatedText>Phone number</TranslatedText> *</label>
              <PhoneInput
                international
                defaultCountry="PK"
                value={withDialCode(formData.phone)}
                onChange={(value) => setFormData({ ...formData, phone: value || '' })}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                placeholder="Enter phone number"
              />
            </div>
          </div>

          {/* Saved Addresses Section */}
          {user && savedAddresses.length > 0 && (
            <div className="mb-4">
              {!showAddressList ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900">
                      <TranslatedText>Delivery Address</TranslatedText>
                    </h4>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleEditAddress()}
                        className="text-xs font-semibold text-lime-700 hover:underline"
                      >
                        <TranslatedText>Edit</TranslatedText>
                      </button>
                      {savedAddresses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setShowAddressList(true)}
                          className="text-xs font-semibold text-stone-600 hover:underline"
                        >
                          <TranslatedText>Change</TranslatedText>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEditAddress(null)}
                        className="text-xs font-semibold text-stone-600 hover:underline flex items-center gap-1"
                      >
                        <Plus size={14} />
                        <TranslatedText>Add New</TranslatedText>
                      </button>
                    </div>
                  </div>
                  {(() => {
                    const selectedAddr =
                      savedAddresses.find(
                        (a) => a.address === formData.address && a.city === formData.city,
                      ) || savedAddresses[0]
                    if (!selectedAddr) return null
                    return (
                      <div className="rounded-xl border-2 border-lime-500 bg-lime-50/40 p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-lime-600">
                              <span className="h-2.5 w-2.5 rounded-full bg-lime-600" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900">{selectedAddr.name}</p>
                              <p className="text-sm text-gray-700">
                                {[selectedAddr.address, selectedAddr.city, selectedAddr.state, selectedAddr.country]
                                  .filter(Boolean)
                                  .join(", ")}
                                {selectedAddr.zipCode ? ` - ${selectedAddr.zipCode}` : ""}
                              </p>
                              {selectedAddr.phone && (
                                <p className="text-xs text-gray-600 mt-1">
                                  <TranslatedText>Phone:</TranslatedText> {selectedAddr.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleEditAddress(selectedAddr)}
                            className="text-xs font-semibold text-lime-700 hover:underline flex-shrink-0"
                          >
                            <TranslatedText>Edit</TranslatedText>
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900">
                      <TranslatedText>Delivery Addresses</TranslatedText> ({savedAddresses.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddressList(false)}
                      className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                    >
                      <TranslatedText>Close</TranslatedText>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {savedAddresses.map((addr) => {
                      const isSelected = formData.address === addr.address && formData.city === addr.city
                      return (
                        <label
                          key={addr._id}
                          className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 transition ${
                            isSelected ? "border-lime-500 bg-lime-50/30" : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <input
                              type="radio"
                              name="deliveryAddress"
                              checked={isSelected}
                              onChange={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  name: addr.name || prev.name,
                                  phone: addr.phone || prev.phone,
                                  address: addr.address,
                                  city: addr.city,
                                  state: addr.state,
                                  zipCode: addr.zipCode,
                                  country: addr.country || currentCountry?.name || "Pakistan",
                                }))
                                setShowAddressList(false)
                              }}
                              className="mt-1 h-4 w-4 shrink-0 accent-lime-600"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900">{addr.name}</p>
                              <p className="text-sm text-gray-700">
                                {[addr.address, addr.city, addr.state, addr.country].filter(Boolean).join(", ")}
                                {addr.zipCode ? ` - ${addr.zipCode}` : ""}
                              </p>
                              {addr.phone && (
                                <p className="text-xs text-gray-600 mt-0.5">
                                  <TranslatedText>Phone:</TranslatedText> {addr.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleEditAddress(addr)
                            }}
                            className="text-xs font-semibold text-lime-700 hover:underline flex-shrink-0"
                          >
                            <TranslatedText>Edit</TranslatedText>
                          </button>
                        </label>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleEditAddress(null)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-lime-700 hover:underline"
                    >
                      <Plus size={16} />
                      <TranslatedText>Add a new delivery address</TranslatedText>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddressList(false)}
                      className="text-xs text-stone-500 hover:underline"
                    >
                      <TranslatedText>Done</TranslatedText>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* When user has no savedAddresses list, but has an address in formData */}
          {formData.address && (!user || savedAddresses.length === 0) && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3.5">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-sm mb-1 text-gray-900"><TranslatedText>Shipping Address</TranslatedText></h4>
                  <div className="text-sm text-gray-700">{formData.address}</div>
                  <div className="text-sm text-gray-700">
                    {[formData.city, formData.state, formData.zipCode, formData.country].filter(Boolean).join(", ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleEditAddress()}
                  className="text-xs font-semibold text-lime-700 hover:underline"
                >
                  <TranslatedText>Edit Address</TranslatedText>
                </button>
              </div>
            </div>
          )}

          {/* When user has NO saved addresses and NO formData.address: Provide complete, clear address form right here */}
          {!formData.address && savedAddresses.length === 0 && (
            <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    <TranslatedText>Delivery Address</TranslatedText>
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <TranslatedText>Please provide your complete delivery address below.</TranslatedText>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleEditAddress(null)}
                  className="text-xs font-semibold text-lime-700 hover:underline flex items-center gap-1"
                >
                  <Plus size={14} />
                  <TranslatedText>Open in Window</TranslatedText>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={addressLabelClass}>
                    <TranslatedText>Country</TranslatedText> <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      className={addressSelectClass}
                      value={formData.country || currentCountry?.name || "Pakistan"}
                      onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value, state: "" }))}
                      required
                    >
                      {(countries || []).map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className={addressLabelClass}>
                    <TranslatedText>Complete Street Address</TranslatedText> <span className="text-red-500">*</span>
                  </label>
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(v) => setFormData((prev) => ({ ...prev, address: v }))}
                    onSelect={(sel) =>
                      setFormData((prev) => ({
                        ...prev,
                        address: sel.address,
                        city: sel.city || prev.city,
                        state: sel.state || prev.state,
                        zipCode: sel.zipCode || prev.zipCode,
                      }))
                    }
                    countryName={formData.country || currentCountry?.name || "Pakistan"}
                    countryCode={(countries || []).find((c) => c.name === (formData.country || currentCountry?.name))?.code || currentCountry?.code}
                    inputClassName={addressInputClass}
                    placeholder="House/Apartment number, street name, area"
                    required
                  />
                </div>

                <div>
                  <label className={addressLabelClass}>
                    <TranslatedText>State / Province</TranslatedText> <span className="text-red-500">*</span>
                  </label>
                  {(() => {
                    const selectedCountryName = formData.country || currentCountry?.name || "Pakistan"
                    const provinces = getProvincesForCountry(selectedCountryName)
                    if (provinces && provinces.length > 0) {
                      return (
                        <div className="relative">
                          <select
                            className={addressSelectClass}
                            value={formData.state}
                            onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                            required
                          >
                            <option value="">Select Province</option>
                            {provinces.map((prov) => (
                              <option key={prov} value={prov}>
                                {prov}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                      )
                    }
                    return (
                      <input
                        type="text"
                        className={addressInputClass}
                        value={formData.state}
                        onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                        placeholder="State / Province"
                        required
                      />
                    )
                  })()}
                </div>

                <div>
                  <label className={addressLabelClass}>
                    <TranslatedText>City</TranslatedText> <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className={addressInputClass}
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={addressLabelClass}>
                    <TranslatedText>Postal / ZIP Code</TranslatedText>{" "}
                    <span className="font-normal text-gray-400">
                      (<TranslatedText>optional</TranslatedText>)
                    </span>
                  </label>
                  <input
                    type="text"
                    className={addressInputClass}
                    value={formData.zipCode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, zipCode: e.target.value }))}
                    placeholder="e.g. 54000"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveInlineAddress}
                  className="rounded-lg bg-lime-600 px-4 py-2 text-xs font-semibold text-white hover:bg-lime-700 transition"
                >
                  <TranslatedText>Save Address</TranslatedText>
                </button>
              </div>
            </div>
          )}

          {!hideActions && (
            <div className="mt-8 flex gap-4">
              {!inline && (
                <button
                  type="button"
                  onClick={() => navigate(getLocalizedPath("/cart"))}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 bg-white font-semibold lg:py-3 lg:px-6 py-2 px-3 rounded-lg transition duration-300"
                >
                  <TranslatedText>Back to Cart</TranslatedText>
                </button>
              )}
              <button
                type="submit"
                className="flex-1 bg-lime-500 hover:bg-lime-600 text-white font-semibold lg:py-3 lg:px-6 py-2 px-3 rounded-lg transition duration-300"
              >
                {inline ? (
                  <TranslatedText>Save changes</TranslatedText>
                ) : (
                  <>
                    <span className="block lg:hidden"><TranslatedText>Continue Summary</TranslatedText></span>
                    <span className="hidden lg:block"><TranslatedText>Continue to Summary</TranslatedText></span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      )}

                  {deliveryType === "pickup" && (
                    <form onSubmit={handleContinueToSummary}>
                      <h3 className="font-bold text-sm mb-3"><TranslatedText>Where do you want to pick up?</TranslatedText></h3>

                      <div className="mb-4">
                        <label className="block text-xs font-medium mb-1"><TranslatedText>Phone number</TranslatedText> *</label>
                        <div className="max-w-md">
                          <PhoneInput
                            international
                            defaultCountry="PK"
                            value={pickupDetails.phone}
                            onChange={(value) => setPickupDetails({ ...pickupDetails, phone: value || '' })}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="Enter phone number"
                          />
                        </div>
                      </div>

                      {/* The chosen store as a one-line readback; the list and the map
                          open over the page and close on Done. */}
                      <div className="mb-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            <MapPin className="h-4 w-4 text-stone-500" />
                            <TranslatedText>Collection store</TranslatedText> *
                          </h4>
                          {selectedStore && (
                            <button
                              type="button"
                              onClick={() => setShowStorePicker(true)}
                              className="text-sm font-semibold text-stone-900 underline underline-offset-4 hover:text-brand-700"
                            >
                              <TranslatedText>Change store</TranslatedText>
                            </button>
                          )}
                        </div>

                        {selectedStore ? (
                          <div className="flex items-start gap-3 border border-stone-900 bg-stone-50 p-3">
                            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-stone-900">
                              <span className="h-2.5 w-2.5 rounded-full bg-stone-900" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900">{selectedStore.name}</p>
                              <p className="text-sm text-gray-700">{selectedStore.address}</p>
                              <p className="mt-1 text-sm text-gray-600">{selectedStore.phone}</p>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowStorePicker(true)}
                            className="flex w-full items-center justify-between gap-3 border border-dashed border-stone-300 px-4 py-4 text-left transition-colors hover:border-stone-500"
                          >
                            <span className="text-sm text-stone-600">
                              <TranslatedText>Choose where to collect your order</TranslatedText>
                            </span>
                            <span className="text-sm font-semibold text-stone-900 underline underline-offset-4">
                              <TranslatedText>Select store</TranslatedText>
                            </span>
                          </button>
                        )}
                      </div>

                      {showStorePicker && (
                        <div
                          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
                          role="dialog"
                          aria-modal="true"
                          aria-label="Select a collection store"
                        >
                          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col bg-white shadow-xl">
                            <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-200 px-5 py-3">
                              <h5 className="text-sm font-bold text-gray-900">
                                <TranslatedText>Select a store</TranslatedText>
                              </h5>
                              <button
                                type="button"
                                onClick={() => setShowStorePicker(false)}
                                className="text-stone-400 transition-colors hover:text-stone-900"
                                aria-label="Close"
                              >
                                <X size={18} />
                              </button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto">
                              <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
                                <div className="space-y-3">
                                  {STORES.filter((store) => store.visible !== false).map((store) => {
                                    const isSelected = pickupDetails.storeId === store.storeId
                                    return (
                                      <button
                                        key={store.storeId}
                                        type="button"
                                        onClick={() => handleStoreSelection(store)}
                                        className={`flex w-full items-start gap-3 border p-4 text-left transition-colors ${
                                          isSelected
                                            ? "border-stone-900 bg-stone-50"
                                            : "border-stone-200 hover:border-stone-400"
                                        }`}
                                      >
                                        <span
                                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                                            isSelected ? "border-stone-900" : "border-stone-300"
                                          }`}
                                        >
                                          {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-stone-900" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block font-semibold text-gray-900">{store.name}</span>
                                          <span className="mt-1 block text-sm leading-relaxed text-gray-600">{store.address}</span>
                                          <span className="mt-2 block text-sm font-medium text-stone-700">{store.phone}</span>
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>

                                <div className="lg:sticky lg:top-0">
                                  {selectedStore ? (
                                    <div className="overflow-hidden border border-stone-200">
                                      <div className="border-b border-stone-200 bg-stone-50 p-3">
                                        <h6 className="font-semibold text-gray-900">{selectedStore.name}</h6>
                                        <p className="mt-1 text-sm text-gray-600">{selectedStore.phone}</p>
                                      </div>
                                      <div className="h-56 sm:h-64">
                                        <iframe
                                          className="h-full w-full border-0"
                                          src={selectedStore.mapEmbedUrl}
                                          loading="lazy"
                                          allowFullScreen
                                          referrerPolicy="no-referrer-when-downgrade"
                                          title={`Map of ${selectedStore.name}`}
                                        ></iframe>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex h-56 items-center justify-center border border-stone-200 bg-stone-50 sm:h-64">
                                      <div className="text-center text-gray-500">
                                        <MapPin className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                                        <p className="font-medium"><TranslatedText>Select a store to view location</TranslatedText></p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-stone-200 px-5 py-3">
                              <button
                                type="button"
                                onClick={() => setShowStorePicker(false)}
                                className="px-4 py-2.5 text-sm font-semibold text-stone-600 transition-colors hover:text-stone-900"
                              >
                                <TranslatedText>Cancel</TranslatedText>
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowStorePicker(false)}
                                disabled={!pickupDetails.storeId}
                                className="bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
                              >
                                <TranslatedText>Done</TranslatedText>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {!hideActions && (
                      <button
                        type="submit"
                        className="bg-lime-500 hover:bg-lime-600 text-white rounded-lg px-6 py-2 disabled:opacity-50"
                        disabled={!pickupDetails.phone || !pickupDetails.storeId}
                      >
                        {inline ? <TranslatedText>Save changes</TranslatedText> : <TranslatedText>Continue</TranslatedText>}
                      </button>
                      )}
                    </form>
                  )}
    </>
  )

  const renderSummaryContent = (inline = false, hideActions = false) => (
    <div>
                  {/* Inline on the payment step the delivery details already sit in the
                      section above, so only the notes are repeated. */}
                  {!inline && (
                    <>
                  <h3 className="font-bold text-sm mb-3"><TranslatedText>Order Summary</TranslatedText></h3>
                  <div className="mb-4">
                    <h4 className="font-semibold mb-2"><TranslatedText>Delivery Details</TranslatedText></h4>
                    {deliveryType === "home" ? (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="font-medium"><TranslatedText>Home Delivery</TranslatedText></div>
                        <div className="text-sm text-gray-600 mt-1">
                          {formData.name && <div>{formData.name}</div>}
                          <div>{formData.email}</div>
                          <div>{withDialCode(formData.phone)}</div>
                          <div>{formData.address}</div>
                          <div>
                            {formData.city}, {formData.state} {formData.zipCode}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="font-medium"><TranslatedText>Store Pickup</TranslatedText></div>
                        <div className="text-sm text-gray-600 mt-1">
                          <div><TranslatedText>Phone:</TranslatedText> {withDialCode(pickupDetails.phone)}</div>
                          {selectedStore && (
                            <>
                              <div className="font-medium mt-2">{selectedStore.name}</div>
                              <div>{selectedStore.address}</div>
                              <div>{selectedStore.phone}</div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                    </>
                  )}

                  <div className="mb-4">
                    <h4 className="font-semibold mb-2"><TranslatedText>Order Notes (Optional)</TranslatedText></h4>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <label className="block text-xs font-medium mb-2"><TranslatedText>Add a note to your order:</TranslatedText></label>
                      <textarea
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                        rows="3"
                        placeholder="Special delivery instructions, gift message, or any other notes..."
                        maxLength="500"
                      />
                      <div className="text-xs text-gray-500 mt-1">{customerNotes.length}/500 characters</div>
                    </div>
                  </div>

                  {!hideActions && (inline ? (
                    <button
                      type="button"
                      onClick={() => setOpenReviewStep(null)}
                      className="bg-lime-500 hover:bg-lime-600 text-white rounded-lg px-6 py-2"
                    >
                      <TranslatedText>Done</TranslatedText>
                    </button>
                  ) : (
                    <div className="flex gap-4">
                      <button
                        onClick={() => setStep(1)}
                        className="border border-gray-300 text-gray-700 rounded-lg px-6 py-2"
                      >
                        <TranslatedText>Back</TranslatedText>
                      </button>
                      <button
                        onClick={handleContinueToPayment}
                        className="bg-lime-500 hover:bg-lime-600 text-white rounded-lg px-6 py-2"
                      >
                        <TranslatedText>Continue to Payment</TranslatedText>
                      </button>
                    </div>
                  ))}
    </div>
  )

  // One-line readbacks for the folded sections on the payment step.
  // The collapsed delivery card: the two delivery choices as radio pills (the picked one
  // filled) plus the chosen address / store on the line below -- a readback, not a control;
  // tapping the card (or "Change") reopens the section to edit it.
  const deliveryDetailLine =
    deliveryType === "home"
      ? formData.address
        ? [formData.name, formData.address, formData.city, formData.state, formData.country]
            .filter(Boolean)
            .join(", ")
        : "No delivery address selected yet"
      : selectedStore
        ? [selectedStore.name, selectedStore.address].filter(Boolean).join(" · ")
        : "No pickup store selected yet"
  const deliveryRadioDot = (active) => (
    <span
      className={`grid h-4 w-4 place-items-center rounded-full border-2 ${active ? "border-lime-600" : "border-gray-300"}`}
    >
      {active && <span className="h-2 w-2 rounded-full bg-lime-600" />}
    </span>
  )
  // The Home Delivery / Pickup toggle, shown in the collapsed card too. It uses clickable
  // spans (not inputs) so it stays valid inside the section-header button; stopPropagation
  // keeps a tap from also toggling the accordion.
  const deliveryTypeToggle = (
    <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
      <span
        onClick={(e) => {
          e.stopPropagation()
          setDeliveryType("home")
        }}
        className={`inline-flex cursor-pointer items-center gap-1.5 font-semibold ${deliveryType === "home" ? "text-gray-900" : "text-gray-500"}`}
      >
        {deliveryRadioDot(deliveryType === "home")}
        <TranslatedText>Home Delivery</TranslatedText>
      </span>
      <span
        onClick={(e) => {
          e.stopPropagation()
          setDeliveryType("pickup")
        }}
        className={`inline-flex cursor-pointer items-center gap-1.5 font-semibold ${deliveryType === "pickup" ? "text-gray-900" : "text-gray-500"}`}
      >
        {deliveryRadioDot(deliveryType === "pickup")}
        <TranslatedText>Pickup From Store</TranslatedText>
      </span>
    </span>
  )
  const deliverySummaryNode = (
    <span className="block">
      {deliveryTypeToggle}
      {deliveryType === "home" && formData.name && (
        <span className="mt-1 block text-gray-600">
          <TranslatedText>Delivering to</TranslatedText> {formData.name}
        </span>
      )}
      <span className="mt-0.5 block truncate text-gray-500">{deliveryDetailLine}</span>
    </span>
  )
  const notesSummary = customerNotes.trim() ? `Note: ${customerNotes.trim()}` : "No order notes"

  // Jump from the invoice's Edit buttons to the section that owns that line.
  const goToSection = (sectionId) => {
    const el = document.getElementById(sectionId)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  const paymentSummary =
    PAYMENT_METHODS.find((m) => m.id === selectedPaymentMethod)?.name || "Choose how you'd like to pay"

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-lime-600" />
        <p className="text-sm font-medium text-stone-500">
          <TranslatedText>Checking your account…</TranslatedText>
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-stone-200 border-t-lime-600" />
        <p className="text-sm font-medium text-stone-500">
          <TranslatedText>Redirecting to sign in…</TranslatedText>
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-8 text-sm sm:px-6 lg:px-8">
      <div>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-16">
          <div className="divide-y divide-stone-200">
            {error && (
              <div className="mb-5 border border-red-300 bg-red-50 px-4 py-3 text-red-700">{error}</div>
            )}

            {/* Returning customer. A shopper who is already signed in with an address on
                file was being shown the same blank-looking form as a first-time visitor,
                with nothing to say their details were already known. This opens the page
                by naming the account and where the order is going. */}
            {user && (
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">
                    <TranslatedText>Welcome back</TranslatedText>
                    {user.name ? `, ${String(user.name).split(" ")[0]}` : ""}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-stone-600">{user.email}</p>
                  {deliveryType === "home" && formData.address && (
                    <p className="mt-1 truncate text-xs text-stone-600">
                      <TranslatedText>Delivering to</TranslatedText>{" "}
                      {[formData.address, formData.city].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-4 text-sm">
                  {deliveryType === "home" && (
                    <button
                      type="button"
                      onClick={() => handleEditAddress()}
                      className="font-semibold text-stone-900 underline underline-offset-4 hover:text-brand-700"
                    >
                      <TranslatedText>{formData.address ? "Edit address" : "Add address"}</TranslatedText>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => goToSection("checkout-payment")}
                    className="font-semibold text-stone-900 underline underline-offset-4 hover:text-brand-700"
                  >
                    <TranslatedText>Go to payment</TranslatedText>
                  </button>
                </div>
              </div>
            )}

            {/* Delivery */}
            <ReviewSection
              id="checkout-delivery"
              title={<TranslatedText>Delivery</TranslatedText>}
              action={
                !user && (
                  <Link
                    to={getLocalizedPath("/login")}
                    className="text-sm text-stone-900 underline underline-offset-4 hover:text-brand-600"
                  >
                    <TranslatedText>Sign in</TranslatedText>
                  </Link>
                )
              }
            >
              {renderDeliveryTypeRadios()}
              {renderShippingForm(true, true)}
            </ReviewSection>

            {/* Order notes */}
            <ReviewSection id="checkout-notes" title={<TranslatedText>Delivery Notes / Delivery Instruction</TranslatedText>}>
              {renderSummaryContent(true, true)}
            </ReviewSection>

            {/* Payment */}
            <ReviewSection id="checkout-payment" title={<TranslatedText>Payment</TranslatedText>}>
              <p className="-mt-2 mb-5 text-sm text-stone-500">
                <TranslatedText>All transactions are secure and encrypted.</TranslatedText>
              </p>
                  {/* Offers & rewards — coupon, referral reward and Grabian Points sit above
                      the payment options; the totals they change show in the Order Summary. */}
                  <div className="mb-4 border-b border-gray-100 pb-4">
                    {/* Gift card / promo code (Amazon-style) — kept to half width. */}
                    <div className="md:w-1/2">
                      <div className="flex items-center gap-2">
                        <Plus size={18} className="shrink-0 text-gray-400" />
                        <label className="text-sm font-bold text-gray-900">
                          <TranslatedText>Enter coupon code</TranslatedText>
                        </label>
                      </div>
                      {blockCoupon ? (
                        <p className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                          {pointsApplied ? (
                            <TranslatedText>Remove your Grabian Points to use a coupon.</TranslatedText>
                          ) : (
                            <TranslatedText>Remove your referral discount to use a coupon.</TranslatedText>
                          )}
                        </p>
                      ) : (
                        <>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-lime-500 focus:outline-none focus:ring-2 focus:ring-lime-100"
                              placeholder="Enter code"
                              value={coupon ? coupon.code : couponInput}
                              onChange={(e) => setCouponInput(e.target.value)}
                              disabled={!!coupon}
                            />
                            {!coupon ? (
                              <button
                                type="button"
                                className="rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50"
                                onClick={handleApplyCoupon}
                                disabled={couponLoading || !couponInput}
                              >
                                {couponLoading ? <TranslatedText>Applying...</TranslatedText> : <TranslatedText>Apply</TranslatedText>}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="rounded-full border border-red-300 px-6 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                                onClick={() => {
                                  setCoupon(null)
                                  setCouponDiscount(0)
                                  setCouponInput("")
                                  setCouponError("")
                                }}
                              >
                                <TranslatedText>Remove</TranslatedText>
                              </button>
                            )}
                          </div>
                          {couponError && <div className="mt-1 text-xs text-red-500">{couponError}</div>}
                        </>
                      )}
                    </div>

                    {/* Quick links: only ONE discount at a time — coupon, Grabian Points or
                        referral. Each link is hidden/disabled while another is applied. */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                      {!blockCoupon && (
                        <button
                          type="button"
                          onClick={handleOpenCouponsModal}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-lime-700 hover:underline"
                        >
                          <Ticket size={16} />
                          <TranslatedText>Available Coupons</TranslatedText>
                        </button>
                      )}
                      {loyaltyEnabled && !blockPoints && (
                        <button
                          type="button"
                          onClick={() => setShowPointsModal(true)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:underline"
                        >
                          <GrabCoin size={16} />
                          <TranslatedText>Use Grabian Points</TranslatedText>
                          {loyaltyPointsToRedeem > 0 && (
                            <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                              − {formatPrice(appliedLoyaltyDiscount)}
                            </span>
                          )}
                        </button>
                      )}
                      {/* Referral discount — hidden while a coupon or points are applied. */}
                      {referralEnabled && !blockReferral && (
                        <button
                          type="button"
                          onClick={() => setShowReferralModal(true)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-lime-700 hover:underline"
                        >
                          <Gift size={16} />
                          <TranslatedText>Use Referral Discount</TranslatedText>
                          {referralRewardId && appliedReferralDiscount > 0 && (
                            <span className="ml-1 rounded-full bg-lime-100 px-2 py-0.5 text-xs font-bold text-lime-700">
                              − {formatPrice(appliedReferralDiscount)}
                            </span>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Sync + apply referral rewards. Mounted whenever a referral discount is
                        allowed so a basket change keeps the value correct; the link opens it. */}
                    {referralEnabled && !blockReferral && (
                      <ReferralRewardModal
                        open={showReferralModal}
                        onClose={() => setShowReferralModal(false)}
                        eligibleAmountAed={referralEligibleAmount}
                        selectedRewardId={referralRewardId}
                        onApply={applyReferralReward}
                        onClear={clearReferralReward}
                        formatPrice={formatPrice}
                      />
                    )}
                  </div>

                  <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                    {PAYMENT_METHODS.filter(method => allowedPaymentMethods.includes(method.id)).map((method) => {
                      const isSelected = selectedPaymentMethod === method.id;
                      return (
                        <div
                          key={method.id}
                          className={`transition-all duration-200 ${
                            isSelected
                              ? "border-2 border-blue-600 -mt-px -mx-px z-10 relative first:rounded-t-2xl last:rounded-b-2xl bg-white shadow-sm"
                              : "border-b border-gray-200 last:border-b-0"
                          }`}
                        >
                          {/* Header row */}
                          <div
                            className={`flex items-center justify-between px-4 py-2.5 cursor-pointer select-none ${
                              isSelected ? "bg-[#f4f8ff]/50" : "hover:bg-gray-50/50"
                            }`}
                            onClick={() => handlePaymentMethodSelect(method.id)}
                          >
                            <div className="flex items-center gap-3">
                              {/* Custom Radio Button */}
                              <div className="flex items-center justify-center">
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-full border-2 border-blue-600 flex items-center justify-center bg-white">
                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white" />
                                )}
                              </div>
                              <span className="font-semibold text-gray-900 text-sm">
                                <TranslatedText>{method.name}</TranslatedText>
                              </span>
                            </div>

                            {/* Logos on right */}
                            <div>
                              {renderPaymentLogos(method.id)}
                            </div>
                          </div>

                          {/* Expandable redirect message */}
                          {isSelected && (
                            <div className="bg-gray-50 border-t border-gray-200 px-10 py-3">
                              <p className="text-sm font-medium text-gray-700">
                                <TranslatedText>{method.description}</TranslatedText>
                              </p>
                              {currentPaymentChargesData?.charges?.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {currentPaymentChargesData.charges.map((charge, idx) => {
                                    let computedAmount = Number(charge.amount) || 0;
                                    if (charge.type === "percentage") {
                                      computedAmount = (cartTotals.totalOfferPrice + protectionTotal) * (computedAmount / 100);
                                    }
                                    return (
                                      <p key={idx} className="text-xs font-semibold text-red-600" lang="en" dir="ltr">
                                        • {charge.name}: {charge.type === "percentage" ? `${charge.amount}% (${formatPrice(computedAmount)})` : formatPrice(charge.amount)}
                                      </p>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
            </ReviewSection>

            {/* Review items — the products in this order, with quantity controls. */}
            <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-2.5 sm:px-5">
                <h2 className="text-sm font-bold text-gray-900">
                  <TranslatedText>Review your items</TranslatedText>
                </h2>
              </div>
              <div className="flex flex-col lg:flex-row">
              <div className="divide-y divide-gray-100 lg:flex-1 lg:min-w-0">
                {regularCartItems.map((item, idx) => {
                  const sizeStock = item.selectedSizeData && item.selectedSizeData.countInStock !== undefined && item.selectedSizeData.countInStock !== null
                    ? Number(item.selectedSizeData.countInStock)
                    : (item.countInStock !== undefined && item.countInStock !== null ? Number(item.countInStock) : null)
                  const sizeLabel = item.selectedSizeData?.code || item.selectedSizeData?.name
                  const isOutOfStock = sizeStock !== null && sizeStock <= 0
                  const maxStockLimit = sizeStock !== null ? sizeStock : (item.maxPurchaseQty || 9999)
                  const effectiveMaxQty = item.maxPurchaseQty ? Math.min(item.maxPurchaseQty, maxStockLimit) : maxStockLimit
                  const atMax = item.quantity >= effectiveMaxQty || isOutOfStock
                  const pd = getItemPricingDetails(item)
                  const lineIdentifier = item.cartId || item._id

                  const handleDecreaseQty = () => {
                    if (item.quantity <= 1) return
                    updateQuantity(lineIdentifier, item.quantity - 1, item.bundleId)
                  }

                  const handleIncreaseQty = () => {
                    if (isOutOfStock) {
                      showToast(sizeLabel ? `Size ${sizeLabel} is currently out of stock.` : `${item.name} is currently out of stock.`, "error")
                      return
                    }
                    if (item.quantity >= effectiveMaxQty) {
                      if (sizeStock !== null && item.quantity >= sizeStock) {
                        showToast(sizeLabel ? `Only ${sizeStock} units are available in size ${sizeLabel}.` : `Only ${sizeStock} units are available.`, "error")
                      } else if (item.maxPurchaseQty && item.quantity >= item.maxPurchaseQty) {
                        showToast(`Maximum purchase limit of ${item.maxPurchaseQty} reached for this item.`, "error")
                      }
                      return
                    }
                    updateQuantity(lineIdentifier, item.quantity + 1, item.bundleId)
                  }

                  return (
                    <div key={item.cartId || `${item._id}_${sizeLabel || "nosize"}_${idx}`} className="relative flex gap-3 px-4 py-3 sm:px-5">
                      {/* Delete lives on its own in the top-right corner, behind a
                          confirmation, so it can never be hit by tapping the minus. */}
                      <button
                        type="button"
                        aria-label="Delete item"
                        title="Delete item"
                        onClick={() => setItemToDelete(item)}
                        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 sm:right-4"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-white">
                        <img
                          src={getFullImageUrl(item.image) || "/placeholder.svg?height=64&width=64"}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="pr-8 text-sm font-semibold text-gray-900 line-clamp-2">
                          <TranslatedText text={item.name} />
                        </p>
                        {item.selectedSizeData && (
                          <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-amber-700 font-medium">
                              <TranslatedText>Size:</TranslatedText> {item.selectedSizeData.code || item.selectedSizeData.name}
                              {Number(item.selectedSizeData.additionalPrice) > 0 && (
                                <span className="text-amber-600 font-normal"> (+{formatPrice(item.selectedSizeData.additionalPrice)})</span>
                              )}
                            </p>
                            {sizeStock !== null && (
                              sizeStock <= 0 ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700">
                                  Out of Stock
                                </span>
                              ) : sizeStock <= 5 ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                  Only {sizeStock} available in size {sizeLabel}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">
                                  {sizeStock} available
                                </span>
                              )
                            )}
                          </div>
                        )}
                        {!item.selectedSizeData && sizeStock !== null && (
                          <div className="mt-0.5 text-xs">
                            {sizeStock <= 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700">
                                Out of Stock
                              </span>
                            ) : sizeStock <= 5 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                Only {sizeStock} available
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">
                                {sizeStock} in stock
                              </span>
                            )}
                          </div>
                        )}
                        {item.selectedColorData && (
                          <p className="mt-0.5 text-xs text-purple-600 font-medium">
                            <TranslatedText>Color:</TranslatedText> {item.selectedColorData.color}
                          </p>
                        )}
                        {item.selectedDosData && (
                          <p className="mt-0.5 text-xs text-blue-600 font-medium">
                            <TranslatedText>OS:</TranslatedText> {item.selectedDosData.dosType}
                          </p>
                        )}

                        {/* Per-item price breakdown */}
                        <div className="mt-1.5 max-w-[16rem] space-y-0.5 text-xs">
                          {pd.hasDiscount && (
                            <div className="flex justify-between gap-6">
                              <span className="text-gray-500"><TranslatedText>Sale Price</TranslatedText></span>
                              <span className="text-gray-400 line-through">{formatPrice(pd.basePrice * item.quantity)}</span>
                            </div>
                          )}
                          <div className="flex justify-between gap-6">
                            <span className="text-gray-500"><TranslatedText>Our Offer Price</TranslatedText></span>
                            <span className="font-semibold text-red-600">{formatPrice(pd.currentPrice * item.quantity)}</span>
                          </div>
                          {pd.hasDiscount && (
                            <div className="flex justify-between gap-6 text-green-600">
                              <span><TranslatedText>You Save</TranslatedText></span>
                              <span className="font-semibold">- {formatPrice(pd.savings * item.quantity)}</span>
                            </div>
                          )}
                        </div>

                        {/* Quantity controls — minus only lowers quantity; at 1 it is
                            disabled, deletion is the separate corner button. */}
                        <div className="mt-2 inline-flex items-center rounded-full border border-gray-300">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={handleDecreaseQty}
                            disabled={item.quantity <= 1}
                            className="grid h-7 w-8 place-items-center text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="min-w-[1.75rem] text-center text-sm font-semibold text-gray-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={handleIncreaseQty}
                            disabled={atMax}
                            className="grid h-7 w-8 place-items-center text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Delivery options — sits to the right of the products (Amazon-style). */}
              {deliveryType === "home" && hasAdminDeliveryCharges && (
                <div className="border-t border-gray-100 p-4 sm:p-5 lg:border-t-0 lg:border-l lg:w-72 lg:flex-shrink-0">
                  <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <Truck size={15} className="text-gray-500" />
                    <TranslatedText>Delivery Options</TranslatedText>
                  </label>
                  <div className="space-y-2">
                    {deliveryOptions.map((opt) => {
                      const quote = resolveDeliveryCharge(opt, deliveryGoodsSubtotal)
                      const isSelected = (selectedDelivery?._id || fallbackDelivery?._id) === opt._id
                      const priceLabel = !quote.available
                        ? `min ${formatPrice(quote.minRequired)}`
                        : quote.isFree
                          ? "Free"
                          : formatPrice(quote.charge)
                      return (
                        <label
                          key={opt._id}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${
                            isSelected ? "border-lime-500 bg-lime-50" : "border-gray-200 hover:border-gray-300"
                          } ${!quote.available ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          <input
                            type="radio"
                            name="checkoutDeliveryOption"
                            className="mt-0.5 accent-lime-600"
                            checked={isSelected}
                            disabled={!quote.available}
                            onChange={() => setSelectedDelivery(opt)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-gray-900">{opt.name}</span>
                            {opt.deliveryTime && (
                              <span className="block text-xs text-gray-500">{opt.deliveryTime}</span>
                            )}
                          </span>
                          <span className={`whitespace-nowrap font-semibold ${quote.isFree ? "text-green-600" : "text-gray-900"}`}>
                            {priceLabel}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              </div>

              {/* Place order footer (Amazon-style) at the end of the items list */}
              <div className="border-t border-gray-100 px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      <TranslatedText>Order total</TranslatedText> {formatPrice(finalTotal)}
                    </p>
                    <p className="text-xs text-gray-500">
                      <TranslatedText>By placing your order, you agree to our Terms &amp; Conditions.</TranslatedText>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={loading || !selectedPaymentMethod || deliveryBlocked}
                    className="flex w-full items-center justify-center gap-2 bg-footer-bg px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
                  >
                    {loading ? (
                      <>
                        <img src="/logo.png" alt="Loading..." style={{ width: 20, height: 20, animation: "bounce 1s infinite" }} />
                        <TranslatedText>Processing...</TranslatedText>
                      </>
                    ) : deliveryBlocked ? (
                      <TranslatedText>Order too small to deliver</TranslatedText>
                    ) : !selectedPaymentMethod ? (
                      <TranslatedText>Select a payment method</TranslatedText>
                    ) : (
                      <TranslatedText>Place your order</TranslatedText>
                    )}
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Order Summary Sidebar */}
          <div className="order-first lg:order-none">
            <div className="bg-stone-50 p-6 text-sm lg:sticky lg:top-24">
              {/* The lines being paid for. A shopper arriving from the cart drawer has
                  not seen them since, and a checkout that hides them invites a refund. */}
              <ul className="mb-6 space-y-4">
                {cartItems.map((item) => {
                  const unit = Number(item.offerPrice) > 0 ? Number(item.offerPrice) : Number(item.price) || 0
                  const variant = [
                    item.selectedSizeData ? `Size: ${item.selectedSizeData.code || item.selectedSizeData.name}` : null,
                    item.selectedColorData?.color,
                    item.selectedDosData?.dosType,
                  ]
                    .filter(Boolean)
                    .join(" / ")

                  return (
                    <li
                      key={`${item._id}-${item.bundleId || "solo"}-${item.selectedColorIndex ?? "x"}-${item.selectedSizeData?.code || "nosize"}`}
                      className="flex items-start gap-4"
                    >
                      <div className="relative flex-shrink-0">
                        <div className="h-16 w-16 overflow-hidden border border-stone-200 bg-[#efece7]">
                          <img
                            src={getFullImageUrl(item.image) || "/placeholder.svg"}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-stone-700 px-1 text-[11px] font-semibold text-white">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-stone-900">
                          <TranslatedText text={item.name}>{item.name}</TranslatedText>
                        </p>
                        {variant && <p className="mt-0.5 text-xs text-stone-500">{variant}</p>}
                      </div>
                      <span className="flex-shrink-0 text-sm text-stone-900">{formatPrice(unit * item.quantity)}</span>
                    </li>
                  )
                })}
              </ul>

              {/* Order details. The invoice is the one place a shopper looks before
                  paying, so what they chose is restated here -- with an Edit beside
                  each line, because reading it back is where a mistake gets noticed
                  and the form that owns it may be far up the page. */}
              <div className="mb-6 space-y-3 border-t border-stone-200 pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                  <TranslatedText>Order details</TranslatedText>
                </h3>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-stone-500">
                      {deliveryType === "home" ? (
                        <TranslatedText>Deliver to</TranslatedText>
                      ) : (
                        <TranslatedText>Collect from</TranslatedText>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-stone-900">{deliveryDetailLine}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (deliveryType === "home") {
                        handleEditAddress()
                      } else {
                        goToSection("checkout-delivery")
                      }
                    }}
                    className="flex-shrink-0 text-xs font-semibold text-stone-900 underline underline-offset-4 hover:text-brand-700"
                  >
                    <TranslatedText>Edit</TranslatedText>
                  </button>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-stone-500">
                      <TranslatedText>Contact</TranslatedText>
                    </p>
                    <p className="mt-0.5 truncate text-sm text-stone-900">
                      {withDialCode(deliveryType === "home" ? formData.phone : pickupDetails.phone) || "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (deliveryType === "home") {
                        handleEditAddress()
                      } else {
                        goToSection("checkout-delivery")
                      }
                    }}
                    className="flex-shrink-0 text-xs font-semibold text-stone-900 underline underline-offset-4 hover:text-brand-700"
                  >
                    <TranslatedText>Edit</TranslatedText>
                  </button>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-stone-500">
                      <TranslatedText>Payment</TranslatedText>
                    </p>
                    <p className="mt-0.5 text-sm text-stone-900">{paymentSummary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToSection("checkout-payment")}
                    className="flex-shrink-0 text-xs font-semibold text-stone-900 underline underline-offset-4 hover:text-brand-700"
                  >
                    <TranslatedText>Edit</TranslatedText>
                  </button>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-stone-500">
                      <TranslatedText>Order notes</TranslatedText>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-stone-900">{notesSummary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToSection("checkout-notes")}
                    className="flex-shrink-0 text-xs font-semibold text-stone-900 underline underline-offset-4 hover:text-brand-700"
                  >
                    <TranslatedText>Edit</TranslatedText>
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-stone-200 pt-5">
                {/* Detailed Price Breakdown */}
                {cartTotals.totalBasePrice > cartTotals.totalOfferPrice && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600"><TranslatedText>Sale Price Total</TranslatedText></span>
                      <span className="text-gray-500 line-through">{formatPrice(cartTotals.totalBasePrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600"><TranslatedText>Our Offer Price</TranslatedText></span>
                      <span className="text-red-600 font-medium">{formatPrice(cartTotals.totalOfferPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="font-medium"><TranslatedText>You Save</TranslatedText></span>
                      <span className="font-medium">- {formatPrice(cartTotals.totalSavings)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600"><TranslatedText>Subtotal</TranslatedText></span>
                        <span className="text-black font-medium">{formatPrice(cartTotal)}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Simple subtotal when no discounts */}
                {cartTotals.totalBasePrice <= cartTotals.totalOfferPrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600"><TranslatedText>Subtotal</TranslatedText></span>
                    <span className="text-black">{formatPrice(cartTotal)}</span>
                  </div>
                )}

                {hasAdminDeliveryCharges && deliveryType === "home" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      <TranslatedText>Shipping</TranslatedText>
                      {fallbackDelivery?.name ? ` (${fallbackDelivery.name})` : ""}
                    </span>
                    <span className={deliveryCharge === 0 ? "font-semibold text-green-600" : "text-black"}>
                      {deliveryCharge === 0 ? <TranslatedText>Free</TranslatedText> : formatPrice(deliveryCharge)}
                    </span>
                  </div>
                )}

                {/* The basket is under the minimum on every method the shop has set up.
                    Said here, in the summary, because that is where the shopper is looking
                    at the total they cannot yet pay. */}
                {deliveryBlocked && (
                  <div className="my-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-800">
                      <TranslatedText>Delivery not available for this order</TranslatedText>
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700">{deliveryBlockedMessage}</p>
                  </div>
                )}

                {currentPaymentChargesData?.charges?.map((charge, idx) => {
                  let computedAmount = Number(charge.amount) || 0;
                  if (charge.type === "percentage") {
                    computedAmount = (cartTotals.totalOfferPrice + protectionTotal) * (computedAmount / 100);
                  }
                  return (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600" lang="en" dir="ltr">{charge.name} {charge.type === "percentage" && `(${charge.amount}%)`}</span>
                      <span className="text-black" lang="en" dir="ltr">{formatPrice(computedAmount)}</span>
                    </div>
                  )
                })}

                {/* Protection Plans Section */}
                {protectionItems.length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3"><TranslatedText>Protection Plans</TranslatedText></h3>
                    <div className="space-y-2">
                      {protectionItems.map((item) => (
                        <div key={item._id} className="flex items-start justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Shield size={16} className="text-blue-600" />
                              <p className="text-sm font-medium text-gray-900">{item.protectionData?.name || item.name}</p>
                            </div>
                            <p className="text-xs text-gray-600 ml-6">
                              {item.protectionData?.duration} - For: {item.name.split(' for ')[1] || 'Product'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-red-600">{formatPrice(item.price)}</span>
                            <button
                              onClick={() => removeFromCart(item._id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Remove protection"
                              type="button"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discounts applied here as read-only rows -- the coupon field, referral
                    reward and Grabian Points controls live in the Payment method step. */}
                {coupon && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span><TranslatedText>Coupon:</TranslatedText> {coupon.code}</span>
                    <span>- {formatPrice(couponDiscount)}</span>
                  </div>
                )}

                {appliedReferralDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span><TranslatedText>Referral discount</TranslatedText></span>
                    <span>- {formatPrice(appliedReferralDiscount)}</span>
                  </div>
                )}

                {appliedLoyaltyDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span><TranslatedText>Points applied</TranslatedText></span>
                    <span>- {formatPrice(appliedLoyaltyDiscount)}</span>
                  </div>
                )}

                <div className="border-t pt-3 flex justify-between font-bold text-base">
                  <span className="text-black"><TranslatedText>Total Amount</TranslatedText></span>
                  <span className="text-black">{formatPrice(finalTotal)}</span>
                </div>

                {hasAdminDeliveryCharges && deliveryType === "home" && deliveryCharge === 0 && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <span className="text-lg">🎉</span>
                    <p className="text-sm text-green-700 font-medium"><TranslatedText>Free shipping is applied to this order.</TranslatedText></p>
                  </div>
                )}
              </div>

              {/* Place order — the single action for the stacked (Amazon-style) layout. It
                  validates then routes to createOrderThenPay (card/Tabby/Tamara) or the COD
                  flow, exactly as the old step-3 buttons did. */}
              <button
                onClick={handlePlaceOrder}
                disabled={loading || !selectedPaymentMethod || deliveryBlocked}
                className="mt-5 flex w-full items-center justify-center gap-2 bg-footer-bg px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
              >
                {loading ? (
                  <>
                    <img
                      src="/logo.png"
                      alt="Loading..."
                      style={{ width: 24, height: 24, animation: "bounce 1s infinite" }}
                    />
                    <TranslatedText>Processing...</TranslatedText>
                  </>
                ) : deliveryBlocked ? (
                  <TranslatedText>Order too small to deliver</TranslatedText>
                ) : !selectedPaymentMethod ? (
                  <TranslatedText>Select a payment method</TranslatedText>
                ) : (
                  `Place your order - ${formatPrice(finalTotal)}`
                )}
              </button>

              <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Shield className="h-7 w-7 text-lime-500" />
                  </div>
                  <div className="ml-2">
                    <p className="text-xs text-gray-700">
                      <TranslatedText>Your order is secure and encrypted. We never store your payment information.</TranslatedText>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Address Modal for Home Delivery */}
        <Dialog as={Fragment} open={showAddressModal} onClose={() => setShowAddressModal(false)}>
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
            {/* Header and footer stay put; only the fields scroll, so the buttons are always
                reachable however small the screen is. */}
            <Dialog.Panel className="flex w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <Dialog.Title className="text-lg font-bold text-gray-900">
                  <TranslatedText>{editingAddressId ? "Edit Delivery Address" : "Add Delivery Address"}</TranslatedText>
                </Dialog.Title>
                <button
                  type="button"
                  className="-mr-2 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  onClick={() => setShowAddressModal(false)}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddressModalSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={addressLabelClass}>
                        <TranslatedText>Full Name / Label</TranslatedText> <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className={addressInputClass}
                        value={addressDetails.name}
                        onChange={(e) => setAddressDetails({ ...addressDetails, name: e.target.value })}
                        placeholder="Full name or address label (e.g. Home, Office)"
                        required
                      />
                    </div>
                    <div>
                      <label className={addressLabelClass}>
                        <TranslatedText>Phone</TranslatedText> <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        className={addressInputClass}
                        value={addressDetails.phone}
                        onChange={(e) => setAddressDetails({ ...addressDetails, phone: e.target.value })}
                        placeholder="50XXXXXXX"
                        required
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={addressLabelClass}>
                      <TranslatedText>Country</TranslatedText> <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        className={addressSelectClass}
                        value={addressDetails.country || currentCountry?.name || "Pakistan"}
                        onChange={(e) => setAddressDetails({ ...addressDetails, country: e.target.value, state: "" })}
                        required
                      >
                        {(countries || []).map((c) => (
                          <option key={c.code} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={addressLabelClass}>
                      <TranslatedText>Street / Building</TranslatedText> <span className="text-red-500">*</span>
                    </label>
                    <AddressAutocomplete
                      value={addressDetails.address}
                      onChange={(v) => setAddressDetails({ ...addressDetails, address: v })}
                      onSelect={(sel) =>
                        setAddressDetails({
                          ...addressDetails,
                          address: sel.address,
                          city: sel.city || addressDetails.city,
                          state: sel.state || addressDetails.state,
                          zipCode: sel.zipCode || addressDetails.zipCode,
                        })
                      }
                      countryName={addressDetails.country || currentCountry?.name || "Pakistan"}
                      countryCode={(countries || []).find((c) => c.name === (addressDetails.country || currentCountry?.name))?.code || currentCountry?.code}
                      inputClassName={addressInputClass}
                      placeholder="Start typing your street or building"
                      required
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      <TranslatedText>Pick your street or building from the list, then add your villa or flat number.</TranslatedText>
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={addressLabelClass}>
                        <TranslatedText>Province</TranslatedText> <span className="text-red-500">*</span>
                      </label>
                      {(() => {
                        const selectedCountryName = addressDetails.country || currentCountry?.name || "Pakistan"
                        const provinces = getProvincesForCountry(selectedCountryName)
                        if (provinces && provinces.length > 0) {
                          return (
                            <div className="relative">
                              <select
                                className={addressSelectClass}
                                value={addressDetails.state}
                                onChange={(e) => setAddressDetails({ ...addressDetails, state: e.target.value })}
                                required
                              >
                                <option value="">Select</option>
                                {provinces.map((prov) => (
                                  <option key={prov} value={prov}>
                                    {prov}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                          )
                        }
                        return (
                          <input
                            type="text"
                            className={addressInputClass}
                            value={addressDetails.state}
                            onChange={(e) => setAddressDetails({ ...addressDetails, state: e.target.value })}
                            placeholder="State / Province"
                            required
                          />
                        )
                      })()}
                    </div>
                    <div>
                      <label className={addressLabelClass}>
                        <TranslatedText>City</TranslatedText> <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        className={addressInputClass}
                        value={addressDetails.city}
                        onChange={(e) => setAddressDetails({ ...addressDetails, city: e.target.value })}
                        placeholder="City"
                        required
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={addressLabelClass}>
                        <TranslatedText>Post Code</TranslatedText>{" "}
                        <span className="font-normal text-gray-400">
                          (<TranslatedText>optional</TranslatedText>)
                        </span>
                      </label>
                      <input
                        type="text"
                        className={addressInputClass}
                        value={addressDetails.zipCode}
                        onChange={(e) => setAddressDetails({ ...addressDetails, zipCode: e.target.value })}
                        placeholder="00000"
                      />
                    </div>
                    <label className="flex items-center gap-2.5 self-end rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addressDetails.isDefault}
                        onChange={(e) => setAddressDetails({ ...addressDetails, isDefault: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
                      />
                      <TranslatedText>Set as default address</TranslatedText>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(false)}
                    className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <TranslatedText>Cancel</TranslatedText>
                  </button>
                  <button type="submit" className="rounded-lg bg-lime-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-lime-700">
                    <TranslatedText>Save Address</TranslatedText>
                  </button>
                </div>
              </form>
            </Dialog.Panel>
          </div>
        </Dialog>

        {/* Delete-item confirmation */}
        <Dialog as={Fragment} open={Boolean(itemToDelete)} onClose={() => setItemToDelete(null)}>
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
            <Dialog.Panel className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                  <Trash2 size={18} />
                </div>
                <div className="min-w-0">
                  <Dialog.Title className="text-base font-bold text-gray-900">
                    <TranslatedText>Remove item?</TranslatedText>
                  </Dialog.Title>
                  <p className="mt-1 text-sm text-gray-600">
                    <TranslatedText>Are you sure you want to delete this product from your order?</TranslatedText>
                  </p>
                  {itemToDelete && (
                    <p className="mt-2 line-clamp-2 text-xs font-medium text-gray-500">
                      <TranslatedText text={itemToDelete.name} />
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <TranslatedText>Cancel</TranslatedText>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (itemToDelete) removeFromCart(itemToDelete.cartId || itemToDelete._id, itemToDelete.bundleId)
                    setItemToDelete(null)
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  <TranslatedText>Delete</TranslatedText>
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>

        {/* Use Grabian Points modal */}
        <LoyaltyRedeemModal
          open={showPointsModal}
          onClose={() => setShowPointsModal(false)}
          eligibleAmountAed={loyaltyEligibleAmount}
          appliedPoints={loyaltyPointsToRedeem}
          onChange={applyLoyaltyRedemption}
          formatPrice={formatPrice}
        />

        {/* Available Coupons modal */}
        {showCouponsModal && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
            onClick={handleCloseCouponsModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-coupons-title"
          >
            <div
              className="bg-white w-full sm:max-w-2xl max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 id="checkout-coupons-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
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
                        item.categories && item.categories.length > 0
                          ? item.categories.map((cat) => cat.name || cat).join(", ")
                          : "All Categories"
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
                              {isApplied ? <TranslatedText>Applied</TranslatedText> : <TranslatedText>Apply</TranslatedText>}
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

        <PromoPopup pageKey="checkout" delayMs={3000} />
      </div>
    </div>
  )
}

export default Checkout
