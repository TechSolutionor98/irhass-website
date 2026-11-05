"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"
import { getFullImageUrl } from "../utils/imageUtils"
import { useLanguage } from "../context/LanguageContext"

const debugHeroBanners = (...args) => {
  if (import.meta?.env?.VITE_DEBUG_BANNERS === "true") {
    console.log("[DEBUG_BANNERS_HERO]", ...args)
  }
}

const normalizeBannerDisplayUrl = (imageUrl) => {
  const fullUrl = getFullImageUrl(imageUrl)
  if (!fullUrl) return ""

  // Remove image-resizing query params if an optimized URL was stored previously.
  try {
    const urlObj = new URL(fullUrl)
    ;["w", "h", "q", "fmt"].forEach((param) => urlObj.searchParams.delete(param))
    let normalized = urlObj.toString()

    // Strip Cloudinary transformation segment like /upload/f_auto,q_68,w_1360/
    if (normalized.includes("res.cloudinary.com") && normalized.includes("/upload/")) {
      normalized = normalized.replace(/\/upload\/(?:[a-z]{1,4}_[^/]+\/)+(?=(?:v\d+\/|[^/]+))/i, "/upload/")
    }
    return normalized
  } catch {
    return fullUrl
  }
}

const BannerSlider = ({ banners }) => {
  const { getLocalizedPath } = useLanguage()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  const resolvePreferredHeroLink = (linkValue, buttonLinkValue) => {
    const link = String(linkValue || "").trim()
    const buttonLink = String(buttonLinkValue || "").trim()
    const isDefaultShop = (value) => value === "/shop"

    if (link && buttonLink) {
      if (link !== buttonLink && !isDefaultShop(buttonLink)) return buttonLink
      if (isDefaultShop(link) && !isDefaultShop(buttonLink)) return buttonLink
      if (isDefaultShop(buttonLink) && !isDefaultShop(link)) return link
      return link
    }

    return link || buttonLink || "/shop"
  }

  const resolveBannerLink = (banner) => {
    if (!banner) return { href: getLocalizedPath("/shop"), isExternal: false }

    const rawLink = String(banner.link || "").trim()
    const rawButtonLink = String(banner.buttonLink || "").trim()
    const chosen = resolvePreferredHeroLink(rawLink, rawButtonLink)

    const isExternal = chosen.startsWith("http://") || chosen.startsWith("https://")
    if (isExternal) {
      return { href: chosen, isExternal: true }
    }

    // getLocalizedPath strips any legacy /ae-en style prefix a saved banner link
    // still carries, so both old and new links resolve to the same page.
    const normalizedPath = chosen.startsWith("/") ? chosen : `/${chosen}`
    return { href: getLocalizedPath(normalizedPath), isExternal: false }
  }

  // Auto-slide every 5 seconds
  useEffect(() => {
    if (!isAutoPlaying || banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [banners.length, isAutoPlaying])

  const goToSlide = (index) => {
    setCurrentSlide(index)
  }

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length)
  }

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length)
  }

  // Every hook runs on every render, including the empty-state render below.
  // A hook placed after that return crashes React (#310) the moment the list
  // goes from empty to filled, which is exactly what happens on first load.
  const currentBanner = banners && banners.length ? banners[currentSlide] || banners[0] : null
  // A banner with no image shows nothing. It is never swapped for a sample.
  const currentBannerImage = currentBanner ? normalizeBannerDisplayUrl(currentBanner.image) || "" : ""

  useEffect(() => {
    if (!currentBanner) return
    debugHeroBanners("slide:current", {
      index: currentSlide,
      id: currentBanner._id,
      title: currentBanner.title,
      position: currentBanner.position,
      deviceType: currentBanner.deviceType,
      buttonLink: currentBanner.buttonLink,
      link: currentBanner.link,
    })
  }, [currentBanner, currentSlide])

  if (!banners || banners.length === 0) {
    return (
      <section className="relative w-full h-[170px] sm:h-[250px] md:h-[300px] lg:h-[310px] overflow-hidden">
        {/* Empty rather than a grey block: the section already reserves the
            height, so nothing moves when the banner loads. */}
        <div className="w-full h-full" aria-hidden="true" />
      </section>
    )
  }


  // Helper function to render banner content
  const renderBannerContent = () => {
    const content = (
      <>
        {currentBannerImage ? (
          <img
            src={currentBannerImage}
            alt={currentBanner?.title || "Banner"}
            fetchPriority="high"
            loading="eager"
            width="1600"
            height="620"
            className="block w-full h-full bg-cover"
          />
        ) : null}
        {/* Optional subtle overlay for better navigation visibility */}
        <div className="absolute inset-0 bg-black bg-opacity-10"></div>
      </>
    )

    const resolved = resolveBannerLink(currentBanner)

    debugHeroBanners("slide:computedLink", {
      id: currentBanner._id,
      rawLink: currentBanner.link,
      rawButtonLink: currentBanner.buttonLink,
      computedLink: resolved.href,
      isExternal: resolved.isExternal,
    })

    if (resolved.isExternal) {
      return (
        <a
          href={resolved.href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 cover cursor-pointer"
        >
          {content}
        </a>
      )
    }

    return (
      <Link to={resolved.href} className="absolute inset-0 cover cursor-pointer">
        {content}
      </Link>
    )
  }

  return (
    <section
      className="relative w-full h-[170px] sm:h-[250px] md:h-[300px] lg:h-[310px] cover"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Full Banner Image - Clickable if link exists */}
      {renderBannerContent()}

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 p-3 bg-black bg-opacity-30 hover:bg-opacity-50 rounded-full transition-all z-10 hidden sm:block"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 p-3 bg-black bg-opacity-30 hover:bg-opacity-50 rounded-full transition-all z-10 hidden sm:block"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}



      {/* Slide Indicators */}
      {/* {banners.length > 1 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10 hidden sm:flex">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all ${index === currentSlide
                ? "bg-white"
                : "bg-white bg-opacity-50 hover:bg-opacity-75"
                }`}
            />
          ))}
        </div>
      )} */}

    </section>
  )
}

export default BannerSlider
