"use client"

import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Image as ImageIcon,
  Layout,
  Monitor,
  Palette,
  PanelTop,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  SquareMousePointer,
  Trash2,
  Type,
} from "lucide-react"

import config from "../../config/config"
import { describeApiError } from "../../utils/apiError"
import ThemeColorField from "../../components/admin/theme/ThemeColorField"
import ThemeLogoField from "../../components/admin/theme/ThemeLogoField"
import ThemePreview from "../../components/admin/theme/ThemePreview"
import {
  BRAND_STEPS,
  contrastRatio,
  DEFAULT_BRAND_SCALE,
  generateBrandScale,
  isValidHex,
  readableTextOn,
} from "../../theme/palette"
import {
  CONTRAST_PAIRS,
  DEFAULT_THEME,
  FIELD_LABELS,
  THEME_SECTIONS,
} from "../../theme/themeDefaults"
import { applyPageOverride } from "../../theme/applyTheme"

/**
 * Appearance settings.
 *
 * Everything on this screen changes the public storefront only. The admin panel
 * keeps its own fixed colours, so no choice made here can make these pages
 * unreadable -- which is also why the preview on the right carries its own
 * inline colours rather than applying them to the surrounding UI.
 */

const TABS = [
  { key: "brand", label: "Brand & logos", icon: Palette },
  { key: "header", label: "Header", icon: PanelTop },
  { key: "navbar", label: "Navigation", icon: Layout },
  { key: "footer", label: "Footer", icon: Type },
  { key: "buttons", label: "Buttons", icon: SquareMousePointer },
  { key: "page", label: "Page colours", icon: Monitor },
  { key: "pages", label: "Per-page colours", icon: ImageIcon },
  { key: "css", label: "Custom CSS", icon: Code },
]

// Below this WCAG ratio, normal-size text is hard to read. Surfaced as a
// warning, never a block -- the admin may be styling something the checker
// cannot see.
const MIN_CONTRAST = 4.5

const sectionFields = (section) => Object.keys(FIELD_LABELS[section] || {})

