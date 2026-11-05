"use client"

import { Link } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import TranslatedText from "./TranslatedText"

/**
 * Full-bleed promotional block for the top of the home page.
 *
 * Sits on brand-600 rather than brand-500: white text clears WCAG AA at 4.97:1 there,
 * where the lighter 500 manages only 3.23. The fine print is white/95 (4.68:1) for the
 * same reason -- the usual white/70 would drop it to 3.4 and fail at that size.
 * Everything is props, so a campaign change is a one-line edit at the call site.
 */
const PromoBanner = ({
  headline = "25% off new season",
  subheading = "Family & friends event",
  ctaLabel = "Shop now",
  ctaHref = "/shop",
  finePrint = "Discount applied at checkout on 2 or more items. Cannot be combined with other offers.",
}) => {
  const { getLocalizedPath } = useLanguage()
  if (!headline && !subheading) return null

  return (
    <section
      className="bg-brand-600 text-white"
      aria-label={typeof headline === "string" ? headline : "Promotion"}
    >
      <div className="mx-auto max-w-5xl px-4 py-12 text-center sm:px-6 md:py-16">
        {headline && (
          <h2 className="text-3xl font-bold uppercase leading-tight tracking-[0.04em] sm:text-4xl md:text-5xl">
            <TranslatedText>{headline}</TranslatedText>
          </h2>
        )}

        {subheading && (
          <p className="mt-3 text-base uppercase tracking-[0.18em] text-white sm:text-lg md:mt-4 md:text-xl">
            <TranslatedText>{subheading}</TranslatedText>
          </p>
        )}

        {ctaLabel && ctaHref && (
          <div className="mt-7 md:mt-9">
            <Link
              to={getLocalizedPath(ctaHref)}
              className="inline-block bg-white px-10 py-3.5 text-sm font-semibold uppercase tracking-[0.14em] text-brand-700 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <TranslatedText>{ctaLabel}</TranslatedText>
            </Link>
          </div>
        )}

        {finePrint && (
          <p className="mx-auto mt-7 max-w-xl text-xs leading-relaxed text-white/95 md:mt-9">
            <TranslatedText>{finePrint}</TranslatedText>
          </p>
        )}
      </div>
    </section>
  )
}

export default PromoBanner
