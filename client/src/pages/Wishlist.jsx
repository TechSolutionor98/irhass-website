import { useWishlist } from "../context/WishlistContext"
import { Link } from "react-router-dom"
import { Trash2, Heart } from "lucide-react"
import { getFullImageUrl } from "../utils/imageUtils"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import TranslatedText from "../components/TranslatedText"
import PromoPopup from "../components/PromoPopup"

const Wishlist = () => {
  const { wishlist, removeFromWishlist, loading } = useWishlist()
  const { getLocalizedPath, isArabic } = useLanguage()
  const { formatPrice: formatCurrencyPrice } = useCurrency()

  if (loading) return <div className="max-w-3xl mx-auto py-12 text-center"><TranslatedText>Loading...</TranslatedText></div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Heart className="text-red-500" size={28} />
        <h1 className="text-3xl font-bold text-gray-900"><TranslatedText>My Wishlist</TranslatedText></h1>
        {Array.isArray(wishlist) && wishlist.length > 0 && (
          <span className="bg-lime-500 text-white text-sm font-medium px-3 py-1 rounded-full">
            {wishlist.length} {wishlist.length === 1 ? <TranslatedText>item</TranslatedText> : <TranslatedText>items</TranslatedText>}
          </span>
        )}
      </div>

      {Array.isArray(wishlist) && wishlist.length === 0 ? (
        <div className="text-center py-18">
          <Heart className="mx-auto text-gray-300 mb-4" size={64} />
          <h3 className="text-xl font-medium text-gray-900 mb-2"><TranslatedText>Your wishlist is empty</TranslatedText></h3>
          <p className="text-gray-500 mb-6"><TranslatedText>Start adding items you love to your wishlist</TranslatedText></p>
          <Link
            to={getLocalizedPath("/")}
            className="inline-flex items-center px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <TranslatedText>Browse Products</TranslatedText>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {(Array.isArray(wishlist) ? wishlist : []).map(product => (
            <div key={product._id} className="group bg-white rounded-xl shadow-sm border border-lime-500 hover:shadow-lg hover:border-gray-200 transition-all duration-300 overflow-hidden">
              {/* Product Image */}
              <div className="relative overflow-hidden">
                <Link to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)}>
                  <img
                    src={getFullImageUrl(product.image) || "/placeholder.svg"}
                    alt={product.name}
                    className="w-full h-80 lg:h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </Link>
                <button
                  onClick={() => removeFromWishlist(product._id)}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-white hover:shadow-md transition-all duration-200 group"
                  aria-label="Remove from wishlist"
                >
                  <Trash2 size={16} className="text-red-500 hover:text-red-600" />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-4">
                <Link to={getLocalizedPath(`/product/${encodeURIComponent(product.slug || product._id)}`)} className="block">
                  {/* Brand */}
                  {(product.brand?.name || product.brand) && (
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      {product.brand?.name || product.brand}
                    </div>
                  )}

                  {/* Product Name */}
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-2 line-clamp-2 hover:text-red-600 transition-colors">
                    {product.name}
                  </h3>

                  {/* Category Tags */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {product.category && (
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                        {product.category?.name || product.category}
                      </span>
                    )}
                    {product.subCategory && (
                      <span className="inline-block px-2 py-1 bg-lime-500 text-white text-xs rounded-md">
                        {product.subCategory?.name || product.subCategory}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold text-red-600">
                      {product.price ? formatCurrencyPrice(product.price, isArabic) : "Price not available"}
                    </div>
                  </div>
                </Link>

                {/* Remove Button */}
                {/* <button
                  onClick={() => removeFromWishlist(product._id)}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors duration-200"
                >
                  <Trash2 size={16} />
                  Remove from Wishlist
                </button> */}
              </div>
            </div>
          ))}
        </div>
      )}
      <PromoPopup pageKey="wishlist" delayMs={3000} />
    </div>
  )
}

export default Wishlist
