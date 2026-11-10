 
"use client"

import { useState, useEffect, useRef } from "react"
import { getOptimizedImageUrl } from "../utils/imageUtils"

import config from "../config/config"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { generateShopURL } from "../utils/urlUtils"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import { useCart } from "../context/CartContext"
import { useWishlist } from "../context/WishlistContext"
import { useLanguage } from "../context/LanguageContext"
import { useReferral } from "../context/ReferralContext"
import ReferralModal from "./ReferralModal"
import AnnouncementBar from "./AnnouncementBar"
import TranslatedText from "./TranslatedText"
import { preloadTranslations } from "../LanguageModel/translationService"
import {
  Search,
  Heart,
  User,
  ShoppingCart,
  ShoppingBag,
  Menu,
  X,
  Home,
  Grid3X3,
  UserCircle,
  HelpCircle,
  Package,
  ChevronDown,
  ChevronRight,
  Truck,
  ChevronLeft,
  Gift,
} from "lucide-react"
import axios from "axios"
import { getCategoryTreeCached } from "../services/categoryTreeCache"

// Recursive component for mobile subcategory rendering
const MobileSubCategoryItem = ({ 
  subCategory, 
  parentCategory, 
  level, 
  expandedId, 
  onToggle, 
  closeMobileMenu,
  parentChain = []
}) => {
  // Helper to get children of current subcategory
  const getChildSubCategories = (parentNodeId) => {
    const stack = []
    // Get all categories from window context (we'll pass this data)
    const categories = window.__navbarCategories || []
    for (const c of categories) {
      if (Array.isArray(c.children)) stack.push(...c.children)
    }
    const visited = new Set()
    while (stack.length) {
      const node = stack.pop()
      if (!node || visited.has(node._id)) continue
      visited.add(node._id)
      if (node._id === parentNodeId) {
        return Array.isArray(node.children) ? node.children : []
      }
      if (Array.isArray(node.children) && node.children.length) {
        stack.push(...node.children)
      }
    }
    return []
  }

  const nestedChildren = getChildSubCategories(subCategory._id)
  const hasNested = nestedChildren && nestedChildren.length > 0
  const isExpanded = Array.isArray(expandedId) ? expandedId.includes(subCategory._id) : expandedId === subCategory._id

  const getNodeIdentifier = (nodeOrValue) => {
    if (!nodeOrValue) return null
    if (typeof nodeOrValue === "string") return nodeOrValue
    return nodeOrValue.slug || nodeOrValue._id || nodeOrValue.name || null
  }
  
  // Build the URL params based on level
  const buildUrlParams = () => {
    const params = { parentCategory: getNodeIdentifier(parentCategory) }
    const chain = [...parentChain, getNodeIdentifier(subCategory)]
    
    if (level === 1) params.subcategory = chain[0]
    else if (level === 2) {
      params.subcategory = chain[0]
      params.subcategory2 = chain[1]
    } else if (level === 3) {
      params.subcategory = chain[0]
      params.subcategory2 = chain[1]
      params.subcategory3 = chain[2]
    } else if (level === 4) {
      params.subcategory = chain[0]
      params.subcategory2 = chain[1]
      params.subcategory3 = chain[2]
      params.subcategory4 = chain[3]
    }
    
    return params
  }

  const textSizeClass = level === 1 ? 'text-sm' : level === 2 ? 'text-xs' : 'text-xs'
  const textColorClass = level === 1 ? 'text-red-600' : 'text-gray-700'
  
  // Visual hierarchy for arrow buttons based on level
  const getArrowButtonStyles = () => {
    switch(level) {
      case 1:
        return 'w-7 h-7 bg-lime-500 hover:bg-lime-600 shadow-sm'
      case 2:
        return 'w-6 h-6 bg-lime-400 hover:bg-lime-500 shadow-sm'
      case 3:
        return 'w-5 h-5 bg-lime-300 hover:bg-lime-400'
      default:
        return 'w-5 h-5 bg-lime-200 hover:bg-lime-300'
    }
  }
  
  const getArrowIconSize = () => {
    switch(level) {
      case 1:
        return 16
      case 2:
        return 14
      default:
        return 12
    }
  }

  return (
    <div className="space-y-1">
      <div className={`flex items-center justify-between py-2 px-2 ${textColorClass} hover:bg-gray-50 rounded-lg ${textSizeClass}`}>
        <Link
          to={generateShopURL(buildUrlParams())}
          className="flex-1"
          onClick={closeMobileMenu}
        >
          <strong><TranslatedText text={subCategory.name} sourceDoc={subCategory} fieldName="name" /></strong>
        </Link>
        {hasNested && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggle(subCategory._id)
            }}
            className={`ml-2 inline-flex items-center justify-center rounded-full text-white focus:outline-none focus:ring-2 focus:ring-lime-500 active:scale-95 transition ${getArrowButtonStyles()}`}
            aria-expanded={isExpanded}
            aria-controls={`mobile-subcat-${subCategory._id}`}
          >
            {isExpanded ? (
              <ChevronDown size={getArrowIconSize()} />
            ) : (
              <ChevronRight size={getArrowIconSize()} />
            )}
          </button>
        )}
      </div>

      {hasNested && isExpanded && (
        <div id={`mobile-subcat-${subCategory._id}`} className="ml-4 space-y-1 pb-2">
          {nestedChildren.map((nested) => (
            <MobileSubCategoryItem
              key={nested._id}
              subCategory={nested}
              parentCategory={parentCategory}
              level={level + 1}
              expandedId={expandedId}
              onToggle={onToggle}
              closeMobileMenu={closeMobileMenu}
              parentChain={[...parentChain, getNodeIdentifier(subCategory)]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// The "All Categories" dropdown is redundant while every category fits in the bar --
// each one already opens its own menu on hover. Flip this to true to bring it back.
const SHOW_ALL_CATEGORIES_MENU = false

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth()
  const { logos } = useTheme()
  const { cartCount, openCart } = useCart()
  const { wishlist } = useWishlist()
  const { currentLanguage, getLocalizedPath } = useLanguage()
  const { isEnabled: referralEnabled } = useReferral()
  const navigate = useNavigate()
  const location = useLocation()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isReferralOpen, setIsReferralOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchInputRef = useRef(null)
  const searchDropdownRef = useRef(null)
  const mobileSearchInputRef = useRef(null)
  const mobileSearchDropdownRef = useRef(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [categories, setCategories] = useState([]) // now contains nested tree nodes: { _id, name, slug, children: [] }
  const [flatSubCategories, setFlatSubCategories] = useState([]) // keep for backward compatibility / other components
  const [hoveredCategory, setHoveredCategory] = useState(null)
  const [hoveredSubCategory1, setHoveredSubCategory1] = useState(null) // For Level 2
  const [hoveredSubCategory2, setHoveredSubCategory2] = useState(null) // For Level 3
  const [hoveredSubCategory3, setHoveredSubCategory3] = useState(null) // For Level 4
  const [expandedMobileCategory, setExpandedMobileCategory] = useState(null)
  const [expandedMobileSubCategories, setExpandedMobileSubCategories] = useState([])
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  // The desktop header keeps a search icon rather than a permanent search box, so the
  // logo can sit centred. Clicking it drops the full search row open beneath the logo.
  const [isDesktopSearchOpen, setIsDesktopSearchOpen] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  )
  const [isDesktopCategoryDropdownOpen, setIsDesktopCategoryDropdownOpen] = useState(false)
  const [desktopCascadeIds, setDesktopCascadeIds] = useState([]) // [parentId, level1Id, level2Id, ...]
  const profileRef = useRef(null)
  const profileButtonRef = useRef(null)
  const desktopCategoryDropdownRef = useRef(null)
  const categoryScrollRef = useRef(null)
  const [categoryScrollState, setCategoryScrollState] = useState({
    canScrollPrev: false,
    canScrollNext: false,
  })
  // Timeout refs for delayed hover states
  const categoryTimeoutRef = useRef(null)
  const categoryOpenTimeoutRef = useRef(null)
  const subCategory1TimeoutRef = useRef(null)
  const subCategory2TimeoutRef = useRef(null)
  const subCategory3TimeoutRef = useRef(null)
  // Tiny in-memory cache to speed up repeated candidate lookups during typing
  const liveSearchCacheRef = useRef(new Map())
  // Direction states (simple midpoint rule: items left of screen center open right, else open left)
  const [level2Dir, setLevel2Dir] = useState('right')
  const [level3Dir, setLevel3Dir] = useState('right')
  const [level4Dir, setLevel4Dir] = useState('right')
  const [activeCategoryRect, setActiveCategoryRect] = useState(null)
  const megaContentRef = useRef(null)
  const [megaScrollState, setMegaScrollState] = useState({ canScrollLeft: false, canScrollRight: false })
  const MEGA_LABEL_LIMIT_CLASS = "whitespace-normal break-words //max-w-[23ch]"
  const CATEGORY_OPEN_DELAY = 220
  const CATEGORY_DROPDOWN_MARGIN = 16
  const CATEGORY_DROPDOWN_GAP = 6
  const MAX_CATEGORY_DROPDOWN_WIDTH = 1320
  const DESKTOP_MAX_CONTAINER_WIDTH = 1360

  // Decide direction based on available space rather than midpoint
  const MIN_PANEL_WIDTH = 260 // px (matches min-w[240] + padding/margins)
  const computeRightDir = (rect) => {
    if (!rect) return 'right'
    const rightSpace = window.innerWidth - rect.right
    const leftSpace = rect.left
    if (rightSpace >= MIN_PANEL_WIDTH) return 'right'
    if (leftSpace >= MIN_PANEL_WIDTH) return 'left'
    return rightSpace >= leftSpace ? 'right' : 'left'
  }
  const computeLeftDir = (rect) => {
    if (!rect) return 'left'
    const leftSpace = rect.left
    const rightSpace = window.innerWidth - rect.right
    if (leftSpace >= MIN_PANEL_WIDTH) return 'left'
    if (rightSpace >= MIN_PANEL_WIDTH) return 'right'
    return leftSpace >= rightSpace ? 'left' : 'right'
  }

  const getPanelStyle = (rect, direction, width = 280, estimatedHeight = 300) => {
    if (!rect) return {}
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : DESKTOP_MAX_CONTAINER_WIDTH
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 1080
    
    // Vertical positioning - align to the top of the parent item
    const style = {
      top: rect.top
    }
    
    // Horizontal positioning - position inline, right next to the arrow
    const spaceRight = viewportWidth - rect.right
    if (direction === 'right' || spaceRight >= width) {
      // Open to the right, inline with the arrow
      style.left = rect.right + 4 // Small 4px gap for visual separation
    } else {
      // Open to the left if no space on right
      style.right = viewportWidth - rect.left + 4
    }
    
    return style
  }

  const getCategoryDropdownStyle = (rect) => {
    if (!rect) return {}
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : DESKTOP_MAX_CONTAINER_WIDTH
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 1080
    
    // Calculate padding based on screen size (matching the slider container)
    let horizontalPadding = 16 // Default: px-4 (4 * 4 = 16px on each side)
    if (viewportWidth >= 1536) {
      horizontalPadding = 48 // 2xl:px-12 (12 * 4 = 48px)
    } else if (viewportWidth >= 1280) {
      horizontalPadding = 32 // xl:px-8 (8 * 4 = 32px)
    }
    
    // The navbar container has max-w-[1360px] and is centered
    const maxContainerWidth = DESKTOP_MAX_CONTAINER_WIDTH
    const containerWidth = Math.min(viewportWidth, maxContainerWidth)
    
    // Calculate centering offset when viewport is wider than max container
    const containerOffset = viewportWidth > maxContainerWidth 
      ? (viewportWidth - maxContainerWidth) / 2 
      : 0
    
    // Match the slider container width exactly (container width minus padding)
    const dropdownWidth = containerWidth - (horizontalPadding * 2)
    const dropdownLeft = containerOffset + horizontalPadding
    
    // Use rect.bottom to position below the category bar, ensuring no overlap
    const dropdownTop = rect.bottom + 2
    
    return {
      left: `${dropdownLeft}px`,
      top: `${dropdownTop}px`,
      width: `${dropdownWidth}px`,
      height: "400px",
    }
  }

  const resetMegaMenu = () => {
    setHoveredCategory(null)
    setHoveredSubCategory1(null)
    setHoveredSubCategory2(null)
    setHoveredSubCategory3(null)
    setActiveCategoryRect(null)
  }

  const updateMegaScrollState = () => {
    const el = megaContentRef.current
    if (!el) {
      setMegaScrollState({ canScrollLeft: false, canScrollRight: false })
      return
    }
    const { scrollLeft, clientWidth, scrollWidth } = el
    setMegaScrollState({
      canScrollLeft: scrollLeft > 8,
      canScrollRight: scrollLeft + clientWidth < scrollWidth - 8,
    })
  }

  const handleMegaScroll = (direction) => {
    const el = megaContentRef.current
    if (!el) return
    const offset = direction === "left" ? -320 : 320
    el.scrollBy({ left: offset, behavior: "smooth" })
  }

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])


  // Fetch categories and subcategories from API
  const fetchCategoryTree = async ({ preloadLanguage = !isMobileViewport } = {}) => {
    try {
      if (categories.length > 0) return categories
      const treeData = await getCategoryTreeCached()
      setCategories(treeData)
      // Store categories globally for mobile subcategory component
      if (typeof window !== 'undefined') {
        window.__navbarCategories = treeData
      }
      // Derive flat subcategories from tree to avoid an extra heavy /api/subcategories request.
      const derivedSubs = []
      const collectSubcategories = (nodes) => {
        if (!Array.isArray(nodes)) return
        for (const node of nodes) {
          if (node && node._id && node.name) derivedSubs.push(node)
          if (Array.isArray(node.children)) collectSubcategories(node.children)
        }
      }
      for (const category of treeData) {
        if (Array.isArray(category.children)) collectSubcategories(category.children)
      }
      setFlatSubCategories(derivedSubs)
      
      // Preload translations for all category and subcategory names when in Arabic mode
      if (preloadLanguage && currentLanguage.code === 'ar') {
        const allNames = []
        
        // Recursively collect all names from the tree
        const collectNames = (nodes) => {
          if (!Array.isArray(nodes)) return
          for (const node of nodes) {
            if (node.name) allNames.push(node.name)
            if (Array.isArray(node.children)) {
              collectNames(node.children)
            }
          }
        }
        
        collectNames(treeData)
        
        // Also add derived flat subcategories
        for (const sub of derivedSubs) {
          if (sub.name && !allNames.includes(sub.name)) {
            allNames.push(sub.name)
          }
        }
        
        if (allNames.length > 0) {
          console.log(`[Navbar] Preloading ${allNames.length} category/subcategory translations`)
          preloadTranslations(allNames, 'ar')
        }
      }

      return treeData
    } catch (error) {
      console.error("Error fetching category tree:", error)
      return []
    }
  }

  // Helpers now use tree structure
  const getSubCategoriesForCategory = (categoryId) => {
    const cat = categories.find((c) => c._id === categoryId)
    if (!cat || !Array.isArray(cat.children)) return []
    // Level 1 nodes: nodes with level === 1 OR no level property (import fallback)
    return cat.children.filter((n) => !n.level || n.level === 1)
  }

  const getChildSubCategories = (parentNodeId) => {
    // We need a lookup: flatten categories children recursively once (memoized by ref) OR derive by search each time for simplicity.
    // Simplicity approach: depth-first search for node id and return its children.
    const stack = []
    for (const c of categories) {
      if (Array.isArray(c.children)) stack.push(...c.children)
    }
    const visited = new Set()
    while (stack.length) {
      const node = stack.pop()
      if (!node || visited.has(node._id)) continue
      visited.add(node._id)
      if (node._id === parentNodeId) {
        return Array.isArray(node.children) ? node.children : []
      }
      if (Array.isArray(node.children) && node.children.length) {
        stack.push(...node.children)
      }
    }
    return []
  }

  const getNodeIdentifier = (nodeOrValue) => {
    if (!nodeOrValue) return null
    if (typeof nodeOrValue === "string") return nodeOrValue
    return nodeOrValue.slug || nodeOrValue._id || nodeOrValue.name || null
  }

  const toggleMobileCategory = (categoryId) => {
    setExpandedMobileCategory((prev) => (prev === categoryId ? null : categoryId))
    setExpandedMobileSubCategories([])
  }

  const handleMobileSubCategoryToggle = (subCategoryId) => {
    setExpandedMobileSubCategories((prev) => {
      if (prev.includes(subCategoryId)) {
        // Remove this ID and all its children
        return prev.filter(id => id !== subCategoryId)
      } else {
        // Add this ID to the array
        return [...prev, subCategoryId]
      }
    })
  }

  // Function to check if search query matches a product's SKU (or name) exactly
  const findExactProductMatch = async (query) => {
    if (!query || query.trim().length === 0) return null

    const normalized = query.trim().toLowerCase()
    try {
      // 1) Try exact SKU lookup via dedicated endpoint (more reliable than fuzzy search)
      const skuCandidates = Array.from(
        new Set([query.trim(), query.trim().toUpperCase(), query.trim().toLowerCase()]),
      )
      try {
        const skuResp = await axios.post(`${config.API_URL}/api/products/by-skus`, { skus: skuCandidates })
        if (Array.isArray(skuResp.data) && skuResp.data.length > 0) {
          // Prefer exact case-insensitive match if multiple
          const exactSku = skuResp.data.find(
            (p) => p.sku && String(p.sku).trim().toLowerCase() === normalized,
          )
          return exactSku || skuResp.data[0]
        }
      } catch (e) {
        // ignore and fall back to search
      }

      // 2) Fallback to existing search endpoint and scan results
      const { data } = await axios.get(
        `${config.API_URL}/api/products?search=${encodeURIComponent(query.trim())}&limit=50`,
      )

      // First, try exact SKU match (case-insensitive)
      const exactSkuMatch = data.find(
        (product) => product.sku && String(product.sku).trim().toLowerCase() === normalized,
      )
      if (exactSkuMatch) return exactSkuMatch

      // Fallback: exact name match (to preserve prior behavior)
      const exactNameMatch = data.find(
        (product) => product.name && String(product.name).trim().toLowerCase() === normalized,
      )
      return exactNameMatch || null
    } catch (error) {
      console.error("Error finding exact product match:", error)
      return null
    }
  }

  // Instant search effect with progressive fallback (words → characters)
  useEffect(() => {
    if (isMobileViewport && !isMobileSearchOpen) {
      return
    }

    const q = searchQuery.trim()
    if (q.length === 0) {
      setSearchResults([])
      setShowSearchDropdown(false)
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)

    // Build candidate queries: full, then drop trailing words, then drop trailing characters
    const buildCandidates = (input) => {
      const unique = new Set()
      const out = []
      const push = (s) => {
        const v = s.trim()
        if (v && !unique.has(v)) {
          unique.add(v)
          out.push(v)
        }
      }

      push(input)
      const words = input.split(/\s+/)
      // Word-prefix candidates (drop last word progressively)
      for (let i = words.length - 1; i >= 1; i--) {
        push(words.slice(0, i).join(" "))
        if (out.length >= 4) break
      }
      // Character-prefix candidates (strategic trims instead of letter-by-letter for speed)
      const base = words[0]
      if (base && base.length > 3) {
        const p70 = base.slice(0, Math.max(3, Math.floor(base.length * 0.7)))
        const p50 = base.slice(0, Math.max(3, Math.floor(base.length * 0.5)))
        push(p70)
        push(p50)
      }
      return out
    }

    const fetchResults = async () => {
      try {
        const candidates = buildCandidates(q)
        for (const cand of candidates) {
          try {
            // 1) Check tiny in-memory cache first
            const cached = liveSearchCacheRef.current.get(cand)
            if (cached) {
              if (!cancelled) {
                if (Array.isArray(cached) && cached.length > 0) {
                  setSearchResults(cached)
                  setShowSearchDropdown(true)
                  return
                }
              }
            }

            // 2) Fallback to API
            const { data } = await axios.get(`${config.API_URL}/api/products?search=${encodeURIComponent(cand)}&limit=5`)
            if (cancelled) return
            // Cache result (including empty) to speed up subsequent key strokes
            liveSearchCacheRef.current.set(cand, Array.isArray(data) ? data : [])
            // Simple cache pruning
            if (liveSearchCacheRef.current.size > 100) {
              liveSearchCacheRef.current.clear()
            }

            if (Array.isArray(data) && data.length > 0) {
              setSearchResults(data)
              setShowSearchDropdown(true)
              return
            }
          } catch (_) {
            // ignore and try next candidate
          }
        }
        // No candidates found
        setSearchResults([])
        setShowSearchDropdown(false)
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }

    const timeout = setTimeout(fetchResults, 180)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [isMobileSearchOpen, isMobileViewport, searchQuery])

  // Hide dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      const clickedInside =
        (searchDropdownRef.current && searchDropdownRef.current.contains(e.target)) ||
        (searchInputRef.current && searchInputRef.current.contains(e.target)) ||
        (mobileSearchDropdownRef.current && mobileSearchDropdownRef.current.contains(e.target)) ||
        (mobileSearchInputRef.current && mobileSearchInputRef.current.contains(e.target))

      if (!clickedInside) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (!isMobileViewport) {
      fetchCategoryTree()
    }
  }, [isMobileViewport])

  // Preload translations when language changes to Arabic (if categories already loaded)
  useEffect(() => {
    if (isMobileViewport) return
    if (currentLanguage.code === 'ar' && categories.length > 0) {
      const allNames = []
      
      // Recursively collect all names from the tree
      const collectNames = (nodes) => {
        if (!Array.isArray(nodes)) return
        for (const node of nodes) {
          if (node.name) allNames.push(node.name)
          if (Array.isArray(node.children)) {
            collectNames(node.children)
          }
        }
      }
      
      collectNames(categories)
      
      // Also add flat subcategories
      for (const sub of flatSubCategories) {
        if (sub.name && !allNames.includes(sub.name)) {
          allNames.push(sub.name)
        }
      }
      
      if (allNames.length > 0) {
        console.log(`[Navbar] Language changed to Arabic - preloading ${allNames.length} translations`)
        preloadTranslations(allNames, 'ar')
      }
    }
  }, [categories, currentLanguage.code, flatSubCategories, isMobileViewport])

  useEffect(() => {
    if (isMobileViewport) return
    if (!hoveredCategory) {
      setMegaScrollState({ canScrollLeft: false, canScrollRight: false })
      return
    }

    const handleResize = () => updateMegaScrollState()
    const rafId = requestAnimationFrame(updateMegaScrollState)

    window.addEventListener("resize", handleResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", handleResize)
    }
  }, [hoveredCategory, isMobileViewport])

  const updateCategoryScrollState = () => {
    const el = categoryScrollRef.current
    if (!el) return

    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)
    const epsilon = 2
    const canScrollPrev = el.scrollLeft > epsilon
    const canScrollNext = el.scrollLeft < maxScrollLeft - epsilon

    setCategoryScrollState((prev) => {
      if (prev.canScrollPrev === canScrollPrev && prev.canScrollNext === canScrollNext) return prev
      return { canScrollPrev, canScrollNext }
    })
  }

  useEffect(() => {
    if (isMobileViewport) return
    updateCategoryScrollState()

    const el = categoryScrollRef.current
    if (!el) return

    let ro
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updateCategoryScrollState())
      ro.observe(el)
    }

    window.addEventListener("resize", updateCategoryScrollState)
    const rafId = requestAnimationFrame(updateCategoryScrollState)

    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener("resize", updateCategoryScrollState)
      cancelAnimationFrame(rafId)
    }
  }, [categories, isMobileViewport])

  // Close profile dropdown on outside click (desktop only)
  useEffect(() => {
    if (!isProfileOpen) return
    function handleProfileClick(e) {
      // Only run on md+ screens
      if (window.innerWidth < 768) return
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(e.target)
      ) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleProfileClick)
    return () => document.removeEventListener("mousedown", handleProfileClick)
  }, [isProfileOpen])

  // Close desktop category dropdown on outside click
  useEffect(() => {
    if (!isDesktopCategoryDropdownOpen) return
    function handleCategoryClick(e) {
      if (window.innerWidth < 768) return
      if (desktopCategoryDropdownRef.current && !desktopCategoryDropdownRef.current.contains(e.target)) {
        setIsDesktopCategoryDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleCategoryClick)
    return () => document.removeEventListener("mousedown", handleCategoryClick)
  }, [isDesktopCategoryDropdownOpen])

  // Cleanup hover timeouts on unmount
  useEffect(() => {
    return () => {
      if (categoryTimeoutRef.current) clearTimeout(categoryTimeoutRef.current)
      if (categoryOpenTimeoutRef.current) clearTimeout(categoryOpenTimeoutRef.current)
      if (subCategory1TimeoutRef.current) clearTimeout(subCategory1TimeoutRef.current)
      if (subCategory2TimeoutRef.current) clearTimeout(subCategory2TimeoutRef.current)
      if (subCategory3TimeoutRef.current) clearTimeout(subCategory3TimeoutRef.current)
    }
  }, [])

  // Check if current path is an admin route
  const isAdminRoute = location.pathname.startsWith("/admin")

  // Don't render navbar for admin routes
  if (isAdminRoute) {
    return null
  }

  const handleLogout = () => {
    logout()
    navigate(getLocalizedPath("/"))
    setIsProfileOpen(false)
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // First, check if the search query matches a product exactly
      const exactMatch = await findExactProductMatch(searchQuery.trim())

      if (exactMatch) {
        // Navigate to product details page
        navigate(getLocalizedPath(`/product/${encodeURIComponent(exactMatch.slug || exactMatch._id)}`))
        setShowSearchDropdown(false)
        setSearchQuery("")
      } else {
        // Navigate to shop page with search results
        navigate(getLocalizedPath(`/shop?search=${encodeURIComponent(searchQuery.trim())}`))
        setShowSearchDropdown(false)
      }
    }
  }

  const toggleMobileMenu = () => {
    const nextIsOpen = !isMobileMenuOpen
    setIsMobileMenuOpen(nextIsOpen)
    setExpandedMobileCategory(null) // Reset expanded category when menu closes
    if (nextIsOpen && categories.length === 0) {
      fetchCategoryTree({ preloadLanguage: true })
    }
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
    setExpandedMobileCategory(null)
  }

  const toggleDesktopCategoryDropdown = () => {
    setIsDesktopCategoryDropdownOpen((prev) => {
      const next = !prev
      if (next) setDesktopCascadeIds([])
      return next
    })
  }

  const closeDesktopCategoryDropdown = () => {
    setIsDesktopCategoryDropdownOpen(false)
    setDesktopCascadeIds([])
  }

  const handleMobileSearchOpen = () => {
    setIsMobileSearchOpen(true)
  }
  const handleMobileSearchClose = () => {
    setIsMobileSearchOpen(false)
  }

  const scrollPrev = () => {
    if (!categoryScrollState.canScrollPrev) return
    const el = categoryScrollRef.current
    if (!el) return
    const amount = Math.max(180, Math.round(el.clientWidth * 0.7))
    el.scrollBy({ left: -amount, behavior: "smooth" })
    resetMegaMenu()
    requestAnimationFrame(updateCategoryScrollState)
  }

  const scrollNext = () => {
    if (!categoryScrollState.canScrollNext) return
    const el = categoryScrollRef.current
    if (!el) return
    const amount = Math.max(180, Math.round(el.clientWidth * 0.7))
    el.scrollBy({ left: amount, behavior: "smooth" })
    resetMegaMenu()
    requestAnimationFrame(updateCategoryScrollState)
  }

  return (
    <>
      {/* Desktop Navbar - Hidden on Mobile */}
      <header className="hidden md:block bg-header-bg text-header-text border-b border-page-border sticky top-0 z-50 w-full">
        <div className="w-full max-w-[1360px] mx-auto">
          {/* Row 1: utilities left, logo centred, actions right. The three columns are
              equal-width so the logo sits on the true centre of the header regardless of
              how wide the side groups get. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 min-h-[76px] xl:min-h-[92px] py-2">
            {/* Left column is deliberately empty so the logo reads as centred, matching
                the reference header. Country, language, Refer & Earn and Download Our App
                all moved into the account menu rather than being dropped. */}
            <div aria-hidden="true" />

            {/* Logo */}
            <Link to={getLocalizedPath("/")} className="justify-self-center py-1 flex items-center" aria-label="Irha&rsquo;s Wardrobe home">
              <img
                src={logos.headerDesktop || "/logo-wide.png"}
                alt={logos.altText || "Logo"}
                width="320"
                height="75"
                className="h-[60px] lg:h-[70px] xl:h-[82px] w-auto max-h-[86px] object-contain transition-all duration-200"
              />
            </Link>

            <div className="flex items-center gap-6 xl:gap-7 justify-self-end">
              {/* Search is an icon here; the full field drops down below the logo. */}
              <button
                type="button"
                onClick={() => setIsDesktopSearchOpen((open) => !open)}
                className="text-header-icon transition hover:text-brand-600"
                aria-label="Search"
                aria-expanded={isDesktopSearchOpen}
              >
                <Search className="w-[22px] h-[22px]" strokeWidth={1.5} />
              </button>

              {/* Account — icon + two-line label */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center text-header-icon transition hover:text-brand-600"
                  ref={profileButtonRef}
                  aria-label={isAuthenticated ? "Account" : "Sign in"}
                >
                  <User className="w-[22px] h-[22px]" strokeWidth={1.5} />
                </button>

                {isProfileOpen && (
                  <div
                    ref={profileRef}
                    className="absolute right-0 w-56 py-2 mt-2 bg-nav-dropdown text-nav-dropdown-text rounded-md shadow-xl z-20 border border-header-border"
                  >
                    {referralEnabled && (
                      <button
                        onClick={() => {
                          setIsProfileOpen(false)
                          setIsReferralOpen(true)
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-lime-700 hover:bg-nav-dropdown-hover hover:text-nav-dropdown-hover-text"
                      >
                        <Gift className="w-4 h-4" />
                        <TranslatedText>Refer &amp; Earn</TranslatedText>
                      </button>
                    )}
                    {isAuthenticated ? (
                      <>
                        <Link
                          to={getLocalizedPath("/profile")}
                          className="block px-4 py-2 text-sm text-nav-dropdown-text hover:bg-nav-dropdown-hover hover:text-nav-dropdown-hover-text"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          My Profile
                        </Link>
                        <Link
                          to={getLocalizedPath("/orders")}
                          className="block px-4 py-2 text-sm text-nav-dropdown-text hover:bg-nav-dropdown-hover hover:text-nav-dropdown-hover-text"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          My Orders
                        </Link>
                        <Link
                          to={getLocalizedPath("/track-order")}
                          className="block px-4 py-2 text-sm text-nav-dropdown-text hover:bg-nav-dropdown-hover hover:text-nav-dropdown-hover-text"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Track Order
                        </Link>
                        <hr className="my-1" />
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-nav-dropdown-text hover:bg-nav-dropdown-hover hover:text-nav-dropdown-hover-text"
                        >
                          Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          to={getLocalizedPath("/login")}
                          className="block px-4 py-2 text-sm text-nav-dropdown-text hover:bg-nav-dropdown-hover hover:text-nav-dropdown-hover-text"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Login
                        </Link>
                        <Link
                          to={getLocalizedPath("/register")}
                          className="block px-4 py-2 text-sm text-nav-dropdown-text hover:bg-nav-dropdown-hover hover:text-nav-dropdown-hover-text"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Register
                        </Link>
                        <Link
                          to={getLocalizedPath("/track-order")}
                          className="block px-4 py-2 text-sm text-nav-dropdown-text hover:bg-nav-dropdown-hover hover:text-nav-dropdown-hover-text"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Track Order
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>


              {/* Wishlist */}
              <Link to={getLocalizedPath("/wishlist")} className="relative text-header-icon transition hover:text-brand-600" aria-label="Wishlist">
                <Heart className="w-[22px] h-[22px]" strokeWidth={1.5} />
                {wishlist.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-header-badge text-header-badge-text text-[10px] rounded-full h-[18px] min-w-[18px] px-1 flex items-center justify-center font-bold">
                    {wishlist.length}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <button
                type="button"
                onClick={openCart}
                className="relative text-header-icon transition hover:text-brand-600"
                aria-label="Cart"
              >
                <ShoppingBag className="w-[22px] h-[22px]" strokeWidth={1.5} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-header-badge text-header-badge-text text-[10px] rounded-full h-[18px] min-w-[18px] px-1 flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Search row -- only rendered when the icon above is toggled on. */}
          {isDesktopSearchOpen && (
            <div className="bg-stone-100 px-4 py-4 sm:px-6">
              <div className="mx-auto w-full max-w-[640px]">
            <div>
              <form onSubmit={handleSearch} className="relative">
                <div className="">
                  {/* A rule under the field rather than a box around it: the band already
                      separates the row from the header, so a second border just boxes a box. */}
                  <div className="flex items-center gap-5">
                    <input
                      type="text"
                      placeholder={currentLanguage.code === "ar" ? "بحث" : "Search"}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="min-w-0 flex-1 border-0 border-b border-stone-400 bg-transparent px-1 pb-1.5 text-base text-stone-900 placeholder:text-stone-500 focus:border-stone-900 focus:outline-none focus:ring-0"
                      ref={searchInputRef}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowSearchDropdown(true)
                      }}
                    />
                    {/* Loading spinner */}
                    {searchLoading && (
                      <span className="flex items-center">
                        <svg
                          className="h-5 w-5 animate-spin text-stone-500"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          ></path>
                        </svg>
                      </span>
                    )}
                    <button
                      type="submit"
                      className="flex flex-shrink-0 items-center gap-1.5 text-base font-bold text-stone-900 transition-colors hover:text-brand-600"
                    >
                      <TranslatedText>Search</TranslatedText>
                      <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </div>
                  {/* Autocomplete Dropdown */}
                  {showSearchDropdown && searchResults.length > 0 && (
                    <div
                      ref={searchDropdownRef}
                      className="absolute left-0 right-0 z-50 mt-3 max-h-96 overflow-y-auto border border-stone-200 bg-white shadow-lg"
                    >
                      {searchResults.map((product) => (
                        <Link
                          key={product._id}
                          to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)}
                          className="flex items-start gap-4 px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                          onClick={() => setShowSearchDropdown(false)}
                        >
                          <img
                            src={getOptimizedImageUrl(product.image, { width: 128, height: 128 }) || "/placeholder.svg"}
                            alt={product.name}
                            loading="lazy"
                            decoding="async"
                            width="64"
                            height="64"
                            className="w-16 h-16 object-contain rounded"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 text-sm line-clamp-2">
                              <TranslatedText text={product.name} sourceDoc={product} fieldName="name" />
                            </div>
                            <div className="text-xs text-gray-500 line-clamp-2">
                              <TranslatedText text={product.description} sourceDoc={product} fieldName="description" />
                            </div>
                          </div>
                        </Link>
                      ))}
                      <Link
                        to={getLocalizedPath(`/shop?search=${encodeURIComponent(searchQuery.trim())}`)}
                        className="block text-center text-lime-600 hover:underline py-2 text-sm font-medium"
                        onClick={() => setShowSearchDropdown(false)}
                      >
                        View all results
                      </Link>
                    </div>
                  )}
                </div>
              </form>
            </div>
              </div>
            </div>
          )}

          {/* Navigation Menu - Dynamic Categories with Dropdowns */}
          <div className="bg-nav-bg text-nav-text border-t border-page-border mt-0 flex relative">
          <div className="w-full">
            <div className="flex items-center h-11 xl:h-12 2xl:h-14 px-4 xl:px-8 2xl:px-12 gap-2 xl:gap-2.5 2xl:gap-3">
              {/* Toggle Button for All Categories */}
              {/* display:none rather than unmounted, so the ref the click-outside handler
                  uses stays attached, and the element takes no space in the flex row. */}
              <div className={SHOW_ALL_CATEGORIES_MENU ? "relative" : "hidden"} ref={desktopCategoryDropdownRef}>
                {SHOW_ALL_CATEGORIES_MENU && (
                  <button
                    type="button"
                    onClick={toggleDesktopCategoryDropdown}
                    className="hidden md:inline-flex items-center gap-2 px-3 xl:px-3.5 py-2 rounded-lg text-nav-text hover:text-nav-hover-text transition text-sm font-semibold whitespace-nowrap"
                    aria-label="All categories"
                  >
                    <span className="text-xs xl:text-sm"><TranslatedText>All Categories</TranslatedText></span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
                
                {/* Desktop Category Dropdown (horizontal cascade) */}
                {isDesktopCategoryDropdownOpen && (
                  <div
                    className="absolute left-0 top-full mt-2 bg-nav-dropdown text-nav-dropdown-text shadow-2xl rounded-lg z-[70] border border-page-border overflow-hidden max-w-[calc(100vw-32px)]"
                    onMouseLeave={() => setDesktopCascadeIds([])}
                  >
                    <div className="flex max-h-[calc(100vh-160px)] overflow-x-auto">
                      <div className="flex min-w-max">
                        {/* Column 0: Parent Categories */}
                        <div className="w-64 border-r border-gray-100 overflow-y-auto">
                          <div className="p-2">
                            {categories.map((parentCategory) => {
                              const level1 = getSubCategoriesForCategory(parentCategory._id)
                              const hasChildren = level1.length > 0
                              const isActive = desktopCascadeIds[0] === parentCategory._id
                              return (
                                <Link
                                  key={parentCategory._id}
                                  to={generateShopURL({ parentCategory: getNodeIdentifier(parentCategory) })}
                                  onMouseEnter={() => setDesktopCascadeIds([parentCategory._id])}
                                  onClick={closeDesktopCategoryDropdown}
                                  className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold text-nav-dropdown-text hover:bg-nav-dropdown-hover hover:text-nav-dropdown-hover-text transition ${
                                    isActive ? "bg-gray-50" : ""
                                  }`}
                                >
                                  <span className="flex-1 pr-2"><TranslatedText text={parentCategory.name} sourceDoc={parentCategory} fieldName="name" /></span>
                                  {hasChildren && <ChevronRight size={14} className="text-gray-400" />}
                                </Link>
                              )
                            })}
                          </div>
                        </div>

                        {(() => {
                          const cols = []
                          const activeParentId = desktopCascadeIds[0]
                          if (!activeParentId) return null
                          const parent = categories.find((c) => c._id === activeParentId)
                          if (!parent) return null

                          const buildParams = (chain) => {
                            const params = { parentCategory: getNodeIdentifier(parent) }
                            const keys = ["subcategory", "subcategory2", "subcategory3", "subcategory4"]
                            for (let i = 0; i < Math.min(chain.length, keys.length); i++) {
                              params[keys[i]] = chain[i]
                            }
                            return params
                          }

                          const getIdentifierById = (id) => {
                            if (!id) return ""
                            const stack = [...categories]
                            const visited = new Set()
                            while (stack.length) {
                              const node = stack.pop()
                              if (!node || visited.has(node._id)) continue
                              visited.add(node._id)
                              if (node._id === id) return getNodeIdentifier(node) || ""
                              if (Array.isArray(node.children) && node.children.length) {
                                stack.push(...node.children)
                              }
                            }
                            return ""
                          }

                          const getItemsForLevel = (levelIndex) => {
                            if (levelIndex === 1) return getSubCategoriesForCategory(activeParentId)
                            const prevSelectedId = desktopCascadeIds[levelIndex - 1]
                            if (!prevSelectedId) return []
                            return getChildSubCategories(prevSelectedId)
                          }

                          for (let levelIndex = 1; levelIndex < 10; levelIndex++) {
                            const items = getItemsForLevel(levelIndex)
                            if (!Array.isArray(items) || items.length === 0) break
                            cols.push(
                              <div key={`col-${levelIndex}`} className="w-64 border-r border-gray-100 last:border-r-0 overflow-y-auto">
                                <div className="p-2">
                                  {items.map((node) => {
                                    const hasNested = Array.isArray(node.children) && node.children.length > 0
                                    const isActive = desktopCascadeIds[levelIndex] === node._id
                                    const chainPrefix = desktopCascadeIds
                                      .slice(1, levelIndex)
                                      .map(getIdentifierById)
                                      .filter(Boolean)
                                    const params = buildParams([...chainPrefix, getNodeIdentifier(node)])
                                    return (
                                      <Link
                                        key={node._id}
                                        to={generateShopURL(params)}
                                        onMouseEnter={() => {
                                          setDesktopCascadeIds((prev) => {
                                            const next = prev.slice(0, levelIndex)
                                            next[levelIndex] = node._id
                                            return next
                                          })
                                        }}
                                        onClick={closeDesktopCategoryDropdown}
                                        className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm text-nav-dropdown-text hover:bg-nav-dropdown-hover hover:text-nav-dropdown-hover-text transition ${
                                          isActive ? "bg-gray-50" : ""
                                        }`}
                                      >
                                        <span className="flex-1 pr-2"><TranslatedText text={node.name} sourceDoc={node} fieldName="name" /></span>
                                        {hasNested && <ChevronRight size={14} className="text-gray-400" />}
                                      </Link>
                                    )
                                  })}
                                </div>
                              </div>,
                            )
                          }
                          return cols
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* The scroll arrows only exist when the row actually overflows. With a
                  handful of categories they never appear; add enough to overflow and
                  they come back on their own. */}
              {categoryScrollState.canScrollPrev && (
                <button
                  type="button"
                  onClick={scrollPrev}
                  className="hidden md:inline-flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-full bg-nav-btn text-nav-btn-text hover:opacity-80 transition"
                  aria-label="Previous categories"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div
                  ref={categoryScrollRef}
                  className="flex items-center justify-center gap-7 xl:gap-9 px-2 overflow-x-auto hide-scrollbar scroll-smooth"
                  onScroll={updateCategoryScrollState}
                >
                  {categories.map((parentCategory) => {
                    const categorySubCategories = getSubCategoriesForCategory(parentCategory._id)
                    const isActiveCategory = hoveredCategory === parentCategory._id
                    return (
                      <div
                        key={parentCategory._id}
                        className="relative flex items-center h-full flex-shrink-0 hover:bg-nav-hover transition-colors"
                        onMouseEnter={(e) => {
                          if (categoryTimeoutRef.current) {
                            clearTimeout(categoryTimeoutRef.current)
                          }
                          if (categoryOpenTimeoutRef.current) {
                            clearTimeout(categoryOpenTimeoutRef.current)
                          }
                          const target = e.currentTarget
                          categoryOpenTimeoutRef.current = setTimeout(() => {
                            setHoveredCategory(parentCategory._id)
                            const rect = target.getBoundingClientRect()
                            setActiveCategoryRect({
                              top: rect.top,
                              bottom: rect.bottom,
                              left: rect.left,
                              right: rect.right,
                              width: rect.width,
                            })
                            categoryOpenTimeoutRef.current = null
                          }, CATEGORY_OPEN_DELAY)
                        }}
                        onMouseLeave={() => {
                          if (categoryOpenTimeoutRef.current) {
                            clearTimeout(categoryOpenTimeoutRef.current)
                            categoryOpenTimeoutRef.current = null
                          }
                          categoryTimeoutRef.current = setTimeout(() => {
                            resetMegaMenu()
                          }, 1000)
                        }}
                      >
                        <Link
                          to={generateShopURL({ parentCategory: getNodeIdentifier(parentCategory) })}
                          className={`text-nav-text hover:text-nav-hover-text font-medium whitespace-nowrap text-[clamp(0.7rem,0.9vw,0.875rem)] px-1 py-2 text-center w-full leading-tight ${
                            isActiveCategory ? "font-semibold" : ""
                          }`}
                        >
                          <TranslatedText text={parentCategory.name} sourceDoc={parentCategory} fieldName="name" />
                        </Link>
                        {isActiveCategory && (
                          <span className="pointer-events-none absolute bottom-0 left-1 right-1 h-1.5 rounded-full bg-nav-indicator shadow-sm" />
                        )}
                        {/* Mega menu panel: show all level-1 columns with their level-2 items at once */}
                        {hoveredCategory === parentCategory._id && categorySubCategories.length > 0 && (
                          <div
                            className="fixed bg-nav-dropdown text-nav-dropdown-text mt-1 shadow-2xl rounded-lg p-5 z-[60] border border-page-border overflow-y-auto"
                            role="menu"
                            aria-label={`${parentCategory.name} menu`}
                            style={{...getCategoryDropdownStyle(activeCategoryRect), maxWidth: 'calc(100vw - 32px)'}}
                            onMouseEnter={() => {
                              if (categoryTimeoutRef.current) clearTimeout(categoryTimeoutRef.current)
                            }}
                            onMouseLeave={() => {
                              categoryTimeoutRef.current = setTimeout(() => {
                                resetMegaMenu()
                              }, 300)
                            }}
                          >
                            <div className="relative">
                              {megaScrollState.canScrollLeft && (
                                <button
                                  type="button"
                                  className="absolute left-0 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-full shadow-md w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100"
                                  onClick={() => handleMegaScroll("left")}
                                  aria-label="Scroll menu left"
                                >
                                  <ChevronLeft size={16} />
                                </button>
                              )}
                              <div
                                ref={megaContentRef}
                                className="flex flex-nowrap items-start gap-4 overflow-x-auto hide-scrollbar px-6 py-2"
                                onScroll={updateMegaScrollState}
                              >
                                {categorySubCategories.map((subCategory) => {
                                  const level2Subs = getChildSubCategories(subCategory._id)
                                  const LEVEL2_ITEMS_PER_COLUMN = 14
                                  const firstColumnLevel2 = level2Subs.slice(0, LEVEL2_ITEMS_PER_COLUMN)
                                  const moreLevel2Items = level2Subs.slice(LEVEL2_ITEMS_PER_COLUMN)
                                  const hasMoreLevel2 = moreLevel2Items.length > 0
                                  
                                  return (
                                    <div key={subCategory._id} className="contents">
                                      {/* Main Column - First Level-2 items */}
                                      <div className="w-[150px] flex-shrink-0 flex flex-col gap-3">
                                        <Link
                                          to={generateShopURL({
                                            parentCategory: getNodeIdentifier(parentCategory),
                                            subcategory: getNodeIdentifier(subCategory),
                                          })}
                                          className={`block text-red-600 text-xs font-semibold hover:text-red-600 ${MEGA_LABEL_LIMIT_CLASS}`}
                                          onClick={() => resetMegaMenu()}
                                        >
                                          <TranslatedText text={subCategory.name} sourceDoc={subCategory} fieldName="name" />
                                        </Link>
                                        <ul className="flex flex-col gap-1 px-1 pb-1 bg-transparent border-none text-left">
                                          {firstColumnLevel2.map((sub2) => {
                                            const level3Subs = getChildSubCategories(sub2._id)
                                            const hasLevel3 = Array.isArray(level3Subs) && level3Subs.length > 0
                                            return (
                                              <li
                                                key={sub2._id}
                                                className="bg-transparent border-none p-0 m-0"
                                              >
                                                <Link
                                                  to={generateShopURL({
                                                    parentCategory: getNodeIdentifier(parentCategory),
                                                    subcategory: getNodeIdentifier(subCategory),
                                                    subcategory2: getNodeIdentifier(sub2),
                                                  })}
                                                  className={`block w-full text-xs text-gray-700 hover:text-red-600 hover:underline leading-snug ${MEGA_LABEL_LIMIT_CLASS}`}
                                                  onClick={() => resetMegaMenu()}
                                                >
                                                  <span className="flex-1 break-words leading-snug text-left"><TranslatedText text={sub2.name} sourceDoc={sub2} fieldName="name" /></span>
                                                </Link>
                                              </li>
                                            )
                                          })}
                                        </ul>
                                      </div>

                                      {/* "More" Column - Remaining Level-2 items */}
                                      {hasMoreLevel2 && (
                                        <div className="w-[150px] flex-shrink-0 flex flex-col gap-3">
                                          <div className={`block text-lime-600 text-xs font-bold uppercase tracking-wide ${MEGA_LABEL_LIMIT_CLASS}`}>
                                            More
                                          </div>
                                          <ul className="flex flex-col gap-1 px-1 pb-1 bg-transparent border-none text-left">
                                            {moreLevel2Items.map((sub2) => {
                                              const level3Subs = getChildSubCategories(sub2._id)
                                              const hasLevel3 = Array.isArray(level3Subs) && level3Subs.length > 0
                                              return (
                                                <li
                                                  key={sub2._id}
                                                  className="bg-transparent border-none p-0 m-0"
                                                >
                                                  <Link
                                                    to={generateShopURL({
                                                      parentCategory: getNodeIdentifier(parentCategory),
                                                      subcategory: getNodeIdentifier(subCategory),
                                                      subcategory2: getNodeIdentifier(sub2),
                                                    })}
                                                    className={`block w-full text-xs text-gray-700 hover:text-red-600 hover:underline leading-snug ${MEGA_LABEL_LIMIT_CLASS}`}
                                                    onClick={() => resetMegaMenu()}
                                                  >
                                                    <span className="flex-1 break-words leading-snug text-left"><TranslatedText text={sub2.name} sourceDoc={sub2} fieldName="name" /></span>
                                                  </Link>
                                                </li>
                                              )
                                            })}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                              {megaScrollState.canScrollRight && (
                                <button
                                  type="button"
                                  className="absolute right-0 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-full shadow-md w-8 h-8 flex items-center justify-center text-gray-700 hover:bg-gray-100"
                                  onClick={() => handleMegaScroll("right")}
                                  aria-label="Scroll menu right"
                                >
                                  <ChevronRight size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              {categoryScrollState.canScrollNext && (
                <button
                  type="button"
                  onClick={scrollNext}
                  className="hidden md:inline-flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-full bg-nav-btn text-nav-btn-text hover:opacity-80 transition"
                  aria-label="Next categories"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>

      {/* Mobile Navbar - Shown only on Mobile */}
      <header className="md:hidden bg-header-bg text-header-text shadow-sm sticky top-0 z-50">
        {/* Mobile Top Bar */}
        <div className="flex items-center justify-between px-4 py-2">
          {/* Hamburger Menu */}
          <button onClick={toggleMobileMenu} className="p-2">
            <Menu size={24} className="text-gray-700" />
          </button>

          {/* Logo */}
          <Link to={getLocalizedPath("/")} className="flex items-center py-1">
            <img
              src={logos.headerMobile || "/logo-wide.png"}
              alt={logos.altText || "Logo"}
              width="200"
              height="48"
              className="h-11 sm:h-12 w-auto max-w-[210px] sm:max-w-[240px] object-contain transition-all duration-200"
            />
          </Link>

          {/* Search Icon */}
          <button className="p-2" onClick={handleMobileSearchOpen} aria-label="Open search">
            <Search size={24} className="text-gray-700" />
          </button>
        </div>
      </header>

      {/* Promo marquee. Sits after BOTH headers: on desktop the mobile header is
          display:none, so it still lands directly under the category row. */}
      <AnnouncementBar />

      {/* Mobile Search Overlay */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50">
          <div className="w-full bg-white p-4 shadow-md relative">
            <div className="flex items-center gap-2">
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (searchQuery.trim()) {
                    // Check for exact match on mobile too
                    const exactMatch = await findExactProductMatch(searchQuery.trim())

                    if (exactMatch) {
                      navigate(getLocalizedPath(`/product/${encodeURIComponent(exactMatch.slug || exactMatch._id)}`))
                      setSearchQuery("")
                    } else {
                      navigate(getLocalizedPath(`/shop?search=${encodeURIComponent(searchQuery.trim())}`))
                    }

                    setShowSearchDropdown(false)
                    handleMobileSearchClose()
                  }
                }}
                className="flex-1 relative"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={currentLanguage.code === "ar" ? "البحث عن المنتجات..." : "Search products..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-lime-500"
                    autoFocus
                    ref={mobileSearchInputRef}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowSearchDropdown(true)
                    }}
                  />
                  {/* Loading spinner */}
                  {searchLoading && (
                    <span className="absolute right-16 top-1/2 transform -translate-y-1/2">
                      <svg
                        className="animate-spin h-5 w-5 text-lime-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                    </span>
                  )}
                  <button type="submit" className="px-4 py-2 bg-header-search text-header-search-text rounded hover:bg-header-search-hover">
                    <Search size={18} />
                  </button>
                </div>
                {/* Mobile Autocomplete Dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div
                    ref={mobileSearchDropdownRef}
                    className="absolute left-0 right-0 bg-white border border-gray-200 shadow-lg rounded z-50 mt-2 max-h-96 overflow-y-auto overflow-x-hidden"
                  >
                    {searchResults.map((product) => (
                      <Link
                        key={product._id}
                        to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                        onClick={() => {
                          setShowSearchDropdown(false)
                          handleMobileSearchClose()
                        }}
                      >
                        <img
                          src={getOptimizedImageUrl(product.image, { width: 96, height: 96 }) || "/placeholder.svg"}
                          alt={product.name}
                          loading="lazy"
                          decoding="async"
                          width="48"
                          height="48"
                          className="w-12 h-12 object-contain rounded flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-sm break-words"><TranslatedText text={product.name} /></div>
                          <div className="text-xs text-gray-500 break-words line-clamp-2"><TranslatedText text={product.description} /></div>
                        </div>
                      </Link>
                    ))}
                    <Link
                      to={getLocalizedPath(`/shop?search=${encodeURIComponent(searchQuery.trim())}`)}
                      className="block text-center text-lime-600 hover:underline py-2 text-sm font-medium"
                      onClick={() => {
                        setShowSearchDropdown(false)
                        handleMobileSearchClose()
                      }}
                    >
                      <TranslatedText>View all results</TranslatedText>
                    </Link>
                  </div>
                )}
              </form>
              <button onClick={handleMobileSearchClose} className="ml-2 p-2" aria-label="Close search">
                <X size={24} className="text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Side Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={closeMobileMenu}></div>

          {/* Drawer */}
          <div className="fixed left-0 top-0 h-full w-80 bg-white shadow-xl overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 bg-nav-bg text-nav-text">
              <div className="flex items-center">
                <UserCircle size={24} className="text-white mr-2" />
                {isAuthenticated ? (
                  <span className="text-white">{`Hello, ${user?.name || "User"}`}</span>
                ) : (
                  <button
                    onClick={() => {
                      closeMobileMenu()
                      navigate(getLocalizedPath('/login'))
                    }}
                    className="text-white font-medium hover:text-white/90 transition-colors"
                  >
                    Hello, <span className="underline"><TranslatedText>Sign in</TranslatedText></span>
                  </button>
                )}
              </div>
              <button onClick={closeMobileMenu} className="p-1">
                <X size={24} className="text-white" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-4">
              {/* Quick Actions */}
              <div className="mb-6">
                <Link
                  to={getLocalizedPath("/orders")}
                  className="flex items-center py-3 text-gray-700 hover:bg-gray-50 rounded-lg px-2"
                  onClick={closeMobileMenu}
                >
                  <Package size={20} className="mr-3" />
                  <strong><TranslatedText>My Orders</TranslatedText></strong>
                </Link>
                <Link
                  to={getLocalizedPath("/track-order")}
                  className="flex items-center py-3 text-gray-700 hover:bg-gray-50 rounded-lg px-2"
                  onClick={closeMobileMenu}
                >
                  <Truck size={20} className="mr-3" />
                  <strong><TranslatedText>Track Order</TranslatedText></strong>
                </Link>
                <Link
                  to={getLocalizedPath("/help")}
                  className="flex items-center py-3 text-gray-700 hover:bg-gray-50 rounded-lg px-2"
                  onClick={closeMobileMenu}
                >
                  <HelpCircle size={20} className="mr-3" />
                  <strong><TranslatedText>Help Center</TranslatedText></strong>
                </Link>
              </div>

              {/* Shop by Category */}
              <div>
                <div className="flex items-center justify-between mb-4 bg-lime-500 text-white rounded px-3 py-2">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                    <Grid3X3 size={18} className="text-white" />
                    <TranslatedText>All Category</TranslatedText>
                  </h3>
                  <Link to={getLocalizedPath("/shop")} className="text-sm text-white hover:text-white/90" onClick={closeMobileMenu}>
                    <TranslatedText>See All</TranslatedText>
                  </Link>
                </div>

                {/* Dynamic Categories List for Mobile */}
                <div className="space-y-2">
                  {/* All In One */}
                  {/* <Link
                    to="/shop"
                    className="flex items-center justify-between py-3 px-2 text-gray-700 hover:bg-gray-50 rounded-lg"
                    onClick={closeMobileMenu}
                  >
                    <div className="flex items-center">
                      <Grid3X3 size={16} className="mr-3" />
                      <span>All Categories</span>
                    </div>
                    <span className="text-gray-400 text-2xl font-bold">›</span>
                  </Link> */}

                  {/* Dynamic Categories with Click-to-Expand */}
                  {categories.map((parentCategory) => {
                    const categorySubCategories = getSubCategoriesForCategory(parentCategory._id)
                    const isExpanded = expandedMobileCategory === parentCategory._id

                    return (
                      <div key={parentCategory._id}>
                        {/* Parent Category Item */}
                        <div className="flex items-center justify-between py-3 px-2 text-gray-700 hover:bg-gray-50 rounded-lg">
                          <Link
                            to={generateShopURL({ parentCategory: getNodeIdentifier(parentCategory) })}
                            className="flex items-center flex-1"
                            onClick={closeMobileMenu}
                          >
                            <strong><TranslatedText text={parentCategory.name} /></strong>
                          </Link>

                          {/* Toggle button for subcategories */}
                          {categorySubCategories.length > 0 ? (
                            <button
                              onClick={() => toggleMobileCategory(parentCategory._id)}
                              aria-label={isExpanded ? "Collapse subcategories" : "Expand subcategories"}
                              aria-expanded={isExpanded}
                              className="ml-2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-lime-500 text-white shadow-sm hover:bg-lime-600 active:scale-95 transition"
                            >
                              {isExpanded ? (
                                <ChevronDown size={20} className="text-white" />
                              ) : (
                                <ChevronRight size={20} className="text-white" />
                              )}
                            </button>
                          ) : (
                            <span className="text-gray-400 text-2xl font-bold">›</span>
                          )}
                        </div>

                        {/* Subcategories - Only show when expanded */}
                        {isExpanded && categorySubCategories.length > 0 && (
                          <div className="ml-4 space-y-1 pb-2">
                            {categorySubCategories.map((subCategory) => {
                              return (
                                <MobileSubCategoryItem
                                  key={subCategory._id}
                                  subCategory={subCategory}
                                  parentCategory={parentCategory}
                                  level={1}
                                  expandedId={expandedMobileSubCategories}
                                  onToggle={handleMobileSubCategoryToggle}
                                  closeMobileMenu={closeMobileMenu}
                                />
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex items-center justify-around py-2">
          {/* Home */}
          <Link to={getLocalizedPath("/")} className="flex flex-col items-center py-2 px-4 text-gray-600 hover:text-lime-500">
            <Home size={20} />
            <span className="text-xs mt-1"><TranslatedText>Home</TranslatedText></span>
          </Link>

          {/* Cart */}
          <button
            type="button"
            onClick={openCart}
            className="flex flex-col items-center py-2 px-4 text-gray-600 hover:text-brand-600 relative"
          >
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
            <span className="text-xs mt-1"><TranslatedText>Cart</TranslatedText></span>
          </button>

          {/* Wishlist */}
          <Link
            to={getLocalizedPath("/wishlist")}
            className="flex flex-col items-center py-2 px-4 text-gray-600 hover:text-lime-500 relative"
            aria-label="Wishlist"
          >
            <Heart size={20} className="" />
            {wishlist.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-header-badge text-header-badge-text text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                {wishlist.length}
              </span>
            )}
            <span className="text-xs mt-1"><TranslatedText>WishList</TranslatedText></span>
          </Link>

          {/* Account */}
          <Link
            to={getLocalizedPath(isAuthenticated ? "/profile" : "/login")}
            className="flex flex-col items-center py-2 px-4 text-gray-600 hover:text-lime-500"
          >
            <UserCircle size={20} />
            <span className="text-xs mt-1"><TranslatedText>Account</TranslatedText></span>
          </Link>
        </div>
      </nav>

      {/* Refer a Friend modal (opened from the navbar pill / profile menu) */}
      <ReferralModal open={isReferralOpen} onClose={() => setIsReferralOpen(false)} />

    </>
  )
}

export default Navbar
