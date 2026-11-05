"use client"

import { useState } from "react"
import { Link } from "react-router-dom"
import { Facebook, Instagram, Linkedin, ChevronRight } from "lucide-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faPinterest, faTiktok, faYoutube } from "@fortawesome/free-brands-svg-icons"
import { useLanguage } from "../context/LanguageContext"
import NewsletterModal from "./NewsletterModal"
import TranslatedText from "./TranslatedText"

// The service pages, as one centred row. Categories are deliberately absent: all six
// sit in the header on every page, so repeating them here only adds noise.
const PRIMARY_LINKS = [
  { label: "Shop", to: "/shop" },
  { label: "About Us", to: "/about" },
  { label: "Delivery & Returns", to: "/delivery-terms" },
  { label: "Track My Order", to: "/track-order" },
  { label: "Return My Order", to: "/refund-return" },
  { label: "Contact Us", to: "/contact" },
  { label: "Blog", to: "/blogs" },
  { label: "Wishlist", to: "/wishlist" },
]

const LEGAL_LINKS = [
  { label: "Terms & Conditions", to: "/terms-conditions" },
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Cookies Policy", to: "/cookies-policy" },
  { label: "Disclaimer Policy", to: "/disclaimer-policy" },
  { label: "Voucher Terms", to: "/voucher-terms" },
]

const SOCIALS = [
  { href: "https://www.instagram.com/irhaas/", label: "Instagram", Icon: Instagram },
  { href: "https://www.facebook.com/irhaasae/", label: "Facebook", Icon: Facebook },
  { href: "https://www.pinterest.com/irhaas/", label: "Pinterest", icon: faPinterest },
  { href: "https://www.tiktok.com/@irhaas", label: "TikTok", icon: faTiktok },
  { href: "https://www.youtube.com/@irhaas", label: "YouTube", icon: faYoutube },
  { href: "https://www.linkedin.com/company/irhaasae", label: "LinkedIn", Icon: Linkedin },
]

const Footer = ({ className = "" }) => {
  const { getLocalizedPath } = useLanguage()
  const [newsletterEmail, setNewsletterEmail] = useState("")
  const [showNewsletterModal, setShowNewsletterModal] = useState(false)

  const handleNewsletterSubmit = (e) => {
    e.preventDefault()
    if (newsletterEmail) setShowNewsletterModal(true)
  }

  // One footer for every width rather than a hidden desktop copy and a hidden mobile
  // copy: two markups meant every link had to be changed twice, and they had drifted.
  return (
    <footer className={`bg-white ${className}`}>
      {/* Newsletter */}
      <section className="bg-stone-100 px-4 py-12 text-center sm:px-6 md:py-16">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-stone-900 md:text-base">
          <TranslatedText>Subscribe to our newsletter</TranslatedText>
        </h2>

        <form onSubmit={handleNewsletterSubmit} className="mx-auto mt-6 flex max-w-[680px] items-stretch">
          <label htmlFor="footer-newsletter" className="sr-only">
            <TranslatedText>Email address</TranslatedText>
          </label>
          <input
            id="footer-newsletter"
            type="email"
            value={newsletterEmail}
            onChange={(e) => setNewsletterEmail(e.target.value)}
            placeholder="Enter email address here"
            className="min-w-0 flex-1 border border-stone-300 bg-white px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Subscribe"
            className="flex w-16 flex-shrink-0 items-center justify-center bg-footer-bg text-white transition-colors hover:bg-brand-700"
          >
            <ChevronRight size={20} strokeWidth={2} />
          </button>
        </form>

        <p className="mx-auto mt-5 max-w-[680px] text-xs text-stone-600 md:text-sm">
          <TranslatedText>For more information (including how to unsubscribe) please see our</TranslatedText>{" "}
          <Link to={getLocalizedPath("/contact")} className="font-semibold text-stone-900 underline underline-offset-2">
            <TranslatedText>Contact Us</TranslatedText>
          </Link>{" "}
          <TranslatedText>and our</TranslatedText>{" "}
          <Link
            to={getLocalizedPath("/privacy-policy")}
            className="font-semibold text-stone-900 underline underline-offset-2"
          >
            <TranslatedText>Privacy Policy</TranslatedText>
          </Link>
          .
        </p>

        {showNewsletterModal && (
          <NewsletterModal email={newsletterEmail} onClose={() => setShowNewsletterModal(false)} />
        )}
      </section>

      {/* Primary links */}
      <nav className="px-4 pt-12 sm:px-6" aria-label="Footer">
        <ul className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-center gap-x-8 gap-y-4 md:gap-x-10">
          {PRIMARY_LINKS.map((link) => (
            <li key={link.to}>
              <Link
                to={getLocalizedPath(link.to)}
                className="text-sm font-bold text-stone-900 transition-colors hover:text-brand-600"
              >
                <TranslatedText>{link.label}</TranslatedText>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Social */}
      <div className="flex items-center justify-center gap-7 px-4 pb-10 pt-9">
        {SOCIALS.map(({ href, label, Icon, icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="text-stone-900 transition-colors hover:text-brand-600"
          >
            {Icon ? <Icon className="h-5 w-5" strokeWidth={1.6} /> : <FontAwesomeIcon icon={icon} className="h-5 w-5" />}
          </a>
        ))}
      </div>

      {/* Legal */}
      <div className="border-t border-stone-200 px-4 py-8 sm:px-6">
        <ul className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-center gap-x-7 gap-y-3">
          {LEGAL_LINKS.map((link) => (
            <li key={link.to}>
              <Link
                to={getLocalizedPath(link.to)}
                className="text-xs text-stone-700 underline underline-offset-4 transition-colors hover:text-stone-900 md:text-sm"
              >
                <TranslatedText>{link.label}</TranslatedText>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-xs text-stone-500 md:text-sm">
          © {new Date().getFullYear()} <TranslatedText>Irha&apos;s Wardrobe. All rights reserved.</TranslatedText>
        </p>
      </div>
    </footer>
  )
}

export default Footer
