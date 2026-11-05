const getAbsoluteUrl = (url) => {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.irhaas.com"
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`
}

const getProductUrl = (product) => {
  if (typeof window !== "undefined") return window.location.href
  const slug = product?.slug || product?._id || ""
  return slug ? `https://www.irhaas.com/product/${slug}` : "https://www.irhaas.com"
}

const getOfferAvailability = (product) => {
  if (product?.stockStatus === "PreOrder") return "https://schema.org/PreOrder"
  if (product?.stockStatus === "Out of Stock") return "https://schema.org/OutOfStock"
  return "https://schema.org/InStock"
}

const getEffectiveProductPrice = (product, selectedPrice) => {
  const selected = Number(selectedPrice)
  if (Number.isFinite(selected) && selected > 0) return selected

  const basePrice = Number(product?.price) || 0
  const offerPrice = Number(product?.offerPrice) || 0
  const hasValidOffer = offerPrice > 0 && basePrice > 0 && offerPrice < basePrice
  return hasValidOffer ? offerPrice : (basePrice > 0 ? basePrice : offerPrice)
}

const cleanProductFeedId = (sku, mongoId) => {
  const base = (sku || mongoId || "").toString().trim()
  return base
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

const ProductSchema = ({ product, price }) => {
  if (!product) return null

  const effectivePrice = getEffectiveProductPrice(product, price)
  if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) return null

  const oneYearFromNow = new Date()
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

  const productUrl = getProductUrl(product)
  const brandName = typeof product.brand === "string" ? product.brand : product.brand?.name || "Generic"
  const cleanDescription = product.description ? product.description.replace(/<[^>]*>/g, "") : ""
  const priceValue = Number(effectivePrice.toFixed(2))
  const feedId = cleanProductFeedId(product.sku, product._id)

  const schema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name || product.title || "Product",
    "image": [getAbsoluteUrl(product.image || product.thumbnail)].filter(Boolean),
    "description": cleanDescription,
    "url": productUrl,
    "sku": feedId,
    "mpn": feedId,
    "category": typeof product.category === "string" ? product.category : product.category?.name,
    "brand": {
      "@type": "Brand",
      "name": brandName,
    },
    "manufacturer": {
      "@type": "Organization",
      "name": brandName,
    },
    "offers": {
      "@type": "Offer",
      "price": priceValue,
      "priceCurrency": "PKR",
      "priceSpecification": {
        "@type": "UnitPriceSpecification",
        "price": priceValue,
        "priceCurrency": "PKR",
      },
      "priceValidUntil": oneYearFromNow.toISOString().slice(0, 10),
      "itemCondition": "https://schema.org/NewCondition",
      "availability": getOfferAvailability(product),
      "url": productUrl,
      "seller": {
        "@type": "Organization",
        "name": "Irhaas",
      },
    },
  }

  if (product.rating && product.rating > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": product.rating.toString(),
      "bestRating": "5",
      "worstRating": "1",
      "ratingCount": (product.numReviews || product.reviewCount || 1).toString(),
    }
  }

  return (
    <script type="application/ld+json" data-dynamic-schema="true">
      {JSON.stringify(schema).replace(/</g, "\\u003c")}
    </script>
  )
}

export default ProductSchema;
