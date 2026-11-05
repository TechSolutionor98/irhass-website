/**
 * Google Tag Manager / Google Analytics 4 Enhanced Ecommerce Tracking Utilities
 * This file contains all the tracking functions for ecommerce events
 */

// Initialize data layer if it doesn't exist
const initializeDataLayer = () => {
  window.dataLayer = window.dataLayer || []
}

// Generic event tracking function
export const trackEvent = (eventName, eventData = {}) => {
  try {
    initializeDataLayer()

    window.dataLayer.push({
      event: eventName,
      ...eventData,
    })

    // Debug logging (remove in production)
    if (process.env.NODE_ENV === "development") {
      console.log("GTM Event tracked:", eventName, eventData)
    }
  } catch (error) {
    console.error("Error tracking event:", eventName, error)
  }
}

// Format product data for consistent tracking
const formatProductForTracking = (product, quantity = 1) => {
  if (!product || !product._id) {
    console.warn("formatProductForTracking: Invalid product data", product)
    return null
  }

  try {
    const finalPrice = product.offerPrice && product.offerPrice > 0 ? product.offerPrice : product.price || 0

    return {
      item_id: product._id,
      item_name: product.name || "Unknown Product",
      item_category: product.parentCategory?.name || product.category?.name || "Uncategorized",
      item_category2: product.subCategory?.name || undefined,
      item_brand: product.brand?.name || "Unknown",
      price: finalPrice,
      quantity: quantity,
      discount: product.price && product.offerPrice ? product.price - product.offerPrice : 0,
    }
  } catch (error) {
    console.error("Error in formatProductForTracking:", error)
    return null
  }
}

// Format multiple products (cart items)
const formatCartItemsForTracking = (cartItems) => {
  return cartItems.map((item) => formatProductForTracking(item, item.quantity)).filter((item) => item !== null)
}

// Calculate total value from cart items
const calculateCartValue = (cartItems) => {
  return cartItems.reduce((total, item) => {
    const price = item.offerPrice && item.offerPrice > 0 ? item.offerPrice : item.price
    return total + price * item.quantity
  }, 0)
}

/**
 * Track product page view
 * @param {Object} product - Product object
 */
export const trackProductView = (product) => {
  // Add validation to prevent errors
  if (!product || !product._id) {
    console.warn("trackProductView: Invalid product data", product)
    return
  }

  try {
    const productData = formatProductForTracking(product)

    if (productData) {
      trackEvent("view_item", {
        ecommerce: {
          currency: "PKR",
          value: productData.price,
          items: [productData],
        },
      })
    }
  } catch (error) {
    console.error("Error in trackProductView:", error)
  }
}

/**
 * Track add to cart event
 * @param {Object} product - Product object
 * @param {number} quantity - Quantity added
 */
export const trackAddToCart = (product, quantity = 1) => {
  const productData = formatProductForTracking(product, quantity)

  if (productData) {
    trackEvent("add_to_cart", {
      ecommerce: {
        currency: "PKR",
        value: productData.price * quantity,
        items: [productData],
      },
    })
  }
}

/**
 * Track remove from cart event
 * @param {Object} product - Product object being removed
 */
export const trackRemoveFromCart = (product) => {
  const productData = formatProductForTracking(product, product.quantity || 1)

  if (productData) {
    trackEvent("remove_from_cart", {
      ecommerce: {
        currency: "PKR",
        value: productData.price * productData.quantity,
        items: [productData],
      },
    })
  }
}

/**
 * Track view cart event
 * @param {Array} cartItems - Array of cart items
 */
export const trackViewCart = (cartItems) => {
  if (!cartItems || cartItems.length === 0) return

  const items = formatCartItemsForTracking(cartItems)
  const totalValue = calculateCartValue(cartItems)

  if (items.length > 0) {
    trackEvent("view_cart", {
      ecommerce: {
        currency: "PKR",
        value: totalValue,
        items: items,
      },
    })
  }
}

/**
 * Track begin checkout event
 * @param {Array} cartItems - Array of cart items
 * @param {number} totalValue - Total checkout value
 */
