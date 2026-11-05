"use client"

import { useState, useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { FaEdit, FaTrash, FaPlus, FaChevronLeft, FaChevronRight, FaSearch } from "react-icons/fa"
import { useToast } from "../../context/ToastContext"
import AdminSidebar from "../../components/admin/AdminSidebar"
import config from "../../config/config"
import { getFullImageUrl } from "../../utils/imageUtils"

const OfferPages = () => {
  const [offerPages, setOfferPages] = useState([])
  const [pagesLoading, setPagesLoading] = useState(true)
  const [savingPages, setSavingPages] = useState(false)
  const [selectedPage, setSelectedPage] = useState(null)
  const [activeTab, setActiveTab] = useState('products')
  const [offerProducts, setOfferProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [offerBrands, setOfferBrands] = useState([])
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [offerCategories, setOfferCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const scrollContainerRef = useRef(null)
  const categoriesScrollRef = useRef(null)
  const { showToast } = useToast()

  const [adminSliderCategories, setAdminSliderCategories] = useState([])
  const [selectedAdminCategory, setSelectedAdminCategory] = useState(null)

  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [brands, setBrands] = useState([])

  const [filterCategory, setFilterCategory] = useState("all")
  const [filterSubcategory, setFilterSubcategory] = useState("all")
  const [filterSubcategory2, setFilterSubcategory2] = useState("all")
  const [filterSubcategory3, setFilterSubcategory3] = useState("all")
  const [filterSubcategory4, setFilterSubcategory4] = useState("all")
  const [filterBrand, setFilterBrand] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [linkSearch, setLinkSearch] = useState("")

  const [filteredSubcategories, setFilteredSubcategories] = useState([])
  const [filteredSubcategories2, setFilteredSubcategories2] = useState([])
  const [filteredSubcategories3, setFilteredSubcategories3] = useState([])
  const [filteredSubcategories4, setFilteredSubcategories4] = useState([])

  useEffect(() => {
    if (!offerProducts || offerProducts.length === 0) {
      setAdminSliderCategories([])
      setSelectedAdminCategory(null)
      return
    }

    const uniqueSliderCategoriesMap = new Map()
    offerProducts.forEach((item) => {
      const product = item.product
      if (!product) return

      let deepestCategory = null
      const candidates = [
        product.subcategory4 || product.subCategory4,
        product.subcategory3 || product.subCategory3,
        product.subcategory2 || product.subCategory2,
        product.subcategory || product.subCategory,
        product.category,
        product.parentCategory
      ]
      for (const cat of candidates) {
        if (cat && typeof cat === 'object' && cat._id && cat.name) {
          deepestCategory = cat
          break
        }
      }
      if (deepestCategory) {
        if (!uniqueSliderCategoriesMap.has(deepestCategory._id)) {
          uniqueSliderCategoriesMap.set(deepestCategory._id, { 
            category: deepestCategory, 
            _id: deepestCategory._id 
          })
        }
      }
    })
    setAdminSliderCategories(Array.from(uniqueSliderCategoriesMap.values()))
  }, [offerProducts])

  useEffect(() => {
    fetchOfferPages()
    fetchAllCategories()
    fetchAllBrands()
    fetchAllSubcategories()
  }, [])

  // Cascading filter for all subcategory levels
  useEffect(() => {
    if (filterCategory === "all") {
      setFilteredSubcategories(subcategories.filter(sub => sub.level === 1))
    } else {
      setFilteredSubcategories(subcategories.filter(sub => 
        sub.level === 1 && sub.category && sub.category._id === filterCategory
      ))
    }
    setFilterSubcategory("all")
    setFilterSubcategory2("all")
    setFilterSubcategory3("all")
    setFilterSubcategory4("all")
    setFilteredSubcategories2([])
    setFilteredSubcategories3([])
    setFilteredSubcategories4([])
  }, [filterCategory, subcategories])

  useEffect(() => {
    if (filterSubcategory === "all" || !filterSubcategory) {
      setFilteredSubcategories2([])
    } else {
      setFilteredSubcategories2(subcategories.filter(sub => {
        if (sub.level !== 2 || !sub.parentSubCategory) return false
        const parentId = typeof sub.parentSubCategory === 'object' ? sub.parentSubCategory._id : sub.parentSubCategory
        return parentId === filterSubcategory
      }))
    }
    setFilterSubcategory2("all")
    setFilterSubcategory3("all")
    setFilterSubcategory4("all")
    setFilteredSubcategories3([])
    setFilteredSubcategories4([])
  }, [filterSubcategory, subcategories])

  useEffect(() => {
    if (filterSubcategory === "all" || !filterSubcategory) {
      setFilteredSubcategories3([])
    } else {
      const parentId = (filterSubcategory2 !== "all" && filterSubcategory2) ? filterSubcategory2 : filterSubcategory
      setFilteredSubcategories3(subcategories.filter(sub => {
        if (sub.level !== 3 || !sub.parentSubCategory) return false
        const subParentId = typeof sub.parentSubCategory === 'object' ? sub.parentSubCategory._id : sub.parentSubCategory
        return subParentId === parentId
      }))
    }
    setFilterSubcategory3("all")
    setFilterSubcategory4("all")
    setFilteredSubcategories4([])
  }, [filterSubcategory, filterSubcategory2, subcategories])

  useEffect(() => {
    if (filterSubcategory === "all" || !filterSubcategory) {
      setFilteredSubcategories4([])
    } else {
      let parentId = filterSubcategory
      if (filterSubcategory3 !== "all" && filterSubcategory3) {
        parentId = filterSubcategory3
      } else if (filterSubcategory2 !== "all" && filterSubcategory2) {
        parentId = filterSubcategory2
      }
      setFilteredSubcategories4(subcategories.filter(sub => {
        if (sub.level !== 4 || !sub.parentSubCategory) return false
        const subParentId = typeof sub.parentSubCategory === 'object' ? sub.parentSubCategory._id : sub.parentSubCategory
        return subParentId === parentId
      }))
    }
    setFilterSubcategory4("all")
  }, [filterSubcategory, filterSubcategory2, filterSubcategory3, subcategories])

  const fetchAllCategories = async () => {
    try {
      const token = localStorage.getItem("adminToken")
      if (!token) return
      const response = await fetch(`${config.API_URL}/api/categories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error("Failed to load categories:", error)
    }
  }

  const fetchAllBrands = async () => {
    try {
      const response = await fetch(`${config.API_URL}/api/brands`)
      if (response.ok) {
        const data = await response.json()
        setBrands(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Failed to load brands:", error)
    }
  }

  const fetchAllSubcategories = async () => {
    try {
      const response = await fetch(`${config.API_URL}/api/subcategories`)
      if (response.ok) {
        const data = await response.json()
        const validSubcategories = Array.isArray(data)
          ? data.filter(sub => sub && sub.category && sub.category._id)
          : []
        setSubcategories(validSubcategories)
      }
    } catch (error) {
      console.error("Failed to load subcategories:", error)
    }
  }

  const fetchOfferPages = async () => {
    try {
      setPagesLoading(true)
      const token = localStorage.getItem("adminToken")
      const response = await fetch(`${config.API_URL}/api/offer-pages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setOfferPages(data)
      } else {
        showToast("Failed to load offer pages", "error")
      }
    } catch (error) {
      console.error("Error fetching offer pages:", error)
      showToast("Failed to load offer pages", "error")
    } finally {
      setPagesLoading(false)
    }
  }

  const fetchPageProducts = async (pageSlug) => {
    try {
      setProductsLoading(true)
      const token = localStorage.getItem("adminToken")
      const response = await fetch(`${config.API_URL}/api/offer-products/page/${pageSlug}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setOfferProducts(data)
      } else {
        showToast("Failed to load products", "error")
      }
    } catch (error) {
      console.error("Error fetching page products:", error)
      showToast("Failed to load products", "error")
    } finally {
      setProductsLoading(false)
    }
  }

  const fetchPageBrands = async (pageSlug) => {
    try {
      setBrandsLoading(true)
      const token = localStorage.getItem("adminToken")
      const response = await fetch(`${config.API_URL}/api/offer-brands/page/${pageSlug}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setOfferBrands(data)
      } else {
        showToast("Failed to load brands", "error")
      }
    } catch (error) {
      console.error("Error fetching page brands:", error)
      showToast("Failed to load brands", "error")
    } finally {
      setBrandsLoading(false)
    }
  }

  const fetchPageCategories = async (pageSlug) => {
    try {
      setCategoriesLoading(true)
      const token = localStorage.getItem("adminToken")
      const response = await fetch(`${config.API_URL}/api/offer-categories/page/${pageSlug}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setOfferCategories(data)
      } else {
        showToast("Failed to load categories", "error")
      }
    } catch (error) {
      console.error("Error fetching page categories:", error)
      showToast("Failed to load categories", "error")
    } finally {
      setCategoriesLoading(false)
    }
  }

  const handlePageClick = (page) => {
    setSelectedPage(page)
    setActiveTab('products')
    fetchPageProducts(page.slug)
    fetchPageBrands(page.slug)
    fetchPageCategories(page.slug)
  }

  const handlePageToggle = async (pageId) => {
    try {
      setSavingPages(true)
      const token = localStorage.getItem("adminToken")

      const page = offerPages.find(p => p._id === pageId)
      const newStatus = !page.isActive

      const response = await fetch(`${config.API_URL}/api/offer-pages/${pageId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: newStatus,
        }),
      })

      if (response.ok) {
        const updatedPage = await response.json()
        setOfferPages(offerPages.map(p => 
          p._id === pageId ? updatedPage : p
        ))
        showToast(
          `Page ${newStatus ? "activated" : "deactivated"} successfully`,
          "success"
        )
      } else {
        showToast("Failed to update page status", "error")
      }
    } catch (error) {
      console.error("Error updating page status:", error)
      showToast("Failed to update page status", "error")
    } finally {
      setSavingPages(false)
    }
  }

  const scrollPages = (direction) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const scrollAmount = container.clientWidth * 0.75 // Scroll 75% of visible width
      const newScrollPosition = container.scrollLeft + 
        (direction === 'left' ? -scrollAmount : scrollAmount)
      
      container.scrollTo({
        left: newScrollPosition,
        behavior: 'smooth'
      })
    }
  }

  const deleteOfferProduct = async (id) => {
    if (window.confirm("Are you sure you want to remove this product from the offer page?")) {
      try {
        const token = localStorage.getItem("adminToken")
        const response = await fetch(`${config.API_URL}/api/offer-products/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          setOfferProducts(offerProducts.filter((product) => product._id !== id))
          showToast("Product removed successfully", "success")
        } else {
          showToast("Failed to remove product", "error")
        }
      } catch (error) {
        console.error("Error removing product:", error)
        showToast("Error removing product", "error")
      }
    }
  }

  const handleToggleProductStatus = async (productId) => {
    try {
      const token = localStorage.getItem("adminToken")
      const product = offerProducts.find(p => p._id === productId)
      const newStatus = !product.isActive

      const response = await fetch(`${config.API_URL}/api/offer-products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: newStatus,
        }),
      })

      if (response.ok) {
        const updatedProduct = await response.json()
        setOfferProducts(offerProducts.map(p => 
          p._id === productId ? updatedProduct : p
        ))
        showToast(
          `Product ${newStatus ? "activated" : "deactivated"} successfully`,
          "success"
        )
      } else {
        showToast("Failed to update product status", "error")
      }
    } catch (error) {
      console.error("Error updating product status:", error)
      showToast("Failed to update product status", "error")
    }
  }

  const deleteOfferBrand = async (id) => {
    if (window.confirm("Are you sure you want to remove this brand from the offer page?")) {
      try {
        const token = localStorage.getItem("adminToken")
        const response = await fetch(`${config.API_URL}/api/offer-brands/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          setOfferBrands(offerBrands.filter((brand) => brand._id !== id))
          showToast("Brand removed successfully", "success")
        } else {
          showToast("Failed to remove brand", "error")
        }
      } catch (error) {
        console.error("Error removing brand:", error)
        showToast("Error removing brand", "error")
      }
    }
  }

  const handleToggleBrandStatus = async (brandId) => {
    try {
      const token = localStorage.getItem("adminToken")
      const brand = offerBrands.find(b => b._id === brandId)
      const newStatus = !brand.isActive

      const response = await fetch(`${config.API_URL}/api/offer-brands/${brandId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: newStatus,
        }),
      })

      if (response.ok) {
        const updatedBrand = await response.json()
        setOfferBrands(offerBrands.map(b => 
          b._id === brandId ? updatedBrand : b
        ))
        showToast(
          `Brand ${newStatus ? "activated" : "deactivated"} successfully`,
          "success"
        )
      } else {
        showToast("Failed to update brand status", "error")
      }
    } catch (error) {
      console.error("Error updating brand status:", error)
      showToast("Failed to update brand status", "error")
    }
  }

  const deleteOfferCategory = async (id) => {
    if (window.confirm("Are you sure you want to remove this category from the offer page?")) {
      try {
        const token = localStorage.getItem("adminToken")
        const response = await fetch(`${config.API_URL}/api/offer-categories/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          setOfferCategories(offerCategories.filter((category) => category._id !== id))
          showToast("Category removed successfully", "success")
        } else {
          showToast("Failed to remove category", "error")
        }
      } catch (error) {
        console.error("Error removing category:", error)
        showToast("Error removing category", "error")
      }
    }
  }

  const handleToggleCategoryStatus = async (categoryId) => {
    try {
      const token = localStorage.getItem("adminToken")
      const category = offerCategories.find(c => c._id === categoryId)
      const newStatus = !category.isActive

      const response = await fetch(`${config.API_URL}/api/offer-categories/${categoryId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: newStatus,
        }),
      })

      if (response.ok) {
        const updatedCategory = await response.json()
        setOfferCategories(offerCategories.map(c => 
          c._id === categoryId ? updatedCategory : c
        ))
        showToast(
          `Category ${newStatus ? "activated" : "deactivated"} successfully`,
          "success"
        )
      } else {
        showToast("Failed to update category status", "error")
      }
    } catch (error) {
      console.error("Error updating category status:", error)
      showToast("Failed to update category status", "error")
    }
  }

  const filteredProducts = offerProducts.filter((item) => {
    const product = item.product
    if (!product) return false

    // 1. Filter by Category Slider (deepest category selected)
    if (selectedAdminCategory) {
      const candidates = [
        product.subcategory4 || product.subCategory4,
        product.subcategory3 || product.subCategory3,
        product.subcategory2 || product.subCategory2,
        product.subcategory || product.subCategory,
        product.category,
        product.parentCategory
      ]
      const matchesSlider = candidates.some((cat) => {
        const catId = typeof cat === 'object' ? cat?._id : cat
        return catId === selectedAdminCategory
      })
      if (!matchesSlider) return false
    }

    // 2. Filter by Parent Category
    if (filterCategory !== "all") {
      const pCatId = typeof product.parentCategory === 'object' ? product.parentCategory?._id : product.parentCategory
      if (pCatId !== filterCategory) return false
    }

    // 3. Filter by Level 1
    if (filterSubcategory !== "all") {
      const subCatId = typeof product.subcategory === 'object' ? product.subcategory?._id : (product.subcategory || product.subCategory)
      if (subCatId !== filterSubcategory) return false
    }

    // 4. Filter by Level 2
    if (filterSubcategory2 !== "all") {
      const subCat2Id = typeof product.subcategory2 === 'object' ? product.subcategory2?._id : (product.subcategory2 || product.subCategory2)
      if (subCat2Id !== filterSubcategory2) return false
    }

    // 5. Filter by Level 3
    if (filterSubcategory3 !== "all") {
      const subCat3Id = typeof product.subcategory3 === 'object' ? product.subcategory3?._id : (product.subcategory3 || product.subCategory3)
      if (subCat3Id !== filterSubcategory3) return false
    }

    // 6. Filter by Level 4
    if (filterSubcategory4 !== "all") {
      const subCat4Id = typeof product.subcategory4 === 'object' ? product.subcategory4?._id : (product.subcategory4 || product.subCategory4)
      if (subCat4Id !== filterSubcategory4) return false
    }

    // 7. Filter by Brand
    if (filterBrand !== "all") {
      const brandId = typeof product.brand === 'object' ? product.brand?._id : product.brand
      if (brandId !== filterBrand) return false
    }

    // 8. Filter by Status (Active / Inactive of the offer item)
    if (filterStatus !== "all") {
      const statusBool = filterStatus === "active"
      if (item.isActive !== statusBool) return false
    }

    // 9. Filter by Search (Name, SKU, Brand name)
    if (searchTerm.trim() !== "") {
      const sTerm = searchTerm.toLowerCase().trim()
      const matchesName = product.name?.toLowerCase().includes(sTerm)
      const matchesSku = product.sku?.toLowerCase().includes(sTerm)
      const matchesBrand = product.brand?.name?.toLowerCase().includes(sTerm)
      if (!matchesName && !matchesSku && !matchesBrand) return false
    }

    // 10. Filter by Search by Link (Slug/URL matching)
    if (linkSearch.trim() !== "") {
      const lSearch = linkSearch.toLowerCase().trim()
      const matchesSlug = product.slug?.toLowerCase().includes(lSearch)
      if (!matchesSlug) return false
    }

    return true
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 ml-64 overflow-hidden">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">All Offer Pages</h1>
            <Link
              to="/admin/offer-pages/add"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <FaPlus /> Add Offer Page
            </Link>
          </div>

          {/* Offer Pages Slider */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">All Offer Pages</h2>
                <p className="text-sm text-gray-600 mt-1">
                  All pages: {offerPages.length} | Active: {offerPages.filter(p => p.isActive).length} | 
                  Inactive: {offerPages.filter(p => !p.isActive).length}
                </p>
              </div>
              <p className="text-sm text-gray-600">Click on a page to view its products</p>
            </div>

            {pagesLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading offer pages...</p>
              </div>
            ) : offerPages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No offer pages found. Create your first offer page!</p>
                <Link
                  to="/admin/offer-pages/add"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <FaPlus /> Add Offer Page
                </Link>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={() => scrollPages('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-2 hover:bg-gray-100"
                  disabled={savingPages}
                >
                  <FaChevronLeft className="text-gray-600" />
                </button>

                <div
                  ref={scrollContainerRef}
                  className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-8"
                  style={{ 
                    scrollbarWidth: 'none', 
                    msOverflowStyle: 'none'
                  }}
                >
                  {offerPages.map((page) => (
                    <div
                      key={page._id}
                      onClick={() => handlePageClick(page)}
                      className={`flex-shrink-0 w-80 border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedPage?._id === page._id
                          ? 'border-blue-600 bg-blue-50'
                          : page.isActive
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{page.name}</h3>
                        </div>
                      </div>

                      {page.heroImage && (
                        <div className="mb-3">
                          <img
                            src={getFullImageUrl(page.heroImage)}
                            alt={page.name}
                            className="w-full h-32 object-cover rounded"
                          />
                        </div>
                      )}

                      {page.cardImages && page.cardImages.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-600 mb-2">{page.cardImages.length} card(s)</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePageToggle(page._id)
                          }}
                          disabled={savingPages}
                          className={`flex-1 px-3 py-2 text-sm rounded ${
                            page.isActive
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-gray-400 text-white hover:bg-gray-500'
                          } disabled:opacity-50`}
                        >
                          {page.isActive ? 'Active' : 'Inactive'}
                        </button>
                        <Link
                          to={`/admin/offer-pages/edit/${page._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          <FaEdit />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => scrollPages('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full p-2 hover:bg-gray-100"
                  disabled={savingPages}
                >
                  <FaChevronRight className="text-gray-600" />
                </button>
              </div>
            )}
          </div>

          {/* Content Tabs */}
          {selectedPage && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {activeTab === 'products' && `Products in "${selectedPage.name}"`}
                    {activeTab === 'brands' && `Brands in "${selectedPage.name}"`}
                    {activeTab === 'categories' && `Categories in "${selectedPage.name}"`}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {activeTab === 'products' && `${offerProducts.length} product(s) in this offer page`}
                    {activeTab === 'brands' && 'Manage brands for this offer page'}
                    {activeTab === 'categories' && 'Manage categories for this offer page'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('products')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === 'products'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Products
                  </button>
                  {/*
                  <button
                    onClick={() => setActiveTab('brands')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === 'brands'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Brands
                  </button>
                  <button
                    onClick={() => setActiveTab('categories')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      activeTab === 'categories'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Categories
                  </button>
                  */}
                </div>
              </div>

              {/* Add Button based on active tab */}
              <div className="mb-6">
                {activeTab === 'products' && (
                  <Link
                    to={`/admin/offer-products/add?page=${selectedPage.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <FaPlus /> Add Products
                  </Link>
                )}
                {/*
                {activeTab === 'brands' && (
                  <Link
                    to={`/admin/offer-brands/add?page=${selectedPage.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <FaPlus /> Add Brands
                  </Link>
                )}
                {activeTab === 'categories' && (
                  <Link
                    to={`/admin/offer-categories/add?page=${selectedPage.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <FaPlus /> Add Categories
                  </Link>
                )}
                */}
              </div>

              {/* Products Tab Content */}
              {activeTab === 'products' && productsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading products...</p>
                </div>
              ) : activeTab === 'products' && offerProducts.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-600">No products added to this offer page yet.</p>
                  <Link
                    to={`/admin/offer-products/add?page=${selectedPage.slug}`}
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <FaPlus /> Add Products
                  </Link>
                </div>
              ) : activeTab === 'products' ? (
                <div>
                  {/* Search and Filters Section */}
                  <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6 max-w-full overflow-visible shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Filter & Search Products</h3>
                    
                    {/* First Row: Parent Category, Level 1, Level 2, Level 3, Level 4 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                      {/* Parent Category Filter */}
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Parent Category</label>
                        <select
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        >
                          <option value="all">All Categories</option>
                          {categories.map((category) => (
                            <option key={category._id} value={category._id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Level 1 Subcategory Filter */}
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Level 1</label>
                        <select
                          value={filterSubcategory}
                          onChange={(e) => setFilterSubcategory(e.target.value)}
                          disabled={filterCategory === "all"}
                          className="w-full border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm bg-white"
                        >
                          <option value="all">{filterCategory === "all" ? "Select Parent First" : "All Level 1"}</option>
                          {filteredSubcategories.map((subcategory) => (
                            <option key={subcategory._id} value={subcategory._id}>
                              {subcategory.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Level 2 Subcategory Filter */}
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Level 2</label>
                        <select
                          value={filterSubcategory2}
                          onChange={(e) => setFilterSubcategory2(e.target.value)}
                          disabled={filterSubcategory === "all" || filteredSubcategories2.length === 0}
                          className="w-full border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm bg-white"
                        >
                          <option value="all">{filterSubcategory === "all" ? "Select Level 1 First" : filteredSubcategories2.length === 0 ? "No Level 2" : "All Level 2"}</option>
                          {filteredSubcategories2.map((subcategory) => (
                            <option key={subcategory._id} value={subcategory._id}>
                              {subcategory.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Level 3 Subcategory Filter */}
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Level 3</label>
                        <select
                          value={filterSubcategory3}
                          onChange={(e) => setFilterSubcategory3(e.target.value)}
                          disabled={filterSubcategory === "all" || filteredSubcategories3.length === 0}
                          className="w-full border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm bg-white"
                        >
                          <option value="all">{filterSubcategory === "all" ? "Select Level 1 First" : filteredSubcategories3.length === 0 ? "No Level 3" : "All Level 3"}</option>
                          {filteredSubcategories3.map((subcategory) => (
                            <option key={subcategory._id} value={subcategory._id}>
                              {subcategory.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Level 4 Subcategory Filter */}
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Level 4</label>
                        <select
                          value={filterSubcategory4}
                          onChange={(e) => setFilterSubcategory4(e.target.value)}
                          disabled={filterSubcategory === "all" || filteredSubcategories4.length === 0}
                          className="w-full border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm bg-white"
                        >
                          <option value="all">{filterSubcategory === "all" ? "Select Level 1 First" : filteredSubcategories4.length === 0 ? "No Level 4" : "All Level 4"}</option>
                          {filteredSubcategories4.map((subcategory) => (
                            <option key={subcategory._id} value={subcategory._id}>
                              {subcategory.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Second Row: Brand, Status, Search, Search by Link */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                      {/* Brand Filter */}
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
                        <select
                          value={filterBrand}
                          onChange={(e) => setFilterBrand(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        >
                          <option value="all">All Brands</option>
                          {brands.map((brand) => (
                            <option key={brand._id} value={brand._id}>
                              {brand.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Status Filter */}
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        >
                          <option value="all">All Products</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>

                      {/* Search Filter */}
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                        <div className="relative">
                          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                          <input
                            type="text"
                            placeholder="Name, SKU, Brand..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-2 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>

                      {/* Search by Link Filter */}
                      <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Search by Link</label>
                        <div className="relative">
                          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                          <input
                            type="text"
                            placeholder="Paste product link..."
                            value={linkSearch}
                            onChange={(e) => setLinkSearch(e.target.value)}
                            className="pl-9 pr-2 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Clear Filters Button */}
                    {(searchTerm || linkSearch || filterCategory !== "all" || filterSubcategory !== "all" || filterSubcategory2 !== "all" || filterSubcategory3 !== "all" || filterSubcategory4 !== "all" || filterBrand !== "all" || filterStatus !== "all" || selectedAdminCategory) && (
                      <div className="flex justify-start mt-4">
                        <button
                          onClick={() => {
                            setSearchTerm("")
                            setLinkSearch("")
                            setFilterCategory("all")
                            setFilterSubcategory("all")
                            setFilterSubcategory2("all")
                            setFilterSubcategory3("all")
                            setFilterSubcategory4("all")
                            setFilterBrand("all")
                            setFilterStatus("all")
                            setSelectedAdminCategory(null)
                          }}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors font-medium"
                        >
                          Clear Filters
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Categories Slider */}
                  {adminSliderCategories.length > 0 && (
                    <div className="mb-6 relative border-b pb-6 px-2">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Filter by Category:</h3>
                        {selectedAdminCategory && (
                          <button
                            onClick={() => setSelectedAdminCategory(null)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            Clear Filter
                          </button>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (categoriesScrollRef.current) {
                              categoriesScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' })
                            }
                          }}
                          className="absolute -left-4 z-10 bg-white border shadow-md rounded-full p-1.5 hover:bg-gray-100"
                        >
                          <FaChevronLeft className="w-3 h-3 text-gray-600" />
                        </button>

                        <div
                          ref={categoriesScrollRef}
                          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth px-6 w-full"
                          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                          {adminSliderCategories.map((item) => {
                            const catData = item.category
                            const displayName = catData?.displayName || catData?.name || 'N/A'
                            const displayImage = catData?.image
                            const isSelected = selectedAdminCategory === catData._id
                            return (
                              <button
                                key={item._id}
                                type="button"
                                onClick={() => {
                                  setSelectedAdminCategory(isSelected ? null : catData._id)
                                }}
                                className={`flex-shrink-0 w-28 border rounded-lg transition-all flex flex-col items-center p-2 hover:border-blue-300 ${
                                  isSelected
                                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20'
                                    : 'bg-white border-gray-200'
                                }`}
                              >
                                <div className="h-12 w-full flex items-center justify-center mb-2 overflow-hidden">
                                  {displayImage ? (
                                    <img
                                      src={getFullImageUrl(displayImage)}
                                      alt={displayName}
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  ) : (
                                    <span className="text-xl">📦</span>
                                  )}
                                </div>
                                <span className={`text-[11px] font-semibold text-center line-clamp-2 w-full ${
                                  isSelected ? 'text-blue-700 font-bold' : 'text-gray-600'
                                }`}>
                                  {displayName}
                                </span>
                              </button>
                            )
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (categoriesScrollRef.current) {
                              categoriesScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' })
                            }
                          }}
                          className="absolute -right-4 z-10 bg-white border shadow-md rounded-full p-1.5 hover:bg-gray-100"
                        >
                          <FaChevronRight className="w-3 h-3 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Product
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="px-6 py-10 text-center text-gray-500 text-sm">
                              No products found in this category for this offer page.
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map((item) => (
                        <tr key={item._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {item.product?.mainImage && (
                                <img
                                  src={getFullImageUrl(item.product.mainImage || item.product.image)}
                                  alt={item.product?.name}
                                  className="h-10 w-10 rounded object-cover mr-3"
                                />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900 max-w-[450px] truncate" title={item.product?.name}>
                                  {item.product?.name || 'N/A'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  SKU: {item.product?.sku || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${item.product?.price || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleProductStatus(item._id)}
                              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                item.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {item.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => deleteOfferProduct(item._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      )))
                    }
                    </tbody>
                  </table>
                </div>
              </div>
              ) : null}

              {/* Brands Tab Content */}
              {activeTab === 'brands' && brandsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading brands...</p>
                </div>
              ) : activeTab === 'brands' && offerBrands.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-600">No brands added to this offer page yet.</p>
                  <Link
                    to={`/admin/offer-brands/add?page=${selectedPage.slug}`}
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <FaPlus /> Add Brands
                  </Link>
                </div>
              ) : activeTab === 'brands' ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Brand
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {offerBrands.map((item) => (
                        <tr key={item._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {item.brand?.logo && (
                                <img
                                  src={getFullImageUrl(item.brand.logo)}
                                  alt={item.brand?.name}
                                  className="h-10 w-10 rounded object-contain mr-3"
                                />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {item.brand?.name || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleBrandStatus(item._id)}
                              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                item.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {item.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => deleteOfferBrand(item._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {/* Categories Tab Content */}
              {activeTab === 'categories' && categoriesLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading categories...</p>
                </div>
              ) : activeTab === 'categories' && offerCategories.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-600">No categories added to this offer page yet.</p>
                  <Link
                    to={`/admin/offer-categories/add?page=${selectedPage.slug}`}
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <FaPlus /> Add Categories
                  </Link>
                </div>
              ) : activeTab === 'categories' ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {offerCategories.map((item) => (
                        <tr key={item._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {item.category?.image && (
                                <img
                                  src={getFullImageUrl(item.category.image)}
                                  alt={item.category?.name}
                                  className="h-10 w-10 rounded object-cover mr-3"
                                />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {item.category?.name || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleCategoryStatus(item._id)}
                              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                item.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {item.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => deleteOfferCategory(item._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}

          {!selectedPage && !pagesLoading && offerPages.length > 0 && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-blue-800">
                Click on an offer page above to view and manage its products
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OfferPages
