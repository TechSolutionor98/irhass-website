"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router-dom"

import config from "../config/config"
import { getFullImageUrl } from "../utils/imageUtils"
import { DEFAULT_THEME } from "../theme/themeDefaults"
import {
  applyCssVars,
  applyCustomCss,
  applyFavicon,
  clearCssVars,
  isThemedPath,
  resolveTheme,
  themeToCssVars,
} from "../theme/applyTheme"

/**
 * Site theme.
 *
 * Reads the admin's saved appearance settings once per session and writes them
 * to <html> as CSS custom properties, re-resolving on every navigation so a
 * per-page colour rule takes effect the moment you land on that page.
 *
 * Two deliberate limits:
 *  - Storefront only. On /admin and /superadmin the variables are removed and
 *    the stylesheet defaults take over, so the staff UI cannot be broken by a
 *    colour choice.
 *  - Never blocks rendering. The last known theme is replayed from
 *    localStorage before the network call, and a failed call leaves the shipped
 *    defaults in place rather than an unstyled page.
 */

const CACHE_KEY = "grabatoz-theme-v1"
// The same palette as ready-made CSS text, read by the pre-paint script in
// index.html so the first frame is already themed.
const CSS_CACHE_KEY = "grabatoz-theme-css-v1"
// Long enough that the theme is not re-fetched on every route change, short
// enough that an admin's change shows up for existing visitors the same day.
const CACHE_TTL_MS = 30 * 60 * 1000

const ThemeContext = createContext(null)

const readCache = () => {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || !parsed.theme) return null
    return parsed
  } catch {
    return null
  }
}

const writeCache = (theme) => {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ theme, savedAt: Date.now() }))

    // Cache the global palette (no page rule -- the pre-paint script cannot
    // resolve one) as flat CSS declarations.
    const vars = themeToCssVars(resolveTheme({ ...theme, pages: [] }, "/"))
    const css = Object.entries(vars)
      .map(([name, value]) => `${name}:${value}`)
      .join(";")
    window.localStorage.setItem(CSS_CACHE_KEY, css)
  } catch {
    // Private browsing or a full quota. The theme still works this session.
  }
}

export const ThemeProvider = ({ children }) => {
  const location = useLocation()

  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_THEME
    return readCache()?.theme || DEFAULT_THEME
  })
  const [loading, setLoading] = useState(true)
  const fetchedAt = useRef(0)

  const fetchTheme = async ({ force = false } = {}) => {
    const cached = typeof window !== "undefined" ? readCache() : null
    const fresh = cached && Date.now() - cached.savedAt < CACHE_TTL_MS

    if (!force && fresh && fetchedAt.current) {
      setLoading(false)
      return cached.theme
    }

    try {
      const response = await fetch(`${config.API_URL}/api/theme`, {
        headers: { Accept: "application/json" },
      })
      if (!response.ok) throw new Error(`Theme request failed (${response.status})`)

      const data = await response.json()
      fetchedAt.current = Date.now()
      setTheme(data)
      writeCache(data)
      return data
    } catch (error) {
      // A missing or unreachable theme is not a failure the shopper should see:
      // the cached theme, or failing that the shipped defaults, still render a
      // complete site.
      console.warn("Theme could not be loaded, using cached/default palette:", error.message)
      return cached?.theme || DEFAULT_THEME
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTheme()
    // Intentionally once per session; refresh() is the way to force a re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const themed = isThemedPath(location.pathname)

  const resolved = useMemo(
    () => resolveTheme(theme, location.pathname),
    [theme, location.pathname],
  )

  // Logos may be an uploaded /uploads/... path, a Cloudinary URL, or one of the
  // static files in public/. getFullImageUrl sorts all three out, so consumers
  // can drop the value straight into a src attribute.
  const logos = useMemo(() => {
    const raw = resolved.logos || {}
    return {
      ...raw,
      headerDesktop: getFullImageUrl(raw.headerDesktop),
      headerMobile: getFullImageUrl(raw.headerMobile),
      footer: getFullImageUrl(raw.footer),
      favicon: getFullImageUrl(raw.favicon),
    }
  }, [resolved.logos])

  useEffect(() => {
    if (typeof document === "undefined") return

    if (!themed) {
      // Admin routes run on the stylesheet defaults, full stop.
      clearCssVars()
      applyCustomCss("")
      return
    }

    applyCssVars(themeToCssVars(resolved))
    applyCustomCss(resolved.customCss)
    applyFavicon(logos.favicon)

    // The pre-paint block has done its job; drop it so it can never outlive a
    // reset-to-defaults.
    document.getElementById("grabatoz-theme-preload")?.remove()
  }, [resolved, logos, themed])

  const value = useMemo(
    () => ({
      theme,
      // The palette in force for the page you are on right now, page override included.
      resolved,
      logos,
      loading,
      isThemed: themed,
      refresh: () => fetchTheme({ force: true }),
    }),
    [theme, resolved, logos, loading, themed],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Theme access for storefront components.
 *
 * Safe outside the provider (the admin panel, a test harness): it returns the
 * shipped defaults rather than throwing, so a shared component can be rendered
 * in either place.
 */
export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context) return context

  return {
    theme: DEFAULT_THEME,
    resolved: resolveTheme(DEFAULT_THEME, "/"),
    logos: DEFAULT_THEME.logos,
    loading: false,
    isThemed: false,
    refresh: () => {},
  }
}

export default ThemeContext