export const trackBeginCheckout = (cartItems, totalValue = null) => {
  if (!cartItems || cartItems.length === 0) return

  const items = formatCartItemsForTracking(cartItems)
  const value = totalValue || calculateCartValue(cartItems)

  if (items.length > 0) {
    trackEvent("begin_checkout", {
      ecommerce: {
        currency: "PKR",
        value: value,
        items: items,
      },
    })
  }
}

/**
 * Track add payment info event (when user selects payment method)
 * @param {Array} cartItems - Array of cart items
 * @param {string} paymentMethod - Selected payment method
 * @param {number} totalValue - Total value
 * @param {number} checkoutStep - Checkout step number
 */
export const trackAddPaymentInfo = (cartItems, paymentMethod, totalValue, checkoutStep = 1) => {
  if (!cartItems || cartItems.length === 0) return

  const items = formatCartItemsForTracking(cartItems)

  if (items.length > 0) {
    trackEvent("add_payment_info", {
      ecommerce: {
        currency: "PKR",
        value: totalValue,
        payment_type: paymentMethod,
        checkout_step: checkoutStep,
        items: items,
      },
    })
  }
}

/**
 * Purchase tracking
 *
 * Everything that completes an order goes through `pushPurchase`. One order id
 * can only ever produce one `purchase` event, so a refresh of the success page
 * or a second trip through the gateway redirect does not double-count the
 * conversion in GA4 / Google Ads.
 */
const PURCHASE_LOG_KEY = "gtm_tracked_purchases"
const PURCHASE_LOG_LIMIT = 20

const readTrackedPurchases = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PURCHASE_LOG_KEY) || "[]")
    return Array.isArray(stored) ? stored : []
  } catch (error) {
    // A blocked or full localStorage must not stop the conversion from firing.
    return []
  }
}

const rememberTrackedPurchase = (orderId) => {
  try {
    const next = [...readTrackedPurchases().filter((id) => id !== orderId), orderId].slice(-PURCHASE_LOG_LIMIT)
    window.localStorage.setItem(PURCHASE_LOG_KEY, JSON.stringify(next))
  } catch (error) {
    // Ignore -- worst case the event can fire twice on a refresh.
  }
}

/**
 * Accepts either a cart item (_id / offerPrice / brand objects) or a saved
 * order item (product / price) and returns a GA4 ecommerce item.
 */
const normalizePurchaseItem = (item) => {
  if (!item) return null

  const product = item.product && typeof item.product === "object" ? item.product : null
  const productId =
    item.item_id || item._id || product?._id || (typeof item.product === "string" ? item.product : undefined)
  const unitPrice = item.offerPrice && item.offerPrice > 0 ? item.offerPrice : item.price

  return {
    item_id: productId ? String(productId) : undefined,
    item_name: item.item_name || item.name || product?.name || "Unknown Product",
    item_category:
      item.parentCategory?.name ||
      item.category?.name ||
      product?.parentCategory?.name ||
      product?.category?.name ||
      "Uncategorized",
    item_brand: item.brand?.name || product?.brand?.name || "Unknown",
    price: Number(unitPrice) || 0,
    quantity: Number(item.quantity) || 1,
  }
}

/**
 * Mirror a confirmed purchase to the Meta Pixel.
 *
 * Called only from `pushPurchase`, which already refuses an order id it has
 * reported before -- so a refresh of the confirmation page, or a second trip
 * through a gateway redirect, cannot double-count the conversion on Meta
 * either. Guest and signed-in checkouts both arrive here, because both go
 * through `pushPurchase`.
 *
 * `content_ids` carries the same product id GA4 sends. If the Meta catalogue
 * is ever built from the Google Merchant feed, note that feed keys on
 * `sku || _id` (server/routes/googleMerchantRoutes.js) -- the ids have to
 * match or dynamic ads lose attribution, though the revenue still reports.
 */
