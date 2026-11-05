import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import config from "../config/config"
import { useLanguage } from "../context/LanguageContext"
import {
  normalizeStaticPagePath,
  normalizeTranslationLookupKey,
  resolveStaticPageByPath,
} from "../constants/staticPagePaths"
import { populateTranslationCache } from "../LanguageModel/translationService"

const StaticPageTranslationLoader = () => {
  const location = useLocation()
  const {
    isArabic,
    setStaticPageTranslations,
    clearStaticPageTranslations,
  } = useLanguage()

  useEffect(() => {
    let cancelled = false

    const loadTranslations = async () => {
      const staticPage = resolveStaticPageByPath(location.pathname)

      if (!isArabic || !staticPage) {
        clearStaticPageTranslations()
        return
      }

      try {
        const normalizedPath = normalizeStaticPagePath(location.pathname)
        const response = await fetch(
          `${config.API_URL}/api/static-page-translations/by-path?path=${encodeURIComponent(normalizedPath)}`,
        )

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = await response.json()
        const rows = Array.isArray(payload?.translations) ? payload.translations : []

        const nextMap = {}
        rows.forEach((row) => {
          const sourceText = typeof row?.sourceText === "string" ? row.sourceText : ""
          const translatedText = typeof row?.translatedText === "string" ? row.translatedText : ""

          if (!sourceText || !translatedText) return

          const normalizedSource = normalizeTranslationLookupKey(sourceText)
          nextMap[sourceText] = translatedText
          if (normalizedSource) {
            nextMap[normalizedSource] = translatedText
          }

          // Warm shared translation cache so TranslatedText resolves instantly.
          populateTranslationCache(sourceText, translatedText, "en-ar")
        })

        if (!cancelled) {
          setStaticPageTranslations({
            pageKey: staticPage.pageKey,
            routePath: normalizedPath,
            map: nextMap,
          })
        }
      } catch (error) {
        console.error("Static page translation load failed:", error)
        if (!cancelled) {
          clearStaticPageTranslations()
        }
      }
    }

    loadTranslations()

    return () => {
      cancelled = true
    }
  }, [
    clearStaticPageTranslations,
    isArabic,
    location.pathname,
    setStaticPageTranslations,
  ])

  return null
}

export default StaticPageTranslationLoader
