import { Navigate, Route, Routes } from "react-router-dom"

import AdminRoute from "../components/AdminRoute"
import AdminHeader from "../components/admin/AdminHeader"
import AdminSidebar from "../components/admin/AdminSidebar"

import NotFound from "../pages/NotFound"
import CreateOrder from "../pages/admin/CreateOrder"
import ActivityLogs from "../pages/admin/ActivityLogs"
import AddBannerCard from "../pages/admin/AddBannerCard"
import AddBlog from "../pages/admin/AddBlog"
import AddBlogBrand from "../pages/admin/AddBlogBrand"
import AddBlogCategory from "../pages/admin/AddBlogCategory"
import AddBlogTopic from "../pages/admin/AddBlogTopic"
import AddBrand from "../pages/admin/AddBrand"
import AddBulkProducts from "../pages/admin/AddBulkProducts"
import AddCategory from "../pages/admin/AddCategory"
import AddColor from "../pages/admin/AddColor"
import AddDeliveryCharge from "../pages/admin/AddDeliveryCharge"
import AddHomeSection from "../pages/admin/AddHomeSection"
import AddOfferBrand from "../pages/admin/AddOfferBrand"
import AddOfferCategory from "../pages/admin/AddOfferCategory"
import AddOfferPage from "../pages/admin/AddOfferPage"
import AddOfferProduct from "../pages/admin/AddOfferProduct"
import AddProduct from "../pages/admin/AddProduct"
import AddSize from "../pages/admin/AddSize"
import AddSubCategory from "../pages/admin/AddSubCategory"
import AddTax from "../pages/admin/AddTax"
import AddUnit from "../pages/admin/AddUnit"
import AddVolume from "../pages/admin/AddVolume"
import AddWarranty from "../pages/admin/AddWarranty"
import AdminBannerCards from "../pages/admin/AdminBannerCards"
import AdminBanners from "../pages/admin/AdminBanners"
import AdminBlogs from "../pages/admin/AdminBlogs"
import AdminBrands from "../pages/admin/AdminBrands"
import AdminBulkPurchase from "../pages/admin/AdminBulkPurchase"
import AdminCategories from "../pages/admin/AdminCategories"
import AdminCategorySlider from "../pages/admin/AdminCategorySlider"
import AdminColors from "../pages/admin/AdminColors"
import AdminDashboard from "../pages/admin/AdminDashboard"
import AdminDeliveryCharges from "../pages/admin/AdminDeliveryCharges"
import AdminEmailTemplates from "../pages/admin/AdminEmailTemplates"
import EmailDesigns from "../pages/admin/EmailDesigns"
import EmailBuilder from "../pages/admin/EmailBuilder"
import BulkMails from "../pages/admin/BulkMails"
import AdminManagement from "../pages/admin/AdminManagement"
import AdminNewsletter from "../pages/admin/AdminNewsletter"
import AdminProducts from "../pages/admin/AdminProducts"
import Inventory from "../pages/admin/Inventory"
import CreateLabels from "../pages/admin/CreateLabels"
import AdminProductOptionManager from "../pages/admin/AdminProductOptionManager"
import AdminRequestCallbacks from "../pages/admin/AdminRequestCallbacks"
import AdminNotifyMe from "../pages/admin/AdminNotifyMe"
import AdminReviews from "../pages/admin/AdminReviews"
import AdminReviewsApproved from "../pages/admin/AdminReviewsApproved"
import AdminReviewsPending from "../pages/admin/AdminReviewsPending"
import AdminReviewsRejected from "../pages/admin/AdminReviewsRejected"
import AdminPageSEOManager from "../pages/admin/AdminPageSEOManager"
import AdminHomePageSEO from "../pages/admin/AdminHomePageSEO"
import AdminSEOSettings from "../pages/admin/AdminSEOSettings"
import AdminBingIndexer from "../pages/admin/AdminBingIndexer"
import AdminArabicConversion from "../pages/admin/AdminArabicConversion"
import AdminCountryManager from "../pages/admin/AdminCountryManager"
import AdminSettings from "../pages/admin/AdminSettings"
import AdminThemeSettings from "../pages/admin/AdminThemeSettings"
import AdminSizes from "../pages/admin/AdminSizes"
import AdminSubCategories from "../pages/admin/AdminSubCategories"
import AdminSubCategories2 from "../pages/admin/AdminSubCategories2"
import AdminSubCategories3 from "../pages/admin/AdminSubCategories3"
import AdminSubCategories4 from "../pages/admin/AdminSubCategories4"
import AdminTax from "../pages/admin/AdminTax"
import AdminUnits from "../pages/admin/AdminUnits"
import AdminUsers from "../pages/admin/AdminUsers"
import AdminVolumes from "../pages/admin/AdminVolumes"
import AdminWarranty from "../pages/admin/AdminWarranty"
import AllCoupons from "../pages/admin/AllCoupons"
import AppDiscountSettings from "../pages/admin/AppDiscountSettings"
import AdminLoyaltySettings from "../pages/admin/AdminLoyaltySettings"
import AdminLoyaltyTypes from "../pages/admin/AdminLoyaltyTypes"
import AdminLoyaltyRules from "../pages/admin/AdminLoyaltyRules"
import AdminLoyaltyCustomers from "../pages/admin/AdminLoyaltyCustomers"
import AdminReferralSettings from "../pages/admin/AdminReferralSettings"
import AdminReferralTypes from "../pages/admin/AdminReferralTypes"
import AdminReferrals from "../pages/admin/AdminReferrals"
import AdminPushNotifications from "../pages/admin/AdminPushNotifications"
import AppDiscountForm from "../pages/admin/AppDiscountForm"
import PopupSettings from "../pages/admin/PopupSettings"
import PopupForm from "../pages/admin/PopupForm"
import BlogBrands from "../pages/admin/BlogBrands"
import BlogCategories from "../pages/admin/BlogCategories"
import BlogDashboard from "../pages/admin/BlogDashboard"
import BlogRating from "../pages/admin/BlogRating"
import BlogTopics from "../pages/admin/BlogTopics"
import BuyerProtectionAdmin from "../pages/admin/BuyerProtectionAdmin"
import CriticalOrders from "../pages/admin/CriticalOrders"
import EditBlog from "../pages/admin/EditBlog"
import EditBlogBrand from "../pages/admin/EditBlogBrand"
import EditBlogCategory from "../pages/admin/EditBlogCategory"
import EditBlogTopic from "../pages/admin/EditBlogTopic"
import EditCategory from "../pages/admin/EditCategory"
import EditSubCategory from "../pages/admin/EditSubCategory"
import ManageBlogComments from "../pages/admin/ManageBlogComments"
import OfferPages from "../pages/admin/OfferPages"
import OnlineOrders from "../pages/admin/OnlineOrders"
import PriceAdjustment from "../pages/admin/PriceAdjustment"
import PriceAdjustmentReports from "../pages/admin/PriceAdjustmentReports"
import RecentQuotation from "../pages/admin/RecentQuotation"
import Orders from "../pages/admin/Orders"
import WholesaleOrders from "../pages/admin/WholesaleOrders"
import Rejected from "../pages/admin/Rejected"
import ResetCache from "../pages/admin/ResetCache"
import AdminWhatsApp from "../pages/admin/AdminWhatsApp"
import TrashCategories from "../pages/admin/TrashCategories"
import TrashSubCategories from "../pages/admin/TrashSubCategories"
import DeliveryHandlingFee from "../pages/admin/DeliveryHandlingFee"
import ProductPaymentMethods from "../pages/admin/ProductPaymentMethods"
import CountryPaymentMethods from "../pages/admin/CountryPaymentMethods"

