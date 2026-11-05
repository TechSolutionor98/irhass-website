"use client"

import { useState, useEffect } from "react"
import AdminOrderDetailsModal from "../../components/admin/AdminOrderDetailsModal";
import axios from "axios"
import AdminSidebar from "../../components/admin/AdminSidebar"
import { Search, Eye, Mail, ChevronDown, RefreshCw } from "lucide-react"
import { getFullImageUrl } from "../../utils/imageUtils"
import { getPaymentMethodDisplay, getPaymentMethodBadgeColor, getPaymentInfo, getOrderCountryName, formatOrderPrice } from "../../utils/paymentUtils"
import { getInvoiceBreakdown } from "../../utils/invoiceBreakdown"
import { resolveOrderItemSalePrice } from "../../utils/orderPricing"
import { useLocation } from "react-router-dom"

import config from "../../config/config"
import { askToEmailCustomer } from "../../utils/customerEmail"
const AdminOrders = () => {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [processingAction, setProcessingAction] = useState(false)
  const [filterStatus, setFilterStatus] = useState("all")
  const [showStatusDropdown, setShowStatusDropdown] = useState({})
  const [showPaymentDropdown, setShowPaymentDropdown] = useState({})
  const location = useLocation()
  const [focusOrderId, setFocusOrderId] = useState(location.state?.orderId || null)

  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "New", label: "New" },
    { value: "Processing", label: "Processing" },
    { value: "Confirmed", label: "Confirmed" },
    { value: "Ready For Shipment", label: "Ready For Shipment" },
    { value: "Shipped", label: "Shipped" },
    { value: "On the Way", label: "On the Way" },
    { value: "Out for Delivery", label: "Out for Delivery" },
    { value: "Delivered", label: "Delivered" },
    { value: "On Hold", label: "On Hold" },
    { value: "Cancelled", label: "Cancelled" }
  ]

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
    return formatOrderPrice(price, orderObj)
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const token =
        localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")
      const { data } = await axios.get(`${config.API_URL}/api/admin/orders`, {
        params: { includeDeleted: false },
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const dateWiseOrders = [...data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setOrders(dateWiseOrders)
      setLoading(false)
    } catch (error) {
      setError("Failed to load orders. Please try again later.")
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!focusOrderId || orders.length === 0) return
    const match = orders.find((order) => order._id === focusOrderId)
    if (match) {
      setSelectedOrder(match)
    }
    setFocusOrderId(null)
  }, [orders, focusOrderId])

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
  }

  const handleCloseModal = () => {
    setSelectedOrder(null)
  }

  const handleUpdateStatus = async (orderId, status) => {
    try {
      setProcessingAction(true)
      const token = localStorage.getItem('adminToken')
      // The status change is saved either way; this only decides whether the
      // customer hears about it.
      const targetOrder = orders.find((order) => order._id === orderId)
      const sendCustomerEmail = await askToEmailCustomer(status, targetOrder)
      await axios.put(`${config.API_URL}/api/admin/orders/${orderId}/status`, { status, sendCustomerEmail }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      setOrders(orders.map((order) => (order._id === orderId ? { ...order, status } : order)))

      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder({ ...selectedOrder, status })
      }

      setShowStatusDropdown({})
      setProcessingAction(false)
    } catch (error) {
      setError("Failed to update order status. Please try again.")
      setProcessingAction(false)
    }
  }

  const handleUpdatePaymentStatus = async (orderId, isPaid) => {
    try {
      setProcessingAction(true)
      const token = localStorage.getItem('adminToken')
      await axios.put(`${config.API_URL}/api/admin/orders/${orderId}/payment`, { isPaid }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      setOrders(orders.map((order) => (order._id === orderId ? { ...order, isPaid } : order)))

      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder({ ...selectedOrder, isPaid })
      }

      setShowPaymentDropdown({})
      setProcessingAction(false)
    } catch (error) {
      setError("Failed to update payment status. Please try again.")
      setProcessingAction(false)
    }
  }

  const handleUpdateTracking = async (orderId, trackingId) => {
    try {
      setProcessingAction(true)
      const token = localStorage.getItem('adminToken')
      const trackedOrder = orders.find((order) => order._id === orderId)
      const sendCustomerEmail = await askToEmailCustomer(`Tracking number ${trackingId}`, trackedOrder)
      await axios.put(`${config.API_URL}/api/admin/orders/${orderId}/tracking`, { trackingId, sendCustomerEmail }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      setOrders(orders.map((order) => (order._id === orderId ? { ...order, trackingId } : order)))

      if (selectedOrder && selectedOrder._id === orderId) {
        setSelectedOrder({ ...selectedOrder, trackingId })
      }

      setProcessingAction(false)
    } catch (error) {
      setError("Failed to update tracking ID. Please try again.")
      setProcessingAction(false)
    }
  }

  const handleSendNotification = async (orderId) => {
    try {
      setProcessingAction(true)
      const token = localStorage.getItem('adminToken')
      await axios.post(`${config.API_URL}/api/admin/orders/${orderId}/notify`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      setProcessingAction(false)
      alert("Notification email sent successfully!")
    } catch (error) {
      setError("Failed to send notification. Please try again.")
      setProcessingAction(false)
    }
  }

  const handleFilterUpdate = () => {
    fetchOrders()
  }

  const filteredOrders = orders.filter((order) => {
    if (order.status === "Deleted") return false

    const matchesSearch =
      order._id.includes(searchTerm) ||
      order.shippingAddress.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.shippingAddress.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = filterStatus === "all" || order.status === filterStatus

    return matchesSearch && matchesStatus
  })

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowStatusDropdown({})
      setShowPaymentDropdown({})
    }

    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  const bounceStyle = {
    animation: 'bounce 1s infinite',
  }

  const bounceKeyframes = `
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-30px); }
  }
  `
  if (typeof document !== 'undefined' && !document.getElementById('bounce-keyframes')) {
    const style = document.createElement('style')
    style.id = 'bounce-keyframes'
    style.innerHTML = bounceKeyframes
    document.head.appendChild(style)
  }

  const selectedTotals = getInvoiceBreakdown(selectedOrder || {})

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="ml-64 p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <button
            onClick={fetchOrders}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            <RefreshCw size={18} />
            <span>Refresh</span>
          </button>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-md">{error}</div>}

        {/* Filter Section - This is the dropdown section you requested */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[200px]"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none"
                  size={16}
                />
              </div>
              <button
                onClick={handleFilterUpdate}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
              >
                Update
              </button>
            </div>
            <div className="text-gray-600 font-medium">Total Orders: {filteredOrders.length}</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search orders by ID, customer name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full md:w-96 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <img src="/logo.png" alt="Loading..." style={{ width: 48, height: 48, ...bounceStyle }} />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm" style={{ overflow: 'visible' }}>
            <div className="overflow-x-auto" style={{ overflow: 'visible' }}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                    <tr key={order._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">#{order._id.slice(-6)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {order.deliveryType === "home"
                            ? order.shippingAddress?.name || order.user?.name || "N/A"
                            : order.user?.name || "N/A"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.deliveryType === "home"
                            ? order.shippingAddress?.email || order.user?.email || "N/A"
                            : order.user?.email || "N/A"}
                        </div>
                        <div className="mt-1">
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 uppercase">
                            📍 {getOrderCountryName(order)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(order.createdAt).toLocaleDateString()}</div>
                      </td>
                      {/* Clickable Status Column */}
                      <td className="px-6 py-4 whitespace-nowrap relative">
                        <div className="relative inline-block w-full text-left">
                          <button
                            className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full hover:opacity-80 transition-opacity
                            ${
                              order.status === "Processing"
                                ? "bg-yellow-100 text-yellow-800"
                                : order.status === "Confirmed"
                                  ? "bg-blue-100 text-blue-800"
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
                      {/* Clickable Payment Status Column */}
                      <td className="px-6 py-4 whitespace-nowrap" style={{ overflow: 'visible' }}>
                        <div className="flex flex-col gap-1" style={{ position: 'relative' }}>
                          {/* Payment Method Badge */}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPaymentMethodBadgeColor(order)}`}>
                            {getPaymentMethodDisplay(order)}
                          </span>
                          {/* Payment Status Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              togglePaymentDropdown(order._id)
                            }}
                            className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full cursor-pointer hover:opacity-80 transition-opacity
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
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => handleSendNotification(order._id)}
                          className="text-green-600 hover:text-green-900"
                          disabled={processingAction}
                        >
                          <Mail size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

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
  )
}

export default AdminOrders
