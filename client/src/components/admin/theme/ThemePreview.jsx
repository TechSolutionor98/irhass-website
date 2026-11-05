"use client"

import { Heart, Search, ShoppingCart, User } from "lucide-react"

import { getFullImageUrl } from "../../../utils/imageUtils"

/**
 * A miniature of the storefront, painted from the theme being edited.
 *
 * It renders from plain inline styles rather than the `bg-nav-bg` utilities on
 * purpose: those read the CSS variables on <html>, which the admin panel
 * deliberately never sets, so the preview has to carry its own colours. That
 * also means what you see here updates on every keystroke without touching the
 * live site.
 */
const ThemePreview = ({ theme, device = "desktop" }) => {
  const { brandScale = {}, header = {}, navbar = {}, footer = {}, buttons = {}, page = {}, logos = {} } = theme
  const isMobile = device === "mobile"

  const headerLogo = getFullImageUrl(isMobile ? logos.headerMobile : logos.headerDesktop)
  const footerLogo = getFullImageUrl(logos.footer)

  const footerBg = isMobile ? footer.mobileBackground : footer.background
  const footerText = isMobile ? footer.mobileText : footer.text
  const footerHeading = isMobile ? footer.mobileHeading : footer.heading

  return (
    <div
      className={`rounded-lg overflow-hidden border border-gray-300 shadow-sm ${isMobile ? "max-w-[320px]" : ""}`}
    >
      {/* Header */}
      <div style={{ backgroundColor: header.background, color: header.text }} className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          {headerLogo ? (
            <img
              src={headerLogo}
              alt="Logo"
              className="h-6 object-contain shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          ) : (
            <span className="text-xs font-bold shrink-0">LOGO</span>
          )}

          {!isMobile && (
            <div className="flex-1 flex min-w-0">
              <div
                className="flex-1 text-[10px] px-2 py-1.5 rounded-l truncate"
                style={{
                  backgroundColor: "#ffffff",
                  border: `1px solid ${header.border}`,
                  color: "#9ca3af",
                }}
              >
                Search products...
              </div>
              <div
                className="px-2 flex items-center rounded-r"
                style={{ backgroundColor: header.searchButtonBackground, color: header.searchButtonText }}
              >
                <Search className="w-3 h-3" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 shrink-0" style={{ color: header.icon }}>
            <Heart className="w-3.5 h-3.5" />
            <User className="w-3.5 h-3.5" />
            <div className="relative">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span
                className="absolute -top-1.5 -right-1.5 text-[7px] leading-none w-3 h-3 rounded-full flex items-center justify-center"
                style={{ backgroundColor: header.badgeBackground, color: header.badgeText }}
              >
                3
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category navigation bar */}
      <div
        style={{ backgroundColor: navbar.background, color: navbar.text }}
        className="px-3 py-1.5 flex items-center gap-3 text-[10px] font-medium"
      >
        <span
          className="px-1.5 py-0.5 rounded"
          style={{ backgroundColor: navbar.buttonBackground, color: navbar.buttonText }}
        >
          All
        </span>
        <span className="relative pb-1">
          Laptops
          <span
            className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full"
            style={{ backgroundColor: navbar.activeIndicator }}
          />
        </span>
        <span style={{ opacity: 0.9 }}>Printers</span>
        {!isMobile && <span style={{ opacity: 0.9 }}>Accessories</span>}
      </div>

      {/* Dropdown sliver, so the mega-menu colours are visible too */}
      <div
        style={{ backgroundColor: navbar.dropdownBackground, color: navbar.dropdownText }}
        className="px-3 py-1.5 text-[10px] flex gap-3 border-b"
      >
        <span
          className="px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: navbar.dropdownHoverBackground,
            color: navbar.dropdownHoverText,
          }}
        >
          Gaming laptops
        </span>
        <span>Business laptops</span>
      </div>

      {/* Page body */}
      <div style={{ backgroundColor: page.background, color: page.text }} className="px-3 py-3">
        <h4 className="text-xs font-bold mb-0.5" style={{ color: page.heading }}>
          Featured products
        </h4>
        <p className="text-[10px] mb-2.5" style={{ color: page.muted }}>
          Hand-picked deals this week
        </p>

        <div className={`grid gap-2 ${isMobile ? "grid-cols-2" : "grid-cols-3"}`}>
          {[0, 1, 2].slice(0, isMobile ? 2 : 3).map((i) => (
            <div
              key={i}
              className="rounded p-2"
              style={{ backgroundColor: page.surface, border: `1px solid ${page.border}` }}
            >
              <div
                className="h-8 rounded mb-1.5"
                style={{ backgroundColor: brandScale[100] || page.border }}
              />
              <p className="text-[9px] leading-tight mb-1" style={{ color: page.text }}>
                Product name
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold" style={{ color: page.price }}>
                  Rs 499
                </span>
                <span className="text-[8px] line-through" style={{ color: page.oldPrice }}>
                  599
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 mt-2.5">
          <span
            className="text-[10px] px-2.5 py-1 rounded font-medium"
            style={{ backgroundColor: buttons.primaryBackground, color: buttons.primaryText }}
          >
            Add to cart
          </span>
          <span
            className="text-[10px] px-2.5 py-1 rounded font-medium"
            style={{
              backgroundColor: buttons.secondaryBackground,
              color: buttons.secondaryText,
              border: `1px solid ${buttons.secondaryBorder}`,
            }}
          >
            Wishlist
          </span>
          <span className="text-[10px] underline" style={{ color: page.link }}>
            View all
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ backgroundColor: footerBg, color: footerText }} className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {footerLogo ? (
              <img
                src={footerLogo}
                alt="Footer logo"
                className="h-5 object-contain mb-1.5"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                }}
              />
            ) : (
              <p className="text-[10px] font-bold mb-1.5">LOGO</p>
            )}
            <p className="text-[9px]" style={{ opacity: 0.85 }}>
              Subscribe to our newsletter
            </p>
          </div>
          <div className="text-[9px] shrink-0">
            <p className="font-semibold mb-1" style={{ color: footerHeading }}>
              Support
            </p>
            <p style={{ color: footer.linkHover }}>Track order</p>
            <p style={{ opacity: 0.85 }}>Contact us</p>
          </div>
        </div>
      </div>

      <div
        style={{ backgroundColor: footer.bottomBarBackground, color: footer.bottomBarText }}
        className="px-3 py-1.5 text-[9px] text-center"
      >
        &copy; Irhaas &middot; All rights reserved
      </div>
    </div>
  )
}

export default ThemePreview
