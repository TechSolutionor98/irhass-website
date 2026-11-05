import { useEffect } from "react"

/**
 * Stops the mouse wheel from changing the value of a focused <input type="number">.
 *
 * Browsers increment/decrement a number input on wheel only while it is focused, which
 * silently corrupts quantities, prices and codes when a shopper scrolls the page. Blurring
 * the field on wheel keeps its value put while letting the page scroll normally. One global
 * listener covers every number input on the site, so individual inputs need no change.
 */
export default function DisableNumberInputScroll() {
  useEffect(() => {
    const onWheel = () => {
      const el = document.activeElement
      if (el && el.tagName === "INPUT" && el.type === "number") {
        el.blur()
      }
    }
    document.addEventListener("wheel", onWheel, { passive: true })
    return () => document.removeEventListener("wheel", onWheel)
  }, [])

  return null
}
