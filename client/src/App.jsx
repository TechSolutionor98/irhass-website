import { lazyWithRetry } from "./utils/lazyWithRetry"
import { lazy, Suspense } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import SetPasswordPrompt from "./components/SetPasswordPrompt"
import { CartProvider } from "./context/CartContext"
import { WishlistProvider } from "./context/WishlistContext"
import { ToastProvider } from "./context/ToastContext"
import { LanguageProvider } from "./context/LanguageContext"
import { CurrencyProvider } from "./context/CurrencyContext"
import { LoyaltyProvider } from "./context/LoyaltyContext"
import { ReferralProvider } from "./context/ReferralContext"
import { ThemeProvider } from "./context/ThemeContext"
import LoyaltyRewardDialog from "./components/LoyaltyRewardDialog"

// Import components
import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"
import ScrollToTop from "./components/ScrollToTop"
import DisableNumberInputScroll from "./components/DisableNumberInputScroll"
import RedirectHandler from "./components/RedirectHandler"
import ReturnPathTracker from "./components/ReturnPathTracker"
import ReferralLinkCatcher from "./components/ReferralLinkCatcher"

import { Helmet } from "react-helmet-async"
import { useLocation } from "react-router-dom"

// Import pages
const Home = lazyWithRetry(() => import("./pages/Home"))
const NotFound = lazyWithRetry(() => import("./pages/NotFound"))

const Shop = lazyWithRetry(() => import("./pages/Shop"))
const ProductDetails = lazyWithRetry(() => import("./pages/ProductDetails"))
const Cart = lazyWithRetry(() => import("./pages/Cart"))
const Checkout = lazyWithRetry(() => import("./pages/Checkout"))
const Login = lazyWithRetry(() => import("./pages/Login"))
const Register = lazyWithRetry(() => import("./pages/Register"))
const EmailVerification = lazyWithRetry(() => import("./pages/EmailVerification"))
const Profile = lazyWithRetry(() => import("./pages/Profile"))
const UserOrders = lazyWithRetry(() => import("./pages/UserOrders"))
const Wishlist = lazyWithRetry(() => import("./pages/Wishlist"))
const TrackOrder = lazyWithRetry(() => import("./pages/TrackOrder"))
const Unsubscribe = lazyWithRetry(() => import("./pages/Unsubscribe"))
const About = lazyWithRetry(() => import("./pages/About"))
const BlogList = lazyWithRetry(() => import("./pages/BlogList"))
const BlogPost = lazyWithRetry(() => import("./pages/BlogPost"))
const PrivacyAndPolicy = lazyWithRetry(() => import("./pages/PrivacyAndPolicy"))
const ArabicContent = lazyWithRetry(() => import("./pages/ArabicContent"))
const DisclaimerPolicy = lazyWithRetry(() => import("./pages/DisclaimerPolicy"))
const TermAndCondition = lazyWithRetry(() => import("./pages/TermAndCondition"))
const RefundAndReturn = lazyWithRetry(() => import("./pages/RefundAndReturn"))
const CookiesAndPolicy = lazyWithRetry(() => import("./pages/CookiesAndPolicy"))
const ReqBulkPurchase = lazyWithRetry(() => import("./pages/ReqBulkPurchase"))
const ContactUs = lazyWithRetry(() => import("./pages/ContactUs"))
const GuestOrder = lazyWithRetry(() => import("./pages/GuestOrder"))
const Guest = lazyWithRetry(() => import("./pages/Guest"))
const PaymentSuccess = lazyWithRetry(() => import("./pages/PaymentSuccess"))
const PaymentCancel = lazyWithRetry(() => import("./pages/PaymentCancel"))
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"))
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"))
const VoucherTerms = lazyWithRetry(() => import("./pages/VoucherTerms"))
const ReferralProgramTerms = lazyWithRetry(() => import("./pages/ReferralProgramTerms"))
const GrabianPointsTerms = lazyWithRetry(() => import("./pages/GrabianPointsTerms"))
const DeliveryTerms = lazyWithRetry(() => import("./pages/DeliveryTerms"))
const OfferPage = lazyWithRetry(() => import("./pages/OfferPage"))

const AdminLogin = lazyWithRetry(() => import("./pages/admin/AdminLogin"))
const SuperAdminLogin = lazyWithRetry(() => import("./pages/superadmin/SuperAdminLogin"))
const AdminPortal = lazyWithRetry(() => import("./routes/AdminPortal"))
const SuperAdminPortal = lazyWithRetry(() => import("./routes/SuperAdminPortal"))

function DefaultCanonical() {
  const location = useLocation()
  if (location.pathname !== "/") {
    return null
  }
  const href = typeof window !== "undefined" ? `${window.location.origin.replace(/\/+$/, "")}/` : "/"
  return (
    <Helmet prioritizeSeoTags>
      <link rel="canonical" href={href} />
    </Helmet>
  )
}

function RouteCanonical() {
  const location = useLocation()
  if (location.pathname === "/") return null
  if (location.pathname.includes("/offers/")) return null
  const href =
    typeof window !== "undefined"
      ? `${window.location.origin.replace(/\/+$/, "")}${location.pathname}`
      : location.pathname || "/"
  return (
    <Helmet prioritizeSeoTags>
      <link rel="canonical" href={href} />
    </Helmet>
  )
}

