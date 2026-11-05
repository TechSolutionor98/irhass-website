import { BRAND_STEPS, DEFAULT_BRAND_SCALE, hexToTriplet } from "./palette"
import { CSS_VAR_MAP, DEFAULT_THEME } from "./themeDefaults"

/**
 * Turns a saved theme into CSS custom properties and puts them on <html>.
 *
 * Nothing here touches the admin panel: `isThemedPath` keeps /admin and
 * /superadmin on the shipped defaults, so a low-contrast colour picked by
 * mistake can never make the staff UI unreadable.
 */

/** Routes the storefront theme must never be applied to. */
const UNTHEMED_PATH = /^\/(admin|superadmin|irhaasadmin|irhaassuperadmin)(\/|$)/i

/** Country/language prefix: /ae-en, /sa-ar, ... */
const LOCALE_PREFIX = /^\/[a-z]{2}-[a-z]{2}(?=\/|$)/i

export const isThemedPath = (pathname) => !UNTHEMED_PATH.test(String(pathname || "").toLowerCase())

/**
 * Drop the country/language prefix so one page rule covers every locale:
 * "/ae-en/shop/laptops" -> "/shop/laptops", "/sa-ar" -> "/".
 */
export const stripLocale = (pathname) => {
  let path = String(pathname || "/").replace(LOCALE_PREFIX, "")
  if (!path.startsWith("/")) path = `/${path}`
  // Trailing slash is noise everywhere except the root itself.
  if (path.length > 1) path = path.replace(/\/+$/, "")
  return path || "/"
}

const escapeRegex = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")

// Placeholder that parks "**" while single "*" is expanded, so the two do not
// interfere. Any character that cannot appear in a URL path would do.
const DOUBLE_STAR = ""

/**
 * "/shop/**" -> /^\/shop\/.*$/  ("*" stays inside one segment, "**" crosses them)
 */
const patternToRegex = (pattern) => {
  const source = escapeRegex(pattern.trim())
    .split("**")
    .join(DOUBLE_STAR)
    .split("*")
    .join("[^/]*")
    .split(DOUBLE_STAR)
    .join(".*")
  return new RegExp(`^${source}$`, "i")
}

/** Does `pathname` match this rule? Patterns are comma-separated; any one hit wins. */
export const matchesPattern = (pattern, pathname) => {
  if (!pattern) return false
  const path = stripLocale(pathname)

  return String(pattern)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .some((p) => {
      const normalised = p.startsWith("/") ? p : `/${p}`
      const cleaned = normalised.length > 1 ? normalised.replace(/\/+$/, "") : normalised
      try {
        return patternToRegex(cleaned).test(path)
      } catch {
        return false
      }
    })
}

/** The first enabled page rule matching this path, or null. */
export const findPageOverride = (theme, pathname) => {
  const pages = Array.isArray(theme?.pages) ? theme.pages : []
  return pages.find((page) => page?.enabled && matchesPattern(page.pattern, pathname)) || null
}

const mergeSection = (base, override) => {
  if (!override) return base
  const merged = { ...base }
  Object.keys(override).forEach((key) => {
    const value = override[key]
    if (typeof value === "string" && value.trim()) merged[key] = value.trim()
    else if (typeof value === "number") merged[key] = value
  })
  return merged
}

/**
 * Layer one page rule onto a theme, section by section.
 *
 * Sections the rule does not switch on fall straight through to the site-wide
 * values. Exported so the admin preview can show exactly what a page will look
 * like using the same merge the live site runs -- one implementation, so the
 * preview can never drift from reality.
 */
export const applyPageOverride = (base, page) => ({
  brandScale: mergeSection(
    { ...DEFAULT_BRAND_SCALE, ...(base.brandScale || {}) },
    page?.overrideBrand ? page.brandScale : null,
  ),
  logos: mergeSection(
    { ...DEFAULT_THEME.logos, ...(base.logos || {}) },
    page?.overrideLogos ? page.logos : null,
  ),
  header: mergeSection(
    { ...DEFAULT_THEME.header, ...(base.header || {}) },
    page?.overrideHeader ? page.header : null,
  ),
  navbar: mergeSection(
    { ...DEFAULT_THEME.navbar, ...(base.navbar || {}) },
    page?.overrideNavbar ? page.navbar : null,
  ),
  footer: mergeSection(
    { ...DEFAULT_THEME.footer, ...(base.footer || {}) },
    page?.overrideFooter ? page.footer : null,
  ),
  buttons: mergeSection(
    { ...DEFAULT_THEME.buttons, ...(base.buttons || {}) },
    page?.overrideButtons ? page.buttons : null,
  ),
  page: mergeSection(
    { ...DEFAULT_THEME.page, ...(base.page || {}) },
    page?.overridePage ? page.page : null,
  ),
})

/**
 * The theme actually in force for one path: the site-wide theme with any
 * enabled page rule layered on top.
 */
export const resolveTheme = (theme, pathname) => {
  const base = theme && theme.enabled !== false ? theme : DEFAULT_THEME
  const page = findPageOverride(base, pathname)

  return {
    ...applyPageOverride(base, page),
    customCss: typeof base.customCss === "string" ? base.customCss : "",
    matchedPage: page ? page.key : null,
  }
}

/** A resolved theme as a flat { "--var": "r g b" } map. */
export const themeToCssVars = (resolved) => {
  const vars = {}

  BRAND_STEPS.forEach((step) => {
    const triplet = hexToTriplet(resolved.brandScale?.[step])
    if (triplet) vars[`--brand-${step}`] = triplet
  })

  Object.entries(CSS_VAR_MAP).forEach(([section, fields]) => {
    Object.entries(fields).forEach(([field, varName]) => {
      const triplet = hexToTriplet(resolved[section]?.[field])
      if (triplet) vars[varName] = triplet
    })
  })

  return vars
}

const STYLE_ELEMENT_ID = "grabatoz-theme-vars"

/** Write the variables onto <html>, replacing whatever was there before. */
export const applyCssVars = (vars, root = typeof document !== "undefined" ? document.documentElement : null) => {
  if (!root) return
  const applied = root.dataset.themeVars ? root.dataset.themeVars.split(",") : []

  // Clear anything from the previous theme that this one does not set, so a
  // page rule that is switched off really does fall back to the global colours.
  applied.forEach((name) => {
    if (!(name in vars)) root.style.removeProperty(name)
  })

  Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value))
  root.dataset.themeVars = Object.keys(vars).join(",")
}

/** Drop every runtime variable, returning the page to the stylesheet defaults. */
export const clearCssVars = (root = typeof document !== "undefined" ? document.documentElement : null) => {
  if (!root || !root.dataset.themeVars) return
  root.dataset.themeVars.split(",").forEach((name) => root.style.removeProperty(name))
  delete root.dataset.themeVars
}

/** Keep the admin's free-form CSS in a single <style> tag at the end of <head>. */
export const applyCustomCss = (css) => {
  if (typeof document === "undefined") return
  let el = document.getElementById(STYLE_ELEMENT_ID)

  if (!css || !css.trim()) {
    if (el) el.remove()
    return
  }

  if (!el) {
    el = document.createElement("style")
    el.id = STYLE_ELEMENT_ID
    document.head.appendChild(el)
  }

  if (el.textContent !== css) el.textContent = css
}

/** Point the browser tab icon at the themed favicon. */
export const applyFavicon = (href) => {
  if (typeof document === "undefined" || !href) return
  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    document.head.appendChild(link)
  }
  if (link.getAttribute("href") !== href) link.setAttribute("href", href)
}
