import { useEffect, useRef } from "react"
import { useLanguage } from "../context/LanguageContext"
import { normalizeTranslationLookupKey } from "../constants/staticPagePaths"

const TRANSLATABLE_ATTRS = ["placeholder", "title", "alt", "aria-label"]

const getTranslatedValue = (value, translationMap) => {
  if (typeof value !== "string") return null

  const exact = translationMap[value]
  if (exact) return exact

  const normalized = normalizeTranslationLookupKey(value)
  if (!normalized) return null

  const normalizedHit = translationMap[normalized]
  if (normalizedHit) {
    if (value === normalized) return normalizedHit

    const leadingWhitespace = value.match(/^\s*/)?.[0] || ""
    const trailingWhitespace = value.match(/\s*$/)?.[0] || ""
    return `${leadingWhitespace}${normalizedHit}${trailingWhitespace}`
  }

  return null
}

const StaticPageContentTranslator = ({ children }) => {
  const wrapperRef = useRef(null)
  const { isArabic, staticPageTranslationState } = useLanguage()

  useEffect(() => {
    const root = wrapperRef.current
    const map = staticPageTranslationState?.map || {}

    if (!root) return undefined

    const translatedKeys = Object.keys(map)
    if (!isArabic || translatedKeys.length === 0) {
      return undefined
    }

    const textPatches = []
    const attrPatches = []

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let currentNode = walker.nextNode()

    while (currentNode) {
      const originalText = currentNode.nodeValue
      const translatedText = getTranslatedValue(originalText, map)

      if (translatedText && translatedText !== originalText) {
        textPatches.push({ node: currentNode, originalText })
        currentNode.nodeValue = translatedText
      }

      currentNode = walker.nextNode()
    }

    const elements = root.querySelectorAll("*")
    elements.forEach((element) => {
      TRANSLATABLE_ATTRS.forEach((attrName) => {
        const originalValue = element.getAttribute(attrName)
        if (!originalValue) return

        const translatedValue = getTranslatedValue(originalValue, map)
        if (translatedValue && translatedValue !== originalValue) {
          attrPatches.push({ element, attrName, originalValue })
          element.setAttribute(attrName, translatedValue)
        }
      })
    })

    return () => {
      textPatches.forEach(({ node, originalText }) => {
        if (node) {
          node.nodeValue = originalText
        }
      })

      attrPatches.forEach(({ element, attrName, originalValue }) => {
        if (element?.isConnected) {
          element.setAttribute(attrName, originalValue)
        }
      })
    }
  }, [isArabic, staticPageTranslationState])

  return <div ref={wrapperRef}>{children}</div>
}

export default StaticPageContentTranslator
