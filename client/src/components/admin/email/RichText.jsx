"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Bold, Italic, Underline, Link2, List, ListOrdered, Palette, Braces, Eraser } from "lucide-react"
import { BRAND_SWATCHES } from "./emailTheme"
import { MERGE_FIELDS } from "./blockDefs"

/**
 * Text editing on the canvas.
 *
 * Typing happens where the words will appear, not in a box on the right -- in an
 * email the line length and the typeface are the layout, and editing a headline
 * somewhere else means judging it against the wrong measure.
 *
 * Deliberately not TipTap, although the project has it. TipTap's stylesheet is
 * imported globally by the blog editor and is not scoped: `.ProseMirror` there sets
 * a 200px minimum height and its own type scale, which lands on every editor in the
 * admin bundle once any page has loaded it. The class names here are prefixed and the
 * element is styled inline, so nothing can reach into it.
 */

const TOOLBAR_HEIGHT = 44
const TOOLBAR_GAP = 8

/** contentEditable's own commands. Deprecated on paper, still the only thing every browser implements. */
const exec = (command, value = null) => document.execCommand(command, false, value)

const FloatingToolbar = ({ rect, onCommand, onInsertMerge, onColour }) => {
  const ref = useRef(null)
  const [placement, setPlacement] = useState({ top: 0, left: 0, below: false })
  const [openMenu, setOpenMenu] = useState(null)

  // Measured after paint: the toolbar's width depends on whether a menu is open, and
  // guessing it puts the thing half off the screen on a narrow panel.
  useLayoutEffect(() => {
    if (!rect) return
    const width = ref.current?.offsetWidth || 320
    const height = ref.current?.offsetHeight || TOOLBAR_HEIGHT

    // Above by default; below when there is not room, so it never covers the line
    // being typed.
    const roomAbove = rect.top
    const below = roomAbove < height + TOOLBAR_GAP
    const top = below ? rect.bottom + TOOLBAR_GAP : rect.top - height - TOOLBAR_GAP

    // Centred on the selection, then pulled back inside the viewport.
    let left = rect.left + rect.width / 2 - width / 2
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))

    setPlacement({ top, left, below })
  }, [rect, openMenu])

  if (!rect) return null

  const Button = ({ title, onClick, active, children }) => (
    <button
      type="button"
      title={title}
      // mousedown, not click: click fires after the selection has already been lost
      // to the button, and every command here operates on the selection.
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={`grid h-8 w-8 place-items-center rounded transition-colors ${
        active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
    >
      {children}
    </button>
  )

  return createPortal(
    <div
      ref={ref}
      style={{ top: placement.top, left: placement.left }}
      className="fixed z-[80] flex items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-1 shadow-lg"
      onMouseDown={(e) => e.preventDefault()}
    >
      <Button title="Bold" onClick={() => onCommand("bold")}><Bold size={15} /></Button>
      <Button title="Italic" onClick={() => onCommand("italic")}><Italic size={15} /></Button>
      <Button title="Underline" onClick={() => onCommand("underline")}><Underline size={15} /></Button>

      <span className="mx-1 h-5 w-px bg-stone-200" />

      <Button title="Bulleted list" onClick={() => onCommand("insertUnorderedList")}><List size={15} /></Button>
      <Button title="Numbered list" onClick={() => onCommand("insertOrderedList")}><ListOrdered size={15} /></Button>

      <span className="mx-1 h-5 w-px bg-stone-200" />

      <Button title="Link" onClick={() => onCommand("__link")}><Link2 size={15} /></Button>

      <div className="relative">
        <Button title="Colour" active={openMenu === "colour"} onClick={() => setOpenMenu(openMenu === "colour" ? null : "colour")}>
          <Palette size={15} />
        </Button>
        {openMenu === "colour" && (
          <div className={`absolute left-0 z-10 grid w-40 grid-cols-4 gap-1 rounded-lg border border-stone-200 bg-white p-2 shadow-lg ${placement.below ? "top-full mt-1" : "bottom-full mb-1"}`}>
            {BRAND_SWATCHES.map((swatch) => (
              <button
                key={swatch.value}
                type="button"
                title={swatch.label}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onColour(swatch.value)
                  setOpenMenu(null)
                }}
                className="h-7 w-7 rounded border border-stone-300"
                style={{ background: swatch.value }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <Button title="Merge field" active={openMenu === "merge"} onClick={() => setOpenMenu(openMenu === "merge" ? null : "merge")}>
          <Braces size={15} />
        </Button>
        {openMenu === "merge" && (
          <div className={`absolute right-0 z-10 w-52 rounded-lg border border-stone-200 bg-white py-1 shadow-lg ${placement.below ? "top-full mt-1" : "bottom-full mb-1"}`}>
            <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-stone-400">
              Swapped per person at send
            </p>
            {MERGE_FIELDS.map((field) => (
              <button
                key={field.token}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onInsertMerge(field.token)
                  setOpenMenu(null)
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50"
              >
                <span>{field.label}</span>
                <code className="text-[10px] text-stone-400">{`{{${field.token}}}`}</code>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="mx-1 h-5 w-px bg-stone-200" />
      <Button title="Clear formatting" onClick={() => onCommand("removeFormat")}><Eraser size={15} /></Button>
    </div>,
    document.body,
  )
}

/**
 * @param {string} value HTML
 * @param {(html: string) => void} onChange fired on blur, not on every keystroke
 * @param {boolean} active whether this block is the selected one
 */
const RichText = ({ value, onChange, active, style, placeholder = "Click to write…" }) => {
  const ref = useRef(null)
  const [selectionRect, setSelectionRect] = useState(null)

  // Written into the DOM only when the element is not focused. Re-setting innerHTML
  // while someone is typing throws the caret back to the start of the block.
  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if (el.innerHTML !== (value || "")) el.innerHTML = value || ""
  }, [value])

  const commit = useCallback(() => {
    const el = ref.current
    if (el && el.innerHTML !== value) onChange(el.innerHTML)
  }, [onChange, value])

  const updateSelection = useCallback(() => {
    const el = ref.current
    const selection = window.getSelection()
    if (!el || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectionRect(null)
      return
    }
    if (!el.contains(selection.anchorNode)) {
      setSelectionRect(null)
      return
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    // A zero-size rect happens mid-drag; positioning against it flings the toolbar
    // into the top-left corner.
    setSelectionRect(rect.width || rect.height ? rect : null)
  }, [])

  useEffect(() => {
    if (!active) {
      setSelectionRect(null)
      return
    }
    document.addEventListener("selectionchange", updateSelection)
    return () => document.removeEventListener("selectionchange", updateSelection)
  }, [active, updateSelection])

  const handleCommand = (command) => {
    if (command === "__link") {
      const url = window.prompt("Link to:", "https://")
      if (url) exec("createLink", url)
    } else {
      exec(command)
    }
    commit()
  }

  const insertMerge = (token) => {
    // insertText, not insertHTML: the token is literal text that the sender swaps
    // later, and wrapping it in markup would stop the pattern matching.
    exec("insertText", `{{${token}}}`)
    commit()
  }

  return (
    <>
      <div
        ref={ref}
        contentEditable={active}
        suppressContentEditableWarning
        onBlur={commit}
        onInput={updateSelection}
        // Paste as plain text. Pasting from Word brings its own markup with it, and
        // Word's markup is exactly what breaks a carefully built email.
        onPaste={(e) => {
          e.preventDefault()
          exec("insertText", e.clipboardData.getData("text/plain"))
        }}
        data-placeholder={placeholder}
        className={`email-rt outline-none ${active ? "cursor-text" : "cursor-pointer"}`}
        style={style}
      />
      {active && (
        <FloatingToolbar
          rect={selectionRect}
          onCommand={handleCommand}
          onInsertMerge={insertMerge}
          onColour={(colour) => {
            exec("foreColor", colour)
            commit()
          }}
        />
      )}
      {/* Scoped to this component. The global TipTap stylesheet styles bare
          `.ProseMirror`, so anything unprefixed here would be fighting it. */}
      <style>{`
        .email-rt:empty:before {
          content: attr(data-placeholder);
          color: #a8a29e;
        }
        .email-rt p { margin: 0 0 10px 0; }
        .email-rt p:last-child { margin-bottom: 0; }
        .email-rt ul, .email-rt ol { margin: 0 0 10px 0; padding-left: 22px; }
        .email-rt a { color: inherit; text-decoration: underline; }
      `}</style>
    </>
  )
}

export default RichText
