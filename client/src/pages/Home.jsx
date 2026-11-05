"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import axios from "axios"
import { generateShopURL } from "../utils/urlUtils"
import { getFullImageUrl } from "../utils/imageUtils"
import { resolveProductCategoryInfo } from "../utils/productCategory"

import {
  Star,
  Heart,
  ChevronRight,
  CreditCard,
  Truck,
  Headphones,
  CheckCircle,
  Shield,
  Award,
  Bell,
  Tag,
  Calendar,
  ShoppingBag,
  Zap,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import BannerSlider from "../components/BannerSlider"
import PromoBanner from "../components/PromoBanner"
import VideoHero from "../components/VideoHero"
import FeaturedProducts from "../components/FeaturedProducts"
import ProductGallery from "../components/ProductGallery"
import SaleBanner from "../components/SaleBanner"
import ServicePromises from "../components/ServicePromises"
import CategoryShowcase from "../components/CategoryShowcase"
import CategorySliderUpdated from "../components/CategorySliderUpdated"
import { useWishlist } from "../context/WishlistContext"
import { useCart } from "../context/CartContext"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import BrandSlider from "../components/BrandSlider"
import DynamicSection from "../components/DynamicSection"
import TranslatedText from "../components/TranslatedText"
import PromoPopup from "../components/PromoPopup"
import TipTapRenderer from "../components/TipTapRenderer"

import config from "../config/config"


const API_BASE_URL = `${config.API_URL}`

const NOTIF_POPUP_KEY = "notif_popup_shown"
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/

const NEWSLETTER_OPTIONS = [
  { label: "Updates", value: "all", icon: <Bell className="inline mr-2 w-4 h-4" /> },
  { label: "Promotions", value: "promotions", icon: <Tag className="inline mr-2 w-4 h-4" /> },
  { label: "Events", value: "events", icon: <Calendar className="inline mr-2 w-4 h-4" /> },
]

const MOBILE_RESERVED_HEIGHTS = {
  dynamicAboveFold: 260,
  featuredProducts: 430,
  deferredSection: 220,
}

const runWhenIdle = (callback, timeout = 1200) => {
  if (typeof window === "undefined") return () => {}
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(callback, Math.min(timeout, 900))
  return () => window.clearTimeout(id)
}

const MobileReservedSkeleton = ({ height = MOBILE_RESERVED_HEIGHTS.deferredSection, className = "" }) => (
  // Holds the space so the page does not jump when the real thing arrives,
  // without showing a grey box while it waits.
  <div className={`md:hidden mx-3 rounded-2xl ${className}`} style={{ height }} aria-hidden="true" />
)

const getHomeImageProps = (image, fallbackSrc = "", sizes = undefined) => ({
  src: getFullImageUrl(image) || fallbackSrc,
  srcSet: undefined,
  sizes,
})

const getMobileHeroCardImageProps = (image, fallbackSrc = "") =>
  getHomeImageProps(image, fallbackSrc, "(max-width: 767px) calc(50vw - 1rem), 260px")

const getMobileSingleBannerProps = (image, fallbackSrc = "") =>
  getHomeImageProps(image, fallbackSrc, "(max-width: 767px) calc(100vw - 1.5rem), 360px")

const getCategoryBannerProps = (image, fallbackSrc = "") =>
  getHomeImageProps(image, fallbackSrc, "(max-width: 1023px) calc(100vw - 1.5rem), 1311px")

const MobileDeferredContentPlaceholder = () => (
  <div className="md:hidden space-y-4 mt-4">
    <MobileReservedSkeleton height={160} />
    <MobileReservedSkeleton height={280} />
    <MobileReservedSkeleton height={160} />
    <MobileReservedSkeleton height={280} />
    <MobileReservedSkeleton height={220} />
  </div>
)

const Home = () => {
  const { getLocalizedPath } = useLanguage()
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [banners, setBanners] = useState([])
  const [heroBanners, setHeroBanners] = useState([])
  const [mobileBanners, setMobileBanners] = useState([])
  const [homeSeoContent, setHomeSeoContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [categorySlide, setCategorySlide] = useState(0)
  const [mobileProductSlide, setMobileProductSlide] = useState(0)
  const navigate = useNavigate()
  const [brands, setBrands] = useState([])
  const [brandSlide, setBrandSlide] = useState(0)
  const [hpProducts, setHpProducts] = useState([])
  const [dellProducts, setDellProducts] = useState([])
  const [accessoriesProducts, setAccessoriesProducts] = useState([])
  const [acerProducts, setAcerProducts] = useState([])
  const [asusProducts, setAsusProducts] = useState([])
  const [networkingProducts, setNetworkingProducts] = useState([])
  const [msiProducts, setMsiProducts] = useState([])
  const [lenovoProducts, setLenovoProducts] = useState([])
  const [appleProducts, setAppleProducts] = useState([])
  const [samsungProducts, setSamsungProducts] = useState([])
  const [upgradeFeatures, setUpgradeFeatures] = useState([])
  const [selectedBrand, setSelectedBrand] = useState(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [brandCurrentIndex, setBrandCurrentIndex] = useState(0)
  const [brandIndex, setBrandIndex] = useState(0) // <-- moved here
  const sliderRef = useRef(null)
  const [scrollX, setScrollX] = useState(0)
  const [isAutoScrolling, setIsAutoScrolling] = useState(true)
  const [settings, setSettings] = useState(null)
  const [homeSections, setHomeSections] = useState([])
  const [homeBanners, setHomeBanners] = useState([]) // Dynamic home page banners
  const [deviceType, setDeviceType] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "Mobile" : "Desktop"
    }
    return "Desktop"
  })
  const brandUrls = useMemo(
    () => ({
      HP: generateShopURL({ brand: "HP" }),
      Dell: generateShopURL({ brand: "Dell" }),
      ASUS: generateShopURL({ brand: "ASUS" }),
      Acer: generateShopURL({ brand: "Acer" }),
      MSI: generateShopURL({ brand: "MSI" }),
      Lenovo: generateShopURL({ brand: "Lenovo" }),
      Apple: generateShopURL({ brand: "Apple" }),
      Samsung: generateShopURL({ brand: "Samsung" }),
    }),
    [],
  )
  const [showDeferredMobileContent, setShowDeferredMobileContent] = useState(false)
  const isMobileViewport = deviceType === "Mobile"
  const shouldRenderDeferredMobileContent = !isMobileViewport || showDeferredMobileContent
  const { currentCountry } = useCurrency()
  const activeCountryCode = currentCountry?.code || "AE"

  const isBannerVisibleInCountry = (banner, countryCode) => {
    if (!banner) return false
    if (!banner.targetCountries || !Array.isArray(banner.targetCountries) || banner.targetCountries.length === 0) {
      return true
    }
    if (banner.targetCountries.includes("ALL")) {
      return true
    }
    if (!countryCode) return true
    return banner.targetCountries.includes(String(countryCode).toUpperCase())
  }

  const filteredHeroBanners = useMemo(
    () =>
      heroBanners.filter(
        (banner) =>
          banner.deviceType &&
          banner.deviceType.toLowerCase() === deviceType.toLowerCase() &&
          isBannerVisibleInCountry(banner, activeCountryCode),
      ),
    [heroBanners, deviceType, activeCountryCode],
  )
  const homeBannersByKey = useMemo(() => {
    const normalize = (value) => String(value || "").trim().toLowerCase()
    const targetDevice = normalize(deviceType)
    const bannerMap = new Map()

    homeBanners.forEach((banner) => {
      const bannerDevice = normalize(banner.deviceType)
      if (bannerDevice && bannerDevice !== targetDevice) return
      if (!isBannerVisibleInCountry(banner, activeCountryCode)) return
      const key = `${normalize(banner.section)}::${normalize(banner.position)}`
      const current = bannerMap.get(key) || []
      current.push(banner)
      bannerMap.set(key, current)
    })

    return bannerMap
  }, [homeBanners, deviceType, activeCountryCode])

  // Notification popup state
  const [showNotifPopup, setShowNotifPopup] = useState(false)
  const [notifStep, setNotifStep] = useState("ask") // 'ask' | 'email'
  const [notifEmail, setNotifEmail] = useState("")
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState("")
  const [notifSuccess, setNotifSuccess] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState([])

  useEffect(() => {
    function handleResize() {
      setDeviceType(window.innerWidth < 768 ? "Mobile" : "Desktop")
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    // The SEO block is per country, falling back to the default when that country has
    // none of its own.
    axios
      .get(`${API_BASE_URL}/api/seo-pages/public/home`, { params: { country: activeCountryCode } })
      .then((res) => {
        setHomeSeoContent(res.data?.seo?.seoContent || "")
      })
      .catch((err) => {
        console.error("Error loading home page SEO content:", err)
      })
  }, [activeCountryCode])

  useEffect(() => {
    if (!isMobileViewport) {
      setShowDeferredMobileContent(true)
      return
    }
    setShowDeferredMobileContent(false)
    const cleanupDeferredIdle = runWhenIdle(() => setShowDeferredMobileContent(true), 1600)

    const revealDeferredContent = () => setShowDeferredMobileContent(true)
    const revealHeroAndDeferred = () => setShowDeferredMobileContent(true)

    window.addEventListener("scroll", revealDeferredContent, { once: true, passive: true })
    window.addEventListener("pointerdown", revealHeroAndDeferred, { once: true, passive: true })
    window.addEventListener("touchstart", revealHeroAndDeferred, { once: true, passive: true })

    return () => {
      cleanupDeferredIdle()
      window.removeEventListener("scroll", revealDeferredContent)
      window.removeEventListener("pointerdown", revealHeroAndDeferred)
      window.removeEventListener("touchstart", revealHeroAndDeferred)
    }
  }, [isMobileViewport])

  useEffect(() => {
    if (showNotifPopup) return
    if (localStorage.getItem(NOTIF_POPUP_KEY)) return

    let opened = false
    const openPopup = () => {
      if (opened) return
      opened = true
      setShowNotifPopup(true)
    }

    const interactionEvents = ["pointerdown", "keydown", "touchstart", "scroll"]
    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, openPopup, { once: true, passive: true })
    })

    return () => {
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, openPopup)
      })
    }
  }, [showNotifPopup])

  // Helper function to render dynamic section by position
  const renderDynamicSection = (position, options = {}) => {
    const section = homeSections.find(s => s.isActive && s.order === position)
    if (section) {
      // Create a unique key that includes settings to force re-render when settings change
      const settingsKey = section.settings ? JSON.stringify(section.settings) : 'no-settings'
      const uniqueKey = `${section._id}-${section.sectionType}-${settingsKey}`
      return (
        <DynamicSection
          key={uniqueKey}
          section={section}
          reserveMobileLayout={options.reserveMobileLayout}
          mobileReservedHeight={options.mobileReservedHeight}
        />
      )
    }
    // Reserve layout only during initial loading to avoid permanent blank placeholders
    if (options.reserveMobileLayout && isMobileViewport && loading) {
      return <MobileReservedSkeleton height={options.mobileReservedHeight || MOBILE_RESERVED_HEIGHTS.dynamicAboveFold} />
    }
    return null
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const homepageResponse = await axios.get(`${API_BASE_URL}/api/homepage`).catch(() => null)

        const defaultSettings = {
          homeSections: {
            categoryCards: true,
            brandsCards: true,
            productsCards: true,
            flashSaleCards: true,
            limitedSaleCards: true,
          },
        }

        const homePayload = homepageResponse?.data?.success ? homepageResponse.data.data : null

        let categoriesData = []
        let brandsData = []
        let heroData = []
        let promotionalBanners = []
        let mobileData = []
        let homeBannersData = []
        let settingsData = defaultSettings
        let sectionsData = []
        let featured = []
        let hpData = []
        let dellData = []
        let acerData = []
        let asusData = []
        let msiData = []
        let lenovoData = []
        let appleData = []
        let samsungData = []

        if (homePayload) {
          categoriesData = Array.isArray(homePayload.categories) ? homePayload.categories : []
          brandsData = Array.isArray(homePayload.brands) ? homePayload.brands : []
          const bannerGroups = homePayload.banners || {}
          heroData = Array.isArray(bannerGroups.hero) ? bannerGroups.hero : []
          promotionalBanners = Array.isArray(bannerGroups.promotional) ? bannerGroups.promotional : []
          mobileData = Array.isArray(bannerGroups.mobile) ? bannerGroups.mobile : []
          homeBannersData = Array.isArray(bannerGroups.home) ? bannerGroups.home : []

          const needsBannerHydration =
            homeBannersData.length === 0 ||
            homeBannersData.some(
              (banner) =>
                !String(banner?.section || "").trim() || !String(banner?.deviceType || "").trim(),
            )

          if (needsBannerHydration) {
            try {
              const { data: activeBannersRaw } = await axios.get(`${API_BASE_URL}/api/banners?active=true`)
              const activeBanners = Array.isArray(activeBannersRaw) ? activeBannersRaw : []

              if (activeBanners.length > 0) {
                heroData = activeBanners.filter((banner) => banner.position === "hero")
                promotionalBanners = activeBanners.filter((banner) => banner.position === "promotional")
                mobileData = activeBanners.filter((banner) => banner.position === "mobile")
                homeBannersData = activeBanners.filter(
                  (banner) => banner.position && banner.position.startsWith("home-") && banner.isActive,
                )
              }
            } catch (bannerHydrationError) {
              console.warn("Banner hydration fallback failed:", bannerHydrationError)
            }
          }

          settingsData = homePayload.settings || defaultSettings
          sectionsData = Array.isArray(homePayload.homeSections) ? homePayload.homeSections : []
          featured = Array.isArray(homePayload.featuredProducts) ? homePayload.featuredProducts : []

          const byBrand = homePayload.brandProducts || {}
          hpData = Array.isArray(byBrand.hp) ? byBrand.hp : []
          dellData = Array.isArray(byBrand.dell) ? byBrand.dell : []
          acerData = Array.isArray(byBrand.acer) ? byBrand.acer : []
          asusData = Array.isArray(byBrand.asus) ? byBrand.asus : []
          msiData = Array.isArray(byBrand.msi) ? byBrand.msi : []
          lenovoData = Array.isArray(byBrand.lenovo) ? byBrand.lenovo : []
          appleData = Array.isArray(byBrand.apple) ? byBrand.apple : []
          samsungData = Array.isArray(byBrand.samsung) ? byBrand.samsung : []
        } else {
          const [categoriesResponse, brandsResponse, bannersResponse, settingsResponse, sectionsResponse] = await Promise.all([
            axios.get(`${API_BASE_URL}/api/categories`),
            axios.get(`${API_BASE_URL}/api/brands`),
            axios.get(`${API_BASE_URL}/api/banners?active=true`),
            axios.get(`${API_BASE_URL}/api/settings`).catch(() => ({ data: defaultSettings })),
            axios.get(`${API_BASE_URL}/api/home-sections/active`).catch(() => ({ data: [] })),
          ])

          categoriesData = categoriesResponse.data
          brandsData = brandsResponse.data
          const bannersData = bannersResponse.data
          settingsData = settingsResponse.data
          sectionsData = sectionsResponse.data
          heroData = bannersData.filter((banner) => banner.position === "hero")
          promotionalBanners = bannersData.filter((banner) => banner.position === "promotional")
          mobileData = bannersData.filter((banner) => banner.position === "mobile")
          homeBannersData = bannersData.filter(
            (banner) => banner.position && banner.position.startsWith("home-") && banner.isActive,
          )
        }

        const leanValidCategories = Array.isArray(categoriesData)
          ? categoriesData.filter((cat) => {
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
          : []

        const leanValidBrands = Array.isArray(brandsData)
          ? brandsData.filter((brand) => {
              const isValid =
                brand &&
                typeof brand === "object" &&
                brand.name &&
                typeof brand.name === "string" &&
                brand.name.trim() !== "" &&
                brand.isActive !== false &&
                !brand.name.match(/^[0-9a-fA-F]{24}$/) &&
                brand.logo &&
                brand.logo.trim() !== ""
              return isValid
            })
          : []

        const brandIdMap = {}
        for (const brand of leanValidBrands) {
          if (brand?._id && brand?.name) {
            brandIdMap[brand.name.toLowerCase()] = brand._id
          }
        }

        const categoryById = new Map(
          leanValidCategories
            .filter((category) => category?._id)
            .map((category) => [String(category._id), category]),
        )

        const hydrateParentCategoryFromCategoryList = (products = []) =>
          (Array.isArray(products) ? products : []).map((product) => {
            if (!product || typeof product !== "object") return product

            if (typeof product.parentCategory === "string" && categoryById.has(product.parentCategory)) {
              return {
                ...product,
                parentCategory: categoryById.get(product.parentCategory),
              }
            }

            return product
          })

        const hasDisplayableCategoryValue = (value) => {
          if (!value) return false

          if (typeof value === "string") {
            const normalized = value.trim()
            return normalized.length > 0 && !OBJECT_ID_REGEX.test(normalized)
          }

          if (typeof value === "object") {
            const nameCandidate =
              value.displayName || value.name || value.title || value.label || value.categoryName || ""
            const normalized = String(nameCandidate).trim()
            return normalized.length > 0 && !OBJECT_ID_REGEX.test(normalized)
          }

          return false
        }

        const hasCategoryDetails = (product) => {
          if (!product || typeof product !== "object") return false

          const candidates = [
            product.category,
            product.subCategory,
            product.subcategory,
            product.subCategory2,
            product.subCategory3,
            product.subCategory4,
            product.parentCategory,
            product.categoryName,
            product.subCategoryName,
            product.parentCategoryName,
          ]

          return candidates.some(hasDisplayableCategoryValue)
        }

        const shouldRefetchForCategoryIntegrity = (products = []) => {
          if (!Array.isArray(products) || products.length === 0) return true
          return products.some((product) => !hasCategoryDetails(product))
        }

        const categoryIdMap = {}
        for (const category of leanValidCategories) {
          if (category?._id && category?.name) {
            categoryIdMap[category.name.trim().toLowerCase()] = category._id
          }
        }

        setCategories(leanValidCategories)
        setBanners(promotionalBanners)
        setHeroBanners(heroData)
        setMobileBanners(mobileData)
        setHomeBanners(homeBannersData)
        setBrands(leanValidBrands)
        setSettings(settingsData)
        setHomeSections(sectionsData)

        // The brand and category product rails that used to live below the campaign
        // banner are gone, and with them eleven product requests per page load. The
        // sections that remain -- the featured rail, the photo wall -- each fetch
        // exactly what they render.
        setLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        setError("Failed to load data. Please try again later.")
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Infinite loop pixel-based auto-scroll for brands
  useEffect(() => {
    if (!brands.length) return
    let animationFrameId
    let lastTimestamp = null
    const speed = 0.5 // px per frame, adjust for faster/slower scroll

    function step(timestamp) {
      if (!lastTimestamp) lastTimestamp = timestamp
      const elapsed = timestamp - lastTimestamp
      lastTimestamp = timestamp
      if (!sliderRef.current) return
      const track = sliderRef.current
      const totalWidth = track.scrollWidth / 2 // width of one set
      const nextScrollX = scrollX + speed
      if (nextScrollX >= totalWidth) {
        // Instantly reset to the start (no animation)
        track.style.transition = "none"
        setScrollX(0)
        // Force reflow, then restore transition
        setTimeout(() => {
          if (track) track.style.transition = "transform 0.3s linear"
        }, 20)
        animationFrameId = requestAnimationFrame(step)
        return
      }
      setScrollX(nextScrollX)
      animationFrameId = requestAnimationFrame(step)
    }

    if (isAutoScrolling) {
      animationFrameId = requestAnimationFrame(step)
    }
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
    // eslint-disable-next-line
  }, [brands.length, isAutoScrolling, scrollX])

  useEffect(() => {
    if (sliderRef.current) {
      sliderRef.current.style.transform = `translateX(-${scrollX}px)`
    }
  }, [scrollX])

  // Handle infinite loop transitions
  useEffect(() => {
    if (brandCurrentIndex === brands.length) {
      setTimeout(() => {
        setIsTransitioning(false)
        setBrandCurrentIndex(0)
      }, 300)
    } else if (brandCurrentIndex === -1) {
      setTimeout(() => {
        setIsTransitioning(false)
        setBrandCurrentIndex(brands.length - 1)
      }, 300)
    } else {
      setIsTransitioning(true)
    }
  }, [brandCurrentIndex, brands.length])

  const handleCategoryClick = (categoryOrItem) => {
    const getNodeIdentifier = (nodeOrValue) => {
      if (!nodeOrValue) return null
      if (typeof nodeOrValue === "string") return nodeOrValue
      return nodeOrValue.slug || nodeOrValue.name || nodeOrValue._id || null
    }

    // Handle if called with string (legacy compatibility) or object (new format)
    if (typeof categoryOrItem === 'string') {
      // Legacy: string name passed
      const category = categories.find((cat) => cat.name === categoryOrItem)
      if (category && category.name) {
        navigate(generateShopURL({ parentCategory: getNodeIdentifier(category) }))
      } else {
        navigate(`/shop`)
      }
    } else if (categoryOrItem && typeof categoryOrItem === 'object') {
      // New format: full item object passed from CategorySliderUpdated
      const item = categoryOrItem

      // Check if this is a subcategory (has category or parentSubCategory fields)
      const isSubcategory = item.category || item.parentSubCategory

      if (isSubcategory) {
        // This is a subcategory - need to find its parent category and build proper URL
        const parentCategoryId = typeof item.category === 'object' ? item.category._id : item.category
        const parentCategory = categories.find((cat) => cat._id === parentCategoryId)

        if (parentCategory) {
          // Navigate with both parent category and subcategory
          navigate(generateShopURL({
            parentCategory: getNodeIdentifier(parentCategory),
            subcategory: getNodeIdentifier(item)
          }))
        } else {
          // Fallback: just navigate to the subcategory name
          navigate(generateShopURL({ subcategory: getNodeIdentifier(item) }))
        }
      } else {
        // This is a main category
        navigate(generateShopURL({ parentCategory: getNodeIdentifier(item) }))
      }
    }
  }

  const handleBrandClick = (brandName) => {
    navigate(generateShopURL({ brand: brandName }))
  }

  const nextSlide = () => {
    if (currentSlide < featuredProducts.length - 4) {
      setCurrentSlide(currentSlide + 1)
    }
  }

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1)
    }
  }

  const nextCategorySlide = () => {
    const itemsPerSlide = window.innerWidth >= 1024 ? 8 : window.innerWidth >= 768 ? 6 : 4
    const maxSlides = Math.ceil(categories.length / itemsPerSlide) - 1
    if (categorySlide < maxSlides) {
      setCategorySlide(categorySlide + 1)
    }
  }

  const prevCategorySlide = () => {
    if (categorySlide > 0) {
      setCategorySlide(categorySlide - 1)
    }
  }

  const nextMobileProductSlide = () => {
    if (mobileProductSlide < featuredProducts.length - 3) {
      setMobileProductSlide(mobileProductSlide + 1)
    }
  }

  const prevMobileProductSlide = () => {
    if (mobileProductSlide > 0) {
      setMobileProductSlide(mobileProductSlide - 1)
    }
  }

  const nextBrandSlide = () => {
    setBrandCurrentIndex((prev) => (prev + 1) % brands.length)
  }

  const prevBrandSlide = () => {
    setBrandCurrentIndex((prev) => (prev - 1 + brands.length) % brands.length)
  }

  // Calculate how many brands are visible at once
  const getVisibleCount = () => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) return 4
      if (window.innerWidth < 1024) return 6
    }
    return 8
  }
  const visibleCount = getVisibleCount()
  // Remove duplicate totalBrands declaration; use the one for featured brands section only
  const totalBrands = brands.length
  const getVisibleBrands = () => {
    if (!brands.length) return []
    const visible = []
    for (let i = 0; i < visibleCount; i++) {
      visible.push(brands[(brandIndex + i) % totalBrands])
    }
    return visible
  }
  const handlePrevBrand = () => {
    setBrandIndex((prev) => (prev - 1 + totalBrands) % totalBrands)
  }
  const handleNextBrand = () => {
    setBrandIndex((prev) => (prev + 1) % totalBrands)
  }

  // Helper function to get banners for a specific section and device type
  const getBannersForSection = (section, position = null) => {
    const normalize = (value) => String(value || "").trim().toLowerCase()
    return homeBannersByKey.get(`${normalize(section)}::${normalize(position)}`) || []
  }

  const handleNotifDeny = () => {
    setShowNotifPopup(false)
    localStorage.setItem(NOTIF_POPUP_KEY, "1")
  }
  const handleNotifAllow = () => {
    setNotifStep("email")
  }
  const handleNotifEmailChange = (e) => setNotifEmail(e.target.value)
  const handleNotifPrefChange = (value) => {
    setNotifPrefs((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))
  }
  const handleNotifEmailSubmit = async (e) => {
    e.preventDefault()
    setNotifError("")
    if (!notifPrefs.length) {
      setNotifError("Please select at least one preference.")
      return
    }
    setNotifLoading(true)
    try {
      await axios.post(`${API_BASE_URL}/api/newsletter/subscribe`, { email: notifEmail, preferences: notifPrefs })
      setNotifSuccess(true)
      localStorage.setItem(NOTIF_POPUP_KEY, "1")
      setTimeout(() => setShowNotifPopup(false), 2000)
    } catch (err) {
      setNotifError("Failed to subscribe. Please try again.")
    }
    setNotifLoading(false)
  }

  // Helper function to get proper banner link with language prefix
  const getBannerLink = (banner, fallbackUrl = "#") => {
    if (!banner) return fallbackUrl
    const link = banner.link || banner.buttonLink || fallbackUrl
    // External links pass through; everything else goes through getLocalizedPath,
    // which strips any legacy /ae-en style prefix a saved banner link still carries.
    if (link.startsWith("http://") || link.startsWith("https://")) {
      return link
    }
    return getLocalizedPath(link)
  }

  // A banner that will not load is hidden, never replaced with a sample image.
  const hideBrokenImage = (e) => {
    e.currentTarget.style.visibility = "hidden"
  }

  const handleBannerImageError = (e, bannerImage) => {
    const img = e.currentTarget
    if (!img.dataset.retryOriginal && bannerImage) {
      img.dataset.retryOriginal = "1"
      img.src = getFullImageUrl(bannerImage)
      return
    }
    hideBrokenImage(e)
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-white mt-1">
      <PromoPopup pageKey="home" delayMs={3000} />
      {/* Notification/Newsletter Popup */}
      {showNotifPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative animate-fadeInUp">
            {notifStep === "ask" && (
              <>
                <div className="flex items-center mb-4">
                  <img src="/logo.png" alt="Logo" className="w-16 h-18 rounded-full mr-4" />
                  <div>
                    <h2 className="text-lg font-bold text-black mb-1">
                      This website would like to send you awesome updates and offers!
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Notifications can be turned off anytime from browser settings.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button className="px-4 py-2 rounded bg-gray-200 text-black font-semibold" onClick={handleNotifDeny}>
                    Don't Allow
                  </button>
                  <button className="px-4 py-2 rounded bg-lime-500 text-white font-semibold" onClick={handleNotifAllow}>
                    Allow
                  </button>
                </div>
              </>
            )}
            {notifStep === "email" && !notifSuccess && (
              <form onSubmit={handleNotifEmailSubmit}>
                <div className="flex items-center  mb-4">
                  <img src="/logo.png" alt="Logo" className="w-14 h-14 rounded-full mr-4" />
                  <div>
                    <h2 className="text-lg font-bold text-black mb-1">Subscribe to our newsletter</h2>
                    <p className="text-gray-600 text-sm">Enter your email to get the best offers and updates!</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded"
                    placeholder="Enter your email"
                    value={notifEmail}
                    onChange={handleNotifEmailChange}
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded bg-lime-500 text-white font-semibold"
                    disabled={notifLoading}
                  >
                    {notifLoading ? "Subscribing..." : "Subscribe"}
                  </button>
                </div>
                {/* Preferences checkboxes */}
                <div className="flex flex-col md:flex-row gap-6 mb-2">
                  {NEWSLETTER_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center text-black font-normal cursor-pointer">
                      <input
                        type="checkbox"
                        value={opt.value}
                        checked={notifPrefs.includes(opt.value)}
                        onChange={() => handleNotifPrefChange(opt.value)}
                        className="mr-2"
                      />
                      {opt.icon}
                      {opt.label}
                    </label>
                  ))}
                </div>
                {notifError && <div className="text-red-500 text-sm mb-2">{notifError}</div>}
                <div className="flex justify-end">
                  <button type="button" className="px-3 py-1 text-xs text-gray-500 underline" onClick={handleNotifDeny}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {notifSuccess && (
              <div className="flex flex-col items-center justify-center py-6">
                <img
                  src="/logo.png"
                  alt="Logo"
                  width="56"
                  height="56"
                  className="w-14 h-14 rounded-full mb-3 border border-gray-200"
                />
                <h2 className="text-lg font-bold text-black mb-2">Thank you for subscribing!</h2>
                <p className="text-gray-600 text-sm">A confirmation email has been sent to {notifEmail}.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Campaign block. Edit the copy here -- the component takes it all as props. */}
      <PromoBanner />

      {/* Video hero. Swap the clip by dropping a new file at public/media/hero.mp4
          (and a matching first-frame poster), or pass src/poster props. */}
      <VideoHero />

      {/* Featured rail. Renders nothing when no product is flagged featured. */}
      <FeaturedProducts />

      {/* Wordless photo wall. Hidden until there are enough products to fill a row. */}
      <ProductGallery />

      {/* Campaign banner. Offer, image and both buttons are props -- edit them here. */}
      <SaleBanner />

      {/* Six products from each category, straight from the API. */}
      <CategoryShowcase />

      {/* What the shop promises, as a dark band leading into the footer. */}
      <ServicePromises />

      <style>{`
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(32px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.5s cubic-bezier(0.23, 1, 0.32, 1) both;
        }
      `}</style>
    </div>
  )
}

const DynamicBrandProductCard = ({ product }) => {
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist()
  const { addToCart } = useCart()
  const { getLocalizedPath, isArabic } = useLanguage()
  const { formatPrice: formatCurrencyPrice } = useCurrency()
  // Use dynamic discount
  const discount = product.discount && Number(product.discount) > 0 ? `${product.discount}% Off` : null
  // Use dynamic stock status
  const stockStatus = product.stockStatus || (product.countInStock > 0 ? "Available" : "Out of Stock")
  // Use dynamic price
  const basePrice = Number(product.price) || 0
  const offerPrice = Number(product.offerPrice) || 0

  // Show offer price if it exists and is less than base price
  const hasValidOffer = offerPrice > 0 && basePrice > 0 && offerPrice < basePrice
  const showOldPrice = hasValidOffer

  // Determine which price to display
  let priceToShow = 0
  if (hasValidOffer) {
    priceToShow = offerPrice
  } else if (basePrice > 0) {
    priceToShow = basePrice
  } else if (offerPrice > 0) {
    priceToShow = offerPrice
  }

  // Fallback: compute discount % if not provided from admin and we have a valid offer
  let computedDiscount = null
  if (!discount && hasValidOffer && basePrice > 0 && offerPrice > 0) {
    const pct = Math.round(((basePrice - offerPrice) / basePrice) * 100)
    if (pct > 0) computedDiscount = `${pct}% Off`
  }
  const finalDiscountLabel = discount || computedDiscount

  // Fix rating and reviews display
  const rating = Number(product.rating) || 0
  const numReviews = Number(product.numReviews) || 0

  const { name: categoryName, sourceDoc: categorySourceDoc, fieldName: categoryFieldName } =
    resolveProductCategoryInfo(product)

  return (
    <div className="border p-2 h-[410px] flex flex-col justify-between bg-white">
      <div className="relative mb-2 flex justify-center items-center" style={{ height: 190 }}>
        <Link to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)} className="w-full h-full flex items-center justify-center">
          <img
            src={getFullImageUrl(product.image) || "/placeholder.svg?height=120&width=120"}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width="165"
            height="165"
            className="w-full h-full object-contain bg-white rounded mx-auto mb-4"
            style={{ maxHeight: 165 }}
          />
        </Link>
        <button
          className="absolute top-1 right-1 text-gray-400 hover:text-red-500"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            isInWishlist(product._id) ? removeFromWishlist(product._id) : addToWishlist(product)
          }}
          aria-label={isInWishlist(product._id) ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={12} className={isInWishlist(product._id) ? "text-red-500 fill-red-500" : "text-gray-400"} />
        </button>
        {/* Status & Discount badges overlayed at bottom of image, always inside image area */}
        <div className="absolute inset-x-0 -bottom-2 px-2 flex flex-wrap items-center gap-2 z-10">
          <div className={`${getStatusColor(stockStatus)} text-white px-1 py-0.5 rounded text-[10px] font-medium shadow-sm`}><TranslatedText text={stockStatus} sourceDoc={product} fieldName="stockStatus" /></div>
          {finalDiscountLabel && (
            <div className="bg-yellow-400 text-white px-1 py-0.5 rounded text-[10px] font-medium shadow-sm">
              <TranslatedText text={finalDiscountLabel} />
            </div>
          )}
        </div>
      </div>

      <Link to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)}>
        <h3 className="text-xs font-sm text-gray-900 line-clamp-3 hover:text-blue-600 h-[50px]"><TranslatedText text={product.name} sourceDoc={product} fieldName="name" /></h3>
      </Link>
      {categoryName && (
        <div className="text-xs text-yellow-600">
          <TranslatedText>Category</TranslatedText>:{" "}
          {categorySourceDoc && categoryFieldName ? (
            <TranslatedText text={categoryName} sourceDoc={categorySourceDoc} fieldName={categoryFieldName} />
          ) : (
            <TranslatedText text={categoryName}>{categoryName}</TranslatedText>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0">
        <div className="text-red-600 font-bold text-sm">
          {formatCurrencyPrice(priceToShow, isArabic)}
        </div>
        {showOldPrice && (
          <div className="text-gray-400 line-through text-xs font-medium">
            {formatCurrencyPrice(basePrice, isArabic)}
          </div>
        )}
      </div>

      {/* Rating and Reviews Section - Fixed with 20px stars */}
      <div className="flex items-center min-h-[24px]">
        <div className="flex items-center">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={16}
              className={`${i < Math.round(Number(product.rating) || 0) ? "text-yellow-400 fill-current" : "text-gray-300"}`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-500 ml-1">({Number(product.numReviews) || 0})</span>
      </div>

      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          e.target.style.transform = "scale(0.95)"
          setTimeout(() => {
            if (e.target) e.target.style.transform = "scale(1)"
          }, 100)
          addToCart(product)
        }}
        className=" w-full bg-lime-500 hover:bg-lime-400 border border-lime-300 hover:border-transparent text-black text-xs font-medium py-2 px-1 rounded flex items-center justify-center gap-1 transition-all duration-100"
        disabled={stockStatus === "Out of Stock"}
      >
        <ShoppingBag size={12} />
        <TranslatedText>Add to Cart</TranslatedText>
      </button>
    </div>
  )
}

const AccessoriesProductCard = ({ product }) => {
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist()
  const { addToCart } = useCart()
  const { getLocalizedPath, isArabic } = useLanguage()
  const { formatPrice: formatCurrencyPrice } = useCurrency()
  // Use dynamic discount
  const discount = product.discount && Number(product.discount) > 0 ? `${product.discount}% Off` : null
  // Use dynamic stock status
  const stockStatus = product.stockStatus || (product.countInStock > 0 ? "Available" : "Out of Stock")
  // Use dynamic price
  const basePrice = Number(product.price) || 0
  const offerPrice = Number(product.offerPrice) || 0

  // Show offer price if it exists and is less than base price
  const hasValidOffer = offerPrice > 0 && basePrice > 0 && offerPrice < basePrice
  const showOldPrice = hasValidOffer

  // Determine which price to display
  let priceToShow = 0
  if (hasValidOffer) {
    priceToShow = offerPrice
  } else if (basePrice > 0) {
    priceToShow = basePrice
  } else if (offerPrice > 0) {
    priceToShow = offerPrice
  }

  // Fallback: compute discount % if not provided from admin
  let computedDiscount = null
  if (!discount && hasValidOffer && basePrice > 0 && offerPrice > 0) {
    const pct = Math.round(((basePrice - offerPrice) / basePrice) * 100)
    if (pct > 0) computedDiscount = `${pct}% Off`
  }
  const finalDiscountLabel = discount || computedDiscount

  // Fix rating and reviews display
  const rating = Number(product.rating) || 0
  const numReviews = Number(product.numReviews) || 0

  const { name: categoryName, sourceDoc: categorySourceDoc, fieldName: categoryFieldName } =
    resolveProductCategoryInfo(product)

  return (
    <div className="border p-2 h-[410px] flex flex-col justify-between bg-white">
      <div className="relative mb-2 flex justify-center items-center" style={{ height: 190 }}>
        <Link to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)} className="w-full h-full flex items-center justify-center">
          <img
            src={getFullImageUrl(product.image) || "/placeholder.svg?height=120&width=120"}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width="165"
            height="165"
            className="w-full h-full object-contain bg-white rounded mx-auto mb-4"
            style={{ maxHeight: 165 }}
          />
        </Link>
        <button
          className="absolute top-1 right-1 text-gray-400 hover:text-red-500"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            isInWishlist(product._id) ? removeFromWishlist(product._id) : addToWishlist(product)
          }}
          aria-label={isInWishlist(product._id) ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={12} className={isInWishlist(product._id) ? "text-red-500 fill-red-500" : "text-gray-400"} />
        </button>
        {/* Status & Discount badges overlayed at bottom of image, always inside image area */}
        <div className="absolute inset-x-0 -bottom-2 px-2 flex flex-wrap items-center gap-2 z-10">
          <div className={`${getStatusColor(stockStatus)} text-white px-1 py-0.5 rounded text-[10px] font-medium shadow-sm`}><TranslatedText text={stockStatus} sourceDoc={product} fieldName="stockStatus" /></div>
          {finalDiscountLabel && (
            <div className="bg-yellow-400 text-white px-1 py-0.5 rounded text-[10px] font-medium shadow-sm">
              <TranslatedText text={finalDiscountLabel} />
            </div>
          )}
        </div>
      </div>
      <Link to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)}>
        <h3 className="text-xs font-sm text-gray-900 line-clamp-3 hover:text-blue-600 h-[50px]"><TranslatedText text={product.name} sourceDoc={product} fieldName="name" /></h3>
      </Link>
      {categoryName && (
        <div className="text-xs text-yellow-600">
          <TranslatedText>Category</TranslatedText>:{" "}
          {categorySourceDoc && categoryFieldName ? (
            <TranslatedText text={categoryName} sourceDoc={categorySourceDoc} fieldName={categoryFieldName} />
          ) : (
            <TranslatedText text={categoryName}>{categoryName}</TranslatedText>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0">
        <div className="text-red-600 font-bold text-sm">
          {formatCurrencyPrice(priceToShow, isArabic)}
        </div>
        {showOldPrice && (
          <div className="text-gray-400 line-through text-xs font-medium">
            {formatCurrencyPrice(basePrice, isArabic)}
          </div>
        )}
      </div>

      {/* Rating and Reviews Section - Fixed with 20px stars */}
      <div className="flex items-center min-h-[24px]">
        <div className="flex items-center">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={16}
              className={`${i < Math.round(Number(product.rating) || 0) ? "text-yellow-400 fill-current" : "text-gray-300"}`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-500 ml-1">({Number(product.numReviews) || 0})</span>
      </div>

      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          e.target.style.transform = "scale(0.95)"
          setTimeout(() => { if (e.target) e.target.style.transform = "scale(1)" }, 100)
          addToCart(product)
        }}
        className=" w-full bg-lime-500 hover:bg-lime-400 border border-lime-300 hover:border-transparent text-black text-xs font-medium py-2 px-1 rounded flex items-center justify-center gap-1 transition-all duration-100"
        disabled={stockStatus === "Out of Stock"}
      >
        <ShoppingBag size={12} />
        <TranslatedText>Add to Cart</TranslatedText>
      </button>
    </div>
  )
}

const UpgradeFeatureCard = ({ feature }) => {
  const getIconComponent = (iconName) => {
    const iconMap = {
      zap: Zap,
      shield: Shield,
      award: Award,
      "check-circle": CheckCircle,
      star: Star,
      heart: Heart,
      truck: Truck,
      "credit-card": CreditCard,
      headphones: Headphones,
    }

    const IconComponent = iconMap[iconName?.toLowerCase()] || Zap
    return <IconComponent className="w-6 h-6 md:w-8 md:h-8" />
  }

  return (
    <div className="rounded-xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 group">
      <div className="flex items-start space-x-4">
        <div
          className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center ${feature.iconColor || "bg-blue-100"
            } group-hover:scale-110 transition-transform duration-300`}
        >
          <div className={`${feature.iconTextColor || "text-blue-600"}`}>{getIconComponent(feature.icon)}</div>
        </div>

        <div className="flex-1">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
            <TranslatedText text={feature.title} sourceDoc={feature} fieldName="title" />
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            <TranslatedText text={feature.description} sourceDoc={feature} fieldName="description" />
          </p>

          {feature.features && feature.features.length > 0 && (
            <ul className="space-y-1 mb-4">
              {feature.features.map((item, index) => (
                <li key={index} className="flex items-center text-sm text-gray-600">
                  <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-green-500 mr-2 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          )}

          {feature.price && (
            <div className="flex items-center justify-between">
              <div className="text-base md:text-lg font-bold text-gray-900">
                {feature.price}
                {feature.originalPrice && (
                  <span className="text-sm text-gray-500 line-through ml-2">{feature.originalPrice}</span>
                )}
              </div>

              {feature.ctaText && (
                <button className="px-3 py-1 md:px-4 md:py-2 bg-blue-600 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  {feature.ctaText}
                </button>
              )}
            </div>
          )}

          {feature.badge && (
            <div className="mt-3">
              <span
                className={`inline-block px-2 py-1 md:px-3 md:py-1 text-xs font-medium rounded-full ${feature.badgeColor || "bg-green-100 text-green-800"
                  }`}
              >
                <TranslatedText text={feature.badge} sourceDoc={feature} fieldName="badge" />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const getStatusColor = (status) => {
  if (status === "In Stock") return "bg-green-600"
  if (status === "Out of Stock") return "bg-red-600"
  if (status === "PreOrder") return "bg-yellow-500"
  return "bg-gray-400"
}

export default Home
