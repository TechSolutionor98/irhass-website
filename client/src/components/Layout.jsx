import { lazyWithRetry } from "../utils/lazyWithRetry"
import { Suspense, lazy, useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import Navbar from "./Navbar"
import BlogNavbar from "./BlogNavbar"
import StaticRouteSEO from "./StaticRouteSEO"
import StaticPageTranslationLoader from "./StaticPageTranslationLoader"
import StaticPageContentTranslator from "./StaticPageContentTranslator"
import CartDrawer from "./CartDrawer"

import config from "../config/config"

const Footer = lazyWithRetry(() => import("./Footer"))
const BlogFooter = lazyWithRetry(() => import("./BlogFooter"))

// Centralized company WhatsApp number from config.js
const WHATSAPP_NUMBER = config.COMPANY_WHATSAPP_NUMBER || "923257847744"

/**
 * Floating WhatsApp button.
 *
 * The glyph is inline SVG rather than an image file: the previous version pointed at
 * /whatsapp.webp, which was deleted in the rebrand, so every page rendered a broken
 * image icon with the alt text spilling out of the circle. Nothing to 404 now, and it
 * stays sharp at any size.
 *
 * On a pointer device the pill expands on hover to say what it is -- a bare green
 * circle asks the visitor to recognise a logo before they will touch it. On touch
 * there is no hover, so it stays a circle and does not sit over the content.
 *
 * `lifted` raises it on the pages that carry their own sticky action bar on phones
 * (product and cart). At its usual height it sat on top of the Checkout and Buy Now
 * buttons, which is the one place a visitor must be able to tap.
 */
function WhatsAppButton({ lifted = false }) {
  const handleClick = (e) => {
    e.preventDefault()
    const url = config.getWhatsAppUrl
      ? config.getWhatsAppUrl("", WHATSAPP_NUMBER)
      : `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}`
    window.open(url, "_blank")
  }

  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      onClick={handleClick}
      target="_blank"
      rel="noopener noreferrer"
      className={`group fixed right-4 z-50 flex items-center ${
        lifted ? "bottom-44 md:bottom-28" : "bottom-24 md:bottom-20"
      }`}
      aria-label="Chat on WhatsApp"
    >
      <span className="relative flex h-14 items-center overflow-hidden rounded-full bg-gradient-to-br from-[#2ee06a] to-[#128C7E] pl-[14px] pr-[14px] shadow-[0_6px_20px_-4px_rgba(18,140,126,0.55)] ring-1 ring-white/25 transition-all duration-300 ease-out group-hover:pr-5 group-hover:shadow-[0_10px_28px_-6px_rgba(18,140,126,0.7)]">
        <svg viewBox="0 0 24 24" className="h-7 w-7 flex-shrink-0 fill-white drop-shadow-sm" role="img" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.886-9.885 9.886m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" />
        </svg>

        {/* Width animates from zero so the pill grows out of the circle rather than
            the label appearing next to it. Hidden from touch, where it cannot open. */}
        <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold text-white transition-all duration-300 ease-out group-hover:ml-3 group-hover:max-w-[160px] md:inline">
          Chat with us
        </span>
      </span>

      {/* Halo. Behind the pill, so it reads as a glow and never intercepts the click. */}
      <span
        aria-hidden="true"
        className="whatsapp-halo pointer-events-none absolute right-0 top-0 h-14 w-14 rounded-full bg-[#25D366]"
      />

      <style>{`
        @keyframes whatsapp-halo-pulse {
          0%   { transform: scale(1);   opacity: 0.45; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .whatsapp-halo {
          z-index: -1;
          animation: whatsapp-halo-pulse 2.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .whatsapp-halo { animation: none; opacity: 0; }
        }
      `}</style>
    </a>
  )
}

function Layout() {
  const location = useLocation()
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  )
  const [showDeferredChrome, setShowDeferredChrome] = useState(false)
  // Check if current path is a blog page (with or without language prefix)
  // Matches: /blogs, /blogs/slug, /ae-en/blogs, /ae-en/blogs/slug, /ar/blogs, etc.
  const isBlogPage = location.pathname.match(/^\/([a-z]{2}(-[a-z]{2})?\/)?blogs(\/|$)/i)
  // Pages with a sticky action bar pinned to the bottom of the phone viewport. The
  // WhatsApp bubble has to clear it, or it covers Add to Bag / Checkout.
  const hasStickyActionBar = /^\/([a-z]{2}(-[a-z]{2})?\/)?(product\/|cart$|cart\/)/i.test(
    location.pathname,
  )

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    if (!isMobileViewport) {
      setShowDeferredChrome(true)
      return
    }

    setShowDeferredChrome(false)

    const revealChrome = () => setShowDeferredChrome(true)
    const idleId = window.setTimeout(revealChrome, 1400)

    window.addEventListener("scroll", revealChrome, { once: true, passive: true })
    window.addEventListener("pointerdown", revealChrome, { once: true, passive: true })
    window.addEventListener("touchstart", revealChrome, { once: true, passive: true })

    return () => {
      window.clearTimeout(idleId)
      window.removeEventListener("scroll", revealChrome)
      window.removeEventListener("pointerdown", revealChrome)
      window.removeEventListener("touchstart", revealChrome)
    }
  }, [isMobileViewport])

  return (
    <div className="flex flex-col min-h-screen">
      <StaticRouteSEO />
      <StaticPageTranslationLoader />

      {/* Navbar - Conditional based on page */}
      {isBlogPage ? <BlogNavbar /> : <Navbar />}

      {/* Main Content Area - Grows to fill space */}
      <main className="flex-1 w-full overflow-x-clip bg-page-bg text-page-text">
        <StaticPageContentTranslator>
          <div className="w-full max-w-[1360px] mx-auto">
            <Outlet />
          </div>
        </StaticPageContentTranslator>
      </main>

      {/* Footer - Conditional based on page */}
      {showDeferredChrome && (
        <Suspense fallback={null}>
          {isBlogPage ? <BlogFooter /> : <Footer />}
        </Suspense>
      )}

      {/* WhatsApp Button */}
      {showDeferredChrome && <WhatsAppButton lifted={hasStickyActionBar} />}

      {/* Slide-over cart. Mounted once here so every add-to-cart button on the site
          can open it, and so it survives route changes. */}
      <CartDrawer />
    </div>
  )
}

export default Layout
