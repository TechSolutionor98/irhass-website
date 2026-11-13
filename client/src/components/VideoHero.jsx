"use client"

import { Link } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import { getFullImageUrl } from "../utils/imageUtils"

/**
 * Second Banner Section (formerly VideoHero).
 *
 * Managed dynamically from the Admin Panel via:
 * - "Second Banner Desktop"
 * - "Second Banner Mobile"
 *
 * Removes the old hardcoded video and renders dynamic desktop and mobile banners
 * seamlessly using responsive <picture> elements. Falls back to default fashion
 * banner if no admin banner has been uploaded yet.
 */
const VideoHero = ({
  desktopBanner = null,
  mobileBanner = null,
  fallbackSrc = "/media/hero-banner.jpg",
  fallbackLink = "/shop",
  className = "mb-10 sm:mb-14 md:mb-16",
}) => {
  const { getLocalizedPath } = useLanguage()

  // If no banner is provided or banners are explicitly deactivated by admin, hide this section
  if (!desktopBanner && !mobileBanner) return null
  if (desktopBanner?.isActive === false && mobileBanner?.isActive === false) return null
  if (desktopBanner?.isActive === false && !mobileBanner) return null
  if (mobileBanner?.isActive === false && !desktopBanner) return null

  const desktopImage = desktopBanner?.image
    ? getFullImageUrl(desktopBanner.image)
    : mobileBanner?.image
    ? getFullImageUrl(mobileBanner.image)
    : fallbackSrc

  const mobileImage = mobileBanner?.image
    ? getFullImageUrl(mobileBanner.image)
    : desktopBanner?.image
    ? getFullImageUrl(desktopBanner.image)
    : fallbackSrc

  const activeBanner = desktopBanner || mobileBanner
  const rawLink =
    activeBanner?.link ||
    activeBanner?.buttonLink ||
    fallbackLink ||
    "/shop"
  const normalizedLink =
    rawLink.startsWith("/") || rawLink.startsWith("http") ? rawLink : `/${rawLink}`
  const isExternal = /^https?:\/\//i.test(normalizedLink)

  const bannerInner = (
    <div className="relative w-full aspect-video overflow-hidden bg-footer-bg">
      <picture>
        {mobileImage && (
          <source media="(max-width: 767px)" srcSet={mobileImage} />
        )}
        <img
          src={desktopImage || mobileImage}
          alt={activeBanner?.title || "Second banner"}
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="lazy"
          decoding="async"
        />
      </picture>
    </div>
  )

  return (
    <section className={`relative w-full overflow-hidden bg-footer-bg ${className}`} aria-label="Featured collection">
      {isExternal ? (
        <a
          href={normalizedLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          aria-label={activeBanner?.title || "Shop collection"}
        >
          {bannerInner}
        </a>
      ) : (
        <Link
          to={getLocalizedPath(normalizedLink)}
          className="block w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          aria-label={activeBanner?.title || "Shop collection"}
        >
          {bannerInner}
        </Link>
      )}
    </section>
  )
}

export default VideoHero
