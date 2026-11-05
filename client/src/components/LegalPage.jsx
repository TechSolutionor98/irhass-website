"use client"

import { Link } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import SEO from "./SEO"

/**
 * Shared layout for every policy and information page.
 *
 * One component so the nine of them cannot drift apart again: they were each carrying
 * their own container, heading sizes and colours, which is why some were grey cards
 * and others white, and why a correction had to be made nine times.
 *
 * Content is plain data -- see src/data/legalPages.js. A section is either `body`
 * (paragraphs) or `points` (a list), or both.
 */
const LegalPage = ({ page }) => {
  const { getLocalizedPath } = useLanguage()
  const { slug, title, intro, updated, sections = [], footer } = page

  return (
    <>
      <SEO title={`${title} | Irha's Wardrobe`} description={intro} canonicalPath={`/${slug}`} />

      <div className="mx-auto w-full max-w-[820px] px-4 py-12 sm:px-6 lg:px-8 md:py-16">
        <nav className="mb-8 flex items-center gap-2 text-xs text-stone-500">
          <Link to={getLocalizedPath("/")} className="transition-colors hover:text-stone-900">
            Home
          </Link>
          <span aria-hidden="true" className="text-stone-300">|</span>
          <span className="text-stone-900">{title}</span>
        </nav>

        <header className="border-b border-stone-200 pb-8">
          <h1 className="text-2xl font-semibold uppercase tracking-[0.12em] text-stone-900 md:text-[32px]">
            {title}
          </h1>
          {intro && <p className="mt-4 text-sm leading-relaxed text-stone-600 md:text-base">{intro}</p>}
          {updated && (
            <p className="mt-5 text-xs uppercase tracking-[0.14em] text-stone-400">Last updated {updated}</p>
          )}
        </header>

        <div className="divide-y divide-stone-200">
          {sections.map((section, i) => (
            <section key={section.title} className="py-8 md:py-10">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-900">
                {/* Numbered so a customer or a support agent can cite a clause. */}
                <span className="mr-3 text-stone-400">{String(i + 1).padStart(2, "0")}</span>
                {section.title}
              </h2>

              {section.body?.map((paragraph, j) => (
                <p key={j} className="mt-4 text-sm leading-relaxed text-stone-700">
                  {paragraph}
                </p>
              ))}

              {section.points?.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {section.points.map((point, j) => (
                    <li key={j} className="flex gap-3 text-sm leading-relaxed text-stone-700">
                      <span aria-hidden="true" className="mt-[9px] h-1 w-1 flex-shrink-0 rounded-full bg-brand-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {footer && (
          <div className="border-t border-stone-900 pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-900">{footer.title}</h2>
            <dl className="mt-4 space-y-2 text-sm">
              {footer.rows.map(([term, value]) => (
                <div key={term} className="flex flex-wrap gap-x-3">
                  <dt className="w-28 flex-shrink-0 text-stone-500">{term}</dt>
                  <dd className="text-stone-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </>
  )
}

export default LegalPage
