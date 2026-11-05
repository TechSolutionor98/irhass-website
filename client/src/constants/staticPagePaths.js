export const STATIC_PAGE_PATHS = [
  { pageKey: "about", routePath: "/about" },
  { pageKey: "refund-return", routePath: "/refund-return" },
  { pageKey: "cookies-policy", routePath: "/cookies-policy" },
  { pageKey: "terms-conditions", routePath: "/terms-conditions" },
  { pageKey: "privacy-policy", routePath: "/privacy-policy" },
  { pageKey: "disclaimer-policy", routePath: "/disclaimer-policy" },
  { pageKey: "track-order", routePath: "/track-order" },
  { pageKey: "voucher-terms", routePath: "/voucher-terms" },
  { pageKey: "delivery-terms", routePath: "/delivery-terms" },
]

const PATH_LOOKUP = new Map(STATIC_PAGE_PATHS.map((page) => [page.routePath, page]))

export const normalizeStaticPagePath = (inputPath) => {
  let rawPath = typeof inputPath === "string" ? inputPath.trim() : ""

  if (!rawPath) return "/"

  rawPath = rawPath.split("?")[0].split("#")[0]
  rawPath = rawPath.replace(/\\+/g, "/").replace(/\/+/g, "/")

  if (!rawPath.startsWith("/")) {
    rawPath = `/${rawPath}`
  }

  rawPath = rawPath.replace(/^\/ae-(?:en|ar)(?=\/|$)/i, "")

  if (!rawPath) return "/"
  if (rawPath !== "/" && rawPath.endsWith("/")) {
    rawPath = rawPath.slice(0, -1)
  }

  return rawPath || "/"
}

export const resolveStaticPageByPath = (inputPath) => {
  const normalizedPath = normalizeStaticPagePath(inputPath)
  return PATH_LOOKUP.get(normalizedPath) || null
}

export const normalizeTranslationLookupKey = (value) =>
  String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