const pushMetaPurchase = ({ transactionId, value, currency, items }) => {
  try {
    // The pixel is deliberately not loaded on staff pages
    // (window.__irhaasInternalPage in index.html), and an ad blocker can
    // remove it anywhere, so fbq is not guaranteed to exist.
    if (typeof window === "undefined" || typeof window.fbq !== "function") return

    const contents = items
      .map((item) => ({
        id: item.item_id,
        quantity: Number(item.quantity) || 1,
        item_price: Number(item.price) || 0,
      }))
      .filter((entry) => entry.id)

    // Meta requires a value greater than zero and flags an account whose
    // Purchase events all report the same figure. An order total that failed to
    // load would otherwise arrive as a flat 0 on every such order, so fall back
    // to the basket and, failing that, report nothing rather than a number that
    // is not what the customer paid.
    const basketTotal = contents.reduce((sum, entry) => sum + entry.item_price * entry.quantity, 0)
    const reportedValue = Number(value) > 0 ? Number(value) : basketTotal

    if (!(reportedValue > 0)) {
      console.warn("Meta Purchase not sent: no order value", transactionId)
      return
    }

    window.fbq(
      "track",
      "Purchase",
      {
        value: reportedValue,
        currency,
        content_type: "product",
        content_ids: contents.map((entry) => entry.id),
        contents,
        num_items: contents.reduce((count, entry) => count + entry.quantity, 0),
      },
      // The same id GA4 sends as transaction_id, so a future Conversions API
      // server event de-duplicates against this browser event.
      { eventID: transactionId },
    )
  } catch (error) {
    // Meta is the secondary report. A failure here must never stop the GA4
    // purchase from being recorded as sent.
    console.error("Error tracking Meta purchase:", error)
  }
}

/**
 * Push the GA4 `purchase` event for a confirmed order.
 *
 * @param {Object} order
 * @param {string} order.orderId       - Real order id, sent as transaction_id
 * @param {number} order.value         - Amount actually charged
 * @param {Array}  order.items         - Cart items or saved order items
 * @param {string} [order.paymentMethod]
 * @param {number} [order.shipping]
 * @param {number} [order.tax]
 * @param {string} [order.coupon]
 * @param {string} [order.currency]
 * @param {string} [order.affiliation]
 * @returns {boolean} true when the event was pushed, false when skipped
 */
export const pushPurchase = ({
  orderId,
  value,
  items = [],
  paymentMethod = "unknown",
  shipping = 0,
  tax = 0,
  coupon = null,
  currency = "PKR",
  affiliation = "Irhaas Online Store",
}) => {
  try {
    if (!orderId) {
      console.warn("pushPurchase: no order id, purchase not tracked")
      return false
    }

    const transactionId = String(orderId)
    if (readTrackedPurchases().includes(transactionId)) {
      return false
    }

    initializeDataLayer()

    // Clear the previous ecommerce object first, otherwise GA4 merges the
    // leftover add_payment_info payload into this purchase.
    window.dataLayer.push({ ecommerce: null })

    // One item list for both reports, so Google and Meta can never describe
    // the same order with a different basket.
    const purchaseItems = items.map(normalizePurchaseItem).filter(Boolean)

    window.dataLayer.push({
      event: "purchase",
      ecommerce: {
        transaction_id: transactionId,
        affiliation,
        currency,
        value: Number(value) || 0,
        tax: Number(tax) || 0,
        shipping: Number(shipping) || 0,
        coupon: coupon || undefined,
        payment_type: paymentMethod,
        items: purchaseItems,
      },
    })

    pushMetaPurchase({ transactionId, value, currency, items: purchaseItems })

    rememberTrackedPurchase(transactionId)

    if (process.env.NODE_ENV === "development") {
      console.log("GTM purchase tracked:", transactionId, value, items.length)
    }

    return true
  } catch (error) {
    console.error("Error tracking purchase:", error)
    return false
  }
}

/**
 * Track purchase event (positional-argument wrapper around pushPurchase)
 * @param {string} orderId - Order ID
 * @param {number} orderTotal - Total order value
 * @param {Array} items - Array of purchased items
 * @param {string} paymentMethod - Payment method used
 * @param {number} taxAmount - Tax amount
 * @param {number} shippingCost - Shipping cost
 * @param {string} couponCode - Coupon code used
 * @param {string} affiliation - Store affiliation
 */
export const trackPurchase = (
  orderId,
  orderTotal,
  items,
  paymentMethod = "unknown",
  taxAmount = 0,
  shippingCost = 0,
  couponCode = null,
  affiliation = "Irhaas Online Store",
) =>
  pushPurchase({
    orderId,
    value: orderTotal,
    items: Array.isArray(items) ? items : [],
    paymentMethod,
    tax: taxAmount,
    shipping: shippingCost,
    coupon: couponCode,
    affiliation,
  })

