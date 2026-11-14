

"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import ImageUpload from "../ImageUpload"
import VideoUpload from "../VideoUpload"
import TipTapEditor from "../TipTapEditor"
import { Plus, X, Ruler } from "lucide-react"
import ProductVariationModal from "./ProductVariationModal"
import ColorVariationForm from "./ColorVariationForm"
import DosVariationForm from "./DosVariationForm"
import { getFullImageUrl } from "../../utils/imageUtils"
import { isSeoUnlockTokenValid } from "../../utils/seoUnlock"
import { useToast } from "../../context/ToastContext"

import config from "../../config/config"

const SEO_TITLE_MAX_WORDS = 80
const PRODUCT_SEO_FIELDS = [
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "seoCanonicalUrl",
  "seoRobots",
  "customSchema",
  "ogTitle",
  "ogDescription",
  "ogImage",
]

const PRODUCT_OPTION_FIELDS = [
  { field: "series", routeType: "series", label: "Series" },
  { field: "model", routeType: "model", label: "Model" },
  { field: "make", routeType: "make", label: "Make" },
  { field: "manufacturer", routeType: "manufacturer", label: "Manufacturer" },
  { field: "soldBy", routeType: "sold-by", label: "Sold By" },
]

// Used only when /api/countries is unreachable. This shop sells in Pakistan.
const DEFAULT_COUNTRIES = [{ code: "PK", name: "Pakistan" }]

const countWords = (text = "") => {
  const normalized = String(text).trim()
  if (!normalized) return 0
  return normalized.split(/\s+/).length
}

const limitWords = (text = "", maxWords = SEO_TITLE_MAX_WORDS) => {
  const normalized = String(text).trim()
  if (!normalized) return ""
  const words = normalized.split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(" ")
}

