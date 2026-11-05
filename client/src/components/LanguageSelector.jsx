"use client"

import { useLanguage, LANGUAGES } from "../context/LanguageContext"
import { Globe } from "lucide-react"

/**
 * Website language toggle. Instead of a dropdown it shows the OTHER language and switches to
 * it on click: on an English page it reads "العربية" (→ Arabic); on an Arabic page it reads
 * "English" (→ English). Country/currency is chosen separately in CountrySwitcher.
 */
const LanguageSelector = ({ className = "" }) => {
  const { currentLanguage, switchLanguage } = useLanguage()
  const isArabic = currentLanguage.code === "ar"
  const target = isArabic ? LANGUAGES.EN : LANGUAGES.AR

  return (
    <button
      onClick={() => switchLanguage(target.code)}
      className={`flex items-center gap-1.5 text-sm font-semibold text-header-text transition hover:text-lime-600 ${className}`}
      aria-label={`Switch to ${target.name}`}
    >
      <Globe className="w-[18px] h-[18px] shrink-0" />
      <span
        dir={target.dir === "rtl" ? "rtl" : "ltr"}
        className={`whitespace-nowrap ${target.dir === "rtl" ? "font-arabic" : ""}`}
      >
        {target.nativeName}
      </span>
    </button>
  )
}

export default LanguageSelector