/**
 * Track search event
 * @param {string} searchTerm - Search term entered
 * @param {number} numberOfResults - Number of search results
 */
export const trackSearch = (searchTerm, numberOfResults = 0) => {
  trackEvent("search", {
    search_term: searchTerm,
    number_of_results: numberOfResults,
  })
}

/**
 * Track view item list event (category/collection pages)
 * @param {Array} products - Array of products in the list
 * @param {string} listName - Name of the list/category
 */
export const trackViewItemList = (products, listName) => {
  if (!products || products.length === 0) return

  const items = products
    .map((product, index) => ({
      ...formatProductForTracking(product),
      index: index,
      item_list_name: listName,
    }))
    .filter((item) => item !== null)

  if (items.length > 0) {
    trackEvent("view_item_list", {
      ecommerce: {
        currency: "PKR",
        item_list_name: listName,
        items: items,
      },
    })
  }
}

/**
 * Track select item event (when user clicks on product in list)
 * @param {Object} product - Product that was selected
 * @param {string} listName - Name of the list where item was selected
 * @param {number} index - Position of item in the list
 */
export const trackSelectItem = (product, listName, index = 0) => {
  const productData = formatProductForTracking(product)

  if (productData) {
    const enhancedProductData = {
      ...productData,
      index: index,
      item_list_name: listName,
    }

    trackEvent("select_item", {
      ecommerce: {
        currency: "PKR",
        item_list_name: listName,
        items: [enhancedProductData],
      },
    })
  }
}

/**
 * Track add to wishlist event
 * @param {Object} product - Product added to wishlist
 */
export const trackAddToWishlist = (product) => {
  const productData = formatProductForTracking(product)

  if (productData) {
    trackEvent("add_to_wishlist", {
      ecommerce: {
        currency: "PKR",
        value: productData.price,
        items: [productData],
      },
    })
  }
}

/**
 * Track share event
 * @param {string} method - Share method (facebook, twitter, whatsapp, etc.)
 * @param {string} contentType - Type of content shared
 * @param {string} itemId - ID of shared item
 */
export const trackShare = (method, contentType = "product", itemId = null) => {
  trackEvent("share", {
    method: method,
    content_type: contentType,
    item_id: itemId,
  })
}

/**
 * Track login event
 * @param {string} method - Login method (email, google, facebook, etc.)
 */
export const trackLogin = (method = "email") => {
  trackEvent("login", {
    method: method,
  })
}

/**
 * Track sign up event
 * @param {string} method - Sign up method (email, google, facebook, etc.)
 */
export const trackSignUp = (method = "email") => {
  trackEvent("sign_up", {
    method: method,
  })
}

/**
 * Track newsletter subscription
 * @param {string} email - Email address (optional, for privacy consider not tracking)
 */
export const trackNewsletterSignup = (email = null) => {
  trackEvent("newsletter_signup", {
    method: "email",
    // Don't track email for privacy, just the event
  })
}

/**
 * Track contact form submission
 * @param {string} formType - Type of contact form
 */
export const trackContactForm = (formType = "general") => {
  trackEvent("contact_form_submit", {
    form_type: formType,
  })
}

/**
 * Track page view event (for custom page tracking)
 * @param {string} pageTitle - Page title
 * @param {string} pagePath - Page path
 */
export const trackPageView = (pageTitle, pagePath = window.location.pathname) => {
  trackEvent("page_view", {
    page_title: pageTitle,
    page_location: window.location.href,
    page_path: pagePath,
  })
}

// Export all functions as default for easy importing
export default {
  trackEvent,
  trackProductView,
  trackAddToCart,
  trackRemoveFromCart,
  trackViewCart,
  trackBeginCheckout,
  trackAddPaymentInfo,
  trackPurchase,
  pushPurchase,
  trackSearch,
  trackViewItemList,
  trackSelectItem,
  trackAddToWishlist,
  trackShare,
  trackLogin,
  trackSignUp,
  trackNewsletterSignup,
  trackContactForm,
  trackPageView,
}
