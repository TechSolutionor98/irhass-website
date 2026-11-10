"use client"

import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import TranslatedText from "./TranslatedText"

/**
 * Full-bleed video or graphic hero banner.
 *
 * Supports both MP4/WebM video and static graphic banners (JPEG, PNG, WebP).
 * When an image banner is used without overlay text, it renders cleanly at its
 * natural 16:9 aspect ratio without cropping, distortion, or dark scrims,
 * allowing pre-designed artwork and embedded CTAs to shine through.
 */
const VideoHero = ({
  src = "/media/hero-banner.jpg",
  poster = "/media/hero-banner.jpg",
  heading = "",
  subheading = "",
  ctas = [],
  link = "/shop",
}) => {
  const { getLocalizedPath } = useLanguage()
  const videoRef = useRef(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const isVideo = Boolean(src && /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(src))
  const hasOverlay = Boolean(heading || subheading || (ctas && ctas.length > 0))

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(query.matches)
    const onChange = (e) => setReducedMotion(e.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    if (!isVideo) return
    const video = videoRef.current
    if (!video || reducedMotion) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Safari rejects the promise when it blocks autoplay; the poster stays up,
          // which is a perfectly good fallback, so swallow it rather than logging.
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [reducedMotion, isVideo])

  const mediaElement = isVideo ? (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src={src} type="video/mp4" />
    </video>
  ) : (
    <img
      src={src || poster}
      alt={typeof heading === "string" && heading ? heading : "Beauty Begins With Style"}
      className="absolute inset-0 h-full w-full object-cover object-center"
      loading="eager"
      fetchPriority="high"
    />
  )

  const bannerInner = (
    <div className={`relative w-full overflow-hidden ${hasOverlay ? "h-[60vh] min-h-[380px] md:h-[72vh] md:min-h-[520px]" : "aspect-video"}`}>
      {mediaElement}

      {/* Scrim. Only render if there is overlay text that requires contrast */}
      {hasOverlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
      )}

      {hasOverlay && (
        <div className="relative flex h-full flex-col items-center justify-end px-4 pb-10 text-center md:pb-16">
          {heading && (
            <h2 className="max-w-3xl text-3xl font-semibold uppercase tracking-[0.06em] text-white drop-shadow-sm sm:text-4xl md:text-5xl">
              <TranslatedText>{heading}</TranslatedText>
            </h2>
          )}
          {subheading && (
            <p className="mt-3 max-w-xl text-sm uppercase tracking-[0.18em] text-white/90 md:text-base">
              <TranslatedText>{subheading}</TranslatedText>
            </p>
          )}

          {ctas?.length > 0 && (
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 md:mt-9 md:gap-4">
              {ctas.map((cta) => (
                <Link
                  key={cta.href}
                  to={getLocalizedPath(cta.href)}
                  className="min-w-[190px] border border-white bg-white/95 px-8 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-stone-900 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:text-sm"
                >
                  <TranslatedText>{cta.label}</TranslatedText>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <section className="relative w-full overflow-hidden bg-footer-bg" aria-label="Featured collection">
      {!hasOverlay && link ? (
        <Link
          to={getLocalizedPath(link)}
          className="block w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
          aria-label="Shop collection"
        >
          {bannerInner}
        </Link>
      ) : (
        bannerInner
      )}
    </section>
  )
}

export default VideoHero
