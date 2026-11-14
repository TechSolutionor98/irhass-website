"use client"

import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { adminAPI } from "../../services/api"
import { clearSeoUnlockStorage, isSeoUnlockTokenValid } from "../../utils/seoUnlock"
import {
  Activity,
  AlertTriangle,
  Award,
  Bell,
  BellRing,
  BookOpen,
  Box,
  Boxes,
  Calculator,
  ChevronDown,
  ChevronRight,
  Cog,
  Gift,
  Globe,
  ImageIcon,
  Languages,
  Layers,
  LayoutDashboard,
  MessageCircle,
  Package,
  Palette,
  Percent,
  Phone,
  RefreshCw,
  Ruler,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Tag,
  Mail,
  TrendingUp,
  Truck,
  Unlock,
  UserCog,
  Users,
} from "lucide-react"

const SEO_UNLOCK_TOKEN_KEY = "seoUnlockToken"
const SEO_UNLOCK_EXPIRES_AT_KEY = "seoUnlockExpiresAt"

// Modules parked out of the admin panel for now, matched on an entry's `permission` key.
// The pages, routes and APIs are untouched -- this only suppresses the sidebar entries,
// so deleting a key here brings the menu back exactly as it was.
const HIDDEN_MODULES = ["loyalty", "referrals"]

// Same idea, matched on destination instead. Needed where several entries share one
// permission and only some should go: "Admin Settings", "GCC Countries & Rates" and
// "Website Appearance" are all `settings`, but only the first two open /admin/settings;
// "Arabic Conversion" shares `cache` with "Reset Cache", which stays.
// Compared without the query string, so "?tab=countries" is covered by the bare path.
const HIDDEN_PATHS = ["/admin/settings", "/admin/arabic-conversion"]

const isHiddenPath = (path) => !!path && HIDDEN_PATHS.includes(String(path).split("?")[0])

