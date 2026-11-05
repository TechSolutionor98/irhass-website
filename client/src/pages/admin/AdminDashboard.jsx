"use client"

import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import AdminSidebar from "../../components/admin/AdminSidebar"
import {
  ShoppingBag, Users, Wallet, Package, ArrowUpRight, ArrowDownRight, Minus,
  PackagePlus, ClipboardList, AlertTriangle, PackageX, Clock, Tags, Percent,
} from "lucide-react"
import { adminAPI } from "../../services/api"
import { getOrderCountryName, formatOrderPrice } from "../../utils/paymentUtils"
import { orderCustomerName } from "../../utils/orderCustomer"

/**
 * Percentage change against the previous 30 days.
 * Returns null when there is no prior period to compare against, so the card shows
 * "no prior data" instead of a meaningless +100%.
 */
const trendOf = (current, previous) => {
  if (!previous) return current ? null : 0
  return ((current - previous) / previous) * 100
}

const Trend = ({ value }) => {
  if (value === null) return <span className="text-stone-400">No prior data</span>
  if (Math.abs(value) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-stone-500">
        <Minus className="h-3.5 w-3.5" /> Flat vs last 30 days
      </span>
    )
  }
  const up = value > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value).toFixed(0)}% vs last 30 days
    </span>
  )
}

