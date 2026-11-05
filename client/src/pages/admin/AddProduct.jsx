"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useToast } from "../../context/ToastContext"
import AdminSidebar from "../../components/admin/AdminSidebar"
import ImageUpload from "../../components/ImageUpload"
import TipTapEditor from "../../components/TipTapEditor"
import { ArrowLeft, Plus, X } from "lucide-react"
import axios from "axios"
import { getFullImageUrl } from "../../utils/imageUtils"
import { isSeoUnlockTokenValid } from "../../utils/seoUnlock"

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

const DEFAULT_COUNTRIES = [
  { code: "AE", name: "UAE" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "QA", name: "Qatar" },
  { code: "OM", name: "Oman" },
  { code: "BH", name: "Bahrain" },
  { code: "KW", name: "Kuwait" },
]

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

const AddProduct = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [categories, setCategories] = useState([])
  const [subCategories, setSubCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [availableCountries, setAvailableCountries] = useState(DEFAULT_COUNTRIES)
  const [taxes, setTaxes] = useState([])
  const [units, setUnits] = useState([])
  const [warranties, setWarranties] = useState([])
  const [volumes, setVolumes] = useState([])
  const [productOptions, setProductOptions] = useState({
    series: [],
    model: [],
    make: [],
    manufacturer: [],
    soldBy: [],
  })
  const [colors, setColors] = useState([])
  const [sizes, setSizes] = useState([])
  const [loading, setLoading] = useState(false)
  const [isSeoUnlocked, setIsSeoUnlocked] = useState(isSeoUnlockTokenValid())
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    slug: "",
    category: "",
    subCategory: "",
    barcode: "",
    gtin: "",
    buyingPrice: "",
    price: "", // This will be base price + tax
    offerPrice: "", // This will be offer price + tax
    discount: "",
    image: "",
    galleryImages: [],
    tax: "",
    brand: "",
    series: "",
    model: "",
    make: "",
    manufacturer: "",
    soldBy: "",
    isActive: true,
    canPurchase: true,
    showStockOut: true,
    refundable: true,
    maxPurchaseQty: "",
    lowStockWarning: "",
    unit: "",
    warranty: "",
    volume: "",
    selectedColors: [],
    selectedSizes: [],
    weight: "",
    tags: "",
    shortDescription: "",
    description: "",
    stockStatus: "",
    countInStock: "0",
    targetCountries: ["ALL"],
    countryStock: { AE: 0, SA: 0, QA: 0, OM: 0, BH: 0, KW: 0 },
    specifications: [],
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    seoCanonicalUrl: "",
    seoRobots: "index, follow",
    customSchema: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
  })

  // Separate state for price inputs (treated as tax-inclusive per business rule)
  const [basePriceWithoutTax, setBasePriceWithoutTax] = useState("")
  const [offerPriceWithoutTax, setOfferPriceWithoutTax] = useState("")
  const [taxRate, setTaxRate] = useState(0)

  useEffect(() => {
    fetchAllData()
  }, [])

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

  useEffect(() => {
    if (formData.category) {
      fetchSubCategories(formData.category)
    } else {
      setSubCategories([])
      setFormData((prev) => ({ ...prev, subCategory: "" }))
    }
  }, [formData.category])

  useEffect(() => {
    if (formData.tax && taxes.length > 0) {
      const selectedTax = taxes.find((t) => t._id === formData.tax)
      setTaxRate(selectedTax ? Number(selectedTax.rate) : 0)
    } else {
      setTaxRate(0)
    }
  }, [formData.tax, taxes])

  // Keep entered prices as final (tax-inclusive). Selecting Tax/VAT is informational only.
  useEffect(() => {
    const baseWithoutTax = Number(basePriceWithoutTax) || 0
    const offerWithoutTax = Number(offerPriceWithoutTax) || 0
    // Do NOT add tax again; treat entered values as final prices (tax already included)
    if (baseWithoutTax > 0) {
      setFormData((prev) => ({
        ...prev,
        price: baseWithoutTax.toFixed(2),
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        price: "",
      }))
    }

    if (offerWithoutTax > 0) {
      setFormData((prev) => ({
        ...prev,
        offerPrice: offerWithoutTax.toFixed(2),
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        offerPrice: "",
      }))
    }
  }, [basePriceWithoutTax, offerPriceWithoutTax])

  const fetchAllData = async () => {
    try {
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")

      if (!token) {
        showToast("Please login as admin first", "error")
        navigate("/irhaasadmin/login")
        return
      }

      const headers = { Authorization: `Bearer ${token}` }

      axios.get(`${config.API_URL}/api/countries/active`).then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setAvailableCountries(res.data.map(c => ({ code: c.code, name: c.name })))
        }
      }).catch(() => {
        axios.get(`${config.API_URL}/api/countries`).then(res => {
          if (Array.isArray(res.data) && res.data.length > 0) {
            const active = res.data.filter(c => c.isActive !== false)
            if (active.length > 0) {
              setAvailableCountries(active.map(c => ({ code: c.code, name: c.name })))
            }
          }
        }).catch(() => {})
      })

      const fetchPromises = []

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/categories`, { headers }).catch((err) => {
          console.log("Categories API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/brands`, { headers }).catch((err) => {
          console.log("Brands API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/tax`, { headers }).catch((err) => {
          console.log("Tax API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/units`, { headers }).catch((err) => {
          console.log("Units API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/warranty`, { headers }).catch((err) => {
          console.log("Warranty API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/volumes`, { headers }).catch((err) => {
          console.log("Volumes API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/colors`, { headers }).catch((err) => {
          console.log("Colors API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/sizes`, { headers }).catch((err) => {
          console.log("Sizes API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/product-system-options/series`, { headers }).catch((err) => {
          console.log("Series API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/product-system-options/make`, { headers }).catch((err) => {
          console.log("Make API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/product-system-options/model`, { headers }).catch((err) => {
          console.log("Model API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/product-system-options/manufacturer`, { headers }).catch((err) => {
          console.log("Manufacturer API error:", err)
          return { data: [] }
        }),
      )

      fetchPromises.push(
        axios.get(`${config.API_URL}/api/product-system-options/sold-by`, { headers }).catch((err) => {
          console.log("Sold By API error:", err)
          return { data: [] }
        }),
      )

      const [categoriesRes, brandsRes, taxesRes, unitsRes, warrantiesRes, volumesRes, colorsRes, sizesRes, seriesRes, makeRes, modelRes, manufacturerRes, soldByRes] =
        await Promise.all(fetchPromises)

      console.log("API Responses:", {
        categories: categoriesRes.data,
        brands: brandsRes.data,
        taxes: taxesRes.data,
        units: unitsRes.data,
        warranties: warrantiesRes.data,
        colors: colorsRes.data,
        sizes: sizesRes.data,
      })

      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data.filter((cat) => cat.isActive !== false) : [])
      setBrands(Array.isArray(brandsRes.data) ? brandsRes.data.filter((brand) => brand.isActive !== false) : [])
      setTaxes(Array.isArray(taxesRes.data) ? taxesRes.data.filter((tax) => tax.isActive !== false) : [])
      setUnits(Array.isArray(unitsRes.data) ? unitsRes.data.filter((unit) => unit.isActive !== false) : [])
      setWarranties(
        Array.isArray(warrantiesRes.data) ? warrantiesRes.data.filter((warranty) => warranty.isActive !== false) : [],
      )
      setVolumes(Array.isArray(volumesRes.data) ? volumesRes.data.filter((volume) => volume.isActive !== false) : [])
      setColors(Array.isArray(colorsRes.data) ? colorsRes.data.filter((color) => color.isActive !== false) : [])
      setSizes(Array.isArray(sizesRes.data) ? sizesRes.data.filter((size) => size.isActive !== false) : [])
      setProductOptions({
        series: Array.isArray(seriesRes.data) ? seriesRes.data.filter((item) => item.isActive !== false) : [],
        model: Array.isArray(modelRes.data) ? modelRes.data.filter((item) => item.isActive !== false) : [],
        make: Array.isArray(makeRes.data) ? makeRes.data.filter((item) => item.isActive !== false) : [],
        manufacturer: Array.isArray(manufacturerRes.data) ? manufacturerRes.data.filter((item) => item.isActive !== false) : [],
        soldBy: Array.isArray(soldByRes.data) ? soldByRes.data.filter((item) => item.isActive !== false) : [],
      })
    } catch (error) {
      console.error("Error fetching data:", error)
      showToast("Failed to load some form data. Please check if all services are running.", "error")
    }
  }

  const fetchSubCategories = async (categoryId) => {
    try {
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")

      const { data } = await axios.get(`${config.API_URL}/api/subcategories/category/${categoryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setSubCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching subcategories:", error)
      setSubCategories([])
    }
  }

  const fetchProductOptionsByType = async (routeType) => {
    try {
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")
      const { data } = await axios.get(`${config.API_URL}/api/product-system-options/${routeType}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return Array.isArray(data) ? data.filter((item) => item.isActive !== false) : []
    } catch (error) {
      console.error(`Error fetching ${routeType}:`, error)
      return []
    }
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
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const refreshed = await fetchProductOptionsByType(routeType)
      setProductOptions((prev) => ({ ...prev, [field]: refreshed }))
      if (data?._id) {
        setFormData((prev) => ({ ...prev, [field]: String(data._id) }))
      }
      showToast(`${label} added successfully`, "success")
    } catch (error) {
      console.error(`Error adding ${label}:`, error)
      showToast(error.response?.data?.message || `Failed to add ${label}`, "error")
    }
  }

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim("-")
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const normalizedValue = name === "seoTitle" ? limitWords(value, SEO_TITLE_MAX_WORDS) : value

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : normalizedValue,
    }))

    if (name === "name" && value) {
      setFormData((prev) => ({
        ...prev,
        slug: generateSlug(value),
      }))
    }
  }

  // Handle base price change
  const handleBasePriceChange = (e) => {
    const basePrice = e.target.value
    setBasePriceWithoutTax(basePrice)
  }

  // Handle offer price change and calculate discount
  const handleOfferPriceChange = (e) => {
    const offerPrice = e.target.value
    const basePrice = Number(basePriceWithoutTax) || 0

    setOfferPriceWithoutTax(offerPrice)

    // Calculate discount when offer price changes
    if (basePrice > 0 && offerPrice) {
      const offer = Number(offerPrice)
      if (offer > 0) {
        const discount = Math.max(0, Math.round(((basePrice - offer) / basePrice) * 100))
        setFormData((prev) => ({
          ...prev,
          discount: discount.toString(),
        }))
      }
    }
  }

  // Handle discount change and calculate base price
  const handleDiscountChange = (e) => {
    const discount = e.target.value
    const offerPrice = Number(offerPriceWithoutTax) || 0

    setFormData((prev) => ({
      ...prev,
      discount: discount,
    }))

    // Calculate base price when discount changes (keeping offer price fixed)
    if (offerPrice > 0 && discount) {
      const discountNum = Number(discount)
      if (discountNum >= 0 && discountNum < 100) {
        // Formula: basePrice = offerPrice / (1 - discount/100)
        const basePrice = offerPrice / (1 - discountNum / 100)
        setBasePriceWithoutTax(basePrice.toFixed(2))
      } else if (discountNum === 0) {
        // If discount is 0, base price equals offer price
        setBasePriceWithoutTax(offerPrice.toFixed(2))
      }
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

  const handleColorChange = (colorId) => {
    setFormData((prev) => ({
      ...prev,
      selectedColors: prev.selectedColors.includes(colorId)
        ? prev.selectedColors.filter((id) => id !== colorId)
        : [...prev.selectedColors, colorId],
    }))
  }

  const handleSizeChange = (sizeObj) => {
    setFormData((prev) => {
      const exists = prev.selectedSizes.some((s) => (s.sizeId || s) === sizeObj._id)
      return {
        ...prev,
        selectedSizes: exists
          ? prev.selectedSizes.filter((s) => (s.sizeId || s) !== sizeObj._id)
          : [
              ...prev.selectedSizes,
              {
                sizeId: sizeObj._id,
                name: sizeObj.name,
                code: sizeObj.code,
                additionalPrice: 0,
              },
            ],
      }
    })
  }

  const handleSizeAdditionalPriceChange = (index, value) => {
    const numVal = value === "" ? "" : Math.max(0, Number.parseFloat(value) || 0)
    setFormData((prev) => ({
      ...prev,
      selectedSizes: prev.selectedSizes.map((item, i) => (i === index ? { ...item, additionalPrice: numVal } : item)),
    }))
  }

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")

      if (!token) {
        showToast("Please login as admin first", "error")
        navigate("/irhaasadmin/login")
        return
      }

      const productData = {
        name: formData.name,
        sku: formData.sku,
        slug: formData.slug,
        parentCategory: formData.category,
        category: formData.subCategory,
        subCategory: formData.subCategory || null,
        barcode: formData.barcode,
        buyingPrice: Number.parseFloat(formData.buyingPrice) || 0,
        price: Number.parseFloat(formData.price) || 0, // Base price + tax
        offerPrice: Number.parseFloat(formData.offerPrice) || 0, // Offer price + tax
        discount: Number.parseFloat(formData.discount) || 0,
        image: formData.image,
        galleryImages: formData.galleryImages.filter((img) => img !== ""),
        tax: formData.tax,
        brand: formData.brand,
        series: formData.series || undefined,
        model: formData.model || undefined,
        make: formData.make || undefined,
        manufacturer: formData.manufacturer || undefined,
        soldBy: formData.soldBy || undefined,
        isActive: formData.isActive,
        canPurchase: formData.canPurchase,
        showStockOut: formData.showStockOut,
        refundable: formData.refundable,
        maxPurchaseQty: Number.parseInt(formData.maxPurchaseQty) || 1,
        lowStockWarning: Number.parseInt(formData.lowStockWarning) || 5,
        unit: formData.unit,
        warranty: formData.warranty,
        volume: formData.volume,
        colors: formData.selectedColors,
        sizes: (formData.selectedSizes || []).map((s) => ({
          size: s.sizeId || s,
          name: s.name || "",
          code: s.code || "",
          additionalPrice: Number(s.additionalPrice) || 0,
        })),
        weight: Number.parseFloat(formData.weight) || 0,
        tags: formData.tags ? formData.tags.split(",").map((tag) => tag.trim()) : [],
        shortDescription: formData.shortDescription,
        description: formData.description,
        countInStock: Number.parseInt(formData.countInStock) || 0,
        targetCountries: Array.isArray(formData.targetCountries) && formData.targetCountries.length > 0 ? formData.targetCountries : ["ALL"],
        countryStock: Object.entries(formData.countryStock || {}).map(([country, count]) => ({
          country: String(country).toUpperCase(),
          countInStock: Number(count) || 0,
        })),
        stockStatus: formData.stockStatus,
        specifications: formData.specifications.filter((spec) => spec.key && spec.value),
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
      }

      if (!isSeoUnlocked) {
        PRODUCT_SEO_FIELDS.forEach((field) => {
          delete productData[field]
        })
      }

      await axios.post(`${config.API_URL}/api/products`, productData, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      showToast("Product added successfully!", "success")
      navigate("/admin/products")
    } catch (error) {
      console.error("Error adding product:", error)
      showToast(error.response?.data?.message || "Failed to add product", "error")
    } finally {
      setLoading(false)
    }
  }

  const selectedProductImages = dedupeImageUrls([formData.image, ...(formData.galleryImages || [])])

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 ml-64 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <button
                onClick={() => navigate("/admin/products")}
                className="hover:text-blue-600 flex items-center gap-1"
              >
                <ArrowLeft size={16} />
                Products
              </button>
              <span>/</span>
              <span className="text-gray-900">Add Product</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Data Status:</h3>
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div>Categories: {categories.length}</div>
              <div>Sub Categories: {subCategories.length}</div>
              <div>Brands: {brands.length}</div>
              <div>Colors: {colors.length}</div>
              <div>Sizes: {sizes.length}</div>
              <div>Taxes: {taxes.length}</div>
              <div>Units: {units.length}</div>
              <div>Warranties: {warranties.length}</div>
              <div>Volumes: {volumes.length}</div>
              <div>Series: {productOptions.series.length}</div>
              <div>Model: {productOptions.model.length}</div>
              <div>Make: {productOptions.make.length}</div>
              <div>Manufacturers: {productOptions.manufacturer.length}</div>
              <div>Sold By: {productOptions.soldBy.length}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Slug (Custom Link) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="product-custom-url"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">This will be used in the product URL</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a Category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sub Category</label>
                  <select
                    name="subCategory"
                    value={formData.subCategory}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={!formData.category}
                  >
                    <option value="">Select a Sub Category</option>
                    {subCategories.map((subCategory) => (
                      <option key={subCategory._id} value={subCategory._id}>
                        {subCategory.name}
                      </option>
                    ))}
                  </select>
                  {!formData.category && <p className="text-xs text-gray-500 mt-1">Please select a category first</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Barcode</label>
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">GTIN Number</label>
                  <input
                    type="text"
                    name="gtin"
                    value={formData.gtin}
                    onChange={handleChange}
                    placeholder="Global Trade Item Number for Google Merchant"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used for Google Merchant feed. Leave empty if not available.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stock Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="stockStatus"
                    value={formData.stockStatus}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Any One</option>
                    <option value="In Stock">In Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                    <option value="PreOrder">PreOrder</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Pricing</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buying Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="buyingPrice"
                    value={formData.buyingPrice}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Price (Before Tax) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={basePriceWithoutTax}
                    onChange={handleBasePriceChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Offer Price (Before Tax)</label>
                  <input
                    type="number"
                    value={offerPriceWithoutTax}
                    onChange={handleOfferPriceChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount (%)</label>
                  <input
                    type="number"
                    name="discount"
                    value={formData.discount}
                    onChange={handleDiscountChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              {/* Tax Selection */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax/VAT <span className="text-red-500">*</span>
                </label>
                <select
                  name="tax"
                  value={formData.tax}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Tax/VAT</option>
                  {taxes.map((tax) => (
                    <option key={tax._id} value={tax._id}>
                      {tax.name} ({tax.rate}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Summary */}
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded p-4">
                <h3 className="text-sm font-medium text-gray-800 mb-3">Price Summary:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Base Price Section */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Base Price Breakdown:</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Base Price (Before Tax):</span>
                        <span className="font-semibold">
                          {(() => {
                            const rate = (Number(taxRate) || 0) / 100
                            const withTax = Number(formData.price) || 0
                            if (!withTax || rate <= 0) return (Number(basePriceWithoutTax) || 0).toString() + ' Rs'
                            const beforeTax = withTax / (1 + rate)
                            return beforeTax.toFixed(2) + ' Rs'
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax ({taxRate}%):</span>
                        <span className="font-semibold">
                          {(() => {
                            const rate = (Number(taxRate) || 0) / 100
                            const withTax = Number(formData.price) || 0
                            if (!withTax || rate <= 0) return '0 Rs'
                            const beforeTax = withTax / (1 + rate)
                            const taxAmt = withTax - beforeTax
                            return taxAmt.toFixed(2) + ' Rs'
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="text-gray-600 font-medium">Final Base Price (With Tax):</span>
                        <span className="font-bold text-blue-600">{formData.price || 0} Rs</span>
                      </div>
                    </div>
                  </div>

                  {/* Offer Price Section */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Offer Price Breakdown:</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Offer Price (Before Tax):</span>
                        <span className="font-semibold">
                          {(() => {
                            const rate = (Number(taxRate) || 0) / 100
                            const withTax = Number(formData.offerPrice) || 0
                            if (!withTax || rate <= 0) return (Number(offerPriceWithoutTax) || 0).toString() + ' Rs'
                            const beforeTax = withTax / (1 + rate)
                            return beforeTax.toFixed(2) + ' Rs'
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax ({taxRate}%):</span>
                        <span className="font-semibold">
                          {(() => {
                            const rate = (Number(taxRate) || 0) / 100
                            const withTax = Number(formData.offerPrice) || 0
                            if (!withTax || rate <= 0) return '0 Rs'
                            const beforeTax = withTax / (1 + rate)
                            const taxAmt = withTax - beforeTax
                            return taxAmt.toFixed(2) + ' Rs'
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="text-gray-600 font-medium">Final Offer Price (With Tax):</span>
                        <span className="font-bold text-green-600">{formData.offerPrice || 0} Rs</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Discount Display */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">Discount:</span>
                    <span className="font-bold text-red-600">{formData.discount || 0}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Product Images */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Product Images</h2>

              <div className="space-y-4 mb-6">
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
                      <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Main image selected</span>
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
              </div>
            </div>

            {/* Product Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Product Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
                  <select
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">{optionConfig.label}</label>
                    <div className="flex items-center gap-2">
                      <select
                        name={optionConfig.field}
                        value={formData[optionConfig.field]}
                        onChange={handleChange}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a Unit</option>
                    {units.map((unit) => (
                      <option key={unit._id} value={unit._id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Warranty</label>
                  <select
                    name="warranty"
                    value={formData.warranty}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Warranty</option>
                    {warranties.map((warranty) => (
                      <option key={warranty._id} value={warranty._id}>
                        {warranty.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Volume</label>
                  <select
                    name="volume"
                    value={formData.volume}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Volume</option>
                    {volumes.map((volume) => (
                      <option key={volume._id} value={volume._id}>
                        {volume.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Weight</label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Colors (Select Multiple)</h2>
              {colors.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {colors.map((color) => (
                    <div key={color._id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`color-${color._id}`}
                        checked={formData.selectedColors.includes(color._id)}
                        onChange={() => handleColorChange(color._id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`color-${color._id}`} className="text-sm text-gray-700 flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-2 border border-gray-300"
                          style={{ backgroundColor: color.hexCode || color.code || "#ccc" }}
                        ></div>
                        {color.name}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">No colors available. Please add colors first.</div>
              )}
            </div>

            {/* Sizes & Size-Based Pricing */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Product Sizes &amp; Size-Based Pricing</h2>
                  <p className="text-xs text-gray-500">
                    Select sizes available for this product and configure size-based price adjustments.
                  </p>
                </div>
                <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full">
                  {(formData.selectedSizes || []).length} Selected
                </span>
              </div>

              {sizes.length > 0 ? (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
                    {sizes.map((size) => {
                      const isSelected = (formData.selectedSizes || []).some(
                        (s) => (s.sizeId || s) === size._id || (s.code && s.code === size.code)
                      )
                      return (
                        <div
                          key={size._id}
                          onClick={() => handleSizeChange(size)}
                          className={`cursor-pointer p-2.5 rounded-lg border text-sm font-medium transition-all flex items-center justify-between ${
                            isSelected
                              ? "border-amber-600 bg-amber-50 text-amber-900 shadow-sm"
                              : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                          }`}
                        >
                          <span>{size.name}</span>
                          <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                            {size.code}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {(formData.selectedSizes || []).length > 0 && (
                    <div className="mt-4 border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                          <tr>
                            <th className="px-4 py-2 text-left">Size</th>
                            <th className="px-4 py-2 text-left">Base Price</th>
                            <th className="px-4 py-2 text-left">Additional Price (+PKR)</th>
                            <th className="px-4 py-2 text-left">Final Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {formData.selectedSizes.map((s, index) => {
                            const baseP = Number(formData.offerPrice) > 0 ? Number(formData.offerPrice) : Number(formData.price) || 0
                            const addP = Number(s.additionalPrice) || 0
                            return (
                              <tr key={s.sizeId || index}>
                                <td className="px-4 py-2 font-medium">
                                  {s.name} ({s.code})
                                </td>
                                <td className="px-4 py-2 text-gray-500">
                                  Rs {baseP.toLocaleString()}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center space-x-1 max-w-[140px]">
                                    <span className="text-xs text-gray-400">+ Rs</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={s.additionalPrice}
                                      onChange={(e) => handleSizeAdditionalPriceChange(index, e.target.value)}
                                      placeholder="0"
                                      className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-amber-500"
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-2 font-bold text-green-700">
                                  Rs {(baseP + addP).toLocaleString()}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4 text-sm">No sizes available. Please add sizes first.</div>
              )}
            </div>

            {/* Specifications */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Product Specifications</h2>
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
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-700">Specification #{index + 1}</h3>
                        <button
                          type="button"
                          onClick={() => removeSpecification(index)}
                          className="text-red-600 hover:text-red-800 p-1"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 mb-4">No specifications added yet</p>
                  <button
                    type="button"
                    onClick={addSpecification}
                    className="flex items-center mx-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    <Plus size={16} className="mr-2" />
                    Add First Specification
                  </button>
                </div>
              )}
            </div>

            {/* Status Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Status Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Status:</label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="isActive"
                        value="true"
                        checked={formData.isActive === true}
                        onChange={() => setFormData((prev) => ({ ...prev, isActive: true }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label className="ml-2 text-sm text-gray-700">Active</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="isActive"
                        value="false"
                        checked={formData.isActive === false}
                        onChange={() => setFormData((prev) => ({ ...prev, isActive: false }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label className="ml-2 text-sm text-gray-700">Inactive</label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Can Purchase:</label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="canPurchase"
                        value="true"
                        checked={formData.canPurchase === true}
                        onChange={() => setFormData((prev) => ({ ...prev, canPurchase: true }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label className="ml-2 text-sm text-gray-700">Yes</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="canPurchase"
                        value="false"
                        checked={formData.canPurchase === false}
                        onChange={() => setFormData((prev) => ({ ...prev, canPurchase: false }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label className="ml-2 text-sm text-gray-700">No</label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Show Stock Out:</label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="showStockOut"
                        value="true"
                        checked={formData.showStockOut === true}
                        onChange={() => setFormData((prev) => ({ ...prev, showStockOut: true }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label className="ml-2 text-sm text-gray-700">Enable</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="showStockOut"
                        value="false"
                        checked={formData.showStockOut === false}
                        onChange={() => setFormData((prev) => ({ ...prev, showStockOut: false }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label className="ml-2 text-sm text-gray-700">Disable</label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Refundable:</label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="refundable"
                        value="true"
                        checked={formData.refundable === true}
                        onChange={() => setFormData((prev) => ({ ...prev, refundable: true }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label className="ml-2 text-sm text-gray-700">Yes</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="refundable"
                        value="false"
                        checked={formData.refundable === false}
                        onChange={() => setFormData((prev) => ({ ...prev, refundable: false }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label className="ml-2 text-sm text-gray-700">No</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Country Visibility & Regional Stock Management */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">🌍 Country Visibility & Stock Management</h2>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-bold text-gray-800">
                    Target Countries (Where to show this product)
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
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-bold text-gray-800 mb-1">
                  📦 Country-Specific Stock Quantities
                </label>
                <p className="text-xs text-gray-500 mb-4">
                  Set stock quantity per country. Total stock will be automatically calculated.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {availableCountries.map((country) => (
                    <div key={country.code} className="bg-gray-50 p-3 rounded-md border border-gray-200">
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
                        className="w-full px-2.5 py-1.5 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stock & Purchase Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Stock & Purchase Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Purchase Quantity</label>
                  <input
                    type="number"
                    name="maxPurchaseQty"
                    value={formData.maxPurchaseQty}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Low Stock Quantity Warning</label>
                  <input
                    type="number"
                    name="lowStockWarning"
                    value={formData.lowStockWarning}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Tags</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="tag1, tag2, tag3"
                />
                <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
              </div>
            </div>

            {/* Descriptions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Product Descriptions</h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Short Description</label>
                <TipTapEditor
                  content={formData.shortDescription}
                  onChange={handleShortDescriptionChange}
                  placeholder="Enter brief product description with formatting..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <TipTapEditor
                  content={formData.description}
                  onChange={handleDescriptionChange}
                  placeholder="Enter detailed product description with images and formatting..."
                />
              </div>
            </div>

            {/* SEO Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-lg font-semibold text-gray-900">SEO Settings</h2>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">For Google Only</span>
              </div>
              <p className="text-sm text-gray-500 mb-6">These fields are only used for search engine meta tags. They will NOT be displayed on the product page.</p>
              {!isSeoUnlocked && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
                  SEO fields are locked. Use Unlock Potential from the sidebar.
                </p>
              )}
              
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isSeoUnlocked ? "" : "pointer-events-none opacity-60"}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meta Title</label>
                  <input
                    type="text"
                    name="seoTitle"
                    value={formData.seoTitle}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Custom title for Google (leave blank to use product name)"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    {countWords(formData.seoTitle)}/{SEO_TITLE_MAX_WORDS} words
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Robots Meta</label>
                  <select
                    name="seoRobots"
                    value={formData.seoRobots}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="index, follow">Index, Follow (default)</option>
                    <option value="noindex, follow">No Index, Follow</option>
                    <option value="index, nofollow">Index, No Follow</option>
                    <option value="noindex, nofollow">No Index, No Follow</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meta Description</label>
                  <textarea
                    name="seoDescription"
                    value={formData.seoDescription}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Custom meta description for Google (leave blank to auto-generate)"
                    maxLength={160}
                  />
                  <p className="text-xs text-gray-400 mt-1">{formData.seoDescription.length}/160 characters</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meta Keywords</label>
                  <input
                    type="text"
                    name="seoKeywords"
                    value={formData.seoKeywords}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="keyword1, keyword2, keyword3"
                  />
                  <p className="text-xs text-gray-400 mt-1">Comma-separated keywords for search engines</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Canonical URL</label>
                  <input
                    type="text"
                    name="seoCanonicalUrl"
                    value={formData.seoCanonicalUrl}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="https://example.com/product/my-product (leave blank for default)"
                  />
                  <p className="text-xs text-gray-400 mt-1">Override the canonical URL if needed</p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Schema Markup (HTML/JS)
                  </label>
                  <textarea
                    name="customSchema"
                    value={formData.customSchema}
                    onChange={handleChange}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                    placeholder={'<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  "name": "Your Product Name"\n}\n</script>'}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Paste JSON-LD script tags (recommended) or custom head HTML/JS. It is injected into page head and not visible to users.
                  </p>
                </div>
              </div>

              {/* Open Graph */}
              <div className="mt-6 pt-6 border-t border-green-200">
                <h3 className="text-md font-semibold text-gray-800 mb-4">Open Graph (Social Media Sharing)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">OG Title</label>
                    <input
                      type="text"
                      name="ogTitle"
                      value={formData.ogTitle}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Title for Facebook/Twitter (leave blank to use Meta Title)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">OG Image URL</label>
                    <input
                      type="text"
                      name="ogImage"
                      value={formData.ogImage}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Image URL for social sharing (leave blank to use product image)"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">OG Description</label>
                    <textarea
                      name="ogDescription"
                      value={formData.ogDescription}
                      onChange={handleChange}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Description for social sharing (leave blank to use Meta Description)"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4 pb-8">
              <button
                type="button"
                onClick={() => navigate("/admin/products")}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Adding..." : "Add Product"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AddProduct
