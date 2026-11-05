import { DEFAULT_BRAND_SCALE } from "./palette"

/**
 * The shipped storefront palette: the Irha's Wardrobe gold and the near-black read
 * off the logo. An untouched install -- or a failed /api/theme request -- renders
 * in these colours.
 *
 * Mirrors the defaults in server/models/themeModel.js. When you add a field in
 * one place, add it in the other.
 */
export const DEFAULT_THEME = {
  enabled: true,

  brandPrimary: DEFAULT_BRAND_SCALE[500],
  brandScale: { ...DEFAULT_BRAND_SCALE },

  logos: {
    // The wide wordmark in the header (it is ~5:1, so it is sized by height); the
    // stacked mark stays for the footer, invoices and the app icon.
    headerDesktop: "/logo-wide.png",
    headerMobile: "/logo-wide.png",
    footer: "/logo.png",
    favicon: "/favicon.png",
    altText: "Irha's Wardrobe",
    // The mark is portrait (roughly 2:3), so these boxes are narrower than the old
    // wordmark's. object-contain fits it by height; a wider box would just pad it.
    headerDesktopWidth: 72,
    headerMobileWidth: 56,
    footerWidth: 96,
  },

  header: {
    background: "#ffffff",
    text: "#181816",
    icon: "#181816",
    border: "#e7e5e4",
    searchButtonBackground: "#8e6937",
    searchButtonHoverBackground: "#684e2c",
    searchButtonText: "#ffffff",
    badgeBackground: "#181816",
    badgeText: "#ffffff",
  },

  navbar: {
    // A white strip separated by hairlines, not a solid colour band.
    background: "#ffffff",
    text: "#181816",
    hoverBackground: "#ffffff",
    hoverText: "#8e6937",
    activeIndicator: "#181816",
    buttonBackground: "#b4874a",
    buttonText: "#ffffff",
    dropdownBackground: "#ffffff",
    dropdownText: "#44403c",
    dropdownHoverBackground: "#faf6f0",
    dropdownHoverText: "#684e2c",
  },

  // Two footers: a dark panel on desktop, a white accordion on mobile.
  footer: {
    background: "#181816",
    text: "#ffffff",
    heading: "#ffffff",
    link: "#ffffff",
    linkHover: "#c29f6f",
    border: "#2a2724",
    bottomBarBackground: "#111110",
    bottomBarText: "#ffffff",
    mobileBackground: "#ffffff",
    mobileText: "#44403c",
    mobileHeading: "#181816",
    mobileLinkHover: "#8e6937",
  },

  buttons: {
    // 600 rather than 500: white on #8e6937 clears WCAG AA at 4.97:1, where the
    // old lime-500 managed only 1.98:1.
    primaryBackground: "#8e6937",
    primaryHoverBackground: "#684e2c",
    primaryText: "#ffffff",
    secondaryBackground: "#181816",
    secondaryHoverBackground: "#2a2724",
    secondaryText: "#ffffff",
    secondaryBorder: "#181816",
  },

  page: {
    background: "#ffffff",
    surface: "#faf6f0",
    text: "#44403c",
    heading: "#181816",
    muted: "#78716c",
    link: "#8e6937",
    linkHover: "#684e2c",
    border: "#e7e5e4",
    price: "#181816",
    oldPrice: "#a8a29e",
  },

  pages: [],
  customCss: "",
}

/**
 * Which CSS custom property each themed colour writes to.
 *
 * The names are also the Tailwind colour names: `--header-bg` backs
 * `bg-header-bg`, `--nav-text` backs `text-nav-text`, and so on (see
 * client/tailwind.config.js).
 */
export const CSS_VAR_MAP = {
  header: {
    background: "--header-bg",
    text: "--header-text",
    icon: "--header-icon",
    border: "--header-border",
    searchButtonBackground: "--header-search-bg",
    searchButtonHoverBackground: "--header-search-hover-bg",
    searchButtonText: "--header-search-text",
    badgeBackground: "--header-badge-bg",
    badgeText: "--header-badge-text",
  },
  navbar: {
    background: "--nav-bg",
    text: "--nav-text",
    hoverBackground: "--nav-hover-bg",
    hoverText: "--nav-hover-text",
    activeIndicator: "--nav-indicator",
    buttonBackground: "--nav-btn-bg",
    buttonText: "--nav-btn-text",
    dropdownBackground: "--nav-dropdown-bg",
    dropdownText: "--nav-dropdown-text",
    dropdownHoverBackground: "--nav-dropdown-hover-bg",
    dropdownHoverText: "--nav-dropdown-hover-text",
  },
  footer: {
    background: "--footer-bg",
    text: "--footer-text",
    heading: "--footer-heading",
    link: "--footer-link",
    linkHover: "--footer-link-hover",
    border: "--footer-border",
    bottomBarBackground: "--footer-bottom-bg",
    bottomBarText: "--footer-bottom-text",
    mobileBackground: "--footer-mobile-bg",
    mobileText: "--footer-mobile-text",
    mobileHeading: "--footer-mobile-heading",
    mobileLinkHover: "--footer-mobile-link-hover",
  },
  buttons: {
    primaryBackground: "--btn-primary-bg",
    primaryHoverBackground: "--btn-primary-hover-bg",
    primaryText: "--btn-primary-text",
    secondaryBackground: "--btn-secondary-bg",
    secondaryHoverBackground: "--btn-secondary-hover-bg",
    secondaryText: "--btn-secondary-text",
    secondaryBorder: "--btn-secondary-border",
  },
  page: {
    background: "--page-bg",
    surface: "--page-surface",
    text: "--page-text",
    heading: "--page-heading",
    muted: "--page-muted",
    link: "--page-link",
    linkHover: "--page-link-hover",
    border: "--page-border",
    price: "--page-price",
    oldPrice: "--page-old-price",
  },
}

