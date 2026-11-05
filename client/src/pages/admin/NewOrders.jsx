"use client"

import { useState, useEffect, useRef, forwardRef } from "react"
import axios from "axios"
import { useReactToPrint } from "react-to-print"
import AdminOrderDetailsModal from "../../components/admin/AdminOrderDetailsModal"
import AdminSidebar from "../../components/admin/AdminSidebar"
import {
  Search,
  Eye,
  Mail,
  ChevronDown,
  RefreshCw,
  X,
  Package,
  CreditCard,
  MapPin,
  User,
  Printer,
  Save,
  Shield,
} from "lucide-react"
import { useLocation } from "react-router-dom"

import config from "../../config/config"
import { getInvoiceBreakdown } from "../../utils/invoiceBreakdown"
import { resolveOrderItemBasePrice, computeBaseSubtotal, deriveBaseDiscount } from "../../utils/orderPricing"
import { getPaymentMethodDisplay, getPaymentMethodBadgeColor, getPaymentInfo, getOrderCountryName, formatOrderPrice } from "../../utils/paymentUtils"
import { askToEmailCustomer, askToEmailCustomerBulk } from "../../utils/customerEmail"

const NewOrders = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [processingAction, setProcessingAction] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState({})
  const [showPaymentDropdown, setShowPaymentDropdown] = useState({})
  const location = useLocation()
  const [focusOrderId, setFocusOrderId] = useState(location.state?.orderId || null)

  // Bulk selection states
  const [selectedOrders, setSelectedOrders] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [bulkStatus, setBulkStatus] = useState("")
  const [showBulkActions, setShowBulkActions] = useState(false)

  // Notes and tracking states
            
  // Notification modal states
      
  // Print ref
  
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
    "Deleted"
  ]
  
  const paymentStatusOptions = ["Paid", "Unpaid"]

  const formatPrice = (price, orderObj) => {
    return formatOrderPrice(price, orderObj || selectedOrder)
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleString()
  }

  const selectedBaseSubtotal = computeBaseSubtotal(selectedOrder?.orderItems || [])
  const selectedTotals = getInvoiceBreakdown(selectedOrder || {})
  const selectedBaseDiscount = deriveBaseDiscount(selectedBaseSubtotal, selectedTotals.subtotal)
  
  // Calculate total discount (manual or coupon)
  const totalDiscountAmount = selectedTotals.couponDiscount + selectedTotals.manualDiscount
  const couponCodeLabel = selectedTotals.couponCode || selectedOrder?.couponCode || ""
  const showCouponDetail = totalDiscountAmount > 0

  // Print handler
  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")

      if (!token) {
        setError("Authentication token not found. Please login again.")
        return
      }

      const { data } = await axios.get(`${config.API_URL}/api/admin/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const newOrders = data.filter((order) => !order.status || order.status === "New" || order.status === "Pending")

      setOrders(newOrders)
      if (focusOrderId) {
        const match = newOrders.find((order) => order._id === focusOrderId)
        if (match) {
          // AdminOrderDetailsModal fills its own notes, tracking, delivery and
          // seller fields from the order it receives.
          setSelectedOrder(match)
        }
        setFocusOrderId(null)
      }
      setError(null)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching orders:", error)
      setError("Failed to load orders. Please try again later.")
      setLoading(false)
    }
  }

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
  }

  const handleUpdateStatus = async (orderId, status) => {
    try {
      setProcessingAction(true)
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")

      // The status change is saved either way; this only decides whether the
      // customer hears about it.
      const targetOrder = orders.find((order) => order._id === orderId)
      const updateData = { status, sendCustomerEmail: await askToEmailCustomer(status, targetOrder) }

      // If status is "Delivered", automatically set payment as paid
      if (status === "Delivered") {
        updateData.isPaid = true
        updateData.paidAt = new Date().toISOString()
      }

      await axios.put(`${config.API_URL}/api/admin/orders/${orderId}/status`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      const updatedOrder = { ...orders.find((order) => order._id === orderId), ...updateData }
      setOrders(orders.map((order) => (order._id === orderId ? updatedOrder : order)))

      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder({ ...selectedOrder, ...updateData })
      }

      setShowStatusDropdown({})
      setError(null)
      setProcessingAction(false)
    } catch (error) {
      console.error("Error updating status:", error)
      setError("Failed to update order status: " + (error.response?.data?.message || error.message))
      setProcessingAction(false)
    }
  }

  const handleUpdatePaymentStatus = async (orderId, isPaid) => {
    try {
      setProcessingAction(true)
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")

      // Simplified payload structure
      const updateData = {
        isPaid: isPaid,
        ...(isPaid && { paidAt: new Date().toISOString() }),
        ...(!isPaid && { paidAt: null }),
      }

      console.log("Updating payment status with data:", updateData) // Debug log

      const response = await axios.put(`${config.API_URL}/api/admin/orders/${orderId}`, updateData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      console.log("Payment update response:", response.data) // Debug log

      // Update local state with the response data
      const updatedOrderData = {
        ...updateData,
        paidAt: isPaid ? new Date() : null,
      }

      setOrders(orders.map((order) => (order._id === orderId ? { ...order, ...updatedOrderData } : order)))

      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder({ ...selectedOrder, ...updatedOrderData })
      }

      setShowPaymentDropdown({})
      setError(null)
      setProcessingAction(false)
    } catch (error) {
      console.error("Error updating payment status:", error)
      console.error("Error details:", error.response?.data) // More detailed error logging
      setError("Failed to update payment status: " + (error.response?.data?.message || error.message))
      setProcessingAction(false)
    }
  }

  const handleSendNotification = (orderId) => {
    // The notification composer lives in AdminOrderDetailsModal, which owns the
    // seller message state. Open the order there rather than duplicating it here.
    const order = orders.find((o) => o._id === orderId) || selectedOrder
    if (order) {
      handleViewOrder(order)
    }
  }

  // Bulk selection functions
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedOrders([])
      setSelectAll(false)
    } else {
      setSelectedOrders(filteredOrders.map((order) => order._id))
      setSelectAll(true)
    }
  }

  const handleSelectOrder = (orderId) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter((id) => id !== orderId))
      setSelectAll(false)
    } else {
      const newSelected = [...selectedOrders, orderId]
      setSelectedOrders(newSelected)
      if (newSelected.length === filteredOrders.length) {
        setSelectAll(true)
      }
    }
  }

  const handleBulkStatusUpdate = async () => {
    if (selectedOrders.length === 0 || !bulkStatus) {
      alert("Please select orders and choose a status")
      return
    }

    try {
      setProcessingAction(true)
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")

      // Asked once for the whole batch rather than once per order, so a bulk
      // update of fifty orders is one question, not fifty.
      const notifyBulk = await askToEmailCustomerBulk(bulkStatus, selectedOrders.length)

      await Promise.all(
        selectedOrders.map((orderId) =>
          axios.put(
            `${config.API_URL}/api/admin/orders/${orderId}/status`,
            { status: bulkStatus, sendCustomerEmail: notifyBulk },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          ),
        ),
      )

      setOrders(orders.map((order) => (selectedOrders.includes(order._id) ? { ...order, status: bulkStatus } : order)))

      setSelectedOrders([])
      setSelectAll(false)
      setBulkStatus("")
      setShowBulkActions(false)
      setProcessingAction(false)

      alert(`Successfully updated ${selectedOrders.length} orders to ${bulkStatus}`)
    } catch (error) {
      console.error("Error updating bulk status:", error)
      setError("Failed to update orders: " + (error.response?.data?.message || error.message))
      setProcessingAction(false)
    }
  }

  const filteredOrders = orders.filter(
    (order) =>
      order._id.includes(searchTerm) ||
      order.shippingAddress?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shippingAddress?.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const toggleStatusDropdown = (orderId) => {
    setShowStatusDropdown((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }))
    setShowPaymentDropdown({})
  }

  const togglePaymentDropdown = (orderId) => {
    setShowPaymentDropdown((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }))
    setShowStatusDropdown({})
  }

  useEffect(() => {
    const handleClickOutside = () => {
      setShowStatusDropdown({})
      setShowPaymentDropdown({})
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  useEffect(() => {
    setShowBulkActions(selectedOrders.length > 0)
  }, [selectedOrders])

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="p-8 ml-64 ">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Orders</h1>
            <p className="text-gray-600 mt-1">All new orders will be displayed here</p>
          </div>
          <button
            onClick={fetchOrders}
            className="flex items-center space-x-2 bg-lime-500 hover:bg-lime-600 text-white px-4 py-2 rounded-md transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-md flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={18} />
            </button>
          </div>
        )}

        {showBulkActions && (
          <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border-l-4 border-lime-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">
                  {selectedOrders.length} order{selectedOrders.length !== 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Change status to:</label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500"
                  >
                    <option value="">Select Status</option>
                    {orderStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkStatusUpdate}
                    disabled={!bulkStatus || processingAction}
                    className="bg-lime-500 hover:bg-lime-600 disabled:bg-gray-400 text-white px-4 py-1 rounded-md text-sm font-medium transition-colors"
                  >
                    {processingAction ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedOrders([])
                  setSelectAll(false)
                  setBulkStatus("")
                }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 flex justify-between items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search orders by ID, customer name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full md:w-96 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            />
          </div>
          <div className="text-sm text-gray-600">
            Total New Orders: <span className="font-semibold text-lime-600">{filteredOrders.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lime-500"></div>
          </div>
        ) : (
          <div className="bg-white  rounded-lg shadow-sm" style={{ overflow: 'visible' }}>
            <div className="overflow-x-auto   " style={{ overflow: 'visible' }}>
              <table className="min-w-full  divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-lime-500 focus:ring-lime-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order._id}
                      className={`hover:bg-gray-50 ${selectedOrders.includes(order._id) ? "bg-lime-50" : ""}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order._id)}
                          onChange={() => handleSelectOrder(order._id)}
                          className="h-4 w-4 text-lime-500 focus:ring-lime-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-lime-600">#{order._id.slice(-6)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {order.deliveryType === "pickup" ? (
                          <>
                            <div className="text-sm text-gray-900">{order.pickupDetails?.location || "N/A"}</div>
                            <div className="text-sm text-gray-500">{order.pickupDetails?.phone || "N/A"}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm text-gray-900">{order.shippingAddress?.name || "N/A"}</div>
                            <div className="text-sm text-gray-500">{order.shippingAddress?.email || "N/A"}</div>
                          </>
                        )}
                        <div className="mt-1">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 uppercase">
                            📍 {getOrderCountryName(order)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(order.createdAt).toLocaleDateString()}</div>
                        <div className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap relative">
                        <div className="relative inline-block w-full text-left">
                          <button
                            className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full hover:opacity-80 transition-opacity
                            ${
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
                            <ChevronDown size={12} className="ml-1" />
                          </button>
                          
                          <select
                            value={order.status || "New"}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleUpdateStatus(order._id, e.target.value)
                            }}
                            disabled={processingAction}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          >
                            {orderStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" style={{ overflow: 'visible' }}>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              togglePaymentDropdown(order._id)
                            }}
                            className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-80 transition-colors
                            ${order.isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                          >
                            {order.isPaid ? "Paid" : "Unpaid"}
                            <ChevronDown size={12} className="ml-1" />
                          </button>

                          {showPaymentDropdown[order._id] && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', width: '128px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 9999 }}>
                              {paymentStatusOptions.map((status) => (
                                <button
                                  key={status}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUpdatePaymentStatus(order._id, status === "Paid")
                                  }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                  disabled={processingAction}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                        {formatOrderPrice(order.totalPrice, order)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewOrder(order)}
                          className="text-lime-600 hover:text-lime-900 mr-4"
                          title="View Order Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleSendNotification(order._id)}
                          className="text-green-600 hover:text-green-900"
                          disabled={processingAction}
                          title="Send Email Notification"
                        >
                          <Mail size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredOrders.length === 0 && !loading && (
              <div className="text-center py-12">
                <div className="text-gray-500 text-lg">No new orders found</div>
                <p className="text-gray-400 mt-2">New orders will appear here when customers place orders</p>
              </div>
            )}
          </div>
        )}

        
        <AdminOrderDetailsModal
          isOpen={!!selectedOrder}
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(updatedOrder) => {
            setOrders(orders.map(o => o._id === updatedOrder._id ? updatedOrder : o));
            if (selectedOrder && selectedOrder._id === updatedOrder._id) {
              setSelectedOrder(updatedOrder);
            }
          }}
        />

      </div>
    </div>
  )
}

export default NewOrders
