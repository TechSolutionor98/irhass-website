"use client"

import { Link } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import { getFullImageUrl } from "../utils/imageUtils"

/**
 * Full-bleed campaign banner for the Sale section.
 *
 * Dynamically managed via the Admin Panel under "Sale Section – Bottom Image".
 * Renders cleanly at full 16:9 widescreen aspect ratio matching the top banner section,
 * ensuring the full artwork is displayed without text overlays, dark scrims, or cropping.
 */
const SaleBanner = ({
  desktopBanner = null,
  mobileBanner = null,
  image = "/media/sale-banner.jpg",
  fallbackLink = "/shop",
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
    : image

  const mobileImage = mobileBanner?.image
    ? getFullImageUrl(mobileBanner.image)
    : desktopBanner?.image
    ? getFullImageUrl(desktopBanner.image)
    : image

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
          alt={activeBanner?.title || "Sale banner"}
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="lazy"
        />
      </picture>
    </div>
  )

  return (
    <section
      aria-label="Sale banner"
      className="relative left-1/2 mt-12 w-screen -translate-x-1/2 overflow-hidden bg-footer-bg md:mt-16"
    >
      {isExternal ? (
        <a
          href={normalizedLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          aria-label={activeBanner?.title || "Sale collection"}
        >
          {bannerInner}
        </a>
      ) : (
        <Link
          to={getLocalizedPath(normalizedLink)}
          className="block w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          aria-label={activeBanner?.title || "Sale collection"}
        >
          {bannerInner}
        </Link>
      )}
    </section>
  )
}

export default SaleBanner