/** The sections a per-page rule can override, in the order the admin form shows them. */
export const THEME_SECTIONS = [
  { key: "brand", flag: "overrideBrand", label: "Brand colour" },
  { key: "header", flag: "overrideHeader", label: "Header" },
  { key: "navbar", flag: "overrideNavbar", label: "Navigation bar" },
  { key: "footer", flag: "overrideFooter", label: "Footer" },
  { key: "buttons", flag: "overrideButtons", label: "Buttons" },
  { key: "page", flag: "overridePage", label: "Page colours" },
  { key: "logos", flag: "overrideLogos", label: "Logos" },
]

/** Human labels for every colour field, used by the admin colour pickers. */
export const FIELD_LABELS = {
  header: {
    background: "Header background",
    text: "Header text",
    icon: "Header icons",
    border: "Header border",
    searchButtonBackground: "Search button",
    searchButtonHoverBackground: "Search button (hover)",
    searchButtonText: "Search button text",
    badgeBackground: "Cart/wishlist badge",
    badgeText: "Badge text",
  },
  navbar: {
    background: "Navbar background",
    text: "Navbar text",
    hoverBackground: "Navbar item hover",
    hoverText: "Navbar text (hover)",
    activeIndicator: "Active item underline",
    buttonBackground: "Arrow button background",
    buttonText: "Arrow button icon",
    dropdownBackground: "Dropdown background",
    dropdownText: "Dropdown text",
    dropdownHoverBackground: "Dropdown row hover",
    dropdownHoverText: "Dropdown text (hover)",
  },
  footer: {
    background: "Footer background (desktop)",
    text: "Footer text (desktop)",
    heading: "Footer headings (desktop)",
    link: "Footer links (desktop)",
    linkHover: "Footer links on hover",
    border: "Footer borders",
    bottomBarBackground: "Bottom bar background",
    bottomBarText: "Bottom bar text",
    mobileBackground: "Footer background (mobile)",
    mobileText: "Footer text (mobile)",
    mobileHeading: "Footer headings (mobile)",
    mobileLinkHover: "Footer links on hover (mobile)",
  },
  buttons: {
    primaryBackground: "Add to Cart button",
    primaryHoverBackground: "Add to Cart button (hover)",
    primaryText: "Add to Cart text",
    secondaryBackground: "Buy Now button",
    secondaryHoverBackground: "Buy Now button (hover)",
    secondaryText: "Buy Now text",
    secondaryBorder: "Buy Now border",
  },
  page: {
    background: "Page background",
    surface: "Card / panel background",
    text: "Body text",
    heading: "Headings",
    muted: "Muted text",
    link: "Links",
    linkHover: "Links (hover)",
    border: "Borders & dividers",
    price: "Price",
    oldPrice: "Was-price (struck through)",
  },
}

/** Pairs the admin is warned about when contrast drops below AA. */
export const CONTRAST_PAIRS = [
  { section: "header", bg: "background", fg: "text", label: "Header text on header background" },
  { section: "navbar", bg: "background", fg: "text", label: "Navbar text on navbar background" },
  {
    section: "navbar",
    bg: "dropdownBackground",
    fg: "dropdownText",
    label: "Dropdown text on dropdown background",
  },
  { section: "footer", bg: "background", fg: "text", label: "Footer text on footer background" },
  {
    section: "footer",
    bg: "mobileBackground",
    fg: "mobileText",
    label: "Mobile footer text on its background",
  },
  {
    section: "buttons",
    bg: "primaryBackground",
    fg: "primaryText",
    label: "Add to Cart text on its button",
  },
  {
    section: "buttons",
    bg: "secondaryBackground",
    fg: "secondaryText",
    label: "Buy Now text on its button",
  },
  { section: "page", bg: "background", fg: "text", label: "Body text on page background" },
  { section: "page", bg: "background", fg: "heading", label: "Headings on page background" },
]

export default DEFAULT_THEME