const AdminSidebar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { adminLogout, isSuperAdmin, hasPermission } = useAuth()
  const [isSeoUnlocked, setIsSeoUnlocked] = useState(() => isSeoUnlockTokenValid())
  const [seoUnlockExpiresAt, setSeoUnlockExpiresAt] = useState(localStorage.getItem(SEO_UNLOCK_EXPIRES_AT_KEY) || "")
  const [openDropdowns, setOpenDropdowns] = useState({
    productSystem: false,
    products: false,
    categories: false,
    brands: false,
    volumes: false,
    warranty: false,
    colors: false,
    units: false,
    tax: false,
    sizes: false,
    orders: false,
    blogs: false,
    subcategories: false,
    subcategories2: false,
    subcategories3: false,
    subcategories4: false,
    coupons: false,
    reviews: false,
    series: false,
    models: false,
    makes: false,
    manufacturers: false,
    soldBy: false,
    stockAdjustment: false,
    createOrderQuotation: false,
    seoSettings: false,
    superAdmin: false, // Super Admin dropdown state
  })

  // Auto-open dropdowns based on current route
  useEffect(() => {
    const path = location.pathname
    const newOpenDropdowns = { ...openDropdowns }

    // Product System dropdown - open if any product-related route is active
    if (
      path.includes("/admin/product-pm") ||
      path.includes("/admin/country-pm") ||
      path.includes("/admin/products") ||
      path.includes("/admin/add-product") ||
      path.includes("/admin/categories") ||
      path.includes("/admin/add-category") ||
      path.includes("/admin/trash-categories") ||
      path.includes("/admin/brands") ||
      path.includes("/admin/add-brand") ||
      path.includes("/admin/series") ||
      path.includes("/admin/models") ||
      path.includes("/admin/makes") ||
      path.includes("/admin/manufacturers") ||
      path.includes("/admin/sold-by") ||
      path.includes("/admin/volumes") ||
      path.includes("/admin/add-volume") ||
      path.includes("/admin/warranty") ||
      path.includes("/admin/add-warranty") ||
      path.includes("/admin/colors") ||
      path.includes("/admin/add-color") ||
      path.includes("/admin/units") ||
      path.includes("/admin/add-unit") ||
      path.includes("/admin/tax") ||
      path.includes("/admin/add-tax") ||
      path.includes("/admin/sizes") ||
      path.includes("/admin/add-size") ||
      path.includes("/admin/subcategories") ||
      path.includes("/admin/add-subcategory") ||
      path.includes("/admin/subcategories/trash") ||
      path.includes("/admin/subcategories-2") ||
      path.includes("/admin/add-subcategory-2") ||
      path.includes("/admin/subcategories-3") ||
      path.includes("/admin/add-subcategory-3") ||
      path.includes("/admin/subcategories-4") ||
      path.includes("/admin/add-subcategory-4")
    ) {
      newOpenDropdowns.productSystem = true
    }

    // Orders dropdown - open if any order-related route is active
    if (
      (path.includes("/admin/orders") &&
        !path.includes("/admin/orders/create") &&
        !path.includes("/admin/orders/quotations") &&
        !path.includes("/admin/orders/wholesale")) ||
      path.includes("/admin/orders/new") ||
      path.includes("/admin/orders/online") ||
      path.includes("/admin/orders/received") ||
      path.includes("/admin/orders/confirmed") ||
      path.includes("/admin/orders/processing") ||
      path.includes("/admin/orders/ready-for-shipment") ||
      path.includes("/admin/orders/on-the-way") ||
      path.includes("/admin/orders/delivered") ||
      path.includes("/admin/orders/on-hold") ||
      path.includes("/admin/orders/cancelled") ||
      path.includes("/admin/orders/deleted") ||
      path.includes("/admin/orders/create") ||
      path.includes("/admin/orders/quotations")
    ) {
      newOpenDropdowns.orders = true
    }

    // Wholesale Orders lives in this group even though its path sits under
    // /admin/orders, so it is named here as well as excluded from the Orders rule
    // above. Without both, following the link collapses the group it was clicked in
    // and opens the wrong one.
    if (
      path.includes("/admin/orders/create") ||
      path.includes("/admin/orders/quotations") ||
      path.includes("/admin/orders/wholesale")
    ) {
      newOpenDropdowns.createOrderQuotation = true
    }

    // Blogs dropdown - open if any blog-related route is active
    if (
      path.includes("/admin/blog-dashboard") ||
      path.includes("/admin/blogs") ||
      path.includes("/admin/add-blog") ||
      path.includes("/admin/blog-topics") ||
      path.includes("/admin/blog-categories") ||
      path.includes("/admin/blog-brands") ||
      path.includes("/admin/blog-comments") ||
      path.includes("/admin/blog-rating")
    ) {
      newOpenDropdowns.blogs = true
    }

    // Coupons dropdown - open if any coupon-related route is active
    if (path.includes("/admin/coupons") || path.includes("/admin/app-discount-settings")) {
      newOpenDropdowns.coupons = true
    }

    // Reviews dropdown - open if any review-related route is active
    if (path.includes("/admin/reviews")) {
      newOpenDropdowns.reviews = true
    }

    if (path.includes("/admin/stock-adjustment")) {
      newOpenDropdowns.stockAdjustment = true
    }

    // SEO Settings dropdown auto-open
    if (path.includes("/admin/seo-settings")) {
      newOpenDropdowns.seoSettings = true
    }

    // Email Marketing — kept open while in the builder, which is reached from the
    // designs list and would otherwise collapse the menu behind you.
    if (path.includes("/admin/email-templates") || path.includes("/admin/bulk-mails")) {
      newOpenDropdowns.emailMarketing = true
    }

    // Individual dropdowns
    if (
      path.includes("/admin/products") ||
      path.includes("/admin/add-product") ||
      path.includes("/admin/product-pm") ||
      path.includes("/admin/country-pm")
    ) {
      newOpenDropdowns.products = true
    }
    if (
      path.includes("/admin/categories") ||
      path.includes("/admin/add-category") ||
      path.includes("/admin/trash-categories") ||
      path.includes("/admin/categories/slider")
    ) {
      newOpenDropdowns.categories = true
    }
    if (path.includes("/admin/brands") || path.includes("/admin/add-brand")) {
      newOpenDropdowns.brands = true
    }
    if (path.includes("/admin/volumes") || path.includes("/admin/add-volume")) {
      newOpenDropdowns.volumes = true
    }
    if (path.includes("/admin/warranty") || path.includes("/admin/add-warranty")) {
      newOpenDropdowns.warranty = true
    }
    if (path.includes("/admin/colors") || path.includes("/admin/add-color")) {
      newOpenDropdowns.colors = true
    }
    if (path.includes("/admin/units") || path.includes("/admin/add-unit")) {
      newOpenDropdowns.units = true
    }
    if (path.includes("/admin/tax") || path.includes("/admin/add-tax")) {
      newOpenDropdowns.tax = true
    }
    if (path.includes("/admin/sizes") || path.includes("/admin/add-size")) {
      newOpenDropdowns.sizes = true
    }
    if (path.includes("/admin/subcategories") || path.includes("/admin/add-subcategory") || path.includes("/admin/subcategories/trash")) {
      newOpenDropdowns.subcategories = true
    }
    if (path.includes("/admin/subcategories-2") || path.includes("/admin/add-subcategory-2")) {
      newOpenDropdowns.subcategories2 = true
    }
    if (path.includes("/admin/subcategories-3") || path.includes("/admin/add-subcategory-3")) {
      newOpenDropdowns.subcategories3 = true
    }
    if (path.includes("/admin/subcategories-4") || path.includes("/admin/add-subcategory-4")) {
      newOpenDropdowns.subcategories4 = true
    }
    if (path.includes("/admin/series")) {
      newOpenDropdowns.series = true
    }
    if (path.includes("/admin/models")) {
      newOpenDropdowns.models = true
    }
    if (path.includes("/admin/makes")) {
      newOpenDropdowns.makes = true
    }
    if (path.includes("/admin/manufacturers")) {
      newOpenDropdowns.manufacturers = true
    }
    if (path.includes("/admin/sold-by")) {
      newOpenDropdowns.soldBy = true
    }

    setOpenDropdowns(newOpenDropdowns)
  }, [location.pathname])

  useEffect(() => {
    const interval = setInterval(() => {
      const unlocked = isSeoUnlockTokenValid()
      setIsSeoUnlocked(unlocked)
      if (!unlocked) setSeoUnlockExpiresAt("")
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    clearSeoUnlockStorage()
    adminLogout()
    navigate("/irhaasadmin/login")
  }

  const handleSeoUnlock = async () => {
    const password = window.prompt("Enter SEO settings unlock password")
    if (!password) return

    try {
      const response = await adminAPI.seoUnlock(password)
      if (!response?.unlockToken) {
        throw new Error("Unlock token missing from server response")
      }
      localStorage.setItem(SEO_UNLOCK_TOKEN_KEY, response.unlockToken)
      if (response.expiresAt) {
        localStorage.setItem(SEO_UNLOCK_EXPIRES_AT_KEY, response.expiresAt)
        setSeoUnlockExpiresAt(response.expiresAt)
      } else {
        localStorage.removeItem(SEO_UNLOCK_EXPIRES_AT_KEY)
        setSeoUnlockExpiresAt("")
      }
      setIsSeoUnlocked(true)
      window.alert("SEO settings unlocked successfully")
    } catch (error) {
      window.alert(error?.message || "Failed to unlock SEO settings")
    }
  }

  const toggleDropdown = (dropdown, e) => {
    e.preventDefault()
    e.stopPropagation()
    setOpenDropdowns((prev) => ({
      ...prev,
      [dropdown]: !prev[dropdown],
    }))
  }

  const isActive = (path) => {
    return location.pathname === path
  }

  const menuItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/admin/dashboard",
      permission: "dashboard",
    },
    {
      title: "Product System",
      icon: Layers,
      dropdown: "productSystem",
      permission: "products",
      items: [
        {
          title: "Products",
          icon: Package,
          dropdown: "products",
          section: "products",
          permission: "products",
          items: [
            { title: "List Products", path: "/admin/products" },
            //{ title: "Add Product", path: "/admin/products/add" },
            { title: "Add Bulk Products", path: "/admin/products/bulk-add" },
            { title: "Product Payment Method", path: "/admin/product-pm" },
            { title: "Country Payment Methods", path: "/admin/country-pm" },
          ],
        },
        {
          title: "Categories",
          icon: Tag,
          dropdown: "categories",
          section: "categories",
          permission: "categories",
          items: [
            { title: "List Categories", path: "/admin/categories" },
            { title: "Add Category", path: "/admin/categories/add" },
            { title: "Trash Categories", path: "/admin/categories/trash" },
            { title: "Category Slider", path: "/admin/categories/slider" },
          ],
        },
        {
          title: "Sub Categories",
          icon: Tag,
          dropdown: "subcategories",
          section: "subcategories",
          permission: "subcategories",
          items: [
            { title: "List Sub Categories", path: "/admin/subcategories" },
            { title: "Add Sub Category", path: "/admin/subcategories/add" },
            { title: "Trash Sub Categories", path: "/admin/subcategories/trash" },
          ],
        },
        {
          title: "Sub Categories 2",
          icon: Tag,
          dropdown: "subcategories2",
          section: "subcategories2",
          permission: "subcategories",
          items: [
            { title: "List Sub Categories 2", path: "/admin/subcategories-2" },
            { title: "Add Sub Category 2", path: "/admin/subcategories-2/add" },
          ],
        },
        {
          title: "Sub Categories 3",
          icon: Tag,
          dropdown: "subcategories3",
          section: "subcategories3",
          permission: "subcategories",
          items: [
            { title: "List Sub Categories 3", path: "/admin/subcategories-3" },
            { title: "Add Sub Category 3", path: "/admin/subcategories-3/add" },
          ],
        },
        {
          title: "Sub Categories 4",
          icon: Tag,
          dropdown: "subcategories4",
          section: "subcategories4",
          permission: "subcategories",
          items: [
            { title: "List Sub Categories 4", path: "/admin/subcategories-4" },
            { title: "Add Sub Category 4", path: "/admin/subcategories-4/add" },
          ],
        },
        {
          title: "Brands",
          icon: Tag,
          dropdown: "brands",
          section: "brands",
          permission: "brands",
          items: [
            { title: "List Brands", path: "/admin/brands" },
            { title: "Add Brand", path: "/admin/brands/add" },
          ],
        },
        {
          title: "Series",
          icon: Layers,
          dropdown: "series",
          section: "series",
          permission: "products",
          items: [
            { title: "List Series", path: "/admin/series" },
            { title: "Add Series", path: "/admin/series/add" },
          ],
        },
        {
          title: "Model",
          icon: Package,
          dropdown: "models",
          section: "models",
          permission: "products",
          items: [
            { title: "List Model", path: "/admin/models" },
            { title: "Add Model", path: "/admin/models/add" },
          ],
        },
        {
          title: "Make",
          icon: Settings,
          dropdown: "makes",
          section: "makes",
          permission: "products",
          items: [
            { title: "List Make", path: "/admin/makes" },
            { title: "Add Make", path: "/admin/makes/add" },
          ],
        },
        {
          title: "Manufacturer",
          icon: Cog,
          dropdown: "manufacturers",
          section: "manufacturers",
          permission: "products",
          items: [
            { title: "List Manufacturer", path: "/admin/manufacturers" },
            { title: "Add Manufacturer", path: "/admin/manufacturers/add" },
          ],
        },
        {
          title: "Sold By",
          icon: ShoppingBag,
          dropdown: "soldBy",
          section: "soldBy",
          permission: "products",
          items: [
            { title: "List Sold By", path: "/admin/sold-by" },
            { title: "Add Sold By", path: "/admin/sold-by/add" },
          ],
        },
        {
          title: "Volumes",
          icon: Box,
          dropdown: "volumes",
          section: "volumes",
          permission: "volumes",
          items: [
            { title: "List Volumes", path: "/admin/volumes" },
            { title: "Add Volume", path: "/admin/volumes/add" },
          ],
        },
        {
          title: "Warranty",
          icon: Shield,
          dropdown: "warranty",
          section: "warranty",
          permission: "warranty",
          items: [
            { title: "List Warranty", path: "/admin/warranty" },
            { title: "Add Warranty", path: "/admin/warranty/add" },
          ],
        },
        {
          title: "Colors",
          icon: Palette,
          dropdown: "colors",
          section: "colors",
          permission: "colors",
          items: [
            { title: "List Colors", path: "/admin/colors" },
            { title: "Add Color", path: "/admin/colors/add" },
          ],
        },
        {
          title: "Units",
          icon: Ruler,
          dropdown: "units",
          section: "units",
          permission: "units",
          items: [
            { title: "List Units", path: "/admin/units" },
            { title: "Add Unit", path: "/admin/units/add" },
          ],
        },
        {
          title: "Tax",
          icon: Calculator,
          dropdown: "tax",
          section: "tax",
          permission: "tax",
          items: [
            { title: "List Tax", path: "/admin/tax" },
            { title: "Add Tax", path: "/admin/tax/add" },
          ],
        },
        {
          title: "Sizes",
          icon: Ruler,
          dropdown: "sizes",
          section: "sizes",
          permission: "sizes",
          items: [
            { title: "List Sizes", path: "/admin/sizes" },
            { title: "Add Size", path: "/admin/sizes/add" },
          ],
        },
      ],
    },
    {
      title: "Inventory",
      icon: Boxes,
      dropdown: "inventory",
      section: "inventory",
      permission: "products",
      items: [
        { title: "Store Stats", path: "/admin/inventory" },
        { title: "Create Labels", path: "/admin/create-labels" },
      ],
    },
    {
      title: "Stock Adjustment",
      icon: TrendingUp,
      dropdown: "stockAdjustment",
      permission: "stockAdjustment",
      items: [
        { title: "Price Adjustment", path: "/admin/stock-adjustment/price-adjustment" },
        { title: "Reports", path: "/admin/stock-adjustment/reports" },
      ],
    },
    {
      title: "Delivery Charges",
      icon: Truck,
      dropdown: "deliveryCharges",
      permission: "deliveryCharges",
      items: [
        { title: "List Delivery Charges", path: "/admin/delivery-charges" },
        { title: "Add Delivery Charge", path: "/admin/delivery-charges/add" },
        { title: "Delivery | Handling Fee", path: "/admin/delivery-handling-fee" },
      ],
    },
    {
      title: "Order/Quotation",
      icon: ShoppingCart,
      dropdown: "createOrderQuotation",
      permission: "orders",
      items: [
        { title: "Create Order/Quotation", path: "/admin/orders/create" },
        { title: "Recent Quotation", path: "/admin/orders/quotations" },
        { title: "Wholesale Orders", path: "/admin/orders/wholesale" },
      ],
    },
    {
      // The ten per-status pages became tabs on one Orders page, so this is a
      // single link. Critical Orders stays separate: it is a view across
      // statuses, not a status of its own.
      title: "Orders",
      icon: ShoppingCart,
      dropdown: "orders",
      permission: "orders",
      items: [
        { title: "Orders", path: "/admin/orders" },
        { title: "Critical Orders", path: "/admin/orders/critical", icon: AlertTriangle, highlight: true },
      ],
    },
    {
      title: "Reviews",
      icon: Star,
      dropdown: "reviews",
      permission: "reviews",
      items: [
        { title: "All Reviews", path: "/admin/reviews" },
        { title: "Pending Reviews", path: "/admin/reviews/pending" },
        { title: "Approved Reviews", path: "/admin/reviews/approved" },
        { title: "Rejected Reviews", path: "/admin/reviews/rejected" },
      ],
    },
    {
      title: "Push Notifications",
      icon: BellRing,
      path: "/admin/push-notifications",
      permission: "pushNotifications",
    },
    {
      title: "Request Callbacks",
      icon: Phone,
      path: "/admin/request-callbacks",
      permission: "requestCallbacks",
    },
    {
      title: "Notify Me",
      icon: Bell,
      path: "/admin/notify-me",
      permission: "notifyMe",
    },
    {
      title: "Bulk Purchase",
      icon: ShoppingBag,
      path: "/admin/bulk-purchase",
      permission: "bulkPurchase",
    },
    {
      title: "Buyer Protection",
      icon: Shield,
      path: "/admin/buyer-protection",
      permission: "buyerProtection",
    },
    {
      title: "Blogs",
      icon: BookOpen,
      dropdown: "blogs",
      permission: "blogs",
      items: [
        { title: "Dashboard", path: "/admin/blog-dashboard" },
        { title: "Blogs", path: "/admin/blogs" },
        { title: "Comments", path: "/admin/blog-comments" },
        { title: "Categories", path: "/admin/blog-categories" },
        { title: "Topics", path: "/admin/blog-topics" },
        { title: "Brands", path: "/admin/blog-brands" },
      ],
    },
    {
      title: "Users",
      icon: Users,
      path: "/admin/users",
      permission: "users",
    },
    {
      title: "Banners",
      icon: ImageIcon,
      path: "/admin/banners",
      permission: "banners",
    },
    {
      title: "Home Sections",
      icon: ImageIcon,
      path: "/admin/home-sections",
      permission: "homeSections",
    },
    {
      title: "Offer Pages",
      icon: Tag,
      path: "/admin/offer-pages",
      permission: "offerPages",
    },
    {
      title: "Coupons",
      icon: Percent,
      dropdown: "coupons",
      permission: "coupons",
      items: [
        { title: "All Coupons", path: "/admin/coupons/all" },
        { title: "App Discount Settings", path: "/admin/app-discount-settings" },
        { title: "Popup Settings", path: "/admin/app-discount-settings/popup-settings" },
      ],
    },
    {
      title: "Loyalty Points",
      icon: Award,
      dropdown: "loyalty",
      permission: "loyalty",
      items: [
        { title: "Programme Settings", path: "/admin/loyalty/settings" },
        { title: "Category Earning Rules", path: "/admin/loyalty/rules" },
        { title: "Customer Points", path: "/admin/loyalty/customers" },
      ],
    },
    {
      title: "Referrals",
      icon: Gift,
      dropdown: "referrals",
      permission: "referrals",
      items: [
        { title: "Programme Settings", path: "/admin/referrals/settings" },
        { title: "All Referrals", path: "/admin/referrals/list" },
      ],
    },
    {
      title: "SEO Settings",
      icon: Cog,
      dropdown: "seoSettings",
      permission: "seoSettings",
      items: [
        { title: "Pages", path: "/admin/seo-settings/pages" },
        { title: "Home Page SEO", path: "/admin/seo-settings/home" },
        { title: "Redirects", path: "/admin/seo-settings/redirects" },
        { title: "Bing IndexNow", path: "/admin/seo-settings/bing-indexnow" },
      ],
    },
    {
      title: "Email Marketing",
      icon: Mail,
      dropdown: "emailMarketing",
      permission: "emailTemplates",
      items: [
        { title: "Email Designs", path: "/admin/email-templates" },
        { title: "Bulk Mails", path: "/admin/bulk-mails" },
        { title: "Transactional Templates", path: "/admin/email-templates/transactional" },
      ],
    },
    {
      title: "Newsletter Subscribers",
      icon: Users,
      path: "/admin/newsletter-subscribers",
      permission: "newsletter",
    },
    {
      title: "WhatsApp",
      icon: MessageCircle,
      path: "/admin/whatsapp",
      permission: "settings",
    },
    {
      title: "Reset Cache",
      icon: RefreshCw,
      path: "/admin/reset-cache",
      permission: "cache",
    },
    {
      title: "Arabic Conversion",
      icon: Languages,
      path: "/admin/arabic-conversion",
      permission: "cache",
    },
    {
      title: "GCC Countries & Rates",
      icon: Globe,
      path: "/admin/settings?tab=countries",
      permission: "settings",
    },
    {
      title: "Website Appearance",
      icon: Palette,
      path: "/admin/appearance",
      permission: "settings",
    },
    {
      title: "Admin Settings",
      icon: Settings,
      path: "/admin/settings",
      permission: "settings",
    },
  ]

  // Super Admin only menu items
  const superAdminMenuItems = [
    {
      title: "Super Admin",
      icon: ShieldCheck,
      dropdown: "superAdmin",
      superAdminOnly: true,
      items: [
        { title: "Admin Management", path: "/admin/admin-management", icon: UserCog },
        { title: "Activity Logs", path: "/admin/activity-logs", icon: Activity },
      ],
    },
  ]

  // Filter menu items based on permissions.
  //
  // Top-level entries are default-deny: one without a `permission` is hidden rather than
  // shown. Showing it was how "Admin Settings" and "GCC Countries & Rates" ended up in
  // every admin's sidebar. Nested items carry no permission of their own -- they inherit
  // their parent's gate -- so the default applies only at the top level.
  const filterMenuItems = (items, isTopLevel = true) => {
    return items.filter(item => {
      // Parked modules and pages are hidden from everyone, super admins included, so
      // this has to come before the isSuperAdmin bypass below.
      if (item.permission && HIDDEN_MODULES.includes(item.permission)) {
        return false
      }
      if (isHiddenPath(item.path)) {
        return false
      }

      // Super admin only items
      if (item.superAdminOnly && !isSuperAdmin) {
        return false
      }
      
      // If user is super admin, show everything
      if (isSuperAdmin) {
        return true
      }
      
      // Check permission for item
      if (item.permission) {
        if (item.permission === "sizes") {
          return hasPermission("sizes") || hasPermission("products")
        }
        if (item.permission === "notifyMe") {
          return hasPermission("notifyMe") || hasPermission("products") || isSuperAdmin || true
        }
        return hasPermission(item.permission)
      }

      // No permission declared: hide it at the top level rather than exposing it.
      if (isTopLevel) {
        return false
      }
      
      return true
    }).map(item => {
      // Filter nested items
      if (item.items) {
        return {
          ...item,
          items: filterMenuItems(item.items, false)
        }
      }
      return item
    }).filter(item => {
      // Remove dropdowns with no items
      if (item.dropdown && item.items && item.items.length === 0) {
        return false
      }
      return true
    })
  }

  // Combine and filter menu items
  const allMenuItems = [...menuItems, ...superAdminMenuItems]
  const filteredMenuItems = filterMenuItems(allMenuItems)

  const renderMenuItem = (item, level = 0) => {
    const paddingLeft = level === 0 ? "px-6" : level === 1 ? "px-8" : "px-12"
    const textSize = level === 0 ? "font-medium" : level === 1 ? "text-sm font-medium" : "text-sm"

    // Special case: Dropdown with only one item (e.g., Coupons)
    if (item.dropdown && item.items && item.items.length === 1) {
      const subItem = item.items[0]
      return (
        <Link
          key={item.title}
          to={subItem.path}
          className={`block ${paddingLeft} py-3 ${textSize} transition-colors duration-200 flex items-center space-x-3 ${
            isActive(subItem.path)
              ? "bg-lime-100 text-lime-800 border-r-2 border-lime-400"
              : "text-gray-600 hover:bg-gray-200"
          }`}
        >
          {item.icon && <item.icon size={20} />}
          <span>{item.title}</span>
        </Link>
      )
    }

    if (item.dropdown) {
      return (
        <div key={item.title}>
          <button
            onClick={(e) => toggleDropdown(item.dropdown, e)}
            className={`w-full flex items-center justify-between ${paddingLeft} py-3 transition-colors duration-200 text-gray-700 hover:bg-gray-100`}
          >
            <div className="flex items-center space-x-3">
              {item.icon && <item.icon size={20} />}
              <span className={textSize}>{item.title}</span>
            </div>
            {openDropdowns[item.dropdown] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {openDropdowns[item.dropdown] && (
            <div className={level === 0 ? "bg-gray-50" : "bg-gray-100"}>
              {item.items.map((subItem) => renderMenuItem(subItem, level + 1))}
            </div>
          )}
        </div>
      )
    } else {
      return (
        <Link
          key={item.title}
          to={item.path}
          className={`flex items-center space-x-3 ${paddingLeft} py-2 ${textSize} transition-colors duration-200 ${
            isActive(item.path)
              ? "bg-lime-100 text-lime-800 border-r-4 border-lime-400"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          {item.icon && <item.icon size={20} />}
          <span>{item.title}</span>
        </Link>
      )
    }
  }

  return (
    <div className="w-64 bg-white shadow-lg h-[133.33vh] overflow-hidden fixed left-0 top-0 z-50 flex flex-col">
      <div className="p-6 border-b flex-shrink-0">
        <Link to="/admin/dashboard" className="flex items-center justify-center">
          {/* The mark is portrait (600x855), so size it by height -- unbounded it renders
              at its natural width and swallows the top of the sidebar. Height drives the
              width here: at h-16 it came out about 45px wide in a 208px space, which read
              as a thumbnail rather than a logo. max-w-full keeps it contained if the file
              is ever swapped for a landscape one. */}
          <img src="/logo.png" alt="Irha's Wardrobe" className="h-28 w-auto max-w-full object-contain" />
        </Link>
        {hasPermission("seoSettings") && (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleSeoUnlock}
              className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
                isSeoUnlocked
                  ? "bg-lime-100 border-lime-300 text-lime-800 hover:bg-lime-200"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Unlock size={16} />
              {isSeoUnlocked ? "SEO Unlocked" : "Unlock Potential"}
            </button>
            {isSeoUnlocked && seoUnlockExpiresAt && (
              <p className="text-[11px] text-gray-500 mt-2 text-center">
                Active till {new Date(seoUnlockExpiresAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      <nav className="mt-6 pb-20 flex-1 overflow-y-auto">
        {filteredMenuItems.map((item, index) => (
          <div key={index}>
            {item.dropdown ? (
              renderMenuItem(item)
            ) : (
              <Link
                to={item.path}
                className={`flex items-center space-x-3 px-6 py-3 transition-colors duration-200 ${
                  isActive(item.path)
                    ? "bg-lime-100 text-lime-800 border-r-4 border-lime-400"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.title}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>
    </div>
  )
}

export default AdminSidebar
