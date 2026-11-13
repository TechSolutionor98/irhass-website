"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { X, Minus, Plus, ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react"
import { useCart } from "../context/CartContext"
import { useAuth } from "../context/AuthContext"
import { useCurrency } from "../context/CurrencyContext"
import { useLanguage } from "../context/LanguageContext"
import { getFullImageUrl, getOptimizedImageUrl } from "../utils/imageUtils"
import { rememberReturnPath } from "../utils/authRedirect"
import TranslatedText from "./TranslatedText"
import config from "../config/config"

// What a line actually costs: an offer price wins when there is one, and bundle lines
// already carry their discounted unit price in `price`.
const unitPrice = (item) => (Number(item?.offerPrice) > 0 ? Number(item.offerPrice) : Number(item?.price) || 0)

/**
 * The slide-over cart.
 *
 * Mounted once in the layout and driven from CartContext, so any add-to-cart button
 * anywhere opens it without prop drilling. It deliberately shows no tax line: prices
 * on this store are what the customer pays, and delivery is worked out at checkout
 * once an address exists.
 */
const CartDrawer = () => {
  const {
    cartItems,
    cartCount,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    removeBundleFromCart,
    orderNote,
    setOrderNote,
    addToCart,
  } = useCart()
  const { formatPrice } = useCurrency()
  const { getLocalizedPath, currentLanguage } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const railRef = useRef(null)

  const [showNote, setShowNote] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [page, setPage] = useState(0)

  const isArabic = currentLanguage?.code === "ar"

  // Escape closes, and the page behind must not scroll while the panel is open --
  // otherwise flicking the list scrolls the catalogue underneath on touch.
  useEffect(() => {
    if (!isCartOpen) return

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeCart()
    }
    document.addEventListener("keydown", onKeyDown)

    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    panelRef.current?.focus()

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [isCartOpen, closeCart])

  // Cross-sell row. Fetched once the drawer is first opened rather than on mount, so
  // a visitor who never opens the cart never pays for the request.
  useEffect(() => {
    if (!isCartOpen || suggestions.length > 0) return
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`${config.API_URL}/api/products?featured=true&limit=12`)
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data) ? data : data?.products || data?.data || []
        if (alive) setSuggestions(list)
      } catch {
        // A missing cross-sell row is not worth surfacing -- the cart still works.
      }
    })()
    return () => {
      alive = false
    }
  }, [isCartOpen, suggestions.length])

  const subtotal = cartItems.reduce((sum, item) => sum + unitPrice(item) * (Number(item.quantity) || 0), 0)

  const inCart = new Set(cartItems.map((item) => item._id))
  const recommendations = suggestions.filter((p) => !inCart.has(p._id)).slice(0, 8)

  const goToCheckout = () => {
    closeCart()
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

  const nudge = useCallback((direction) => {
    const el = railRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" })
  }, [])

  const onRailScroll = (e) => {
    const el = e.currentTarget
    setPage(el.clientWidth > 0 ? Math.round(el.scrollLeft / el.clientWidth) : 0)
  }

  const pageCount = Math.max(1, Math.ceil(recommendations.length / 2))

  return (
    <>
      {/* Backdrop. Rendered always and faded, so the panel can transition in and out
          instead of appearing fully formed on the first open. */}
      <div
        onClick={closeCart}
        aria-hidden="true"
        className={`fixed inset-0 z-[90] bg-black/40 transition-opacity duration-300 ${
          isCartOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        tabIndex={-1}
        className={`fixed inset-y-0 z-[95] flex w-full max-w-[460px] flex-col bg-white shadow-2xl outline-none transition-transform duration-300 ease-out ${
          isArabic ? "left-0" : "right-0"
        } ${isCartOpen ? "translate-x-0" : isArabic ? "-translate-x-full" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-200 px-6 py-5">
          <h2 className="text-lg font-medium uppercase tracking-[0.18em] text-stone-900">
            <TranslatedText>Cart</TranslatedText>
            {cartCount > 0 && <span className="ml-2 text-sm text-stone-400">({cartCount})</span>}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="p-1 text-stone-500 transition-colors hover:text-stone-900"
          >
            <X size={22} strokeWidth={1.4} />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag size={44} strokeWidth={1} className="text-stone-300" />
            <p className="text-sm text-stone-500">
              <TranslatedText>Your cart is empty</TranslatedText>
            </p>
            <button
              type="button"
              onClick={() => {
                closeCart()
                navigate(getLocalizedPath("/shop"))
              }}
              className="border border-stone-900 px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
            >
              <TranslatedText>Continue shopping</TranslatedText>
            </button>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto">
              <ul className="divide-y divide-stone-100">
                {cartItems.map((item) => {
                  const sizeStock = item.selectedSizeData && item.selectedSizeData.countInStock !== undefined && item.selectedSizeData.countInStock !== null
                    ? Number(item.selectedSizeData.countInStock)
                    : (item.countInStock !== undefined && item.countInStock !== null ? Number(item.countInStock) : null)
                  const maxLimit = sizeStock !== null ? Math.min(item.maxPurchaseQty || 9999, sizeStock) : (item.maxPurchaseQty || 10)
                  const atMax = item.quantity >= maxLimit || (sizeStock !== null && sizeStock <= 0)
                  const lineIdentifier = item.cartId || item._id
                  const key = `${item.cartId || item._id}-${item.bundleId || "solo"}-${item.selectedColorIndex ?? "x"}-${item.selectedSizeData?.code || "def"}`
                  const line = unitPrice(item)
                  const href = getLocalizedPath(`/product/${encodeURIComponent(item.slug || item._id)}`)

                  return (
                    <li key={key} className="flex gap-4 px-6 py-6">
                      <Link to={href} onClick={closeCart} className="flex-shrink-0">
                        <div className="h-[132px] w-[104px] overflow-hidden bg-[#efece7]">
                          <img
                            src={getOptimizedImageUrl(item.image, { width: 220, height: 280, quality: 70 }) || "/placeholder.svg"}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link to={href} onClick={closeCart} className="block">
                          <h3 className="line-clamp-2 text-sm font-medium uppercase tracking-[0.08em] text-stone-900 hover:underline">
                            <TranslatedText text={item.name}>{item.name}</TranslatedText>
                          </h3>
                        </Link>

                        <p className="mt-1 text-sm text-stone-900">{formatPrice(line)}</p>

                        {/* Variant line: whichever of size / colour / option / bundle applies. */}
                        {(item.selectedColorData || item.selectedDosData || item.selectedSizeData || item.bundleId) && (
                          <p className="mt-1 text-xs uppercase tracking-[0.1em] text-stone-500">
                            {[
                              item.selectedSizeData ? `Size: ${item.selectedSizeData.code || item.selectedSizeData.name}${sizeStock !== null ? (sizeStock <= 0 ? " (Out of Stock)" : ` (${sizeStock} available)`) : ""}` : null,
                              item.selectedColorData?.color,
                              item.selectedDosData?.dosType,
                              item.bundleId ? "Bundle" : null,
                            ]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        )}

                        <div className="mt-auto flex items-center gap-4 pt-4">
                          {item.isProtection || item.bundleId ? (
                            // Neither is a free-standing line: a protection plan belongs to
                            // its product and a bundle is priced as a set, so quantity is
                            // fixed and only removal makes sense.
                            <span className="text-xs uppercase tracking-[0.1em] text-stone-400">
                              <TranslatedText>Qty</TranslatedText> {item.quantity}
                            </span>
                          ) : (
                            <div className="flex items-center border border-stone-300">
                              <button
                                type="button"
                                aria-label="Decrease quantity"
                                onClick={() => updateQuantity(lineIdentifier, item.quantity - 1, item.bundleId)}
                                disabled={item.quantity <= 1}
                                className="px-3 py-2 text-stone-600 transition-colors hover:text-black disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="min-w-[36px] border-x border-stone-300 py-2 text-center text-sm tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                aria-label="Increase quantity"
                                onClick={() => updateQuantity(lineIdentifier, item.quantity + 1, item.bundleId)}
                                disabled={atMax}
                                className="px-3 py-2 text-stone-600 transition-colors hover:text-black disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              item.bundleId ? removeBundleFromCart(item.bundleId) : removeFromCart(lineIdentifier, null)
                            }
                            className="text-sm text-stone-600 underline underline-offset-4 transition-colors hover:text-stone-900"
                          >
                            <TranslatedText>Remove</TranslatedText>
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {/* Complete with */}
              {recommendations.length > 0 && (
                <div className="border-t-8 border-stone-100 px-6 py-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-900">
                      <TranslatedText>Complete with</TranslatedText>
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: pageCount }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 w-1.5 rounded-full transition-colors ${
                              i === page ? "bg-stone-900" : "bg-stone-300"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => nudge(-1)}
                          aria-label="Previous suggestions"
                          className="p-1 text-stone-500 transition-colors hover:text-stone-900"
                        >
                          <ChevronLeft size={16} strokeWidth={1.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => nudge(1)}
                          aria-label="More suggestions"
                          className="p-1 text-stone-500 transition-colors hover:text-stone-900"
                        >
                          <ChevronRight size={16} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    ref={railRef}
                    onScroll={onRailScroll}
                    className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto"
                  >
                    {recommendations.map((product) => {
                      const base = Number(product.price) || 0
                      const offer = Number(product.offerPrice) || 0
                      const buying = Number(product.buyingPrice) || 0
                      const shown = offer > 0 && offer < base ? offer : base
                      const crossedPrice = buying > 0 ? buying : (offer > 0 && offer < base ? base : 0)

                      return (
                        <div key={product._id} className="flex w-full flex-shrink-0 snap-start gap-4">
                          <Link
                            to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)}
                            onClick={closeCart}
                            className="flex-shrink-0"
                          >
                            <div className="h-[120px] w-[94px] overflow-hidden bg-[#efece7]">
                              <img
                                src={getOptimizedImageUrl(product.image, { width: 200, height: 250, quality: 70 }) || "/placeholder.svg"}
                                alt={product.name}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            </div>
                          </Link>
                          <div className="flex min-w-0 flex-1 flex-col justify-center">
                            <Link
                              to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)}
                              onClick={closeCart}
                            >
                              <p className="line-clamp-2 text-sm font-medium uppercase tracking-[0.08em] text-stone-900 hover:underline">
                                <TranslatedText text={product.name}>{product.name}</TranslatedText>
                              </p>
                            </Link>
                            <p className="mt-1 flex items-baseline gap-2 text-sm">
                              <span className="text-stone-900">{formatPrice(shown)}</span>
                              {crossedPrice > 0 && (
                                <span className="text-xs text-stone-400 line-through">{formatPrice(crossedPrice)}</span>
                              )}
                            </p>
                            <button
                              type="button"
                              onClick={() => addToCart(product, 1)}
                              className="mt-3 self-start text-sm text-stone-900 underline underline-offset-4 transition-colors hover:text-brand-600"
                            >
                              <TranslatedText>Add to cart</TranslatedText>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-stone-200 px-6 py-5">
              <button
                type="button"
                onClick={() => setShowNote((v) => !v)}
                aria-expanded={showNote}
                className="text-sm text-stone-900 underline underline-offset-4 transition-colors hover:text-brand-600"
              >
                <TranslatedText>Add order note</TranslatedText>
              </button>

              {showNote && (
                <div className="mt-3">
                  <textarea
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value.slice(0, 500))}
                    rows={3}
                    placeholder="Anything we should know about this order?"
                    className="w-full resize-none border border-stone-300 px-3 py-2 text-sm text-stone-800 focus:border-stone-900 focus:outline-none"
                  />
                  <p className="mt-1 text-right text-xs text-stone-400">{orderNote.length}/500</p>
                </div>
              )}

              <p className="mt-3 text-sm text-stone-500">
                <TranslatedText>Shipping calculated at checkout</TranslatedText>
              </p>

              <button
                type="button"
                onClick={goToCheckout}
                className="mt-4 flex w-full items-center justify-center gap-3 bg-footer-bg px-6 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-brand-700"
              >
                <span>
                  <TranslatedText>Checkout</TranslatedText>
                </span>
                <span aria-hidden="true" className="text-brand-400">
                  &#183;
                </span>
                <span>{formatPrice(subtotal)}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeCart()
                  navigate(getLocalizedPath("/cart"))
                }}
                className="mt-3 w-full text-center text-xs uppercase tracking-[0.14em] text-stone-500 underline underline-offset-4 transition-colors hover:text-stone-900"
              >
                <TranslatedText>View full cart</TranslatedText>
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  )
}

export default CartDrawer
