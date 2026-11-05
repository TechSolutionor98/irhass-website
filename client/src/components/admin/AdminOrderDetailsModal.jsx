import React, { useState, useEffect, useRef } from "react"
import axios from "axios"
import { useReactToPrint } from "react-to-print"
import {
  X,
  Package,
  CreditCard,
  MapPin,
  User,
  Printer,
  Save,
  Shield,
  Mail,
  RefreshCw,
} from "lucide-react"

import config from "../../config/config"
import { getInvoiceBreakdown } from "../../utils/invoiceBreakdown"
import { resolveOrderItemBasePrice, computeBaseSubtotal, deriveBaseDiscount } from "../../utils/orderPricing"
import { getPaymentMethodDisplay, getPaymentMethodBadgeColor, getOrderCountryName, formatOrderPrice } from "../../utils/paymentUtils"
import { paymentMethodChargeAPI, adminAPI } from "../../services/api"
import InvoiceComponent from "./InvoiceComponent"
import QuotationInvoiceComponent from "./QuotationInvoiceComponent"
import { askToEmailCustomer } from "../../utils/customerEmail"
import { orderCustomerName, orderCustomerEmail, orderCustomerPhone, orderPickupStore } from "../../utils/orderCustomer"

const orderStatusOptions = [
  "New",
  "Processing",
  "Confirmed",
  "Ready For Shipment",
  "Shipped",
  "On the Way",
  "Out for Delivery",
  "Delivered",
  "On Hold",
  "Cancelled",
  "Deleted",
]

