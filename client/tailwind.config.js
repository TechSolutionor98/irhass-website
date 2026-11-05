/** @type {import('tailwindcss').Config} */

// Every themeable colour resolves through a CSS custom property that holds an
// "r g b" channel triplet, so Tailwind's opacity modifiers keep working:
// `bg-brand-500/40` compiles to rgb(var(--brand-500) / 0.4).
//
// The defaults for these variables live in src/index.css and reproduce the
// palette the site shipped with. ThemeProvider overwrites them at runtime from
// /api/theme -- but only on storefront routes, never on /admin.
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`

const BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

const brandScale = BRAND_STEPS.reduce((scale, step) => {
  scale[step] = themed(`brand-${step}`)
  return scale
}, {})

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // `lime` is the brand colour this site was built with, used in roughly
        // 700 places. Re-pointing the scale at the theme variables makes every
        // one of those usages follow the admin's brand colour with no
        // find-and-replace -- and `brand-*` is the name to use in new code.
        lime: brandScale,
        brand: brandScale,

        // Header (logo row, search, account/cart icons)
        "header-bg": themed("header-bg"),
        "header-text": themed("header-text"),
        "header-icon": themed("header-icon"),
        "header-border": themed("header-border"),
        "header-search": themed("header-search-bg"),
        "header-search-hover": themed("header-search-hover-bg"),
        "header-search-text": themed("header-search-text"),
        "header-badge": themed("header-badge-bg"),
        "header-badge-text": themed("header-badge-text"),

        // Category navigation bar and its dropdowns / mega menu
        "nav-bg": themed("nav-bg"),
        "nav-text": themed("nav-text"),
        "nav-hover": themed("nav-hover-bg"),
        "nav-hover-text": themed("nav-hover-text"),
        "nav-indicator": themed("nav-indicator"),
        "nav-btn": themed("nav-btn-bg"),
        "nav-btn-text": themed("nav-btn-text"),
        "nav-dropdown": themed("nav-dropdown-bg"),
        "nav-dropdown-text": themed("nav-dropdown-text"),
        "nav-dropdown-hover": themed("nav-dropdown-hover-bg"),
        "nav-dropdown-hover-text": themed("nav-dropdown-hover-text"),

        // Footer
        "footer-bg": themed("footer-bg"),
        "footer-text": themed("footer-text"),
        "footer-heading": themed("footer-heading"),
        "footer-link": themed("footer-link"),
        "footer-link-hover": themed("footer-link-hover"),
        "footer-border": themed("footer-border"),
        "footer-bottom": themed("footer-bottom-bg"),
        "footer-bottom-text": themed("footer-bottom-text"),
        "footer-mobile": themed("footer-mobile-bg"),
        "footer-mobile-text": themed("footer-mobile-text"),
        "footer-mobile-heading": themed("footer-mobile-heading"),
        "footer-mobile-link-hover": themed("footer-mobile-link-hover"),

        // Buttons
        "btn-primary": themed("btn-primary-bg"),
        "btn-primary-hover": themed("btn-primary-hover-bg"),
        "btn-primary-text": themed("btn-primary-text"),
        "btn-secondary": themed("btn-secondary-bg"),
        "btn-secondary-hover": themed("btn-secondary-hover-bg"),
        "btn-secondary-text": themed("btn-secondary-text"),
        "btn-secondary-border": themed("btn-secondary-border"),

        // Page surfaces and typography
        "page-bg": themed("page-bg"),
        "page-surface": themed("page-surface"),
        "page-text": themed("page-text"),
        "page-heading": themed("page-heading"),
        "page-muted": themed("page-muted"),
        "page-link": themed("page-link"),
        "page-link-hover": themed("page-link-hover"),
        "page-border": themed("page-border"),
        "page-price": themed("page-price"),
        "page-old-price": themed("page-old-price"),
      },
    },
  },
  plugins: [],
}
