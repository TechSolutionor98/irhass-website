import { useEffect, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import axios from "axios"
import SEO from "./SEO"
import config from "../config/config"

const DYNAMIC_PATH_PATTERNS = [/^\/product\//i, /^\/offers\//i, /^\/blogs\/.+/i, /^\/shop(\/|$)/i, /^\/product-category(\/|$)/i]

// Storefront URLs carry no country/language prefix, so the country comes from
// localStorage. Legacy links (/ae-en, /sa-ar) can still arrive before LanguageContext
// rewrites them, so the prefix is stripped here too and the country read from it.
const COUNTRY_LANG_PREFIX = /^\/([a-z]{2})-(en|ar)(?=\/|$)/i

const normalizePath = (pathname = "") => {
  const withSlash = String(pathname || "").startsWith("/") ? String(pathname || "") : `/${pathname || ""}`
  const strippedLang = withSlash.replace(COUNTRY_LANG_PREFIX, "") || "/"
  const noTrailing = strippedLang.length > 1 ? strippedLang.replace(/\/+$/, "") : strippedLang
  return noTrailing || "/"
}

const countryFromPath = (pathname = "") => {
  const withSlash = String(pathname || "").startsWith("/") ? String(pathname || "") : `/${pathname || ""}`
  const match = withSlash.match(COUNTRY_LANG_PREFIX)
  if (match) return match[1].toUpperCase()
  try {
    return localStorage.getItem("selected-country-code") || ""
  } catch {
    return ""
  }
}

const isDynamicPath = (path) => DYNAMIC_PATH_PATTERNS.some((pattern) => pattern.test(path))

export default function StaticRouteSEO() {
  const location = useLocation()
  const [seoData, setSeoData] = useState(null)

  const normalizedPath = useMemo(() => normalizePath(location.pathname), [location.pathname])
  const countryCode = useMemo(() => countryFromPath(location.pathname), [location.pathname])

  useEffect(() => {
    let mounted = true

    if (isDynamicPath(normalizedPath)) {
      setSeoData(null)
      return () => {
        mounted = false
      }
    }

    const fetchSeo = async () => {
      try {
        const response = await axios.get(`${config.API_URL}/api/seo-pages/public-by-path`, {
          params: { path: normalizedPath, country: countryCode || undefined },
        })

        if (!mounted) return

        if (response.data?.found) {
          setSeoData(response.data.seo)
        } else {
          setSeoData(null)
        }
      } catch (error) {
        if (mounted) {
          setSeoData(null)
        }
      }
    }

    fetchSeo()

    return () => {
      mounted = false
    }
  }, [normalizedPath, countryCode])

  if (!seoData) return null

  return (
    <SEO
      title={seoData.title || undefined}
      description={seoData.description || undefined}
      keywords={seoData.keywords || undefined}
      canonicalPath={seoData.canonicalUrl || normalizedPath}
      robots={seoData.robots || undefined}
      ogTitle={seoData.ogTitle || undefined}
      ogDescription={seoData.ogDescription || undefined}
      ogImage={seoData.ogImage || undefined}
      customSchema={seoData.customSchema || undefined}
    />
  )
}
