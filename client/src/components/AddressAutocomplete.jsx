"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin, Loader2 } from "lucide-react"
import { getProvincesForCountry } from "../utils/countryStates"

/**
 * A street field that suggests real places as the customer types.
 *
 * Suggestions come from Photon (photon.komoot.io), the open-source OpenStreetMap
 * geocoder: no key, no cost, and results carry the street, district, city and emirate
 * separately, so picking one fills the whole address rather than just this box.
 *
 * Results are limited to the country chosen above the field, so a customer in Lahore
 * is never offered a street in another country. The customer can still type anything --
 * a house number, a landmark -- and ignore the list; nothing is forced.
 */
const PHOTON_URL = "https://photon.komoot.io/api/"

// Country name as the store spells it -> ISO code Photon filters by.
const COUNTRY_CODES = {
  pakistan: "PK",
  pk: "PK",
}

const countryCodeFor = (countryName, fallbackCode) => {
  const key = String(countryName || "").trim().toLowerCase()
  return COUNTRY_CODES[key] || (fallbackCode ? String(fallbackCode).toUpperCase() : "")
}

// Photon's emirate/region name -> the option in the store's own province list, so the
// State dropdown lands on a real choice. Falls back to the raw name when nothing matches.
const matchProvince = (countryCode, photonState, photonCity) => {
  const options = getProvincesForCountry(countryCode) || []
  const norm = (v) => String(v || "").toLowerCase().replace(/[^a-z]/g, "")
  const candidates = [photonState, photonCity].filter(Boolean)
  for (const candidate of candidates) {
    const n = norm(candidate)
    if (!n) continue
    const hit = options.find((opt) => {
      const o = norm(opt)
      return o === n || o.startsWith(n) || n.startsWith(o) || o.includes(n)
    })
    if (hit) return hit
  }
  return photonState || ""
}

// One suggestion, as the field shows it and as the form receives it.
const toSuggestion = (feature, countryCode) => {
  const p = feature.properties || {}
  const streetLine = [p.housenumber, p.street || (p.type === "street" ? p.name : "")].filter(Boolean).join(" ")
  // A named place (shop, building, landmark) keeps its name in front of the street.
  const line1 = p.type === "street" ? p.name : [p.name, streetLine].filter(Boolean).join(", ")
  const district = p.district || p.locality || ""
  const city = p.city || p.county || p.state || ""
  const label = [line1, district, city].filter(Boolean).join(", ")
  return {
    id: `${p.osm_type || ""}${p.osm_id || ""}${label}`,
    label,
    secondary: [p.state, p.country].filter(Boolean).join(", "),
    address: [line1, district].filter(Boolean).join(", "),
    city,
    state: matchProvince(countryCode, p.state, p.city),
    zipCode: p.postcode || "",
  }
}

const AddressAutocomplete = ({
  value,
  onChange,
  onSelect,
  countryName,
  countryCode,
  placeholder = "Street name, Villa/Apartment details",
  className = "",
  required = false,
  inputClassName = "w-full border rounded-lg px-4 py-3",
}) => {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef(null)
  const requestRef = useRef(0)
  // Set when the customer just picked a suggestion, so the resulting value change does
  // not immediately search again and reopen the list.
  const justPickedRef = useRef(false)

  const code = countryCodeFor(countryName, countryCode)

  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false
      return
    }
    const q = String(value || "").trim()
    if (q.length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const id = ++requestRef.current
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams({ q, limit: "6", lang: "en" })
        // Photon has no country filter; the OSM tag filter narrows it to the chosen
        // country, and anything else is dropped below.
        const res = await fetch(`${PHOTON_URL}?${params}`, { signal: controller.signal })
        const data = await res.json()
        if (id !== requestRef.current) return
        const list = (data.features || [])
          .filter((f) => !code || String(f.properties?.countrycode || "").toUpperCase() === code)
          .map((f) => toSuggestion(f, code))
          .filter((s) => s.label)
        // The same street can come back several times as different OSM objects.
        const seen = new Set()
        const unique = list.filter((s) => (seen.has(s.label) ? false : seen.add(s.label)))
        setSuggestions(unique)
        setOpen(unique.length > 0)
        setActive(-1)
        // Inside a scrolling modal the list can open below the fold; bring the field to
        // the top so every suggestion is in view.
        if (unique.length > 0) wrapRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
      } catch (err) {
        if (err?.name !== "AbortError" && id === requestRef.current) {
          // A geocoder outage must never block typing an address by hand.
          setSuggestions([])
          setOpen(false)
        }
      } finally {
        if (id === requestRef.current) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, code])

  // Click outside closes the list.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const pick = (s) => {
    justPickedRef.current = true
    setOpen(false)
    setSuggestions([])
    onSelect?.(s)
  }

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault()
      pick(suggestions[active])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        type="text"
        className={inputClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {loading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm ${i === active ? "bg-lime-50" : "hover:bg-gray-50"}`}
            >
              <MapPin size={15} className="mt-0.5 flex-shrink-0 text-lime-600" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-900">{s.label}</span>
                {s.secondary && <span className="block truncate text-xs text-gray-500">{s.secondary}</span>}
              </span>
            </li>
          ))}
          <li className="border-t border-gray-100 px-3 py-1.5 text-[10px] text-gray-400">
            Suggestions from OpenStreetMap
          </li>
        </ul>
      )}
    </div>
  )
}

export default AddressAutocomplete