const AdminDashboard = () => {
  const { admin } = useAuth()
  const [stats, setStats] = useState({
    totalOrders: 0, totalProducts: 0, totalUsers: 0, totalRevenue: 0,
    revenue30d: 0, revenuePrev30d: 0, orders30d: 0, ordersPrev30d: 0,
    newUsers30d: 0, pendingOrders: 0, outOfStock: 0, lowStock: 0,
  })
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Both in flight at once -- these were awaited one after the other, which
        // made the dashboard wait for the sum of the two round trips.
        const [statsData, ordersData] = await Promise.all([
          adminAPI.getDashboardStats(),
          adminAPI.getRecentOrders(),
        ])
        setStats((prev) => ({ ...prev, ...statsData }))
        setRecentOrders(Array.isArray(ordersData) ? ordersData : [])
      } catch {
        setError("Failed to load dashboard data. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <AdminSidebar />
        <div className="ml-64 flex h-screen items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-stone-200 border-t-brand-600" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-50">
        <AdminSidebar />
        <div className="ml-64 p-8">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
        </div>
      </div>
    )
  }

  const cards = [
    {
      label: "Revenue",
      value: formatOrderPrice(stats.totalRevenue),
      icon: Wallet,
      caption: <Trend value={trendOf(stats.revenue30d, stats.revenuePrev30d)} />,
      to: "/admin/orders",
    },
    {
      label: "Orders",
      value: stats.totalOrders,
      icon: ShoppingBag,
      caption: <Trend value={trendOf(stats.orders30d, stats.ordersPrev30d)} />,
      to: "/admin/orders",
    },
    {
      label: "Products",
      value: stats.totalProducts,
      icon: Package,
      caption:
        stats.outOfStock > 0
          ? <span className="font-medium text-rose-600">{stats.outOfStock} out of stock</span>
          : <span className="text-stone-500">All lines in stock</span>,
      to: "/admin/products",
    },
    {
      label: "Customers",
      value: stats.totalUsers,
      icon: Users,
      caption:
        stats.newUsers30d > 0
          ? <span className="font-medium text-emerald-600">+{stats.newUsers30d} in last 30 days</span>
          : <span className="text-stone-500">No sign-ups in 30 days</span>,
      to: "/admin/users",
    },
  ]

  // Only the rows that actually need the admin to do something are shown. When the
  // shop is healthy the whole strip collapses to a single confirmation line, rather
  // than three cards reading "0".
  const attention = [
    {
      show: stats.pendingOrders > 0,
      icon: Clock,
      count: stats.pendingOrders,
      label: stats.pendingOrders === 1 ? "order awaiting action" : "orders awaiting action",
      hint: "New, processing, confirmed or on hold",
      to: "/admin/orders",
      tone: "amber",
    },
    {
      show: stats.outOfStock > 0,
      icon: PackageX,
      count: stats.outOfStock,
      label: stats.outOfStock === 1 ? "product out of stock" : "products out of stock",
      hint: "Live on the shop with nothing to sell",
      to: "/admin/products",
      tone: "rose",
    },
    {
      show: stats.lowStock > 0,
      icon: AlertTriangle,
      count: stats.lowStock,
      label: stats.lowStock === 1 ? "product running low" : "products running low",
      hint: "At or below their restock threshold",
      to: "/admin/products",
      tone: "amber",
    },
  ].filter((a) => a.show)

  const TONES = {
    amber: "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300",
    rose: "border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-300",
  }

  const quickActions = [
    { to: "/admin/products/add", icon: PackagePlus, label: "Add new product" },
    { to: "/admin/products", icon: Package, label: "Manage products" },
    { to: "/admin/categories", icon: Tags, label: "Categories" },
    { to: "/admin/coupons/all", icon: Percent, label: "Coupons" },
    { to: "/admin/users", icon: Users, label: "Customers" },
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <AdminSidebar />

      <div className="ml-64 p-6 lg:p-8" style={{ fontFamily: '"Sora", "Noto Sans Arabic", sans-serif' }}>
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-700">Admin Overview</p>
            <h1 className="mt-1 text-2xl font-semibold text-stone-900 md:text-3xl">
              Welcome back{admin?.name ? `, ${admin.name}` : ""}
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
            >
              <ClipboardList className="h-4 w-4" />
              Review orders
            </Link>
            <Link
              to="/admin/products/add"
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 shadow-sm transition hover:border-brand-500 hover:text-brand-700"
            >
              <PackagePlus className="h-4 w-4" />
              Add product
            </Link>
          </div>
        </div>

        {/* Needs attention */}
        <div className="mt-6">
          {attention.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-5 py-3.5 text-sm text-stone-600">
              Nothing needs attention — no open orders and every active product is in stock.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {attention.map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 transition ${TONES[a.tone]}`}
                >
                  <a.icon className="h-5 w-5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {a.count} {a.label}
                    </p>
                    <p className="truncate text-xs opacity-75">{a.hint}</p>
                  </div>
                  <ArrowUpRight className="ml-auto h-4 w-4 flex-shrink-0 opacity-60" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="group rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-brand-400 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">{card.label}</p>
                <span className="rounded-lg bg-brand-50 p-2 text-brand-700 transition group-hover:bg-brand-100">
                  <card.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-stone-900">{card.value}</p>
              <p className="mt-2 text-xs">{card.caption}</p>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
          {/* Recent orders */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <h2 className="text-base font-semibold text-stone-900">Recent orders</h2>
              <Link to="/admin/orders" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                View all
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <ShoppingBag className="mx-auto h-8 w-8 text-stone-300" />
                <p className="mt-3 text-sm font-medium text-stone-700">No orders yet</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-stone-500">
                  Orders will appear here as soon as the first one is placed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead>
                    <tr className="bg-stone-50">
                      {["Order", "Customer", "Date", "Status", "Total"].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {recentOrders.map((order) => (
                      <tr key={order._id} className="transition hover:bg-stone-50">
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <Link
                            to="/admin/orders"
                            state={{ orderId: order._id }}
                            className="text-sm font-medium text-brand-700 hover:text-brand-800"
                          >
                            #{order._id.slice(-6)}
                          </Link>
                          <div className="text-xs text-stone-500">{order.deliveryType || "standard"}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          {order.deliveryType === "pickup" ? (
                            <>
                              <div className="text-sm text-stone-800">{order.pickupDetails?.location || "N/A"}</div>
                              <div className="text-xs text-stone-500">{order.pickupDetails?.phone || "N/A"}</div>
                            </>
                          ) : (
                            <>
                              <div className="text-sm text-stone-800">{orderCustomerName(order) || "N/A"}</div>
                              <div className="text-xs text-stone-500">{order.shippingAddress?.email || "N/A"}</div>
                              <span className="mt-1 inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-stone-600">
                                {getOrderCountryName(order)}
                              </span>
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm text-stone-600">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              order.status === "Processing"
                                ? "bg-amber-100 text-amber-800"
                                : order.status === "Shipped"
                                  ? "bg-blue-100 text-blue-800"
                                  : order.status === "Delivered"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : order.status === "Cancelled" || order.status === "Returned"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-stone-100 text-stone-700"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold tabular-nums text-stone-900">
                          {formatOrderPrice(order.totalPrice, order)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900">Quick actions</h2>
            <div className="mt-4 grid gap-2">
              {quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-200 hover:bg-stone-50 hover:text-stone-900"
                >
                  <action.icon className="h-4 w-4 text-brand-600" />
                  {action.label}
                  <ArrowUpRight className="ml-auto h-4 w-4 text-stone-300 transition group-hover:text-brand-600" />
                </Link>
              ))}
            </div>

            <div className="mt-6 border-t border-stone-200 pt-4">
              <p className="text-xs leading-relaxed text-stone-500">
                This view stays focused on what needs doing today. For revenue breakdowns and
                historical reporting, open the Reports tab in the superadmin panel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
