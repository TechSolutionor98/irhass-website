/**
 * The three built-in designs.
 *
 * These live in code, not in the database, and that is the point: there is no edit
 * path to them, so no admin can leave the shop with a broken starting point and no
 * way back. Picking one copies its blocks into a new row in My Templates; the
 * original is never touched.
 *
 * They share one skeleton -- masthead, banner, headline, message, button, a middle
 * section, footer -- so the shop reads as one voice however the middle changes.
 */

import { EMAIL_THEME as T } from "./emailTheme.js"

const COMPANY = "Irha's Wardrobe"

const masthead = (tagline) => ({ type: "masthead", tagline, companyName: COMPANY, logoWidth: 150 })

const footer = () => ({
  type: "footer",
  background: T.ink,
  companyName: COMPANY,
  address: "Lahore, Pakistan",
  contact: "info@irhaas.com · +92 321 4980835",
  note: "You are receiving this because you shopped with us or signed up for our news.",
})

const skeleton = ({ tagline, banner, headline, message, buttonLabel, buttonUrl, middle }) => [
  masthead(tagline),
  { type: "image", src: banner, alt: headline, fullWidth: true },
  { type: "heading", text: headline, align: "center", fontSize: 30, paddingTop: 32, paddingBottom: 12 },
  { type: "text", html: message, align: "center", paddingBottom: 20 },
  { type: "button", label: buttonLabel, url: buttonUrl, align: "center", background: T.ink, color: T.white, paddingBottom: 28 },
  { type: "divider", paddingTop: 0, paddingBottom: 8 },
  ...middle,
  footer(),
]

/**
 * Each design differs only in its middle section.
 *
 * `preview` is what the picker shows on the card, so an admin can tell them apart
 * without opening all three.
 */
export const DEFAULT_EMAIL_TEMPLATES = [
  {
    id: "product-announcement",
    name: "Product Announcement",
    description: "One product, picture beside the words. For a single launch or a restock.",
    preview: "Masthead · banner · headline · one product",
    subject: "Just in at Irha's Wardrobe",
    preheader: "A new piece has landed — see it first.",
    blocks: skeleton({
      tagline: "New arrival",
      banner: "/media/hero-poster.jpg",
      headline: "A new piece has landed",
      message: "<p>Cut from fabric we spent the season choosing, and made in the quantities we can stand behind. Here it is first.</p>",
      buttonLabel: "See the piece",
      buttonUrl: "/shop",
      middle: [
        {
          type: "product",
          layout: "side",
          name: "Choose a product",
          category: "",
          description: "Use Choose a product to pull this straight from your catalogue.",
          price: "",
          oldPrice: "",
          badge: "",
          image: "",
          url: "/shop",
          buttonLabel: "Shop now",
          paddingTop: 20,
          paddingBottom: 24,
        },
      ],
    }),
  },

  {
    id: "three-products",
    name: "Three Products",
    description: "Three shop-style cards in a row, each with its own Shop now.",
    preview: "Masthead · banner · headline · three cards",
    subject: "Three pieces we are wearing this week",
    preheader: "A short edit — three pieces, chosen by us.",
    blocks: skeleton({
      tagline: "The edit",
      banner: "/media/auth-poster.jpg",
      headline: "Three we are wearing",
      message: "<p>A small edit rather than the whole rail. Three pieces, and why each one earns its place.</p>",
      buttonLabel: "Shop the edit",
      buttonUrl: "/shop",
      middle: [
        {
          type: "columns",
          gutter: 16,
          paddingTop: 20,
          paddingBottom: 24,
          columns: [
            { image: "", heading: "Choose a product", text: "", href: "/shop", buttonLabel: "Shop now" },
            { image: "", heading: "Choose a product", text: "", href: "/shop", buttonLabel: "Shop now" },
            { image: "", heading: "Choose a product", text: "", href: "/shop", buttonLabel: "Shop now" },
          ],
        },
      ],
    }),
  },

  {
    id: "banner-promotion",
    name: "Banner & Promotion",
    description: "No products — a second banner, then a discount code.",
    preview: "Masthead · banner · headline · banner · coupon",
    subject: "Your code is inside",
    preheader: "A little something off, for a short while.",
    blocks: skeleton({
      tagline: "Offer",
      banner: "/media/sale-banner.jpg",
      headline: "A little something off",
      message: "<p>For a short while, and on everything. No minimum, no exclusions to read twice.</p>",
      buttonLabel: "Start shopping",
      buttonUrl: "/shop",
      middle: [
        { type: "image", src: "/media/signup.png", alt: "", fullWidth: true },
        {
          type: "coupon",
          heading: "Use this at checkout",
          code: "YOURCODE",
          description: "Enter it in the coupon box on the payment step.",
          buttonLabel: "Shop now",
          url: "/shop",
          expiry: "Valid for 14 days.",
          background: T.cream,
          borderColor: T.gold,
          paddingTop: 24,
          paddingBottom: 28,
        },
      ],
    }),
  },
]

export const getDefaultTemplate = (id) =>
  DEFAULT_EMAIL_TEMPLATES.find((template) => template.id === String(id)) || null

export default DEFAULT_EMAIL_TEMPLATES
