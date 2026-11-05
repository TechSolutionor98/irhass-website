"use client"

import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import TranslatedText from "./TranslatedText"

/**
 * Full-bleed video hero.
 *
 * Autoplay only works muted and with playsInline, and iOS additionally refuses to
 * start until the element is on screen -- so playback is driven by an IntersectionObserver
 * rather than the `autoplay` attribute. That also keeps the video from decoding while
 * scrolled past, which is the expensive part on a phone.
 *
 * The poster carries the first frame, so the section never flashes black while the
 * video downloads, and it is what a viewer sees if the file fails or motion is reduced.
 */
const VideoHero = ({
  src = "/media/hero.mp4",
  poster = "/media/hero-poster.jpg",
  heading = "The new season edit",
  subheading = "Considered pieces, made to be worn",
  ctas = [
    { label: "Shop new in", href: "/shop" },
    { label: "Shop abayas", href: "/shop/abayas-and-modest-wear" },
  ],
}) => {
  const { getLocalizedPath } = useLanguage()
  const videoRef = useRef(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(query.matches)
    const onChange = (e) => setReducedMotion(e.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
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
  }, [reducedMotion])

  return (
    <section className="relative w-full overflow-hidden bg-footer-bg" aria-label="Featured collection">
      <div className="relative h-[60vh] min-h-[380px] w-full md:h-[72vh] md:min-h-[520px]">
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

        {/* Scrim. Without it the white type sits on whatever the footage happens to be
            doing at that moment, which is never reliably readable. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />

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
      </div>
    </section>
  )
}

export default VideoHero
