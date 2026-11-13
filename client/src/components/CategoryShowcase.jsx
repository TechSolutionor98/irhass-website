"use client"

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus } from "lucide-react"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import { useCart } from "../context/CartContext"
import { getImageUrl } from "../utils/imageUtils"
import TranslatedText from "./TranslatedText"
import config from "../config/config"

/**
 * One row of products per category.
 *
 * Categories are read from the API rather than hard-coded, so adding one in the admin
 * puts it on the home page without a deploy. Each row loads its own products, and a
 * category with nothing in it renders nothing at all -- an empty rail under a heading
 * reads as a broken page, which is exactly how the old brand rails looked.
 */
const ProductTile = ({ product }) => {
  const { getLocalizedPath, currentLanguage } = useLanguage()
  const { formatPrice } = useCurrency()
  const { addToCart } = useCart()

  const isArabic = currentLanguage?.code === "ar"
  const base = Number(product.price) || 0
  const offer = Number(product.offerPrice) || 0
  const buying = Number(product.buyingPrice) || 0
  const onOffer = offer > 0 && base > 0 && offer < base
  const soldOut = product.stockStatus === "Out of Stock" || Number(product.countInStock) === 0

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
      to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)}
      className="group block"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#efece7]">
        <img
          src={getImageUrl(product, { width: 440, quality: 72 })}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        {discountPct > 0 && (
          <span className="absolute left-2 top-2 bg-brand-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
            {discountPct}% <TranslatedText>off</TranslatedText>
          </span>
        )}

        {/* Quick add -- same control as every other card on the site. Nested inside the
            card's Link, so the click must be stopped from navigating as well as adding. */}
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
            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-stone-900 shadow-md transition hover:bg-footer-bg hover:text-white md:opacity-0 md:group-hover:opacity-100"
          >
            <Plus size={16} strokeWidth={1.8} />
          </button>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 text-xs font-medium text-stone-900 group-hover:underline sm:text-sm">
        {product.name}
      </h3>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs sm:text-sm">
        <span className="font-semibold text-stone-900">{formatPrice(sellingPrice, isArabic)}</span>
        {showCrossed && <span className="text-[11px] text-stone-400 line-through">{formatPrice(crossedPrice, isArabic)}</span>}
      </p>
    </Link>
  )
}

const CategoryShowcase = ({ perCategory = 6, categories: passedCategories = null }) => {
  const { getLocalizedPath } = useLanguage()
  const [rows, setRows] = useState([])

  useEffect(() => {
    let alive = true

    const timer = setTimeout(() => {
      ;(async () => {
        try {
          let categories =
            Array.isArray(passedCategories) && passedCategories.length > 0
              ? passedCategories
              : null

          if (!categories) {
            const res = await fetch(`${config.API_URL}/api/categories`)
            if (!res.ok) return
            const data = await res.json()
            categories = (Array.isArray(data) ? data : data?.categories || []).filter(
              (c) => c?._id && c?.name,
            )
          }

          if (!categories || categories.length === 0) return

          // One request per category, in parallel (up to 4 categories)
          const loaded = await Promise.all(
            categories.slice(0, 4).map(async (category) => {
              try {
                const r = await fetch(
                  `${config.API_URL}/api/products?parentCategory=${category._id}&limit=${perCategory}`,
                )
                if (!r.ok) return null
                const d = await r.json()
                const products = Array.isArray(d) ? d : d?.products || d?.data || []
                return products.length > 0
                  ? { category, products: products.slice(0, perCategory) }
                  : null
              } catch {
                return null
              }
            }),
          )

          if (alive) setRows(loaded.filter(Boolean))
        } catch {
          // The home page reads fine without this section.
        }
      })()
    }, 250)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [perCategory, passedCategories])

  if (rows.length === 0) return null

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {rows.map(({ category, products }) => (
        <section key={category._id} className="border-b border-stone-200 py-12 last:border-b-0 md:py-16">
          <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
            <h2 className="text-lg font-semibold uppercase tracking-[0.14em] text-stone-900 md:text-xl">
              {category.name}
            </h2>
            <Link
              to={getLocalizedPath(`/shop/${category.slug || category._id}`)}
              className="flex-shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-stone-600 underline-offset-4 transition-colors hover:text-brand-600 hover:underline md:text-sm"
            >
              <TranslatedText>View all</TranslatedText>
            </Link>
          </div>

          {/* Six across on desktop so a full category row fits on one line; two on a
              phone, where six would be unreadable thumbnails. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 md:gap-x-5">
            {products.map((product) => (
              <ProductTile key={product._id} product={product} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default CategoryShowcase
