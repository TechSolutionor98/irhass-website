import { useState } from "react"
import { Plus, X, Trash2 } from "lucide-react"
import ImageUpload from "../ImageUpload"
import { getFullImageUrl } from "../../utils/imageUtils"

const ColorVariationForm = ({ colorVariations = [], onChange, displayType = "card", onDisplayTypeChange }) => {
  const [expandedIndex, setExpandedIndex] = useState(null)

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

  const colorOptions = [
    "Black", "White", "Silver", "Gray", "Gold", "Rose Gold",
    "Red", "Blue", "Green", "Purple", "Pink", "Orange",
    "Yellow", "Brown", "Beige", "Navy", "Midnight", "Starlight",
    "Space Gray", "Midnight Blue", "Forest Green", "Ocean Blue"
  ]

  const addColorVariation = () => {
    const newVariation = {
      color: "",
      image: "",
      galleryImages: [],
      buyingPrice: "",
      wholesalePrice: "",
      price: "",
      offerPrice: "",
      sku: "",
      countInStock: "",
    }
    onChange([...colorVariations, newVariation])
    setExpandedIndex(colorVariations.length)
  }

  const removeColorVariation = (index) => {
    const updated = colorVariations.filter((_, i) => i !== index)
    onChange(updated)
    if (expandedIndex === index) {
      setExpandedIndex(null)
    }
  }

  const updateColorVariation = (index, field, value) => {
    const updated = [...colorVariations]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const handleMultipleImagesUpload = (index, newUrls) => {
    const updated = [...colorVariations]
    const normalizedNewUrls = dedupeImageUrls(newUrls)
    let currentMain = normalizeImageUrl(updated[index].image)
    let currentGallery = dedupeImageUrls(updated[index].galleryImages || [])
    
    // If no main image exists, set the first new image as main
    if (!currentMain && normalizedNewUrls.length > 0) {
      currentMain = normalizedNewUrls[0]
      currentGallery = dedupeImageUrls([...currentGallery, ...normalizedNewUrls.slice(1)])
    } else {
      currentGallery = dedupeImageUrls([...currentGallery, ...normalizedNewUrls])
    }
    
    updated[index].image = currentMain
    updated[index].galleryImages = currentGallery
    onChange(updated)
  }

  const setMainImage = (colorIndex, newMainUrl) => {
    const updated = [...colorVariations]
    const selectedMain = normalizeImageUrl(newMainUrl)
    if (!selectedMain) return
    const oldMain = normalizeImageUrl(updated[colorIndex].image)
    let gallery = dedupeImageUrls(updated[colorIndex].galleryImages || [])
    
    // Remove newMainUrl from gallery
    gallery = gallery.filter(url => url !== selectedMain)
    // Add oldMain to gallery if it exists
    if (oldMain) {
      gallery.push(oldMain)
    }
    
    updated[colorIndex].image = selectedMain
    updated[colorIndex].galleryImages = dedupeImageUrls(gallery)
    onChange(updated)
  }

  const removeImage = (colorIndex, urlToRemove) => {
    const updated = [...colorVariations]
    const targetUrl = normalizeImageUrl(urlToRemove)
    if (!targetUrl) return

    updated[colorIndex].image = normalizeImageUrl(updated[colorIndex].image)
    updated[colorIndex].galleryImages = dedupeImageUrls(updated[colorIndex].galleryImages || [])

    if (updated[colorIndex].image === targetUrl) {
      updated[colorIndex].image = ""
      // If there are gallery images, make the first one the new main image
      if (updated[colorIndex].galleryImages && updated[colorIndex].galleryImages.length > 0) {
        updated[colorIndex].image = updated[colorIndex].galleryImages[0]
        updated[colorIndex].galleryImages = updated[colorIndex].galleryImages.slice(1)
      }
    } else {
      updated[colorIndex].galleryImages = updated[colorIndex].galleryImages.filter(url => url !== targetUrl)
    }
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Color Variations</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-3 bg-white px-3 py-1.5 rounded-lg border border-purple-200">
            <span className="text-xs font-semibold text-purple-700 uppercase">Layout:</span>
            <label className="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="colorVariationsDisplayType"
                value="button"
                checked={displayType === "button"}
                onChange={(e) => onDisplayTypeChange && onDisplayTypeChange(e.target.value)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 mr-1.5"
              />
              Buttons
            </label>
            <label className="inline-flex items-center text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="colorVariationsDisplayType"
                value="card"
                checked={displayType === "card"}
                onChange={(e) => onDisplayTypeChange && onDisplayTypeChange(e.target.value)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 mr-1.5"
              />
              Cards
            </label>
          </div>
          <button
            type="button"
            onClick={addColorVariation}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={18} className="mr-2" />
            Add Color
          </button>
        </div>
      </div>

      {colorVariations.length === 0 ? (
        <div className="text-center py-12 bg-purple-50 rounded-lg border-2 border-dashed border-purple-300">
          <div className="mx-auto w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
            <Plus size={24} className="text-purple-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No color variations added</h3>
          <p className="text-gray-500 mb-6">
            Add different colors with their own images, prices, and stock levels
          </p>
          <button
            type="button"
            onClick={addColorVariation}
            className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={18} className="mr-2" />
            Add First Color
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {colorVariations.map((variation, index) => (
            <div
              key={index}
              className="bg-white border-2 border-purple-200 rounded-lg overflow-hidden"
            >
              {/* Header */}
              <div
                className="flex items-center justify-between p-4 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <div className="flex items-center gap-3">
                  {variation.image && (
                    <div className="w-12 h-12 bg-white rounded border border-purple-200 overflow-hidden">
                      <img
                        src={getFullImageUrl(variation.image)}
                        alt={variation.color}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {variation.color || "Unnamed Color"}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {variation.price ? `${parseFloat(variation.price).toFixed(2)} Rs` : "No price set"}
                      {variation.sku && ` • SKU: ${variation.sku}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeColorVariation(index)
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${
                      expandedIndex === index ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Form */}
              {expandedIndex === index && (
                <div className="p-6 space-y-4 bg-white">
                  {/* Color Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        list={`color-options-${index}`}
                        value={variation.color}
                        onChange={(e) => updateColorVariation(index, "color", e.target.value)}
                        placeholder="e.g., Midnight, Starlight"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <datalist id={`color-options-${index}`}>
                        {colorOptions.map(color => (
                          <option key={color} value={color} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SKU
                      </label>
                      <input
                        type="text"
                        value={variation.sku}
                        onChange={(e) => updateColorVariation(index, "sku", e.target.value)}
                        placeholder="e.g., IPH14-MID-256"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Buying Price (Rs) <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={variation.buyingPrice || ""}
                          onChange={(e) => updateColorVariation(index, "buyingPrice", e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Your purchase cost</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Wholesale Price (Rs) <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variation.wholesalePrice ?? ""}
                          onChange={(e) => updateColorVariation(index, "wholesalePrice", e.target.value)}
                          placeholder="Leave blank if not set"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Leave empty if this variation has none</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Base Price (Rs) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={variation.price}
                          onChange={(e) => updateColorVariation(index, "price", e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {variation.offerPrice > 0 ? "Will be shown as strikethrough" : "Regular selling price"}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Offer Price (Rs) <span className="text-gray-400 text-xs">(Optional)</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={variation.offerPrice || ""}
                          onChange={(e) => updateColorVariation(index, "offerPrice", e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Discounted price if on sale</p>
                      </div>
                    </div>

                    {/* Discount Preview */}
                    {variation.price > 0 && variation.offerPrice > 0 && variation.offerPrice < variation.price && (
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-green-800 font-medium">
                            💰 Discount: {Math.round(((variation.price - variation.offerPrice) / variation.price) * 100)}% OFF
                          </span>
                          <span className="text-green-700">
                            Save Rs {(variation.price - variation.offerPrice).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Stock */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Stock Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={variation.countInStock}
                          onChange={(e) => updateColorVariation(index, "countInStock", e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Images Section */}
                  <div className="pt-4 border-t border-purple-100">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Product Images <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1">Upload multiple images at once. Select one as the main image.</p>
                      </div>
                    </div>

                    <ImageUpload
                      onImageUpload={(urls) => handleMultipleImagesUpload(index, urls)}
                      multiple={true}
                      isProduct={true}
                      label="Drop multiple images here or click to upload"
                    />

                    {/* Image Grid */}
                    {(variation.image || (variation.galleryImages && variation.galleryImages.length > 0)) && (
                      <div className="mt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Uploaded Images (Click 'Star' to set as Main)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          
                          {/* Main Image */}
                          {variation.image && (
                            <div className="relative group rounded-lg overflow-hidden border-2 border-purple-500 shadow-sm aspect-square bg-white">
                              <div className="absolute top-0 left-0 w-full bg-purple-500 text-white text-[10px] font-bold px-2 py-1 text-center z-10">
                                MAIN IMAGE
                              </div>
                              <img 
                                src={getFullImageUrl(variation.image)} 
                                alt="Main" 
                                className="w-full h-full object-contain p-2 mt-4"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index, variation.image)}
                                className="absolute top-6 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                title="Remove Image"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}

                          {/* Gallery Images */}
                          {(variation.galleryImages || []).map((img, imgIndex) => (
                            <div key={`gallery-${imgIndex}`} className="relative group rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-square bg-white hover:border-purple-300 transition-colors">
                              <img 
                                src={getFullImageUrl(img)} 
                                alt={`Gallery ${imgIndex + 1}`} 
                                className="w-full h-full object-contain p-2"
                              />
                              
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                                <button
                                  type="button"
                                  onClick={() => setMainImage(index, img)}
                                  className="px-3 py-1.5 bg-white text-purple-600 text-xs font-semibold rounded shadow hover:bg-purple-50 transition-colors"
                                  title="Set as Main Image"
                                >
                                  Make Main
                                </button>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => removeImage(index, img)}
                                className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                title="Remove Image"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ColorVariationForm
