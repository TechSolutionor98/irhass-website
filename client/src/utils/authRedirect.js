/**
 * Remembers where a shopper was before they went off to sign in, so login,
 * registration and email verification can put them back instead of dropping
 * them on the country selector at "/".
 *
 * A stored value is used rather than router state alone because the sign-in
 * links in the navbar are plain <Link>s with no state, and because the language
 * prefix rewrite replaces the entry in the history stack.
 */

const STORAGE_KEY = "auth-return-path"

// Paths that must never be treated as "where the shopper was".
// Sending someone back to /login after logging in would just loop.
const AUTH_PATH_SEGMENTS = [
  "login",
  "register",
  "verify-email",
  "forgot-password",
  "reset-password",
  "guest",
  "select-country",
]

const stripLangPrefix = (pathname = "") => String(pathname).replace(/^\/[a-z]{2}-(en|ar)(?=\/|$)/i, "")

/**
 * True for sign-in style routes and for the country selector at the root.
 * @param {string} pathname
 */
export const isAuthPath = (pathname = "") => {
  const path = stripLangPrefix(pathname)

  // "/" and a bare "/xx-en" both render the country selector.
  if (path === "" || path === "/") return true

  const firstSegment = path.split("/").filter(Boolean)[0] || ""
  return AUTH_PATH_SEGMENTS.includes(firstSegment.toLowerCase())
}

/**
 * Record a page worth coming back to. Auth pages and admin routes are ignored.
 * @param {string} pathname
 * @param {string} search
 */
export const rememberReturnPath = (pathname = "", search = "") => {
  try {
    if (!pathname) return
    if (pathname.startsWith("/admin") || pathname.startsWith("/superadmin")) return
    if (pathname.startsWith("/irhaasadmin") || pathname.startsWith("/irhaassuperadmin")) return
    if (isAuthPath(pathname)) return

    sessionStorage.setItem(STORAGE_KEY, `${pathname}${search || ""}`)
  } catch {
    // Private browsing or blocked storage - returning home is an acceptable fallback.
  }
}

/**
 * The remembered page, or "" when there is nothing safe to go back to.
 * @returns {string}
 */
export const getReturnPath = () => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY) || ""
    if (!stored) return ""

    const [pathname] = stored.split("?")
    return isAuthPath(pathname) ? "" : stored
  } catch {
    return ""
  }
}

export const clearReturnPath = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/**
 * Where to send a shopper once they are signed in.
 *
 * Order of preference: the route that bounced them to the login page, then the
 * last page they were browsing, then the localized home page. Never "/", which
 * renders the country selector.
 *
 * @param {object} locationState value of useLocation().state
 * @param {(path: string) => string} getLocalizedPath from useLanguage()
 * @returns {string}
 */
export const resolvePostAuthPath = (locationState, getLocalizedPath) => {
  const home = getLocalizedPath("/")

  const from = locationState?.from
  const fromPath = typeof from === "string" ? from : from?.pathname
  if (fromPath && !isAuthPath(fromPath)) {
    const fromSearch = typeof from === "string" ? "" : from?.search || ""
    return `${fromPath}${fromSearch}`
  }

  return getReturnPath() || home
}
