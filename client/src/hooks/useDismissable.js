"use client"

import { useEffect } from "react"

/**
 * Closes a popover when the shopper clicks outside it or presses Escape.
 * Shared by the country and language switchers so both behave the same way.
 *
 * @param {object} ref ref on the popover wrapper element
 * @param {boolean} isOpen whether the popover is currently open
 * @param {() => void} onDismiss called when it should close
 */
export const useDismissable = (ref, isOpen, onDismiss) => {
  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onDismiss()
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onDismiss()
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [ref, isOpen, onDismiss])
}

export default useDismissable
