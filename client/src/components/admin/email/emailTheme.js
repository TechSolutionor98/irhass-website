/**
 * The storefront palette as literal hex, mirroring server/data/emailTheme.js.
 *
 * The canvas has to draw blocks in the colours the email will actually use, and the
 * email cannot use CSS custom properties -- no mail client resolves var(). So the
 * values are restated here rather than read from Tailwind.
 *
 * If the ramp in src/index.css changes, both copies change.
 */
export const EMAIL_THEME = {
  gold: "#b4874a",
  goldDark: "#8e6937",
  goldDeep: "#684e2c",
  cream: "#faf6f0",
  sand: "#f2e9dc",
  ink: "#181816",
  white: "#ffffff",
  text: "#44403c",
  muted: "#78716c",
  border: "#e7e5e4",
  fontBody: "Helvetica, Arial, sans-serif",
  fontHeading: "Georgia, 'Times New Roman', serif",
  contentWidth: 600,
}

/** Offered in every colour picker, so a design stays recognisably the shop's. */
export const BRAND_SWATCHES = [
  { label: "Ink", value: EMAIL_THEME.ink },
  { label: "Gold", value: EMAIL_THEME.gold },
  { label: "Gold dark", value: EMAIL_THEME.goldDark },
  { label: "Body text", value: EMAIL_THEME.text },
  { label: "Muted", value: EMAIL_THEME.muted },
  { label: "Cream", value: EMAIL_THEME.cream },
  { label: "Sand", value: EMAIL_THEME.sand },
  { label: "White", value: EMAIL_THEME.white },
]

export default EMAIL_THEME
