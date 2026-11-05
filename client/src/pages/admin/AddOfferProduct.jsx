import { useState, useEffect } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useToast } from "../../context/ToastContext"
import AdminSidebar from "../../components/admin/AdminSidebar"
import { ArrowLeft, Search } from "lucide-react"
import axios from "axios"
import { getFullImageUrl } from "../../utils/imageUtils"
import config from "../../config/config"

const AddOfferProduct = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [offerPages, setOfferPages] = useState([])
  const [products, setProducts] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [brands, setBrands] = useState([])

  const [filterCategory, setFilterCategory] = useState("all")
  const [filterSubcategory, setFilterSubcategory] = useState("all")
  const [filterSubcategory2, setFilterSubcategory2] = useState("all")
  const [filterSubcategory3, setFilterSubcategory3] = useState("all")
  const [filterSubcategory4, setFilterSubcategory4] = useState("all")
  const [filterBrand, setFilterBrand] = useState("all")
  const [linkSearch, setLinkSearch] = useState("")

  const [filteredSubcategories, setFilteredSubcategories] = useState([])
  const [filteredSubcategories2, setFilteredSubcategories2] = useState([])
  const [filteredSubcategories3, setFilteredSubcategories3] = useState([])
  const [filteredSubcategories4, setFilteredSubcategories4] = useState([])

  const [formData, setFormData] = useState({
    offerPageSlug: searchParams.get("page") || "",
    products: [],
    isActive: true,
    order: 1,
  })
  const [isEdit, setIsEdit] = useState(false)

  useEffect(() => {
    fetchOfferPages()
    fetchProducts()
    fetchAllCategories()
    fetchAllBrands()
    fetchAllSubcategories()
    if (id) {
      setIsEdit(true)
      fetchOfferProduct(id)
    }
  }, [id])

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
      const { data } = await axios.get(`${config.API_URL}/api/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setCategories(data)
    } catch (error) {
      console.error("Failed to load categories:", error)
    }
  }

  const fetchAllBrands = async () => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/brands`)
      setBrands(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to load brands:", error)
    }
  }

  const fetchAllSubcategories = async () => {
    try {
      const { data } = await axios.get(`${config.API_URL}/api/subcategories`)
      const validSubcategories = Array.isArray(data)
        ? data.filter(sub => sub && sub.category && sub.category._id)
        : []
      setSubcategories(validSubcategories)
    } catch (error) {
      console.error("Failed to load subcategories:", error)
    }
  }

  const fetchOfferPages = async () => {
    try {
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/offer-pages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setOfferPages(data)
    } catch (error) {
      showToast("Failed to load offer pages", "error")
    }
  }

  const fetchProducts = async () => {
    try {
      setProductsLoading(true)
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setProducts(data)
    } catch (error) {
      showToast("Failed to load products", "error")
    } finally {
      setProductsLoading(false)
    }
  }

  const fetchOfferProduct = async (productId) => {
    setLoading(true)
    try {
      const token = localStorage.getItem("adminToken")
      const { data } = await axios.get(`${config.API_URL}/api/offer-products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setFormData({
        offerPageSlug: data.offerPageSlug || "",
        products: [data.product?._id] || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
        order: data.order || 1,
      })
    } catch (error) {
      showToast("Failed to load offer product for editing", "error")
      navigate("/admin/offer-pages")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleProductToggle = (productId) => {
    setFormData((prev) => ({
      ...prev,
      products: prev.products.includes(productId)
        ? prev.products.filter((id) => id !== productId)
        : [...prev.products, productId],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = localStorage.getItem("adminToken")
      if (isEdit && id) {
        await axios.put(`${config.API_URL}/api/offer-products/${id}`, {
          offerPageSlug: formData.offerPageSlug,
          product: formData.products[0],
          isActive: formData.isActive,
          order: formData.order,
        }, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        })
        showToast("Product updated successfully!", "success")
      } else {
        let successCount = 0
        let failCount = 0
        
        for (let i = 0; i < formData.products.length; i++) {
          try {
            await axios.post(`${config.API_URL}/api/offer-products`, {
              offerPageSlug: formData.offerPageSlug,
              product: formData.products[i],
              isActive: formData.isActive,
              order: formData.order + i,
            }, {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            })
            successCount++
          } catch (err) {
            failCount++
          }
        }
        
        if (successCount > 0) {
          showToast(`${successCount} product(s) added successfully!`, "success")
        }
        if (failCount > 0) {
          showToast(`${failCount} product(s) failed (may already exist)`, "warning")
        }
      }
      navigate("/admin/offer-pages")
    } catch (error) {
      showToast(
        error.response?.data?.message || "Failed to save product",
        "error"
      )
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to remove this product from the offer page?")) {
      try {
        const token = localStorage.getItem("adminToken")
        await axios.delete(`${config.API_URL}/api/offer-products/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        showToast("Product removed successfully!", "success")
        navigate("/admin/offer-pages")
      } catch (error) {
        showToast("Failed to remove product", "error")
      }
    }
  }

  const filteredProducts = products.filter((product) => {
    if (!product) return false

    // 1. Filter by Parent Category
    if (filterCategory !== "all") {
      const pCatId = typeof product.parentCategory === 'object' ? product.parentCategory?._id : product.parentCategory
      if (pCatId !== filterCategory) return false
    }

    // 2. Filter by Level 1
    if (filterSubcategory !== "all") {
      const subCatId = typeof product.subcategory === 'object' ? product.subcategory?._id : (product.subcategory || product.subCategory)
      if (subCatId !== filterSubcategory) return false
    }

    // 3. Filter by Level 2
    if (filterSubcategory2 !== "all") {
      const subCat2Id = typeof product.subcategory2 === 'object' ? product.subcategory2?._id : (product.subcategory2 || product.subCategory2)
      if (subCat2Id !== filterSubcategory2) return false
    }

    // 4. Filter by Level 3
    if (filterSubcategory3 !== "all") {
      const subCat3Id = typeof product.subcategory3 === 'object' ? product.subcategory3?._id : (product.subcategory3 || product.subCategory3)
      if (subCat3Id !== filterSubcategory3) return false
    }

    // 5. Filter by Level 4
    if (filterSubcategory4 !== "all") {
      const subCat4Id = typeof product.subcategory4 === 'object' ? product.subcategory4?._id : (product.subcategory4 || product.subCategory4)
      if (subCat4Id !== filterSubcategory4) return false
    }

    // 6. Filter by Brand
    if (filterBrand !== "all") {
      const brandId = typeof product.brand === 'object' ? product.brand?._id : product.brand
      if (brandId !== filterBrand) return false
    }

    // 7. Filter by Search (Name, SKU)
    if (searchTerm.trim() !== "") {
      const sTerm = searchTerm.toLowerCase().trim()
      const matchesName = product.name?.toLowerCase().includes(sTerm)
      const matchesSku = product.sku?.toLowerCase().includes(sTerm)
      if (!matchesName && !matchesSku) return false
    }

    // 8. Filter by Search by Link (Slug/URL matching)
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
          <div className="mb-6">
            <button
              onClick={() => navigate("/admin/offer-pages")}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Offer Pages
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEdit ? "Edit Product" : "Add Products to Offer Page"}
            </h1>
            <p className="text-gray-600 mt-2">
              {isEdit ? "Update product assignment" : "Select multiple products to add at once"}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Offer Page
                </label>
                <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-lg font-semibold text-blue-900">
                    {offerPages.find(p => p.slug === formData.offerPageSlug)?.name || formData.offerPageSlug || "Loading..."}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Products * {!isEdit && `(${formData.products.length} selected)`}
                </label>
                
                {/* Search and Filters Section */}
                <div className="mb-6 bg-gray-50 rounded-lg border border-gray-200 p-6 max-w-full overflow-visible shadow-sm">
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

                  {/* Second Row: Brand, Search, Search by Link */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
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

                    {/* Search Filter */}
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search products by name or SKU..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 pr-2 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        />
                      </div>
                    </div>

                    {/* Search by Link Filter */}
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Search by Link</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Paste product link..."
                          value={linkSearch}
                          onChange={(e) => setLinkSearch(e.target.value)}
                          className="pl-9 pr-2 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clear Filters Button */}
                  {(searchTerm || linkSearch || filterCategory !== "all" || filterSubcategory !== "all" || filterSubcategory2 !== "all" || filterSubcategory3 !== "all" || filterSubcategory4 !== "all" || filterBrand !== "all") && (
                    <div className="flex justify-start mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm("")
                          setLinkSearch("")
                          setFilterCategory("all")
                          setFilterSubcategory("all")
                          setFilterSubcategory2("all")
                          setFilterSubcategory3("all")
                          setFilterSubcategory4("all")
                          setFilterBrand("all")
                        }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors font-medium"
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>

                {!isEdit && formData.products.length > 0 && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{formData.products.length}</strong> product(s) selected. Click "Add Products" to add them all at once.
                    </p>
                  </div>
                )}

                {!isEdit && (
                  <div className="flex justify-between items-center mb-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <label className="inline-flex items-center cursor-pointer text-sm font-medium text-gray-700 select-none">
                      <input
                        type="checkbox"
                        checked={filteredProducts.length > 0 && filteredProducts.every(p => formData.products.includes(p._id))}
                        onChange={(e) => {
                          const checked = e.target.checked
                          const filteredIds = filteredProducts.map(p => p._id)
                          if (checked) {
                            setFormData(prev => ({
                              ...prev,
                              products: [...new Set([...prev.products, ...filteredIds])]
                            }))
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              products: prev.products.filter(id => !filteredIds.includes(id))
                            }))
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                      />
                      Select All Filtered ({filteredProducts.length} product(s))
                    </label>
                    
                    {formData.products.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, products: [] }))}
                        className="text-xs text-red-600 hover:text-red-800 font-semibold"
                      >
                        Deselect All Selected
                      </button>
                    )}
                  </div>
                )}

                <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
                  {productsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
                      <p className="text-gray-600">Loading products...</p>
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      No products found
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredProducts.map((product) => (
                        <label
                          key={product._id}
                          className={`flex items-center p-4 cursor-pointer hover:bg-gray-50 ${
                            formData.products.includes(product._id) ? 'bg-blue-50' : ''
                          }`}
                        >
                          <input
                            type={isEdit ? "radio" : "checkbox"}
                            checked={formData.products.includes(product._id)}
                            onChange={() => isEdit ? setFormData(prev => ({ ...prev, products: [product._id] })) : handleProductToggle(product._id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <div className="ml-3 flex items-center gap-3 flex-1">
                            {product.mainImage && (
                              <img
                                src={getFullImageUrl(product.mainImage || product.image)}
                                alt={product.name}
                                className="w-16 h-16 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{product.name}</p>
                              <p className="text-sm text-gray-500">
                                SKU: {product.sku} | Price: ${product.price}
                              </p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    Active (show in offer page)
                  </span>
                </label>
              </div>

              <div className="flex justify-between gap-4 pt-4 border-t">
                <div>
                  {isEdit && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-6 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50"
                      disabled={loading}
                    >
                      Remove Product
                    </button>
                  )}
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => navigate("/admin/offer-pages")}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || formData.products.length === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {loading ? "Saving..." : isEdit ? "Update Product" : `Add ${formData.products.length} Product(s)`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddOfferProduct
