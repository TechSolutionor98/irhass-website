/**
 * The block catalogue: what can be dragged in, what a fresh one contains, and which
 * settings its panel offers.
 *
 * The shapes here must match what server/services/emailRenderer.js reads. The server
 * renders the email that is actually sent; this file only decides what the editor
 * lets you build and what the canvas draws.
 */

import { EMAIL_THEME as T } from "./emailTheme"

/**
 * Field kinds the settings panel knows how to draw:
 *   text · textarea · number · colour · select · toggle · url · image ·
 *   list (lines of text) · columns · merge (text with a merge-field inserter)
 */
export const BLOCK_DEFS = {
  masthead: {
    label: "Masthead",
    icon: "PanelTop",
    group: "Layout",
    hint: "Logo on the left, a short line on the right.",
    create: () => ({ type: "masthead", tagline: "New in", companyName: "Irha's Wardrobe", logoWidth: 150, background: T.white }),
    fields: [
      { key: "tagline", label: "Right-hand text", kind: "text" },
      { key: "logo", label: "Logo", kind: "image", hint: "PNG or JPEG. Not WebP or SVG — Outlook and Gmail cannot show them." },
      { key: "logoWidth", label: "Logo width", kind: "number", min: 80, max: 320, unit: "px" },
      { key: "background", label: "Background", kind: "colour" },
    ],
  },

  heading: {
    label: "Heading",
    icon: "Heading",
    group: "Content",
    hint: "A headline. Click it on the canvas to type.",
    create: () => ({ type: "heading", html: "Your headline", align: "center", fontSize: 28, color: T.ink, paddingTop: 24, paddingBottom: 12 }),
    editable: "html",
    fields: [
      { key: "align", label: "Alignment", kind: "select", options: ["left", "center", "right"] },
      { key: "fontSize", label: "Size", kind: "number", min: 16, max: 48, unit: "px" },
      { key: "color", label: "Colour", kind: "colour" },
      { key: "paddingTop", label: "Space above", kind: "number", min: 0, max: 80, unit: "px" },
      { key: "paddingBottom", label: "Space below", kind: "number", min: 0, max: 80, unit: "px" },
    ],
  },

  text: {
    label: "Text",
    icon: "Type",
    group: "Content",
    hint: "A paragraph. Click it on the canvas to type.",
    create: () => ({ type: "text", html: "<p>Write something here.</p>", align: "left", fontSize: 15, color: T.text, paddingTop: 0, paddingBottom: 16 }),
    editable: "html",
    fields: [
      { key: "align", label: "Alignment", kind: "select", options: ["left", "center", "right"] },
      { key: "fontSize", label: "Size", kind: "number", min: 11, max: 24, unit: "px" },
      { key: "color", label: "Colour", kind: "colour" },
      { key: "paddingTop", label: "Space above", kind: "number", min: 0, max: 80, unit: "px" },
      { key: "paddingBottom", label: "Space below", kind: "number", min: 0, max: 80, unit: "px" },
    ],
  },

  list: {
    label: "List",
    icon: "List",
    group: "Content",
    hint: "Bulleted or numbered.",
    create: () => ({ type: "list", ordered: false, items: ["First point", "Second point"], fontSize: 15, color: T.text, paddingBottom: 16 }),
    fields: [
      { key: "ordered", label: "Numbered", kind: "toggle" },
      { key: "items", label: "Items", kind: "list" },
      { key: "fontSize", label: "Size", kind: "number", min: 11, max: 24, unit: "px" },
      { key: "color", label: "Colour", kind: "colour" },
      { key: "paddingBottom", label: "Space below", kind: "number", min: 0, max: 80, unit: "px" },
    ],
  },

  image: {
    label: "Image",
    icon: "Image",
    group: "Content",
    hint: "A picture, optionally linked.",
    create: () => ({ type: "image", src: "", alt: "", fullWidth: false, width: 536, align: "center", href: "", radius: 0, paddingTop: 8, paddingBottom: 8 }),
    fields: [
      { key: "src", label: "Image", kind: "image" },
      { key: "alt", label: "Alt text", kind: "text", hint: "Shown while the picture loads, and by anyone who blocks images." },
      { key: "fullWidth", label: "Full bleed", kind: "toggle", hint: "Edge to edge, no side padding." },
      { key: "width", label: "Width", kind: "number", min: 60, max: 600, unit: "px" },
      { key: "align", label: "Alignment", kind: "select", options: ["left", "center", "right"] },
      { key: "href", label: "Links to", kind: "url" },
      { key: "radius", label: "Corner radius", kind: "number", min: 0, max: 24, unit: "px" },
      { key: "paddingTop", label: "Space above", kind: "number", min: 0, max: 80, unit: "px" },
      { key: "paddingBottom", label: "Space below", kind: "number", min: 0, max: 80, unit: "px" },
    ],
  },

  button: {
    label: "Button",
    icon: "MousePointerClick",
    group: "Content",
    hint: "Built as a table so Outlook keeps it clickable.",
    create: () => ({ type: "button", label: "Shop now", url: "/shop", align: "center", background: T.ink, color: T.white, radius: 0, fullWidth: false, paddingTop: 12, paddingBottom: 20 }),
    fields: [
      { key: "label", label: "Label", kind: "text" },
      { key: "url", label: "Links to", kind: "url" },
      { key: "align", label: "Alignment", kind: "select", options: ["left", "center", "right"] },
      { key: "background", label: "Background", kind: "colour" },
      { key: "color", label: "Text colour", kind: "colour" },
      { key: "radius", label: "Corner radius", kind: "number", min: 0, max: 30, unit: "px" },
      { key: "fullWidth", label: "Full width", kind: "toggle" },
      { key: "paddingTop", label: "Space above", kind: "number", min: 0, max: 80, unit: "px" },
      { key: "paddingBottom", label: "Space below", kind: "number", min: 0, max: 80, unit: "px" },
    ],
  },

  video: {
    label: "Video",
    icon: "Play",
    group: "Content",
    hint: "No inbox plays video. This is a still that links out to it.",
    create: () => ({ type: "video", poster: "", url: "", label: "Watch the film", alt: "", radius: 0, paddingTop: 12, paddingBottom: 20 }),
    fields: [
      { key: "poster", label: "Still image", kind: "image" },
      { key: "url", label: "Video link", kind: "url" },
      { key: "label", label: "Button label", kind: "text" },
      { key: "alt", label: "Alt text", kind: "text" },
      { key: "paddingTop", label: "Space above", kind: "number", min: 0, max: 80, unit: "px" },
      { key: "paddingBottom", label: "Space below", kind: "number", min: 0, max: 80, unit: "px" },
    ],
  },

  columns: {
    label: "Columns",
    icon: "Columns3",
    group: "Layout",
    hint: "Side by side, with pixel widths so Outlook keeps them in a row.",
    create: () => ({
      type: "columns",
      gutter: 16,
      paddingTop: 8,
      paddingBottom: 16,
      columns: [
        { image: "", heading: "Heading", text: "A line about it.", href: "/shop", buttonLabel: "Shop now" },
        { image: "", heading: "Heading", text: "A line about it.", href: "/shop", buttonLabel: "Shop now" },
      ],
    }),
    fields: [
      { key: "columns", label: "Columns", kind: "columns" },
      { key: "gutter", label: "Gap", kind: "number", min: 0, max: 40, unit: "px" },
      { key: "paddingTop", label: "Space above", kind: "number", min: 0, max: 80, unit: "px" },
      { key: "paddingBottom", label: "Space below", kind: "number", min: 0, max: 80, unit: "px" },
    ],
  },

  product: {
    label: "Product",
    icon: "ShoppingBag",
    group: "Shop",
    hint: "Choose a product to fill this from your catalogue.",
    create: () => ({ type: "product", layout: "side", name: "", category: "", description: "", price: "", oldPrice: "", badge: "", image: "", url: "/shop", buttonLabel: "Shop now", paddingTop: 16, paddingBottom: 20 }),
    fields: [
      { key: "__product", label: "Product", kind: "product" },
      { key: "layout", label: "Layout", kind: "select", options: ["side", "stacked"] },
      { key: "name", label: "Name", kind: "text" },
      { key: "category", label: "Category", kind: "text" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "price", label: "Price", kind: "text" },
      { key: "oldPrice", label: "Was", kind: "text" },
      { key: "badge", label: "Badge", kind: "text" },
      { key: "image", label: "Picture", kind: "image" },
      { key: "url", label: "Links to", kind: "url" },
      { key: "buttonLabel", label: "Button label", kind: "text" },
    ],
  },

  coupon: {
    label: "Coupon",
    icon: "Ticket",
    group: "Shop",
    hint: "A discount code in a dashed panel.",
    create: () => ({ type: "coupon", heading: "Use this at checkout", code: "YOURCODE", description: "", buttonLabel: "Shop now", url: "/shop", expiry: "", background: T.cream, borderColor: T.gold, paddingTop: 12, paddingBottom: 20 }),
    fields: [
      { key: "heading", label: "Small heading", kind: "text" },
      { key: "code", label: "Code", kind: "text" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "buttonLabel", label: "Button label", kind: "text" },
      { key: "url", label: "Links to", kind: "url" },
      { key: "expiry", label: "Fine print", kind: "text" },
      { key: "background", label: "Background", kind: "colour" },
      { key: "borderColor", label: "Border", kind: "colour" },
    ],
  },

  social: {
    label: "Social links",
    icon: "Share2",
    group: "Layout",
    hint: "Text links — icon images get blocked more often than they load.",
    create: () => ({
      type: "social",
      color: T.muted,
      links: [
        { label: "Instagram", url: "https://instagram.com" },
        { label: "Facebook", url: "https://facebook.com" },
      ],
      paddingTop: 12,
      paddingBottom: 12,
    }),
    fields: [
      { key: "links", label: "Links", kind: "links" },
      { key: "color", label: "Colour", kind: "colour" },
    ],
  },

  divider: {
    label: "Divider",
    icon: "Minus",
    group: "Layout",
    hint: "A rule across the width.",
    create: () => ({ type: "divider", thickness: 1, color: T.border, paddingTop: 8, paddingBottom: 8 }),
    fields: [
      { key: "thickness", label: "Thickness", kind: "number", min: 1, max: 8, unit: "px" },
      { key: "color", label: "Colour", kind: "colour" },
      { key: "paddingTop", label: "Space above", kind: "number", min: 0, max: 80, unit: "px" },
      { key: "paddingBottom", label: "Space below", kind: "number", min: 0, max: 80, unit: "px" },
    ],
  },

  spacer: {
    label: "Spacer",
    icon: "MoveVertical",
    group: "Layout",
    hint: "Empty vertical space.",
    create: () => ({ type: "spacer", height: 24 }),
    fields: [{ key: "height", label: "Height", kind: "number", min: 4, max: 120, unit: "px" }],
  },

  footer: {
    label: "Footer",
    icon: "PanelBottom",
    group: "Layout",
    hint: "Carries the unsubscribe link. One is added automatically if you leave it out.",
    create: () => ({
      type: "footer",
      background: T.ink,
      companyName: "Irha's Wardrobe",
      address: "Lahore, Pakistan",
      contact: "info@irhaas.com · +92 321 4980835",
      note: "You are receiving this because you shopped with us or signed up for our news.",
    }),
    fields: [
      { key: "companyName", label: "Shop name", kind: "text" },
      { key: "address", label: "Address", kind: "text" },
      { key: "contact", label: "Contact", kind: "text" },
      { key: "note", label: "Small print", kind: "textarea" },
      { key: "background", label: "Background", kind: "colour" },
    ],
  },

  html: {
    label: "Custom HTML",
    icon: "Code",
    group: "Advanced",
    hint: "Written as-is. Use tables and inline styles, or it will break in Outlook.",
    create: () => ({ type: "html", html: "<p style=\"font-family:Helvetica,Arial,sans-serif;font-size:15px;\">Custom markup</p>", paddingTop: 0, paddingBottom: 0 }),
    fields: [
      { key: "html", label: "HTML", kind: "textarea", rows: 10, mono: true },
      { key: "paddingTop", label: "Space above", kind: "number", min: 0, max: 80, unit: "px" },
      { key: "paddingBottom", label: "Space below", kind: "number", min: 0, max: 80, unit: "px" },
    ],
  },
}

export const BLOCK_GROUPS = ["Content", "Shop", "Layout", "Advanced"]

export const blocksInGroup = (group) =>
  Object.entries(BLOCK_DEFS)
    .filter(([, def]) => def.group === group)
    .map(([type, def]) => ({ type, ...def }))

/** Merge fields, mirroring server/services/emailMergeFields.js. */
export const MERGE_FIELDS = [
  { token: "first_name", label: "First name" },
  { token: "name", label: "Full name" },
  { token: "email", label: "Email address" },
  { token: "shop_url", label: "Shop link" },
  { token: "unsubscribe_url", label: "Unsubscribe link" },
  { token: "year", label: "Current year" },
]

export const createBlock = (type) => {
  const def = BLOCK_DEFS[type]
  if (!def) return null
  // An id only the editor uses, for keys and drag targets. The renderer ignores it.
  return { ...def.create(), _id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }
}

export default BLOCK_DEFS
