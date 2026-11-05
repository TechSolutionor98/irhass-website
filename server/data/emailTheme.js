/**
 * The storefront palette, as literal hex.
 *
 * The site defines its colours as CSS custom properties and lets Tailwind resolve
 * them. Neither survives an inbox: Gmail strips <style>, and no mail client has ever
 * supported var(). So the brand is restated here as plain hex values, which is the
 * only form that works everywhere.
 *
 * These mirror src/index.css. If the ramp there changes, change it here too -- there
 * is no way to make one follow the other across the gap between a web page and an email.
 */
export const EMAIL_THEME = {
  // Irha's Wardrobe gold, brand-500 / 600 / 700
  gold: "#b4874a",
  goldDark: "#8e6937",
  goldDeep: "#684e2c",

  // brand-50 / brand-100 -- the warm paper tones behind panels and the page itself
  cream: "#faf6f0",
  sand: "#f2e9dc",

  // footer-bg: the near-black the site uses for its masthead and footer
  ink: "#181816",

  white: "#ffffff",
  text: "#44403c",
  muted: "#78716c",
  border: "#e7e5e4",

  // Email-safe stacks only. A webfont is ignored by Outlook and stripped by Gmail,
  // so the fallback is what most people actually see -- it has to be the real choice.
  fontBody: "Helvetica, Arial, sans-serif",
  fontHeading: "Georgia, 'Times New Roman', serif",

  contentWidth: 600,
}

export default EMAIL_THEME
