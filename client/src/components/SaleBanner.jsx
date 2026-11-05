"use client"

import { Link } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import TranslatedText from "./TranslatedText"

/**
 * Full-bleed campaign banner: one photograph, an offer, and two ways into the sale.
 *
 * Everything is a prop, so changing the season's offer is an edit to Home.jsx rather
 * than to this file. The image lives in public/media -- drop a replacement at the same
 * path, or pass `image`.
 */
const SaleBanner = ({
  image = "/media/sale-banner.jpg",
  eyebrow = "Sale",
  headline = "30%-50%",
  subheading = "Selected lines",
  ctas = [
    { label: "Dresses", href: "/shop/dresses" },
    { label: "Abayas", href: "/shop/abayas-and-modest-wear" },
  ],
}) => {
  const { getLocalizedPath } = useLanguage()

  // Breaks out of the 1360px content cap, like the gallery above it. Layout's <main>
  // carries `overflow-x: clip` so the viewport-width section cannot add a scrollbar.
  return (
    <section
      aria-label={`${eyebrow} ${headline}`}
      className="relative left-1/2 mt-12 w-screen -translate-x-1/2 overflow-hidden md:mt-16"
    >
      <div className="relative h-[520px] w-full md:h-[560px]">
        <img
          src={image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* The type sits over whatever the photograph happens to be doing at that spot,
            so it gets its own scrim: a wash from the text side rather than a flat tint,
            which would dull the whole image. */}
        <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/25 to-transparent" />
        {/* On phones the panel stacks over the middle of the photo, so it needs a
            full-width scrim instead of a side one. */}
        <div className="absolute inset-0 bg-black/30 md:hidden" />

        <div className="relative mx-auto flex h-full max-w-[1360px] items-center justify-center px-6 md:justify-end md:px-12 lg:px-20">
          <div className="max-w-md text-center text-white">
            <p className="text-2xl font-light uppercase tracking-[0.3em] md:text-3xl">
              <TranslatedText>{eyebrow}</TranslatedText>
            </p>

            <p className="mt-2 text-5xl font-light leading-none tracking-tight md:mt-3 md:text-7xl">
              {headline}
            </p>

            <p className="mt-3 text-xs uppercase tracking-[0.34em] text-white/90 md:mt-4 md:text-sm">
              <TranslatedText>{subheading}</TranslatedText>
            </p>

            {ctas?.length > 0 && (
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row md:mt-10 md:gap-4">
                {ctas.map((cta) => (
                  <Link
                    key={cta.href}
                    to={getLocalizedPath(cta.href)}
                    className="min-w-[170px] bg-white px-10 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-900 transition-colors hover:bg-brand-600 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:text-sm"
                  >
                    <TranslatedText>{cta.label}</TranslatedText>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default SaleBanner
