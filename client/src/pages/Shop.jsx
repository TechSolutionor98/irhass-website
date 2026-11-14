"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react"
import axios from "axios"
import { useNavigate, useLocation, useParams } from "react-router-dom"
import { useCart } from "../context/CartContext"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import HomeStyleProductCard from "../components/HomeStyleProductCard"
import ProductSchema from "../components/ProductSchema"
import SEO from "../components/SEO"
import productCache, { scoreSearchRelevance } from "../services/productCache"
import { getCategoryTreeCached } from "../services/categoryTreeCache"
import { generateShopURL, parseShopURL, createSlug } from "../utils/urlUtils"
import { createMetaDescription, generateSEOTitle } from "../utils/seoHelpers"
import { getFullImageUrl } from "../utils/imageUtils"
import TranslatedText from "../components/TranslatedText"
import { preloadTranslations } from "../LanguageModel/translationService"
import PromoPopup from "../components/PromoPopup"

import config from "../config/config"
import "rc-slider/assets/index.css"
import Slider from "rc-slider"

const API_BASE_URL = `${config.API_URL}`
const DEFAULT_PRICE_RANGE = [0, Number.POSITIVE_INFINITY]
const PRICE_FILTER_MIN = 0
const PRICE_FILTER_MAX = 20000
const PRICE_FILTER_STEP = 1
const INFINITY_SYMBOL = "∞"
const NUMERIC_INPUT_PATTERN = /^\d*$/
const SHOP_HYBRID_BOOTSTRAP_ENABLED =
  String(import.meta.env?.VITE_SHOP_HYBRID_BOOTSTRAP_ENABLED || "false").toLowerCase() === "true"
const PRODUCT_SYSTEM_FILTERS = []

const bounceStyle = {
  animation: "bounce 1s infinite",
}
const bounceKeyframes = `@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-30px); } }`
if (typeof document !== "undefined" && !document.getElementById("bounce-keyframes")) {
  const style = document.createElement("style")
  style.id = "bounce-keyframes"
  style.innerHTML = bounceKeyframes
  document.head.appendChild(style)
}