const AdminOrderDetailsModal = ({ isOpen, order: initialOrder, onClose, onUpdate, isQuotation }) => {
  const [order, setOrder] = useState(initialOrder)
  const [processingAction, setProcessingAction] = useState(false)
  const [error, setError] = useState(null)

  // Notes and tracking states
  const [trackingId, setTrackingId] = useState("")
  const [estimatedDelivery, setEstimatedDelivery] = useState("")
  const [sellerComments, setSellerComments] = useState("")

  // Notification modal states
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState("")
  const [notificationOrderId, setNotificationOrderId] = useState(null)
  
  const [fallbackDynamicCharges, setFallbackDynamicCharges] = useState([])

  const printComponentRef = useRef(null)

  const [sendingConvert, setSendingConvert] = useState(false)
  const [sendEmailOnConvert, setSendEmailOnConvert] = useState(false)

  const convertQuotation = async () => {
    if (!order?._id) return
    try {
      setSendingConvert(true)
      const response = await adminAPI.convertQuotation(order._id, {
        sendCustomerEmail: sendEmailOnConvert,
      })
      alert(`Quotation converted to Order #${response?.order?._id?.slice?.(-6) || ""}`)
      const updatedQuotation = {
        ...order,
        quotationStatus: "Converted",
        convertedOrderId: response?.order?._id || response?.order,
      }
      setOrder(updatedQuotation)
      if (onUpdate) onUpdate(updatedQuotation)
    } catch (e) {
      alert(e?.message || "Failed to convert quotation")
    } finally {
      setSendingConvert(false)
    }
  }

  const selectedTotals = order ? getInvoiceBreakdown(order) : {}

  useEffect(() => {
    if (initialOrder) {
      setOrder(initialOrder)
      setTrackingId(initialOrder.trackingId || "")
      setEstimatedDelivery(
        initialOrder.estimatedDelivery
          ? new Date(initialOrder.estimatedDelivery).toISOString().split("T")[0]
          : ""
      )
      setSellerComments(initialOrder.sellerComments || "")
    }
  }, [initialOrder])

  useEffect(() => {
    if (isOpen && order && !selectedTotals.hasPaymentCharges && selectedTotals.isCOD) {
      paymentMethodChargeAPI.getAll().then(res => {
        const codConfig = res.find(c => c.paymentMethod === 'Cash on Delivery' && c.isActive);
        if (codConfig && codConfig.charges) {
          setFallbackDynamicCharges(codConfig.charges);
        }
      }).catch(err => {
        console.error("Error fetching fallback payment charges:", err);
      });
    }
  }, [isOpen, order, selectedTotals.hasPaymentCharges, selectedTotals.isCOD])

  const handlePrint = useReactToPrint({
    contentRef: printComponentRef,
    documentTitle: `Invoice-${order?._id?.slice(-6) || 'N/A'}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 0.5in;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `,
  })

  if (!isOpen || !order) return null

  const formatPrice = (price) => {
    return formatOrderPrice(price, order)
  }

  const formatDate = (date) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleString()
  }

  const selectedBaseSubtotal = computeBaseSubtotal(order.orderItems || [])
  const selectedBaseDiscount = deriveBaseDiscount(selectedBaseSubtotal, selectedTotals.subtotal)

  // Calculate total discount (manual or coupon)
  const totalDiscountAmount = selectedTotals.couponDiscount + selectedTotals.manualDiscount
  const couponCodeLabel = selectedTotals.couponCode || order.couponCode || ""
  const showCouponDetail = totalDiscountAmount > 0



  const getToken = () => localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")

  const handleUpdateStatus = async (status) => {
    try {
      setProcessingAction(true)
      const token = getToken()
      // Saving the status is not in question here; the email is.
      const updateData = { status, sendCustomerEmail: await askToEmailCustomer(status, order) }

      if (status === "Delivered") {
        updateData.isPaid = true
        updateData.paidAt = new Date().toISOString()
      }

      const { data } = await axios.put(`${config.API_URL}/api/admin/orders/${order._id}/status`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const updatedOrder = { ...order, ...updateData }
      setOrder(updatedOrder)
      if (onUpdate) onUpdate(updatedOrder)
      setError(null)
    } catch (error) {
      console.error("Error updating status:", error)
      alert("Failed to update order status: " + (error.response?.data?.message || error.message))
    } finally {
      setProcessingAction(false)
    }
  }

  const handleUpdatePaymentStatus = async (isPaid) => {
    try {
      setProcessingAction(true)
      const token = getToken()

      const updateData = {
        isPaid,
        paidAt: isPaid ? new Date().toISOString() : null,
      }

      await axios.put(`${config.API_URL}/api/admin/orders/${order._id}/status`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const updatedOrder = { ...order, ...updateData }
      setOrder(updatedOrder)
      if (onUpdate) onUpdate(updatedOrder)
      setError(null)
    } catch (error) {
      console.error("Error updating payment status:", error)
      alert("Failed to update payment status: " + (error.response?.data?.message || error.message))
    } finally {
      setProcessingAction(false)
    }
  }

  const handleSaveOrderDetails = async () => {
    try {
      setProcessingAction(true)
      const token = getToken()

      const updateData = {
        trackingId,
        estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery).toISOString() : null,
        sellerComments,
      }

      await axios.put(`${config.API_URL}/api/admin/orders/${order._id}/details`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const updatedOrder = { ...order, ...updateData }
      setOrder(updatedOrder)
      if (onUpdate) onUpdate(updatedOrder)
      alert("Order details updated successfully!")
      setError(null)
    } catch (error) {
      console.error("Error updating order details:", error)
      alert("Failed to update order details: " + (error.response?.data?.message || error.message))
    } finally {
      setProcessingAction(false)
    }
  }

  const handleSendNotification = (orderId) => {
    setNotificationOrderId(orderId)
    setNotificationMessage(order.sellerMessage || "")
    setShowNotificationModal(true)
  }

  const handleConfirmSendNotification = async () => {
    try {
      setProcessingAction(true)
      const token = getToken()

      await axios.post(
        `${config.API_URL}/api/admin/orders/${notificationOrderId}/notify`,
        { sellerMessage: notificationMessage },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )

      if (notificationMessage) {
        const updatedOrder = { ...order, sellerMessage: notificationMessage }
        setOrder(updatedOrder)
        if (onUpdate) onUpdate(updatedOrder)
      }

      setShowNotificationModal(false)
      setNotificationMessage("")
      setNotificationOrderId(null)
      alert("Notification email sent successfully!")
    } catch (error) {
      console.error("Error sending notification:", error)
      alert("Failed to send notification: " + (error.response?.data?.message || error.message))
    } finally {
      setProcessingAction(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
            <div>
              <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                <span>Dashboard</span>
                <span>/</span>
                <span>{isQuotation ? "Quotations" : "Orders"}</span>
                <span>/</span>
                <span className="text-lime-600">View</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{isQuotation ? "Quotation" : "Order"} ID: {order._id.slice(-6)}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6">
            {/* Order Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-lime-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Package className="text-lime-600" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">{isQuotation ? "Quotation Status" : "Status"}</p>
                    <p className="font-semibold text-lime-900">
                      {isQuotation ? (order.quotationStatus || "Draft") : (order.status || "New")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CreditCard className="text-green-600" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Payment Method</p>
                    <p className={`font-semibold px-2 py-0.5 rounded-full text-xs inline-block ${getPaymentMethodBadgeColor(order)}`}>
                      {getPaymentMethodDisplay(order)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <MapPin className="text-purple-600" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Payment Status</p>
                    <p className={`font-semibold px-2 py-0.5 rounded-full text-xs inline-block ${order.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {order.isPaid ? "Paid" : "Unpaid"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <User className="text-gray-600" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Created At</p>
                    <p className="font-semibold text-gray-900 text-sm">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Update Section */}
            {/* Status Update / Quotation Actions Section */}
            {isQuotation ? (
              <div className="bg-white border rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quotation Actions</h3>
                {order.quotationStatus !== "Converted" ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="px-3 py-1 text-sm font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Draft Quotation
                      </span>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sendEmailOnConvert}
                          onChange={(e) => setSendEmailOnConvert(e.target.checked)}
                          className="rounded border-gray-300 text-lime-600 focus:ring-lime-500"
                        />
                        <span className="flex items-center gap-1">
                          <Mail size={14} /> Send order email on conversion
                        </span>
                      </label>
                    </div>
                    <button
                      onClick={convertQuotation}
                      disabled={sendingConvert}
                      className="inline-flex items-center gap-2 bg-lime-600 hover:bg-lime-700 text-white px-4 py-2 rounded font-medium disabled:opacity-60 transition-colors"
                    >
                      <RefreshCw size={16} className={sendingConvert ? "animate-spin" : ""} />
                      {sendingConvert ? "Converting..." : "Convert to Order"}
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-green-700 bg-green-50 px-4 py-3 rounded-lg border border-green-200">
                    ✓ This quotation has been converted to <strong>Order #{order.convertedOrderId?._id?.slice?.(-6) || order.convertedOrderId?.slice?.(-6) || "-"}</strong>.
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Order Status</h3>
                <div className="flex items-center space-x-4">
                  <select
                    value={order.status || "New"}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                    disabled={processingAction}
                  >
                    {orderStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`px-3 py-1 text-sm font-medium rounded-full ${
                      order.status === "Processing"
                        ? "bg-yellow-100 text-yellow-800"
                        : order.status === "Confirmed"
                          ? "bg-lime-100 text-lime-800"
                          : order.status === "Shipped"
                            ? "bg-purple-100 text-purple-800"
                            : order.status === "Out for Delivery"
                              ? "bg-indigo-100 text-indigo-800"
                              : order.status === "Delivered"
                                ? "bg-green-100 text-green-800"
                                : order.status === "Cancelled"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {order.status || "New"}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Update Payment Status</h4>
                  <div className="flex items-center space-x-4">
                    <select
                      value={order.isPaid ? "Paid" : "Unpaid"}
                      onChange={(e) => handleUpdatePaymentStatus(e.target.value === "Paid")}
                      className="border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={processingAction}
                    >
                      <option value="Unpaid">Unpaid</option>
                      <option value="Paid">Paid</option>
                    </select>
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded-full ${
                        order.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {order.isPaid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Order Items */}
            <div className="bg-white border rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
              <div className="space-y-4">
                {order.orderItems?.filter(item => !item.isProtection && !item.protectionData && !item.protectionFor).map((item, index) => {
                  const basePrice = resolveOrderItemBasePrice(item)
                  const salePrice = Number(item.price) || basePrice
                  // On a quotation the price the admin typed IS the price; there is no
                  // catalogue "was" behind it, so no struck-through figure is shown.
                  const showDiscount = !isQuotation && basePrice > salePrice
                  const lineTotal = salePrice * (item.quantity || 0)
                  const baseTotal = basePrice * (item.quantity || 0)

                  return (
                    <div
                      key={item._id || index}
                      className="flex items-center justify-between py-3 border-b last:border-b-0"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-15 h-15 bg-gray-200 rounded-md flex items-center justify-center p-2">
                          <Package size={24} className="text-gray-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          {item.selectedColorData && (
                            <p className="text-xs text-purple-600 font-medium mt-1 flex items-center">
                              <span className="inline-block w-3 h-3 rounded-full mr-1 border border-gray-300" style={{backgroundColor: item.selectedColorData.color?.toLowerCase() || '#9333ea'}}></span>
                              Color: {item.selectedColorData.color}
                            </p>
                          )}
                          {item.selectedDosData && (
                            <p className="text-xs text-blue-600 font-medium mt-1 flex items-center">
                              💻 OS: {item.selectedDosData.dosType}
                            </p>
                          )}
                          <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {showDiscount && (
                          <p className="text-xs text-gray-400 line-through">{formatPrice(basePrice)}</p>
                        )}
                        <p className="font-semibold text-gray-900">{formatPrice(salePrice)}</p>
                        {showDiscount && (
                          <p className="text-xs text-gray-400 line-through">{formatPrice(baseTotal)}</p>
                        )}
                        <p className="text-sm text-gray-500">Total: {formatPrice(lineTotal)}</p>
                      </div>
                    </div>
                  )
                }) || <p className="text-gray-500 text-center py-4">No items found</p>}
              </div>
            </div>

            {/* Protection Plans Section */}
            {order.orderItems?.some(item => item.isProtection || item.protectionData || item.protectionFor) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <Shield size={20} className="text-blue-600" />
                  Protection Plans
                </h3>
                <div className="space-y-4">
                  {order.orderItems?.filter(item => item.isProtection || item.protectionData || item.protectionFor).map((item, index) => {
                    const itemPrice = Number(item.price) || 0
                    const lineTotal = itemPrice * (item.quantity || 0)

                    return (
                      <div
                        key={item._id || index}
                        className="flex items-center justify-between py-3 border-b last:border-b-0 border-blue-200"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-15 h-15 bg-blue-200 rounded-md flex items-center justify-center p-2">
                            <Shield size={24} className="text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{item.name}</h4>
                            <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{formatPrice(itemPrice)}</p>
                          <p className="text-sm text-gray-500">Total: {formatPrice(lineTotal)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Total Amount */}
            <div className="bg-gray-50 border rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Amount</h3>
              <div className="space-y-2">
                {!isQuotation && selectedBaseSubtotal > selectedTotals.subtotal && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Price:</span>
                    <span className="text-gray-400 line-through">{formatPrice(selectedBaseSubtotal)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">{formatPrice(selectedTotals.subtotal)}</span>
                </div>
                {!(selectedTotals.shipping === 0 && (
                  (selectedTotals.hasPaymentCharges && selectedTotals.paymentCharges.some(c => c.name?.toLowerCase().includes('shipping'))) ||
                  (!selectedTotals.hasPaymentCharges && fallbackDynamicCharges.some(c => c.name?.toLowerCase().includes('shipping'))) ||
                  (!selectedTotals.hasPaymentCharges && fallbackDynamicCharges.length === 0 && selectedTotals.isCOD && selectedTotals.codShippingFee > 0)
                )) && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping:</span>
                    <span className="text-gray-900">{selectedTotals.shipping === 0 ? "Free" : formatPrice(selectedTotals.shipping)}</span>
                  </div>
                )}
                {selectedTotals.hasPaymentCharges ? (
                  selectedTotals.paymentCharges.map((charge, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-700 text-sm">💰 {charge.name}:</span>
                      <span className="text-gray-700 text-sm">{formatPrice(charge.amount)}</span>
                    </div>
                  ))
                ) : fallbackDynamicCharges.length > 0 ? (
                  fallbackDynamicCharges.map((charge, index) => (
                    <div key={`fallback-${index}`} className="flex justify-between">
                      <span className="text-gray-700 text-sm">💰 {charge.name}:</span>
                      <span className="text-gray-700 text-sm">{formatPrice(charge.amount)}</span>
                    </div>
                  ))
                ) : (
                  <>
                    {selectedTotals.isCOD && selectedTotals.codFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-yellow-700 text-sm">💰 COD Handling Fee (Non-Refundable):</span>
                        <span className="text-yellow-700 text-sm">{formatPrice(selectedTotals.codFee)}</span>
                      </div>
                    )}
                    {selectedTotals.isCOD && selectedTotals.codShippingFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-yellow-700 text-sm">🚚 COD Shipping Fee:</span>
                        <span className="text-yellow-700 text-sm">{formatPrice(selectedTotals.codShippingFee)}</span>
                      </div>
                    )}
                  </>
                )}
                {selectedTotals.referralDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {order.referralRewardRole === "referee" ? "Referral welcome discount" : "Referral reward"}
                      {Number(order.referralDiscountValue) > 0 && (
                        <span className="ml-1 text-xs text-gray-500">
                          ({order.referralDiscountType === "fixed" ? `Rs ${Number(order.referralDiscountValue).toFixed(2)} off` : `${order.referralDiscountValue}% off`})
                        </span>
                      )}
                      :
                    </span>
                    <span className="text-green-600">-{formatPrice(selectedTotals.referralDiscount)}</span>
                  </div>
                )}
                {selectedTotals.loyaltyDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      Grabian Points applied
                      {Number(order.loyaltyPointsRedeemed) > 0 && (
                        <span className="ml-1 text-xs text-gray-500">({Number(order.loyaltyPointsRedeemed).toLocaleString()} points)</span>
                      )}
                      :
                    </span>
                    <span className="text-green-600">-{formatPrice(selectedTotals.loyaltyDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">VAT (Included):</span>
                  <span className="text-gray-900">{formatPrice(selectedTotals.tax)}</span>
                </div>
                {selectedBaseDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Offer Discount:</span>
                    <span className="text-green-600">-{formatPrice(selectedBaseDiscount)}</span>
                  </div>
                )}
                {showCouponDetail && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 -mx-1">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium text-green-800">Coupon Applied</span>
                        {couponCodeLabel && (
                          <div className="text-xs text-green-600 mt-0.5">Code: <span className="font-semibold">{couponCodeLabel}</span></div>
                        )}
                      </div>
                      <span className="text-lg font-bold text-green-700">-{formatPrice(totalDiscountAmount)}</span>
                    </div>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-lg font-bold text-lime-600">
                    {formatPrice(selectedTotals.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Shipping Address */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipping / Pickup Address</h3>
                <div className="space-y-2">
                  {order.shippingAddress ? (
                    <>
                      <p>
                        <span className="font-medium">Name:</span> {order.shippingAddress.name || "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">Email:</span> {order.shippingAddress.email || "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">Phone:</span> {order.shippingAddress.phone || "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">Address:</span>{" "}
                        {order.shippingAddress.address || "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">City:</span> {order.shippingAddress.city || "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">State:</span> {order.shippingAddress.state || "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">Zip Code:</span>{" "}
                        {order.shippingAddress.zipCode || "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">Country:</span>{" "}
                        {getOrderCountryName(order)}
                      </p>
                    </>
                  ) : order.pickupDetails ? (
                    <>
                      {/* The customer comes first -- a collection has no
                          shippingAddress, so this block was showing the branch and
                          nothing about who the order is for. */}
                      <p>
                        <span className="font-medium">Name:</span> {orderCustomerName(order) || "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">Email:</span> {orderCustomerEmail(order) || "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">Phone:</span> {orderCustomerPhone(order) || "N/A"}
                      </p>
                      <div className="mt-3 rounded-lg bg-lime-50 p-3 ring-1 ring-lime-200">
                        <p className="text-xs font-semibold uppercase tracking-wide text-lime-800">
                          Collecting from
                        </p>
                        <p className="mt-1 font-medium text-gray-900">{orderPickupStore(order).name || "N/A"}</p>
                        {orderPickupStore(order).address && (
                          <p className="mt-0.5 text-sm text-gray-600">{orderPickupStore(order).address}</p>
                        )}
                        {orderPickupStore(order).phone && (
                          <p className="mt-0.5 text-sm text-gray-600">
                            Branch phone: {orderPickupStore(order).phone}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p>N/A</p>
                  )}
                </div>
              </div>

              {/* Billing Address */}
              <div className="bg-white border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Address</h3>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Name:</span>{" "}
                    {order.billingAddress?.name || order.shippingAddress?.name || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span>{" "}
                    {order.billingAddress?.email || order.shippingAddress?.email || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Phone:</span>{" "}
                    {order.billingAddress?.phone || order.shippingAddress?.phone || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Address:</span>{" "}
                    {order.billingAddress?.address || order.shippingAddress?.address || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">City:</span>{" "}
                    {order.billingAddress?.city || order.shippingAddress?.city || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">State:</span>{" "}
                    {order.billingAddress?.state || order.shippingAddress?.state || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Zip Code:</span>{" "}
                    {order.billingAddress?.zipCode || order.shippingAddress?.zipCode || "N/A"}
                  </p>
                  <p>
                    <span className="font-medium">Country:</span>{" "}
                    {getOrderCountryName(order)}
                  </p>
                </div>
              </div>
            </div>

            {/* Additional Information with Editable Fields */}
            <div className="bg-white border rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="mb-2">
                      <span className="font-medium">Payment Method:</span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getPaymentMethodBadgeColor(order)}`}>
                        {getPaymentMethodDisplay(order)}
                      </span>
                    </p>
                    <p className="mb-2">
                      <span className="font-medium">Payment Status:</span>
                      <span
                        className={`ml-2 px-2 py-1 text-xs rounded-full ${order.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                      >
                        {order.isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </p>
                    {order.paidAt && (
                      <p>
                        <span className="font-medium">Paid At:</span> {formatDate(order.paidAt)}
                      </p>
                    )}
                  </div>

                  {!isQuotation && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tracking ID</label>
                      <input
                        type="text"
                        value={trackingId}
                        onChange={(e) => setTrackingId(e.target.value)}
                        placeholder="Enter tracking ID"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {!isQuotation && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Delivery</label>
                      <input
                        type="date"
                        value={estimatedDelivery}
                        onChange={(e) => setEstimatedDelivery(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              </div>

              {showCouponDetail && (
                <div className="mt-4 bg-lime-50 border border-lime-200 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-lime-700">{couponCodeLabel ? "Coupon Details" : "Discount Details"}</p>
                  {couponCodeLabel && (
                    <div className="flex justify-between text-sm text-gray-700">
                      <span>Code:</span>
                      <span className="font-semibold text-gray-900">{couponCodeLabel}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-gray-700">
                    <span>Discount Amount:</span>
                    <span className="font-semibold text-green-600">-{formatPrice(totalDiscountAmount)}</span>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Notes</label>
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md min-h-[48px]">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {order.customerNotes || order.notes || "N/A"}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Seller Comments</label>
                <textarea
                  value={sellerComments}
                  onChange={(e) => setSellerComments(e.target.value)}
                  placeholder="Add seller comments here..."
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
                />
              </div>

              <div className="mt-4">
                <button
                  onClick={handleSaveOrderDetails}
                  disabled={processingAction}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md transition-colors"
                >
                  <Save size={16} />
                  <span>{processingAction ? "Saving..." : "Save Details"}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
              <button
                onClick={onClose}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-6 rounded-md transition-colors"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-md flex items-center transition-colors"
              >
                <Printer size={18} className="mr-2" />
                {isQuotation ? "Print Quotation" : "Print Receipt"}
              </button>
              {!isQuotation && (
                <button
                  onClick={() => handleSendNotification(order._id)}
                  className="bg-lime-600 hover:bg-lime-700 text-white font-medium py-2 px-6 rounded-md flex items-center transition-colors"
                  disabled={processingAction}
                >
                  <Mail size={18} className="mr-2" />
                  Send Notification
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Invoice Component for Printing */}
      <div style={{ display: "none" }}>
        {/* A quotation and the wholesale order raised from it are the same trade
            document at two stages, so both print on the trade template. A storefront
            order keeps the retail invoice. */}
        {isQuotation || order.sourceQuotationId ? (
          <QuotationInvoiceComponent
            order={order}
            ref={printComponentRef}
            /* Boolean(), not the raw prop: the Orders screen passes nothing, and an
               undefined here would fall through to the component's `= true` default
               and print a wholesale order as a quotation. */
            isQuotation={Boolean(isQuotation)}
          />
        ) : (
          <InvoiceComponent order={order} ref={printComponentRef} />
        )}
      </div>

      {/* Notification Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Mail size={20} className="mr-2 text-green-600" />
                Send Notification Email
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seller Message <span className="text-xs text-gray-500">(Optional)</span>
                </label>
                <textarea
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  placeholder="Enter a message to include in the notification email..."
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This message will be displayed in the customer's notification email. Leave empty to send without a message.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowNotificationModal(false)
                  setNotificationMessage("")
                  setNotificationOrderId(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                disabled={processingAction}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSendNotification}
                disabled={processingAction}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center transition-colors disabled:bg-gray-400"
              >
                {processingAction ? (
                  <>
                    <RefreshCw size={16} className="mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={16} className="mr-2" />
                    Send Notification
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default AdminOrderDetailsModal
