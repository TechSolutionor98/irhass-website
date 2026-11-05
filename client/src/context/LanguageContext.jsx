"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { 
  translateToArabic, 
  translateToEnglish, 
  getCachedTranslation,
  preloadTranslations,
  warmup,
  populateTranslationCache
} from "../LanguageModel/translationService"
import { uiDictionary } from "../LanguageModel/uiDictionary"
import { normalizeTranslationLookupKey } from "../constants/staticPagePaths"

// Supported languages
export const LANGUAGES = {
  EN: {
    code: "en",
    name: "English",
    nativeName: "English",
    dir: "ltr",
  },
  AR: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    dir: "rtl",
  },
}

// Default language
const DEFAULT_LANGUAGE = LANGUAGES.EN

// Create context
const LanguageContext = createContext(null)

// Language provider component
export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    // Check localStorage first for persisted language preference
    const savedLang = localStorage.getItem("preferred-language")
    if (savedLang === "ar") {
      return LANGUAGES.AR
    }
    return DEFAULT_LANGUAGE
  })
  const [isLoading, setIsLoading] = useState(false)
  const [staticPageTranslationState, setStaticPageTranslationState] = useState({
    pageKey: null,
    routePath: "",
    map: {},
  })
  const location = useLocation()
  const navigate = useNavigate()

  // URLs carry no country/language prefix any more. Legacy links still arrive with one
  // (/ae-en/shop, /sa-ar/cart, and anything already indexed by search engines), so adopt
  // the country and language they name, then rewrite the URL to the bare path.
  useEffect(() => {
    const path = location.pathname
    const search = location.search || ""
    const hash = location.hash || ""

    if (
      path.startsWith("/admin") ||
      path.startsWith("/irhaasadmin") ||
      path.startsWith("/superadmin") ||
      path.startsWith("/irhaassuperadmin")
    ) {
      return
    }

    const match = path.match(/^\/([a-z]{2})-(en|ar)(\/|$)/i)
    if (!match) return

    const countryCode = match[1].toUpperCase()
    const langCode = match[2].toLowerCase()

    const currentStoredCountry = localStorage.getItem("selected-country-code")
    if (currentStoredCountry !== countryCode) {
      localStorage.setItem("selected-country-code", countryCode)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("country-changed", { detail: countryCode }))
      }
    }

    setCurrentLanguage(langCode === "ar" ? LANGUAGES.AR : LANGUAGES.EN)
    localStorage.setItem("preferred-language", langCode)

    // Strip the prefix. `replace` keeps the prefixed URL out of the back history, and the
    // router state is carried over because the login page reads it for "where did you
    // come from".
    const stripped = path.replace(/^\/[a-z]{2}-(en|ar)/i, "") || "/"
    navigate(`${stripped}${search}${hash}`, { replace: true, state: location.state })
  }, [location.pathname, location.search, location.hash, location.state, navigate])

  // Apply direction and lang attributes whenever language changes
  useEffect(() => {
    localStorage.setItem("preferred-language", currentLanguage.code)
    document.documentElement.setAttribute("dir", currentLanguage.dir)
    document.documentElement.setAttribute("lang", currentLanguage.code)
    document.body.setAttribute("dir", currentLanguage.dir)

    // Also apply direction to main content containers
    const mainContent = document.getElementById("root")
    if (mainContent) {
      mainContent.setAttribute("dir", currentLanguage.dir)
    }
  }, [currentLanguage])

  // Optimize performance: Pre-fill translation cache with UI dictionary
  // and warmup the translation model in the background
  useEffect(() => {
    const initializeLanguageLogic = async () => {
      // 1. Immediately populate cache with UI Dictionary (Priority 1)
      // This happens instantly and ensures common UI elements switch instantly
      Object.entries(uiDictionary).forEach(([text, translation]) => {
        populateTranslationCache(text, translation, 'en-ar');
      });
      
      // 2. Background warmup for the local translation model (Priority 2)
      // We don't wait for this to finish, but it makes first dynamic translation faster
      // and warms up the server-side model if needed
      if (currentLanguage.code === 'ar') {
        // Only warmup if we are currently in Arabic or might switch to it
        // We defer this slightly to not block initial page interactivity
        setTimeout(() => {
          warmup().catch(err => console.debug("Model warmup ignored (likely already running or unavailable)"));
        }, 2000);
      }
    };

    initializeLanguageLogic();
  }, [currentLanguage.code])

  // Get the path without language prefix (supports /ae-en, /sa-en, /qa-ar, /om-en, etc.)
  const getPathWithoutLangPrefix = useCallback((path) => {
    const prefixMatch = path.match(/^\/([a-z]{2}-(en|ar))(\/|$)/i)
    if (prefixMatch) {
      const fullPrefix = prefixMatch[1]
      const clean = path.replace(new RegExp(`^\\/${fullPrefix}`), "")
      return clean || "/"
    }
    return path
  }, [])

  // Kept as the single place links are built, but it no longer adds a prefix -- it just
  // normalises and strips any legacy one. 40-odd components call this, so leaving it in
  // place is what let the prefix go away without touching every link in the app.
  const getLocalizedPath = useCallback((path) => {
    const cleanPath = getPathWithoutLangPrefix(path)
    if (!cleanPath || cleanPath === "/") return "/"
    return cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`
  }, [getPathWithoutLangPrefix])

  // Language is a stored preference now, not part of the URL, so switching it re-renders
  // in place instead of navigating. The effect above still honours a legacy /xx-ar link.
  const switchLanguage = useCallback((langCode) => {
    setCurrentLanguage(langCode === "ar" ? LANGUAGES.AR : LANGUAGES.EN)
    localStorage.setItem("preferred-language", langCode === "ar" ? "ar" : "en")
  }, [])

  const setStaticPageTranslations = useCallback((payload) => {
    setStaticPageTranslationState({
      pageKey: payload?.pageKey || null,
      routePath: payload?.routePath || "",
      map: payload?.map || {},
    })
  }, [])

  const clearStaticPageTranslations = useCallback(() => {
    setStaticPageTranslationState({
      pageKey: null,
      routePath: "",
      map: {},
    })
  }, [])

  const getStaticPageTranslation = useCallback((sourceText) => {
    if (currentLanguage.code !== "ar" || !sourceText) return null

    const rawKey = String(sourceText)
    const normalizedKey = normalizeTranslationLookupKey(rawKey)
    const map = staticPageTranslationState?.map || {}

    return map[rawKey] || (normalizedKey ? map[normalizedKey] : null) || null
  }, [currentLanguage.code, staticPageTranslationState])

  // Translate text function using Helsinki-NLP model (uses batched queue internally)
  const translate = useCallback(async (text, targetLang = currentLanguage.code) => {
    if (!text) return text

    // Check local cache first (from translationService)
    const direction = targetLang === 'ar' ? 'en-ar' : 'ar-en';
    const cached = getCachedTranslation(text, direction);
    if (cached) {
      return cached;
    }

    try {
      if (targetLang === "ar") {
        return await translateToArabic(text)
      }
      return await translateToEnglish(text)
    } catch (error) {
      console.error("Translation error:", error)
      return text
    }
  }, [currentLanguage.code])

  // Batch translate function - optimized to use preloadTranslations
  const translateBatch = useCallback(async (texts, targetLang = currentLanguage.code) => {
    if (!texts || texts.length === 0) return [];
    
    // Use preloadTranslations which batches efficiently
    await preloadTranslations(texts, targetLang);
    
    // All texts should now be cached, retrieve them
    const direction = targetLang === 'ar' ? 'en-ar' : 'ar-en';
    return texts.map(text => getCachedTranslation(text, direction) || text);
  }, [currentLanguage.code])

  const value = {
    currentLanguage,
    setCurrentLanguage,
    switchLanguage,
    translate,
    translateBatch,
    isLoading,
    isRTL: currentLanguage.dir === "rtl",
    isArabic: currentLanguage.code === "ar",
    isEnglish: currentLanguage.code === "en",
    getLocalizedPath,
    getPathWithoutLangPrefix,
    staticPageTranslationState,
    setStaticPageTranslations,
    clearStaticPageTranslations,
    getStaticPageTranslation,
    languages: LANGUAGES,
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

// Custom hook to use language context
export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}

export default LanguageContext