const AdminPortal = () => {
  return (
    <AdminRoute>
      <div className="min-h-screen bg-white" style={{ zoom: 0.75 }}>
        <AdminSidebar />
        <AdminHeader />
        <div className=" ">
          <Routes>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="create-labels" element={<CreateLabels />} />
            <Route path="products/add" element={<AddProduct />} />
            <Route path="products/bulk-add" element={<AddBulkProducts />} />
            <Route path="product-pm" element={<ProductPaymentMethods />} />
            <Route path="country-pm" element={<CountryPaymentMethods />} />
            {/* One tabbed page replaced the ten per-status pages. The old paths
                redirect to it with their tab preselected, so sidebar links,
                bookmarks and anything deep-linking an order keep working. */}
            <Route path="orders" element={<Orders />} />
            <Route path="orders/wholesale" element={<WholesaleOrders />} />
            <Route path="orders/new" element={<Navigate to="/admin/orders?status=New" replace />} />
            <Route path="orders/confirmed" element={<Navigate to="/admin/orders?status=Confirmed" replace />} />
            <Route path="orders/processing" element={<Navigate to="/admin/orders?status=Processing" replace />} />
            <Route
              path="orders/ready-for-shipment"
              element={<Navigate to="/admin/orders?status=Ready%20for%20Shipment" replace />}
            />
            <Route path="orders/on-the-way" element={<Navigate to="/admin/orders?status=On%20the%20Way" replace />} />
            <Route path="orders/delivered" element={<Navigate to="/admin/orders?status=Delivered" replace />} />
            <Route path="orders/on-hold" element={<Navigate to="/admin/orders?status=On%20Hold" replace />} />
            <Route path="orders/cancelled" element={<Navigate to="/admin/orders?status=Cancelled" replace />} />
            <Route path="orders/deleted" element={<Navigate to="/admin/orders?status=Deleted" replace />} />
            <Route path="orders/received" element={<Navigate to="/admin/orders?status=New" replace />} />
            <Route path="orders/in-progress" element={<Navigate to="/admin/orders?status=Processing" replace />} />
            <Route path="orders/rejected" element={<Rejected />} />
            <Route path="orders/online" element={<OnlineOrders />} />

            <Route path="reviews" element={<AdminReviews />} />
            <Route path="reviews/pending" element={<AdminReviewsPending />} />
            <Route path="reviews/approved" element={<AdminReviewsApproved />} />
            <Route path="reviews/rejected" element={<AdminReviewsRejected />} />

            <Route path="users" element={<AdminUsers />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="categories/add" element={<AddCategory />} />
            <Route path="categories/edit/:id" element={<EditCategory />} />
            <Route path="categories/trash" element={<TrashCategories />} />
            <Route path="categories/slider" element={<AdminCategorySlider />} />
            <Route path="subcategories" element={<AdminSubCategories />} />
            <Route path="subcategories/add" element={<AddSubCategory />} />
            <Route path="subcategories/edit/:id" element={<EditSubCategory />} />
            <Route path="subcategories/trash" element={<TrashSubCategories />} />
            <Route path="subcategories-2" element={<AdminSubCategories2 />} />
            <Route path="subcategories-2/add" element={<AddSubCategory />} />
            <Route path="subcategories-2/edit/:id" element={<EditSubCategory />} />
            <Route path="subcategories-3" element={<AdminSubCategories3 />} />
            <Route path="subcategories-3/add" element={<AddSubCategory />} />
            <Route path="subcategories-3/edit/:id" element={<EditSubCategory />} />
            <Route path="subcategories-4" element={<AdminSubCategories4 />} />
            <Route path="subcategories-4/add" element={<AddSubCategory />} />
            <Route path="subcategories-4/edit/:id" element={<EditSubCategory />} />
            <Route path="brands" element={<AdminBrands />} />
            <Route path="brands/add" element={<AddBrand />} />
            <Route path="edit-brand/:id" element={<AddBrand />} />
            <Route
              path="series"
              element={<AdminProductOptionManager routeType="series" title="Series" singularTitle="Series" />}
            />
            <Route
              path="series/add"
              element={
                <AdminProductOptionManager
                  routeType="series"
                  title="Series"
                  singularTitle="Series"
                  openFormOnLoad
                />
              }
            />
            <Route path="models" element={<AdminProductOptionManager routeType="model" title="Model" singularTitle="Model" />} />
            <Route
              path="models/add"
              element={<AdminProductOptionManager routeType="model" title="Model" singularTitle="Model" openFormOnLoad />}
            />
            <Route path="makes" element={<AdminProductOptionManager routeType="make" title="Make" singularTitle="Make" />} />
            <Route
              path="makes/add"
              element={<AdminProductOptionManager routeType="make" title="Make" singularTitle="Make" openFormOnLoad />}
            />
            <Route
              path="manufacturers"
              element={<AdminProductOptionManager routeType="manufacturer" title="Manufacturer" singularTitle="Manufacturer" />}
            />
            <Route
              path="manufacturers/add"
              element={
                <AdminProductOptionManager
                  routeType="manufacturer"
                  title="Manufacturer"
                  singularTitle="Manufacturer"
                  openFormOnLoad
                />
              }
            />
            <Route
              path="sold-by"
              element={<AdminProductOptionManager routeType="sold-by" title="Sold By" singularTitle="Sold By" />}
            />
            <Route
              path="sold-by/add"
              element={
                <AdminProductOptionManager
                  routeType="sold-by"
                  title="Sold By"
                  singularTitle="Sold By"
                  openFormOnLoad
                />
              }
            />
            <Route path="colors" element={<AdminColors />} />
            <Route path="colors/add" element={<AddColor />} />
            <Route path="sizes" element={<AdminSizes />} />
            <Route path="sizes/add" element={<AddSize />} />
            <Route path="units" element={<AdminUnits />} />
            <Route path="units/add" element={<AddUnit />} />
            <Route path="volumes" element={<AdminVolumes />} />
            <Route path="volumes/add" element={<AddVolume />} />
            <Route path="warranty" element={<AdminWarranty />} />
            <Route path="warranty/add" element={<AddWarranty />} />
            <Route path="delivery-handling-fee" element={<DeliveryHandlingFee />} />
            <Route path="tax" element={<AdminTax />} />
            <Route path="tax/add" element={<AddTax />} />
            <Route path="coupons" element={<AllCoupons />} />
            <Route path="coupons/all" element={<AllCoupons />} />
            <Route path="app-discount-settings" element={<AppDiscountSettings />} />
            <Route path="loyalty" element={<AdminLoyaltySettings />} />
            <Route path="loyalty/settings" element={<AdminLoyaltySettings />} />
            <Route path="loyalty/types" element={<AdminLoyaltyTypes />} />
            <Route path="loyalty/rules" element={<AdminLoyaltyRules />} />
            <Route path="loyalty/customers" element={<AdminLoyaltyCustomers />} />
            <Route path="referrals" element={<AdminReferrals />} />
            <Route path="referrals/settings" element={<AdminReferralSettings />} />
            <Route path="push-notifications" element={<AdminPushNotifications />} />
            <Route path="referrals/types" element={<AdminReferralTypes />} />
            <Route path="referrals/list" element={<AdminReferrals />} />
            <Route path="app-discount-settings/add" element={<AppDiscountForm />} />
            <Route path="app-discount-settings/edit/:id" element={<AppDiscountForm />} />
            <Route path="app-discount-settings/popup-settings" element={<PopupSettings />} />
            <Route path="app-discount-settings/popup-settings/add" element={<PopupForm />} />
            <Route path="app-discount-settings/popup-settings/edit/:id" element={<PopupForm />} />
            <Route path="banners" element={<AdminBanners />} />
            <Route path="banner-cards" element={<AdminBannerCards />} />
            <Route path="banner-cards/add" element={<AddBannerCard />} />
            <Route path="banner-cards/edit/:id" element={<AddBannerCard />} />
            <Route path="home-sections" element={<AdminBannerCards />} />
            <Route path="home-sections/add" element={<AddHomeSection />} />
            <Route path="home-sections/edit/:id" element={<AddHomeSection />} />
            <Route path="offer-pages" element={<OfferPages />} />
            <Route path="offer-pages/add" element={<AddOfferPage />} />
            <Route path="offer-pages/edit/:id" element={<AddOfferPage />} />
            <Route path="offer-products/add" element={<AddOfferProduct />} />
            <Route path="offer-products/edit/:id" element={<AddOfferProduct />} />
            <Route path="offer-brands/add" element={<AddOfferBrand />} />
            <Route path="offer-brands/edit/:id" element={<AddOfferBrand />} />
            <Route path="offer-categories/add" element={<AddOfferCategory />} />
            <Route path="offer-categories/edit/:id" element={<AddOfferCategory />} />
            <Route path="delivery-charges" element={<AdminDeliveryCharges />} />
            <Route path="delivery-charges/add" element={<AddDeliveryCharge />} />
            <Route path="delivery-charges/edit/:id" element={<AddDeliveryCharge />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="appearance" element={<AdminThemeSettings />} />

            <Route path="blog-dashboard" element={<BlogDashboard />} />
            <Route path="blogs" element={<AdminBlogs />} />
            <Route path="blogs/add" element={<AddBlog />} />
            <Route path="blogs/edit/:id" element={<EditBlog />} />
            <Route path="blog-categories" element={<BlogCategories />} />
            <Route path="blog-categories/add" element={<AddBlogCategory />} />
            <Route path="blog-categories/edit/:id" element={<EditBlogCategory />} />
            <Route path="blog-topics" element={<BlogTopics />} />
            <Route path="blog-topics/add" element={<AddBlogTopic />} />
            <Route path="blog-topics/edit/:id" element={<EditBlogTopic />} />
            <Route path="blog-brands" element={<BlogBrands />} />
            <Route path="blog-brands/add" element={<AddBlogBrand />} />
            <Route path="blog-brands/edit/:id" element={<EditBlogBrand />} />
            <Route path="blog-comments" element={<ManageBlogComments />} />
            <Route path="blog-rating" element={<BlogRating />} />

            <Route path="request-callbacks" element={<AdminRequestCallbacks />} />
            <Route path="notify-me" element={<AdminNotifyMe />} />
            <Route path="bulk-purchase" element={<AdminBulkPurchase />} />
            <Route path="buyer-protection" element={<BuyerProtectionAdmin />} />
            {/* The builder. The older raw-HTML screen stays at
                email-templates/transactional for the order and verification mails. */}
            <Route path="email-templates" element={<EmailDesigns />} />
            <Route path="email-templates/builder/:id" element={<EmailBuilder />} />
            <Route path="email-templates/transactional" element={<AdminEmailTemplates />} />
            <Route path="bulk-mails" element={<BulkMails />} />
            <Route path="newsletter-subscribers" element={<AdminNewsletter />} />
            <Route path="whatsapp" element={<AdminWhatsApp />} />
            <Route path="reset-cache" element={<ResetCache />} />
            <Route path="arabic-conversion" element={<AdminArabicConversion />} />
            <Route path="countries" element={<AdminCountryManager />} />

            <Route path="seo-settings/pages" element={<AdminPageSEOManager />} />
            <Route path="seo-settings/home" element={<AdminHomePageSEO />} />
            <Route path="seo-settings/redirects" element={<AdminSEOSettings />} />
            <Route path="seo-settings/bing-indexnow" element={<AdminBingIndexer />} />

            <Route path="stock-adjustment/price-adjustment" element={<PriceAdjustment />} />
            <Route path="stock-adjustment/reports" element={<PriceAdjustmentReports />} />

            <Route path="orders/critical" element={<CriticalOrders />} />

            <Route path="orders/create" element={<CreateOrder />} />
            <Route path="orders/quotations" element={<RecentQuotation />} />

            <Route path="admin-management" element={<AdminManagement />} />
            <Route path="activity-logs" element={<ActivityLogs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </AdminRoute>
  )
}

export default AdminPortal
