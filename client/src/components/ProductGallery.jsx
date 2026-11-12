"use client"

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import { getImageUrl } from "../utils/imageUtils"
import config from "../config/config"

/**
 * Edge-to-edge grid of product photographs.
 *
 * Deliberately wordless: no names, no prices, no badges. It is a shop window, and
 * the product page carries the detail. The only text is a screen-reader heading and
 * each image's alt, so the section is still navigable without sight of it.
 *
 * Tiles butt against each other with no gutter, which is what makes the wall read as
 * one image rather than a row of cards.
 */
const ProductGallery = ({ limit = 10, skipIds = [] }) => {
  const { getLocalizedPath } = useLanguage()
  const [products, setProducts] = useState([])

  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      ;(async () => {
        try {
          // Over-fetch: some of what comes back is already on the featured rail above,
          // and a gallery that repeats it looks like a bug.
          const res = await fetch(`${config.API_URL}/api/products?limit=${limit * 2}`)
          if (!res.ok) return
          const data = await res.json()
          const list = Array.isArray(data) ? data : data?.products || data?.data || []
          const skip = new Set(skipIds)
          if (alive) setProducts(list.filter((p) => p?.image && !skip.has(p._id)).slice(0, limit))
        } catch {
          // Silent: the home page reads fine without this section.
        }
      })()
    }, 200)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [limit, skipIds])

  // A half-filled wall looks broken, so it only renders once there is a full row.
  if (products.length < 5) return null

  // Full bleed. The page content is capped at 1360px, and a wall that stops short of
  // the window edge reads as a mistake -- so this one breaks out of its container and
  // spans the viewport. Layout's <main> carries `overflow-x: clip` to absorb the few
  // pixels the scrollbar adds; `clip` rather than `hidden`, because `hidden` would
  // create a scroll container and break every `position: sticky` on the site.
  return (
    <section
      aria-labelledby="product-gallery-heading"
      className="relative left-1/2 w-screen -translate-x-1/2"
    >
      <h2 id="product-gallery-heading" className="sr-only">
        Shop the collection
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {products.map((product) => (
          <Link
            key={product._id}
            to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)}
            className="group relative block aspect-[9/10] overflow-hidden bg-[#efece7]"
          >
            <img
              src={getImageUrl(product)}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Hover wash. Without it there is no feedback that a tile is a link, since
                there is no text to underline. */}
            <span className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
          </Link>
        ))}
      </div>
    </section>
  )
}

export default ProductGallery
