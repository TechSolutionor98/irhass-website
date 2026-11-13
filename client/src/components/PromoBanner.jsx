"use client"

import { Link } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import TranslatedText from "./TranslatedText"
import { getFullImageUrl } from "../utils/imageUtils"

/**
 * Full-bleed Hero / Promotional block for the top of the home page.
 * Managed directly from Admin (Banners).
 * Supports:
 * - Solid Background Color + Text
 * - Background Image + Text Overlay (or image only)
 * - Background Video + Text Overlay (or video only)
 * - Custom headline, subheading, button label, button link, fine print
 * - Configurable responsive height (compact, medium, large, fullscreen)
 */
const PromoBanner = ({
  banner = null,
  headline: propHeadline,
  subheading: propSubheading,
  ctaLabel: propCtaLabel,
  ctaHref: propCtaHref,
  finePrint: propFinePrint,
}) => {
  const { getLocalizedPath } = useLanguage()

  // If no banner is provided or banner is inactive, hide the entire hero section
  if (!banner || banner.isActive === false) return null

  const headline = banner ? (banner.title ?? "") : (propHeadline ?? "25% off new season")
  const subheading = banner ? (banner.subtitle ?? "") : (propSubheading ?? "Family & friends event")
  const ctaLabel = banner ? (banner.buttonText ?? "Shop now") : (propCtaLabel ?? "Shop now")
  const ctaHref = banner ? (banner.buttonLink || banner.link || "/shop") : (propCtaHref ?? "/shop")
  const finePrint = banner ? (banner.finePrint || banner.description || "") : (propFinePrint ?? "Discount applied at checkout on 2 or more items. Cannot be combined with other offers.")

  const showText = banner ? (banner.showText !== false) : true
  const mediaType = banner?.mediaType || (banner?.video ? "video" : (banner?.image ? "image" : "none"))
  const videoUrl = banner?.video ? getFullImageUrl(banner.video) : ""
  const imageUrl = banner?.image ? getFullImageUrl(banner.image) : ""
  const bgColor = banner?.backgroundColor || "#8b5e34"
  const textColor = banner?.textColor || "#ffffff"
  const overlayOpacity = typeof banner?.overlayOpacity === "number" ? banner.overlayOpacity : 0
  const heroHeight = banner?.heroHeight || "large"

  // If showText is false and there's no media, nothing to display
  if (!showText && mediaType === "none") return null

  // If showText is true but headline and subheading are empty and no media
  if (showText && !headline && !subheading && mediaType === "none") return null

  // Height classes: generous height ensures 16:9 videos and fashion photography display fully without top/bottom cutoffs
  const getHeightClasses = () => {
    if (!showText && mediaType === "none") return "min-h-[220px]"

    if (heroHeight === "compact") {
      return "min-h-[380px] sm:min-h-[440px] md:min-h-[480px] py-12 md:py-16"
    }
    if (heroHeight === "medium") {
      return "min-h-[480px] sm:min-h-[540px] md:min-h-[600px] lg:min-h-[660px] py-16 md:py-20"
    }
    if (heroHeight === "fullscreen") {
      return "min-h-[85vh] sm:min-h-[90vh] py-20 md:py-28"
    }
    // Default "large" - ideal for full 16:9 video frame so models and outfits are fully visible
    if (mediaType === "video" || mediaType === "image") {
      return "min-h-[540px] sm:min-h-[620px] md:min-h-[700px] lg:min-h-[760px] xl:min-h-[820px] py-16 sm:py-24 md:py-28"
    }
    return "min-h-[360px] sm:min-h-[420px] md:min-h-[460px] py-14 md:py-18"
  }

  return (
    <section
      className="relative w-full overflow-hidden text-white transition-colors duration-300 flex items-center justify-center"
      style={{ backgroundColor: bgColor }}
      aria-label={typeof headline === "string" && headline ? headline : "Top Hero Promotion"}
    >
      {/* Background Video */}
      {mediaType === "video" && videoUrl && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
        >
          <source src={videoUrl} type="video/mp4" />
          <source src={videoUrl} type="video/webm" />
        </video>
      )}

      {/* Background Image */}
      {mediaType === "image" && imageUrl && (
        <img
          src={imageUrl}
          alt={headline || "Hero Background"}
          className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
          loading="eager"
        />
      )}

      {/* Dark / Tint Overlay for readable text over video/image (only active when overlayOpacity > 0) */}
      {(mediaType === "video" || mediaType === "image") && overlayOpacity > 0 && (
        <div
          className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-300"
          style={{ opacity: overlayOpacity / 100 }}
        />
      )}

      {/* Content Container */}
      <div
        className={`relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6 w-full flex flex-col items-center justify-center transition-all ${getHeightClasses()}`}
      >
        {showText && (
          <>
            {headline && (
              <h2
                className="text-3xl font-bold uppercase leading-tight tracking-[0.04em] sm:text-4xl md:text-5xl lg:text-6xl drop-shadow-sm"
                style={{ color: textColor }}
              >
                <TranslatedText text={headline}>{headline}</TranslatedText>
              </h2>
            )}

            {subheading && (
              <p
                className="mt-3 text-base uppercase tracking-[0.18em] sm:text-lg md:mt-4 md:text-xl font-medium drop-shadow-sm"
                style={{ color: textColor }}
              >
                <TranslatedText text={subheading}>{subheading}</TranslatedText>
              </p>
            )}

            {ctaLabel && ctaHref && (
              <div className="mt-8 md:mt-10">
                <Link
                  to={getLocalizedPath(ctaHref)}
                  className="inline-block bg-white px-10 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-stone-900 transition hover:bg-stone-100 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white rounded-none shadow-md"
                >
                  <TranslatedText text={ctaLabel}>{ctaLabel}</TranslatedText>
                </Link>
              </div>
            )}

            {finePrint && (
              <p
                className="mx-auto mt-8 max-w-xl text-xs leading-relaxed md:mt-10 drop-shadow-sm"
                style={{ color: textColor, opacity: 0.95 }}
              >
                <TranslatedText text={finePrint}>{finePrint}</TranslatedText>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default PromoBanner