// Right-anchored custom dropdown to avoid right overflow
const SortDropdown = ({ value, onChange, showRelevance = false }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const options = [
    ...(showRelevance ? [{ value: "relevance", label: "Best Match", labelAr: "الأكثر صلة" }] : []),
    { value: "newest", label: "Newest First", labelAr: "الأحدث أولاً" },
    { value: "price-low", label: "Price: Low to High", labelAr: "السعر: من الأقل للأعلى" },
    { value: "price-high", label: "Price: High to Low", labelAr: "السعر: من الأعلى للأقل" },
    { value: "name", label: "Name: A-Z", labelAr: "الاسم: أ-ي" },
  ]

  const current = options.find((o) => o.value === value)?.label || "Sort"

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const handleSelect = (val) => {
    onChange?.({ target: { value: val } })
    setOpen(false)
  }

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center gap-2"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate max-w-[46vw] sm:max-w-none"><TranslatedText text={current} /></span>
        <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          className="absolute right-0 mt-1 w-56 max-w-[80vw] bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden"
          role="listbox"
        >
          {options.map((opt) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-4 py-2 text-gray-900 hover:bg-gray-100 ${opt.value === value ? "font-semibold" : ""
                  }`}
              >
                <TranslatedText text={opt.label} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const PriceFilter = ({ min, max, onApply, initialRange, isApplied }) => {
  const minBound = Number.isFinite(Number(min)) ? Number(min) : 0
  const rawMaxBound = Number.isFinite(Number(max)) ? Number(max) : minBound
  const maxBound = rawMaxBound >= minBound ? rawMaxBound : minBound
  const appliedMinFromProps =
    Array.isArray(initialRange) && initialRange.length === 2 && Number.isFinite(Number(initialRange[0]))
      ? Number(initialRange[0])
      : 0
  const appliedMaxFromProps =
    Array.isArray(initialRange) && initialRange.length === 2 && Number.isFinite(Number(initialRange[1]))
      ? Number(initialRange[1])
      : Number.POSITIVE_INFINITY
  const hasInfiniteUpperBound =
    Array.isArray(initialRange) && initialRange.length === 2 && !Number.isFinite(Number(initialRange[1]))

  const normalizeSliderRange = (maybeRange) => {
    const source = Array.isArray(maybeRange) && maybeRange.length === 2 ? maybeRange : [minBound, maxBound]
    let nextMin = Number(source[0])
    let nextMax = Number(source[1])

    if (!Number.isFinite(nextMin)) nextMin = minBound
    if (!Number.isFinite(nextMax)) nextMax = maxBound

    nextMin = Math.max(minBound, Math.min(nextMin, maxBound))
    nextMax = Math.max(minBound, Math.min(nextMax, maxBound))

    if (nextMin > nextMax) {
      ;[nextMin, nextMax] = [nextMax, nextMin]
    }

    return [nextMin, nextMax]
  }

  const [range, setRange] = useState(() => normalizeSliderRange(initialRange))
  const [inputMin, setInputMin] = useState("0")
  const [inputMax, setInputMax] = useState(INFINITY_SYMBOL)
  const isUserAdjustingSliderRef = useRef(false)

  useEffect(() => {
    const nextRange = normalizeSliderRange(initialRange)
    setRange(nextRange)

    if (isApplied) {
      setInputMin(String(appliedMinFromProps))
      setInputMax(hasInfiniteUpperBound ? INFINITY_SYMBOL : String(appliedMaxFromProps))
      return
    }

    setInputMin("0")
    setInputMax(INFINITY_SYMBOL)
  }, [initialRange, isApplied, maxBound, minBound, appliedMinFromProps, appliedMaxFromProps, hasInfiniteUpperBound])

  const handleSliderChange = (values) => {
    setRange(values)
    if (!isUserAdjustingSliderRef.current) return

    setInputMin(String(values[0]))
    setInputMax(String(values[1]))
  }

  const handleSliderStart = () => {
    isUserAdjustingSliderRef.current = true
  }

  const handleSliderEnd = () => {
    isUserAdjustingSliderRef.current = false
  }

  const handleInputMin = (e) => {
    const value = e.target.value
    if (value === "") {
      setInputMin("")
      return
    }

    if (NUMERIC_INPUT_PATTERN.test(value)) {
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue)) {
        return
      }

      const clampedValue = Math.max(minBound, Math.min(numericValue, range[1]))
      setInputMin(String(clampedValue))
      setRange([clampedValue, range[1]])
    }
  }

  const handleInputMax = (e) => {
    const value = e.target.value
    if (value === "") {
      setInputMax("")
      return
    }

    if (value === INFINITY_SYMBOL) {
      setInputMax(INFINITY_SYMBOL)
      setRange([range[0], maxBound])
      return
    }

    if (NUMERIC_INPUT_PATTERN.test(value)) {
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue)) {
        return
      }

      const clampedValue = Math.max(range[0], Math.min(numericValue, maxBound))
      setInputMax(String(clampedValue))
      setRange([range[0], clampedValue])
    }
  }

  const handleMinFocus = () => {
    setInputMin("")
  }

  const handleMaxFocus = () => {
    setInputMax((prev) => (prev === INFINITY_SYMBOL ? "" : prev))
  }

  const handleApply = (e) => {
    if (e && e.preventDefault) e.preventDefault()

    const parsedMin = inputMin === "" ? minBound : Number(inputMin)
    const normalizedMin = Number.isFinite(parsedMin)
      ? Math.max(minBound, Math.min(parsedMin, maxBound))
      : minBound

    const parsedMax =
      inputMax === "" || inputMax === INFINITY_SYMBOL ? Number.POSITIVE_INFINITY : Number(inputMax)
    const normalizedMax = Number.isFinite(parsedMax)
      ? Math.max(normalizedMin, Math.min(parsedMax, maxBound))
      : Number.POSITIVE_INFINITY

    onApply([normalizedMin, normalizedMax])
  }

  return (
    <div className="">
      <Slider
        range
        min={minBound}
        max={maxBound}
        step={PRICE_FILTER_STEP}
        value={range}
        onChange={handleSliderChange}
        onBeforeChange={handleSliderStart}
        onChangeComplete={handleSliderEnd}
        trackStyle={[{ backgroundColor: "rgb(var(--brand-500))" }]}
        handleStyle={[
          { backgroundColor: "rgb(var(--brand-500))", borderColor: "rgb(var(--brand-500))" },
          { backgroundColor: "rgb(var(--brand-500))", borderColor: "rgb(var(--brand-500))" },
        ]}
        railStyle={{ backgroundColor: "#e5e7eb" }}
      />
      <div className="flex justify-between mt-4 mb-2 text-xs font-semibold">
        <span><TranslatedText>MIN</TranslatedText></span>
        <span><TranslatedText>MAX</TranslatedText></span>
      </div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          inputMode="decimal"
          className="w-1/2 border rounded px-2 py-1 text-center focus:border-lime-500 focus:ring-lime-500"
          value={inputMin}
          onChange={handleInputMin}
          onFocus={handleMinFocus}
          onBlur={() => {
            if (inputMin === "") {
              setInputMin(isApplied ? String(appliedMinFromProps) : "0")
            }
          }}
        />
        <input
          type="text"
          inputMode="decimal"
          className="w-1/2 border rounded px-2 py-1 text-center focus:border-lime-500 focus:ring-lime-500"
          value={inputMax}
          onChange={handleInputMax}
          onFocus={handleMaxFocus}
          onBlur={() => {
            if (inputMax === "") {
              setInputMax(isApplied ? (hasInfiniteUpperBound ? INFINITY_SYMBOL : String(appliedMaxFromProps)) : INFINITY_SYMBOL)
            }
          }}
        />
      </div>
      <button
        type="button"
        className="w-full bg-white border border-lime-500 text-lime-600 rounded py-2 font-semibold hover:bg-lime-50 hover:text-lime-700 hover:border-lime-600 transition"
        onClick={handleApply}
      >
        <TranslatedText>Apply</TranslatedText>
      </button>
    </div>
  )
}

const Shop = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const { addToCart } = useCart()
  const { currentLanguage, isArabic } = useLanguage()
  const { formatPrice: formatCurrencyPrice } = useCurrency()
  const [products, setProducts] = useState([])
  // How many products match the current filters, which is not the same as how many are
  // loaded: the first paint holds one page from the server while the full catalogue is
  // still downloading. Showing products.length there would report the page size as the
  // category's size.
  const [matchCount, setMatchCount] = useState(0)
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [actualSearchQuery, setActualSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedBrands, setSelectedBrands] = useState([])
  const [selectedSeries, setSelectedSeries] = useState([])
  const [selectedModels, setSelectedModels] = useState([])
  const [selectedMakes, setSelectedMakes] = useState([])
  const [selectedManufacturers, setSelectedManufacturers] = useState([])
  const [selectedSoldBy, setSelectedSoldBy] = useState([])
  const [priceRange, setPriceRange] = useState(DEFAULT_PRICE_RANGE)
  const [maxPrice, setMaxPrice] = useState(PRICE_FILTER_MAX)
  const [sortBy, setSortBy] = useState("newest")
  // Until the shopper picks a sort, a search is ordered by how well each product matches.
  // Sorting search hits by "newest" is what made an unrelated new arrival outrank the
  // product the buyer actually typed.
  const [sortExplicitlyChosen, setSortExplicitlyChosen] = useState(false)
  const hasActiveSearch = Boolean(searchQuery && searchQuery.trim())
  const effectiveSortBy = (() => {
    if (hasActiveSearch && !sortExplicitlyChosen) return "relevance"
    // "Best Match" has no meaning once the search is cleared.
    if (!hasActiveSearch && sortBy === "relevance") return "newest"
    return sortBy
  })()
  const [brandSearch, setBrandSearch] = useState("")
  const [subCategories, setSubCategories] = useState([])
  const [selectedSubCategories, setSelectedSubCategories] = useState([])
  const [selectedSubCategory2, setSelectedSubCategory2] = useState(null)
  const [selectedSubCategory3, setSelectedSubCategory3] = useState(null)
  const [selectedSubCategory4, setSelectedSubCategory4] = useState(null)
  const [currentSubCategoryName, setCurrentSubCategoryName] = useState(null)
  const [currentSubCategory2Name, setCurrentSubCategory2Name] = useState(null)
  const [currentSubCategory3Name, setCurrentSubCategory3Name] = useState(null)
  const [currentSubCategory4Name, setCurrentSubCategory4Name] = useState(null)
  // Add state for full subcategory objects with SEO data
  const [subCategory2Data, setSubCategory2Data] = useState(null)
  const [subCategory3Data, setSubCategory3Data] = useState(null)
  const [subCategory4Data, setSubCategory4Data] = useState(null)
  // The long SEO copy for whichever category and subcategory this page is
  // showing, keyed by id. Fetched on its own because the lists above no longer
  // carry it -- sending every category's copy to draw one page's footer text
  // was several megabytes per visit.
  const [seoDocs, setSeoDocs] = useState({})

  // Fetch that copy for the handful of records this page actually renders --
  // the chosen category and the deepest chosen subcategory. A page shows at
  // most five, against the 287 the lists used to carry.
  useEffect(() => {
    const categoryId = selectedCategory && selectedCategory !== "all" ? selectedCategory : null
    const subIds = [
      selectedSubCategories?.[0],
      subCategory2Data?._id,
      subCategory3Data?._id,
      subCategory4Data?._id,
    ].filter(Boolean)

    // Anything already fetched stays; only what is missing is asked for.
    const missingSubs = subIds.filter((id) => !seoDocs[id])
    const missingCategory = categoryId && !seoDocs[categoryId] ? categoryId : null

    if (!missingCategory && missingSubs.length === 0) return

    let cancelled = false
    const load = async () => {
      try {
        const requests = []
        if (missingCategory) requests.push(axios.get(`${API_BASE_URL}/api/categories/seo?ids=${missingCategory}`))
        if (missingSubs.length)
          requests.push(axios.get(`${API_BASE_URL}/api/subcategories/seo?ids=${missingSubs.join(",")}`))

        const responses = await Promise.all(requests)
        if (cancelled) return

        const next = {}
        for (const response of responses) {
          for (const row of response.data || []) next[row._id] = row
        }
        if (Object.keys(next).length) setSeoDocs((current) => ({ ...current, ...next }))
      } catch (error) {
        // SEO copy is presentational. Losing it must not take the page with it.
        console.error("Could not load category SEO content:", error)
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedSubCategories, subCategory2Data, subCategory3Data, subCategory4Data])
  const [stockFilters, setStockFilters] = useState({ inStock: true, outOfStock: false, onSale: false })
  const [minPrice, setMinPrice] = useState(PRICE_FILTER_MIN)
  const [isPriceFilterApplied, setIsPriceFilterApplied] = useState(false)
  const [priceFilterApplyCount, setPriceFilterApplyCount] = useState(0)

  const [showPriceFilter, setShowPriceFilter] = useState(true)
  const [showCategoryFilter, setShowCategoryFilter] = useState(true)
  const [showBrandFilter, setShowBrandFilter] = useState(true)
  const [showSeriesFilter, setShowSeriesFilter] = useState(true)
  const [showModelFilter, setShowModelFilter] = useState(true)
  const [showMakeFilter, setShowMakeFilter] = useState(true)
  const [showManufacturerFilter, setShowManufacturerFilter] = useState(true)
  const [showSoldByFilter, setShowSoldByFilter] = useState(true)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const [productSystemOptions, setProductSystemOptions] = useState({
    series: [],
    model: [],
    make: [],
    manufacturer: [],
    soldBy: [],
  })

  // State for expandable category tree
  const [expandedCategories, setExpandedCategories] = useState({})
  const [allSubcategories, setAllSubcategories] = useState([])

  // Subcategory slider state
  const subCategorySliderRef = useRef(null)
  const [subCategoryScrollState, setSubCategoryScrollState] = useState({
    canScrollPrev: false,
    canScrollNext: false
  })

  // Brand slider state
  const brandSliderRef = useRef(null)
  const [brandScrollState, setBrandScrollState] = useState({
    canScrollPrev: false,
    canScrollNext: false
  })

  const [productsToShow, setProductsToShow] = useState(15)
  const [delayedLoading, setDelayedLoading] = useState(false)
  const fetchTimeout = useRef()
  const loadingTimeout = useRef()
  const allProductsRef = useRef([])
  const filterRunIdRef = useRef(0)
  const isHybridCacheReadyRef = useRef(false)
  const isHydratingHybridCacheRef = useRef(false)

  const findCategoryByUrlIdentifier = (identifier) => {
    if (!identifier || identifier === "all") return null

    const rawIdentifier = String(identifier).trim()
    if (!rawIdentifier) return null
    const normalizedIdentifier = createSlug(rawIdentifier)

    return (
      categories.find((cat) => {
        if (!cat) return false
        const categoryId = String(cat._id || "").trim()
        const categorySlug = String(cat.slug || "").trim()
        const categoryName = String(cat.name || "").trim()

        return (
          categoryId === rawIdentifier ||
          categorySlug === rawIdentifier ||
          createSlug(categoryId) === normalizedIdentifier ||
          createSlug(categorySlug) === normalizedIdentifier ||
          createSlug(categoryName) === normalizedIdentifier
        )
      }) || null
    )
  }

  const findSubcategoryByUrlIdentifier = (identifier, subcategoryPool = allSubcategories) => {
    if (!identifier) return null

    const rawIdentifier = String(identifier).trim()
    if (!rawIdentifier) return null
    const normalizedIdentifier = createSlug(rawIdentifier)

    return (
      subcategoryPool.find((sub) => {
        if (!sub) return false
        const subId = String(sub._id || "").trim()
        const subSlug = String(sub.slug || "").trim()
        const subName = String(sub.name || "").trim()

        return (
          subId === rawIdentifier ||
          subSlug === rawIdentifier ||
          createSlug(subId) === normalizedIdentifier ||
          createSlug(subSlug) === normalizedIdentifier ||
          createSlug(subName) === normalizedIdentifier
        )
      }) || null
    )
  }

  const getEffectiveProductPrice = (product) => {
    const offerPrice = Number(product?.offerPrice) || 0
    const regularPrice = Number(product?.price) || 0
    return offerPrice > 0 ? offerPrice : regularPrice
  }

  const getActiveStockStatusFilters = () => {
    const activeFilters = []
    if (stockFilters.inStock) activeFilters.push("inStock")
    if (stockFilters.outOfStock) activeFilters.push("outOfStock")
    if (stockFilters.onSale) activeFilters.push("onSale")
    return activeFilters
  }

  const buildProductFilters = (includePriceRange = true) => {
    const stockStatusFilters = getActiveStockStatusFilters()
    const urlParams = parseShopURL(location.pathname, location.search)
    const urlCategory = findCategoryByUrlIdentifier(urlParams.parentCategory)
    const hasUrlParent = Boolean(urlParams.parentCategory && urlParams.parentCategory !== "all")
    const hasUrlLevel1 = Boolean(urlParams.subcategory)
    const hasUrlLevel2 = Boolean(urlParams.subcategory2)
    const hasUrlLevel3 = Boolean(urlParams.subcategory3)
    const hasUrlLevel4 = Boolean(urlParams.subcategory4)

    const pathParts = [urlParams.subcategory, urlParams.subcategory2, urlParams.subcategory3, urlParams.subcategory4]
    let resolvedPath = []
    let resolvedParentCategoryFromPath = urlCategory?._id || null

    if (pathParts.some(Boolean) && allSubcategories.length > 0) {
      if (resolvedParentCategoryFromPath) {
        resolvedPath = resolveSubcategoryPath(resolvedParentCategoryFromPath, pathParts)
      }

      if (!resolvedParentCategoryFromPath || resolvedPath.length === 0) {
        const fallbackParts = [urlParams.parentCategory, ...pathParts].filter(Boolean)
        const fallbackResolvedPath = resolveSubcategoryPathFromAny(fallbackParts)
        if (fallbackResolvedPath.length > 0) {
          resolvedPath = fallbackResolvedPath
          resolvedParentCategoryFromPath = getSubcategoryCategoryId(fallbackResolvedPath[0]) || resolvedParentCategoryFromPath
        }
      }
    }

    const resolvedParentCategory = hasUrlParent
      ? resolvedParentCategoryFromPath || urlParams.parentCategory
      : selectedCategory !== "all"
        ? selectedCategory
        : null

    const resolvedLevel1 = hasUrlLevel1
      ? resolvedPath[0]?._id || urlParams.subcategory
      : selectedSubCategories.length > 0
        ? selectedSubCategories[0]
        : null
    const resolvedLevel2 = hasUrlLevel2
      ? resolvedPath[1]?._id || urlParams.subcategory2
      : selectedSubCategory2 || null
    const resolvedLevel3 = hasUrlLevel3
      ? resolvedPath[2]?._id || urlParams.subcategory3
      : selectedSubCategory3 || null
    const resolvedLevel4 = hasUrlLevel4
      ? resolvedPath[3]?._id || urlParams.subcategory4
      : selectedSubCategory4 || null

    return {
      parent_category: resolvedParentCategory,
      category: resolvedLevel1,
      subcategory2: resolvedLevel2,
      subcategory3: resolvedLevel3,
      subcategory4: resolvedLevel4,
      brand: selectedBrands.length > 0 ? selectedBrands : null,
      series: selectedSeries.length > 0 ? selectedSeries : null,
      model: selectedModels.length > 0 ? selectedModels : null,
      make: selectedMakes.length > 0 ? selectedMakes : null,
      manufacturer: selectedManufacturers.length > 0 ? selectedManufacturers : null,
      soldBy: selectedSoldBy.length > 0 ? selectedSoldBy : null,
      search: null,
      priceRange: includePriceRange && isPriceFilterApplied ? priceRange : null,
      stockStatus: stockStatusFilters.length > 0 ? stockStatusFilters : null,
      sortBy: effectiveSortBy,
    }
  }

  const buildShopQueryParams = () => {
    const filters = buildProductFilters(true)
    const queryParams = {
      page: 1,
      // The grid shows 15 and adds 15 per "Load More", and this first page is only in play
      // until the background cache hydration replaces it with the full filtered list. Ask
      // for the endpoint's maximum so a shopper clicking "Load More" during that second or
      // two cannot run off the end and be told the category holds nothing more.
      limit: 120,
      sortBy: filters.sortBy || "newest",
    }

    if (filters.parent_category) queryParams.parent_category = filters.parent_category
    if (filters.category) queryParams.category = filters.category
    if (filters.subcategory2) queryParams.subcategory2 = filters.subcategory2
    if (filters.subcategory3) queryParams.subcategory3 = filters.subcategory3
    if (filters.subcategory4) queryParams.subcategory4 = filters.subcategory4
    if (Array.isArray(filters.brand) && filters.brand.length > 0) queryParams.brand = filters.brand
    if (Array.isArray(filters.series) && filters.series.length > 0) queryParams.series = filters.series
    if (Array.isArray(filters.model) && filters.model.length > 0) queryParams.model = filters.model
    if (Array.isArray(filters.make) && filters.make.length > 0) queryParams.make = filters.make
    if (Array.isArray(filters.manufacturer) && filters.manufacturer.length > 0) queryParams.manufacturer = filters.manufacturer
    if (Array.isArray(filters.soldBy) && filters.soldBy.length > 0) queryParams.soldBy = filters.soldBy
    if (Array.isArray(filters.stockStatus) && filters.stockStatus.length > 0) queryParams.stockStatus = filters.stockStatus
    if (searchQuery && searchQuery.trim()) queryParams.search = searchQuery.trim()

    if (Array.isArray(filters.priceRange) && filters.priceRange.length === 2 && isPriceFilterApplied) {
      const [priceMin, priceMax] = filters.priceRange
      if (Number.isFinite(Number(priceMin))) queryParams.priceMin = Number(priceMin)
      if (Number.isFinite(Number(priceMax))) queryParams.priceMax = Number(priceMax)
    }

    return queryParams
  }

  const syncAvailablePriceBounds = () => {
    setMinPrice(PRICE_FILTER_MIN)
    setMaxPrice(PRICE_FILTER_MAX)
  }

  const handlePriceApply = (range) => {
    const inputMin = Number(range?.[0])
    const inputMax = Number(range?.[1])

    const nextMin = Number.isFinite(inputMin) ? Math.max(0, inputMin) : 0
    const nextMax = Number.isFinite(inputMax) ? Math.max(nextMin, inputMax) : Number.POSITIVE_INFINITY

    const nextRange = [nextMin, nextMax]
    const isDefaultRange = nextMin === DEFAULT_PRICE_RANGE[0] && !Number.isFinite(nextMax)

    setPriceRange(nextRange)
    setIsPriceFilterApplied(!isDefaultRange)
    setPriceFilterApplyCount((count) => count + 1)
  }

  const resetPriceFilter = () => {
    setPriceRange(DEFAULT_PRICE_RANGE)
    setIsPriceFilterApplied(false)
    setPriceFilterApplyCount((count) => count + 1)
  }

  // Preload translations for categories, subcategories, and brands when language is Arabic
  useEffect(() => {
    if (currentLanguage.code === 'ar') {
      const textsToTranslate = []
      
      // Collect category names
      if (categories.length > 0) {
        categories.forEach(cat => {
          if (cat.name) textsToTranslate.push(cat.name)
        })
      }
      
      // Collect subcategory names
      if (subCategories.length > 0) {
        subCategories.forEach(sub => {
          if (sub.name) textsToTranslate.push(sub.name)
        })
      }
      
      // Collect brand names
      if (brands.length > 0) {
        brands.forEach(brand => {
          if (brand.name) textsToTranslate.push(brand.name)
        })
      }

      PRODUCT_SYSTEM_FILTERS.forEach(({ key }) => {
        const options = productSystemOptions[key] || []
        options.forEach((option) => {
          if (option?.name) textsToTranslate.push(option.name)
        })
      })
      
      // Preload all translations in one batch
      if (textsToTranslate.length > 0) {
        console.log(`[Shop] Preloading ${textsToTranslate.length} translations`)
        preloadTranslations(textsToTranslate, 'ar')
      }
    }
  }, [categories, subCategories, brands, productSystemOptions, currentLanguage.code])

  // Progressive search function
  // Subcategory slider handlers
  const updateSubCategoryScrollState = () => {
    const container = subCategorySliderRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    setSubCategoryScrollState({
      canScrollPrev: scrollLeft > 0,
      canScrollNext: scrollLeft < scrollWidth - clientWidth - 1
    })
  }

  const scrollSubCategoryPrev = () => {
    if (subCategorySliderRef.current) {
      subCategorySliderRef.current.scrollBy({ left: -300, behavior: 'smooth' })
    }
  }

  const scrollSubCategoryNext = () => {
    if (subCategorySliderRef.current) {
      subCategorySliderRef.current.scrollBy({ left: 300, behavior: 'smooth' })
    }
  }

  // Brand slider handlers
  const updateBrandScrollState = () => {
    const container = brandSliderRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    setBrandScrollState({
      canScrollPrev: scrollLeft > 0,
      canScrollNext: scrollLeft < scrollWidth - clientWidth - 1
    })
  }

  const scrollBrandPrev = () => {
    if (brandSliderRef.current) {
      brandSliderRef.current.scrollBy({ left: -300, behavior: 'smooth' })
    }
  }

  const scrollBrandNext = () => {
    if (brandSliderRef.current) {
      brandSliderRef.current.scrollBy({ left: 300, behavior: 'smooth' })
    }
  }

  const performProgressiveSearch = async (
    searchTerm,
    productsSource = null,
    includePriceRange = true,
    precomputedFilters = null,
    runId = null,
  ) => {
    const isStaleRun = () => runId != null && runId !== filterRunIdRef.current

    if (isStaleRun()) return []
    if (!searchTerm || searchTerm.trim() === "") {
      if (isStaleRun()) return []
      setActualSearchQuery("")
      return []
    }

    let allProducts = Array.isArray(productsSource) ? productsSource : allProductsRef.current
    if (!Array.isArray(allProducts) || allProducts.length === 0) {
      try {
        allProducts = await productCache.getProducts()
        if (isStaleRun()) return []
        allProductsRef.current = allProducts || []
      } catch (err) {
        console.error("Error loading products for search:", err)
        return []
      }
    }

    if (allProducts.length === 0) {
      return []
    }

    // Build the non-search filtered list once, then only apply text matching progressively.
    // This avoids repeatedly sorting/filtering the full product array on every candidate term.
    const { search: _skipSearch, ...nonSearchFilters } = precomputedFilters || buildProductFilters(includePriceRange)

    const baseFilteredProducts = productCache.filterProducts(allProducts, nonSearchFilters)
    if (!baseFilteredProducts.length) {
      if (isStaleRun()) return []
      setActualSearchQuery(searchTerm)
      return []
    }

    // Scored with the same rules as the server search (scoreSearchRelevance), so the
    // offline path cannot answer "Keyboard" with a laptop whose spec list mentions one.
    const matchAndRank = (term) => {
      const normalized = String(term || "").toLowerCase().trim()
      if (!normalized) return []
      const termWords = normalized.split(/\s+/).filter(Boolean)

      return baseFilteredProducts
        .map((product) => ({ product, relevance: scoreSearchRelevance(product, normalized, termWords) }))
        .filter((entry) => entry.relevance !== null)
        .sort((a, b) => b.relevance - a.relevance || new Date(b.product.createdAt) - new Date(a.product.createdAt))
        .map((entry) => entry.product)
    }

    const words = searchTerm.trim().split(/\s+/)

    for (let i = words.length; i > 0; i--) {
      const currentSearchTerm = words.slice(0, i).join(" ")
      const filteredProducts = matchAndRank(currentSearchTerm)
      if (filteredProducts.length > 0) {
        if (isStaleRun()) return []
        setActualSearchQuery(currentSearchTerm)
        return filteredProducts
      }
    }

    const trimmed = searchTerm.trim()
    for (let len = trimmed.length - 1; len >= 3; len--) {
      const currentSearchTerm = trimmed.slice(0, len)
      const filteredProducts = matchAndRank(currentSearchTerm)
      if (filteredProducts.length > 0) {
        if (isStaleRun()) return []
        setActualSearchQuery(currentSearchTerm)
        return filteredProducts
      }
    }

    if (isStaleRun()) return []
    setActualSearchQuery(searchTerm)
    return []
  }

  const loadAndFilterProducts = async (existingRunId = null) => {
    const runId = existingRunId || ++filterRunIdRef.current
    const isStaleRun = () => runId !== filterRunIdRef.current
    const shouldManageLoading = existingRunId == null

    try {
      if (isStaleRun()) return
      if (shouldManageLoading) setLoading(true)
      setError(null)

      const allProducts = await productCache.getProducts()
      if (isStaleRun()) return
      allProductsRef.current = allProducts || []

      if (!allProducts || allProducts.length === 0) {
        if (isStaleRun()) return
        setError("No products available")
        return
      }

      const filtersWithoutPrice = buildProductFilters(false)
      const filtersWithPrice = buildProductFilters(true)
      let filteredProducts = []

      if (searchQuery && searchQuery.trim() !== "") {
        const availableProducts = await performProgressiveSearch(
          searchQuery,
          allProducts,
          false,
          filtersWithoutPrice,
          runId,
        )
        if (isStaleRun()) return
        syncAvailablePriceBounds(availableProducts)
        filteredProducts = await performProgressiveSearch(
          searchQuery,
          allProducts,
          true,
          filtersWithPrice,
          runId,
        )
        if (isStaleRun()) return
      } else {
        if (isStaleRun()) return
        setActualSearchQuery("")
        const availableProducts = productCache.filterProducts(allProducts, filtersWithoutPrice)
        syncAvailablePriceBounds(availableProducts)
        filteredProducts = productCache.filterProducts(allProducts, filtersWithPrice)
      }

      if (isStaleRun()) return
      setProducts(filteredProducts)
      // The cache holds the whole catalogue, so the filtered list *is* the match count.
      setMatchCount(filteredProducts.length)
    } catch (err) {
      if (isStaleRun()) return
      setError("Error loading products")
    } finally {
      if (shouldManageLoading && !isStaleRun()) {
        setLoading(false)
      }
    }
  }

  const fetchProductsFromShopQuery = async (existingRunId = null) => {
    const runId = existingRunId || ++filterRunIdRef.current
    const isStaleRun = () => runId !== filterRunIdRef.current
    const shouldManageLoading = existingRunId == null

    try {
      if (isStaleRun()) return
      if (shouldManageLoading) setLoading(true)
      setError(null)

      const queryParams = buildShopQueryParams()
      const { data } = await axios.get(`${API_BASE_URL}/api/products/shop-query`, {
        params: queryParams,
        paramsSerializer: {
          indexes: false,
        },
      })

      if (isStaleRun()) return
      const nextProducts = Array.isArray(data?.products) ? data.products : []
      setActualSearchQuery(searchQuery && searchQuery.trim() ? searchQuery.trim() : "")
      setProducts(nextProducts)
      // The server knows the full match count even though it only sent one page of it.
      setMatchCount(Number.isFinite(data?.totalCount) ? data.totalCount : nextProducts.length)
      syncAvailablePriceBounds(nextProducts)
    } catch (err) {
      if (isStaleRun()) return
      await filterProductsFromCache()
    } finally {
      if (shouldManageLoading && !isStaleRun()) {
        setLoading(false)
      }
    }
  }

  const hydrateHybridCacheInBackground = async () => {
    if (isHydratingHybridCacheRef.current || isHybridCacheReadyRef.current) return
    isHydratingHybridCacheRef.current = true

    try {
      const allProducts = await productCache.getProducts()
      allProductsRef.current = allProducts || []
      isHybridCacheReadyRef.current = Array.isArray(allProducts) && allProducts.length > 0
      if (isHybridCacheReadyRef.current) {
        await filterProductsFromCache()
      }
    } catch (error) {
      // Keep server-first mode active; cache hydration can retry on next interaction.
    } finally {
      isHydratingHybridCacheRef.current = false
    }
  }

  const filterProductsFromCache = async () => {
    const runId = ++filterRunIdRef.current
    const isStaleRun = () => runId !== filterRunIdRef.current

    try {
      setLoading(true)
      let allProducts = allProductsRef.current
      if (!Array.isArray(allProducts) || allProducts.length === 0) {
        allProducts = await productCache.getProducts()
        if (isStaleRun()) return
        allProductsRef.current = allProducts || []
      }

      if (!allProducts || allProducts.length === 0) {
        await loadAndFilterProducts(runId)
        return
      }

      const filtersWithoutPrice = buildProductFilters(false)
      const filtersWithPrice = buildProductFilters(true)
      let filteredProducts = []

      if (searchQuery && searchQuery.trim() !== "") {
        const availableProducts = await performProgressiveSearch(
          searchQuery,
          allProducts,
          false,
          filtersWithoutPrice,
          runId,
        )
        if (isStaleRun()) return
        syncAvailablePriceBounds(availableProducts)
        filteredProducts = await performProgressiveSearch(
          searchQuery,
          allProducts,
          true,
          filtersWithPrice,
          runId,
        )
        if (isStaleRun()) return
      } else {
        if (isStaleRun()) return
        setActualSearchQuery("")
        const availableProducts = productCache.filterProducts(allProducts, filtersWithoutPrice)
        syncAvailablePriceBounds(availableProducts)
        filteredProducts = productCache.filterProducts(allProducts, filtersWithPrice)
      }

      if (isStaleRun()) return
      setProducts(filteredProducts)
      // The cache holds the whole catalogue, so the filtered list *is* the match count.
      setMatchCount(filteredProducts.length)
    } catch (err) {
      if (isStaleRun()) return
      await loadAndFilterProducts(runId)
    } finally {
      if (!isStaleRun()) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchCategories()
    fetchBrands()
    fetchProductSystemOptions()
    fetchBanners()
    fetchAllSubcategories()
    if (SHOP_HYBRID_BOOTSTRAP_ENABLED) {
      fetchProductsFromShopQuery()
      hydrateHybridCacheInBackground()
      return
    }
    loadAndFilterProducts()
  }, [])

  useEffect(() => {
    if (fetchTimeout.current) clearTimeout(fetchTimeout.current)

    fetchTimeout.current = setTimeout(() => {
      if (SHOP_HYBRID_BOOTSTRAP_ENABLED && !isHybridCacheReadyRef.current) {
        fetchProductsFromShopQuery()
        hydrateHybridCacheInBackground()
        return
      }
      filterProductsFromCache()
    }, 100)
    return () => {
      clearTimeout(fetchTimeout.current)
    }
  }, [
    location.pathname,
    location.search,
    selectedCategory,
    selectedBrands,
    selectedSeries,
    selectedModels,
    selectedMakes,
    selectedManufacturers,
    selectedSoldBy,
    searchQuery,
    priceFilterApplyCount,
    selectedSubCategories,
    selectedSubCategory2,
    selectedSubCategory3,
    selectedSubCategory4,
    stockFilters,
    effectiveSortBy,
  ])

  useEffect(() => {
    // Parse URL when location changes or categories load
    if (categories.length === 0) return
    
    const urlParams = parseShopURL(location.pathname, location.search)
    const foundCategory = findCategoryByUrlIdentifier(urlParams.parentCategory)
    const newCategory = foundCategory ? foundCategory._id : "all"
    
    // Only update if different to prevent loops
    if (newCategory !== selectedCategory) {
      setSelectedCategory(newCategory)
      setSelectedSubCategories([])
      setSelectedSubCategory2(null)
      setSelectedSubCategory3(null)
      setSelectedSubCategory4(null)
      setCurrentSubCategoryName(null)
      setCurrentSubCategory2Name(null)
      setCurrentSubCategory3Name(null)
      setCurrentSubCategory4Name(null)
    }
  }, [categories, location.pathname, location.search])

  useEffect(() => {
    if (selectedCategory && selectedCategory !== "all") {
      fetchSubCategories()
    } else {
      setSubCategories([])
      setSelectedSubCategories([])
    }
  }, [selectedCategory])

  useEffect(() => {
    // Parse URL and set subcategories after allSubcategories are loaded
    if (allSubcategories.length === 0) return
    if (categories.length === 0) return
    
    const urlParams = parseShopURL(location.pathname, location.search)
    console.log("🔗 URL Parsing - Subcategories:", { 
      pathname: location.pathname, 
      urlParams, 
      allSubcategoriesCount: allSubcategories.length 
    })

    const foundCategory = findCategoryByUrlIdentifier(urlParams.parentCategory)
    let parentCategoryId = foundCategory ? foundCategory._id : null

    const pathParts = [
      urlParams.subcategory,
      urlParams.subcategory2,
      urlParams.subcategory3,
      urlParams.subcategory4,
    ]
    let resolvedPath = parentCategoryId ? resolveSubcategoryPath(parentCategoryId, pathParts) : []

    if (pathParts.some(Boolean) && (!parentCategoryId || resolvedPath.length === 0)) {
      const fallbackParts = [urlParams.parentCategory, ...pathParts].filter(Boolean)
      const fallbackResolvedPath = resolveSubcategoryPathFromAny(fallbackParts)

      if (fallbackResolvedPath.length > 0) {
        resolvedPath = fallbackResolvedPath
        parentCategoryId = getSubcategoryCategoryId(fallbackResolvedPath[0]) || parentCategoryId
      } else if (!parentCategoryId && urlParams.parentCategory) {
        const possibleLevel1 = findSubcategoryByUrlIdentifier(urlParams.parentCategory)
        if (possibleLevel1) {
          resolvedPath = [possibleLevel1]
          parentCategoryId = getSubcategoryCategoryId(possibleLevel1) || parentCategoryId
        }
      }
    }

    if (parentCategoryId && selectedCategory !== parentCategoryId) {
      setSelectedCategory(parentCategoryId)
    }
    const level1 = resolvedPath[0] || null
    const level2 = resolvedPath[1] || null
    const level3 = resolvedPath[2] || null
    const level4 = resolvedPath[3] || null

    if (pathParts.some(Boolean)) {
      console.log("[Shop] URL category resolution:", {
        pathParts,
        resolvedPath: resolvedPath.map((item) => ({
          _id: item?._id,
          name: item?.name,
          slug: item?.slug,
        })),
      })
    }

    if (level1) {
      setCurrentSubCategoryName(level1.name)
      setSelectedSubCategories([level1._id])
    } else {
      setSelectedSubCategories([])
      setCurrentSubCategoryName(null)
    }

    if (level2) {
      setSelectedSubCategory2(level2._id)
      setSubCategory2Data(level2)
      setCurrentSubCategory2Name(level2.name)
    } else {
      setSelectedSubCategory2(null)
      setSubCategory2Data(null)
      setCurrentSubCategory2Name(null)
    }

    if (level3) {
      setSelectedSubCategory3(level3._id)
      setSubCategory3Data(level3)
      setCurrentSubCategory3Name(level3.name)
    } else {
      setSelectedSubCategory3(null)
      setSubCategory3Data(null)
      setCurrentSubCategory3Name(null)
    }

    if (level4) {
      setSelectedSubCategory4(level4._id)
      setSubCategory4Data(level4)
      setCurrentSubCategory4Name(level4.name)
    } else {
      setSelectedSubCategory4(null)
      setSubCategory4Data(null)
      setCurrentSubCategory4Name(null)
    }
  }, [allSubcategories, categories, location.pathname, location.search])

  useEffect(() => {
    // Parse URL when location changes or brands load
    if (brands.length === 0) return
    
    const urlParams = parseShopURL(location.pathname, location.search)
    if (urlParams.brand) {
      const foundBrand = brands.find(
        (brand) => brand.name === urlParams.brand || createSlug(brand.name) === createSlug(urlParams.brand),
      )
      const newBrands = foundBrand ? [foundBrand._id] : []
      // Only update if different to prevent loops
      const currentBrandsStr = JSON.stringify([...selectedBrands].sort())
      const newBrandsStr = JSON.stringify([...newBrands].sort())
      if (currentBrandsStr !== newBrandsStr) {
        setSelectedBrands(newBrands)
      }
    } else {
      // Only clear if there's actually something to clear
      if (selectedBrands.length > 0) {
        setSelectedBrands([])
      }
    }
  }, [brands, location.pathname, location.search, selectedBrands])

  useEffect(() => {
    // Parse search query from URL
    const urlParams = parseShopURL(location.pathname, location.search)
    const newSearch = urlParams.search || ""
    if (newSearch !== searchQuery) {
      setSearchQuery(newSearch)
    }
  }, [location.pathname, location.search])

  useEffect(() => {
    if (categories.length > 0) {
      console.log(
        "All loaded categories:",
        categories.map((c) => ({ name: c.name, slug: c.slug, _id: c._id })),
      )
    }
  }, [categories])

  useEffect(() => {
    if (subCategories.length > 0) {
      console.log(
        "All loaded subcategories:",
        subCategories.map((s) => ({ name: s.name, slug: s.slug, _id: s._id })),
      )
    }
  }, [subCategories])

  useEffect(() => {
    setProductsToShow(15)
  }, [selectedCategory, selectedBrands, searchQuery, priceFilterApplyCount, selectedSubCategories, stockFilters, products.length])

  // Update subcategory slider scroll state on mount and when content changes
  useEffect(() => {
    const container = subCategorySliderRef.current
    if (!container) return

    // Initial update
    updateSubCategoryScrollState()

    // Update on resize
    const resizeObserver = new ResizeObserver(() => {
      updateSubCategoryScrollState()
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [selectedCategory, selectedSubCategories, selectedSubCategory2, selectedSubCategory3, selectedSubCategory4])

  // Update brand slider scroll state when products change
  useEffect(() => {
    const container = brandSliderRef.current
    if (!container) return

    // Initial update
    updateBrandScrollState()

    // Update on resize
    const resizeObserver = new ResizeObserver(() => {
      updateBrandScrollState()
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [products])

  const fetchCategories = async () => {
    try {
      // Use cached category tree to eliminate redundant network fetches
      const data = await getCategoryTreeCached()

      const validCategories = (Array.isArray(data) ? data : []).filter((cat) => {
        const isValid =
          cat &&
          typeof cat === "object" &&
          cat.name &&
          typeof cat.name === "string" &&
          cat.name.trim() !== "" &&
          cat.isActive !== false &&
          !cat.isDeleted &&
          !cat.name.match(/^[0-9a-fA-F]{24}$/)

        return isValid
      })

      setCategories(validCategories)
    } catch (err) {
      // Handle error silently
    }
  }

  const fetchBrands = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/brands`)

      const validBrands = data.filter((brand) => {
        const isValid =
          brand &&
          typeof brand === "object" &&
          brand.name &&
          typeof brand.name === "string" &&
          brand.name.trim() !== "" &&
          brand.isActive !== false &&
          !brand.name.match(/^[0-9a-fA-F]{24}$/)

        return isValid
      })

      setBrands(validBrands)
    } catch (err) {
      // Handle error silently
    }
  }

  const fetchProductSystemOptions = async () => {
    try {
      const responses = await Promise.all(
        PRODUCT_SYSTEM_FILTERS.map(({ routeType }) => axios.get(`${API_BASE_URL}/api/product-system-options/${routeType}`)),
      )

      const nextOptions = PRODUCT_SYSTEM_FILTERS.reduce((acc, { key }, index) => {
        const list = Array.isArray(responses[index]?.data) ? responses[index].data : []
        acc[key] = list.filter((item) => item && item._id && item.isActive !== false)
        return acc
      }, {})

      setProductSystemOptions((prev) => ({ ...prev, ...nextOptions }))
    } catch (err) {
      // Handle error silently
    }
  }

  const fetchBanners = async () => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/banners`)
      setBanners(data)
    } catch (err) {
      // Handle error silently
    }
  }

  const fetchAllSubcategories = async () => {
    try {
      // Same again: 2 MB lighter, and the page fetches the SEO it needs by id.
      const { data } = await axios.get(`${API_BASE_URL}/api/subcategories?lite=1`)
      const validSubCategories = data.filter((subCat) => {
        const isValid =
          subCat &&
          typeof subCat === "object" &&
          subCat.name &&
          typeof subCat.name === "string" &&
          subCat.name.trim() !== "" &&
          subCat.isActive !== false &&
          !subCat.isDeleted &&
          !subCat.name.match(/^[0-9a-fA-F]{24}$/)
        return isValid
      })
      console.log('📁 All Subcategories loaded:', validSubCategories.length)
      console.log('Sample subcategory:', validSubCategories[0])
      setAllSubcategories(validSubCategories)
    } catch (err) {
      console.error('Error fetching subcategories:', err)
    }
  }

  const fetchSubCategories = async () => {
    try {
      const catObj = categories.find((cat) => cat._id === selectedCategory)
      if (!catObj) return

      const { data } = await axios.get(`${API_BASE_URL}/api/subcategories?category=${catObj._id}`)

      const validSubCategories = data.filter((subCat) => {
        const isValid =
          subCat &&
          typeof subCat === "object" &&
          subCat.name &&
          typeof subCat.name === "string" &&
          subCat.name.trim() !== "" &&
          subCat.isActive !== false &&
          !subCat.isDeleted &&
          !subCat.name.match(/^[0-9a-fA-F]{24}$/)

        return isValid
      })

      setSubCategories(validSubCategories)
    } catch (err) {
    // Handle error silently
    }
  }

  const buildFilterOptionScopeProducts = () => {
    const allProducts = Array.isArray(allProductsRef.current) && allProductsRef.current.length > 0
      ? allProductsRef.current
      : products
    if (!Array.isArray(allProducts) || allProducts.length === 0) return []

    const scopedFilters = buildProductFilters(false)
    // Keep sidebar option lists stable across brand/product-system/stock/price/search selections.
    scopedFilters.brand = null
    scopedFilters.series = null
    scopedFilters.model = null
    scopedFilters.make = null
    scopedFilters.manufacturer = null
    scopedFilters.soldBy = null
    scopedFilters.stockStatus = null
    scopedFilters.priceRange = null
    scopedFilters.search = null
    scopedFilters.sortBy = null

    return productCache.filterProducts(allProducts, scopedFilters)
  }

  const scopedOptionProducts = buildFilterOptionScopeProducts()

  const brandsInProducts = new Set(
    scopedOptionProducts
      .map((product) => (typeof product.brand === "object" ? product.brand?._id : product.brand))
      .filter(Boolean),
  )

  const selectedBrandIds = new Set(selectedBrands)
  const availableBrands = brands.filter((brand) => brandsInProducts.has(brand._id) || selectedBrandIds.has(brand._id))

  // Apply search filter on available brands
  const filteredBrands = availableBrands.filter((brand) => brand.name.toLowerCase().includes(brandSearch.toLowerCase()))

  function normalizeRefId(value) {
    if (value == null) return null
    const resolved = typeof value === "object" ? value?._id : value
    if (resolved == null) return null
    const id = String(resolved).trim()
    if (!id) return null
    const lowered = id.toLowerCase()
    if (lowered === "null" || lowered === "undefined" || lowered === "none" || lowered === "n/a" || lowered === "na" || lowered === "-") {
      return null
    }
    return id
  }

  function getProductSystemFieldId(product, key) {
    if (!product) return null
    return normalizeRefId(product[key])
  }

  function getOptionNameById(optionKey, optionId) {
    const options = productSystemOptions[optionKey] || []
    return options.find((item) => item._id === optionId)?.name || optionId
  }

  function buildAvailableProductSystemOptions(optionKey) {
    const allProducts = scopedOptionProducts
    const options = productSystemOptions[optionKey] || []
    if (allProducts.length === 0 || options.length === 0) return []

    const selectedIdsByOption = {
      series: selectedSeries,
      model: selectedModels,
      make: selectedMakes,
      manufacturer: selectedManufacturers,
      soldBy: selectedSoldBy,
    }
    const selectedIds = selectedIdsByOption[optionKey] || []
    const optionIdsInProducts = new Set(
      allProducts
        .map((product) => getProductSystemFieldId(product, optionKey))
        .filter(Boolean),
    )
    return options.filter((item) => optionIdsInProducts.has(item._id) || selectedIds.includes(item._id))
  }

  const availableSeries = buildAvailableProductSystemOptions("series")
  const availableModels = buildAvailableProductSystemOptions("model")
  const availableMakes = buildAvailableProductSystemOptions("make")
  const availableManufacturers = buildAvailableProductSystemOptions("manufacturer")
  const availableSoldBy = buildAvailableProductSystemOptions("soldBy")
  const showSeriesSection = availableSeries.length > 0 || selectedSeries.length > 0
  const showModelSection = availableModels.length > 0 || selectedModels.length > 0
  const showMakeSection = availableMakes.length > 0 || selectedMakes.length > 0
  const showManufacturerSection = availableManufacturers.length > 0 || selectedManufacturers.length > 0
  const showSoldBySection = availableSoldBy.length > 0 || selectedSoldBy.length > 0

  function getSubcategoryCategoryId(sub) {
    if (!sub) return null
    return normalizeRefId(sub.category)
  }

  function getSubcategoryParentId(sub) {
    if (!sub) return null
    return normalizeRefId(sub.parentSubCategory)
  }

  function getUrlIdentifier(item) {
    if (!item) return null
    return item.slug || item._id || item.name || null
  }

  function findBestMatchingSubcategory(subcategories, urlPart) {
    if (!Array.isArray(subcategories) || subcategories.length === 0 || !urlPart) return null
    const rawUrlPart = String(urlPart)
    const normalized = createSlug(rawUrlPart)
    const normalizedRef = normalizeRefId(rawUrlPart)
    return (
      subcategories.find((sub) => normalizeRefId(sub?._id) === normalizedRef) ||
      subcategories.find((sub) => createSlug(sub?.slug || "") === normalized) ||
      subcategories.find((sub) => createSlug(sub?.name || "") === normalized) ||
      null
    )
  }

  function getSubcategoryById(id) {
    const normalizedId = normalizeRefId(id)
    if (!normalizedId) return null
    return allSubcategories.find((sub) => normalizeRefId(sub?._id) === normalizedId) || null
  }

  function getUrlMatchScore(sub, urlPart) {
    if (!sub || !urlPart) return 0
    const rawUrlPart = String(urlPart)
    const normalized = createSlug(rawUrlPart)
    const normalizedRef = normalizeRefId(rawUrlPart)
    if (normalizeRefId(sub?._id) === normalizedRef) return 3
    if (createSlug(sub?.slug || "") === normalized) return 2
    if (createSlug(sub?.name || "") === normalized) return 1
    return 0
  }

  function getSubcategoryDepth(sub) {
    if (!sub) return Number.MAX_SAFE_INTEGER
    let depth = 1
    let current = sub
    const visited = new Set()
    while (current) {
      const parentId = getSubcategoryParentId(current)
      if (!parentId || visited.has(parentId)) break
      visited.add(parentId)
      const parent = getSubcategoryById(parentId)
      if (!parent) break
      depth += 1
      current = parent
    }
    return depth
  }

  function getSubcategoryAncestry(sub) {
    if (!sub) return []
    const ancestry = []
    let current = sub
    const visited = new Set()
    while (current) {
      ancestry.unshift(current)
      const parentId = getSubcategoryParentId(current)
      if (!parentId || visited.has(parentId)) break
      visited.add(parentId)
      current = getSubcategoryById(parentId)
    }
    return ancestry
  }

  function resolveSubcategoryPath(categoryId, parts = []) {
    const normalizedCategoryId = normalizeRefId(categoryId)
    const normalizedParts = parts.filter(Boolean)
    if (!normalizedCategoryId || normalizedParts.length === 0) return []

    const categoryScopedSubs = allSubcategories.filter(
      (sub) => getSubcategoryCategoryId(sub) === normalizedCategoryId
    )
    if (categoryScopedSubs.length === 0) return []

    const firstPart = normalizedParts[0]
    const firstCandidates = categoryScopedSubs
      .filter((sub) => getUrlMatchScore(sub, firstPart) > 0)
      .sort((a, b) => {
        const scoreDiff = getUrlMatchScore(b, firstPart) - getUrlMatchScore(a, firstPart)
        if (scoreDiff !== 0) return scoreDiff
        return getSubcategoryDepth(a) - getSubcategoryDepth(b)
      })

    if (firstCandidates.length === 0) return []

    let bestChain = []

    for (const startNode of firstCandidates) {
      const chain = [startNode]
      let current = startNode

      for (let i = 1; i < normalizedParts.length; i++) {
        const part = normalizedParts[i]
        const currentId = normalizeRefId(current?._id)
        const children = categoryScopedSubs.filter((sub) => getSubcategoryParentId(sub) === currentId)
        const next = findBestMatchingSubcategory(children, part)
        if (!next) break
        chain.push(next)
        current = next
      }

      if (chain.length > bestChain.length) {
        bestChain = chain
      }
      if (chain.length === normalizedParts.length) {
        bestChain = chain
        break
      }
    }

    if (bestChain.length === 0) return []

    const ancestry = getSubcategoryAncestry(bestChain[0])
    const combined = [...ancestry]
    for (const node of bestChain.slice(1)) {
      const nodeId = normalizeRefId(node?._id)
      const alreadyIncluded = combined.some((item) => normalizeRefId(item?._id) === nodeId)
      if (!alreadyIncluded) combined.push(node)
    }
    return combined.slice(0, 4)
  }

  function resolveSubcategoryPathFromAny(parts = []) {
    const normalizedParts = parts.filter(Boolean)
    if (normalizedParts.length === 0) return []
    if (!Array.isArray(allSubcategories) || allSubcategories.length === 0) return []

    const firstPart = normalizedParts[0]
    const firstCandidates = allSubcategories
      .filter((sub) => getUrlMatchScore(sub, firstPart) > 0)
      .sort((a, b) => {
        const scoreDiff = getUrlMatchScore(b, firstPart) - getUrlMatchScore(a, firstPart)
        if (scoreDiff !== 0) return scoreDiff
        return getSubcategoryDepth(a) - getSubcategoryDepth(b)
      })

    if (firstCandidates.length === 0) return []

    let bestChain = []

    for (const startNode of firstCandidates) {
      const chain = [startNode]
      let current = startNode

      for (let i = 1; i < normalizedParts.length; i++) {
        const part = normalizedParts[i]
        const currentId = normalizeRefId(current?._id)
        const children = allSubcategories.filter((sub) => getSubcategoryParentId(sub) === currentId)
        const next = findBestMatchingSubcategory(children, part)
        if (!next) break
        chain.push(next)
        current = next
      }

      if (chain.length > bestChain.length) {
        bestChain = chain
      }
      if (chain.length === normalizedParts.length) {
        bestChain = chain
        break
      }
    }

    if (bestChain.length === 0) return []

    const ancestry = getSubcategoryAncestry(bestChain[0])
    const combined = [...ancestry]
    for (const node of bestChain.slice(1)) {
      const nodeId = normalizeRefId(node?._id)
      const alreadyIncluded = combined.some((item) => normalizeRefId(item?._id) === nodeId)
      if (!alreadyIncluded) combined.push(node)
    }
    return combined.slice(0, 4)
  }

  // Helper function to get children of a category/subcategory
  const getChildren = (parentId, parentType = 'category') => {
    if (!parentId || !allSubcategories || allSubcategories.length === 0) {
      return []
    }

    const children = allSubcategories.filter(sub => {
      if (!sub) return false
      
      const category = typeof sub.category === 'object' ? sub.category?._id : sub.category
      const parentSubCategory = typeof sub.parentSubCategory === 'object' ? sub.parentSubCategory?._id : sub.parentSubCategory
      
      if (parentType === 'category') {
        // For parent categories, get Level 1 subcategories (where category matches and parentSubCategory is null)
        const matches = category === parentId && !parentSubCategory
        return matches
      } else if (parentType === 'subcategory') {
        // For any subcategory level, get children where parentSubCategory matches
        const matches = parentSubCategory === parentId
        return matches
      }
      return false
    })
    
    if (children.length > 0) {
      console.log(`🌳 Found ${children.length} children for ${parentId} (type: ${parentType})`, children.map(c => c.name))
    }
    
    return children
  }

  // Toggle category expansion
  const toggleExpanded = (id) => {
    setExpandedCategories(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId)
    setSelectedSubCategories([])
    setSelectedSubCategory2(null)
    setSelectedSubCategory3(null)
    setSelectedSubCategory4(null)
    setCurrentSubCategoryName(null)
    setCurrentSubCategory2Name(null)
    setCurrentSubCategory3Name(null)
    setCurrentSubCategory4Name(null)

    const categoryObj = categories.find((cat) => cat._id === categoryId)
    const categoryIdentifier = categoryObj ? getUrlIdentifier(categoryObj) : categoryId

    const url = generateShopURL({
      parentCategory: categoryId !== "all" ? categoryIdentifier : null,
      brand: selectedBrands.length > 0 ? brands.find((b) => b._id === selectedBrands[0])?.name : null,
      search: searchQuery || null,
    })

    navigate(url)
  }

  // Unified handler for selecting any level of subcategory
  const handleSubcategorySelect = (subcatId, level) => {
    const subcatObj = allSubcategories.find((sub) => sub._id === subcatId)
    if (!subcatObj) return

    // Helper function to trace back the full hierarchy
    const traceHierarchy = (subcat) => {
      const hierarchy = {
        parentCategory: null,
        level1: null,
        level2: null,
        level3: null,
        level4: null,
      }

      let current = subcat
      let currentLevel = level

      // Set the current level
      if (currentLevel === 1) {
        hierarchy.level1 = current._id
      } else if (currentLevel === 2) {
        hierarchy.level2 = current._id
      } else if (currentLevel === 3) {
        hierarchy.level3 = current._id
      } else if (currentLevel === 4) {
        hierarchy.level4 = current._id
      }

      // Trace back through parentSubCategory
      while (current && current.parentSubCategory) {
        const parentId = typeof current.parentSubCategory === 'object' 
          ? current.parentSubCategory._id 
          : current.parentSubCategory
        
        const parent = allSubcategories.find(s => s._id === parentId)
        if (!parent) break

        currentLevel--
        if (currentLevel === 1) {
          hierarchy.level1 = parent._id
        } else if (currentLevel === 2) {
          hierarchy.level2 = parent._id
        } else if (currentLevel === 3) {
          hierarchy.level3 = parent._id
        }

        current = parent
      }

      // Get parent category from the top-level subcategory
      if (current && current.category) {
        hierarchy.parentCategory = typeof current.category === 'object' 
          ? current.category._id 
          : current.category
      }

      return hierarchy
    }

    // Get the complete hierarchy
    const hierarchy = traceHierarchy(subcatObj)

    // Update all states with the correct hierarchy
    setSelectedCategory(hierarchy.parentCategory || 'all')
    
    if (hierarchy.level1) {
      const level1Obj = allSubcategories.find(s => s._id === hierarchy.level1)
      setSelectedSubCategories([hierarchy.level1])
      setCurrentSubCategoryName(level1Obj?.name || null)
    } else {
      setSelectedSubCategories([])
      setCurrentSubCategoryName(null)
    }

    if (hierarchy.level2) {
      const level2Obj = allSubcategories.find(s => s._id === hierarchy.level2)
      setSelectedSubCategory2(hierarchy.level2)
      setSubCategory2Data(level2Obj || null)
      setCurrentSubCategory2Name(level2Obj?.name || null)
    } else {
      setSelectedSubCategory2(null)
      setSubCategory2Data(null)
      setCurrentSubCategory2Name(null)
    }

    if (hierarchy.level3) {
      const level3Obj = allSubcategories.find(s => s._id === hierarchy.level3)
      setSelectedSubCategory3(hierarchy.level3)
      setSubCategory3Data(level3Obj || null)
      setCurrentSubCategory3Name(level3Obj?.name || null)
    } else {
      setSelectedSubCategory3(null)
      setSubCategory3Data(null)
      setCurrentSubCategory3Name(null)
    }

    if (hierarchy.level4) {
      const level4Obj = allSubcategories.find(s => s._id === hierarchy.level4)
      setSelectedSubCategory4(hierarchy.level4)
      setSubCategory4Data(level4Obj || null)
      setCurrentSubCategory4Name(level4Obj?.name || null)
    } else {
      setSelectedSubCategory4(null)
      setSubCategory4Data(null)
      setCurrentSubCategory4Name(null)
    }

    // Update URL with full hierarchy (up to level 4) so deep links work consistently
    const categoryObj = categories.find((cat) => cat._id === hierarchy.parentCategory)
    const level1Identifier = hierarchy.level1
      ? getUrlIdentifier(allSubcategories.find((s) => s._id === hierarchy.level1))
      : null
    const level2Identifier = hierarchy.level2
      ? getUrlIdentifier(allSubcategories.find((s) => s._id === hierarchy.level2))
      : null
    const level3Identifier = hierarchy.level3
      ? getUrlIdentifier(allSubcategories.find((s) => s._id === hierarchy.level3))
      : null
    const level4Identifier = hierarchy.level4
      ? getUrlIdentifier(allSubcategories.find((s) => s._id === hierarchy.level4))
      : null

    const url = generateShopURL({
      parentCategory:
        hierarchy.parentCategory && hierarchy.parentCategory !== "all"
          ? getUrlIdentifier(categoryObj) || hierarchy.parentCategory
          : null,
      subcategory: level1Identifier,
      subcategory2: level2Identifier,
      subcategory3: level3Identifier,
      subcategory4: level4Identifier,
      brand: selectedBrands.length > 0 ? brands.find((b) => b._id === selectedBrands[0])?.name : null,
      search: searchQuery || null,
    })
    navigate(url)
  }

  const handleClearSubCategory = (level) => {
    if (level === 1) {
      handleCategoryChange(selectedCategory)
    } else if (level === 2) {
      if (selectedSubCategories.length > 0) {
        handleSubcategorySelect(selectedSubCategories[0], 1)
      } else {
        handleCategoryChange(selectedCategory)
      }
    } else if (level === 3) {
      if (selectedSubCategory2) {
        handleSubcategorySelect(selectedSubCategory2, 2)
      } else if (selectedSubCategories.length > 0) {
        handleSubcategorySelect(selectedSubCategories[0], 1)
      } else {
        handleCategoryChange(selectedCategory)
      }
    } else if (level === 4) {
      if (selectedSubCategory3) {
        handleSubcategorySelect(selectedSubCategory3, 3)
      } else if (selectedSubCategory2) {
        handleSubcategorySelect(selectedSubCategory2, 2)
      } else if (selectedSubCategories.length > 0) {
        handleSubcategorySelect(selectedSubCategories[0], 1)
      } else {
        handleCategoryChange(selectedCategory)
      }
    }
  }

  const handleSubCategoryChange = (subCatId) => {
    setSelectedSubCategories([subCatId])
    const subcatObj = subCategories.find((sub) => sub._id === subCatId)
    let parentId
    if (subcatObj) {
      parentId = typeof subcatObj.category === "object" ? subcatObj.category._id : subcatObj.category
    } else {
      parentId = selectedCategory
    }
    setSelectedCategory(parentId)

    const categoryObj = categories.find((cat) => cat._id === parentId)
    const subcategoryObj = subCategories.find((sub) => sub._id === subCatId)

    const categoryIdentifier = categoryObj ? getUrlIdentifier(categoryObj) : parentId
    const subcategoryIdentifier = subcategoryObj ? getUrlIdentifier(subcategoryObj) : subCatId

    const url = generateShopURL({
      parentCategory: parentId !== "all" ? categoryIdentifier : null,
      subcategory: subcategoryIdentifier,
      brand: selectedBrands.length > 0 ? brands.find((b) => b._id === selectedBrands[0])?.name : null,
      search: searchQuery || null,
    })

    console.log("handleSubCategoryChange called with:", { subCatId, parentId, subcatObj, url, subCategories })
    navigate(url)
  }

  const handleBrandChange = (brandId) => {
    // Calculate new brand selection FIRST before any state updates
    const newSelectedBrands = selectedBrands.includes(brandId)
      ? selectedBrands.filter((b) => b !== brandId)
      : [...selectedBrands, brandId]

    // Update state
    setSelectedBrands(newSelectedBrands)

    const categoryObj = categories.find((cat) => cat._id === selectedCategory)
    const subcategoryObj =
      selectedSubCategories.length > 0 ? subCategories.find((sub) => sub._id === selectedSubCategories[0]) : null
    
    // Preserve deeper subcategory levels
    const subcategory2Obj = selectedSubCategory2 ? allSubcategories.find((sub) => sub._id === selectedSubCategory2) : null
    const subcategory3Obj = selectedSubCategory3 ? allSubcategories.find((sub) => sub._id === selectedSubCategory3) : null
    const subcategory4Obj = selectedSubCategory4 ? allSubcategories.find((sub) => sub._id === selectedSubCategory4) : null

    const url = generateShopURL({
      parentCategory: selectedCategory !== "all" ? getUrlIdentifier(categoryObj) || selectedCategory : null,
      subcategory: getUrlIdentifier(subcategoryObj) || selectedSubCategories[0] || null,
      subcategory2: getUrlIdentifier(subcategory2Obj) || null,
      subcategory3: getUrlIdentifier(subcategory3Obj) || null,
      subcategory4: getUrlIdentifier(subcategory4Obj) || null,
      brand: newSelectedBrands.length > 0 ? brands.find((b) => b._id === newSelectedBrands[0])?.name : null,
      search: searchQuery || null,
    })

    navigate(url)
  }

  const toggleProductSystemSelection = (value, setter) => {
    setter((prev) => (prev.includes(value) ? prev.filter((id) => id !== value) : [...prev, value]))
  }

  const handleStockFilterChange = (key) => {
    setStockFilters((prev) => {
      const newState = { inStock: false, outOfStock: false, onSale: false }
      newState[key] = true
      return newState
    })
  }

  const handleAllProductsFilter = () => {
    setStockFilters({ inStock: false, outOfStock: false, onSale: false })
  }

  const handleSearchChange = (e) => {
    const newSearchQuery = e.target.value
    setSearchQuery(newSearchQuery)

    const categoryObj = categories.find((cat) => cat._id === selectedCategory)
    const subcategoryObj =
      selectedSubCategories.length > 0 ? subCategories.find((sub) => sub._id === selectedSubCategories[0]) : null
    
    // Preserve deeper subcategory levels
    const subcategory2Obj = selectedSubCategory2 ? allSubcategories.find((sub) => sub._id === selectedSubCategory2) : null
    const subcategory3Obj = selectedSubCategory3 ? allSubcategories.find((sub) => sub._id === selectedSubCategory3) : null
    const subcategory4Obj = selectedSubCategory4 ? allSubcategories.find((sub) => sub._id === selectedSubCategory4) : null

    const url = generateShopURL({
      parentCategory: selectedCategory !== "all" ? getUrlIdentifier(categoryObj) || selectedCategory : null,
      subcategory: getUrlIdentifier(subcategoryObj) || selectedSubCategories[0] || null,
      subcategory2: getUrlIdentifier(subcategory2Obj) || null,
      subcategory3: getUrlIdentifier(subcategory3Obj) || null,
      subcategory4: getUrlIdentifier(subcategory4Obj) || null,
      brand: selectedBrands.length > 0 ? brands.find((b) => b._id === selectedBrands[0])?.name : null,
      search: newSearchQuery || null,
    })

    navigate(url)
  }

  const clearAllFilters = () => {
    setSelectedCategory("all")
    setSelectedBrands([])
    setSelectedSeries([])
    setSelectedModels([])
    setSelectedMakes([])
    setSelectedManufacturers([])
    setSelectedSoldBy([])
    setSelectedSubCategories([])
    resetPriceFilter()
    setSearchQuery("")
    setActualSearchQuery("")
    setStockFilters({ inStock: false, outOfStock: false, onSale: false })
    navigate("/shop")
  }

  const renderProductSystemFilterSection = ({
    title,
    selectedValues,
    options,
    showFilter,
    setShowFilter,
    idPrefix,
    onToggle,
  }) => (
    <div className="border-b pb-4">
      <button
        onClick={() => setShowFilter(true)}
        className={`flex items-center justify-between w-full text-left font-medium ${
          selectedValues.length > 0 ? "text-lime-500" : "text-gray-900"
        }`}
      >
        <span className="flex items-center gap-2">
          <TranslatedText text={title} />
          {selectedValues.length > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-lime-500 rounded-full">
              {selectedValues.length}
            </span>
          )}
        </span>
        {showFilter ? <Minus size={16} /> : <ChevronDown size={16} />}
      </button>
      {showFilter && (
        <div className="mt-4 space-y-2">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {options.map((item) => (
              <div key={item._id} className="flex items-center">
                <input
                  type="checkbox"
                  id={`${idPrefix}-${item._id}`}
                  checked={selectedValues.includes(item._id)}
                  onChange={() => onToggle(item._id)}
                  className="w-4 h-4 text-lime-600 border-gray-300 rounded focus:ring-lime-500"
                />
                <label htmlFor={`${idPrefix}-${item._id}`} className="ml-2 text-sm text-gray-700 cursor-pointer">
                  <TranslatedText text={item.name} />
                </label>
              </div>
            ))}
            {options.length === 0 && (
              <p className="text-sm text-gray-500 italic">
                <TranslatedText text={`No ${title.toLowerCase()} found`} />
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (loading && products.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-3">
        <div className="w-9 h-9 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
        <span className="text-[11px] uppercase tracking-[0.2em] text-stone-400 font-medium">Loading Products</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-center">
          <p className="text-xl font-semibold mb-2">Error</p>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const selectedSubCategoryObj = subCategories.find((sub) => sub._id === selectedSubCategories[0])
  const formattedAppliedMaxPrice = Number.isFinite(priceRange[1]) ? priceRange[1] : INFINITY_SYMBOL

  const handleSortChange = (e) => {
    setSortBy(e.target.value)
    setSortExplicitlyChosen(true)
  }

  const rawCategoryObj = categories.find((cat) => cat._id === selectedCategory)
  const rawSubcategoryObj =
    selectedSubCategories.length > 0 ? subCategories.find((s) => s._id === selectedSubCategories[0]) : null
  const selectedBrandForSEO = selectedBrands.length === 1 ? brands.find((brand) => brand._id === selectedBrands[0]) : null

  // Determine which subcategory level to use for SEO (deepest level takes priority)
  const rawActiveSubcategory = subCategory4Data || subCategory3Data || subCategory2Data || rawSubcategoryObj

  // Put the fetched copy back on top of the lite record, so everything below
  // reads one object exactly as it did when the lists carried every field.
  const withSeo = (node) => (node ? { ...node, ...(seoDocs[node._id] || {}) } : node)
  const categoryObj = withSeo(rawCategoryObj)
  const subcategoryObj = withSeo(rawSubcategoryObj)
  const activeSubcategoryForSEO = withSeo(rawActiveSubcategory)

  const seoContent = activeSubcategoryForSEO?.seoContent || categoryObj?.seoContent || ""

  const brandMetaTitle = selectedBrandForSEO?.seoTitle || selectedBrandForSEO?.metaTitle || ""
  const brandMetaDescription = selectedBrandForSEO?.seoDescription || selectedBrandForSEO?.metaDescription || ""
  const customMetaTitle = brandMetaTitle || activeSubcategoryForSEO?.metaTitle || categoryObj?.metaTitle || ""
  const customMetaDescription = brandMetaDescription || activeSubcategoryForSEO?.metaDescription || categoryObj?.metaDescription || ""
  const customSchema = selectedBrandForSEO?.customSchema || activeSubcategoryForSEO?.customSchema || categoryObj?.customSchema || ""
  const seoKeywords = selectedBrandForSEO?.seoKeywords || ""
  const seoRobots = selectedBrandForSEO?.seoRobots || ""
  const ogTitle = selectedBrandForSEO?.ogTitle || ""
  const ogDescription = selectedBrandForSEO?.ogDescription || ""
  const ogImage = selectedBrandForSEO?.ogImage || selectedBrandForSEO?.logo || ""

  const buildCanonicalPath = () => {
    if (selectedBrandForSEO?.seoCanonicalUrl) {
      return selectedBrandForSEO.seoCanonicalUrl
    }

    if (selectedBrandForSEO) {
      const brandParam = selectedBrandForSEO.slug || selectedBrandForSEO.name
      const params = new URLSearchParams()
      params.set("brand", brandParam)
      return `${location.pathname || "/shop"}?${params.toString()}`
    }

    return location.pathname || "/shop"
  }

  const seoTitle =
    customMetaTitle ||
    (seoContent
      ? generateSEOTitle(activeSubcategoryForSEO?.name || categoryObj?.name || "", seoContent)
      : activeSubcategoryForSEO
        ? `${activeSubcategoryForSEO.name} — Shop`
        : categoryObj
          ? `${categoryObj.name} — Shop`
          : searchQuery?.trim()
            ? `Search: ${searchQuery.trim()} — Shop`
            : "Shop — Irhaas")

  const seoDescription =
    customMetaDescription ||
    (seoContent
      ? createMetaDescription(seoContent, 160)
      : activeSubcategoryForSEO
        ? `Browse ${activeSubcategoryForSEO.name} products at great prices.`
        : categoryObj
          ? `Explore top ${categoryObj.name} products.`
          : "Explore our catalog and find your next purchase at Irhaas.")

  const buildBreadcrumbPath = () => {
    const parts = [categoryObj?.name]
    if (currentSubCategoryName) parts.push(currentSubCategoryName)
    if (currentSubCategory2Name) parts.push(currentSubCategory2Name)
    if (currentSubCategory3Name) parts.push(currentSubCategory3Name)
    if (currentSubCategory4Name) parts.push(currentSubCategory4Name)
    return parts.filter(Boolean).join(" > ")
  }

  const breadcrumbPath = buildBreadcrumbPath()
  const showBreadcrumb = selectedSubCategory2 || selectedSubCategory3 || selectedSubCategory4

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonicalPath={buildCanonicalPath()}
        keywords={seoKeywords || undefined}
        robots={seoRobots || undefined}
        ogTitle={ogTitle || undefined}
        ogDescription={ogDescription || undefined}
        ogImage={ogImage || undefined}
        customSchema={customSchema}
      />
      <ProductSchema products={products} type="list" />
      
      {/* Mobile Filter Modal */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 md:hidden">
          <div className="fixed inset-y-0 left-0 w-full max-w-sm bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b z-10 px-4 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold"><TranslatedText>Filters</TranslatedText></h2>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 space-y-6">
              {/* Active Filters Section - Mobile */}
              {(selectedCategory !== "all" || 
                selectedSubCategories.length > 0 || 
                selectedSubCategory2 || 
                selectedSubCategory3 || 
                selectedSubCategory4 || 
                selectedBrands.length > 0 || 
                selectedSeries.length > 0 ||
                selectedModels.length > 0 ||
                selectedMakes.length > 0 ||
                selectedManufacturers.length > 0 ||
                selectedSoldBy.length > 0 ||
                stockFilters.inStock || 
                stockFilters.outOfStock || 
                stockFilters.onSale ||
                isPriceFilterApplied) && (
                <div className="border border-lime-200 rounded-lg p-4 bg-lime-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900"><TranslatedText>Active Filters</TranslatedText></h3>
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
                    >
                      <TranslatedText>Clear All</TranslatedText>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedCategory !== "all" && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Category</TranslatedText>:</span>{" "}
                          <TranslatedText text={categories.find((cat) => cat._id === selectedCategory)?.name || selectedCategory} />
                        </span>
                        <button
                          onClick={() => handleCategoryChange("all")}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {selectedSubCategories.length > 0 && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Subcategory</TranslatedText>:</span> <TranslatedText text={currentSubCategoryName} />
                        </span>
                        <button
                          onClick={() => handleClearSubCategory(1)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {selectedSubCategory2 && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Level 2</TranslatedText>:</span> <TranslatedText text={currentSubCategory2Name} />
                        </span>
                        <button
                          onClick={() => handleClearSubCategory(2)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {selectedSubCategory3 && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Level 3</TranslatedText>:</span> <TranslatedText text={currentSubCategory3Name} />
                        </span>
                        <button
                          onClick={() => handleClearSubCategory(3)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {selectedSubCategory4 && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Level 4</TranslatedText>:</span> <TranslatedText text={currentSubCategory4Name} />
                        </span>
                        <button
                          onClick={() => handleClearSubCategory(4)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {selectedBrands.map((brandId) => {
                      const brand = brands.find((b) => b._id === brandId)
                      return brand ? (
                        <div key={brandId} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                          <span className="text-gray-700">
                            <span className="font-semibold"><TranslatedText>Brand</TranslatedText>:</span> <TranslatedText text={brand.name} />
                          </span>
                          <button
                            onClick={() => handleBrandChange(brandId)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            ×
                          </button>
                        </div>
                      ) : null
                    })}
                    {selectedSeries.map((seriesId) => (
                      <div key={`series-mobile-${seriesId}`} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Series</TranslatedText>:</span>{" "}
                          <TranslatedText text={getOptionNameById("series", seriesId)} />
                        </span>
                        <button
                          onClick={() => toggleProductSystemSelection(seriesId, setSelectedSeries)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selectedModels.map((modelId) => (
                      <div key={`model-mobile-${modelId}`} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Model</TranslatedText>:</span>{" "}
                          <TranslatedText text={getOptionNameById("model", modelId)} />
                        </span>
                        <button
                          onClick={() => toggleProductSystemSelection(modelId, setSelectedModels)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selectedMakes.map((makeId) => (
                      <div key={`make-mobile-${makeId}`} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Make</TranslatedText>:</span>{" "}
                          <TranslatedText text={getOptionNameById("make", makeId)} />
                        </span>
                        <button
                          onClick={() => toggleProductSystemSelection(makeId, setSelectedMakes)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selectedManufacturers.map((manufacturerId) => (
                      <div key={`manufacturer-mobile-${manufacturerId}`} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Manufacturer</TranslatedText>:</span>{" "}
                          <TranslatedText text={getOptionNameById("manufacturer", manufacturerId)} />
                        </span>
                        <button
                          onClick={() => toggleProductSystemSelection(manufacturerId, setSelectedManufacturers)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selectedSoldBy.map((soldById) => (
                      <div key={`soldby-mobile-${soldById}`} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Sold By</TranslatedText>:</span>{" "}
                          <TranslatedText text={getOptionNameById("soldBy", soldById)} />
                        </span>
                        <button
                          onClick={() => toggleProductSystemSelection(soldById, setSelectedSoldBy)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {(isPriceFilterApplied) && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Price</TranslatedText>:</span> {formatCurrencyPrice(priceRange[0], isArabic)} - {formatCurrencyPrice(formattedAppliedMaxPrice, isArabic)}
                        </span>
                        <button
                          onClick={resetPriceFilter}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {stockFilters.inStock && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Stock</TranslatedText>:</span> <TranslatedText>In Stock</TranslatedText>
                        </span>
                        <button
                          onClick={() => setStockFilters({ inStock: false, outOfStock: false, onSale: false })}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {stockFilters.outOfStock && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Stock</TranslatedText>:</span> <TranslatedText>Out of Stock</TranslatedText>
                        </span>
                        <button
                          onClick={() => setStockFilters({ inStock: false, outOfStock: false, onSale: false })}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {stockFilters.onSale && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Stock</TranslatedText>:</span> <TranslatedText>On Sale</TranslatedText>
                        </span>
                        <button
                          onClick={() => setStockFilters({ inStock: false, outOfStock: false, onSale: false })}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Price Filter - Mobile */}
              <div className="border-b pb-4">
                <button
                  onClick={() => setShowPriceFilter(true)}
                  className={`flex items-center justify-between w-full text-left font-medium ${
                    isPriceFilterApplied
                      ? "text-lime-500"
                      : "text-gray-900"
                  }`}
                >
                  <TranslatedText>Price Range</TranslatedText>
                  {showPriceFilter ? <Minus size={16} /> : <ChevronDown size={16} />}
                </button>
                {showPriceFilter && (
                  <div className="mt-4 space-y-4">
                    <PriceFilter
                      min={minPrice}
                      max={maxPrice}
                      initialRange={priceRange}
                      isApplied={isPriceFilterApplied}
                      onApply={handlePriceApply}
                    />
                  </div>
                )}
              </div>

              {/* Categories Filter - Mobile */}
              <div className="border-b pb-4">
                <button
                  onClick={() => setShowCategoryFilter(true)}
                  className={`flex items-center justify-between w-full text-left font-medium ${
                    selectedCategory !== "all" || selectedSubCategories.length > 0 || selectedSubCategory2 || selectedSubCategory3 || selectedSubCategory4
                      ? "text-lime-500"
                      : "text-gray-900"
                  }`}
                >
                  <TranslatedText>Categories</TranslatedText>
                  {showCategoryFilter ? <Minus size={16} /> : <ChevronDown size={16} />}
                </button>
                {showCategoryFilter && (
                  <div className="mt-4 space-y-1">
                    <div className="flex items-center cursor-pointer py-1" onClick={() => handleCategoryChange("all")}>
                      <div className="relative flex items-center">
                        <input
                          type="radio"
                          name="category-group-mobile"
                          checked={selectedCategory === "all"}
                          readOnly
                          className="absolute opacity-0 w-0 h-0"
                        />
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                            selectedCategory === "all" ? "border-lime-600 bg-lime-600" : "border-gray-300"
                          }`}
                        >
                          {selectedCategory === "all" && <div className="w-2 h-2 rounded-full bg-white"></div>}
                        </div>
                      </div>
                      <span className="text-sm text-gray-700"><TranslatedText>All Categories</TranslatedText></span>
                    </div>

                    {categories.map((category) => {
                      const level1Children = getChildren(category._id, 'category')
                      const hasChildren = level1Children.length > 0
                      const isExpanded = expandedCategories[category._id]
                      const isSelected = selectedCategory === category._id

                      return (
                        <div key={category._id} className="space-y-1">
                          <div className="flex items-center justify-between py-1 group">
                            <div 
                              className="flex items-center cursor-pointer flex-1"
                              onClick={() => handleCategoryChange(category._id)}
                            >
                              <div className="relative flex items-center">
                                <input
                                  type="radio"
                                  name="category-group-mobile"
                                  checked={isSelected}
                                  readOnly
                                  className="absolute opacity-0 w-0 h-0"
                                />
                                <div
                                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                                    isSelected ? "border-lime-600 bg-lime-600" : "border-gray-300"
                                  }`}
                                >
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                </div>
                              </div>
                              <span className={`text-sm ${isSelected ? "text-lime-600 font-semibold" : "text-gray-700"}`}>
                                <TranslatedText text={category.name} />
                              </span>
                            </div>
                            {hasChildren && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpanded(category._id)
                                }}
                                className="p-1 hover:bg-gray-100 rounded ml-2"
                              >
                                {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
                              </button>
                            )}
                          </div>

                          {isExpanded && level1Children.map((level1) => {
                            const level2Children = getChildren(level1._id, 'subcategory')
                            const hasLevel2 = level2Children.length > 0
                            const isLevel1Expanded = expandedCategories[level1._id]
                            const isLevel1Selected = selectedSubCategories.includes(level1._id)

                            return (
                              <div key={level1._id} className="ml-6 space-y-1">
                                <div className="flex items-center justify-between py-1 group">
                                  <div
                                    className="flex items-center cursor-pointer flex-1"
                                    onClick={() => handleSubcategorySelect(level1._id, 1)}
                                  >
                                    <div className="relative flex items-center">
                                      <input
                                        type="radio"
                                        checked={isLevel1Selected}
                                        readOnly
                                        className="absolute opacity-0 w-0 h-0"
                                      />
                                      <div
                                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                                          isLevel1Selected ? "border-lime-600 bg-lime-600" : "border-gray-300"
                                        }`}
                                      >
                                        {isLevel1Selected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                      </div>
                                    </div>
                                    <span className={`text-sm ${isLevel1Selected ? "text-lime-600 font-semibold" : "text-gray-600"}`}>
                                      <TranslatedText text={level1.name} />
                                    </span>
                                  </div>
                                  {hasLevel2 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleExpanded(level1._id)
                                      }}
                                      className="p-1 hover:bg-gray-100 rounded ml-2"
                                    >
                                      {isLevel1Expanded ? <Minus size={14} /> : <Plus size={14} />}
                                    </button>
                                  )}
                                </div>

                                {isLevel1Expanded && level2Children.map((level2) => {
                                  const level3Children = getChildren(level2._id, 'subcategory')
                                  const hasLevel3 = level3Children.length > 0
                                  const isLevel2Expanded = expandedCategories[level2._id]
                                  const isLevel2Selected = selectedSubCategory2 === level2._id

                                  return (
                                    <div key={level2._id} className="ml-6 space-y-1">
                                      <div className="flex items-center justify-between py-1 group">
                                        <div
                                          className="flex items-center cursor-pointer flex-1"
                                          onClick={() => handleSubcategorySelect(level2._id, 2)}
                                        >
                                          <div className="relative flex items-center">
                                            <input
                                              type="radio"
                                              checked={isLevel2Selected}
                                              readOnly
                                              className="absolute opacity-0 w-0 h-0"
                                            />
                                            <div
                                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                                                isLevel2Selected ? "border-lime-600 bg-lime-600" : "border-gray-300"
                                              }`}
                                            >
                                              {isLevel2Selected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                            </div>
                                          </div>
                                          <span className={`text-sm ${isLevel2Selected ? "text-lime-600 font-semibold" : "text-gray-600"}`}>
                                            <TranslatedText text={level2.name} />
                                          </span>
                                        </div>
                                        {hasLevel3 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              toggleExpanded(level2._id)
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded ml-2"
                                          >
                                            {isLevel2Expanded ? <Minus size={14} /> : <Plus size={14} />}
                                          </button>
                                        )}
                                      </div>

                                      {isLevel2Expanded && level3Children.map((level3) => {
                                        const level4Children = getChildren(level3._id, 'subcategory')
                                        const hasLevel4 = level4Children.length > 0
                                        const isLevel3Expanded = expandedCategories[level3._id]
                                        const isLevel3Selected = selectedSubCategory3 === level3._id

                                        return (
                                          <div key={level3._id} className="ml-6 space-y-1">
                                            <div className="flex items-center justify-between py-1 group">
                                              <div
                                                className="flex items-center cursor-pointer flex-1"
                                                onClick={() => handleSubcategorySelect(level3._id, 3)}
                                              >
                                                <div className="relative flex items-center">
                                                  <input
                                                    type="radio"
                                                    checked={isLevel3Selected}
                                                    readOnly
                                                    className="absolute opacity-0 w-0 h-0"
                                                  />
                                                  <div
                                                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                                                      isLevel3Selected ? "border-lime-600 bg-lime-600" : "border-gray-300"
                                                    }`}
                                                  >
                                                    {isLevel3Selected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                                  </div>
                                                </div>
                                                <span className={`text-sm ${isLevel3Selected ? "text-lime-600 font-semibold" : "text-gray-600"}`}>
                                                  <TranslatedText text={level3.name} />
                                                </span>
                                              </div>
                                              {hasLevel4 && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleExpanded(level3._id)
                                                  }}
                                                  className="p-1 hover:bg-gray-100 rounded ml-2"
                                                >
                                                  {isLevel3Expanded ? <Minus size={14} /> : <Plus size={14} />}
                                                </button>
                                              )}
                                            </div>

                                            {isLevel3Expanded && level4Children.map((level4) => {
                                              const isLevel4Selected = selectedSubCategory4 === level4._id

                                              return (
                                                <div key={level4._id} className="ml-6 space-y-1">
                                                  <div className="flex items-center py-1">
                                                    <div
                                                      className="flex items-center cursor-pointer flex-1"
                                                      onClick={() => handleSubcategorySelect(level4._id, 4)}
                                                    >
                                                      <div className="relative flex items-center">
                                                        <input
                                                          type="radio"
                                                          checked={isLevel4Selected}
                                                          readOnly
                                                          className="absolute opacity-0 w-0 h-0"
                                                        />
                                                        <div
                                                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                                                            isLevel4Selected ? "border-lime-600 bg-lime-600" : "border-gray-300"
                                                          }`}
                                                        >
                                                          {isLevel4Selected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                                        </div>
                                                      </div>
                                                      <span className={`text-sm ${isLevel4Selected ? "text-lime-600 font-semibold" : "text-gray-600"}`}>
                                                        <TranslatedText text={level4.name} />
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Brand Filter - Mobile */}
              <div className="border-b pb-4">
                <button
                  onClick={() => setShowBrandFilter(true)}
                  className={`flex items-center justify-between w-full text-left font-medium ${
                    selectedBrands.length > 0 ? "text-lime-500" : "text-gray-900"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <TranslatedText>Brands</TranslatedText>
                    {selectedBrands.length > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-lime-500 rounded-full">
                        {selectedBrands.length}
                      </span>
                    )}
                  </span>
                  {showBrandFilter ? <Minus size={16} /> : <ChevronDown size={16} />}
                </button>
                {showBrandFilter && (
                  <div className="mt-4 space-y-2">
                    <input
                      type="text"
                      placeholder="Search brands..."
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                    />
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {filteredBrands.map((brand) => (
                        <div key={brand._id} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`brand-mobile-${brand._id}`}
                            checked={selectedBrands.includes(brand._id)}
                            onChange={() => handleBrandChange(brand._id)}
                            className="w-4 h-4 text-lime-600 border-gray-300 rounded focus:ring-lime-500"
                          />
                          <label htmlFor={`brand-mobile-${brand._id}`} className="ml-2 text-sm text-gray-700 cursor-pointer">
                            <TranslatedText text={brand.name} />
                          </label>
                        </div>
                      ))}
                      {filteredBrands.length === 0 && (
                        <p className="text-sm text-gray-500 italic"><TranslatedText>No brands found</TranslatedText></p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {showSeriesSection && renderProductSystemFilterSection({
                title: "Series",
                selectedValues: selectedSeries,
                options: availableSeries,
                showFilter: showSeriesFilter,
                setShowFilter: setShowSeriesFilter,
                idPrefix: "series-mobile",
                onToggle: (value) => toggleProductSystemSelection(value, setSelectedSeries),
              })}

              {showModelSection && renderProductSystemFilterSection({
                title: "Model",
                selectedValues: selectedModels,
                options: availableModels,
                showFilter: showModelFilter,
                setShowFilter: setShowModelFilter,
                idPrefix: "model-mobile",
                onToggle: (value) => toggleProductSystemSelection(value, setSelectedModels),
              })}

              {showMakeSection && renderProductSystemFilterSection({
                title: "Make",
                selectedValues: selectedMakes,
                options: availableMakes,
                showFilter: showMakeFilter,
                setShowFilter: setShowMakeFilter,
                idPrefix: "make-mobile",
                onToggle: (value) => toggleProductSystemSelection(value, setSelectedMakes),
              })}

              {showManufacturerSection && renderProductSystemFilterSection({
                title: "Manufacturer",
                selectedValues: selectedManufacturers,
                options: availableManufacturers,
                showFilter: showManufacturerFilter,
                setShowFilter: setShowManufacturerFilter,
                idPrefix: "manufacturer-mobile",
                onToggle: (value) => toggleProductSystemSelection(value, setSelectedManufacturers),
              })}

              {showSoldBySection && renderProductSystemFilterSection({
                title: "Sold By",
                selectedValues: selectedSoldBy,
                options: availableSoldBy,
                showFilter: showSoldByFilter,
                setShowFilter: setShowSoldByFilter,
                idPrefix: "soldby-mobile",
                onToggle: (value) => toggleProductSystemSelection(value, setSelectedSoldBy),
              })}

              {/* Stock Status Filter - Mobile */}
              <div className="border-b pb-4">
                <div className={`font-medium mb-4 ${
                  stockFilters.inStock || stockFilters.outOfStock || stockFilters.onSale
                    ? "text-lime-500"
                    : "text-gray-900"
                }`}><TranslatedText>Stock Status</TranslatedText></div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="stock-all-mobile"
                      name="stock-filter-mobile"
                      checked={!stockFilters.inStock && !stockFilters.outOfStock && !stockFilters.onSale}
                      onChange={handleAllProductsFilter}
                      className="w-4 h-4 text-lime-600 border-gray-300 focus:ring-lime-500"
                    />
                    <label htmlFor="stock-all-mobile" className="ml-2 text-sm text-gray-700 cursor-pointer">
                      <TranslatedText>All Products</TranslatedText>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="stock-in-mobile"
                      name="stock-filter-mobile"
                      checked={stockFilters.inStock}
                      onChange={() => handleStockFilterChange('inStock')}
                      className="w-4 h-4 text-lime-600 border-gray-300 focus:ring-lime-500"
                    />
                    <label htmlFor="stock-in-mobile" className="ml-2 text-sm text-gray-700 cursor-pointer">
                      <TranslatedText>In Stock</TranslatedText>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="stock-out-mobile"
                      name="stock-filter-mobile"
                      checked={stockFilters.outOfStock}
                      onChange={() => handleStockFilterChange('outOfStock')}
                      className="w-4 h-4 text-lime-600 border-gray-300 focus:ring-lime-500"
                    />
                    <label htmlFor="stock-out-mobile" className="ml-2 text-sm text-gray-700 cursor-pointer">
                      <TranslatedText>Out of Stock</TranslatedText>
                    </label>
                  </div>
                </div>
              </div>

              {/* Apply & Clear Buttons - Mobile */}
              <div className="space-y-3 pt-4">
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="w-full px-4 py-3 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors font-semibold"
                >
                  <TranslatedText>Show</TranslatedText> {Math.max(matchCount, products.length)} <TranslatedText>Products</TranslatedText>
                </button>
                <button
                  onClick={() => {
                    clearAllFilters()
                    setIsMobileFilterOpen(false)
                  }}
                  className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  <TranslatedText>Clear All Filters</TranslatedText>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-1/4 hidden md:block">
            {/* <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6 sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide"> */}
      <div className="bg-white rounded-lg p-6 space-y-6 sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide">
              {showBreadcrumb && (
                <div className="bg-lime-50 border border-lime-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-semibold text-lime-900"><TranslatedText>Current Path</TranslatedText>:</p>
                  <p className="text-sm text-lime-800 mt-1 break-words">{breadcrumbPath}</p>
                </div>
              )}

              {/* Active Filters Section */}
              {(selectedCategory !== "all" || 
                selectedSubCategories.length > 0 || 
                selectedSubCategory2 || 
                selectedSubCategory3 || 
                selectedSubCategory4 || 
                selectedBrands.length > 0 || 
                selectedSeries.length > 0 ||
                selectedModels.length > 0 ||
                selectedMakes.length > 0 ||
                selectedManufacturers.length > 0 ||
                selectedSoldBy.length > 0 ||
                stockFilters.inStock || 
                stockFilters.outOfStock || 
                stockFilters.onSale ||
                isPriceFilterApplied) && (
                <div className="border border-lime-200 rounded-lg p-4 bg-lime-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900"><TranslatedText>Active Filters</TranslatedText></h3>
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
                    >
                      <TranslatedText>Clear All</TranslatedText>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {/* Parent Category Filter */}
                    {selectedCategory !== "all" && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Category</TranslatedText>:</span>{" "}
                          <TranslatedText text={categories.find((cat) => cat._id === selectedCategory)?.name || selectedCategory} />
                        </span>
                        <button
                          onClick={() => handleCategoryChange("all")}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Level 1 Subcategory */}
                    {selectedSubCategories.length > 0 && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Subcategory</TranslatedText>:</span> <TranslatedText text={currentSubCategoryName} />
                        </span>
                        <button
                          onClick={() => handleClearSubCategory(1)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Level 2 Subcategory */}
                    {selectedSubCategory2 && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Level 2</TranslatedText>:</span> <TranslatedText text={currentSubCategory2Name} />
                        </span>
                        <button
                          onClick={() => handleClearSubCategory(2)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Level 3 Subcategory */}
                    {selectedSubCategory3 && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Level 3</TranslatedText>:</span> <TranslatedText text={currentSubCategory3Name} />
                        </span>
                        <button
                          onClick={() => handleClearSubCategory(3)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Level 4 Subcategory */}
                    {selectedSubCategory4 && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Level 4</TranslatedText>:</span> <TranslatedText text={currentSubCategory4Name} />
                        </span>
                        <button
                          onClick={() => handleClearSubCategory(4)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Selected Brands */}
                    {selectedBrands.map((brandId) => {
                      const brand = brands.find((b) => b._id === brandId)
                      return brand ? (
                        <div key={brandId} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                          <span className="text-gray-700">
                            <span className="font-semibold"><TranslatedText>Brand</TranslatedText>:</span> <TranslatedText text={brand.name} />
                          </span>
                          <button
                            onClick={() => handleBrandChange(brandId)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            ×
                          </button>
                        </div>
                      ) : null
                    })}
                    {selectedSeries.map((seriesId) => (
                      <div key={`series-desktop-${seriesId}`} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Series</TranslatedText>:</span>{" "}
                          <TranslatedText text={getOptionNameById("series", seriesId)} />
                        </span>
                        <button
                          onClick={() => toggleProductSystemSelection(seriesId, setSelectedSeries)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selectedModels.map((modelId) => (
                      <div key={`model-desktop-${modelId}`} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Model</TranslatedText>:</span>{" "}
                          <TranslatedText text={getOptionNameById("model", modelId)} />
                        </span>
                        <button
                          onClick={() => toggleProductSystemSelection(modelId, setSelectedModels)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selectedMakes.map((makeId) => (
                      <div key={`make-desktop-${makeId}`} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Make</TranslatedText>:</span>{" "}
                          <TranslatedText text={getOptionNameById("make", makeId)} />
                        </span>
                        <button
                          onClick={() => toggleProductSystemSelection(makeId, setSelectedMakes)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selectedManufacturers.map((manufacturerId) => (
                      <div key={`manufacturer-desktop-${manufacturerId}`} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Manufacturer</TranslatedText>:</span>{" "}
                          <TranslatedText text={getOptionNameById("manufacturer", manufacturerId)} />
                        </span>
                        <button
                          onClick={() => toggleProductSystemSelection(manufacturerId, setSelectedManufacturers)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {selectedSoldBy.map((soldById) => (
                      <div key={`soldby-desktop-${soldById}`} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Sold By</TranslatedText>:</span>{" "}
                          <TranslatedText text={getOptionNameById("soldBy", soldById)} />
                        </span>
                        <button
                          onClick={() => toggleProductSystemSelection(soldById, setSelectedSoldBy)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {/* Price Range Filter */}
                    {(isPriceFilterApplied) && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Price</TranslatedText>:</span> {formatCurrencyPrice(priceRange[0], isArabic)} - {formatCurrencyPrice(formattedAppliedMaxPrice, isArabic)}
                        </span>
                        <button
                          onClick={resetPriceFilter}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {/* Stock Status Filters */}
                    {stockFilters.inStock && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Stock</TranslatedText>:</span> <TranslatedText>In Stock</TranslatedText>
                        </span>
                        <button
                          onClick={() => setStockFilters({ inStock: false, outOfStock: false, onSale: false })}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {stockFilters.outOfStock && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Stock</TranslatedText>:</span> <TranslatedText>Out of Stock</TranslatedText>
                        </span>
                        <button
                          onClick={() => setStockFilters({ inStock: false, outOfStock: false, onSale: false })}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {stockFilters.onSale && (
                      <div className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                        <span className="text-gray-700">
                          <span className="font-semibold"><TranslatedText>Stock</TranslatedText>:</span> <TranslatedText>On Sale</TranslatedText>
                        </span>
                        <button
                          onClick={() => setStockFilters({ inStock: false, outOfStock: false, onSale: false })}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-b pb-4">
                <button
                  onClick={() => setShowPriceFilter(true)}
                  className={`flex items-center justify-between w-full text-left font-medium ${
                    isPriceFilterApplied
                      ? "text-lime-500"
                      : "text-gray-900"
                  }`}
                >
                  <TranslatedText>Price Range</TranslatedText>
                  {showPriceFilter ? <Minus size={16} /> : <ChevronDown size={16} />}
                </button>
                {showPriceFilter && (
                  <div className="mt-4 space-y-4">
                    <PriceFilter
                      min={minPrice}
                      max={maxPrice}
                      initialRange={priceRange}
                      isApplied={isPriceFilterApplied}
                      onApply={handlePriceApply}
                    />
                  </div>
                )}
              </div>

              <div className="border-b pb-4">
                <button
                  onClick={() => setShowCategoryFilter(true)}
                  className={`flex items-center justify-between w-full text-left font-medium ${
                    selectedCategory !== "all" || selectedSubCategories.length > 0 || selectedSubCategory2 || selectedSubCategory3 || selectedSubCategory4
                      ? "text-lime-500"
                      : "text-gray-900"
                  }`}
                >
                  <TranslatedText>Categories</TranslatedText>
                  {showCategoryFilter ? <Minus size={16} /> : <ChevronDown size={16} />}
                </button>
                {showCategoryFilter && (
                  <div className="mt-4 space-y-1">
                    {/* All Categories Option */}
                    <div className="flex items-center cursor-pointer py-1" onClick={() => handleCategoryChange("all")}>
                      <div className="relative flex items-center">
                        <input
                          type="radio"
                          name="category-group"
                          checked={selectedCategory === "all"}
                          readOnly
                          className="absolute opacity-0 w-0 h-0"
                        />
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                            selectedCategory === "all" ? "border-lime-600 bg-lime-600" : "border-gray-300"
                          }`}
                        >
                          {selectedCategory === "all" && <div className="w-2 h-2 rounded-full bg-white"></div>}
                        </div>
                      </div>
                      <span className="text-sm text-gray-700"><TranslatedText>All Categories</TranslatedText></span>
                    </div>

                    {/* Hierarchical Category Tree */}
                    {categories.map((category) => {
                      const level1Children = getChildren(category._id, 'category')
                      const hasChildren = level1Children.length > 0
                      const isExpanded = expandedCategories[category._id]
                      const isSelected = selectedCategory === category._id

                      return (
                        <div key={category._id} className="space-y-1">
                          {/* Parent Category */}
                          <div className="flex items-center justify-between py-1 group">
                            <div 
                              className="flex items-center cursor-pointer flex-1"
                              onClick={() => handleCategoryChange(category._id)}
                            >
                              <div className="relative flex items-center">
                                <input
                                  type="radio"
                                  name="category-group"
                                  checked={isSelected}
                                  readOnly
                                  className="absolute opacity-0 w-0 h-0"
                                />
                                <div
                                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                                    isSelected ? "border-lime-600 bg-lime-600" : "border-gray-300"
                                  }`}
                                >
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                </div>
                              </div>
                              <span className={`text-sm ${isSelected ? "text-lime-600 font-semibold" : "text-gray-700"}`}>
                                <TranslatedText text={category.name} />
                              </span>
                            </div>
                            {hasChildren && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpanded(category._id)
                                }}
                                className="p-1 hover:bg-gray-100 rounded ml-2"
                              >
                                {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
                              </button>
                            )}
                          </div>

                          {/* Level 1 Subcategories */}
                          {isExpanded && level1Children.map((level1) => {
                            const level2Children = getChildren(level1._id, 'subcategory')
                            const hasLevel2 = level2Children.length > 0
                            const isLevel1Expanded = expandedCategories[level1._id]
                            const isLevel1Selected = selectedSubCategories.includes(level1._id)

                            return (
                              <div key={level1._id} className="ml-6 space-y-1">
                                {/* Level 1 Item */}
                                <div className="flex items-center justify-between py-1 group">
                                  <div
                                    className="flex items-center cursor-pointer flex-1"
                                    onClick={() => handleSubcategorySelect(level1._id, 1)}
                                  >
                                    <div className="relative flex items-center">
                                      <input
                                        type="radio"
                                        checked={isLevel1Selected}
                                        readOnly
                                        className="absolute opacity-0 w-0 h-0"
                                      />
                                      <div
                                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                                          isLevel1Selected ? "border-lime-600 bg-lime-600" : "border-gray-300"
                                        }`}
                                      >
                                        {isLevel1Selected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                      </div>
                                    </div>
                                    <span className={`text-sm ${isLevel1Selected ? "text-lime-600 font-semibold" : "text-gray-600"}`}>
                                      <TranslatedText text={level1.name} />
                                    </span>
                                  </div>
                                  {hasLevel2 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleExpanded(level1._id)
                                      }}
                                      className="p-1 hover:bg-gray-100 rounded ml-2"
                                    >
                                      {isLevel1Expanded ? <Minus size={14} /> : <Plus size={14} />}
                                    </button>
                                  )}
                                </div>

                                {/* Level 2 Subcategories */}
                                {isLevel1Expanded && level2Children.map((level2) => {
                                  const level3Children = getChildren(level2._id, 'subcategory')
                                  const hasLevel3 = level3Children.length > 0
                                  const isLevel2Expanded = expandedCategories[level2._id]
                                  const isLevel2Selected = selectedSubCategory2 === level2._id

                                  return (
                                    <div key={level2._id} className="ml-6 space-y-1">
                                      {/* Level 2 Item */}
                                      <div className="flex items-center justify-between py-1 group">
                                        <div
                                          className="flex items-center cursor-pointer flex-1"
                                          onClick={() => handleSubcategorySelect(level2._id, 2)}
                                        >
                                          <div className="relative flex items-center">
                                            <input
                                              type="radio"
                                              checked={isLevel2Selected}
                                              readOnly
                                              className="absolute opacity-0 w-0 h-0"
                                            />
                                            <div
                                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                                                isLevel2Selected ? "border-lime-600 bg-lime-600" : "border-gray-300"
                                              }`}
                                            >
                                              {isLevel2Selected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                            </div>
                                          </div>
                                          <span className={`text-sm ${isLevel2Selected ? "text-lime-600 font-semibold" : "text-gray-600"}`}>
                                            <TranslatedText text={level2.name} />
                                          </span>
                                        </div>
                                        {hasLevel3 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              toggleExpanded(level2._id)
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded ml-2"
                                          >
                                            {isLevel2Expanded ? <Minus size={14} /> : <Plus size={14} />}
                                          </button>
                                        )}
                                      </div>

                                      {/* Level 3 Subcategories */}
                                      {isLevel2Expanded && level3Children.map((level3) => {
                                        const level4Children = getChildren(level3._id, 'subcategory')
                                        const hasLevel4 = level4Children.length > 0
                                        const isLevel3Expanded = expandedCategories[level3._id]
                                        const isLevel3Selected = selectedSubCategory3 === level3._id

                                        return (
                                          <div key={level3._id} className="ml-6 space-y-1">
                                            {/* Level 3 Item */}
                                            <div className="flex items-center justify-between py-1 group">
                                              <div
                                                className="flex items-center cursor-pointer flex-1"
                                                onClick={() => handleSubcategorySelect(level3._id, 3)}
                                              >
                                                <div className="relative flex items-center">
                                                  <input
                                                    type="radio"
                                                    checked={isLevel3Selected}
                                                    readOnly
                                                    className="absolute opacity-0 w-0 h-0"
                                                  />
                                                  <div
                                                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                                                      isLevel3Selected ? "border-lime-600 bg-lime-600" : "border-gray-300"
                                                    }`}
                                                  >
                                                    {isLevel3Selected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                                  </div>
                                                </div>
                                                <span className={`text-sm ${isLevel3Selected ? "text-lime-600 font-semibold" : "text-gray-600"}`}>
                                                  <TranslatedText text={level3.name} />
                                                </span>
                                              </div>
                                              {hasLevel4 && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleExpanded(level3._id)
                                                  }}
                                                  className="p-1 hover:bg-gray-100 rounded ml-2"
                                                >
                                                  {isLevel3Expanded ? <Minus size={14} /> : <Plus size={14} />}
                                                </button>
                                              )}
                                            </div>

                                            {/* Level 4 Subcategories */}
                                            {isLevel3Expanded && level4Children.map((level4) => {
                                              const isLevel4Selected = selectedSubCategory4 === level4._id

                                              return (
                                                <div key={level4._id} className="ml-6 flex items-center justify-between py-1 group">
                                                  <div
                                                    className="flex items-center cursor-pointer flex-1"
                                                    onClick={() => handleSubcategorySelect(level4._id, 4)}
                                                  >
                                                    <div className="relative flex items-center">
                                                      <input
                                                        type="radio"
                                                        checked={isLevel4Selected}
                                                        readOnly
                                                        className="absolute opacity-0 w-0 h-0"
                                                      />
                                                      <div
                                                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-2 ${
                                                          isLevel4Selected ? "border-lime-600 bg-lime-600" : "border-gray-300"
                                                        }`}
                                                      >
                                                        {isLevel4Selected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                                      </div>
                                                    </div>
                                                    <span className={`text-sm ${isLevel4Selected ? "text-lime-600 font-semibold" : "text-gray-600"}`}>
                                                      <TranslatedText text={level4.name} />
                                                    </span>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Brand Filter */}
              <div className="border-b pb-4">
                <button
                  onClick={() => setShowBrandFilter(true)}
                  className={`flex items-center justify-between w-full text-left font-medium ${
                    selectedBrands.length > 0 ? "text-lime-500" : "text-gray-900"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <TranslatedText>Brands</TranslatedText>
                    {selectedBrands.length > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-lime-500 rounded-full">
                        {selectedBrands.length}
                      </span>
                    )}
                  </span>
                  {showBrandFilter ? <Minus size={16} /> : <ChevronDown size={16} />}
                </button>
                {showBrandFilter && (
                  <div className="mt-4 space-y-2">
                    <input
                      type="text"
                      placeholder="Search brands..."
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500"
                    />
                    <div className="space-y-2">
                      {filteredBrands.map((brand) => (
                        <div key={brand._id} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`brand-${brand._id}`}
                            checked={selectedBrands.includes(brand._id)}
                            onChange={() => handleBrandChange(brand._id)}
                            className="w-4 h-4 text-lime-600 border-gray-300 rounded focus:ring-lime-500"
                          />
                          <label htmlFor={`brand-${brand._id}`} className="ml-2 text-sm text-gray-700 cursor-pointer">
                            <TranslatedText text={brand.name} />
                          </label>
                        </div>
                      ))}
                      {filteredBrands.length === 0 && (
                        <p className="text-sm text-gray-500 italic"><TranslatedText>No brands found</TranslatedText></p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {showSeriesSection && renderProductSystemFilterSection({
                title: "Series",
                selectedValues: selectedSeries,
                options: availableSeries,
                showFilter: showSeriesFilter,
                setShowFilter: setShowSeriesFilter,
                idPrefix: "series-desktop",
                onToggle: (value) => toggleProductSystemSelection(value, setSelectedSeries),
              })}

              {showModelSection && renderProductSystemFilterSection({
                title: "Model",
                selectedValues: selectedModels,
                options: availableModels,
                showFilter: showModelFilter,
                setShowFilter: setShowModelFilter,
                idPrefix: "model-desktop",
                onToggle: (value) => toggleProductSystemSelection(value, setSelectedModels),
              })}

              {showMakeSection && renderProductSystemFilterSection({
                title: "Make",
                selectedValues: selectedMakes,
                options: availableMakes,
                showFilter: showMakeFilter,
                setShowFilter: setShowMakeFilter,
                idPrefix: "make-desktop",
                onToggle: (value) => toggleProductSystemSelection(value, setSelectedMakes),
              })}

              {showManufacturerSection && renderProductSystemFilterSection({
                title: "Manufacturer",
                selectedValues: selectedManufacturers,
                options: availableManufacturers,
                showFilter: showManufacturerFilter,
                setShowFilter: setShowManufacturerFilter,
                idPrefix: "manufacturer-desktop",
                onToggle: (value) => toggleProductSystemSelection(value, setSelectedManufacturers),
              })}

              {showSoldBySection && renderProductSystemFilterSection({
                title: "Sold By",
                selectedValues: selectedSoldBy,
                options: availableSoldBy,
                showFilter: showSoldByFilter,
                setShowFilter: setShowSoldByFilter,
                idPrefix: "soldby-desktop",
                onToggle: (value) => toggleProductSystemSelection(value, setSelectedSoldBy),
              })}

              {/* Stock Status Filter */}
              <div className="border-b pb-4">
                <div className={`font-medium mb-4 ${
                  stockFilters.inStock || stockFilters.outOfStock || stockFilters.onSale
                    ? "text-lime-500"
                    : "text-gray-900"
                }`}><TranslatedText>Stock Status</TranslatedText></div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="stock-all"
                      name="stock-filter"
                      checked={!stockFilters.inStock && !stockFilters.outOfStock && !stockFilters.onSale}
                      onChange={handleAllProductsFilter}
                      className="w-4 h-4 text-lime-600 border-gray-300 focus:ring-lime-500"
                    />
                    <label htmlFor="stock-all" className="ml-2 text-sm text-gray-700 cursor-pointer">
                      <TranslatedText>All Products</TranslatedText>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="stock-in"
                      name="stock-filter"
                      checked={stockFilters.inStock}
                      onChange={() => handleStockFilterChange('inStock')}
                      className="w-4 h-4 text-lime-600 border-gray-300 focus:ring-lime-500"
                    />
                    <label htmlFor="stock-in" className="ml-2 text-sm text-gray-700 cursor-pointer">
                      <TranslatedText>In Stock</TranslatedText>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="radio"
                      id="stock-out"
                      name="stock-filter"
                      checked={stockFilters.outOfStock}
                      onChange={() => handleStockFilterChange('outOfStock')}
                      className="w-4 h-4 text-lime-600 border-gray-300 focus:ring-lime-500"
                    />
                    <label htmlFor="stock-out" className="ml-2 text-sm text-gray-700 cursor-pointer">
                      <TranslatedText>Out of Stock</TranslatedText>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={clearAllFilters}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <TranslatedText>Clear All Filters</TranslatedText>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:w-3/4">
            {/* Mobile Filter Button */}
            <div className="md:hidden mb-4 flex gap-2">
              <button
                onClick={() => setIsMobileFilterOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition-colors font-semibold shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <TranslatedText>Filters</TranslatedText>
                {(selectedCategory !== "all" || 
                  selectedSubCategories.length > 0 || 
                  selectedBrands.length > 0 || 
                  selectedSeries.length > 0 ||
                  selectedModels.length > 0 ||
                  selectedMakes.length > 0 ||
                  selectedManufacturers.length > 0 ||
                  selectedSoldBy.length > 0 ||
                  stockFilters.inStock || 
                  stockFilters.outOfStock || 
                  stockFilters.onSale ||
                  isPriceFilterApplied) && (
                  <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold bg-white text-lime-600 rounded-full">
                    {[selectedCategory !== "all", selectedSubCategories.length > 0, selectedBrands.length,
                      selectedSeries.length > 0, selectedModels.length > 0, selectedMakes.length > 0, selectedManufacturers.length > 0, selectedSoldBy.length > 0,
                      stockFilters.inStock || stockFilters.outOfStock || stockFilters.onSale,
                      isPriceFilterApplied].filter(Boolean).length}
                  </span>
                )}
              </button>
              <div className="flex-shrink-0">
                <SortDropdown value={effectiveSortBy} onChange={handleSortChange} showRelevance={hasActiveSearch} />
              </div>
            </div>
            
            {/* Child Categories Section - Shows children of the deepest selected level */}
            {!searchQuery.trim() && allSubcategories.length > 0 && (() => {
              // Determine the deepest selected level and its type
              let currentLevelId = null
              let currentLevelType = null
              let nextLevel = 1
              let parentLevelId = null
              let isLevel4 = false
              
              if (selectedSubCategory4) {
                // When at level 4, always show level 4 siblings (from level 3 parent)
                currentLevelId = selectedSubCategory3
                currentLevelType = 'subcategory'
                nextLevel = 4
                isLevel4 = true
              } else if (selectedSubCategory3) {
                currentLevelId = selectedSubCategory3
                currentLevelType = 'subcategory'
                nextLevel = 4
                parentLevelId = selectedSubCategory2 || selectedSubCategories[0]
              } else if (selectedSubCategory2) {
                currentLevelId = selectedSubCategory2
                currentLevelType = 'subcategory'
                nextLevel = 3
                parentLevelId = selectedSubCategories[0]
              } else if (selectedSubCategories.length > 0) {
                currentLevelId = selectedSubCategories[0]
                currentLevelType = 'subcategory'
                nextLevel = 2
                parentLevelId = selectedCategory
              } else if (selectedCategory && selectedCategory !== "all") {
                currentLevelId = selectedCategory
                currentLevelType = 'category'
                nextLevel = 1
              }
              
              // If no category is selected, don't show anything
              if (!currentLevelId) return null
              
              // Get children of the current deepest level
              let childCategories = getChildren(currentLevelId, currentLevelType)
              
              if (childCategories.length === 0) return null
              
              return (
                <section className="mb-8">
                  <div className="relative">
                    <button
                      onClick={scrollSubCategoryPrev}
                      className={`absolute left-0 md:-left-5 top-1/2 -translate-y-1/2 z-10 shadow-lg rounded-full p-2 transition-colors ${
                        subCategoryScrollState.canScrollPrev 
                          ? 'bg-lime-500 text-white hover:bg-lime-600 cursor-pointer' 
                          : 'bg-white cursor-default opacity-50'
                      }`}
                      disabled={!subCategoryScrollState.canScrollPrev}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>

                    <div
                      ref={subCategorySliderRef}
                      onScroll={updateSubCategoryScrollState}
                      className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-10 md:px-12"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {childCategories.map((child) => {
                        // Check if this category is currently selected
                        const isSelected = child._id === selectedSubCategory4
                        
                        return (
                          <button
                            key={child._id}
                            onClick={() => handleSubcategorySelect(child._id, nextLevel)}
                            className={`flex-shrink-0 w-32 rounded-lg transition-all flex flex-col items-center justify-center p-3 gap-2 ${
                              isSelected ? 'bg-lime-100 border-2 border-lime-500' : 'hover:bg-gray-50'
                            }`}
                          >
                            {child?.image ? (
                              <>
                                <div className="h-20 flex items-center justify-center">
                                  <img
                                    src={getFullImageUrl(child.image)}
                                    alt={child.name || "Subcategory"}
                                    className="max-h-full max-w-full bg-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none"
                                      const btn = e.currentTarget.closest("button")
                                      const fallback = btn?.querySelector("[data-fallback-name]")
                                      if (fallback) fallback.classList.remove("hidden")
                                    }}
                                  />
                                </div>
                                <span className={`text-xs font-semibold text-center line-clamp-2 ${
                                  isSelected ? 'text-lime-700' : 'text-gray-700'
                                }`}>
                                  {child.name}
                                </span>
                              </>
                            ) : (
                              <span className={`text-sm font-semibold text-center ${
                                isSelected ? 'text-lime-700' : 'text-gray-700'
                              }`}>
                                {child.name}
                              </span>
                            )}
                            <span data-fallback-name className="hidden text-sm font-semibold text-gray-700 text-center">
                              {child.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <button
                      onClick={scrollSubCategoryNext}
                      className={`absolute right-0 md:-right-5 top-1/2 -translate-y-1/2 z-10 shadow-lg rounded-full p-2 transition-colors ${
                        subCategoryScrollState.canScrollNext 
                          ? 'bg-lime-500 text-white hover:bg-lime-600 cursor-pointer' 
                          : 'bg-white cursor-default opacity-50'
                      }`}
                      disabled={!subCategoryScrollState.canScrollNext}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </section>
              )
            })()}

            {/* Brand Slider - Shows brands from currently displayed products */}
            {/* {!searchQuery.trim() && products.length > 0 && (() => {
              // Extract unique brand IDs from current products
              // Products may have brand as object or ID string
              const productBrandIds = [...new Set(
                products
                  .map(p => {
                    // Handle both populated brand object and brand ID string
                    if (typeof p.brand === 'object' && p.brand !== null) {
                      return p.brand._id
                    }
                    return p.brand
                  })
                  .filter(Boolean)
              )]
              
              const availableBrands = brands.filter(brand => productBrandIds.includes(brand._id))
              
              console.log('Products count:', products.length)
              console.log('Sample product brands:', products.slice(0, 3).map(p => p.brand))
              console.log('Product brand IDs:', productBrandIds)
              console.log('All brands:', brands.length)
              console.log('Available brands:', availableBrands)
              
              if (availableBrands.length === 0) return null

              return (
                <section className="mb-8">
                  <div className="relative">
                    <button
                      onClick={scrollBrandPrev}
                      className={`absolute left-0 md:-left-5 top-1/2 -translate-y-1/2 z-10 shadow-lg rounded-full p-2 transition-colors ${
                        brandScrollState.canScrollPrev 
                          ? 'bg-lime-500 text-white hover:bg-lime-600 cursor-pointer' 
                          : 'bg-white cursor-default opacity-50'
                      }`}
                      disabled={!brandScrollState.canScrollPrev}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>

                    <div
                      ref={brandSliderRef}
                      onScroll={updateBrandScrollState}
                      className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-10 md:px-12"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      {availableBrands.map((brand) => (
                        <button
                          key={brand._id}
                          onClick={() => handleBrandChange(brand._id)}
                          className={`flex-shrink-0 w-32 rounded-lg transition-all flex flex-col items-center justify-center p-3 gap-2 ${
                            selectedBrands.includes(brand._id)
                              ? 'bg-lime-100 border-2 border-lime-600'
                              : ''
                          }`}
                        >
                          {brand.logo ? (
                            <>
                              <div className="h-24 flex items-center justify-center">
                                <img
                                  src={getFullImageUrl(brand.logo)}
                                  alt={brand.name || "Brand"}
                                  className="max-h-full max-w-full bg-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none"
                                    const btn = e.currentTarget.closest("button")
                                    const fallback = btn?.querySelector("[data-brand-fallback]")
                                    if (fallback) fallback.classList.remove("hidden")
                                  }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-gray-700 text-center line-clamp-2">
                                {brand.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-gray-700 text-center">
                              {brand.name}
                            </span>
                          )}
                          <span data-brand-fallback className="hidden text-sm font-semibold text-gray-700 text-center">
                            {brand.name}
                          </span>
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={scrollBrandNext}
                      className={`absolute right-0 md:-right-5 top-1/2 -translate-y-1/2 z-10 shadow-lg rounded-full p-2 transition-colors ${
                        brandScrollState.canScrollNext 
                          ? 'bg-lime-500 text-white hover:bg-lime-600 cursor-pointer' 
                          : 'bg-white cursor-default opacity-50'
                      }`}
                      disabled={!brandScrollState.canScrollNext}
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </section>
              )
            })()} */}

            {/* Products Found and Sort Section - Above Product Cards */}
            <div className="flex flex-row justify-between items-center mb-6 relative z-10">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">
                  {searchQuery.trim() ? (
                    <>
                      <TranslatedText>Results for</TranslatedText> "{searchQuery.trim()}"
                      {actualSearchQuery && actualSearchQuery !== searchQuery.trim() && (
                        <span className="text-sm text-gray-500 block mt-1">
                          <TranslatedText>Showing results for</TranslatedText> "{actualSearchQuery}" <TranslatedText>instead</TranslatedText>
                        </span>
                      )}
                    </>
                  ) : (
                    (() => {
                      // Show brand name if a single brand is selected
                      if (selectedBrands.length === 1) {
                        const brandName = brands.find((b) => b._id === selectedBrands[0])?.name
                        if (brandName) return <TranslatedText text={brandName} />
                      }
                      
                      // Show subcategory names (deepest first)
                      if (currentSubCategory4Name) return <TranslatedText text={currentSubCategory4Name} />
                      if (currentSubCategory3Name) return <TranslatedText text={currentSubCategory3Name} />
                      if (currentSubCategory2Name) return <TranslatedText text={currentSubCategory2Name} />
                      if (currentSubCategoryName) return <TranslatedText text={currentSubCategoryName} />
                      
                      // Show category name
                      const categoryName = categories.find((cat) => cat._id === selectedCategory)?.name
                      if (categoryName) return <TranslatedText text={categoryName} />
                      
                      return <TranslatedText>All Products</TranslatedText>
                    })()
                  )}
                </h1>
                <p className="text-gray-600 mt-1">{Math.max(matchCount, products.length)} <TranslatedText>products found</TranslatedText></p>
              </div>

              <div className="hidden md:block mt-0 flex-shrink-0 relative z-20">
                <SortDropdown value={effectiveSortBy} onChange={handleSortChange} showRelevance={hasActiveSearch} />
              </div>
            </div>

            {products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.slice(0, productsToShow).map((product) => (
                    <HomeStyleProductCard key={product._id} product={product} />
                  ))}
                </div>
                {productsToShow < products.length && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={() => setProductsToShow((prev) => prev + 15)}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors font-semibold"
                    >
                      <TranslatedText>Load More</TranslatedText>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg"><TranslatedText>No products found</TranslatedText></div>
                <p className="text-gray-400 mt-2"><TranslatedText>Try adjusting your filters or search terms</TranslatedText></p>
              </div>
            )}
          </div>
        </div>

        {/* SEO Content Display - Full Width After Products */}
        {seoContent && !searchQuery.trim() && products.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mt-8">
            <div
              className="prose prose-lg max-w-none text-gray-700 
                [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-gray-900
                [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-gray-800
                [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-gray-800
                [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:mb-2 [&_h4]:mt-3 [&_h4]:text-gray-700
                [&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-gray-700
                [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ul]:space-y-2
                [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_ol]:space-y-2
                [&_li]:text-gray-700 [&_li]:leading-relaxed
                [&_strong]:font-bold [&_strong]:text-gray-900
                [&_em]:italic
                [&_a]:text-blue-600 [&_a]:underline [&_a]:hover:text-blue-800
                [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4
                [&_code]:bg-gray-100 [&_code]:px-2 [&_code]:py-1 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
                [&_pre]:bg-gray-100 [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:mb-4
                [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4
                [&_th]:border [&_th]:border-gray-300 [&_th]:px-4 [&_th]:py-2 [&_th]:bg-gray-100 [&_th]:font-semibold
                [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2"
              dangerouslySetInnerHTML={{ __html: seoContent }}
            />
          </div>
        )}
      </div>
      {(() => {
        const pathSegments = location.pathname.split("/").filter(Boolean)
        const hasLang = pathSegments[0] && /^[a-z]{2}-[a-z]{2}$/i.test(pathSegments[0])
        const startIdx = hasLang ? 1 : 0
        const pageName = pathSegments[startIdx]
        const isCategoryPage = pageName === "product-category" || (pageName === "shop" && pathSegments.length > startIdx + 1)
        const popupPageKey = isCategoryPage ? "category" : "shop"
        return <PromoPopup pageKey={popupPageKey} delayMs={3000} />
      })()}
    </div>
  )
}

export default Shop
