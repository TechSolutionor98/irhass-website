"use client"

import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Search, Menu, X, ShoppingBag, LayoutGrid, ChevronRight, ChevronDown, ChevronLeft } from "lucide-react"
import config from "../config/config"
import { useLanguage } from "../context/LanguageContext"
import { getCategoryTreeCached } from "../services/categoryTreeCache"
import { generateShopURL } from "../utils/urlUtils"

const API_BASE_URL = `${config.API_URL}`

const Header = () => {
  const { getLocalizedPath, currentLanguage } = useLanguage()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showLogo, setShowLogo] = useState(true)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [blogCategories, setBlogCategories] = useState([])
  const [shopCategories, setShopCategories] = useState([])
  const [isBlogDropdownOpen, setIsBlogDropdownOpen] = useState(false)
  const [isAllCategoriesDropdownOpen, setIsAllCategoriesDropdownOpen] = useState(false)
  const [desktopCascadeIds, setDesktopCascadeIds] = useState([])
  const [hoveredCategory, setHoveredCategory] = useState(null)
  const [activeCategoryRect, setActiveCategoryRect] = useState(null)
  const [expandedMobileNodes, setExpandedMobileNodes] = useState({})
  const categoryScrollRef = useRef(null)
  const [categoryScrollState, setCategoryScrollState] = useState({
    canScrollPrev: false,
    canScrollNext: false,
  })

  const blogDropdownRef = useRef(null)
  const allCategoriesDropdownRef = useRef(null)
  const categoryTimeoutRef = useRef(null)
  const categoryOpenTimeoutRef = useRef(null)

  const CATEGORY_OPEN_DELAY = 220
  const isArabic = currentLanguage?.code === "ar"

  const getDisplayName = (node) => {
    if (!node) return ""
    if (!isArabic) return node.name || ""
    return node.nameAr || node.name_ar || node.name || ""
  }

  useEffect(() => {
    fetchNavbarData()
  }, [])

  useEffect(() => {
    if (!isBlogDropdownOpen) return
    const handleOutsideClick = (event) => {
      if (!blogDropdownRef.current?.contains(event.target)) {
        setIsBlogDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [isBlogDropdownOpen])

  useEffect(() => {
    if (!isAllCategoriesDropdownOpen) return
    const handleOutsideClick = (event) => {
      if (!allCategoriesDropdownRef.current?.contains(event.target)) {
        setIsAllCategoriesDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [isAllCategoriesDropdownOpen])

  useEffect(() => {
    return () => {
      if (categoryTimeoutRef.current) clearTimeout(categoryTimeoutRef.current)
      if (categoryOpenTimeoutRef.current) clearTimeout(categoryOpenTimeoutRef.current)
    }
  }, [])

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
    updateCategoryScrollState()

    const el = categoryScrollRef.current
    if (!el) return

    let resizeObserver
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateCategoryScrollState())
      resizeObserver.observe(el)
    }

    window.addEventListener("resize", updateCategoryScrollState)
    const rafId = requestAnimationFrame(updateCategoryScrollState)

    return () => {
      if (resizeObserver) resizeObserver.disconnect()
      window.removeEventListener("resize", updateCategoryScrollState)
      cancelAnimationFrame(rafId)
    }
  }, [shopCategories])

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

  const fetchNavbarData = async () => {
    try {
      const [blogsResponse, categoriesResponse, categoryTree] = await Promise.all([
        fetch(`${API_BASE_URL}/api/blogs?status=published`),
        fetch(`${API_BASE_URL}/api/blog-categories`),
        getCategoryTreeCached(),
      ])

      const blogsData = await blogsResponse.json()
      const blogCategoriesData = await categoriesResponse.json()
      const blogs = Array.isArray(blogsData?.blogs) ? blogsData.blogs : Array.isArray(blogsData) ? blogsData : []
      const allBlogCategories = Array.isArray(blogCategoriesData?.blogCategories)
        ? blogCategoriesData.blogCategories
        : Array.isArray(blogCategoriesData)
          ? blogCategoriesData
          : []

      const categoryBlogs = {}
      blogs.forEach((blog) => {
        const categoryId =
          blog.blogCategory?._id ||
          blog.subCategory4?._id ||
          blog.subCategory3?._id ||
          blog.subCategory2?._id ||
          blog.subCategory1?._id ||
          blog.mainCategory?._id

        if (categoryId && blog.slug) {
          if (!categoryBlogs[categoryId]) categoryBlogs[categoryId] = []
          categoryBlogs[categoryId].push(blog.slug)
        }
      })

      const usedBlogCategories = allBlogCategories
        .filter((category) => categoryBlogs[category._id]?.length)
        .map((category) => {
          const slugs = categoryBlogs[category._id]
          const randomSlug = slugs[Math.floor(Math.random() * slugs.length)]
          return { ...category, randomBlogSlug: randomSlug }
        })

      setBlogCategories(usedBlogCategories)
      setShopCategories(Array.isArray(categoryTree) ? categoryTree : [])
    } catch (error) {
      console.error("Error fetching blog navbar data:", error)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery("")
    }
  }

  const toggleMobileNode = (nodeId) => {
    setExpandedMobileNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }))
  }

  const toggleDesktopCategoryDropdown = () => {
    setIsAllCategoriesDropdownOpen((prev) => {
      const next = !prev
      if (next) setDesktopCascadeIds([])
      return next
    })
    setHoveredCategory(null)
    setActiveCategoryRect(null)
  }

  const closeDesktopCategoryDropdown = () => {
    setIsAllCategoriesDropdownOpen(false)
    setDesktopCascadeIds([])
  }

  const resetMegaMenu = () => {
    setHoveredCategory(null)
    setActiveCategoryRect(null)
  }

  const getSubCategoriesForCategory = (categoryId) => {
    const category = shopCategories.find((item) => item._id === categoryId)
    if (!category || !Array.isArray(category.children)) return []
    return category.children.filter((child) => !child.level || child.level === 1)
  }

  const getChildSubCategories = (parentNodeId) => {
    const stack = []
    for (const category of shopCategories) {
      if (Array.isArray(category.children)) stack.push(...category.children)
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
    return nodeOrValue.slug || nodeOrValue.name || nodeOrValue._id || null
  }

  const buildShopLink = (parentNodeOrIdentifier, subcategoryChain = []) => {
    const params = { parentCategory: getNodeIdentifier(parentNodeOrIdentifier) }
    if (subcategoryChain[0]) params.subcategory = subcategoryChain[0]
    if (subcategoryChain[1]) params.subcategory2 = subcategoryChain[1]
    if (subcategoryChain[2]) params.subcategory3 = subcategoryChain[2]
    if (subcategoryChain[3]) params.subcategory4 = subcategoryChain[3]
    return generateShopURL(params)
  }

  const getCategoryDropdownStyle = (rect) => {
    if (!rect) return {}
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1920

    let horizontalPadding = 16
    if (viewportWidth >= 1536) {
      horizontalPadding = 48
    } else if (viewportWidth >= 1280) {
      horizontalPadding = 40
    } else if (viewportWidth >= 1024) {
      horizontalPadding = 32
    } else if (viewportWidth >= 640) {
      horizontalPadding = 24
    }

    const maxContainerWidth = 1700
    const containerWidth = Math.min(viewportWidth, maxContainerWidth)
    const containerOffset = viewportWidth > maxContainerWidth ? (viewportWidth - maxContainerWidth) / 2 : 0
    const dropdownWidth = containerWidth - horizontalPadding * 2
    const dropdownLeft = containerOffset + horizontalPadding
    const dropdownTop = rect.bottom + 2

    return {
      left: `${dropdownLeft}px`,
      top: `${dropdownTop}px`,
      width: `${dropdownWidth}px`,
      height: "400px",
    }
  }

  const renderNestedNodes = (nodes, parentNodeOrIdentifier, chain = [], level = 1) => {
    if (!Array.isArray(nodes) || nodes.length === 0) return null

    return (
      <div className={`space-y-1 ${level > 1 ? "ml-3 border-l border-gray-100 pl-2" : ""}`}>
        {nodes.map((node, index) => {
          const nextChain = [...chain, getNodeIdentifier(node)]
          const hasChildren = Array.isArray(node.children) && node.children.length > 0
          const fallbackId = `${node.name || "node"}-${nextChain.join("-")}-${index}`
          const nodeId = node._id || fallbackId
          const isExpanded = Boolean(expandedMobileNodes[nodeId])

          return (
            <div key={nodeId}>
              <div
                className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-gray-50 ${
                  level <= 1 ? "text-sm" : "text-xs"
                }`}
              >
                <Link
                  to={buildShopLink(parentNodeOrIdentifier, nextChain)}
                  onClick={() => {
                    setIsMenuOpen(false)
                  }}
                  className="flex-1 font-medium text-gray-800"
                >
                  {getDisplayName(node)}
                </Link>
                {hasChildren && (
                  <button
                    type="button"
                    aria-label={isExpanded ? "Collapse category" : "Expand category"}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleMobileNode(nodeId)
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-lime-500 text-white hover:bg-lime-600"
                  >
                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                )}
              </div>

              {hasChildren && isExpanded && renderNestedNodes(node.children, parentNodeOrIdentifier, nextChain, level + 1)}
            </div>
          )
        })}
      </div>
    )
  }

  const renderRootCategories = () => {
    if (!Array.isArray(shopCategories) || shopCategories.length === 0) {
      return <div className="px-3 py-2 text-sm text-gray-500">{isArabic ? "لا توجد فئات" : "No categories found"}</div>
    }

    return shopCategories.map((parentCategory, index) => {
      const hasChildren = Array.isArray(parentCategory.children) && parentCategory.children.length > 0
      const nodeId = parentCategory._id || `root-${parentCategory.name}-${index}`
      const isExpanded = Boolean(expandedMobileNodes[nodeId])

      return (
        <div key={nodeId}>
          <div className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-gray-50">
            <Link
              to={buildShopLink(parentCategory)}
              onClick={() => {
                setIsMenuOpen(false)
              }}
              className="flex-1 text-sm font-semibold text-gray-900"
            >
              {getDisplayName(parentCategory)}
            </Link>
            {hasChildren && (
              <button
                type="button"
                aria-label={isExpanded ? "Collapse category" : "Expand category"}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  toggleMobileNode(nodeId)
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-lime-500 text-white hover:bg-lime-600"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
          </div>

          {hasChildren && isExpanded && renderNestedNodes(parentCategory.children, parentCategory)}
        </div>
      )
    })
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 -mt-3 sm:pt-2 sticky -top-1 mb-2 z-50">
      <div className="w-full">
        <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="md:hidden grid grid-cols-3 items-center py-3">
            <div className="pl-1">
              <button
                className="p-2 text-gray-700 hover:text-gray-900"
                aria-label="Toggle categories"
                onClick={() => {
                  setIsMenuOpen((v) => !v)
                  setIsMobileSearchOpen(false)
                }}
              >
                {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
            <div className="flex items-center justify-center">
              <Link to="/" className="inline-flex items-center">
                {showLogo ? (
                  <img
                    src="/logo.png"
                    alt="Irha's Wardrobe logo"
                    className="h-11 w-auto object-contain"
                    onError={() => setShowLogo(false)}
                  />
                ) : (
                  <span className="text-lg font-bold text-gray-900">Irha&apos;s Wardrobe</span>
                )}
              </Link>
            </div>
            <div className="flex items-center justify-end pr-1 gap-1">
              {!isMobileSearchOpen && (
                <button
                  className="p-2 text-gray-700 hover:text-gray-900"
                aria-label={isArabic ? "بحث" : "Search"}
                  onClick={() => {
                    setIsMobileSearchOpen(true)
                    setIsMenuOpen(false)
                  }}
                >
                  <Search size={22} />
                </button>
              )}
              <Link to="https://www.irhaas.com/" target="_blank" aria-label={isArabic ? "تسوق الآن" : "Shop Now"} className="p-2 text-gray-700 hover:text-gray-900">
                <ShoppingBag size={20} />
              </Link>
            </div>
          </div>

          {isMobileSearchOpen && (
            <div className="md:hidden pb-3">
              <form onSubmit={handleSearch} className="w-full">
                <div className="flex items-center bg-white rounded-md overflow-hidden">
                  <input
                    type="text"
                    placeholder={isArabic ? "بحث" : "Search"}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 h-10 px-3 outline-none border border-lime-300"
                    autoFocus
                  />
                  <div className="flex items-center h-10 mr-1 text-white">
                    <button type="submit" aria-label={isArabic ? "بحث" : "Search"} className="h-10 w-10 flex items-center justify-center bg-lime-500 hover:bg-lime-600/90">
                      <Search size={22} />
                    </button>
                    <span aria-hidden className="h-6 w-px" />
                    <button
                      type="button"
                      aria-label={isArabic ? "إغلاق البحث" : "Close search"}
                      onClick={() => setIsMobileSearchOpen(false)}
                      className="h-10 w-10 flex items-center justify-center text-gray-500 hover:text-gray-700 ml-1"
                    >
                      <X size={28} />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="hidden md:grid grid-cols-[auto,auto,minmax(0,1fr),auto,auto] items-center my-3 gap-4 min-h-[56px]">
            <Link to="/" className="flex items-center space-x-2 justify-self-start">
              {showLogo ? (
                <img
                  src="/logo.png"
                  alt="Irha's Wardrobe logo"
                  className="h-16 xl:h-20 w-auto object-contain"
                  onError={() => setShowLogo(false)}
                />
              ) : (
                <h1 className="text-xl font-bold text-gray-900">Irha&apos;s Wardrobe</h1>
              )}
            </Link>

            <div className="relative flex items-center justify-center px-2" ref={blogDropdownRef}>
              <button
                type="button"
                onClick={() => setIsBlogDropdownOpen((v) => !v)}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-gray-300 text-gray-700 text-center hover:border-lime-500 hover:text-lime-600"
              >
                <span className="text-sm font-medium">{isArabic ? "المواضيع" : "Topics"}</span>
                <ChevronDown size={16} className={isBlogDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              </button>

              {isBlogDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 min-w-56 max-h-96 overflow-y-auto rounded-md bg-white py-2 shadow-lg ring-1 ring-black/10 z-40">
                  <Link
                    to={getLocalizedPath("/blogs")}
                    className="block px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    onClick={() => setIsBlogDropdownOpen(false)}
                  >
                    {isArabic ? "كل المدونات" : "All Blogs"}
                  </Link>
                  {blogCategories.map((category) => (
                    <Link
                      key={category._id}
                      to={getLocalizedPath(`/blogs/${category.randomBlogSlug}`)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setIsBlogDropdownOpen(false)}
                    >
                      {getDisplayName(category)}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSearch} className="w-full max-w-[620px] justify-self-start">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={isArabic ? "بحث" : "Search"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 px-4 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-lime-500 focus:border-lime-500"
                />
                <button
                  type="submit"
                  aria-label={isArabic ? "بحث" : "Search"}
                  className="h-12 w-14 bg-lime-500 text-white flex items-center justify-center hover:bg-lime-600 transition-colors"
                >
                  <Search size={16} />
                </button>
              </div>
            </form>

            <Link
              to="https://www.irhaas.com/"
              target="_blank"
              className="hidden md:flex items-center space-x-2 px-6 py-2 border hover:border-2 border-gray-300 hover:border-lime-300 text-black hover:bg-lime-500 hover:text-white transition-colors font-medium justify-self-end"
            >
              <ShoppingBag size={18} />
              <span>{isArabic ? "تسوق الآن" : "Shop Now"}</span>
            </Link>
          </div>
        </div>

        <div className="hidden md:block bg-lime-500">
          <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
            <div className="grid grid-cols-[auto,auto,1fr,auto,auto] items-center h-10 xl:h-11 2xl:h-12 gap-2 xl:gap-2.5 2xl:gap-3">
              <div className="relative flex-shrink-0" ref={allCategoriesDropdownRef}>
                <button
                  type="button"
                  onClick={toggleDesktopCategoryDropdown}
                  className="hidden md:inline-flex items-center gap-2 px-3 xl:px-3.5 py-2 rounded-lg text-white transition text-sm font-semibold whitespace-nowrap shadow-sm hover:bg-lime-600"
                >
                  <span>{isArabic ? "جميع الفئات" : "All Categories"}</span>
                  <ChevronDown
                    size={16}
                    className={isAllCategoriesDropdownOpen ? "rotate-180 transition-transform" : "transition-transform"}
                  />
                </button>

                {isAllCategoriesDropdownOpen && (
                  <div
                    className="absolute left-0 top-full mt-2 bg-white shadow-2xl rounded-lg z-[70] border border-gray-200 overflow-hidden max-w-[calc(100vw-32px)]"
                    onMouseLeave={() => setDesktopCascadeIds([])}
                  >
                    <div className="flex max-h-[calc(100vh-160px)] overflow-x-auto hide-scrollbar">
                      <div className="flex min-w-max">
                        <div className="w-64 border-r border-gray-100 overflow-y-auto">
                          <div className="p-2">
                            {shopCategories.map((parentCategory) => {
                              const level1 = getSubCategoriesForCategory(parentCategory._id)
                              const hasChildren = level1.length > 0
                              const isActive = desktopCascadeIds[0] === parentCategory._id
                              return (
                                <Link
                                  key={parentCategory._id}
                                  to={buildShopLink(parentCategory)}
                                  onMouseEnter={() => setDesktopCascadeIds([parentCategory._id])}
                                  onClick={closeDesktopCategoryDropdown}
                                  className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold text-gray-800 hover:bg-gray-100 transition ${
                                    isActive ? "bg-gray-50" : ""
                                  }`}
                                >
                                  <span className="flex-1 pr-2">{getDisplayName(parentCategory)}</span>
                                  {hasChildren && <ChevronRight size={14} className="text-gray-400" />}
                                </Link>
                              )
                            })}
                          </div>
                        </div>

                        {(() => {
                          const columns = []
                          const activeParentId = desktopCascadeIds[0]
                          if (!activeParentId) return null
                          const parentCategory = shopCategories.find((item) => item._id === activeParentId)
                          if (!parentCategory) return null

                          const buildParams = (chain) => {
                            const params = { parentCategory: getNodeIdentifier(parentCategory) }
                            const keys = ["subcategory", "subcategory2", "subcategory3", "subcategory4"]
                            for (let i = 0; i < Math.min(chain.length, keys.length); i++) {
                              params[keys[i]] = chain[i]
                            }
                            return params
                          }

                          const getIdentifierById = (id) => {
                            if (!id) return ""
                            const stack = [...shopCategories]
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

                            columns.push(
                              <div key={`col-${levelIndex}`} className="w-64 border-r border-gray-100 last:border-r-0 overflow-y-auto">
                                <div className="p-2">
                                  {items.map((node) => {
                                    const hasNested = Array.isArray(node.children) && node.children.length > 0
                                    const isActive = desktopCascadeIds[levelIndex] === node._id
                                    const chainPrefix = desktopCascadeIds
                                      .slice(1, levelIndex)
                                      .map(getIdentifierById)
                                      .filter(Boolean)

                                    return (
                                      <Link
                                        key={node._id}
                                        to={generateShopURL(buildParams([...chainPrefix, getNodeIdentifier(node)]))}
                                        onMouseEnter={() => {
                                          setDesktopCascadeIds((prev) => {
                                            const next = prev.slice(0, levelIndex)
                                            next[levelIndex] = node._id
                                            return next
                                          })
                                        }}
                                        onClick={closeDesktopCategoryDropdown}
                                        className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition ${
                                          isActive ? "bg-gray-50" : ""
                                        }`}
                                      >
                                        <span className="flex-1 pr-2">{getDisplayName(node)}</span>
                                        {hasNested && <ChevronRight size={14} className="text-gray-400" />}
                                      </Link>
                                    )
                                  })}
                                </div>
                              </div>,
                            )
                          }

                          return columns
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={scrollPrev}
                className="hidden md:inline-flex items-center justify-center w-8 h-8 xl:w-8.5 xl:h-8.5 2xl:w-9 2xl:h-9 rounded-full bg-white text-lime-500 hover:bg-gray-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!categoryScrollState.canScrollPrev}
                aria-label="Previous categories"
              >
                <ChevronLeft className="w-4 h-4 xl:w-[17px] xl:h-[17px] 2xl:w-[18px] 2xl:h-[18px]" />
              </button>

              <nav ref={categoryScrollRef} onScroll={updateCategoryScrollState} className="flex-1 overflow-x-auto hide-scrollbar [scrollbar-width:none] scroll-smooth">
                <ul className="flex items-center gap-4 px-2 whitespace-nowrap pr-2">
                  {shopCategories.map((category, index) => {
                    const categorySubCategories = getSubCategoriesForCategory(category._id)
                    const isActiveCategory = hoveredCategory === category._id

                    return (
                      <li
                        key={category._id || `desktop-cat-${category.name}-${index}`}
                        className="relative flex items-center h-full flex-shrink-0"
                        onMouseEnter={(event) => {
                          if (categoryTimeoutRef.current) clearTimeout(categoryTimeoutRef.current)
                          if (categoryOpenTimeoutRef.current) clearTimeout(categoryOpenTimeoutRef.current)
                          setIsAllCategoriesDropdownOpen(false)
                          setDesktopCascadeIds([])

                          const target = event.currentTarget
                          categoryOpenTimeoutRef.current = setTimeout(() => {
                            setHoveredCategory(category._id)
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
                          }, 320)
                        }}
                      >
                        <Link
                          to={buildShopLink(category)}
                          onClick={resetMegaMenu}
                          className={`text-white hover:text-lime-100 font-medium text-sm py-2 ${
                            isActiveCategory ? "font-semibold" : ""
                          }`}
                        >
                          {getDisplayName(category)}
                        </Link>
                        {isActiveCategory && (
                          <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-1 rounded-full bg-white shadow-sm" />
                        )}

                        {isActiveCategory && categorySubCategories.length > 0 && (
                          <div
                            className="fixed bg-white mt-1 shadow-2xl rounded-lg p-5 z-[60] border border-gray-100 overflow-y-auto"
                            role="menu"
                            aria-label={`${getDisplayName(category)} menu`}
                            style={{ ...getCategoryDropdownStyle(activeCategoryRect), maxWidth: "calc(100vw - 32px)" }}
                            onMouseEnter={() => {
                              if (categoryTimeoutRef.current) clearTimeout(categoryTimeoutRef.current)
                            }}
                            onMouseLeave={() => {
                              categoryTimeoutRef.current = setTimeout(() => {
                                resetMegaMenu()
                              }, 220)
                            }}
                          >
                            <div className="flex flex-nowrap items-start gap-4 overflow-x-auto hide-scrollbar px-2 py-2">
                              {categorySubCategories.map((subCategory) => {
                                const level2Subs = getChildSubCategories(subCategory._id)
                                const level2ItemsPerColumn = 14
                                const firstColumnLevel2 = level2Subs.slice(0, level2ItemsPerColumn)
                                const moreLevel2Items = level2Subs.slice(level2ItemsPerColumn)
                                const hasMoreLevel2 = moreLevel2Items.length > 0

                                return (
                                  <div key={subCategory._id} className="contents">
                                    <div className="w-[160px] flex-shrink-0 flex flex-col gap-3">
                                      <Link
                                        to={buildShopLink(category, [getNodeIdentifier(subCategory)])}
                                        className="block text-red-600 text-xs font-semibold hover:text-red-600"
                                        onClick={resetMegaMenu}
                                      >
                                        {getDisplayName(subCategory)}
                                      </Link>
                                      <ul className="flex flex-col gap-1 px-1 pb-1 text-left">
                                        {firstColumnLevel2.map((sub2) => (
                                          <li key={sub2._id}>
                                            <Link
                                              to={buildShopLink(category, [getNodeIdentifier(subCategory), getNodeIdentifier(sub2)])}
                                              className="block w-full text-xs text-gray-700 hover:text-red-600 hover:underline leading-snug"
                                              onClick={resetMegaMenu}
                                            >
                                              {getDisplayName(sub2)}
                                            </Link>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>

                                    {hasMoreLevel2 && (
                                      <div className="w-[160px] flex-shrink-0 flex flex-col gap-3">
                                        <div className="block text-lime-600 text-xs font-bold uppercase tracking-wide">{isArabic ? "المزيد" : "More"}</div>
                                        <ul className="flex flex-col gap-1 px-1 pb-1 text-left">
                                          {moreLevel2Items.map((sub2) => (
                                            <li key={sub2._id}>
                                              <Link
                                                to={buildShopLink(category, [getNodeIdentifier(subCategory), getNodeIdentifier(sub2)])}
                                                className="block w-full text-xs text-gray-700 hover:text-red-600 hover:underline leading-snug"
                                                onClick={resetMegaMenu}
                                              >
                                                {getDisplayName(sub2)}
                                              </Link>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </nav>

              <button
                type="button"
                onClick={scrollNext}
                className="hidden md:inline-flex items-center justify-center w-8 h-8 xl:w-8.5 xl:h-8.5 2xl:w-9 2xl:h-9 rounded-full bg-white text-lime-500 hover:bg-gray-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!categoryScrollState.canScrollNext}
                aria-label="Next categories"
              >
                <ChevronRight className="w-4 h-4 xl:w-[17px] xl:h-[17px] 2xl:w-[18px] 2xl:h-[18px]" />
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />

            <nav className="absolute top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-xl flex flex-col">
              <div className="flex items-center justify-between bg-lime-500 text-white h-12 w-full px-3">
                <button
                  onClick={() => {
                    navigate(getLocalizedPath("/"))
                    setIsMenuOpen(false)
                  }}
                  className="flex items-center gap-2"
                >
                  <LayoutGrid size={18} />
                  <span className="font-xl text-lg">{isArabic ? "جميع الفئات" : "All Categories"}</span>
                </button>
                <button onClick={() => setIsMenuOpen(false)} aria-label="Close categories" className="text-white">
                  <X size={22} />
                </button>
              </div>

              <div className="border-b border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-800 mb-2">{isArabic ? "فئات المدونة" : "Blog Categories"}</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  <Link to={getLocalizedPath("/blogs")} onClick={() => setIsMenuOpen(false)} className="block text-sm px-2 py-1.5 rounded hover:bg-gray-50">
                    {isArabic ? "كل المدونات" : "All Blogs"}
                  </Link>
                  {blogCategories.map((category) => (
                    <Link
                      key={category._id}
                      to={getLocalizedPath(`/blogs/${category.randomBlogSlug}`)}
                      onClick={() => setIsMenuOpen(false)}
                      className="block text-sm px-2 py-1.5 rounded hover:bg-gray-50"
                    >
                      {getDisplayName(category)}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">{renderRootCategories()}</div>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
