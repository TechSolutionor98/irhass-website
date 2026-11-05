"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import axios from "axios"
import { useAuth } from "../context/AuthContext"
import { useLanguage } from "../context/LanguageContext"
import { useCart } from "../context/CartContext"
import { CheckCircle, Clock, Package, Truck, AlertTriangle, Printer, Download, X, Eye, FileText, ShoppingBag, MapPin, CreditCard, Shield, Phone, Mail } from "lucide-react"
import { getFullImageUrl } from "../utils/imageUtils"
import { Dialog, Transition } from "@headlessui/react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { useReactToPrint } from "react-to-print"
import { getOrderCurrencySymbol, getOrderCountryName } from "../utils/paymentUtils"
import config from "../config/config"
import { pushPurchase } from "../utils/gtmTracking"
import InvoiceComponent from "../components/admin/InvoiceComponent"

// When an order was placed, in the shopper's own timezone.
//
// The date alone is not enough to tell two orders from the same day apart --
// which is exactly when a customer goes looking for the timestamp. Kept as one
// pair of helpers so the card and the details modal can never disagree about
// the same order.
const placedDate = (value, { weekday = false } = {}) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleDateString("en-US", {
    ...(weekday ? { weekday: "long" } : {}),
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const placedTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

const UserOrders = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const { getLocalizedPath } = useLanguage()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState("")

  const { addToCart } = useCart()

  const handleLogout = () => {
    logout()
    navigate(getLocalizedPath("/"))
  }
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState({})
  const printRef = useRef()

  const toggleExpand = (orderId) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }))
  }

  const handleOrderAgain = async (order) => {
    const nonProtectionItems = order.orderItems.filter((item) => !item.isProtection)

    for (const item of nonProtectionItems) {
      const productId = item.product?._id || item.product
      let freshProduct = null
      try {
        const { data } = await axios.get(`${config.API_URL}/api/products/${productId}`)
        freshProduct = data
      } catch (e) {
        // ignore
      }

      const productToAdd = {
        _id: productId,
        name: freshProduct?.name || item.name,
        price: freshProduct?.price || item.price,
        offerPrice: freshProduct?.offerPrice || 0,
        image: freshProduct?.image || item.image,
        selectedColorIndex: item.selectedColorIndex ?? null,
        selectedColorData: item.selectedColorData ?? null,
        selectedDosIndex: item.selectedDosIndex ?? null,
        selectedDosData: item.selectedDosData ?? null,
        slug: freshProduct?.slug || item.product?.slug || "",
        brand: freshProduct?.brand || item.product?.brand || null,
        category: freshProduct?.category || item.product?.category || null,
        parentCategory: freshProduct?.parentCategory || item.product?.parentCategory || null,
        countInStock: freshProduct?.countInStock || item.product?.countInStock || 99,
      }

      addToCart(productToAdd, item.quantity)
    }

    navigate(getLocalizedPath("/cart"))
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Invoice_${selectedOrder?._id?.slice(-6) || "Order"}`,
  })

  // Check for success message from URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const success = params.get("success")
    const orderId = params.get("orderId")

    if (success === "true" && orderId) {
      setSuccessMessage(`Order #${orderId.slice(-6)} has been placed successfully!`)

      // Also reports the purchase to GTM -- a gateway that sends the customer
      // back here (Tabby) has no other place to fire it.
      initializeGCROptIn(orderId)

      // Clear success message after 5 seconds
      const timer = setTimeout(() => {
        setSuccessMessage("")
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [location])

  // Initialize Google Customer Reviews opt-in module
  const initializeGCROptIn = async (orderId) => {
    try {
      // Fetch order details
      const token = localStorage.getItem("token")
      const { data: order } = await axios.get(`${config.API_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      // Safety net for orders whose gateway returns the customer straight to
      // this page. pushPurchase skips an order id it has already reported, so a
      // COD order tracked at checkout is never counted twice.
      pushPurchase({
        orderId: order._id,
        value: order.totalPrice,
        items: order.orderItems,
        paymentMethod: order.paymentMethod || "unknown",
        shipping: order.shippingPrice || 0,
        tax: 0, // VAT is included in the prices
        coupon: order.couponCode || null,
        currency: order.currency || "PKR",
      })

      // Load Google API platform script if not already loaded
      if (!window.gapi) {
        const script = document.createElement("script")
        script.src = "https://apis.google.com/js/platform.js?onload=renderOptIn"
        script.async = true
        script.defer = true
        document.body.appendChild(script)
      }

      // Calculate estimated delivery date
      const estimatedDeliveryDate = order.estimatedDelivery
        ? new Date(order.estimatedDelivery).toISOString().split('T')[0]
        : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Extract GTINs from order items if available
      const products = order.orderItems
        .filter(item => item.product?.gtin || item.product?.barcode)
        .map(item => ({ gtin: item.product?.gtin || item.product?.barcode }))

      // Define the render function for GCR opt-in
      window.renderOptIn = function () {
        if (window.gapi && window.gapi.load) {
          window.gapi.load('surveyoptin', function () {
            window.gapi.surveyoptin.render({
              "merchant_id": 5615926184,
              "order_id": order._id,
              "email": order.shippingAddress?.email || user?.email || "",
              "delivery_country": "AE",
              "estimated_delivery_date": estimatedDeliveryDate,
              "products": products.length > 0 ? products : undefined,
              "opt_in_style": "BOTTOM_RIGHT_DIALOG"
            })
          })
        }
      }

      // Call renderOptIn if gapi is already loaded
      if (window.gapi && window.gapi.load) {
        window.renderOptIn()
      }
    } catch (error) {
      console.error("Error initializing GCR opt-in:", error)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(getLocalizedPath("/login"))
      return
    }

    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem("token")
        if (!token) {
          setError("Please log in to view your orders")
          setLoading(false)
          return
        }

        const { data } = await axios.get(`${config.API_URL}/api/orders/myorders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        
        setOrders(data.filter(order => order.status !== "Deleted"))
        setLoading(false)
      } catch (error) {
        console.error("Error fetching orders:", error)
        setError(error.response?.data?.message || "Failed to load your orders. Please try again later.")
        setLoading(false)
      }
    }

    fetchOrders()
  }, [isAuthenticated, navigate])

  const openModal = (order) => {
    setSelectedOrder(order)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setTimeout(() => setSelectedOrder(null), 300)
  }

  const triggerPrint = (order) => {
    setSelectedOrder(order)
    // Wait for state to update and InvoiceComponent to render before printing
    setTimeout(() => {
      handlePrint()
    }, 100)
  }

  // Every status the order model can hold gets its own icon and colour, in the
  // same palette the admin uses. Anything unmatched fell through to a warning
  // triangle before, which is why a Confirmed or Delivered order was flagged as
  // if something were wrong with it.
  const getStatusIcon = (status) => {
    switch (status) {
      case "New": return <FileText className="h-4 w-4" />
      case "Confirmed": return <CheckCircle className="h-4 w-4" />
      case "Processing": return <Clock className="h-4 w-4" />
      case "Ready for Shipment": return <Package className="h-4 w-4" />
      case "Shipped":
      case "On the Way":
      case "Out for Delivery": return <Truck className="h-4 w-4" />
      case "Delivered": return <CheckCircle className="h-4 w-4" />
      case "On Hold": return <Clock className="h-4 w-4" />
      case "Cancelled":
      case "Returned":
      case "Deleted": return <X className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "New": return "bg-slate-100 text-slate-700 border-slate-200"
      case "Confirmed": return "bg-lime-100 text-lime-800 border-lime-200"
      case "Processing": return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "Ready for Shipment": return "bg-cyan-100 text-cyan-800 border-cyan-200"
      case "Shipped": return "bg-purple-100 text-purple-800 border-purple-200"
      case "On the Way": return "bg-blue-100 text-blue-800 border-blue-200"
      case "Out for Delivery": return "bg-indigo-100 text-indigo-800 border-indigo-200"
      case "Delivered": return "bg-green-100 text-green-800 border-green-200"
      case "On Hold": return "bg-orange-100 text-orange-800 border-orange-200"
      case "Cancelled":
      case "Returned":
      case "Deleted": return "bg-red-100 text-red-800 border-red-200"
      default: return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Upper Welcome Banner */}
        {isAuthenticated && user && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
            {/* Decorative vertical green bar on the far right */}
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-lime-600"></div>

            <div className="flex items-center space-x-4">
              <h1 className="text-lg md:text-xl font-extrabold text-gray-800 tracking-tight capitalize">
                {user.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:gap-x-6 pr-4">
              <button
                onClick={() => navigate(getLocalizedPath("/profile"))}
                className="text-gray-600 hover:text-gray-900 font-semibold text-xs md:text-sm transition"
              >
                Profile
              </button>
              <button
                onClick={() => navigate(getLocalizedPath("/orders"))}
                className="text-gray-900 font-bold text-xs md:text-sm hover:opacity-80 transition"
              >
                My Orders
              </button>
              <button
                onClick={() => navigate(getLocalizedPath("/track-order"))}
                className="text-gray-600 hover:text-gray-900 font-semibold text-xs md:text-sm transition"
              >
                Track Order
              </button>
              <button
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700 font-bold text-xs md:text-sm transition"
              >
                Logout
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">My Orders</h1>
            <p className="mt-2 text-gray-600">View and manage your recent purchases</p>
          </div>
          <Link to="/" className="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition shadow-sm hover:shadow">
            <ShoppingBag className="w-5 h-5 mr-2" />
            Continue Shopping
          </Link>
        </div>

        {successMessage && (
          <div className="mb-8 p-4 bg-green-50 text-green-700 border border-green-200 rounded-xl flex items-center shadow-sm">
            <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            <p className="font-medium">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="mb-8 p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center shadow-sm">
            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-50 rounded-full mb-6">
              <Package className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">No orders found</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">Looks like you haven't made any purchases yet. Start shopping to see your orders here.</p>
            <Link to="/" className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-all shadow-md hover:shadow-lg">
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const nonProtectionItems = order.orderItems.filter(item => !item.isProtection);
              const firstProductItem = nonProtectionItems[0];
              const isExpanded = !!expandedOrders[order._id];
              return (
                <div key={order._id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 overflow-hidden group">
                  <div className="p-6 border-b border-gray-50 bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Order Number</p>
                        <h3 className="text-lg font-bold text-gray-900">#{order._id.slice(-6).toUpperCase()}</h3>
                      </div>
                      <div className="hidden sm:block w-px h-10 bg-gray-200"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Date Placed</p>
                        <p className="text-base font-medium text-gray-900">{placedDate(order.createdAt)}</p>
                        <p className="text-sm text-gray-500">{placedTime(order.createdAt)}</p>
                      </div>
                      <div className="hidden sm:block w-px h-10 bg-gray-200"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Total Amount</p>
                        <p className="text-base font-bold text-green-600">
                          {getOrderCurrencySymbol(order)} {Number(order.totalPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="hidden sm:block w-px h-10 bg-gray-200"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Country</p>
                        <p className="text-base font-medium text-gray-900 flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          {getOrderCountryName(order)}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`px-3.5 py-1.5 rounded-lg border flex items-center gap-2 font-semibold text-sm ${getStatusColor(order.status)}`}
                    >
                      {getStatusIcon(order.status)}
                      <span>{order.status}</span>
                    </div>
                  </div>

                  <div className="p-6 flex flex-col md:flex-row justify-between items-start gap-6 bg-gray-50/30">
                    <div className="flex items-start gap-4 flex-1 py-2 w-full">
                      {isExpanded ? (
                        <div className="flex flex-col gap-4 w-full">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Items in this order</h4>
                          <div className="space-y-3 w-full">
                            {nonProtectionItems.map((item, idx) => (
                              <div key={item._id || idx} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-b-0">
                                <Link 
                                  to={getLocalizedPath(`/product/${item.product?.slug || item.product?._id || item.product}`)}
                                  className="w-14 h-14 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 bg-white hover:scale-105 transition-transform duration-200"
                                >
                                  <img
                                    src={getFullImageUrl(item.image) || "/placeholder.svg"}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                </Link>
                                <div className="flex-1 min-w-0">
                                  <Link 
                                    to={getLocalizedPath(`/product/${item.product?.slug || item.product?._id || item.product}`)}
                                    className="font-semibold text-gray-900 hover:text-green-600 hover:underline line-clamp-1 block transition-colors"
                                  >
                                    {item.name}
                                  </Link>
                                  <span className="text-sm text-gray-500 font-medium block mt-1">Qty: {item.quantity}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button 
                            onClick={() => toggleExpand(order._id)}
                            className="text-xs font-bold text-green-600 hover:text-green-700 mt-2 self-start flex items-center gap-1 hover:underline transition-colors"
                          >
                            Show Less
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center -space-x-4 overflow-hidden flex-shrink-0">
                            {nonProtectionItems.slice(0, 3).map((item, idx) => (
                              <Link 
                                key={item._id || idx} 
                                to={getLocalizedPath(`/product/${item.product?.slug || item.product?._id || item.product}`)}
                                className="relative z-10 w-16 h-16 rounded-full border-4 border-white bg-white shadow-sm overflow-hidden flex-shrink-0 group-hover:-translate-y-1 transition-transform duration-300 hover:scale-105 hover:z-20" 
                                style={{ transitionDelay: `${idx * 50}ms` }}
                              >
                                <img
                                  src={getFullImageUrl(item.image) || "/placeholder.svg"}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              </Link>
                            ))}
                          </div>
                          <div className="flex flex-col flex-1">
                            {firstProductItem && (
                              <Link 
                                to={getLocalizedPath(`/product/${firstProductItem.product?.slug || firstProductItem.product?._id || firstProductItem.product}`)}
                                className="font-semibold text-gray-900 pr-4 hover:text-green-600 hover:underline transition-colors duration-200"
                              >
                                {firstProductItem.name || "Product Item"}
                              </Link>
                            )}
                            {nonProtectionItems.length > 1 && (
                              <button 
                                onClick={() => toggleExpand(order._id)}
                                className="text-sm text-green-600 font-semibold hover:text-green-700 mt-1.5 self-start text-left hover:underline flex items-center gap-1 transition-colors"
                              >
                                + {nonProtectionItems.length - 1} more item(s)
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-shrink-0 md:self-center">
                      <button 
                        onClick={() => handleOrderAgain(order)}
                        className="inline-flex items-center justify-center px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-all shadow-sm hover:shadow"
                      >
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        Order Again
                      </button>
                      <button 
                        onClick={() => openModal(order)} 
                        className="inline-flex items-center justify-center px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </button>
                      <button 
                        onClick={() => triggerPrint(order)}
                        className="inline-flex items-center justify-center px-5 py-2.5 bg-green-50 text-green-700 border border-green-100 rounded-xl font-medium hover:bg-green-100 transition-all shadow-sm"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Invoice
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invisible component for printing */}
      <div style={{ display: "none" }}>
        <div ref={printRef}>
          {selectedOrder && <InvoiceComponent order={selectedOrder} showStatus={true} />}
        </div>
      </div>

      {/* Order Details Modal */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95 translate-y-4"
                enterTo="opacity-100 scale-100 translate-y-0"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100 translate-y-0"
                leaveTo="opacity-0 scale-95 translate-y-4"
              >
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-2xl transition-all">
                  {selectedOrder && (
                    <div className="flex flex-col max-h-[90vh]">
                      {/* Modal Header: the order's identity on one line, then the
                          facts a customer checks first -- each with its own label,
                          so nothing has to be guessed from an icon, and each shown
                          exactly once. */}
                      <div className="border-b border-gray-100 bg-gray-50/80 sticky top-0 z-10">
                        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <Dialog.Title as="h3" className="text-xl font-bold text-gray-900">
                              Order #{selectedOrder._id.slice(-6).toUpperCase()}
                            </Dialog.Title>
                            <p className="mt-1 text-sm text-gray-500 flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>
                                Placed {placedDate(selectedOrder.createdAt, { weekday: true })} at{" "}
                                {placedTime(selectedOrder.createdAt)}
                              </span>
                            </p>
                          </div>
                          <button
                            onClick={closeModal}
                            aria-label="Close"
                            className="p-2 -mr-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition flex-shrink-0"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>

                        <div className="px-6 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Status</p>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${getStatusColor(selectedOrder.status)}`}
                            >
                              {getStatusIcon(selectedOrder.status)}
                              {selectedOrder.status}
                            </span>
                          </div>

                          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Delivery</p>
                            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                              {selectedOrder.deliveryType === "pickup" ? (
                                <>
                                  <ShoppingBag className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  Store pickup
                                </>
                              ) : (
                                <>
                                  <Truck className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  Home delivery
                                </>
                              )}
                            </p>
                          </div>

                          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Payment</p>
                            <p className="text-sm font-semibold text-gray-900 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                              <CreditCard className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span>{selectedOrder.paymentMethod}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  selectedOrder.isPaid ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {selectedOrder.isPaid ? "Paid" : "Pending"}
                              </span>
                            </p>
                          </div>

                          <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1.5">Store</p>
                            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <span>
                                {getOrderCountryName(selectedOrder)}
                                <span className="font-normal text-gray-500"> · {getOrderCurrencySymbol(selectedOrder)}</span>
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Modal Body - Scrollable */}
                      <div className="overflow-y-auto flex-1 p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                          
                          {/* Left Column: Items */}
                          <div className="lg:col-span-2 space-y-6">
                            <div>
                              <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Package className="w-5 h-5 text-green-600" />
                                Order Items
                              </h4>
                              <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-50">
                                {selectedOrder.orderItems.filter(item => !item.isProtection).map((item) => (
                                  <div key={item._id} className="p-4 flex gap-4 hover:bg-gray-50/50 transition">
                                    <div className="w-20 h-20 rounded-lg border border-gray-100 overflow-hidden flex-shrink-0 bg-white hover:opacity-90 transition">
                                      <Link to={getLocalizedPath(`/product/${item.product?.slug || item.product?._id || item.product}`)}>
                                        <img
                                          src={getFullImageUrl(item.image) || "/placeholder.svg"}
                                          alt={item.name}
                                          className="w-full h-full object-cover"
                                        />
                                      </Link>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center">
                                      <Link to={getLocalizedPath(`/product/${item.product?.slug || item.product?._id || item.product}`)} title={item.name} className="inline-block hover:opacity-80 transition">
                                        <h5 className="font-semibold text-gray-900 line-clamp-2 hover:text-green-600 hover:underline decoration-green-600 decoration-2 underline-offset-2">{item.name}</h5>
                                      </Link>
                                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                        <span className="text-gray-500">Qty: <span className="font-medium text-gray-900">{item.quantity}</span></span>
                                        {item.selectedColorData?.color && (
                                          <span className="text-gray-500 flex items-center gap-1">
                                            Color: 
                                            <span className="w-3 h-3 rounded-full border border-gray-200" style={{backgroundColor: item.selectedColorData.color.toLowerCase()}}></span>
                                            <span className="font-medium text-gray-900">{item.selectedColorData.color}</span>
                                          </span>
                                        )}
                                        {item.selectedDosData?.dosType && (
                                          <span className="text-gray-500">OS: <span className="font-medium text-gray-900">{item.selectedDosData.dosType}</span></span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right flex flex-col justify-center">
                                      <span className="font-bold text-gray-900">{getOrderCurrencySymbol(selectedOrder)} {(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      {item.quantity > 1 && (
                                        <span className="text-xs text-gray-500">{getOrderCurrencySymbol(selectedOrder)} {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                
                                {/* Protection Items */}
                                {selectedOrder.orderItems.some(item => item.isProtection) && (
                                  <div className="bg-green-50/50 p-4 border-t border-green-100">
                                    <h5 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                                      <Shield className="w-4 h-4 text-green-600" />
                                      Protection Plans
                                    </h5>
                                    <div className="space-y-3">
                                      {selectedOrder.orderItems.filter(item => item.isProtection).map((item) => (
                                        <div key={item._id} className="flex justify-between items-center text-sm">
                                          <div className="flex items-center gap-2 text-green-800">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span>{item.name}</span>
                                          </div>
                                          <span className="font-semibold text-green-900">{getOrderCurrencySymbol(selectedOrder)} {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Tracking Info if available */}
                            {selectedOrder.trackingId && (
                              <div>
                                <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                                  <Truck className="w-5 h-5 text-purple-600" />
                                  Delivery Information
                                </h4>
                                <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex flex-col sm:flex-row gap-6">
                                  <div>
                                    <p className="text-sm text-gray-500 mb-1">Tracking ID</p>
                                    <p className="font-semibold text-gray-900">{selectedOrder.trackingId}</p>
                                  </div>
                                  {selectedOrder.estimatedDelivery && (
                                    <div>
                                      <p className="text-sm text-gray-500 mb-1">Estimated Delivery</p>
                                      <p className="font-semibold text-gray-900">{new Date(selectedOrder.estimatedDelivery).toLocaleDateString()}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right Column: Order Info */}
                          <div className="space-y-6">
                            {/* Summary Box */}
                            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                              <h4 className="text-base font-bold text-gray-900 mb-4">Payment Summary</h4>
                              <div className="space-y-3 text-sm">
                                <div className="flex justify-between text-gray-600">
                                  <span>Subtotal</span>
                                  <span className="font-medium text-gray-900">{getOrderCurrencySymbol(selectedOrder)} {(selectedOrder.itemsPrice || selectedOrder.totalPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                  <span>Shipping Fee</span>
                                  <span className="font-medium text-gray-900">{getOrderCurrencySymbol(selectedOrder)} {(selectedOrder.shippingPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                {selectedOrder.taxPrice > 0 && (
                                  <div className="flex justify-between text-gray-600">
                                    <span>Tax</span>
                                    <span className="font-medium text-gray-900">{getOrderCurrencySymbol(selectedOrder)} {(selectedOrder.taxPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                )}
                                {selectedOrder.discountAmount > 0 && (
                                  <div className="flex justify-between text-green-600">
                                    <span>
                                      Coupon discount
                                      {selectedOrder.couponCode && (
                                        <span className="ml-1.5 rounded bg-green-50 px-1.5 py-0.5 font-mono text-xs">{selectedOrder.couponCode}</span>
                                      )}
                                    </span>
                                    <span className="font-medium">-{getOrderCurrencySymbol(selectedOrder)} {(selectedOrder.discountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                )}
                                {selectedOrder.referralDiscountAmount > 0 && (
                                  <div className="flex justify-between text-green-600">
                                    <span>
                                      {selectedOrder.referralRewardRole === "referee" ? "Referral welcome discount" : "Referral reward"}
                                      {selectedOrder.referralDiscountValue > 0 && (
                                        <span className="ml-1.5 text-xs text-green-700/80">
                                          (
                                          {selectedOrder.referralDiscountType === "fixed"
                                            ? `${getOrderCurrencySymbol(selectedOrder)} ${Number(selectedOrder.referralDiscountValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} off`
                                            : `${selectedOrder.referralDiscountValue}% off`}
                                          )
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-medium">-{getOrderCurrencySymbol(selectedOrder)} {(selectedOrder.referralDiscountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                )}
                                {selectedOrder.loyaltyDiscountAmount > 0 && (
                                  <div className="flex justify-between text-green-600">
                                    <span>
                                      Grabian Points applied
                                      {selectedOrder.loyaltyPointsRedeemed > 0 && (
                                        <span className="ml-1.5 text-xs text-green-700/80">
                                          ({Number(selectedOrder.loyaltyPointsRedeemed).toLocaleString()} points)
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-medium">-{getOrderCurrencySymbol(selectedOrder)} {(selectedOrder.loyaltyDiscountAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                )}
                                {/* Fees for the chosen payment method -- a cash handling fee on
                                    delivery, an instalment fee on Tabby or Tamara. Without these
                                    rows the total does not add up on screen. */}
                                {(selectedOrder.paymentCharges || []).map((charge, index) => (
                                  <div key={index} className="flex justify-between text-gray-600">
                                    <span>{charge.name}</span>
                                    <span className="font-medium text-gray-900">{getOrderCurrencySymbol(selectedOrder)} {(Number(charge.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                ))}
                                <div className="pt-3 mt-3 border-t border-gray-200 flex justify-between items-center">
                                  <span className="font-bold text-gray-900">Total</span>
                                  <span className="text-xl font-bold text-green-600">{getOrderCurrencySymbol(selectedOrder)} {(selectedOrder.totalPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            </div>

                            {/* Where it goes: the delivery address, or the store the
                                customer collects from. */}
                            {selectedOrder.deliveryType === "pickup" ? (
                              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                                <h4 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                                  <ShoppingBag className="w-4 h-4 text-green-600" />
                                  Pickup Details
                                </h4>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <p className="font-medium text-gray-900">{selectedOrder.pickupDetails?.location || "Store pickup"}</p>
                                  {selectedOrder.pickupDetails?.storeAddress && <p>{selectedOrder.pickupDetails.storeAddress}</p>}
                                  {selectedOrder.pickupDetails?.storePhone && (
                                    <p className="flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      {selectedOrder.pickupDetails.storePhone}
                                    </p>
                                  )}
                                  <p className="pt-3 text-xs font-medium uppercase tracking-wide text-gray-500">Collected by</p>
                                  <p className="font-medium text-gray-900">
                                    {selectedOrder.pickupDetails?.name || selectedOrder.shippingAddress?.name || user?.name}
                                  </p>
                                  {(selectedOrder.pickupDetails?.phone || selectedOrder.shippingAddress?.phone) && (
                                    <p className="flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      {selectedOrder.pickupDetails?.phone || selectedOrder.shippingAddress?.phone}
                                    </p>
                                  )}
                                  {(selectedOrder.pickupDetails?.email || selectedOrder.shippingAddress?.email || user?.email) && (
                                    <p className="flex items-center gap-2">
                                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      {selectedOrder.pickupDetails?.email || selectedOrder.shippingAddress?.email || user?.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                                <h4 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-red-500" />
                                  Shipping Address
                                </h4>
                                <div className="text-sm text-gray-600 space-y-1">
                                  <p className="font-medium text-gray-900">{selectedOrder.shippingAddress?.name || user?.name}</p>
                                  {selectedOrder.shippingAddress?.address && <p>{selectedOrder.shippingAddress.address}</p>}
                                  {(selectedOrder.shippingAddress?.city || selectedOrder.shippingAddress?.state || selectedOrder.shippingAddress?.zipCode) && (
                                    <p>
                                      {[selectedOrder.shippingAddress?.city, selectedOrder.shippingAddress?.state].filter(Boolean).join(", ")}
                                      {selectedOrder.shippingAddress?.zipCode ? ` ${selectedOrder.shippingAddress.zipCode}` : ""}
                                    </p>
                                  )}
                                  {selectedOrder.shippingAddress?.country && <p>{selectedOrder.shippingAddress.country}</p>}
                                  {selectedOrder.shippingAddress?.phone && (
                                    <p className="pt-2 flex items-center gap-2">
                                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      {selectedOrder.shippingAddress.phone}
                                    </p>
                                  )}
                                  {(selectedOrder.shippingAddress?.email || user?.email) && (
                                    <p className="flex items-center gap-2">
                                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      {selectedOrder.shippingAddress?.email || user?.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {selectedOrder.customerNotes && (
                              <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                                <h4 className="text-sm font-bold text-amber-900 mb-1">Your note</h4>
                                <p className="text-sm text-amber-900/80 whitespace-pre-line">{selectedOrder.customerNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 z-10">
                        {/* Reordering from inside the modal, so the customer does
                            not have to close it and find the card again. */}
                        <button
                          onClick={() => {
                            handleOrderAgain(selectedOrder)
                            closeModal()
                          }}
                          className="inline-flex items-center justify-center px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-100 transition-all"
                        >
                          <ShoppingBag className="w-4 h-4 mr-2" />
                          Order Again
                        </button>
                        <button
                          onClick={() => triggerPrint(selectedOrder)}
                          className="inline-flex items-center justify-center px-5 py-2.5 bg-green-600 text-white border border-transparent rounded-xl font-medium hover:bg-green-700 transition-all shadow-sm"
                        >
                          <Printer className="w-4 h-4 mr-2" />
                          Print / Download Invoice
                        </button>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}

export default UserOrders
