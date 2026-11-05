"use client"

import { useState, useRef, useCallback } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import { ChevronDown, Globe, MapPin } from "lucide-react"
import { useDismissable } from "../hooks/useDismissable"

/**
 * Country and currency picker. Kept separate from the language picker so each
 * can be changed on its own.
 */
const CountrySwitcher = ({ className = "" }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentLanguage, isArabic, getPathWithoutLangPrefix } = useLanguage()
  const { countries, currentCountry, changeCountry } = useCurrency()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const close = useCallback(() => setIsOpen(false), [])
  useDismissable(dropdownRef, isOpen, close)

  const handleCountryChange = (countryCode) => {
    if (countryCode === currentCountry?.code) {
      close()
      return
    }

    changeCountry(countryCode)
    close()

    // Swap the country half of the URL slug, keeping the current language.
    const cleanPath = getPathWithoutLangPrefix(location.pathname)
    const targetSlug = `/${countryCode.toLowerCase()}-${currentLanguage.code.toLowerCase()}`
    const newPath = `${targetSlug}${cleanPath === "/" ? "" : cleanPath}`
    navigate(`${newPath}${location.search || ""}${location.hash || ""}`, { replace: true })
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg border border-lime-500 px-2.5 py-1.5 text-sm font-semibold text-header-text transition hover:bg-lime-50"
        aria-label="Select country and currency"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="w-6 h-4 rounded overflow-hidden inline-flex items-center justify-center border border-gray-200 shrink-0">
          {currentCountry?.flagSvg ? (
            <span
              className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-cover"
              dangerouslySetInnerHTML={{ __html: currentCountry.flagSvg }}
            />
          ) : (
            <Globe className="w-4 h-4 text-gray-600" />
          )}
        </span>
        <span dir="ltr">
          {currentCountry?.code || "AE"}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`absolute ${isArabic ? "left-0" : "right-0"} top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 w-64 overflow-hidden text-xs`}
        >
          <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
            <MapPin className="w-3.5 h-3.5" />
            Country &amp; Currency
          </div>

          <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
            {countries.map((c) => {
              const isSelected = currentCountry?.code === c.code
              return (
                <button
                  key={c.code}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleCountryChange(c.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${
                    isSelected ? "bg-emerald-50 text-emerald-800 font-bold" : "hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-4 rounded overflow-hidden inline-flex items-center justify-center border border-gray-200 shrink-0">
                      {c.flagSvg ? (
                        <span
                          className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-cover"
                          dangerouslySetInnerHTML={{ __html: c.flagSvg }}
                        />
                      ) : (
                        <span className="font-bold text-[10px]">{c.code}</span>
                      )}
                    </span>
                    <span className="truncate">
                      <span className="font-medium text-gray-900">{isArabic ? c.nameAr : c.name}</span>
                      <span className="text-gray-400 text-[10px] ml-1.5 font-mono" dir="ltr">
                        ({c.currencyCode})
                      </span>
                    </span>
                  </div>
                  {isSelected && <span className="text-emerald-600 font-bold shrink-0">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default CountrySwitcher
