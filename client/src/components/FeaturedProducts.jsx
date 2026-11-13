"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import { useCart } from "../context/CartContext"
import { getImageUrl } from "../utils/imageUtils"
import TranslatedText from "./TranslatedText"
import config from "../config/config"

/**
 * Horizontal rail of featured products.
 *
 * Scrolling is native overflow with scroll-snap rather than a transform carousel, so
 * trackpad and touch swipe work for free and the arrows just nudge scrollLeft. The
 * arrows only render when there is actually something off-screen in that direction --
 * the same treatment as the category bar.
 */
const FeaturedProducts = ({ title = "Featured", limit = 12, viewAllHref = "/shop", initialProducts = null }) => {
  const { getLocalizedPath, currentLanguage } = useLanguage()
  const { formatPrice } = useCurrency()
  const { addToCart } = useCart()
  const railRef = useRef(null)

  const [products, setProducts] = useState(() =>
    Array.isArray(initialProducts) && initialProducts.length > 0 ? initialProducts : [],
  )
  const [loading, setLoading] = useState(
    () => !(Array.isArray(initialProducts) && initialProducts.length > 0),
  )
  const [failed, setFailed] = useState(false)
  const [scroll, setScroll] = useState({ prev: false, next: false })

  const isArabic = currentLanguage?.code === "ar"

  useEffect(() => {
    if (Array.isArray(initialProducts) && initialProducts.length > 0) {
      setProducts(initialProducts)
      setLoading(false)
      return
    }

    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`${config.API_URL}/api/products?featured=true&limit=${limit}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        // The endpoint has returned both a bare array and a wrapped object over time.
        const list = Array.isArray(data) ? data : data?.products || data?.data || []
        if (alive) setProducts(list)
      } catch {
        if (alive) setFailed(true)
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [limit, initialProducts])

  const updateScroll = useCallback(() => {
    const el = railRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const x = Math.abs(el.scrollLeft) // RTL reports this negative in some browsers
    setScroll({ prev: x > 4, next: x < max - 4 })
  }, [])

  useEffect(() => {
    updateScroll()
    const el = railRef.current
    if (!el) return
    const observer = new ResizeObserver(updateScroll)
    observer.observe(el)
    return () => observer.disconnect()
  }, [products, updateScroll])

  const nudge = (direction) => {
    const el = railRef.current
    if (!el) return
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.8), behavior: "smooth" })
  }

  // Nothing featured, or the request failed -- say nothing rather than showing an
  // empty rail or an error where a product row should be.
  if (!loading && (failed || products.length === 0)) return null

  const Arrow = ({ dir, show, Icon, label }) =>
    show ? (
      <button
        type="button"
        onClick={() => nudge(dir)}
        aria-label={label}
        className="absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-stone-800 shadow-sm transition hover:bg-white md:flex"
        style={dir < 0 ? { left: 8 } : { right: 8 }}
      >
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </button>
    ) : null

  return (
    <section className="bg-page-bg py-12 md:py-16" aria-label={title}>
      <div className="mb-6 flex items-end justify-between px-4 sm:px-6 lg:px-8 md:mb-8">
        <h2 className="text-xl font-semibold uppercase tracking-[0.14em] text-page-heading md:text-2xl">
          <TranslatedText>{title}</TranslatedText>
        </h2>
        {viewAllHref && (
          <Link
            to={getLocalizedPath(viewAllHref)}
            className="text-xs font-medium uppercase tracking-[0.14em] text-page-link underline-offset-4 hover:underline md:text-sm"
          >
            <TranslatedText>View all</TranslatedText>
          </Link>
        )}
      </div>

      <div className="relative">
        <Arrow dir={-1} show={scroll.prev} Icon={ChevronLeft} label="Previous products" />
        <Arrow dir={1} show={scroll.next} Icon={ChevronRight} label="Next products" />

        <div
          ref={railRef}
          onScroll={updateScroll}
          className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-6 lg:px-8 md:gap-6"
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-[64vw] shrink-0 snap-start sm:w-[42vw] md:w-[30vw] lg:w-[23%]">
                  <div className="aspect-[3/4] w-full animate-pulse bg-stone-100" />
                  <div className="mt-3 h-4 w-3/4 animate-pulse bg-stone-100" />
                  <div className="mt-2 h-4 w-1/3 animate-pulse bg-stone-100" />
                </div>
              ))
            : products.map((product) => {
                const base = Number(product.price) || 0
                const offer = Number(product.offerPrice) || 0
                const buying = Number(product.buyingPrice) || 0
                const onOffer = offer > 0 && base > 0 && offer < base
                const sellingPrice = onOffer ? offer : base
                const crossedPrice = buying > 0 ? buying : (onOffer ? base : 0)
                const showCrossed = crossedPrice > 0
                const discountPct = onOffer
                  ? Math.round(((base - offer) / base) * 100)
                  : (buying > 0 && sellingPrice > 0 && buying > sellingPrice
                    ? Math.round(((buying - sellingPrice) / buying) * 100)
                    : 0)
                // Both fields are used across the catalogue; either one can mark a
                // product unavailable, and a quick-add that fails is worse than none.
                const soldOut =
                  product.stockStatus === "Out of Stock" || Number(product.countInStock) === 0

                return (
                  <Link
                    key={product._id}
                    to={getLocalizedPath(`/product/${product.slug || product._id}`)}
                    className="group w-[64vw] shrink-0 snap-start sm:w-[42vw] md:w-[30vw] lg:w-[23%]"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-100">
                      <img
                        src={getImageUrl(product, { width: 440, quality: 72 })}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                      {discountPct > 0 && (
                        <span className="absolute left-3 top-3 bg-brand-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                          {discountPct}% <TranslatedText>off</TranslatedText>
                        </span>
                      )}

                      {/* Quick add. Nested inside the card's Link, so the click has to be
                          stopped from navigating to the product as well as adding it. On
                          touch there is no hover, so it stays visible below `md`. */}
                      {!soldOut && (
                        <button
                          type="button"
                          aria-label={`Add ${product.name} to cart`}
                          title="Add to cart"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            addToCart(product, 1)
                          }}
                          className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-900 shadow-md transition hover:bg-footer-bg hover:text-white md:opacity-0 md:group-hover:opacity-100"
                        >
                          <Plus size={18} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>

                    <h3 className="mt-3 line-clamp-2 text-sm font-medium text-page-heading group-hover:underline">
                      {product.name}
                    </h3>

                    <p className="mt-1 flex items-baseline gap-2 text-sm">
                      <span className="font-semibold text-page-price">
                        {formatPrice(sellingPrice, isArabic)}
                      </span>
                      {showCrossed && (
                        <span className="text-xs text-page-old-price line-through">
                          {formatPrice(crossedPrice, isArabic)}
                        </span>
                      )}
                    </p>
                  </Link>
                )
              })}
        </div>
      </div>
    </section>
  )
}

export default FeaturedProducts
