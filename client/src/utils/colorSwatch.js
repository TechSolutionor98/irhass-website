/**
 * Turns a colour *name* into something paintable.
 *
 * Colours reach us as free text typed by whoever added the product -- "Dusty Rose",
 * "Midnight / Silver", "#c0392b" -- so there is no field to read a hex out of. This
 * resolves the common wardrobe vocabulary and degrades to a neutral chip rather than
 * guessing wildly, because a wrong swatch is worse than a plain one.
 */

const NAMED = {
  // Neutrals
  white: "#ffffff",
  "off-white": "#f3f1ec",
  offwhite: "#f3f1ec",
  ivory: "#f6f2e7",
  cream: "#f5efe2",
  pearl: "#f1ece4",
  oatmeal: "#ddd3c0",
  beige: "#e3d7c3",
  sand: "#ddcdb0",
  stone: "#d7cfc4",
  nude: "#e3c2ad",
  taupe: "#a79c8e",
  khaki: "#b5a26a",
  camel: "#c19a6b",
  tan: "#c08a5a",
  mocha: "#7b5a46",
  chocolate: "#4e3425",
  brown: "#6b4a33",
  grey: "#9a9a9a",
  gray: "#9a9a9a",
  silver: "#c7cbd1",
  slate: "#5a6472",
  graphite: "#4a4a4d",
  charcoal: "#3a3a3c",
  black: "#121212",
  noir: "#121212",
  ink: "#1b1f2a",
  midnight: "#15192b",

  // Reds / pinks
  red: "#c0392b",
  crimson: "#9f1f32",
  maroon: "#6b1f2a",
  wine: "#6b2234",
  burgundy: "#6e2639",
  garnet: "#7a1f2b",
  rust: "#9c4a24",
  terracotta: "#b2603f",
  coral: "#ff7f5e",
  peach: "#f4c0a0",
  blush: "#f0d2cc",
  pink: "#f2c0c9",
  "dusty rose": "#c9969a",
  rose: "#d98a9a",
  "rose gold": "#b76e79",
  fuchsia: "#c1437f",
  magenta: "#b5296d",
  plum: "#5e2750",
  purple: "#6b4a8a",
  lilac: "#c3b1d9",
  lavender: "#cdc2e0",

  // Greens / blues
  green: "#3f7d4f",
  emerald: "#0f7a53",
  forest: "#1f4a32",
  olive: "#6b6b3a",
  sage: "#9caf88",
  meadow: "#7a9a4e",
  mint: "#b6dcc6",
  teal: "#2a7d7d",
  "deep teal": "#0f4c4c",
  turquoise: "#3aa8a8",
  aqua: "#86c6c6",
  sky: "#8fb8de",
  blue: "#2f5d9e",
  denim: "#4a6b94",
  navy: "#1f2a52",
  indigo: "#39477f",

  // Warm metals / yellows
  yellow: "#e0b93b",
  mustard: "#c89f2c",
  gold: "#c9a227",
  champagne: "#f1e1c6",
  bronze: "#9c6b3f",
  copper: "#a9643c",
  orange: "#d1762f",
}

// Words that describe a pattern rather than a colour. "Coral Print" is coral; the
// print part gets its own visual cue instead of being resolved as a colour.
const PATTERN_WORDS = ["print", "printed", "stripe", "striped", "floral", "check", "checked", "plaid", "multi"]

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

const normalise = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ")

const resolveOne = (raw) => {
  const name = normalise(raw)
  if (!name) return null
  if (HEX.test(name)) return name

  if (NAMED[name]) return NAMED[name]

  // Drop pattern words and retry: "noir print" -> "noir".
  const words = name.split(" ").filter((w) => !PATTERN_WORDS.includes(w))
  const stripped = words.join(" ")
  if (stripped && NAMED[stripped]) return NAMED[stripped]

  // Last try: any single word we recognise, so "light sage marl" still finds sage.
  for (const word of words) {
    if (NAMED[word]) return NAMED[word]
  }
  return null
}

/**
 * @returns {{ colors: string[], isPattern: boolean, resolved: boolean }}
 *   `colors` always has at least one entry so the caller can paint unconditionally.
 */
export const resolveSwatch = (name) => {
  const text = normalise(name)
  const isPattern = PATTERN_WORDS.some((w) => text.split(/[^a-z-]+/).includes(w))

  // "Midnight / Silver" and "Black & Ivory" are two-tone pieces.
  const parts = text.split(/\s*[/&+]\s*|\s+and\s+/).filter(Boolean)
  const colors = parts.map(resolveOne).filter(Boolean)

  if (colors.length > 0) return { colors, isPattern, resolved: true }
  // Nothing matched -- a neutral chip, with the name still shown in the label.
  return { colors: ["#d7d3cd"], isPattern, resolved: false }
}

/**
 * CSS `background` for a swatch: a flat fill for one colour, a hard-edged split for
 * two, and barber stripes for an unresolved pattern.
 */
export const swatchBackground = (name) => {
  const { colors, isPattern, resolved } = resolveSwatch(name)

  if (isPattern && !resolved) {
    return "repeating-linear-gradient(45deg, #d7d3cd 0 5px, #f3f1ec 5px 10px)"
  }
  if (colors.length === 1) {
    return isPattern
      ? `repeating-linear-gradient(45deg, ${colors[0]} 0 5px, rgba(255,255,255,0.45) 5px 10px)`
      : colors[0]
  }
  const stops = colors
    .map((c, i) => `${c} ${(i / colors.length) * 100}% ${((i + 1) / colors.length) * 100}%`)
    .join(", ")
  return `linear-gradient(135deg, ${stops})`
}