function App() {
  const lazyFallback = (
    <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>
  )

  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <CurrencyProvider>
              <LoyaltyProvider>
              <ReferralProvider>
              <Router>
                <ThemeProvider>
                <LanguageProvider>
                <DefaultCanonical />
                <ScrollToTop />
                <DisableNumberInputScroll />
                <LoyaltyRewardDialog />
                <ReturnPathTracker />
                <ReferralLinkCatcher />
                <RedirectHandler />
                {/* Renders nothing unless the signed-in account is still on the
                    temporary password an admin set for it. */}
                <SetPasswordPrompt />
                <div className="App">
                  <Suspense fallback={lazyFallback}>
                  <Routes>
                    {/* The storefront block at the bottom owns "/" now. This only keeps
                        the retired country-selector path from 404-ing. */}
                    <Route path="/select-country" element={<Navigate to="/" replace />} />
                  

                  
                  {/* Super Admin Portal Routes (separate green-themed portal) */}
                  <Route
                    path="/irhaassuperadmin/login"
                    element={
                      <Suspense fallback={lazyFallback}>
                        <SuperAdminLogin />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/superadmin/*"
                    element={
                      <Suspense fallback={lazyFallback}>
                        <SuperAdminPortal />
                      </Suspense>
                    }
                  />

                  {/* Admin Routes */}
                  <Route
                    path="/irhaasadmin/login"
                    element={
                      <Suspense fallback={lazyFallback}>
                        <AdminLogin />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/admin/*"
                    element={
                      <Suspense fallback={lazyFallback}>
                        <AdminPortal />
                      </Suspense>
                    }
                  />

                  {/* The storefront, served straight from the root with no country or
                      language prefix in the URL. Both live in localStorage and are changed
                      from the navbar; LanguageContext rewrites any legacy /xx-en link.
                      This used to be three identical copies of the same 48 routes -- one
                      per prefix shape -- which is why it is a single block now. */}
                  <Route
                    path="/*"
                    element={
                      <>
                        <RouteCanonical />
                        <Layout />
                      </>
                    }
                  >
                    <Route index element={<Home />} />
                    <Route path="shop" element={<Shop />} />
                    <Route path="shop/:parentCategory" element={<Shop />} />
                    <Route path="shop/:parentCategory/:subcategory" element={<Shop />} />
                    <Route path="shop/:parentCategory/:subcategory/:subcategory2" element={<Shop />} />
                    <Route path="shop/:parentCategory/:subcategory/:subcategory2/:subcategory3" element={<Shop />} />
                    <Route
                      path="shop/:parentCategory/:subcategory/:subcategory2/:subcategory3/:subcategory4"
                      element={<Shop />}
                    />
                    <Route path="product-category" element={<Shop />} />
                    <Route path="product-category/:parentCategory" element={<Shop />} />
                    <Route path="product-category/:parentCategory/:subcategory" element={<Shop />} />
                    <Route path="product-category/:parentCategory/:subcategory/:subcategory2" element={<Shop />} />
                    <Route
                      path="product-category/:parentCategory/:subcategory/:subcategory2/:subcategory3"
                      element={<Shop />}
                    />
                    <Route
                      path="product-category/:parentCategory/:subcategory/:subcategory2/:subcategory3/:subcategory4"
                      element={<Shop />}
                    />
                    <Route path="product/:slug" element={<ProductDetails />} />
                    <Route path="cart" element={<Cart />} />
                    <Route path="login" element={<Login />} />
                    <Route path="register" element={<Register />} />
                    <Route path="verify-email" element={<EmailVerification />} />
                    <Route path="track-order" element={<TrackOrder />} />
                    {/* Public: reached from the link in a campaign email, by
                        someone who is almost certainly not signed in. */}
                    <Route path="unsubscribe" element={<Unsubscribe />} />
                    <Route path="about" element={<About />} />
                    <Route path="blogs" element={<BlogList />} />
                    <Route path="blogs/:slug" element={<BlogPost />} />
                    <Route path="privacy-policy" element={<PrivacyAndPolicy />} />
                    <Route path="privacy-policy-arabic" element={<ArabicContent />} />
                    <Route path="disclaimer-policy" element={<DisclaimerPolicy />} />
                    <Route path="terms-conditions" element={<TermAndCondition />} />
                    <Route path="refund-return" element={<RefundAndReturn />} />
                    <Route path="cookies-policy" element={<CookiesAndPolicy />} />
                    <Route path="bulk-purchase" element={<ReqBulkPurchase />} />
                    <Route path="contact" element={<ContactUs />} />
                    <Route path="guest" element={<Guest />} />
                    <Route path="guest-order" element={<GuestOrder />} />
                    <Route path="payment/success" element={<PaymentSuccess />} />
                    <Route path="payment/cancel" element={<PaymentCancel />} />
                    <Route path="forgot-password" element={<ForgotPassword />} />
                    <Route path="reset-password" element={<ResetPassword />} />
                    <Route path="voucher-terms" element={<VoucherTerms />} />
                    <Route path="referral-program-terms" element={<ReferralProgramTerms />} />
                    <Route path="grabian-points-terms" element={<GrabianPointsTerms />} />
                    <Route path="delivery-terms" element={<DeliveryTerms />} />
                    <Route path="offers/:slug" element={<OfferPage />} />

                    {/* Checkout is open to guests: an account is created for them from
                        the order itself, so demanding a login first only loses the sale. */}
                    <Route path="checkout" element={<Checkout />} />

                    {/* Protected Routes */}
                    <Route
                      path="profile"
                      element={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="orders"
                      element={
                        <ProtectedRoute>
                          <UserOrders />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="wishlist"
                      element={
                        <ProtectedRoute>
                          <Wishlist />
                        </ProtectedRoute>
                      }
                    />
                  </Route>

                </Routes>
                </Suspense>
              </div>
            </LanguageProvider>
                </ThemeProvider>
          </Router>
              </ReferralProvider>
              </LoyaltyProvider>
          </CurrencyProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
