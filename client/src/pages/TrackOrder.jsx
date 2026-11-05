"use client"

import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useToast } from "../context/ToastContext"
import { Package, Truck, CheckCircle, Clock, AlertCircle, Search, Shield } from "lucide-react"
import axios from "axios"
import { getFullImageUrl } from "../utils/imageUtils"
import { useLanguage } from "../context/LanguageContext"
import { useCurrency } from "../context/CurrencyContext"
import TranslatedText from "../components/TranslatedText"
import { useAuth } from "../context/AuthContext"

import config from "../config/config"

const TrackOrder = () => {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const { showToast } = useToast()
  const { isArabic, getLocalizedPath } = useLanguage()
  const { formatPrice: formatCurrencyPrice } = useCurrency()
  const [formData, setFormData] = useState({
    email: "",
    orderId: "",
  })
  const handleLogout = () => {
    logout()
    navigate(getLocalizedPath("/"))
  }
  const [loading, setLoading] = useState(false)
  const [orderData, setOrderData] = useState(null)
  const [error, setError] = useState("")

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setOrderData(null)

    try {
      const { data } = await axios.post(`${config.API_URL}/api/orders/track`, {
        email: formData.email,
        orderId: formData.orderId,
      })

      setOrderData(data)
      showToast("Order found successfully!", "success")
    } catch (error) {
      console.error("Error tracking order:", error)
      const errorMessage = error.response?.data?.message || "Order not found. Please check your details."
      setError(errorMessage)
      showToast(errorMessage, "error")
    } finally {
      setLoading(false)
    }
  }

  // One accent for "this has happened", one neutral for "not yet", and a single red
  // for the only state that is actually bad news. The old six-colour scheme made a
  // routine "processing" look as loud as a cancellation.
  const getStatusTone = (status) => {
    const s = String(status || "").toLowerCase()
    if (s.includes("cancel") || s.includes("reject")) return "bad"
    if (s.includes("delivered")) return "done"
    return "active"
  }

  const STATUS_CHIP = {
    done: "bg-emerald-700 text-white",
    active: "bg-brand-600 text-white",
    bad: "bg-stone-800 text-white",
  }

  const getStatusIcon = (status) => {
    const tone = getStatusTone(status)
    const cls = "text-stone-900"
    if (tone === "bad") return <AlertCircle className={cls} size={20} strokeWidth={1.5} />
    if (tone === "done") return <CheckCircle className={cls} size={20} strokeWidth={1.5} />
    const s = String(status || "").toLowerCase()
    if (s.includes("ship") || s.includes("way")) return <Truck className={cls} size={20} strokeWidth={1.5} />
    if (s.includes("process") || s.includes("progress")) return <Package className={cls} size={20} strokeWidth={1.5} />
    return <Clock className={cls} size={20} strokeWidth={1.5} />
  }

  const formatPrice = (price) => {
    return formatCurrencyPrice(price, isArabic)
  }

  const getTrackingSteps = (status) => {
    const steps = [
      { name: "Order Placed", status: "completed" },
      { name: "Order Confirmed", status: "completed" },
      { name: "Processing", status: "pending" },
      { name: "Shipped", status: "pending" },
      { name: "Delivered", status: "pending" },
    ]

    const currentStatus = String(status || "").toLowerCase()

    if (currentStatus.includes("processing") || currentStatus.includes("progress")) {
      steps[2].status = "current"
    } else if (
      currentStatus.includes("shipped") ||
      currentStatus.includes("way") ||
      currentStatus.includes("shipment")
    ) {
      steps[2].status = "completed"
      steps[3].status = "current"
    } else if (currentStatus.includes("delivered")) {
      steps[2].status = "completed"
      steps[3].status = "completed"
      steps[4].status = "completed"
    }

    return steps
  }

  const field =
    "w-full border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 transition-colors focus:border-stone-900 focus:outline-none"
  const label = "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-stone-500"
  const card = "border border-stone-200 bg-white"
  const sectionTitle = "text-sm font-semibold uppercase tracking-[0.14em] text-stone-900"

  const steps = orderData ? getTrackingSteps(orderData.status) : []

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-12 sm:px-6 lg:px-8 md:py-16">
      {/* Account bar, for a signed-in shopper who reached this from their own pages. */}
      {isAuthenticated && user && (
        <div className="mb-10 flex flex-col gap-3 border-b border-stone-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-500">
            <TranslatedText>Signed in as</TranslatedText>{" "}
            <span className="font-medium capitalize text-stone-900">{user.name}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.12em]">
            <button onClick={() => navigate(getLocalizedPath("/profile"))} className="text-stone-500 transition-colors hover:text-stone-900">
              <TranslatedText>Profile</TranslatedText>
            </button>
            <button onClick={() => navigate(getLocalizedPath("/orders"))} className="text-stone-500 transition-colors hover:text-stone-900">
              <TranslatedText>My Orders</TranslatedText>
            </button>
            <span className="font-semibold text-stone-900">
              <TranslatedText>Track Order</TranslatedText>
            </span>
            <button onClick={handleLogout} className="text-stone-500 transition-colors hover:text-stone-900">
              <TranslatedText>Log out</TranslatedText>
            </button>
          </div>
        </div>
      )}

      <header className="max-w-xl">
        <h1 className="text-2xl font-semibold uppercase tracking-[0.12em] text-stone-900 md:text-[28px]">
          <TranslatedText>Track your order</TranslatedText>
        </h1>
        <p className="mt-3 text-sm text-stone-500">
          <TranslatedText>Enter the email you ordered with and your order number.</TranslatedText>
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-8 max-w-xl">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="track-email" className={label}>
              <TranslatedText>Email address</TranslatedText>
            </label>
            <input
              id="track-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={field}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="track-id" className={label}>
              <TranslatedText>Order number</TranslatedText>
            </label>
            <input
              id="track-id"
              type="text"
              name="orderId"
              value={formData.orderId}
              onChange={handleInputChange}
              className={field}
              placeholder={isArabic ? "أدخل رقم الطلب" : "e.g. 65f3a1c9b2…"}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 bg-footer-bg px-6 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 sm:w-auto sm:px-12"
        >
          <Search size={17} strokeWidth={1.8} />
          {loading ? <TranslatedText>Tracking…</TranslatedText> : <TranslatedText>Track order</TranslatedText>}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-8 max-w-xl border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">
          <TranslatedText text={error} />
        </p>
      )}

      {orderData && (
        <div className="mt-14 space-y-8">
          {/* Progress */}
          <section className={`${card} p-6 md:p-8`}>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <h2 className={sectionTitle}>
                <TranslatedText>Progress</TranslatedText>
              </h2>
              <span
                className={`px-3 py-[5px] text-[10px] font-semibold uppercase tracking-[0.12em] ${
                  STATUS_CHIP[getStatusTone(orderData.status)]
                }`}
              >
                <TranslatedText text={orderData.status} />
              </span>
            </div>

            {/* The rail is a sibling behind the dots, not an absolutely positioned line
                per step with a negative z-index -- that version drew underneath the
                card's own background and was invisible. */}
            <div className="relative">
              <div className="absolute left-0 right-0 top-[15px] h-px bg-stone-200" aria-hidden="true" />
              <div
                className="absolute left-0 top-[15px] h-px bg-stone-900 transition-all duration-500"
                aria-hidden="true"
                style={{
                  width: `${(Math.max(0, steps.filter((s) => s.status === "completed").length - 1) / (steps.length - 1)) * 100}%`,
                }}
              />
              <ol className="relative flex items-start justify-between">
                {steps.map((step) => (
                  <li key={step.name} className="flex flex-1 flex-col items-center text-center">
                    <span
                      className={`flex h-[31px] w-[31px] items-center justify-center rounded-full border-2 bg-white ${
                        step.status === "completed"
                          ? "border-stone-900 bg-stone-900 text-white"
                          : step.status === "current"
                            ? "border-brand-600 text-brand-600"
                            : "border-stone-200 text-stone-300"
                      }`}
                    >
                      {step.status === "completed" ? (
                        <CheckCircle size={16} strokeWidth={2} />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-current" />
                      )}
                    </span>
                    <span
                      className={`mt-3 max-w-[70px] text-[11px] leading-tight sm:max-w-none ${
                        step.status === "pending" ? "text-stone-400" : "font-medium text-stone-900"
                      }`}
                    >
                      <TranslatedText text={step.name} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-8 flex items-start gap-3 border-t border-stone-200 pt-6">
              {getStatusIcon(orderData.status)}
              <p className="text-sm text-stone-700">
                <TranslatedText
                  text={
                    orderData.status.toLowerCase().includes("delivered")
                      ? "Your order has been delivered."
                      : orderData.status.toLowerCase().includes("shipped") ||
                          orderData.status.toLowerCase().includes("way")
                        ? "Your order is on the way."
                        : orderData.status.toLowerCase().includes("processing")
                          ? "Your order is being prepared and will ship soon."
                          : "Your order has been received."
                  }
                />
              </p>
            </div>
          </section>

          {/* Details */}
          <section className={`${card} grid grid-cols-1 divide-y divide-stone-200 md:grid-cols-2 md:divide-x md:divide-y-0`}>
            <div className="p-6 md:p-8">
              <h2 className={sectionTitle}>
                <TranslatedText>Order</TranslatedText>
              </h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex gap-3">
                  <dt className="w-28 flex-shrink-0 text-stone-500">
                    <TranslatedText>Number</TranslatedText>
                  </dt>
                  <dd className="break-all font-mono text-xs text-stone-900">{orderData._id}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-28 flex-shrink-0 text-stone-500">
                    <TranslatedText>Placed</TranslatedText>
                  </dt>
                  <dd className="text-stone-900">
                    {new Date(orderData.createdAt).toLocaleDateString(isArabic ? "ar-PK" : "en-PK", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-28 flex-shrink-0 text-stone-500">
                    <TranslatedText>Total</TranslatedText>
                  </dt>
                  <dd className="font-semibold text-stone-900">{formatPrice(orderData.totalPrice)}</dd>
                </div>
                {orderData.trackingId && (
                  <div className="flex gap-3">
                    <dt className="w-28 flex-shrink-0 text-stone-500">
                      <TranslatedText>Tracking</TranslatedText>
                    </dt>
                    <dd className="break-all text-stone-900">{orderData.trackingId}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="p-6 md:p-8">
              <h2 className={sectionTitle}>
                <TranslatedText>Delivering to</TranslatedText>
              </h2>
              <div className="mt-4 space-y-1 text-sm text-stone-700">
                {orderData.shippingAddress ? (
                  <>
                    <p className="font-medium text-stone-900">
                      <TranslatedText text={orderData.shippingAddress.name} />
                    </p>
                    <p><TranslatedText text={orderData.shippingAddress.address} /></p>
                    <p>
                      <TranslatedText text={orderData.shippingAddress.city} />
                      {orderData.shippingAddress.postalCode ? `, ${orderData.shippingAddress.postalCode}` : ""}
                    </p>
                    <p><TranslatedText text={orderData.shippingAddress.country} /></p>
                    <p className="pt-2 text-stone-500">{orderData.shippingAddress.phone}</p>
                  </>
                ) : (
                  <p className="text-stone-500">
                    <TranslatedText>Collection order — no delivery address.</TranslatedText>
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Items */}
          <section className={`${card} p-6 md:p-8`}>
            <h2 className={sectionTitle}>
              <TranslatedText>Items</TranslatedText>
            </h2>

            <ul className="mt-5 divide-y divide-stone-100">
              {orderData.orderItems
                .filter((item) => !item.isProtection)
                .map((item, index) => {
                  const price = Number(item.price) || 0
                  const qty = Number(item.quantity) || 0
                  const href = getLocalizedPath(
                    `/product/${encodeURIComponent(item.product?.slug || item.product?._id || item.product)}`,
                  )

                  return (
                    <li key={index} className="flex items-center gap-4 py-5 first:pt-0">
                      <Link to={href} className="relative flex-shrink-0">
                        <div className="h-20 w-16 overflow-hidden bg-[#efece7]">
                          <img
                            src={getFullImageUrl(item.image) || "/placeholder.svg?height=80&width=64"}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-stone-700 px-1 text-[11px] font-semibold text-white">
                          {qty}
                        </span>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to={href} className="text-sm font-medium text-stone-900 hover:underline">
                          <TranslatedText text={item.name} sourceDoc={item.product} fieldName="name" />
                        </Link>
                        <p className="mt-1 text-xs text-stone-500">
                          {formatPrice(price)} <TranslatedText>each</TranslatedText>
                        </p>
                      </div>
                      <p className="flex-shrink-0 text-sm font-semibold text-stone-900">{formatPrice(price * qty)}</p>
                    </li>
                  )
                })}
            </ul>

            {orderData.orderItems.some((item) => item.isProtection) && (
              <div className="mt-6 border-t border-stone-200 pt-6">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                  <Shield size={15} strokeWidth={1.6} />
                  <TranslatedText>Protection plans</TranslatedText>
                </h3>
                <ul className="mt-4 space-y-3">
                  {orderData.orderItems
                    .filter((item) => item.isProtection)
                    .map((item, index) => (
                      <li key={index} className="flex items-center justify-between gap-4 bg-stone-50 px-4 py-3 text-sm">
                        <span className="min-w-0 text-stone-800">
                          <TranslatedText text={item.name} sourceDoc={item.product} fieldName="name" />
                        </span>
                        <span className="flex-shrink-0 font-semibold text-stone-900">
                          {formatPrice(Number(item.price) || 0)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-stone-900 pt-5">
              <span className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-900">
                <TranslatedText>Total</TranslatedText>
              </span>
              <span className="text-lg font-semibold text-stone-900">{formatPrice(orderData.totalPrice)}</span>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default TrackOrder
