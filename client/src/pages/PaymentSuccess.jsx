"use client"

import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useLanguage } from "../context/LanguageContext"
import axios from "axios"
import config from "../config/config"
import { pushPurchase } from "../utils/gtmTracking"

const PaymentSuccess = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { getLocalizedPath } = useLanguage()
  const [orderData, setOrderData] = useState(null)

  const shouldVerifyNgeniusPayment = (paymentMethod) => {
    const normalized = String(paymentMethod || "").toLowerCase()
    return ["card", "tabby", "online_payment"].includes(normalized)
  }

  const syncNgeniusPaymentStatus = async (orderId, paymentMethod) => {
    if (!orderId || !shouldVerifyNgeniusPayment(paymentMethod)) return

    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const { data } = await axios.post(`${config.API_URL}/api/payment/ngenius/verify/${orderId}`)
        const normalizedStatus = String(data?.status || "").toUpperCase()
        const isFinalState = data?.isPaid || ["FAILED", "DECLINED", "CANCELED", "CANCELLED", "EXPIRED"].includes(normalizedStatus)

        console.log(`[PaymentSuccess] N-Genius sync attempt ${attempt}:`, {
          status: data?.status,
          isPaid: data?.isPaid,
        })

        if (isFinalState) {
          return
        }
      } catch (error) {
        console.error(`[PaymentSuccess] N-Genius sync attempt ${attempt} failed:`, error.response?.data || error.message)
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search)
    const orderId = urlParams.get("orderId") || urlParams.get("order_id")
    const total = urlParams.get("total") || urlParams.get("amount")
    const paymentMethod = urlParams.get("payment_method") || "online_payment"

    if (!orderId) return

    let cancelled = false

    const run = async () => {
      // Let the gateway status land first, so the order we report is the one
      // the customer was actually charged for.
      await syncNgeniusPaymentStatus(orderId, paymentMethod)

      const order = await fetchOrderDetails(orderId)
      if (cancelled) return

      // The saved order is the source of truth. Only if it cannot be read do we
      // fall back to the redirect amount and the cart still in localStorage.
      const fallbackItems = JSON.parse(localStorage.getItem("cart") || "[]")

      // pushPurchase ignores an order id it has already reported, so a refresh
      // of this page never counts the conversion twice.
      pushPurchase({
        orderId,
        value: order?.totalPrice ?? (Number.parseFloat(total) || 0),
        items: order?.orderItems?.length ? order.orderItems : fallbackItems,
        paymentMethod: order?.paymentMethod || paymentMethod,
        shipping: order?.shippingPrice || 0,
        tax: 0, // VAT is included in the prices
        coupon: order?.couponCode || null,
        currency: order?.currency || "PKR",
      })

      // Clear cart after successful purchase tracking
      localStorage.removeItem("cart")
      localStorage.removeItem("guestInfo")
      localStorage.removeItem("savedShippingAddress")
    }

    run()

    return () => {
      cancelled = true
    }
  }, [location])

  const fetchOrderDetails = async (orderId) => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("adminToken")
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      
      const { data } = await axios.get(`${config.API_URL}/api/orders/${orderId}`, { headers })
      setOrderData(data)
      return data
    } catch (error) {
      console.error("Error fetching order details:", error)
      return null
    }
  }

  // Initialize Google Customer Reviews opt-in module
  useEffect(() => {
    if (!orderData) return

    // Load Google API platform script if not already loaded
    if (!window.gapi) {
      const script = document.createElement("script")
      script.src = "https://apis.google.com/js/platform.js?onload=renderOptIn"
      script.async = true
      script.defer = true
      document.body.appendChild(script)
    }

    // Calculate estimated delivery date (7-14 days from now by default)
    const estimatedDeliveryDate = orderData.estimatedDelivery 
      ? new Date(orderData.estimatedDelivery).toISOString().split('T')[0]
      : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 10 days from now

    // Extract GTINs from order items if available
    const products = orderData.orderItems
      .filter(item => item.product?.gtin || item.product?.barcode)
      .map(item => ({ gtin: item.product?.gtin || item.product?.barcode }))

    // Define the render function for GCR opt-in
    window.renderOptIn = function() {
      if (window.gapi && window.gapi.load) {
        window.gapi.load('surveyoptin', function() {
          window.gapi.surveyoptin.render({
            // REQUIRED FIELDS
            "merchant_id": 5615926184,
            "order_id": orderData._id,
            "email": orderData.shippingAddress?.email || orderData.user?.email || "",
            "delivery_country": "PK", // Pakistan country code
            "estimated_delivery_date": estimatedDeliveryDate,

            // OPTIONAL FIELDS
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
  }, [orderData])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="bg-lime-100 rounded-full w-24 h-24 flex items-center justify-center mb-6">
        <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-lime-600">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-lime-700 mb-2">Payment Successful!</h1>
      <p className="text-lg text-gray-700 mb-6">
        Thank you for your purchase. Your order has been placed and payment was successful.
      </p>
      <div className="flex gap-4">
        <button onClick={() => navigate(getLocalizedPath("/"))} className="bg-lime-500 hover:bg-lime-600 text-white rounded-lg px-6 py-3">
          Go to Home
        </button>
        <button
          onClick={() => navigate(getLocalizedPath("/orders"))}
          className="bg-gray-200 hover:bg-gray-300 text-lime-700 rounded-lg px-6 py-3"
        >
          View My Orders
        </button>
      </div>
    </div>
  )
}

export default PaymentSuccess