const AdminThemeSettings = () => {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [tab, setTab] = useState("brand")
  const [previewDevice, setPreviewDevice] = useState("desktop")
  const [expandedPage, setExpandedPage] = useState(null)
  // Which page the preview is showing. null = the site-wide theme.
  const [previewPageKey, setPreviewPageKey] = useState(null)

  const token = localStorage.getItem("adminToken") || localStorage.getItem("token")
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token])

  const load = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${config.API_URL}/api/theme`)
      setForm(data)
      setError("")
    } catch (err) {
      setError(describeApiError(err, "Failed to load theme settings"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // --- form helpers ------------------------------------------------------

  const setTop = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const setColor = (section, field, value) =>
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }))

  const setLogo = (field, value) =>
    setForm((prev) => ({ ...prev, logos: { ...prev.logos, [field]: value } }))

  const setPage = (index, patch) =>
    setForm((prev) => ({
      ...prev,
      pages: prev.pages.map((page, i) => (i === index ? { ...page, ...patch } : page)),
    }))

  const setPageColor = (index, section, field, value) =>
    setForm((prev) => ({
      ...prev,
      pages: prev.pages.map((page, i) =>
        i === index ? { ...page, [section]: { ...(page[section] || {}), [field]: value } } : page,
      ),
    }))

  /**
   * A page rule starts out with no colours of its own. The first time a section
   * is switched on, seed it from the global theme so the admin is editing the
   * colours currently in force rather than a blank slate.
   */
  const togglePageSection = (index, section, flag, on) => {
    setForm((prev) => ({
      ...prev,
      pages: prev.pages.map((page, i) => {
        if (i !== index) return page
        const next = { ...page, [flag]: on }
        if (!on) return next

        if (section === "brand") {
          const hasScale = page.brandScale && page.brandScale[500]
          if (!hasScale) {
            next.brandPrimary = prev.brandPrimary
            next.brandScale = { ...prev.brandScale }
          }
        } else if (section === "logos") {
          if (!page.logos || !page.logos.headerDesktop) next.logos = { ...prev.logos }
        } else {
          const current = page[section] || {}
          const missing = sectionFields(section).some((field) => !current[field])
          if (missing) next[section] = { ...prev[section], ...current }
        }
        return next
      }),
    }))
  }

  const addCustomPage = () => {
    const stamp = Date.now().toString(36)
    setForm((prev) => ({
      ...prev,
      pages: [
        ...prev.pages,
        {
          key: `custom-${stamp}`,
          label: "New page rule",
          pattern: "",
          enabled: false,
          builtIn: false,
          sortOrder: prev.pages.length,
        },
      ],
    }))
    setExpandedPage(`custom-${stamp}`)
  }

  const removePage = (index) =>
    setForm((prev) => {
      const removed = prev.pages[index]
      if (removed && removed.key === previewPageKey) setPreviewPageKey(null)
      return { ...prev, pages: prev.pages.filter((_, i) => i !== index) }
    })

  /** Expand a rule and point the preview at it, so the two never disagree. */
  const openPage = (key) => {
    const next = expandedPage === key ? null : key
    setExpandedPage(next)
    setPreviewPageKey(next)
  }

  // --- brand ramp --------------------------------------------------------

  const regenerateScale = (primary) => {
    if (!isValidHex(primary)) return
    setForm((prev) => ({
      ...prev,
      brandPrimary: primary,
      brandScale: generateBrandScale(primary),
    }))
  }

  /**
   * Point every colour that was following the old brand colour at the new one.
   * Only fields still holding a shade of the previous ramp are touched, so a
   * deliberately different header or footer colour survives.
   */
  const applyBrandEverywhere = () => {
    setForm((prev) => {
      const oldScale = DEFAULT_BRAND_SCALE
      const scale = prev.brandScale || {}
      const wasBrand = (value) =>
        value &&
        Object.values(oldScale).some((shade) => shade.toLowerCase() === value.toLowerCase())
      const shadeOf = (value) => {
        const step = BRAND_STEPS.find(
          (s) => oldScale[s].toLowerCase() === String(value).toLowerCase(),
        )
        return step ? scale[step] : value
      }

      const remap = (section) =>
        Object.fromEntries(
          Object.entries(prev[section] || {}).map(([field, value]) => [
            field,
            typeof value === "string" && wasBrand(value) ? shadeOf(value) : value,
          ]),
        )

      return {
        ...prev,
        header: remap("header"),
        navbar: remap("navbar"),
        footer: remap("footer"),
        buttons: remap("buttons"),
        page: remap("page"),
      }
    })
  }

  // --- save / reset ------------------------------------------------------

  const handleSave = async () => {
    try {
      setSaving(true)
      setError("")
      setSuccess("")

      const blank = (form.pages || []).find((p) => !p.builtIn && !String(p.pattern || "").trim())
      if (blank) {
        setError(`"${blank.label || "A custom rule"}" has no URL pattern. Add one or delete the rule.`)
        return
      }

      const { data } = await axios.put(`${config.API_URL}/api/theme`, form, authHeader)
      setForm(data)
      setSuccess("Theme saved. Shoppers see it on their next page load.")
      setTimeout(() => setSuccess(""), 5000)
    } catch (err) {
      setError(describeApiError(err, "Failed to save theme"))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (
      !window.confirm(
        "Reset every colour, logo and page rule back to the site's original theme? This cannot be undone.",
      )
    )
      return

    try {
      setResetting(true)
      setError("")
      const { data } = await axios.post(`${config.API_URL}/api/theme/reset`, {}, authHeader)
      setForm(data)
      setSuccess("Theme reset to the original Irhaas colours.")
      setTimeout(() => setSuccess(""), 5000)
    } catch (err) {
      setError(describeApiError(err, "Failed to reset theme"))
    } finally {
      setResetting(false)
    }
  }

  /**
   * Switched-on rules float to the top so the pages that actually differ are
   * the ones you see first. Display order only -- `index` still points at the
   * real position in form.pages, which is what every setter writes to, and the
   * server reorders on save anyway. Array.sort is stable, so rules that are
   * both on (or both off) keep their listed order, and matching precedence is
   * unchanged.
   */
  const orderedPages = useMemo(() => {
    if (!form) return []
    return form.pages
      .map((page, index) => ({ page, index }))
      .sort((a, b) => Number(!!b.page.enabled) - Number(!!a.page.enabled))
  }, [form])

  const activeCount = useMemo(
    () => (form?.pages || []).filter((p) => p.enabled).length,
    [form],
  )

  /** The theme the preview should paint: site-wide, or one page layered on it. */
  const previewPage = previewPageKey
    ? (form?.pages || []).find((p) => p.key === previewPageKey) || null
    : null

  const previewTheme = useMemo(() => {
    if (!form) return null
    return previewPage ? { ...form, ...applyPageOverride(form, previewPage) } : form
  }, [form, previewPage])

  // --- contrast warnings -------------------------------------------------

  const warnings = useMemo(() => {
    if (!form) return []

    const same = (section, field) =>
      String(form[section]?.[field] || "").toLowerCase() ===
      String(DEFAULT_THEME[section]?.[field] || "").toLowerCase()

    return CONTRAST_PAIRS.map((pair) => {
      const bg = form[pair.section]?.[pair.bg]
      const fg = form[pair.section]?.[pair.fg]
      if (!isValidHex(bg) || !isValidHex(fg)) return null

      // Only flag pairs the admin has actually changed. Some of the shipped
      // combinations (white on the lime navbar, for one) are already below the
      // threshold, and warning about those on an untouched install is noise
      // that trains people to ignore the panel.
      if (same(pair.section, pair.bg) && same(pair.section, pair.fg)) return null

      const ratio = contrastRatio(bg, fg)
      if (ratio >= MIN_CONTRAST) return null
      return { ...pair, ratio, bg, suggestion: readableTextOn(bg) }
    }).filter(Boolean)
  }, [form])

  // --- render ------------------------------------------------------------

  if (loading) {
    return (
      <div className="ml-64 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-96 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  if (!form) {
    return (
      <div className="ml-64 p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          <p className="font-medium">{error || "Theme settings could not be loaded."}</p>
          <button
            onClick={load}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const renderColorGrid = (section, value, defaults, onChange) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-4">
      {sectionFields(section).map((field) => (
        <ThemeColorField
          key={field}
          label={FIELD_LABELS[section][field]}
          value={value?.[field] || ""}
          defaultValue={defaults?.[field]}
          onChange={(next) => onChange(field, next)}
        />
      ))}
    </div>
  )

  return (
    <div className="ml-64 p-8 bg-gray-50 min-h-screen">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Palette className="w-6 h-6 text-blue-600" />
            Website Appearance
          </h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Change the colours and logos of the public website. These settings never affect the
            admin panel, so a colour picked here cannot lock you out of these pages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={resetting || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-60"
          >
            <RotateCcw className="w-4 h-4" />
            {resetting ? "Resetting..." : "Reset to default"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || resetting}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Master switch */}
      <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Use these theme settings</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Turn this off to put the website back on its original colours without losing anything
            you have set up here.
          </p>
        </div>
        <label className="inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={form.enabled !== false}
            onChange={(e) => setTop("enabled", e.target.checked)}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
        </label>
      </div>

      {warnings.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Some text may be hard to read
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-800">
            {warnings.map((w) => (
              <li key={`${w.section}-${w.fg}`} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm border border-amber-300 shrink-0"
                  style={{ backgroundColor: w.bg }}
                />
                <span>
                  {w.label} &mdash; contrast {w.ratio.toFixed(1)}:1 (aim for {MIN_CONTRAST}:1).
                </span>
                <button
                  type="button"
                  onClick={() => setColor(w.section, w.fg, w.suggestion)}
                  className="underline hover:no-underline"
                >
                  Use {w.suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        {/* ------------------------------------------------ editor */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex flex-wrap gap-1 border-b border-gray-200 px-2 pt-2">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg border-b-2 -mb-px transition ${
                  tab === key
                    ? "border-blue-600 text-blue-700 font-medium bg-blue-50/60"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* ---------------------------------------- brand & logos */}
            {tab === "brand" && (
              <div className="space-y-8">
                <section>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Brand colour</h3>
                  <p className="text-xs text-gray-600 mb-4 max-w-2xl">
                    This is the site&apos;s main colour. Changing it repaints every branded element
                    across the website &mdash; buttons, badges, highlights, active states and links.
                    The eleven shades below are generated from it and used wherever a lighter or
                    darker tone is needed.
                  </p>

                  <div className="flex flex-wrap items-end gap-4">
                    <div className="w-64">
                      <ThemeColorField
                        label="Main brand colour"
                        value={form.brandPrimary}
                        defaultValue={DEFAULT_THEME.brandPrimary}
                        onChange={regenerateScale}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={applyBrandEverywhere}
                      className="px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
                      title="Repoint the header, navbar, footer and button colours that still use the original brand colour"
                    >
                      Apply to header, navbar, footer &amp; buttons
                    </button>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Generated shades
                      </h4>
                      <button
                        type="button"
                        onClick={() => regenerateScale(form.brandPrimary)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Regenerate from brand colour
                      </button>
                    </div>
                    <div className="flex rounded-lg overflow-hidden border border-gray-200">
                      {BRAND_STEPS.map((step) => (
                        <div key={step} className="flex-1 min-w-0">
                          <div
                            className="h-12"
                            style={{ backgroundColor: form.brandScale?.[step] }}
                            title={`${step}: ${form.brandScale?.[step]}`}
                          />
                          <div className="text-[10px] text-center text-gray-500 py-0.5">{step}</div>
                        </div>
                      ))}
                    </div>
                    <details className="mt-3">
                      <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                        Fine-tune individual shades
                      </summary>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">
                        {BRAND_STEPS.map((step) => (
                          <ThemeColorField
                            key={step}
                            label={`Shade ${step}`}
                            value={form.brandScale?.[step] || ""}
                            defaultValue={DEFAULT_BRAND_SCALE[step]}
                            onChange={(next) =>
                              setForm((prev) => ({
                                ...prev,
                                brandScale: { ...prev.brandScale, [step]: next },
                              }))
                            }
                          />
                        ))}
                      </div>
                    </details>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Logos</h3>
                  <p className="text-xs text-gray-600 mb-4">
                    Used across the website. Leave a field on its default path to keep the current
                    logo.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ThemeLogoField
                      label="Header logo (desktop)"
                      hint="Top-left of every page on desktop"
                      value={form.logos.headerDesktop}
                      defaultValue={DEFAULT_THEME.logos.headerDesktop}
                      width={form.logos.headerDesktopWidth}
                      defaultWidth={DEFAULT_THEME.logos.headerDesktopWidth}
                      onChange={(v) => setLogo("headerDesktop", v)}
                      onWidthChange={(v) => setLogo("headerDesktopWidth", v)}
                      previewBackground={form.header.background}
                    />
                    <ThemeLogoField
                      label="Header logo (mobile)"
                      hint="Centred in the mobile top bar"
                      value={form.logos.headerMobile}
                      defaultValue={DEFAULT_THEME.logos.headerMobile}
                      width={form.logos.headerMobileWidth}
                      defaultWidth={DEFAULT_THEME.logos.headerMobileWidth}
                      onChange={(v) => setLogo("headerMobile", v)}
                      onWidthChange={(v) => setLogo("headerMobileWidth", v)}
                      previewBackground={form.header.background}
                    />
                    <ThemeLogoField
                      label="Footer logo"
                      hint="Shown on the dark footer panel"
                      value={form.logos.footer}
                      defaultValue={DEFAULT_THEME.logos.footer}
                      width={form.logos.footerWidth}
                      defaultWidth={DEFAULT_THEME.logos.footerWidth}
                      onChange={(v) => setLogo("footer", v)}
                      onWidthChange={(v) => setLogo("footerWidth", v)}
                      previewBackground={form.footer.background}
                    />
                    <ThemeLogoField
                      label="Browser tab icon (favicon)"
                      hint="Small square image shown in the browser tab"
                      value={form.logos.favicon}
                      defaultValue={DEFAULT_THEME.logos.favicon}
                      onChange={(v) => setLogo("favicon", v)}
                    />
                  </div>

                  <label className="block mt-4 max-w-md">
                    <span className="text-sm font-medium text-gray-700">Logo alt text</span>
                    <input
                      type="text"
                      value={form.logos.altText || ""}
                      onChange={(e) => setLogo("altText", e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Irhaas"
                    />
                    <span className="text-xs text-gray-500">
                      Read out by screen readers and shown if the image fails to load.
                    </span>
                  </label>
                </section>
              </div>
            )}

            {/* ---------------------------------------- simple colour tabs */}
            {tab === "header" && (
              <>
                <p className="text-xs text-gray-600 mb-4">
                  The top bar holding the logo, search box and account/cart icons.
                </p>
                {renderColorGrid("header", form.header, DEFAULT_THEME.header, (f, v) =>
                  setColor("header", f, v),
                )}
              </>
            )}

            {tab === "navbar" && (
              <>
                <p className="text-xs text-gray-600 mb-4">
                  The category bar under the header, its dropdowns and the mobile menu drawer.
                </p>
                {renderColorGrid("navbar", form.navbar, DEFAULT_THEME.navbar, (f, v) =>
                  setColor("navbar", f, v),
                )}
              </>
            )}

            {tab === "footer" && (
              <>
                <p className="text-xs text-gray-600 mb-4">
                  The site has two footers &mdash; a dark panel on desktop and a white accordion on
                  mobile. Both are set here.
                </p>
                {renderColorGrid("footer", form.footer, DEFAULT_THEME.footer, (f, v) =>
                  setColor("footer", f, v),
                )}
              </>
            )}

            {tab === "buttons" && (
              <>
                <p className="text-xs text-gray-600 mb-4">
                  Add to cart, checkout and other call-to-action buttons across the website.
                </p>
                {renderColorGrid("buttons", form.buttons, DEFAULT_THEME.buttons, (f, v) =>
                  setColor("buttons", f, v),
                )}
              </>
            )}

            {tab === "page" && (
              <>
                <p className="text-xs text-gray-600 mb-4">
                  Backgrounds, text and prices used on the page body between the header and footer.
                </p>
                {renderColorGrid("page", form.page, DEFAULT_THEME.page, (f, v) =>
                  setColor("page", f, v),
                )}
              </>
            )}

            {/* ---------------------------------------- per-page */}
            {tab === "pages" && (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="max-w-2xl">
                    <p className="text-xs text-gray-600">
                      Switch a page on and it moves to the top of this list. Click it to set its
                      colours, and watch the preview on the right &mdash; it shows that page.
                      Anything you do not switch on keeps the site-wide colours from the other
                      tabs.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {activeCount === 0
                        ? "No page rules are on yet, so every page uses the site-wide colours."
                        : `${activeCount} page ${activeCount === 1 ? "rule is" : "rules are"} on.`}{" "}
                      Rules are matched in the listed order and the first match wins.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomPage}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add custom rule
                  </button>
                </div>

                <div className="space-y-2">
                  {orderedPages.map(({ page, index }) => {
                    const open = expandedPage === page.key
                    return (
                      <div
                        key={page.key}
                        className={`border rounded-lg ${
                          page.enabled ? "border-blue-300 bg-blue-50/40" : "border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <button
                            type="button"
                            onClick={() => openPage(page.key)}
                            className="text-gray-500 hover:text-gray-800 shrink-0"
                            aria-label={open ? "Collapse" : "Expand"}
                          >
                            {open ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            {page.builtIn ? (
                              <button
                                type="button"
                                onClick={() => openPage(page.key)}
                                className="block w-full text-left text-sm font-medium text-gray-900 truncate hover:text-blue-700"
                              >
                                {page.label}
                              </button>
                            ) : (
                              <input
                                type="text"
                                value={page.label || ""}
                                onChange={(e) => setPage(index, { label: e.target.value })}
                                placeholder="Rule name"
                                className="w-full max-w-xs px-2 py-1 text-sm font-medium rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => openPage(page.key)}
                              className="block w-full text-left text-xs text-gray-500 font-mono truncate mt-0.5 hover:text-gray-800"
                            >
                              {page.pattern || "No URL pattern set"}
                            </button>
                          </div>

                          <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer">
                            <span className="text-xs text-gray-600">
                              {page.enabled ? "On" : "Off"}
                            </span>
                            <input
                              type="checkbox"
                              checked={!!page.enabled}
                              onChange={(e) => {
                                setPage(index, { enabled: e.target.checked })
                                // Switching a rule on moves it to the top of the
                                // list; show it in the preview at the same time.
                                if (e.target.checked) {
                                  setExpandedPage(page.key)
                                  setPreviewPageKey(page.key)
                                }
                              }}
                              className="sr-only peer"
                            />
                            <div className="relative w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                          </label>

                          {!page.builtIn && (
                            <button
                              type="button"
                              onClick={() => removePage(index)}
                              className="shrink-0 text-gray-400 hover:text-red-600"
                              title="Delete this rule"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {open && (
                          <div className="border-t border-gray-200 p-4 space-y-5">
                            <label className="block">
                              <span className="text-xs font-medium text-gray-700">
                                URL pattern{!page.builtIn && " (required)"}
                              </span>
                              <input
                                type="text"
                                value={page.pattern || ""}
                                onChange={(e) => setPage(index, { pattern: e.target.value })}
                                spellCheck={false}
                                placeholder="/offers/**"
                                className="mt-1 w-full px-2 py-1.5 text-sm font-mono rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-500 block mt-1">
                                Leave out the country and language part of the URL &mdash;{" "}
                                <code className="bg-gray-100 px-1 rounded">/shop</code> covers{" "}
                                <code className="bg-gray-100 px-1 rounded">/ae-en/shop</code> and{" "}
                                <code className="bg-gray-100 px-1 rounded">/sa-ar/shop</code> alike.
                                Use <code className="bg-gray-100 px-1 rounded">*</code> for one part
                                of the path and <code className="bg-gray-100 px-1 rounded">**</code>{" "}
                                for the rest of it. Separate several patterns with commas.
                              </span>
                            </label>

                            {THEME_SECTIONS.map(({ key, flag, label }) => (
                              <div key={key} className="border border-gray-200 rounded-lg">
                                <label className="flex items-center gap-2 p-2.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={!!page[flag]}
                                    onChange={(e) =>
                                      togglePageSection(index, key, flag, e.target.checked)
                                    }
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm text-gray-800">
                                    Use different {label.toLowerCase()} on this page
                                  </span>
                                </label>

                                {page[flag] && (
                                  <div className="border-t border-gray-200 p-3">
                                    {key === "brand" && (
                                      <div className="w-64">
                                        <ThemeColorField
                                          label="Brand colour for this page"
                                          value={page.brandPrimary || ""}
                                          defaultValue={form.brandPrimary}
                                          onChange={(next) =>
                                            setPage(index, {
                                              brandPrimary: next,
                                              brandScale: generateBrandScale(next),
                                            })
                                          }
                                        />
                                      </div>
                                    )}

                                    {key === "logos" && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <ThemeLogoField
                                          label="Header logo (desktop)"
                                          value={page.logos?.headerDesktop}
                                          defaultValue={form.logos.headerDesktop}
                                          width={page.logos?.headerDesktopWidth}
                                          defaultWidth={form.logos.headerDesktopWidth}
                                          onChange={(v) =>
                                            setPageColor(index, "logos", "headerDesktop", v)
                                          }
                                          onWidthChange={(v) =>
                                            setPageColor(index, "logos", "headerDesktopWidth", v)
                                          }
                                        />
                                        <ThemeLogoField
                                          label="Header logo (mobile)"
                                          value={page.logos?.headerMobile}
                                          defaultValue={form.logos.headerMobile}
                                          width={page.logos?.headerMobileWidth}
                                          defaultWidth={form.logos.headerMobileWidth}
                                          onChange={(v) =>
                                            setPageColor(index, "logos", "headerMobile", v)
                                          }
                                          onWidthChange={(v) =>
                                            setPageColor(index, "logos", "headerMobileWidth", v)
                                          }
                                        />
                                      </div>
                                    )}

                                    {!["brand", "logos"].includes(key) &&
                                      renderColorGrid(key, page[key], form[key], (field, value) =>
                                        setPageColor(index, key, field, value),
                                      )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ---------------------------------------- custom css */}
            {tab === "css" && (
              <div>
                <p className="text-xs text-gray-600 mb-3 max-w-2xl">
                  For anything the fields above do not cover. This CSS is added to every public page
                  after the site&apos;s own styles, so it wins any conflict. It is not applied to
                  the admin panel. Leave it empty unless you know what you are changing.
                </p>
                <textarea
                  value={form.customCss || ""}
                  onChange={(e) => setTop("customCss", e.target.value)}
                  rows={16}
                  spellCheck={false}
                  placeholder={".product-card { border-radius: 12px; }"}
                  className="w-full px-3 py-2 text-sm font-mono rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {(form.customCss || "").length} / 20000 characters
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------ preview */}
        <div className="xl:sticky xl:top-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Live preview
                {previewPage && (
                  <span className="ml-1.5 font-normal text-gray-500">
                    &middot; {previewPage.label || previewPage.key}
                  </span>
                )}
              </h3>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={`px-2 py-1 ${
                    previewDevice === "desktop" ? "bg-blue-600 text-white" : "text-gray-600"
                  }`}
                  title="Desktop"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={`px-2 py-1 ${
                    previewDevice === "mobile" ? "bg-blue-600 text-white" : "text-gray-600"
                  }`}
                  title="Mobile"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
            </div>

            <label className="block mb-3">
              <span className="sr-only">Page to preview</span>
              <select
                value={previewPage ? previewPage.key : ""}
                onChange={(e) => {
                  const key = e.target.value || null
                  setPreviewPageKey(key)
                  if (key) {
                    setTab("pages")
                    setExpandedPage(key)
                  }
                }}
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Whole site (site-wide colours)</option>
                {(form.pages || []).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label || p.key}
                    {p.enabled ? "" : " — rule off"}
                  </option>
                ))}
              </select>
            </label>

            <ThemePreview theme={previewTheme} device={previewDevice} />

            {previewPage && !previewPage.enabled && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3">
                This rule is switched off, so the live site still shows this page in the site-wide
                colours. Turn it on to use what you see here.
              </p>
            )}

            <p className="text-xs text-gray-500 mt-3">
              {previewPage
                ? "Sections this rule does not override fall back to the site-wide colours, exactly as they will on the live page."
                : "The colours every page uses unless a page rule overrides them."}{" "}
              A sketch of the storefront, not a screenshot &mdash; it shows the colours, not the
              real layout. Changes here are not live until you press{" "}
              <span className="font-medium">Save changes</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminThemeSettings
