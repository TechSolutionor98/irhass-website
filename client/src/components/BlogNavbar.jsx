"use client"

import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import {
  Search,
  Menu,
  X,
  ShoppingBag,
  Heart,
  User,
  ChevronDown,
} from "lucide-react"
import config from "../config/config"
import { useLanguage } from "../context/LanguageContext"
import { useTheme } from "../context/ThemeContext"
import { useCart } from "../context/CartContext"
import { useWishlist } from "../context/WishlistContext"
import { useAuth } from "../context/AuthContext"
import TranslatedText from "./TranslatedText"

const API_BASE_URL = `${config.API_URL}`

const LOGO_VERSION_BUST = "v=20261112e"
const getFreshLogoUrl = (url) => {
  if (!url || typeof url !== "string") return `/logo-wide.png?${LOGO_VERSION_BUST}`
  if (url.includes("v=")) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}${LOGO_VERSION_BUST}`
}

const BlogNavbar = () => {
  const { getLocalizedPath, currentLanguage } = useLanguage()
  const { logos } = useTheme() || {}
  const { cartCount, openCart } = useCart()
  const { wishlist } = useWishlist()
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [searchQuery, setSearchQuery] = useState("")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [blogCategories, setBlogCategories] = useState([])
  const [isTopicsDropdownOpen, setIsTopicsDropdownOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const topicsDropdownRef = useRef(null)
  const profileRef = useRef(null)
  const profileButtonRef = useRef(null)
  const searchInputRef = useRef(null)

  const isArabic = currentLanguage?.code === "ar"

  const getDisplayName = (node) => {
    if (!node) return ""
    if (!isArabic) return node.name || ""
    return node.nameAr || node.name_ar || node.name || ""
  }

  useEffect(() => {
    const fetchBlogCategories = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/blog-categories`)
        const data = await res.json()
        const categories = Array.isArray(data?.blogCategories)
          ? data.blogCategories
          : Array.isArray(data)
            ? data
            : []
        setBlogCategories(categories)
      } catch (err) {
        console.error("Error fetching blog categories:", err)
      }
    }
    fetchBlogCategories()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (topicsDropdownRef.current && !topicsDropdownRef.current.contains(e.target)) {
        setIsTopicsDropdownOpen(false)
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(e.target)
      ) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(getLocalizedPath(`/blogs?search=${encodeURIComponent(searchQuery.trim())}`))
      setIsMobileSearchOpen(false)
    }
  }

  return (
    <>
      {/* Desktop Blog Navbar - Hidden on Mobile */}
      <header className="hidden md:block bg-header-bg text-header-text border-b border-page-border sticky top-0 z-50 w-full shadow-sm">
        <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="flex items-center justify-between gap-4 xl:gap-6 min-h-[72px] xl:min-h-[82px] py-1.5">
            {/* 1. Left: Logo + Blog Navigation */}
            <div className="flex items-center gap-6 xl:gap-8 flex-1 min-w-0">
              {/* Logo */}
              <Link to={getLocalizedPath("/")} className="py-1 flex items-center flex-shrink-0" aria-label="Irha&rsquo;s Wardrobe home">
                <img
                  src={getFreshLogoUrl(logos?.headerDesktop || "/logo-wide.png")}
                  alt={logos?.altText || "Logo"}
                  width="240"
                  height="54"
                  className="h-[44px] lg:h-[48px] xl:h-[54px] w-auto max-h-[58px] object-contain transition-all duration-200"
                  onError={(e) => {
                    if (!e.currentTarget.src.includes("/logo-wide.png")) {
                      e.currentTarget.src = "/logo-wide.png"
                    }
                  }}
                />
              </Link>

              {/* Inline Blog Navigation */}
              <nav className="flex items-center gap-5 xl:gap-6 flex-nowrap min-w-0 mt-1.5 lg:mt-2" aria-label="Blog Navigation">
                {/* Store Link */}
                <Link
                  to={getLocalizedPath("/shop")}
                  className="text-stone-700 hover:text-black font-semibold text-sm xl:text-[15px] tracking-wide whitespace-nowrap transition-colors py-1.5"
                >
                  <TranslatedText>Store</TranslatedText>
                </Link>

                {/* All Blogs Link */}
                <Link
                  to={getLocalizedPath("/blogs")}
                  className={`text-stone-800 hover:text-black font-semibold text-sm xl:text-[15px] tracking-wide whitespace-nowrap transition-colors relative py-1.5 ${
                    location.pathname === getLocalizedPath("/blogs") && !location.search ? "text-black font-bold" : ""
                  }`}
                >
                  <span>{isArabic ? "كل المدونات" : "All Blogs"}</span>
                  {location.pathname === getLocalizedPath("/blogs") && !location.search && (
                    <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-black rounded-full" />
                  )}
                </Link>

                {/* Blog Categories (Top 4) */}
                {blogCategories.slice(0, 4).map((category) => {
                  const categoryUrl = getLocalizedPath(`/blogs?category=${encodeURIComponent(category.slug || category._id)}`)
                  const isActive = location.search.includes(category.slug || category._id)
                  return (
                    <Link
                      key={category._id}
                      to={categoryUrl}
                      className={`text-stone-800 hover:text-black font-semibold text-sm xl:text-[15px] tracking-wide whitespace-nowrap transition-colors relative py-1.5 ${
                        isActive ? "text-black font-bold" : ""
                      }`}
                    >
                      <span>{getDisplayName(category)}</span>
                      {isActive && (
                        <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-black rounded-full" />
                      )}
                    </Link>
                  )
                })}

                {/* Topics Dropdown (All Topics) */}
                {blogCategories.length > 0 && (
                  <div className="relative" ref={topicsDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsTopicsDropdownOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 text-stone-800 hover:text-black font-semibold text-sm xl:text-[15px] tracking-wide whitespace-nowrap transition-colors py-1.5"
                    >
                      <span>{isArabic ? "المواضيع" : "Topics"}</span>
                      <ChevronDown
                        size={15}
                        className={`transition-transform duration-200 ${isTopicsDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isTopicsDropdownOpen && (
                      <div className="absolute left-0 top-full mt-2 w-64 max-h-96 overflow-y-auto rounded-xl bg-white p-2 shadow-2xl ring-1 ring-black/5 z-50 border border-stone-200">
                        <Link
                          to={getLocalizedPath("/blogs")}
                          className="block px-3.5 py-2.5 rounded-lg text-sm font-semibold text-stone-900 hover:bg-stone-100 transition-colors"
                          onClick={() => setIsTopicsDropdownOpen(false)}
                        >
                          {isArabic ? "كل المدونات" : "All Blogs"}
                        </Link>
                        <div className="h-px bg-stone-100 my-1" />
                        {blogCategories.map((category) => (
                          <Link
                            key={category._id}
                            to={getLocalizedPath(`/blogs?category=${encodeURIComponent(category.slug || category._id)}`)}
                            className="block px-3.5 py-2 rounded-lg text-sm text-stone-700 hover:text-black hover:bg-stone-50 transition-colors"
                            onClick={() => setIsTopicsDropdownOpen(false)}
                          >
                            {getDisplayName(category)}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </nav>
            </div>

            {/* 2. Center/Right: Blog Search Bar */}
            <div className="w-[220px] lg:w-[260px] xl:w-[300px] flex-shrink-0 ml-auto mr-3 xl:mr-4 relative">
              <form onSubmit={handleSearch} className="relative w-full">
                <div className="relative flex items-center w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2 text-sm text-stone-900 focus-within:border-stone-900 focus-within:bg-white focus-within:ring-1 focus-within:ring-stone-900 transition-all">
                  <Search className="w-4 h-4 text-stone-400 mr-2.5 flex-shrink-0" strokeWidth={1.8} />
                  <input
                    type="text"
                    placeholder={isArabic ? "البحث في المدونات..." : "Search blogs..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-0 p-0 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-0"
                    ref={searchInputRef}
                  />
                </div>
              </form>
            </div>

            {/* 3. Right: Wishlist | Cart | Profile */}
            <div className="flex items-center gap-2 xl:gap-3 flex-shrink-0">
              {/* Wishlist */}
              <Link
                to={getLocalizedPath("/wishlist")}
                className="flex flex-col items-center justify-center text-stone-700 hover:text-black px-2 py-1 transition group min-w-[56px]"
                aria-label="Wishlist"
              >
                <div className="relative">
                  <Heart className="w-5 h-5 text-stone-700 group-hover:text-black transition-colors" strokeWidth={1.6} />
                  {wishlist?.length > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-black text-white text-[10px] rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center font-bold">
                      {wishlist.length}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium tracking-tight mt-1 text-stone-700 group-hover:text-black">
                  <TranslatedText>Wishlist</TranslatedText>
                </span>
              </Link>

              {/* Divider */}
              <div className="h-6 w-px bg-stone-200" aria-hidden="true" />

              {/* My Cart */}
              <button
                type="button"
                onClick={openCart}
                className="flex flex-col items-center justify-center text-stone-700 hover:text-black px-2 py-1 transition group min-w-[56px]"
                aria-label="Cart"
              >
                <div className="relative">
                  <ShoppingBag className="w-5 h-5 text-stone-700 group-hover:text-black transition-colors" strokeWidth={1.6} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-black text-white text-[10px] rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center font-bold">
                      {cartCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium tracking-tight mt-1 text-stone-700 group-hover:text-black">
                  <TranslatedText>My Cart</TranslatedText>
                </span>
              </button>

              {/* Divider */}
              <div className="h-6 w-px bg-stone-200" aria-hidden="true" />

              {/* Profile / Account */}
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex flex-col items-center justify-center text-stone-700 hover:text-black px-2 py-1 transition group min-w-[70px]"
                  ref={profileButtonRef}
                  aria-label={isAuthenticated ? "Account" : "Sign in"}
                >
                  <User className="w-5 h-5 text-stone-700 group-hover:text-black transition-colors" strokeWidth={1.6} />
                  <span className="text-[11px] font-medium tracking-tight mt-1 text-stone-700 group-hover:text-black whitespace-nowrap">
                    {isAuthenticated ? (user?.name?.split(" ")[0] || "Account") : "Register / Login"}
                  </span>
                </button>

                {isProfileOpen && (
                  <div
                    ref={profileRef}
                    className="absolute right-0 w-56 py-2 mt-2 bg-white text-stone-900 rounded-xl shadow-2xl z-50 border border-stone-200"
                  >
                    {isAuthenticated ? (
                      <>
                        <div className="px-4 py-2 border-b border-stone-100">
                          <p className="text-xs text-stone-500"><TranslatedText>Signed in as</TranslatedText></p>
                          <p className="text-sm font-semibold truncate text-stone-900">{user?.name || user?.email}</p>
                        </div>
                        <Link
                          to={getLocalizedPath("/profile")}
                          className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-black"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <TranslatedText>My Account</TranslatedText>
                        </Link>
                        <Link
                          to={getLocalizedPath("/user-orders")}
                          className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-black"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <TranslatedText>My Orders</TranslatedText>
                        </Link>
                        <button
                          onClick={() => {
                            logout()
                            setIsProfileOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <TranslatedText>Sign Out</TranslatedText>
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          to={getLocalizedPath("/login")}
                          className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-black"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <TranslatedText>Sign In</TranslatedText>
                        </Link>
                        <Link
                          to={getLocalizedPath("/register")}
                          className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-black"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <TranslatedText>Create Account</TranslatedText>
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Blog Navbar - Shown only on Mobile */}
      <header className="md:hidden bg-header-bg text-header-text shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-3 py-2 min-h-[56px]">
          {/* Hamburger Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 text-stone-800 hover:text-black"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Logo */}
          <Link to={getLocalizedPath("/")} className="flex items-center py-1">
            <img
              src={getFreshLogoUrl(logos?.headerMobile || "/logo-wide.png")}
              alt={logos?.altText || "Logo"}
              width="200"
              height="48"
              className="h-11 sm:h-12 w-auto max-w-[210px] sm:max-w-[240px] object-contain transition-all duration-200"
              onError={(e) => {
                if (!e.currentTarget.src.includes("/logo-wide.png")) {
                  e.currentTarget.src = "/logo-wide.png"
                }
              }}
            />
          </Link>

          {/* Mobile Right Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className="p-1.5 text-stone-800 hover:text-black"
              aria-label="Search"
            >
              <Search size={20} />
            </button>
            <button
              type="button"
              onClick={openCart}
              className="p-1.5 text-stone-800 hover:text-black relative"
              aria-label="Cart"
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar Dropdown */}
        {isMobileSearchOpen && (
          <div className="px-3 pb-3 pt-1 border-t border-stone-200 bg-white">
            <form onSubmit={handleSearch} className="relative w-full">
              <div className="relative flex items-center w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-sm text-stone-900">
                <Search className="w-4 h-4 text-stone-400 mr-2 flex-shrink-0" />
                <input
                  type="text"
                  placeholder={isArabic ? "البحث في المدونات..." : "Search blogs..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-0 p-0 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsMobileSearchOpen(false)}
                  className="p-1 text-stone-400 hover:text-black ml-1"
                >
                  <X size={16} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Mobile Menu Drawer */}
        {isMobileMenuOpen && (
          <div className="border-t border-stone-200 bg-white px-4 py-4 space-y-4 max-h-[calc(100vh-60px)] overflow-y-auto">
            <nav className="space-y-1">
              <Link
                to={getLocalizedPath("/")}
                className="block px-3 py-2.5 rounded-lg text-base font-semibold text-stone-900 hover:bg-stone-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <TranslatedText>Store Home</TranslatedText>
              </Link>
              <Link
                to={getLocalizedPath("/shop")}
                className="block px-3 py-2.5 rounded-lg text-base font-semibold text-stone-900 hover:bg-stone-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <TranslatedText>Shop All</TranslatedText>
              </Link>
              <Link
                to={getLocalizedPath("/blogs")}
                className="block px-3 py-2.5 rounded-lg text-base font-semibold text-stone-900 hover:bg-stone-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {isArabic ? "كل المدونات" : "All Blogs"}
              </Link>
            </nav>

            {blogCategories.length > 0 && (
              <div className="pt-2 border-t border-stone-100">
                <p className="px-3 text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
                  {isArabic ? "المواضيع" : "Blog Topics"}
                </p>
                <div className="space-y-1">
                  {blogCategories.map((cat) => (
                    <Link
                      key={cat._id}
                      to={getLocalizedPath(`/blogs?category=${encodeURIComponent(cat.slug || cat._id)}`)}
                      className="block px-3 py-2 rounded-lg text-sm text-stone-700 hover:text-black hover:bg-stone-50"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {getDisplayName(cat)}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-stone-100 space-y-1">
              <Link
                to={getLocalizedPath("/wishlist")}
                className="block px-3 py-2 rounded-lg text-sm text-stone-700 hover:text-black hover:bg-stone-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <TranslatedText>Wishlist</TranslatedText>
              </Link>
              <Link
                to={getLocalizedPath(isAuthenticated ? "/profile" : "/login")}
                className="block px-3 py-2 rounded-lg text-sm text-stone-700 hover:text-black hover:bg-stone-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <TranslatedText>{isAuthenticated ? "My Account" : "Register / Login"}</TranslatedText>
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  )
}

export default BlogNavbar