const ProductForm = ({ product, onSubmit, onCancel }) => {
  const { showToast } = useToast()
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [availableCountries, setAvailableCountries] = useState(DEFAULT_COUNTRIES)
  const [productOptions, setProductOptions] = useState({
    series: [],
    model: [],
    make: [],
    manufacturer: [],
    soldBy: [],
  })
  const [subCategories, setSubCategories] = useState([])
  const [subCategories2, setSubCategories2] = useState([])
  const [subCategories3, setSubCategories3] = useState([])
  const [subCategories4, setSubCategories4] = useState([])
  const [parentCategories, setParentCategories] = useState([])
  const [taxes, setTaxes] = useState([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    slug: "",
    barcode: "",
    gtin: "",
    brand: "",
    series: "",
    model: "",
    make: "",
    manufacturer: "",
    soldBy: "",
    parentCategory: "",
    category: "",
    subCategory: "",
    subCategory2: "",
    subCategory3: "",
    subCategory4: "",
    description: "",
    shortDescription: "",
    buyingPrice: "",
    wholesalePrice: "",
    price: "", // This will be the final calculated price (base + tax)
    offerPrice: "",
    discount: "",
    image: "",
    galleryImages: [],
    video: "",
    videoGallery: [],
    countInStock: "",
    targetCountries: ["ALL"],
    countryStock: { AE: 0, SA: 0, QA: 0, OM: 0, BH: 0, KW: 0 },
    lowStockWarning: "5",
    maxPurchaseQty: "10",
    weight: "",
    unit: "piece",
    tax: "0",
    tags: "",
    specifications: [],
    // Loyalty earning override. "inherit" defers to the category rule, then the global rate.
    loyaltyPointsMode: "inherit",
    loyaltyPointsMultiplier: 1,
    loyaltyPointsFixed: 0,
    isActive: true,
    canPurchase: true,
    showStockOut: true,
    refundable: true,
    featured: false,
    hideFromShop: false,
    stockStatus: "In Stock",
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    seoCanonicalUrl: "",
    seoRobots: "index, follow",
    customSchema: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    variationsDisplayType: "button",
    availableModelsDisplayType: "button",
    colorVariationsDisplayType: "card",
  })

  // New states for price calculation
  const [basePrice, setBasePrice] = useState("") // This will be the input for the base price
  const [taxAmount, setTaxAmount] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [originalOfferPrice, setOriginalOfferPrice] = useState("")
  const [isCalculating, setIsCalculating] = useState(false)
  const [editingField, setEditingField] = useState(null) // 'offer' | 'discount' | null
  
  // Product Variations
  const [showVariationModal, setShowVariationModal] = useState(false)
  const [selectedVariations, setSelectedVariations] = useState([])
  const [reverseVariationText, setReverseVariationText] = useState("") // Deprecated, kept for backward compatibility
  const [selfVariationText, setSelfVariationText] = useState("") // This product's own variation label

  // Available Models
  const [showAvailableModelsModal, setShowAvailableModelsModal] = useState(false)
  const [availableModels, setAvailableModels] = useState([])
  const [selfAvailableModelText, setSelfAvailableModelText] = useState("")
  
  // Color Variations
  const [colorVariations, setColorVariations] = useState([])
  
  // DOS/Windows Variations
  const [dosVariations, setDosVariations] = useState([])

  // Product Sizes & Size-Based Pricing
  const [availableSizes, setAvailableSizes] = useState([])
  const [selectedProductSizes, setSelectedProductSizes] = useState([])
  
  // Video Source Type (upload or youtube)
  const [videoSourceType, setVideoSourceType] = useState("youtube") // 'upload' | 'youtube'
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [isSeoUnlocked, setIsSeoUnlocked] = useState(isSeoUnlockTokenValid())

  // Helper function to check if a URL is a YouTube URL
  const isYouTubeUrl = (url) => {
    if (!url) return false
    return url.includes('youtube.com') || url.includes('youtu.be')
  }

  const units = [
    { value: "piece", label: "Piece" },
    { value: "kg", label: "Kilogram" },
    { value: "gram", label: "Gram" },
    { value: "liter", label: "Liter" },
    { value: "meter", label: "Meter" },
    { value: "box", label: "Box" },
    { value: "pack", label: "Pack" },
  ]

  useEffect(() => {
    const syncSeoLockState = () => setIsSeoUnlocked(isSeoUnlockTokenValid())
    syncSeoLockState()
    const intervalId = window.setInterval(syncSeoLockState, 1000)
    window.addEventListener("storage", syncSeoLockState)
    window.addEventListener("focus", syncSeoLockState)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("storage", syncSeoLockState)
      window.removeEventListener("focus", syncSeoLockState)
    }
  }, [])

  // Fetch active countries from backend
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const { data } = await axios.get(`${config.API_URL}/api/countries/active`)
        if (Array.isArray(data) && data.length > 0) {
          setAvailableCountries(data.map((c) => ({ code: c.code, name: c.name })))
        }
      } catch (error) {
        try {
          const { data } = await axios.get(`${config.API_URL}/api/countries`)
          if (Array.isArray(data) && data.length > 0) {
            const active = data.filter((c) => c.isActive !== false)
            if (active.length > 0) {
              setAvailableCountries(active.map((c) => ({ code: c.code, name: c.name })))
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }
    fetchCountries()
  }, [])

  // Fetch taxes from backend
  useEffect(() => {
    const fetchSizes = async () => {
      try {
        const { data } = await axios.get(`${config.API_URL}/api/sizes`)
        if (Array.isArray(data)) {
          setAvailableSizes(data.filter((s) => s.isActive !== false))
        }
      } catch (error) {
        console.error("Failed to load sizes:", error)
      }
    }
    fetchSizes()
  }, [])

  useEffect(() => {
    const fetchTaxes = async () => {
      try {
        const token = localStorage.getItem("adminToken")
        const { data } = await axios.get(`${config.API_URL}/api/tax`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setTaxes(data)
      } catch (error) {
        setTaxes([])
        console.error("Failed to load taxes:", error)
      }
    }
    fetchTaxes()
  }, [])

  // Set tax rate when formData.tax or taxes change
  useEffect(() => {
    if (formData.tax && taxes.length > 0) {
      const selectedTax = taxes.find((t) => t._id === formData.tax)
      setTaxRate(selectedTax ? Number(selectedTax.rate) : 0)
    } else {
      setTaxRate(0)
    }
  }, [formData.tax, taxes])

  useEffect(() => {
    // Only recompute VAT breakdown and keep formData values in sync with inputs.
    const base = Number(basePrice) || 0
    const offer = Number(originalOfferPrice) || 0

    const tax = taxRate
    const includedTax = (amount, rate) => {
      if (!amount || amount <= 0 || !rate || rate <= 0) return 0
      return amount - amount / (1 + rate / 100)
    }

    const displayBase = offer > 0 ? offer : base
    const taxAmt = includedTax(displayBase, tax)
    setTaxAmount(taxAmt)

    // Do not round while typing; just mirror to formData
    setFormData((prev) => ({
      ...prev,
      offerPrice: originalOfferPrice,
      price: basePrice === "" ? prev.price : base.toFixed(2),
    }))
  }, [basePrice, taxRate, originalOfferPrice])

  useEffect(() => {
    fetchParentCategories()
    fetchBrands()
    if (product) {
      const parentId =
        (typeof product.parentCategory === "object" && product.parentCategory
          ? product.parentCategory._id
          : product.parentCategory) || ""
      const resolvedCategoryId =
        (typeof product.category === "object" && product.category ? product.category._id : product.category) ||
        (typeof product.subCategory === "object" && product.subCategory ? product.subCategory._id : product.subCategory) ||
        ""

      setBasePrice(product.price ? String(product.price) : "")
      setOriginalOfferPrice(product.offerPrice ? String(product.offerPrice) : "")
      
      const formatLinkedProducts = (items = []) =>
        items.map(v => {
          // New structure: { product: {...}, variationText: "..." }
          if (v.product) {
            return {
              ...v.product,
              variationText: v.variationText || ""
            }
          }
          // Old structure: direct product reference
          return v
        })

      // Initialize variations if they exist - handle both old and new structure
      if (product.variations && product.variations.length > 0) {
        const formattedVariations = formatLinkedProducts(product.variations)
        setSelectedVariations(formattedVariations)
        setReverseVariationText(product.reverseVariationText || "")
      }
      
      // Set self variation text (this product's own label in variation selectors)
      setSelfVariationText(product.selfVariationText || product.reverseVariationText || "")

      // Initialize available models if they exist
      if (product.availableModels && product.availableModels.length > 0) {
        setAvailableModels(formatLinkedProducts(product.availableModels))
      }
      setSelfAvailableModelText(product.selfAvailableModelText || "")
      
      // Set color variations if they exist
      if (product.colorVariations && product.colorVariations.length > 0) {
        setColorVariations(product.colorVariations)
      }

      // Set DOS/Windows variations if they exist
      if (product.dosVariations && product.dosVariations.length > 0) {
        setDosVariations(product.dosVariations)
      }

      // Set product sizes if they exist
      if (product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0) {
        setSelectedProductSizes(
          product.sizes.map((s) => ({
            sizeId: s.size?._id || s.size || s._id || "",
            name: s.name || s.size?.name || "",
            code: s.code || s.size?.code || "",
            additionalPrice: s.additionalPrice !== undefined ? s.additionalPrice : 0,
            countInStock: s.countInStock !== undefined ? s.countInStock : 0,
          }))
        )
      } else {
        setSelectedProductSizes([])
      }

      const preload = async () => {
        if (parentId) {
          await fetchSubCategories(String(parentId))
        }
        
        // Preload subcategories for levels 2, 3, 4 if they exist
        if (product.category) {
          const categoryId = typeof product.category === "object" ? product.category._id : product.category
          await fetchSubCategories2(String(categoryId))
        }
        if (product.subCategory2) {
          const sub2Id = typeof product.subCategory2 === "object" ? product.subCategory2._id : product.subCategory2
          await fetchSubCategories3(String(sub2Id))
        }
        if (product.subCategory3) {
          const sub3Id = typeof product.subCategory3 === "object" ? product.subCategory3._id : product.subCategory3
          await fetchSubCategories4(String(sub3Id))
        }

        setFormData({
          name: product.name || "",
          sku: product.sku || "",
          slug: product.slug || "",
          barcode: product.barcode || "",
          gtin: product.gtin || "",
          brand:
            (typeof product.brand === "object" && product.brand ? product.brand._id : product.brand)
              ? String(typeof product.brand === "object" && product.brand ? product.brand._id : product.brand)
              : "",
          series:
            (typeof product.series === "object" && product.series ? product.series._id : product.series)
              ? String(typeof product.series === "object" && product.series ? product.series._id : product.series)
              : "",
          model:
            (typeof product.model === "object" && product.model ? product.model._id : product.model)
              ? String(typeof product.model === "object" && product.model ? product.model._id : product.model)
              : "",
          make:
            (typeof product.make === "object" && product.make ? product.make._id : product.make)
              ? String(typeof product.make === "object" && product.make ? product.make._id : product.make)
              : "",
          manufacturer:
            (typeof product.manufacturer === "object" && product.manufacturer
              ? product.manufacturer._id
              : product.manufacturer)
              ? String(
                  typeof product.manufacturer === "object" && product.manufacturer
                    ? product.manufacturer._id
                    : product.manufacturer,
                )
              : "",
          soldBy:
            (typeof product.soldBy === "object" && product.soldBy ? product.soldBy._id : product.soldBy)
              ? String(typeof product.soldBy === "object" && product.soldBy ? product.soldBy._id : product.soldBy)
              : "",
          parentCategory: parentId ? String(parentId) : "",
          category: resolvedCategoryId ? String(resolvedCategoryId) : "",
          subCategory:
            (typeof product.subCategory === "object" && product.subCategory ? product.subCategory._id : product.subCategory)
              ? String(
                  typeof product.subCategory === "object" && product.subCategory
                    ? product.subCategory._id
                    : product.subCategory,
                )
              : "",
          subCategory2:
            (typeof product.subCategory2 === "object" && product.subCategory2 ? product.subCategory2._id : product.subCategory2)
              ? String(
                  typeof product.subCategory2 === "object" && product.subCategory2
                    ? product.subCategory2._id
                    : product.subCategory2,
                )
              : "",
          subCategory3:
            (typeof product.subCategory3 === "object" && product.subCategory3 ? product.subCategory3._id : product.subCategory3)
              ? String(
                  typeof product.subCategory3 === "object" && product.subCategory3
                    ? product.subCategory3._id
                    : product.subCategory3,
                )
              : "",
          subCategory4:
            (typeof product.subCategory4 === "object" && product.subCategory4 ? product.subCategory4._id : product.subCategory4)
              ? String(
                  typeof product.subCategory4 === "object" && product.subCategory4
                    ? product.subCategory4._id
                    : product.subCategory4,
                )
              : "",
          description: product.description || "",
          shortDescription: product.shortDescription || "",
          buyingPrice: product.buyingPrice || "",
          wholesalePrice: product.wholesalePrice ?? "",
          price: product.price || "",
          offerPrice: product.offerPrice || "",
          discount: product.discount || "",
          image: product.image || "",
          galleryImages: product.galleryImages || [],
          video: product.video || "",
          videoGallery: product.videoGallery || [],
          countInStock:
            product.sizes && Array.isArray(product.sizes) && product.sizes.length > 0
              ? product.sizes.reduce((sum, s) => sum + (Number(s.countInStock) || 0), 0).toString()
              : product.countInStock !== undefined && product.countInStock !== null
                ? product.countInStock.toString()
                : "",
          targetCountries: Array.isArray(product.targetCountries) && product.targetCountries.length > 0 ? product.targetCountries : ["ALL"],
          countryStock: (() => {
            const stockMap = { AE: 0, SA: 0, QA: 0, OM: 0, BH: 0, KW: 0 }
            if (Array.isArray(product.countryStock)) {
              product.countryStock.forEach((cs) => {
                if (cs && cs.country) stockMap[cs.country] = cs.countInStock || 0
              })
            }
            return stockMap
          })(),
          lowStockWarning: product.lowStockWarning || "5",
          maxPurchaseQty: product.maxPurchaseQty || "10",
          weight: product.weight || "",
          unit: product.unit || "piece",
          tax:
            (typeof product.tax === "object" && product.tax ? product.tax._id : product.tax)
              ? String(typeof product.tax === "object" && product.tax ? product.tax._id : product.tax)
              : "0",
          tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
          specifications: product.specifications || [],
          loyaltyPointsMode: product.loyaltyPointsMode || "inherit",
          loyaltyPointsMultiplier:
            product.loyaltyPointsMultiplier !== undefined ? product.loyaltyPointsMultiplier : 1,
          loyaltyPointsFixed: product.loyaltyPointsFixed !== undefined ? product.loyaltyPointsFixed : 0,
          isActive: product.isActive !== undefined ? product.isActive : true,
          canPurchase: product.canPurchase !== undefined ? product.canPurchase : true,
          showStockOut: product.showStockOut !== undefined ? product.showStockOut : true,
          refundable: product.refundable !== undefined ? product.refundable : true,
          featured: product.featured || false,
          hideFromShop: product.hideFromShop || false,
          stockStatus: product.stockStatus || "In Stock",
          seoTitle: product.seoTitle || "",
          seoDescription: product.seoDescription || "",
          seoKeywords: product.seoKeywords || "",
          seoCanonicalUrl: product.seoCanonicalUrl || "",
          seoRobots: product.seoRobots || "index, follow",
          customSchema: product.customSchema || "",
          ogTitle: product.ogTitle || "",
          ogDescription: product.ogDescription || "",
          ogImage: product.ogImage || "",
          variationsDisplayType: product.variationsDisplayType || "button",
          availableModelsDisplayType: product.availableModelsDisplayType || "button",
          colorVariationsDisplayType: product.colorVariationsDisplayType || "card",
        })
        
        // Set video source type based on existing video URL
        if (product.video) {
          if (isYouTubeUrl(product.video)) {
            setVideoSourceType("youtube")
            setYoutubeUrl(product.video)
          } else {
            setVideoSourceType("upload")
          }
        }
      }

      preload()
    }
  }, [product]) // Removed taxes from dependencies to prevent recalculation loops

  // Fetch parent categories (main categories)
  const fetchParentCategories = async () => {
    try {
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/categories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setParentCategories(data)
    } catch (error) {
      console.error("Failed to load parent categories:", error)
    }
  }

  // Fetch subcategories when parentCategory changes (Level 1)
  useEffect(() => {
    if (formData.parentCategory) {
      fetchSubCategories(formData.parentCategory)
    } else {
      setSubCategories([])
      setSubCategories2([])
      setSubCategories3([])
      setSubCategories4([])
      setFormData((prev) => ({ ...prev, category: "", subCategory: "", subCategory2: "", subCategory3: "", subCategory4: "" }))
    }
  }, [formData.parentCategory])

  // Fetch level 2 subcategories when category (level 1) changes
  useEffect(() => {
    if (formData.category) {
      fetchSubCategories2(formData.category)
    } else {
      setSubCategories2([])
      setSubCategories3([])
      setSubCategories4([])
      setFormData((prev) => ({ ...prev, subCategory2: "", subCategory3: "", subCategory4: "" }))
    }
  }, [formData.category])

  // Fetch level 3 subcategories when subCategory2 changes
  useEffect(() => {
    if (formData.subCategory2) {
      fetchSubCategories3(formData.subCategory2)
    } else {
      setSubCategories3([])
      setSubCategories4([])
      setFormData((prev) => ({ ...prev, subCategory3: "", subCategory4: "" }))
    }
  }, [formData.subCategory2])

  // Fetch level 4 subcategories when subCategory3 changes
  useEffect(() => {
    if (formData.subCategory3) {
      fetchSubCategories4(formData.subCategory3)
    } else {
      setSubCategories4([])
      setFormData((prev) => ({ ...prev, subCategory4: "" }))
    }
  }, [formData.subCategory3])

  const fetchSubCategories = async (parentCategoryId) => {
    try {
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/subcategories/category/${parentCategoryId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      // Filter to only show Level 1 subcategories
      const level1Subs = data.filter(sub => !sub.level || sub.level === 1)
      setSubCategories(level1Subs)
    } catch (error) {
      setSubCategories([])
      console.error("Failed to load subcategories:", error)
    }
  }

  const fetchSubCategories2 = async (parentSubCategoryId) => {
    try {
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/subcategories/children/${parentSubCategoryId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setSubCategories2(data)
    } catch (error) {
      setSubCategories2([])
      console.error("Failed to load subcategories level 2:", error)
    }
  }

  const fetchSubCategories3 = async (parentSubCategoryId) => {
    try {
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/subcategories/children/${parentSubCategoryId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setSubCategories3(data)
    } catch (error) {
      setSubCategories3([])
      console.error("Failed to load subcategories level 3:", error)
    }
  }

  const fetchSubCategories4 = async (parentSubCategoryId) => {
    try {
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/subcategories/children/${parentSubCategoryId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setSubCategories4(data)
    } catch (error) {
      setSubCategories4([])
      console.error("Failed to load subcategories level 4:", error)
    }
  }

  const fetchBrands = async () => {
    try {
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/brands`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setBrands(data)
    } catch (error) {
      console.error("Failed to load brands:", error)
    }
  }

  const fetchProductOptionsByType = async (routeType) => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/product-system-options/${routeType}`)
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error(`Failed to load product options for ${routeType}:`, error)
      return []
    }
  }

  const fetchAllProductOptions = async () => {
    const [seriesOptions, modelOptions, makeOptions, manufacturerOptions, soldByOptions] = await Promise.all([
      fetchProductOptionsByType("series"),
      fetchProductOptionsByType("model"),
      fetchProductOptionsByType("make"),
      fetchProductOptionsByType("manufacturer"),
      fetchProductOptionsByType("sold-by"),
    ])

    setProductOptions({
      series: seriesOptions,
      model: modelOptions,
      make: makeOptions,
      manufacturer: manufacturerOptions,
      soldBy: soldByOptions,
    })
  }

  const handleCreateProductOption = async ({ field, routeType, label }) => {
    const input = window.prompt(`Enter ${label} name`)
    const name = String(input || "").trim()
    if (!name) return

    try {
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")

      if (!token) {
        showToast("Please login as admin first", "error")
        return
      }

      const { data } = await axios.post(
        `${config.API_URL}/api/product-system-options/${routeType}`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      await fetchAllProductOptions()
      const createdId = data?._id ? String(data._id) : ""
      if (createdId) {
        setFormData((prev) => ({ ...prev, [field]: createdId }))
      }
      showToast(`${label} added successfully`, "success")
    } catch (error) {
      const message = error?.response?.data?.message || `Failed to add ${label.toLowerCase()}`
      showToast(message, "error")
    }
  }

  useEffect(() => {
    fetchAllProductOptions()
  }, [])

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-")
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    const normalizedValue = name === "seoTitle" ? limitWords(value, SEO_TITLE_MAX_WORDS) : value

    if (name === "basePrice") {
      // Handle the new basePrice input
      setBasePrice(value)
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : normalizedValue,
      }))
    }

    // Auto-generate slug from name
    if (name === "name" && !formData.slug) {
      setFormData((prev) => ({
        ...prev,
        slug: generateSlug(value),
      }))
    }
  }

  const handleOfferPriceChange = (e) => {
    const value = e.target.value
    setEditingField("offer")
    setOriginalOfferPrice(value)

    const base = Number(basePrice)
    const offer = Number(value)
    if (!isNaN(base) && base > 0 && value !== "") {
      const calcDiscount = Math.max(0, ((base - offer) / base) * 100).toFixed(2)
      setFormData((prev) => ({ ...prev, discount: String(calcDiscount) }))
    } else {
      // When offer is cleared, clear discount (but don't touch if user is editing discount)
      if (editingField !== "discount") {
        setFormData((prev) => ({ ...prev, discount: "" }))
      }
    }
  }

  const handleOfferPriceBlur = () => {
    setEditingField(null)
    if (originalOfferPrice === "") return
    const n = Number(originalOfferPrice)
    if (!isNaN(n)) {
      const fixed = n.toFixed(2)
      setOriginalOfferPrice(fixed)
      setFormData((prev) => ({ ...prev, offerPrice: fixed }))
    }
  }

  const handleDiscountChange = (e) => {
    const value = e.target.value
    setEditingField("discount")
    // Update discount immediately
    setFormData((prev) => ({ ...prev, discount: value }))

    const offer = Number(originalOfferPrice)
    const disc = Number(value)
    if (!isNaN(offer) && offer > 0 && value !== "") {
      // Calculate base price from offer price and discount
      // Formula: basePrice = offerPrice / (1 - discount/100)
      const discountPercent = Math.min(Math.max(disc, 0), 99.99) // Max 99.99% to avoid division by zero
      const base = offer / (1 - discountPercent / 100)
      const baseStr = base.toFixed(2)
      setBasePrice(baseStr)
    } else if (value === "" || disc === 0) {
      // If discount cleared or 0, base price equals offer price
      setBasePrice(originalOfferPrice)
    }
  }

  const handleDiscountBlur = () => {
    setEditingField(null)
    const d = Number(formData.discount)
    if (!isNaN(d)) {
      const clamped = Math.min(Math.max(d, 0), 100).toFixed(2)
      setFormData((prev) => ({ ...prev, discount: String(clamped) }))
    }
  }

  const handleDescriptionChange = (content) => {
    setFormData((prev) => ({
      ...prev,
      description: content,
    }))
  }

  const handleShortDescriptionChange = (content) => {
    setFormData((prev) => ({
      ...prev,
      shortDescription: content,
    }))
  }

  const normalizeImageUrl = (item) => {
    if (!item) return ""
    if (typeof item === "string") return item.trim()
    if (typeof item === "object") {
      const candidate = item.url || item.path || ""
      return candidate ? String(candidate).trim() : ""
    }
    return ""
  }

  const dedupeImageUrls = (items) => {
    const seen = new Set()
    const output = []
    ;(Array.isArray(items) ? items : [items]).forEach((item) => {
      const url = normalizeImageUrl(item)
      if (!url || seen.has(url)) return
      seen.add(url)
      output.push(url)
    })
    return output
  }

  const handleBulkProductImagesUpload = (uploaded) => {
    setFormData((prev) => {
      const uploadedUrls = dedupeImageUrls(uploaded)
      if (uploadedUrls.length === 0) return prev

      const existingUrls = dedupeImageUrls([prev.image, ...(prev.galleryImages || [])])
      const merged = dedupeImageUrls([...existingUrls, ...uploadedUrls])
      const mainImage = prev.image && merged.includes(prev.image) ? prev.image : merged[0]

      return {
        ...prev,
        image: mainImage || "",
        galleryImages: merged.filter((url) => url !== mainImage),
      }
    })
  }

  const handleSetMainImage = (selectedUrl) => {
    setFormData((prev) => {
      const allImages = dedupeImageUrls([prev.image, ...(prev.galleryImages || [])])
      if (!allImages.includes(selectedUrl)) return prev
      return {
        ...prev,
        image: selectedUrl,
        galleryImages: allImages.filter((url) => url !== selectedUrl),
      }
    })
  }

  const handleRemoveSelectedImage = (selectedUrl) => {
    setFormData((prev) => {
      const allImages = dedupeImageUrls([prev.image, ...(prev.galleryImages || [])])
      const remaining = allImages.filter((url) => url !== selectedUrl)

      if (remaining.length === 0) {
        return {
          ...prev,
          image: "",
          galleryImages: [],
        }
      }

      const nextMain = selectedUrl === prev.image ? remaining[0] : prev.image
      const mainImage = remaining.includes(nextMain) ? nextMain : remaining[0]

      return {
        ...prev,
        image: mainImage,
        galleryImages: remaining.filter((url) => url !== mainImage),
      }
    })
  }

  const handleVideoUpload = (url) => {
    setFormData((prev) => ({
      ...prev,
      video: url,
    }))
  }

  const handleYoutubeUrlChange = (e) => {
    const url = e.target.value
    setYoutubeUrl(url)
    setFormData((prev) => ({
      ...prev,
      video: url,
    }))
  }

  const handleVideoSourceTypeChange = (type) => {
    setVideoSourceType(type)
    // Clear video when switching source types
    if (type === "upload") {
      setYoutubeUrl("")
      setFormData((prev) => ({
        ...prev,
        video: "",
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        video: youtubeUrl,
      }))
    }
  }

  const handleVideoGalleryUpload = (url, index) => {
    setFormData((prev) => {
      const newVideoGallery = [...prev.videoGallery]
      newVideoGallery[index] = url
      return {
        ...prev,
        videoGallery: newVideoGallery,
      }
    })
  }

  const removeVideoFromGallery = (index) => {
    setFormData((prev) => {
      const newVideoGallery = [...prev.videoGallery]
      newVideoGallery.splice(index, 1)
      return {
        ...prev,
        videoGallery: newVideoGallery,
      }
    })
  }

  // Specification handlers
  const addSpecification = () => {
    setFormData((prev) => ({
      ...prev,
      specifications: [...prev.specifications, { key: "", value: "" }],
    }))
  }

  const removeSpecification = (index) => {
    setFormData((prev) => ({
      ...prev,
      specifications: prev.specifications.filter((_, i) => i !== index),
    }))
  }

  const updateSpecification = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      specifications: prev.specifications.map((spec, i) => (i === index ? { ...spec, [field]: value } : spec)),
    }))
  }

  const toggleSizeSelection = (sizeObj) => {
    const sizeId = sizeObj._id
    const isAlreadySelected = selectedProductSizes.some(
      (s) => s.sizeId === sizeId || (s.code && s.code.toLowerCase() === sizeObj.code.toLowerCase())
    )
    if (isAlreadySelected) {
      setSelectedProductSizes((prev) => {
        const next = prev.filter((s) => s.sizeId !== sizeId && s.code.toLowerCase() !== sizeObj.code.toLowerCase())
        if (next.length > 0) {
          const totalStock = next.reduce((sum, s) => sum + (Number(s.countInStock) || 0), 0)
          setFormData((f) => ({
            ...f,
            countInStock: totalStock.toString(),
            stockStatus: totalStock > 0 ? (f.stockStatus === "PreOrder" ? "PreOrder" : "In Stock") : (f.stockStatus === "PreOrder" ? "PreOrder" : "Out of Stock"),
          }))
        }
        return next
      })
    } else {
      setSelectedProductSizes((prev) => {
        const next = [
          ...prev,
          {
            sizeId: sizeObj._id,
            name: sizeObj.name,
            code: sizeObj.code,
            additionalPrice: 0,
            countInStock: 0,
          },
        ]
        const totalStock = next.reduce((sum, s) => sum + (Number(s.countInStock) || 0), 0)
        setFormData((f) => ({
          ...f,
          countInStock: totalStock.toString(),
          stockStatus: totalStock > 0 ? (f.stockStatus === "PreOrder" ? "PreOrder" : "In Stock") : (f.stockStatus === "PreOrder" ? "PreOrder" : "Out of Stock"),
        }))
        return next
      })
    }
  }

  const handleSizeAdditionalPriceChange = (index, value) => {
    const numVal = value === "" ? "" : Math.max(0, Number.parseFloat(value) || 0)
    setSelectedProductSizes((prev) =>
      prev.map((item, i) => (i === index ? { ...item, additionalPrice: numVal } : item))
    )
  }

  const handleSizeStockChange = (index, value) => {
    const numVal = value === "" ? "" : Math.max(0, Number.parseInt(value) || 0)
    setSelectedProductSizes((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, countInStock: numVal } : item))
      const totalStock = next.reduce((sum, s) => sum + (Number(s.countInStock) || 0), 0)
      setFormData((f) => ({
        ...f,
        countInStock: totalStock.toString(),
        stockStatus: totalStock > 0 ? (f.stockStatus === "PreOrder" ? "PreOrder" : "In Stock") : (f.stockStatus === "PreOrder" ? "PreOrder" : "Out of Stock"),
      }))
      return next
    })
  }

  const removeSelectedProductSize = (index) => {
    setSelectedProductSizes((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length > 0) {
        const totalStock = next.reduce((sum, s) => sum + (Number(s.countInStock) || 0), 0)
        setFormData((f) => ({
          ...f,
          countInStock: totalStock.toString(),
          stockStatus: totalStock > 0 ? (f.stockStatus === "PreOrder" ? "PreOrder" : "In Stock") : (f.stockStatus === "PreOrder" ? "PreOrder" : "Out of Stock"),
        }))
      }
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    if (Number(formData.buyingPrice) < 0 || Number(basePrice) < 0 || Number(originalOfferPrice) < 0) {
      alert("Buying price, base price, and offer price cannot be less than 0.")
      setLoading(false)
      return
    }
    // Wholesale price is optional, so only check it when something was typed.
    if (String(formData.wholesalePrice).trim() !== "" && Number(formData.wholesalePrice) < 0) {
      alert("Wholesale price cannot be less than 0.")
      setLoading(false)
      return
    }
    try {
      let taxValue = formData.tax
      if (!taxValue || taxValue === "0" || taxValue === 0) {
        taxValue = undefined
      }
      // IMPORTANT: Do not add tax again on submit.
      // We treat basePrice and formData.offerPrice as already tax-inclusive (informational VAT only).
  const finalBasePrice = Number.parseFloat(basePrice) || 0
  // Use the visible Offer Price input; if blank, treat as 0
  const finalOfferPrice = originalOfferPrice !== "" ? Number.parseFloat(originalOfferPrice) || 0 : 0

      const productData = {
        ...formData,
        sku: String(formData.sku ?? "").trim() || undefined,
        barcode: String(formData.barcode ?? "").trim() || undefined,
        gtin: String(formData.gtin ?? "").trim() || undefined,
        parentCategory: formData.parentCategory,
        category: formData.category,
        subCategory: formData.category || null,
        subCategory2: formData.subCategory2 || null,
        subCategory3: formData.subCategory3 || null,
        subCategory4: formData.subCategory4 || null,
        buyingPrice: Number.parseFloat(formData.buyingPrice) || 0,
        wholesalePrice:
          String(formData.wholesalePrice).trim() === ""
            ? null
            : Number.parseFloat(formData.wholesalePrice),
        price: finalBasePrice, // Save as-is (tax-inclusive; no re-add)
        offerPrice: finalOfferPrice, // Save as-is (tax-inclusive; no re-add)
        discount: Number.parseFloat(formData.discount) || 0,
        countInStock:
          selectedProductSizes.length > 0
            ? selectedProductSizes.reduce((sum, s) => sum + (Number(s.countInStock) || 0), 0)
            : Number.parseInt(formData.countInStock) || 0,
        targetCountries: Array.isArray(formData.targetCountries) && formData.targetCountries.length > 0 ? formData.targetCountries : ["ALL"],
        countryStock: Object.entries(formData.countryStock || {}).map(([country, count]) => ({
          country: String(country).toUpperCase(),
          countInStock: Number(count) || 0,
        })),
        lowStockWarning: Number.parseInt(formData.lowStockWarning) || 5,
        maxPurchaseQty: Number.parseInt(formData.maxPurchaseQty) || 10,
        weight: Number.parseFloat(formData.weight) || 0,
        tax: taxValue,
        series: formData.series || undefined,
        model: formData.model || undefined,
        make: formData.make || undefined,
        manufacturer: formData.manufacturer || undefined,
        soldBy: formData.soldBy || undefined,
        tags: formData.tags ? formData.tags.split(",").map((tag) => tag.trim()) : [],
        galleryImages: formData.galleryImages.filter((img) => img !== ""),
        video: formData.video || "",
        videoGallery: formData.videoGallery.filter((vid) => vid !== ""),
        specifications: formData.specifications.filter((spec) => spec.key && spec.value),
        loyaltyPointsMode: formData.loyaltyPointsMode || "inherit",
        loyaltyPointsMultiplier: Number(formData.loyaltyPointsMultiplier) || 0,
        loyaltyPointsFixed: Number(formData.loyaltyPointsFixed) || 0,
        stockStatus: formData.stockStatus,
        isActive: formData.isActive,
        canPurchase: formData.canPurchase,
        showStockOut: formData.showStockOut,
        refundable: formData.refundable,
        featured: formData.featured,
        hideFromShop: formData.hideFromShop,
        variations: selectedVariations.map(v => ({ 
          product: v._id, 
          variationText: v.variationText || "" 
        })), // Add variation IDs with text
        reverseVariationText: selfVariationText || "", // Backward compatibility
        selfVariationText: selfVariationText || "", // This product's own variation label
        availableModels: availableModels.map(v => ({
          product: v._id,
          variationText: v.variationText || "",
        })),
        selfAvailableModelText: selfAvailableModelText || "",
        colorVariations: colorVariations, // Add color variations array
        dosVariations: dosVariations, // Add DOS/Windows variations array
        sizes: selectedProductSizes.map((s) => ({
          size: s.sizeId || undefined,
          name: s.name || "",
          code: s.code || "",
          additionalPrice: Number(s.additionalPrice) || 0,
          countInStock: Number(s.countInStock) >= 0 ? Number(s.countInStock) : 0,
        })),
        // SEO fields
        seoTitle: formData.seoTitle || "",
        seoDescription: formData.seoDescription || "",
        seoKeywords: formData.seoKeywords || "",
        seoCanonicalUrl: formData.seoCanonicalUrl || "",
        seoRobots: formData.seoRobots || "index, follow",
        customSchema: formData.customSchema || "",
        ogTitle: formData.ogTitle || "",
        ogDescription: formData.ogDescription || "",
        ogImage: formData.ogImage || "",
        variationsDisplayType: formData.variationsDisplayType || "button",
        availableModelsDisplayType: formData.availableModelsDisplayType || "button",
        colorVariationsDisplayType: formData.colorVariationsDisplayType || "card",
      }
      if (!isSeoUnlocked) {
        PRODUCT_SEO_FIELDS.forEach((field) => {
          delete productData[field]
        })
      }
      await onSubmit(productData)
    } catch (error) {
      console.error("Error submitting form:", error)
    } finally {
      setLoading(false)
    }
  }

  // Debug logs for subcategory selection
  console.log("Selected subcategory value:", formData.category)
  console.log(
    "Fetched subcategories:",
    subCategories.map((s) => ({ id: s._id, name: s.name })),
  )
  // Debug log for taxes
  console.log("Fetched taxes:", taxes)

  const selectedProductImages = dedupeImageUrls([formData.image, ...(formData.galleryImages || [])])

  return (
    
    <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 text-gray-600 border bg-red-500 border-gray-300 rounded-md hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          </div>
      <h2 className="text-xl font-bold mb-6">{product ? "Edit Product" : "Add New Product"}</h2>
  
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter product name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter SKU"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="product-slug"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter barcode"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GTIN Number</label>
            <input
              type="text"
              name="gtin"
              value={formData.gtin}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Global Trade Item Number for Google Merchant"
            />
            <p className="text-xs text-gray-500 mt-1">Used for Google Merchant feed. Leave empty if not available.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Status <span className="text-red-500">*</span>
            </label>
            <select
              name="stockStatus"
              value={formData.stockStatus}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="In Stock">In Stock</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="PreOrder">PreOrder</option>
            </select>
          </div>

          {/* Parent Category Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Main Category <span className="text-red-500">*</span>
            </label>
            <select
              name="parentCategory"
              value={formData.parentCategory}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a Main Category</option>
              {parentCategories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Dropdown (Level 1) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subcategory (Level 1) <span className="text-red-500">*</span>
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!formData.parentCategory || subCategories.length === 0}
              required
            >
              <option value="">
                {formData.parentCategory ? "Select a Subcategory" : "Select a main category first"}
              </option>
              {subCategories.map((subCategory) => (
                <option key={subCategory._id} value={subCategory._id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Level 2 Dropdown (Optional) - Always show but disabled until Level 1 selected */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subcategory Level 2 <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <select
              name="subCategory2"
              value={formData.subCategory2}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!formData.category || subCategories2.length === 0}
            >
              <option value="">
                {!formData.category ? "Select Level 1 first" : subCategories2.length === 0 ? "No subcategories available" : "Select Subcategory Level 2"}
              </option>
              {subCategories2.map((subCategory) => (
                <option key={subCategory._id} value={subCategory._id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Level 3 Dropdown (Optional) - Always show but disabled until Level 2 selected */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subcategory Level 3 <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <select
              name="subCategory3"
              value={formData.subCategory3}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!formData.subCategory2 || subCategories3.length === 0}
            >
              <option value="">
                {!formData.subCategory2 ? "Select Level 2 first" : subCategories3.length === 0 ? "No subcategories available" : "Select Subcategory Level 3"}
              </option>
              {subCategories3.map((subCategory) => (
                <option key={subCategory._id} value={subCategory._id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory Level 4 Dropdown (Optional) - Always show but disabled until Level 3 selected */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subcategory Level 4 <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <select
              name="subCategory4"
              value={formData.subCategory4}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!formData.subCategory3 || subCategories4.length === 0}
            >
              <option value="">
                {!formData.subCategory3 ? "Select Level 3 first" : subCategories4.length === 0 ? "No subcategories available" : "Select Subcategory Level 4"}
              </option>
              {subCategories4.map((subCategory) => (
                <option key={subCategory._id} value={subCategory._id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand <span className="text-red-500">*</span>
            </label>
            <select
              name="brand"
              value={formData.brand}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a Brand</option>
              {brands.map((brand) => (
                <option key={brand._id} value={brand._id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          {PRODUCT_OPTION_FIELDS.map((optionConfig) => (
            <div key={optionConfig.field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{optionConfig.label}</label>
              <div className="flex items-center gap-2">
                <select
                  name={optionConfig.field}
                  value={formData[optionConfig.field]}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select {optionConfig.label}</option>
                  {productOptions[optionConfig.field].map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleCreateProductOption(optionConfig)}
                  className="px-3 py-2 text-xs font-medium rounded-md border border-gray-300 hover:bg-gray-50 whitespace-nowrap"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buying Price{!product && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              name="buyingPrice"
              value={formData.buyingPrice}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              step="0.01"
              min="0"
              {...(!product ? { required: true } : {})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wholesale Price (Rs) <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              name="wholesalePrice"
              value={formData.wholesalePrice}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Leave blank if not set"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base Price (Rs) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="basePrice"
              value={basePrice}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter base price"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Offer Price (Rs)</label>
            <input
              type="number"
              name="offerPrice"
              value={originalOfferPrice}
              onChange={handleOfferPriceChange}
              onBlur={handleOfferPriceBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter offer price (before tax)"
              min="0"
              step="0.01"
            />
            {/* {Number(originalOfferPrice) > 0 && (
              <p className="text-xs text-gray-600 mt-1">
                {taxRate > 0 ? (
                  <span className="text-blue-600 font-medium">
                    Includes approx VAT {taxRate}%: Rs {(
                      Number(originalOfferPrice) - Number(originalOfferPrice) / (1 + taxRate / 100)
                    ).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-gray-500">No VAT selected</span>
                )}
              </p>
            )} */}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
            <input
              type="number"
              name="discount"
              value={formData.discount}
              onChange={handleDiscountChange}
              onBlur={handleDiscountBlur}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
              min="0"
              max="100"
            />
          </div>
        </div>

        {/* Tax-inclusive price summary */}
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-4">
          <div className="flex flex-wrap gap-4 items-center text-sm">
            <div>
              Base Price: <b>{Number(basePrice).toFixed(2) || "0.00"} Rs</b>
            </div>
            <div>
              Offer Price: <b>{Number(formData.offerPrice).toFixed(2) || "0.00"} Rs</b>
            </div>
            <div>
              Discount: <b>{Number(formData.discount).toFixed(2) || "0.00"}%</b>
            </div>
            <div>
              Tax: <b>{taxRate}%</b>
            </div>
            <div>
              Tax Amount: <b className="text-blue-600">{taxAmount.toFixed(2)} Rs</b>
            </div>
            <div className="text-green-700 font-bold">
              Final Price (Saved): {Number(formData.price).toFixed(2)} Rs{" "}
              <span className="text-xs text-red-500 ml-2">Inclusive tax</span>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="space-y-4">
          <ImageUpload
            onImageUpload={handleBulkProductImagesUpload}
            label="Upload Product Images (Select Multiple) *"
            multiple={true}
            isProduct={true}
          />

          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-800">
                Selected Images ({selectedProductImages.length})
              </h4>
              {formData.image && (
                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                  Main image selected
                </span>
              )}
            </div>

            {selectedProductImages.length === 0 ? (
              <p className="text-sm text-gray-500">
                Upload multiple images above, then choose one as main image.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {selectedProductImages.map((img, index) => (
                  <div key={`${img}-${index}`} className="border rounded-lg p-2 bg-gray-50">
                    <img
                      src={getFullImageUrl(img) || "/placeholder.svg"}
                      alt={`Product ${index + 1}`}
                      className="h-24 w-full object-cover rounded mb-2"
                    />
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded ${
                          formData.image === img
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {formData.image === img ? "Main" : "Gallery"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedImage(img)}
                        className="text-red-500 hover:text-red-700"
                        title="Remove image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSetMainImage(img)}
                      disabled={formData.image === img}
                      className={`w-full text-xs px-2 py-1 rounded ${
                        formData.image === img
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                    >
                      {formData.image === img ? "Selected Main" : "Set as Main"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Videos Section */}
          <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Videos</h3>
            
            {/* Main Video */}
            <div className="mb-6">
              {/* Video Source Type Toggle */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Main Video Source</label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="videoSourceType"
                      value="upload"
                      checked={videoSourceType === "upload"}
                      onChange={() => handleVideoSourceTypeChange("upload")}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">Upload Video</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="videoSourceType"
                      value="youtube"
                      checked={videoSourceType === "youtube"}
                      onChange={() => handleVideoSourceTypeChange("youtube")}
                      className="mr-2 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">YouTube URL</span>
                  </label>
                </div>
              </div>

              {/* Upload Video Section */}
              {videoSourceType === "upload" && (
                <VideoUpload 
                  onVideoUpload={handleVideoUpload} 
                  currentVideo={formData.video} 
                  label="Main Product Video (MP4/WebM)" 
                />
              )}

              {/* YouTube URL Section */}
              {videoSourceType === "youtube" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube Video URL</label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={handleYoutubeUrlChange}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Paste the YouTube video URL. Supports youtube.com/watch?v=... and youtu.be/... formats.
                  </p>
                  {youtubeUrl && isYouTubeUrl(youtubeUrl) && (
                    <div className="mt-3 aspect-video w-full max-w-md">
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${youtubeUrl.includes('youtu.be/') 
                          ? youtubeUrl.split('youtu.be/')[1]?.split('?')[0] 
                          : youtubeUrl.split('v=')[1]?.split('&')[0]}`}
                        title="YouTube video preview"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="rounded-lg"
                      ></iframe>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Video Gallery - Only show when Upload Video is selected */}
            {videoSourceType === "upload" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Video Gallery</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formData.videoGallery.map((vid, index) => (
                  <div key={index} className="relative">
                    <VideoUpload
                      onVideoUpload={(url) => handleVideoGalleryUpload(url, index)}
                      currentVideo={vid}
                      label={`Gallery Video ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeVideoFromGallery(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 z-10"
                      title="Remove Video"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, videoGallery: [...prev.videoGallery, ""] }))}
                    className="w-full h-20 flex items-center justify-center border-2 border-dashed border-purple-300 rounded-lg text-purple-400 hover:text-purple-600 hover:border-purple-400 transition-colors"
                  >
                    <Plus size={24} />
                    <span className="ml-2">Add Video</span>
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Country Visibility & Regional Stock Management */}
        <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 space-y-4 mb-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-bold text-gray-800">
                🌍 Target Countries (Where to show this product)
              </label>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, targetCountries: ["ALL"] }))}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
              >
                Select All
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Select "All Countries" to show this product everywhere, or select specific target countries.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <label
                className={`inline-flex items-center px-3 py-1.5 rounded-full cursor-pointer text-xs font-semibold border transition-all ${
                  formData.targetCountries?.includes("ALL")
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={formData.targetCountries?.includes("ALL")}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData((prev) => ({ ...prev, targetCountries: ["ALL"] }))
                    } else {
                      setFormData((prev) => ({ ...prev, targetCountries: [availableCountries[0]?.code || "AE"] }))
                    }
                  }}
                />
                🌐 All Countries
              </label>

              {availableCountries.map((country) => {
                const isChecked =
                  !formData.targetCountries?.includes("ALL") &&
                  formData.targetCountries?.includes(country.code)

                return (
                  <label
                    key={country.code}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full cursor-pointer text-xs font-medium border transition-all ${
                      isChecked
                        ? "bg-indigo-100 text-indigo-800 border-indigo-400 font-semibold shadow-sm"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-1.5 h-3.5 w-3.5 text-blue-600 rounded"
                      checked={isChecked}
                      onChange={(e) => {
                        let current = (formData.targetCountries || []).filter((c) => c !== "ALL")
                        if (e.target.checked) {
                          current.push(country.code)
                        } else {
                          current = current.filter((c) => c !== country.code)
                        }
                        if (current.length === 0 || current.length === availableCountries.length) {
                          setFormData((prev) => ({ ...prev, targetCountries: ["ALL"] }))
                        } else {
                          setFormData((prev) => ({ ...prev, targetCountries: current }))
                        }
                      }}
                    />
                    {country.name} ({country.code})
                  </label>
                )
              })}
            </div>
          </div>

          {/* Per-Country Stock Quantities */}
          <div className="pt-3 border-t border-gray-200">
            <label className="block text-sm font-bold text-gray-800 mb-1">
              📦 Country-Specific Stock Quantities
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Set stock quantity per country. Total stock will be automatically calculated.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {availableCountries.map((country) => (
                <div key={country.code} className="bg-white p-2.5 rounded-md border border-gray-200 shadow-xs">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    {country.name} ({country.code})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.countryStock?.[country.code] ?? 0}
                    onChange={(e) => {
                      const newCount = Math.max(0, Number.parseInt(e.target.value) || 0)
                      const updatedStockMap = {
                        ...(formData.countryStock || {}),
                        [country.code]: newCount,
                      }
                      const totalStock = Object.values(updatedStockMap).reduce((sum, n) => sum + (Number(n) || 0), 0)
                      setFormData((prev) => ({
                        ...prev,
                        countryStock: updatedStockMap,
                        countInStock: totalStock.toString(),
                        stockStatus: totalStock > 0 ? "In Stock" : "Out of Stock",
                      }))
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stock & Settings */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Stock Quantity{!product && <span className="text-red-500">*</span>}
              {selectedProductSizes.length > 0 && (
                <span className="block text-xs font-normal text-amber-700">
                  (Synced with Product Sizes section below)
                </span>
              )}
            </label>
            <input
              type="number"
              name="countInStock"
              value={formData.countInStock}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                selectedProductSizes.length > 0
                  ? "border-amber-300 bg-amber-50/30 focus:ring-amber-500 font-semibold"
                  : "border-gray-300 focus:ring-blue-500"
              }`}
              placeholder="0"
              {...(!product ? { required: true } : {})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Warning</label>
            <input
              type="number"
              name="lowStockWarning"
              value={formData.lowStockWarning}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="5"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Purchase Quantity</label>
            <input
              type="number"
              name="maxPurchaseQty"
              value={formData.maxPurchaseQty}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="10"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
            <input
              type="number"
              name="weight"
              value={formData.weight}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              step="0.01"
            />
          </div>
        </div>

        {/* Additional Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {units.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax
              {formData.tax && taxRate > 0 && (
                <span className="ml-2 text-xs text-blue-600 font-medium">{taxRate}% - Inclusive tax</span>
              )}
            </label>
            <select
              name="tax"
              value={formData.tax}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a Tax</option>
              {taxes.map((tax) => (
                <option key={tax._id} value={tax._id}>
                  {tax.name}
                  {tax.rate ? ` (${tax.rate}${tax.type ? (tax.type === "percentage" ? "%" : "") : ""})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tag1, tag2, tag3"
            />
          </div>
        </div>

        {/* Loyalty points earned on this product. Leave on "inherit" unless this product
            needs its own rate -- inherit follows the category rule, then the global rate. */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Loyalty Points</h3>
          <p className="text-sm text-gray-500 mb-4">
            How many points a customer earns for buying this product.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Earning rule</label>
              <select
                name="loyaltyPointsMode"
                value={formData.loyaltyPointsMode}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="inherit">Use category / global rate</option>
                <option value="multiplier">Multiply the global rate</option>
                <option value="fixed">Fixed points per item</option>
                <option value="none">Earns no points</option>
              </select>
            </div>

            {formData.loyaltyPointsMode === "multiplier" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Multiplier</label>
                <input
                  type="number"
                  name="loyaltyPointsMultiplier"
                  min="0"
                  step="0.1"
                  value={formData.loyaltyPointsMultiplier}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="2"
                />
                <p className="text-xs text-gray-500 mt-1">2 gives double the usual points on this product.</p>
              </div>
            )}

            {formData.loyaltyPointsMode === "fixed" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points per item</label>
                <input
                  type="number"
                  name="loyaltyPointsFixed"
                  min="0"
                  step="1"
                  value={formData.loyaltyPointsFixed}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Exactly this many points per unit, whatever the price.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Product Specifications Section */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Product Specifications</h3>
            <button
              type="button"
              onClick={addSpecification}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
            >
              <Plus size={18} className="mr-2" />
              Add Specification
            </button>
          </div>

          {formData.specifications.length > 0 ? (
            <div className="space-y-4">
              {formData.specifications.map((spec, index) => (
                <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Specification #{index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeSpecification(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200"
                      title="Remove Specification"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Specification Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Processor, RAM, Storage"
                        value={spec.key}
                        onChange={(e) => updateSpecification(index, "key", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Specification Value <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Intel i5-1235U, 8GB DDR4, 512GB SSD"
                        value={spec.value}
                        onChange={(e) => updateSpecification(index, "value", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Plus size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No specifications added yet</h3>
              <p className="text-gray-500 mb-6">Add product specifications like processor, RAM, storage, etc.</p>
              <button
                type="button"
                onClick={addSpecification}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
              >
                <Plus size={18} className="mr-2" />
                Add First Specification
              </button>
            </div>
          )}

          {formData.specifications.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>{formData.specifications.length}</strong> specification
                {formData.specifications.length !== 1 ? "s" : ""} added
              </p>
            </div>
          )}
        </div>

        {/* Descriptions */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Key Features</label>
            <TipTapEditor
              content={formData.shortDescription}
              onChange={handleShortDescriptionChange}
              placeholder="Enter key features or paste specifications table..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description{!product && <span className="text-red-500">*</span>}
            </label>
            <TipTapEditor
              content={formData.description}
              onChange={handleDescriptionChange}
              placeholder="Enter detailed product description with images..."
              {...(!product ? { required: true } : {})}
            />
          </div>
        </div>

        {/* Status Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="text-sm text-gray-700">Active</label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="canPurchase"
              checked={formData.canPurchase}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="text-sm text-gray-700">Can Purchase</label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="showStockOut"
              checked={formData.showStockOut}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="text-sm text-gray-700">Show Stock Out</label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="refundable"
              checked={formData.refundable}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="text-sm text-gray-700">Refundable</label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="featured"
              checked={formData.featured}
              onChange={handleInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="text-sm text-gray-700">Featured</label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="hideFromShop"
              checked={formData.hideFromShop}
              onChange={handleInputChange}
              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
            />
            <label className="text-sm text-gray-700 flex items-center gap-1">
              Hide from Shop
              <span className="text-xs text-gray-500">(accessible via variations & direct link only)</span>
            </label>
          </div>
        </div>

        {/* Product Variations Section */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Product Variations</h3>
              <p className="text-sm text-gray-600 mt-1">
                Link this product with other variations (e.g., different RAM sizes, storage options)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowVariationModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
            >
              <Plus size={18} className="mr-2" />
              {selectedVariations.length > 0 ? 'Manage Variations' : 'Add Variation'}
            </button>
          </div>

          {/* Display Layout selection */}
          <div className="mb-6 flex items-center space-x-6 bg-white p-3 rounded-lg border border-gray-200">
            <span className="text-sm font-semibold text-gray-700 font-medium">Display Layout:</span>
            <label className="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="variationsDisplayType"
                value="button"
                checked={formData.variationsDisplayType === "button"}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mr-2"
              />
              Buttons
            </label>
            <label className="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="variationsDisplayType"
                value="card"
                checked={formData.variationsDisplayType === "card"}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mr-2"
              />
              Cards
            </label>
          </div>

          {/* Self Variation Text Input */}
          <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              This Product's Variation Label
            </label>
            <input
              type="text"
              placeholder="e.g., 16GB RAM, 512GB SSD, Black Color"
              value={selfVariationText}
              onChange={(e) => setSelfVariationText(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium"
            />
            <p className="text-xs text-gray-600 mt-2">
              <strong>Important:</strong> This label will appear as a selectable option when customers view any linked product. 
              For example, if you set this to "16GB RAM", customers viewing the 24GB or 32GB variants will see "16GB RAM" as a clickable option.
            </p>
          </div>

          {selectedVariations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedVariations.map((variation) => (
                <div
                  key={variation._id}
                  className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedVariations(prev => prev.filter(v => v._id !== variation._id))}
                    className="absolute top-2 right-2 p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200"
                    title="Remove Variation"
                  >
                    <X size={16} />
                  </button>

                  <div className="flex items-start space-x-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                      <img
                        src={getFullImageUrl(variation.image) || "/placeholder.svg"}
                        alt={variation.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 line-clamp-2">
                        {variation.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        SKU: {variation.sku || "N/A"}
                      </p>
                      <div className="mt-2">
                        <span className="text-sm font-bold text-gray-900">
                          {variation.offerPrice > 0 
                            ? `${Number(variation.offerPrice || 0).toFixed(2)} Rs`
                            : `${Number(variation.price || 0).toFixed(2)} Rs`
                          }
                        </span>
                      </div>
                      {variation.variationText && (
                        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <p className="text-xs text-blue-700 font-medium">
                            {variation.variationText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Plus size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No variations added yet</h3>
              <p className="text-gray-500 mb-6">
                Add product variations to help customers find the exact product they need
              </p>
              <button
                type="button"
                onClick={() => setShowVariationModal(true)}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
              >
                <Plus size={18} className="mr-2" />
                Add First Variation
              </button>
            </div>
          )}

          {selectedVariations.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>{selectedVariations.length}</strong> variation
                {selectedVariations.length !== 1 ? "s" : ""} added
              </p>
            </div>
          )}
        </div>

        {/* Available Models Section */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Available Models</h3>
              <p className="text-sm text-gray-600 mt-1">
                Link this product with other available models customers can compare or select
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAvailableModelsModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
            >
              <Plus size={18} className="mr-2" />
              {availableModels.length > 0 ? 'Manage Models' : 'Add Model'}
            </button>
          </div>

          {/* Display Layout selection */}
          <div className="mb-6 flex items-center space-x-6 bg-white p-3 rounded-lg border border-gray-200">
            <span className="text-sm font-semibold text-gray-700 font-medium">Display Layout:</span>
            <label className="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="availableModelsDisplayType"
                value="button"
                checked={formData.availableModelsDisplayType === "button"}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mr-2"
              />
              Buttons
            </label>
            <label className="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="availableModelsDisplayType"
                value="card"
                checked={formData.availableModelsDisplayType === "card"}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mr-2"
              />
              Cards
            </label>
          </div>

          <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              This Product's Available Model Label
            </label>
            <input
              type="text"
              placeholder="e.g., 16GB RAM, 512GB SSD, Black Color"
              value={selfAvailableModelText}
              onChange={(e) => setSelfAvailableModelText(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium"
            />
            <p className="text-xs text-gray-600 mt-2">
              <strong>Important:</strong> This label will identify this product inside the Available Models group.
            </p>
          </div>

          {availableModels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableModels.map((model) => (
                <div
                  key={model._id}
                  className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative"
                >
                  <button
                    type="button"
                    onClick={() => setAvailableModels(prev => prev.filter(v => v._id !== model._id))}
                    className="absolute top-2 right-2 p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200"
                    title="Remove Model"
                  >
                    <X size={16} />
                  </button>

                  <div className="flex items-start space-x-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                      <img
                        src={getFullImageUrl(model.image) || "/placeholder.svg"}
                        alt={model.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 line-clamp-2">
                        {model.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        SKU: {model.sku || "N/A"}
                      </p>
                      <div className="mt-2">
                        <span className="text-sm font-bold text-gray-900">
                          {model.offerPrice > 0
                            ? `${Number(model.offerPrice || 0).toFixed(2)} Rs`
                            : `${Number(model.price || 0).toFixed(2)} Rs`
                          }
                        </span>
                      </div>
                      {model.variationText && (
                        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <p className="text-xs text-blue-700 font-medium">
                            {model.variationText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
              <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Plus size={24} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No available models added yet</h3>
              <p className="text-gray-500 mb-6">
                Add available models to help customers compare related product options
              </p>
              <button
                type="button"
                onClick={() => setShowAvailableModelsModal(true)}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
              >
                <Plus size={18} className="mr-2" />
                Add First Model
              </button>
            </div>
          )}

          {availableModels.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>{availableModels.length}</strong> model
                {availableModels.length !== 1 ? "s" : ""} added
              </p>
            </div>
          )}
        </div>

        {/* Color Variations Section */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
          <ColorVariationForm
            colorVariations={colorVariations}
            onChange={setColorVariations}
            displayType={formData.colorVariationsDisplayType}
            onDisplayTypeChange={(value) => setFormData(prev => ({ ...prev, colorVariationsDisplayType: value }))}
          />
        </div>

        {/* DOS/Windows Variations Section */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-6 border border-blue-200">
          <DosVariationForm
            dosVariations={dosVariations}
            onChange={setDosVariations}
          />
        </div>

        {/* Product Sizes & Size-Based Pricing Section */}
        <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/80 rounded-lg p-6 border border-amber-300 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-300 flex items-center justify-center text-amber-700">
                <Ruler size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Product Sizes &amp; Size-Based Pricing</h3>
                <p className="text-xs text-gray-600">
                  Select available sizes for this product. You can configure individual additional prices for each size (e.g., +200 PKR for XL).
                </p>
              </div>
            </div>
            <div>
              <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-3 py-1 rounded-full border border-amber-200">
                {selectedProductSizes.length} {selectedProductSizes.length === 1 ? "Size" : "Sizes"} Selected
              </span>
            </div>
          </div>

          {/* Total Stock Quantity Management Inside Sizes Section */}
          <div className="mb-5 bg-white p-4 rounded-lg border border-amber-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-bold text-gray-900">
                  Total Stock Quantity{!product && <span className="text-red-500">*</span>}
                </label>
                {selectedProductSizes.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded border border-amber-300">
                    Auto-summed from sizes
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {selectedProductSizes.length > 0
                  ? "Total product stock across all sizes. Updates automatically when you edit individual size quantities below."
                  : "Total product stock quantity available for sale."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-40">
                <input
                  type="number"
                  name="countInStock"
                  min="0"
                  value={formData.countInStock}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2 text-base font-bold text-gray-900 bg-amber-50/50 border-2 border-amber-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-center"
                  placeholder="0"
                  {...(!product ? { required: true } : {})}
                />
              </div>
              <span className="text-xs font-bold px-3 py-2 rounded bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap">
                Units Total
              </span>
            </div>
          </div>

          {/* Available Sizes from Size Management */}
          <div className="mb-5 bg-white/80 p-4 rounded-lg border border-amber-200">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Available Active Sizes (Click to assign/unassign)
            </label>
            {availableSizes.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((sizeObj) => {
                  const isSelected = selectedProductSizes.some(
                    (s) => s.sizeId === sizeObj._id || (s.code && s.code.toLowerCase() === sizeObj.code.toLowerCase())
                  )
                  return (
                    <button
                      key={sizeObj._id}
                      type="button"
                      onClick={() => toggleSizeSelection(sizeObj)}
                      className={`px-3.5 py-2 rounded-md text-sm font-semibold border transition-all flex items-center gap-2 ${
                        isSelected
                          ? "bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-300"
                          : "bg-white text-gray-700 border-gray-300 hover:border-amber-400 hover:bg-amber-50/50"
                      }`}
                    >
                      <span>{sizeObj.name}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                          isSelected ? "bg-amber-800 text-amber-100" : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {sizeObj.code}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded border border-dashed border-gray-300 text-sm text-gray-500 text-center">
                No active sizes found. Go to <span className="font-semibold text-gray-800">Product System &gt; Sizes</span> to add sizes.
              </div>
            )}
          </div>

          {/* Size-Based Pricing Configuration Table */}
          {selectedProductSizes.length > 0 && (
            <div className="bg-white rounded-lg border border-amber-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-amber-50/50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Configured Sizes &amp; Additional Prices &amp; Stock
                </h4>
                <div className="text-xs text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded border border-amber-200">
                  Total Size Stock: <span className="font-bold text-stone-900">{selectedProductSizes.reduce((sum, s) => sum + (Number(s.countInStock) || 0), 0)}</span> | Pricing Formula: <span className="font-semibold">Final Price = Base Product Price + Additional Price</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Size Name</th>
                      <th className="px-4 py-3 text-left">Code</th>
                      <th className="px-4 py-3 text-left">Base Price</th>
                      <th className="px-4 py-3 text-left">Additional Price (+PKR)</th>
                      <th className="px-4 py-3 text-left">Final Calculated Price</th>
                      <th className="px-4 py-3 text-left">Stock Quantity</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {selectedProductSizes.map((s, index) => {
                      const effectiveBase =
                        originalOfferPrice !== "" && Number(originalOfferPrice) > 0
                          ? Number(originalOfferPrice)
                          : Number(basePrice) || Number(formData.price) || 0
                      const addPrice = Number(s.additionalPrice) || 0
                      const finalCalculated = effectiveBase + addPrice

                      return (
                        <tr key={s.sizeId || index} className="hover:bg-amber-50/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                            {s.name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                              {s.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                            Rs {effectiveBase.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center space-x-1 max-w-[170px]">
                              <span className="text-gray-500 font-medium text-xs">+ Rs</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={s.additionalPrice}
                                onChange={(e) => handleSizeAdditionalPriceChange(index, e.target.value)}
                                placeholder="0"
                                className="w-full px-2.5 py-1 text-sm font-semibold border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-bold text-green-700 text-base">
                              Rs {finalCalculated.toLocaleString()}
                            </span>
                            {addPrice > 0 && (
                              <span className="ml-1.5 text-xs text-amber-700 font-medium">
                                (+Rs {addPrice})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center space-x-1 max-w-[120px]">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={s.countInStock !== undefined ? s.countInStock : 0}
                                onChange={(e) => handleSizeStockChange(index, e.target.value)}
                                placeholder="0"
                                className="w-full px-2.5 py-1 text-sm font-semibold border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => removeSelectedProductSize(index)}
                              className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors"
                              title="Remove Size"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* SEO Settings Section */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">SEO Settings</h3>
          <p className="text-sm text-gray-500 mb-6">These fields are only used for search engine meta tags. They will NOT be displayed on the product page.</p>
          {!isSeoUnlocked && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
              SEO fields are locked. Use Unlock Potential from the sidebar.
            </p>
          )}
          
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isSeoUnlocked ? "" : "pointer-events-none opacity-60"}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
              <input
                type="text"
                name="seoTitle"
                value={formData.seoTitle}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Custom page title for Google (leave blank to use product name)"
              />
              <p className="text-xs text-gray-400 mt-1">
                {countWords(formData.seoTitle)}/{SEO_TITLE_MAX_WORDS} words
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Robots Meta</label>
              <select
                name="seoRobots"
                value={formData.seoRobots}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="index, follow">Index, Follow (default)</option>
                <option value="noindex, follow">No Index, Follow</option>
                <option value="index, nofollow">Index, No Follow</option>
                <option value="noindex, nofollow">No Index, No Follow</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
              <textarea
                name="seoDescription"
                value={formData.seoDescription}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Custom meta description for Google (leave blank to auto-generate from product description)"
                maxLength={160}
              />
              <p className="text-xs text-gray-400 mt-1">{formData.seoDescription.length}/160 characters</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Meta Keywords</label>
              <input
                type="text"
                name="seoKeywords"
                value={formData.seoKeywords}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="keyword1, keyword2, keyword3"
              />
              <p className="text-xs text-gray-400 mt-1">Comma-separated keywords for search engines</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Canonical URL</label>
              <input
                type="text"
                name="seoCanonicalUrl"
                value={formData.seoCanonicalUrl}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="https://example.com/product/my-product (leave blank for default)"
              />
              <p className="text-xs text-gray-400 mt-1">Override the canonical URL if needed (leave blank to use default product URL)</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Schema Markup (HTML/JS)
              </label>
              <textarea
                name="customSchema"
                value={formData.customSchema}
                onChange={handleInputChange}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                placeholder={'<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  "name": "Your Product Name"\n}\n</script>'}
              />
              <p className="text-xs text-gray-400 mt-1">
                Paste JSON-LD script tags (recommended) or custom head HTML/JS. It is injected into page head and not visible to users.
              </p>
            </div>
          </div>

          {/* Open Graph Settings */}
          <div className="mt-6 pt-6 border-t border-green-200">
            <h4 className="text-md font-semibold text-gray-800 mb-4">Open Graph (Social Media Sharing)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OG Title</label>
                <input
                  type="text"
                  name="ogTitle"
                  value={formData.ogTitle}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Title for Facebook/Twitter sharing (leave blank to use Meta Title)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OG Image URL</label>
                <input
                  type="text"
                  name="ogImage"
                  value={formData.ogImage}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Image URL for social sharing (leave blank to use product image)"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">OG Description</label>
                <textarea
                  name="ogDescription"
                  value={formData.ogDescription}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Description for social sharing (leave blank to use Meta Description)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Saving..." : product ? "Update Product" : "Create Product"}
          </button>
        </div>
      </form>

      {/* Product Variation Modal */}
      <ProductVariationModal
        isOpen={showVariationModal}
        onClose={() => setShowVariationModal(false)}
        onSelectProducts={(products, selfText) => {
          setSelectedVariations(products)
          setSelfVariationText(selfText || "")
        }}
        selectedVariations={selectedVariations}
        currentProductId={product?._id}
        currentProductName={formData.name}
        currentSelfVariationText={selfVariationText}
      />

      {/* Available Models Modal */}
      <ProductVariationModal
        isOpen={showAvailableModelsModal}
        onClose={() => setShowAvailableModelsModal(false)}
        onSelectProducts={(products, selfText) => {
          setAvailableModels(products)
          setSelfAvailableModelText(selfText || "")
        }}
        selectedVariations={availableModels}
        currentProductId={product?._id}
        currentProductName={formData.name}
        currentSelfVariationText={selfAvailableModelText}
        modalTitle="Select Available Models"
        selfTextLabel="Available model label"
        selfTextHelp="This is how THIS product will be labeled inside the Available Models group."
        selectedItemsLabel="available models"
        selectedItemsTip="Selected models will be saved with this product."
      />
    </div>
  )
}

export default ProductForm
