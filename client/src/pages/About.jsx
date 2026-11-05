"use client"

import { Link } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import TranslatedText from "../components/TranslatedText"
import SEO from "../components/SEO"
import { BRAND, COUNTRY, CONTACT, RETURN_DAYS } from "../data/legalPages"

const VALUES = [
  {
    title: "Considered pieces",
    copy: "We buy narrow and deep rather than wide and shallow. Every piece is chosen because it earns its place in a wardrobe, not because it fills a gap in a grid.",
  },
  {
    title: "Honest pricing",
    copy: "The price you see is the price you pay. No inflated original to strike through, no charge that appears at the last step.",
  },
  {
    title: "Modest by design",
    copy: "Coverage is the starting point, not an alteration. Our abayas, kaftans and longer cuts are drafted that way from the first pattern.",
  },
  {
    title: "Easy to send back",
    copy: `If a piece is not right, you have ${RETURN_DAYS} days. We would rather take a return than keep a customer with something they will not wear.`,
  },
]

export default function About() {
  const { getLocalizedPath } = useLanguage()

  return (
    <>
      <SEO
        title={`About | ${BRAND}`}
        description={`${BRAND} is a womenswear and modest-fashion label delivering across ${COUNTRY}.`}
        canonicalPath="/about"
      />

      {/* Opening statement over the brand photograph. */}
      <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden">
        <div className="relative h-[360px] w-full md:h-[440px]">
          <img
            src="/media/hero-poster.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <h1 className="text-3xl font-semibold uppercase tracking-[0.12em] text-white md:text-5xl">
              <TranslatedText>Irha&rsquo;s Wardrobe</TranslatedText>
            </h1>
            <p className="mt-4 max-w-xl text-sm uppercase tracking-[0.2em] text-white/90 md:text-base">
              <TranslatedText>Womenswear and modest fashion, delivered across Pakistan</TranslatedText>
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[820px] px-4 py-14 sm:px-6 lg:px-8 md:py-20">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-900">
            <TranslatedText>Our story</TranslatedText>
          </h2>
          <div className="mt-5 space-y-5 text-sm leading-relaxed text-stone-700 md:text-base">
            <p>
              <TranslatedText>
                Irha&rsquo;s Wardrobe began with a simple frustration: finding clothes that are modest, well made and
                priced like everyday clothing rather than occasionwear. Too often you could have two of those three.
              </TranslatedText>
            </p>
            <p>
              <TranslatedText>
                So we built the wardrobe we wanted — abayas and kaftans cut properly, dresses that work past one
                season, blouses and trousers that go with what you already own, and accessories chosen to finish an
                outfit rather than fill a catalogue.
              </TranslatedText>
            </p>
            <p>
              <TranslatedText>
                We sell online only, across Pakistan, with cash on delivery available everywhere. That keeps our costs
                down and lets us put the difference into the cloth instead of the shopfront.
              </TranslatedText>
            </p>
          </div>
        </section>

        <section className="mt-14 border-t border-stone-200 pt-12">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-900">
            <TranslatedText>What we stand for</TranslatedText>
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
            {VALUES.map((value) => (
              <div key={value.title}>
                <h3 className="text-sm font-semibold text-stone-900">
                  <TranslatedText>{value.title}</TranslatedText>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  <TranslatedText>{value.copy}</TranslatedText>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-t border-stone-200 pt-12">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-900">
            <TranslatedText>Get in touch</TranslatedText>
          </h2>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex flex-wrap gap-x-3">
              <dt className="w-24 flex-shrink-0 text-stone-500">
                <TranslatedText>Email</TranslatedText>
              </dt>
              <dd>
                <a href={`mailto:${CONTACT.email}`} className="text-stone-900 underline underline-offset-4 hover:text-brand-600">
                  {CONTACT.email}
                </a>
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-3">
              <dt className="w-24 flex-shrink-0 text-stone-500">
                <TranslatedText>Hours</TranslatedText>
              </dt>
              <dd className="text-stone-900">{CONTACT.hours}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={getLocalizedPath("/shop")}
              className="bg-footer-bg px-8 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-brand-700"
            >
              <TranslatedText>Shop the collection</TranslatedText>
            </Link>
            <Link
              to={getLocalizedPath("/contact")}
              className="border border-stone-900 px-8 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
            >
              <TranslatedText>Contact us</TranslatedText>
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
