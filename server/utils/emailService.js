import dotenv from "dotenv"
dotenv.config({ override: true })
import nodemailer from "nodemailer"
import Order from "../models/orderModel.js"
import User from "../models/userModel.js"

/**
 * Official Brand Assets & Styling for "Irha's Wardrobe"
 * Matches the website's luxury palette (gold, near-black, warm surface, clean stone borders).
 */
export const BRAND_ASSETS = {
  storeName: "Irha's Wardrobe",
  websiteUrl: "https://www.irhaas.com",
  // Official website logos hosted on high-availability HTTPS CDN
  logoWideUrl: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1794339820/irhaas-branding/irhaas-logo-wide.png",
  logoSquareUrl: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1794339822/irhaas-branding/irhaas-logo.png",
  colors: {
    primary: "#8e6937",        // Official Irha's Wardrobe warm gold
    primaryHover: "#684e2c",   // Deeper gold hover
    primaryLight: "#b4874a",   // Accent gold
    dark: "#181816",           // Editorial black / charcoal
    surface: "#faf6f0",        // Warm luxury cream surface
    background: "#f7f5f0",     // Warm luxury outer canvas
    border: "#e7e5e4",         // Clean subtle stone border
    borderGold: "#e7d8c5",     // Soft gold accent border
    text: "#181816",           // Headings and key metrics
    textMuted: "#44403c",      // Body copy
    textSubtle: "#78716c",     // Captions and secondary notes
    success: "#15803d",
    successBg: "#f0fdf4",
    successBorder: "#bbf7d0",
    danger: "#b91c1c",
    dangerBg: "#fef2f2",
    dangerBorder: "#fecaca",
  },
  // Official verified social media channels for Irha's Wardrobe
  social: [
    {
      name: "Facebook",
      url: "https://facebook.com/irhaswardrobe/",
      icon: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1794225721/irhaas-branding/social/facebook.png",
    },
    {
      name: "Instagram",
      url: "https://instagram.com/irhaswardrob/",
      icon: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1794225719/irhaas-branding/social/instagram.png",
    },
    {
      name: "TikTok",
      url: "https://www.tiktok.com/@irhaswardrobe",
      icon: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1794225722/irhaas-branding/social/tiktok.png",
    },
    {
      name: "LinkedIn",
      url: "https://linkedin.com/company/irhaswardrobe/",
      icon: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1794225723/irhaas-branding/social/linkedin.png",
    },
    {
      name: "X (Twitter)",
      url: "https://x.com/irhaswardrobe",
      icon: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1794338603/irhaas-branding/social/x-twitter.png",
    },
    {
      name: "YouTube",
      url: "https://www.youtube.com/channel/UCRoX9oOzkqk2r0VlnG0SfXA",
      icon: "https://res.cloudinary.com/dyfhsu5v6/image/upload/v1794225726/irhaas-branding/social/youtube.png",
    },
  ],
}

// Helper to ensure image URLs are absolute for email clients
const toAbsoluteUrl = (src) => {
  if (!src) return BRAND_ASSETS.logoSquareUrl
  const s = String(src).trim()
  if (s.startsWith("http://") || s.startsWith("https://")) return s
  if (s.startsWith("//")) return `https:${s}`
  const base =
    process.env.PUBLIC_BASE_URL ||
    process.env.SERVER_PUBLIC_URL ||
    process.env.API_BASE_URL ||
    process.env.FRONTEND_URL ||
    "https://www.irhaas.com"
  if (s.startsWith("/")) return `${base}${s}`
  return `${base}/uploads/${s}`
}

// Create transporters for order and support emails with pooling and timeouts
const orderTransporter = nodemailer.createTransport({
  host: process.env.ORDER_EMAIL_HOST || "smtp.hostinger.com",
  port: Number(process.env.ORDER_EMAIL_PORT) || 465,
  secure: process.env.ORDER_EMAIL_SECURE !== "false",
  auth: {
    user: process.env.ORDER_EMAIL_USER || "order@irhaas.com",
    pass: process.env.ORDER_EMAIL_PASS || "@Tech#38521",
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
})

const supportTransporter = nodemailer.createTransport({
  host: process.env.SUPPORT_EMAIL_HOST || "smtp.hostinger.com",
  port: Number(process.env.SUPPORT_EMAIL_PORT) || 465,
  secure: process.env.SUPPORT_EMAIL_SECURE !== "false",
  auth: {
    user: process.env.SUPPORT_EMAIL_USER || "info@irhaas.com",
    pass: process.env.SUPPORT_EMAIL_PASS || "@Tech#38521",
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
})

// Helper to reliably resolve customer name and email (works for guest, pickup, and registered users)
export const resolveCustomerInfo = async (order) => {
  let customerEmail = order.shippingAddress?.email || order.pickupDetails?.email || order.user?.email || order.customerEmail
  let customerName = order.shippingAddress?.name || order.pickupDetails?.name || order.user?.name || order.customerName

  if ((!customerEmail || !customerName) && order.user) {
    try {
      const userId = typeof order.user === "object" ? order.user._id || order.user.id : order.user
      if (userId) {
        const userDoc = await User.findById(userId).select("name email").lean()
        if (userDoc) {
          if (!customerEmail && userDoc.email) customerEmail = userDoc.email
          if (!customerName && userDoc.name) customerName = userDoc.name
        }
      }
    } catch (err) {
      console.warn("[resolveCustomerInfo] Could not query user:", err.message)
    }
  }

  return {
    customerEmail: (customerEmail || "").trim(),
    customerName: (customerName || "Customer").trim(),
  }
}

// Mailboxes
export const MAILBOXES = {
  sales: (process.env.SALES_EMAIL || "sales@irhaas.com").trim(),
  order: (process.env.ORDER_EMAIL_USER || "order@irhaas.com").trim(),
  info: (process.env.INFO_EMAIL || "info@irhaas.com").trim(),
  support: (process.env.SUPPORT_EMAIL_USER || "info@irhaas.com").trim(),
  contact: (process.env.CONTACT_EMAIL || "contact@irhaas.com").trim(),
}

const SENDER_ALIASES = { order: "sales", support: "info" }

const ORDER_NOTIFICATION_EMAIL = (process.env.ORDER_NOTIFICATION_EMAIL || MAILBOXES.order || MAILBOXES.sales).trim()

const getOrderEmailRecipients = (customerEmail, includeCustomer = true) => {
  const candidates = []

  if (includeCustomer && customerEmail) {
    candidates.push(String(customerEmail).trim())
  }

  if (ORDER_NOTIFICATION_EMAIL) {
    candidates.push(ORDER_NOTIFICATION_EMAIL)
  }

  const uniqueRecipients = []
  for (const recipient of candidates) {
    if (!recipient) continue
    const exists = uniqueRecipients.some((email) => email.toLowerCase() === recipient.toLowerCase())
    if (!exists) uniqueRecipients.push(recipient)
  }

  return uniqueRecipients
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const formatCurrency = (value) => `${(Number(value) || 0).toFixed(2)} Rs`

const formatDateTime = (value) => {
  if (!value) return "N/A"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "N/A"
  return date.toLocaleString("en-PK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatDeliveryType = (deliveryType) => (deliveryType === "pickup" ? "Store Pickup" : "Home Delivery")

const formatPaymentMethod = (actualPaymentMethod, paymentMethod) => {
  const method = (actualPaymentMethod || paymentMethod || "").toString().trim().toLowerCase()
  switch (method) {
    case "tabby":
      return "Tabby"
    case "tamara":
      return "Tamara"
    case "card":
      return "Card"
    case "cod":
    case "cash on delivery":
      return "Cash on Delivery"
    default:
      return paymentMethod || actualPaymentMethod || "N/A"
  }
}

// Helper to select transporter and from address
const resolveMailbox = (type) => SENDER_ALIASES[type] || (MAILBOXES[type] ? type : "info")

const getMailConfig = (type) => {
  const mailbox = resolveMailbox(type)

  if (mailbox === "sales" || mailbox === "order") {
    return {
      transporter: orderTransporter,
      from: `Irha's Wardrobe Orders <${process.env.ORDER_EMAIL_USER || "order@irhaas.com"}>`,
    }
  }

  return {
    transporter: supportTransporter,
    from: `Irha's Wardrobe <${process.env.SUPPORT_EMAIL_USER || "info@irhaas.com"}>`,
  }
}

/**
 * Renders social media icon buttons.
 * If a link is valid, renders as an anchor; otherwise renders as an unclickable icon span (per requirements).
 */
const renderSocialIcons = () => {
  return BRAND_ASSETS.social
    .map((item) => {
      const imgTag = `<img src="${item.icon}" alt="${item.name}" width="28" height="28" style="display:inline-block;width:28px;height:28px;border-radius:50%;vertical-align:middle;border:0;outline:none;" />`
      if (item.url && item.url.trim()) {
        return `<a href="${item.url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 6px;text-decoration:none;">${imgTag}</a>`
      }
      return `<span style="display:inline-block;margin:0 6px;opacity:0.6;cursor:default;">${imgTag}</span>`
    })
    .join("\n")
}

/**
 * Standard email header featuring official Irha's Wardrobe logo
 */
const renderEmailHeader = () => `
  <div style="background-color:#ffffff;padding:28px 24px 22px;text-align:center;border-bottom:1px solid ${BRAND_ASSETS.colors.border};">
    <a href="${BRAND_ASSETS.websiteUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
      <img src="${BRAND_ASSETS.logoWideUrl}" alt="Irha's Wardrobe" width="210" style="max-width:210px;width:100%;height:auto;display:block;margin:0 auto;border:0;outline:none;" />
    </a>
  </div>
`

/**
 * Standard email footer with social links, sender info, and brand copyright
 */
const renderEmailFooter = (senderEmail = "info@irhaas.com", extraNote = "") => `
  <div style="background-color:${BRAND_ASSETS.colors.surface};padding:30px 20px 24px;text-align:center;border-top:1px solid ${BRAND_ASSETS.colors.border};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="margin:0 0 16px 0;text-align:center;">
      ${renderSocialIcons()}
    </div>
    <p style="margin:0 0 6px;font-size:13px;color:${BRAND_ASSETS.colors.textSubtle};">
      This email was sent by: <a href="mailto:${senderEmail}" style="color:${BRAND_ASSETS.colors.primary};text-decoration:none;font-weight:600;">${senderEmail}</a>
    </p>
    <p style="margin:0 0 12px;font-size:12px;color:#a8a29e;">Kindly Do Not Reply to this Email</p>
    ${extraNote ? `<p style="margin:0 0 12px;font-size:12px;color:#a8a29e;">${extraNote}</p>` : ""}
    <div style="font-size:12px;color:${BRAND_ASSETS.colors.textSubtle};line-height:1.6;border-top:1px solid ${BRAND_ASSETS.colors.border};padding-top:14px;margin-top:10px;">
      &copy; ${new Date().getFullYear()} Irha's Wardrobe. All rights reserved.<br />
      <span style="font-size:11px;color:#a8a29e;">Luxury Fashion &bull; Irha's Wardrobe</span>
    </div>
  </div>
`

/**
 * Clean responsive email envelope wrapper
 */
const wrapEmail = ({ title, content, senderEmail = "info@irhaas.com", extraFooterNote = "" }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      background-color: ${BRAND_ASSETS.colors.background};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px 12px;
      color: ${BRAND_ASSETS.colors.textMuted};
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(24, 24, 22, 0.05);
      border: 1px solid ${BRAND_ASSETS.colors.border};
    }
    .email-content {
      padding: 32px 28px;
      background-color: #ffffff;
    }
    .btn-gold {
      display: inline-block;
      background-color: ${BRAND_ASSETS.colors.primary};
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 34px;
      border-radius: 24px;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      box-shadow: 0 4px 12px rgba(142, 105, 55, 0.25);
    }
    @media (max-width: 600px) {
      body { padding: 12px 6px; }
      .email-wrapper { border-radius: 8px; }
      .email-content { padding: 24px 16px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    ${renderEmailHeader()}
    <div class="email-content">
      ${content}
    </div>
    ${renderEmailFooter(senderEmail, extraFooterNote)}
  </div>
</body>
</html>
`

/**
 * Email templates generator
 */
export const getEmailTemplate = (type, data = {}) => {
  switch (type) {
    case "emailVerification": {
      const code = escapeHtml(data.code || "000000")
      const name = escapeHtml(data.name || "Customer")
      const content = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:60px;height:60px;background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.borderGold};border-radius:50%;margin:0 auto 16px;font-size:26px;line-height:60px;color:${BRAND_ASSETS.colors.primary};">
            ✉️
          </div>
          <h1 style="font-size:22px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 10px;letter-spacing:0.3px;">Email Verification</h1>
          <p style="font-size:15px;color:${BRAND_ASSETS.colors.textMuted};margin:0;line-height:1.6;">
            Hi <strong>${name}</strong>,<br />
            Thank you for registering with <strong>Irha's Wardrobe</strong>. Please verify your email address by entering the 6-digit verification code below:
          </p>
        </div>

        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1.5px solid ${BRAND_ASSETS.colors.borderGold};border-radius:12px;margin:28px auto 20px;padding:22px 0;text-align:center;max-width:320px;">
          <div style="font-size:34px;font-weight:700;color:${BRAND_ASSETS.colors.primary};letter-spacing:10px;font-family:Courier, monospace;">${code}</div>
        </div>

        <p style="text-align:center;font-size:14px;color:${BRAND_ASSETS.colors.primary};font-weight:600;margin:14px 0 24px;">
          Copy the code above and enter it on the website to verify your email.
        </p>

        <div style="background-color:#ffffff;border:1px solid ${BRAND_ASSETS.colors.border};border-radius:10px;padding:14px 18px;margin-top:20px;text-align:center;">
          <p style="margin:0;font-size:13px;color:${BRAND_ASSETS.colors.textSubtle};line-height:1.5;">
            ⏱️ This code will expire in <strong>10 minutes</strong>.<br />
            If you did not create an account with Irha's Wardrobe, you can safely ignore this email.
          </p>
        </div>
      `
      return wrapEmail({
        title: "Verify Your Email - Irha's Wardrobe",
        content,
        senderEmail: "info@irhaas.com",
        extraFooterNote: "If you did not enter this email address when signing up for Irha's Wardrobe, disregard this message.",
      })
    }

    case "orderConfirmation": {
      const orderItems = Array.isArray(data.orderItems) ? data.orderItems : []
      const customerName = escapeHtml(data.customerName || data.shippingAddress?.name || data.pickupDetails?.name || "Customer")
      const orderNumber = escapeHtml(data.orderNumber || data._id?.toString().slice(-6) || "N/A")
      const paymentMethodDisplay = escapeHtml(formatPaymentMethod(data.actualPaymentMethod, data.paymentMethod))
      const deliveryAddress = data.deliveryType === "pickup"
        ? (data.pickupDetails ? `Store Pickup: ${escapeHtml(data.pickupDetails.location || "Branch")}` : "Store Pickup")
        : (data.shippingAddress ? `${escapeHtml(data.shippingAddress.address || "")}, ${escapeHtml(data.shippingAddress.city || "")}, ${escapeHtml(data.shippingAddress.country || "")}` : "Standard Delivery")

      const subtotal = Number(data.itemsPrice || 0)
      const shipping = Number(data.shippingPrice || 0)
      const discount = Number(data.discountAmount || 0)
      const total = Number(data.totalPrice || 0)

      const itemsHtml = orderItems
        .map((item) => {
          const name = item.product?.name || item.name || "Product"
          const imgSrc = toAbsoluteUrl(item.product?.image || item.image)
          const size = item.selectedSizeData?.code || item.selectedSizeData?.name || item.size || ""
          const color = item.selectedColorData?.color || item.color || ""
          const qty = Number(item.quantity) || 1
          const price = Number(item.price) || 0
          return `
            <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid ${BRAND_ASSETS.colors.border};">
              <img src="${imgSrc}" alt="${escapeHtml(name)}" width="60" height="60" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-right:14px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};" onerror="this.onerror=null;this.src='${BRAND_ASSETS.logoSquareUrl}';" />
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:600;color:${BRAND_ASSETS.colors.dark};margin-bottom:3px;">${escapeHtml(name)}</div>
                ${size ? `<div style="font-size:12px;color:${BRAND_ASSETS.colors.primary};font-weight:600;">Size: ${escapeHtml(size)}</div>` : ""}
                ${color ? `<div style="font-size:12px;color:${BRAND_ASSETS.colors.textSubtle};font-weight:500;">Color: ${escapeHtml(color)}</div>` : ""}
                <div style="font-size:12px;color:${BRAND_ASSETS.colors.textSubtle};margin-top:2px;">Qty: ${qty} &times; ${formatCurrency(price)}</div>
              </div>
              <div style="font-size:14px;font-weight:700;color:${BRAND_ASSETS.colors.dark};">${formatCurrency(price * qty)}</div>
            </div>
          `
        })
        .join("")

      const content = `
        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.borderGold};border-radius:14px;padding:26px 20px;text-align:center;margin-bottom:28px;">
          <div style="width:58px;height:58px;background-color:${BRAND_ASSETS.colors.primary};border-radius:50%;margin:0 auto 12px;color:#ffffff;font-size:26px;line-height:58px;text-align:center;box-shadow:0 4px 12px rgba(142,105,55,0.25);">
            🛍️
          </div>
          <div style="font-size:20px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin-bottom:6px;">
            Order #${orderNumber}
          </div>
          <div style="font-size:15px;color:${BRAND_ASSETS.colors.primary};font-weight:600;margin-bottom:4px;">
            Hi ${customerName}, thank you for your order!
          </div>
          <div style="font-size:13px;color:${BRAND_ASSETS.colors.textSubtle};">
            Your order has been received and is being prepared with care.
          </div>
        </div>

        <div style="margin-bottom:24px;">
          <h3 style="font-size:14px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">Order Items</h3>
          ${itemsHtml || `<p style="font-size:14px;color:${BRAND_ASSETS.colors.textSubtle};">Order item details</p>`}
        </div>

        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.border};border-radius:12px;padding:18px 20px;margin:24px 0;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;color:${BRAND_ASSETS.colors.textMuted};"><span>Items Subtotal</span><span style="font-weight:500;">${formatCurrency(subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;color:${BRAND_ASSETS.colors.textMuted};"><span>Shipping & Delivery</span><span style="font-weight:500;">${shipping === 0 ? "Free" : formatCurrency(shipping)}</span></div>
          ${discount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;color:${BRAND_ASSETS.colors.primary};font-weight:600;"><span>Discount</span><span>- ${formatCurrency(discount)}</span></div>` : ""}
          <div style="display:flex;justify-content:space-between;border-top:1px solid ${BRAND_ASSETS.colors.border};padding-top:10px;margin-top:10px;font-size:16px;font-weight:700;color:${BRAND_ASSETS.colors.dark};"><span>Total Amount</span><span>${formatCurrency(total)}</span></div>
        </div>

        <div style="background:#ffffff;border:1px solid ${BRAND_ASSETS.colors.border};border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
            <span style="color:${BRAND_ASSETS.colors.textSubtle};">Payment Method:</span>
            <span style="font-weight:600;color:${BRAND_ASSETS.colors.dark};">${paymentMethodDisplay}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;">
            <span style="color:${BRAND_ASSETS.colors.textSubtle};">Delivery Destination:</span>
            <span style="font-weight:500;color:${BRAND_ASSETS.colors.textMuted};text-align:right;max-width:60%;">${deliveryAddress}</span>
          </div>
        </div>

        <div style="text-align:center;margin:30px 0 10px;">
          <a href="${BRAND_ASSETS.websiteUrl}/track-order" target="_blank" class="btn-gold">
            Track Your Order
          </a>
        </div>
      `
      return wrapEmail({
        title: `Order Confirmation #${orderNumber} - Irha's Wardrobe`,
        content,
        senderEmail: "order@irhaas.com",
      })
    }

    case "orderPaymentConfirmation": {
      const orderItems = Array.isArray(data.orderItems) ? data.orderItems : []
      const customerName = escapeHtml(data.customerName || data.shippingAddress?.name || data.pickupDetails?.name || "Customer")
      const orderNumber = escapeHtml(data.orderNumber || (data._id ? data._id.toString().slice(-6) : "N/A"))
      const paymentMethod = escapeHtml(formatPaymentMethod(data.actualPaymentMethod, data.paymentMethod))
      const amountPaid = formatCurrency(data.totalPrice || 0)
      const paymentDate = formatDateTime(data.paidAt || new Date())
      const deliveryAddress = data.deliveryType === "pickup"
        ? (data.pickupDetails ? `Store Pickup: ${escapeHtml(data.pickupDetails.location || "Branch")}` : "Store Pickup")
        : (data.shippingAddress ? `${escapeHtml(data.shippingAddress.address || "")}, ${escapeHtml(data.shippingAddress.city || "")}, ${escapeHtml(data.shippingAddress.country || "")}` : "Standard Delivery")

      const itemsHtml = orderItems
        .map((item) => {
          const name = item.product?.name || item.name || "Product"
          const imgSrc = toAbsoluteUrl(item.product?.image || item.image)
          const size = item.selectedSizeData?.code || item.selectedSizeData?.name || item.size || ""
          const color = item.selectedColorData?.color || item.color || ""
          const qty = Number(item.quantity) || 1
          const price = Number(item.price) || 0
          return `
            <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid ${BRAND_ASSETS.colors.border};">
              <img src="${imgSrc}" alt="${escapeHtml(name)}" width="60" height="60" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-right:14px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};" onerror="this.onerror=null;this.src='${BRAND_ASSETS.logoSquareUrl}';" />
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:600;color:${BRAND_ASSETS.colors.dark};margin-bottom:3px;">${escapeHtml(name)}</div>
                ${size ? `<div style="font-size:12px;color:${BRAND_ASSETS.colors.primary};font-weight:600;">Size: ${escapeHtml(size)}</div>` : ""}
                ${color ? `<div style="font-size:12px;color:${BRAND_ASSETS.colors.textSubtle};font-weight:500;">Color: ${escapeHtml(color)}</div>` : ""}
                <div style="font-size:12px;color:${BRAND_ASSETS.colors.textSubtle};margin-top:2px;">Qty: ${qty} &times; ${formatCurrency(price)}</div>
              </div>
              <div style="font-size:14px;font-weight:700;color:${BRAND_ASSETS.colors.dark};">${formatCurrency(price * qty)}</div>
            </div>
          `
        })
        .join("")

      const content = `
        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.borderGold};border-radius:14px;padding:26px 20px;text-align:center;margin-bottom:28px;">
          <div style="width:58px;height:58px;background-color:${BRAND_ASSETS.colors.primary};border-radius:50%;margin:0 auto 14px;color:#ffffff;font-size:28px;line-height:58px;text-align:center;box-shadow:0 4px 12px rgba(142,105,55,0.25);">
            &#10003;
          </div>
          <h1 style="font-size:22px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 8px;">Payment Received & Confirmed</h1>
          <p style="font-size:14px;color:${BRAND_ASSETS.colors.textMuted};margin:0 0 16px;">Hello ${customerName}, your payment for Order #${orderNumber} has been successfully confirmed.</p>
          <div style="display:inline-block;background:#ffffff;border:1px solid ${BRAND_ASSETS.colors.borderGold};padding:6px 18px;border-radius:20px;font-size:13px;font-weight:600;color:${BRAND_ASSETS.colors.primary};">
            Order #${orderNumber}
          </div>
        </div>

        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.border};border-radius:12px;padding:20px;margin-bottom:24px;">
          <h3 style="font-size:14px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px;">Payment Details</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="padding:6px 0;color:${BRAND_ASSETS.colors.textSubtle};">Amount Paid:</td>
              <td style="padding:6px 0;text-align:right;font-weight:700;color:${BRAND_ASSETS.colors.primary};font-size:16px;">${amountPaid}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${BRAND_ASSETS.colors.textSubtle};">Payment Method:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:${BRAND_ASSETS.colors.dark};">${paymentMethod}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${BRAND_ASSETS.colors.textSubtle};">Payment Status:</td>
              <td style="padding:6px 0;text-align:right;font-weight:600;color:${BRAND_ASSETS.colors.primary};">Paid &#10003;</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${BRAND_ASSETS.colors.textSubtle};">Date & Time:</td>
              <td style="padding:6px 0;text-align:right;color:${BRAND_ASSETS.colors.textMuted};">${paymentDate}</td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom:24px;">
          <h3 style="font-size:14px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px;">Items Ordered</h3>
          ${itemsHtml || `<p style="font-size:14px;color:${BRAND_ASSETS.colors.textSubtle};">Item details</p>`}
        </div>

        <div style="background:#ffffff;border:1px solid ${BRAND_ASSETS.colors.border};border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <div style="font-size:13px;font-weight:700;color:${BRAND_ASSETS.colors.dark};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Delivery Destination</div>
          <div style="font-size:14px;color:${BRAND_ASSETS.colors.textMuted};line-height:1.5;">${deliveryAddress}</div>
        </div>

        <div style="text-align:center;margin:30px 0 10px;">
          <a href="${BRAND_ASSETS.websiteUrl}/track-order" target="_blank" class="btn-gold">
            Track Your Order
          </a>
        </div>
      `
      return wrapEmail({
        title: `Payment Confirmation #${orderNumber} - Irha's Wardrobe`,
        content,
        senderEmail: "order@irhaas.com",
      })
    }

    case "orderStatusUpdate": {
      const orderNumber = escapeHtml(data.orderNumber || data._id?.toString().slice(-6) || "N/A")
      const customerName = escapeHtml(data.customerName || data.shippingAddress?.name || data.pickupDetails?.name || "Customer")

      const statusSteps = [
        { key: "Order Placed", label: "Order Placed", icon: "🛒" },
        { key: "Order Processing", label: "Order Processing", icon: "🔄" },
        { key: "On Hold", label: "On Hold", icon: "⏸️" },
        { key: "Confirmed", label: "Confirmed", icon: "✅" },
        { key: "Ready for Shipment", label: "Ready for Shipment", icon: "📦" },
        { key: "Shipped", label: "Shipped", icon: "📦" },
        { key: "On the Way", label: "On the Way", icon: "🚚" },
        { key: "Out for Delivery", label: "Out for Delivery", icon: "🚚" },
        { key: "Delivered", label: "Delivered", icon: "🎉" },
        { key: "Cancelled", label: "Cancelled", icon: "❌" },
      ]

      const getCurrentStep = (status) => {
        if (!status) return statusSteps[0]
        const normalized = String(status).trim().toLowerCase()
        if (["new", "new order", "order placed"].includes(normalized)) return statusSteps.find(s => s.key === "Order Placed")
        if (["processing", "in process", "order processing"].includes(normalized)) return statusSteps.find(s => s.key === "Order Processing")
        if (["on hold", "on-hold", "hold"].includes(normalized)) return statusSteps.find(s => s.key === "On Hold")
        if (["confirmed", "confirm"].includes(normalized)) return statusSteps.find(s => s.key === "Confirmed")
        if (["ready for shipment", "ready for shipping", "ready to ship", "rts"].includes(normalized)) return statusSteps.find(s => s.key === "Ready for Shipment")
        if (["shipped", "dispatched", "dispatch"].includes(normalized)) return statusSteps.find(s => s.key === "Shipped")
        if (["on the way", "on-the-way"].includes(normalized)) return statusSteps.find(s => s.key === "On the Way")
        if (["out for delivery", "out of delivery", "out-of-delivery"].includes(normalized)) return statusSteps.find(s => s.key === "Out for Delivery")
        if (["delivered"].includes(normalized)) return statusSteps.find(s => s.key === "Delivered")
        if (["cancelled", "canceled"].includes(normalized)) return statusSteps.find(s => s.key === "Cancelled")
        return statusSteps.find(s => s.key === "Order Placed")
      }

      const currentStep = getCurrentStep(data.status)

      const getStatusDescription = (status) => {
        const s = String(status || "").trim().toLowerCase()
        if (["processing", "in process", "order processing"].includes(s)) return "Your order is currently being prepared and processed with care."
        if (["confirmed", "confirm"].includes(s)) return "Your order has been confirmed by our team."
        if (["ready for shipment", "ready for shipping", "ready to ship", "rts"].includes(s)) return "Your order is packed and ready for dispatch."
        if (["shipped", "dispatched", "dispatch"].includes(s)) return "Your order has been dispatched and is on its way to you!"
        if (["on the way", "on-the-way"].includes(s)) return "Your package is on the way to your delivery destination."
        if (["out for delivery", "out of delivery", "out-of-delivery"].includes(s)) return "Your package is out for delivery today!"
        if (["delivered"].includes(s)) return "Your order has been successfully delivered! We hope you love your purchase."
        if (["cancelled", "canceled"].includes(s)) return "Your order has been cancelled."
        if (["on hold", "on-hold", "hold"].includes(s)) return "Your order is currently on hold. We will update you shortly."
        if (["returned"].includes(s)) return "Your order return has been received and processed."
        return "Your order status has been updated."
      }

      // Delivered status invoice
      const normalizedStatusForInvoice = String(data.status || "").trim().toLowerCase()
      const isDeliveredStatus = normalizedStatusForInvoice === "delivered"
      const orderItemsList = Array.isArray(data.orderItems) ? data.orderItems : []
      const itemsSubtotal = orderItemsList.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0)
      const shippingPrice = Number(data.shippingPrice || 0)
      const discountAmount = Number(data.discountAmount || 0)
      const grandTotal = Number(data.totalPrice || itemsSubtotal + shippingPrice - discountAmount)

      const invoiceSection = isDeliveredStatus ? `
        <div style="margin:28px 0;background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.border};border-radius:12px;padding:20px;">
          <h3 style="margin:0 0 14px;font-size:16px;color:${BRAND_ASSETS.colors.dark};font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Delivery Invoice</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="border-bottom:1.5px solid ${BRAND_ASSETS.colors.border};">
                <th style="text-align:left;padding:8px 4px;color:${BRAND_ASSETS.colors.textSubtle};font-weight:600;">Item</th>
                <th style="text-align:center;padding:8px 4px;color:${BRAND_ASSETS.colors.textSubtle};font-weight:600;">Qty</th>
                <th style="text-align:right;padding:8px 4px;color:${BRAND_ASSETS.colors.textSubtle};font-weight:600;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsList.map(it => {
                const name = (it.product && (it.product.name || it.product.title)) || it.name || "Item"
                const sizeInfo = it.selectedSizeData && (it.selectedSizeData.code || it.selectedSizeData.name) ? ` <span style="font-size:12px;color:${BRAND_ASSETS.colors.primary};">(${it.selectedSizeData.code || it.selectedSizeData.name})</span>` : ""
                const qty = Number(it.quantity) || 1
                const lineTotal = (Number(it.price) || 0) * qty
                return `
                  <tr style="border-bottom:1px solid ${BRAND_ASSETS.colors.border};">
                    <td style="padding:10px 4px;color:${BRAND_ASSETS.colors.dark};font-weight:500;">${escapeHtml(name)}${sizeInfo}</td>
                    <td style="padding:10px 4px;text-align:center;color:${BRAND_ASSETS.colors.textSubtle};">${qty}</td>
                    <td style="padding:10px 4px;text-align:right;font-weight:600;color:${BRAND_ASSETS.colors.dark};">${formatCurrency(lineTotal)}</td>
                  </tr>
                `
              }).join("")}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:12px 4px 4px;font-weight:700;color:${BRAND_ASSETS.colors.dark};">Grand Total:</td>
                <td style="padding:12px 4px 4px;text-align:right;font-weight:700;font-size:16px;color:${BRAND_ASSETS.colors.primary};">${formatCurrency(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ` : ""

      const content = `
        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.borderGold};border-radius:14px;padding:28px 20px;text-align:center;margin-bottom:28px;">
          <div style="font-size:20px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin-bottom:6px;">
            Order #${orderNumber}
          </div>
          <div style="font-size:16px;color:${BRAND_ASSETS.colors.dark};font-weight:600;margin-bottom:6px;">
            Hello ${customerName}!
          </div>
          <div style="font-size:14px;color:${BRAND_ASSETS.colors.textMuted};margin-bottom:20px;">
            ${getStatusDescription(data.status)}
          </div>
          <div style="display:inline-block;background:#ffffff;border:1.5px solid ${BRAND_ASSETS.colors.borderGold};border-radius:30px;padding:10px 24px;box-shadow:0 2px 8px rgba(142,105,55,0.12);">
            <span style="font-size:20px;margin-right:8px;vertical-align:middle;">${currentStep.icon}</span>
            <span style="font-size:15px;font-weight:700;color:${BRAND_ASSETS.colors.primary};vertical-align:middle;">${currentStep.label}</span>
          </div>
        </div>

        ${data.trackingId ? `
          <div style="margin:20px 0;background-color:#ffffff;border:1.5px solid ${BRAND_ASSETS.colors.borderGold};border-radius:12px;padding:18px 24px;text-align:center;">
            <div style="font-size:12px;font-weight:700;color:${BRAND_ASSETS.colors.primary};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Shipment Tracking Number</div>
            <div style="font-size:20px;font-weight:700;color:${BRAND_ASSETS.colors.dark};letter-spacing:2px;font-family:Courier, monospace;margin-bottom:6px;">${escapeHtml(data.trackingId)}</div>
            <div style="font-size:12px;color:${BRAND_ASSETS.colors.textSubtle};">You can track this package with your courier.</div>
          </div>
        ` : ""}

        ${data.cancelReason ? `
          <div style="margin:20px 0;background-color:${BRAND_ASSETS.colors.dangerBg};border:1px solid ${BRAND_ASSETS.colors.dangerBorder};border-radius:12px;padding:18px 20px;">
            <div style="font-size:12px;font-weight:700;color:${BRAND_ASSETS.colors.danger};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Cancellation Reason</div>
            <div style="font-size:14px;color:${BRAND_ASSETS.colors.danger};line-height:1.5;">${escapeHtml(data.cancelReason)}</div>
          </div>
        ` : ""}

        ${invoiceSection}

        ${data.sellerMessage ? `
          <div style="margin:24px 0;background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.border};border-radius:12px;padding:18px 20px;">
            <div style="font-size:13px;font-weight:700;color:${BRAND_ASSETS.colors.primary};margin-bottom:6px;">📝 Message from Seller</div>
            <div style="font-size:14px;color:${BRAND_ASSETS.colors.textMuted};line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.sellerMessage)}</div>
          </div>
        ` : ""}

        <div style="text-align:center;margin:30px 0 10px;">
          <a href="${BRAND_ASSETS.websiteUrl}/track-order" target="_blank" class="btn-gold">
            Track Your Order
          </a>
        </div>
      `
      return wrapEmail({
        title: `Order Update #${orderNumber} - Irha's Wardrobe`,
        content,
        senderEmail: "order@irhaas.com",
      })
    }

    case "quotationConfirmation": {
      const quotationNumber = escapeHtml(data.orderNumber || data._id?.toString().slice(-6) || "N/A")
      const customerName = escapeHtml(data.shippingAddress?.name || data.pickupDetails?.name || data.customerName || "Customer")
      const quotationDate = formatDateTime(data.createdAt || new Date())
      const quotationItems = Array.isArray(data.orderItems) ? data.orderItems : []

      const itemsHtml = quotationItems
        .map((item) => {
          const name = item.product?.name || item.name || "Product"
          const imgSrc = toAbsoluteUrl(item.product?.image || item.image)
          const qty = Number(item.quantity) || 1
          const price = Number(item.price) || 0
          return `
            <div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid ${BRAND_ASSETS.colors.border};">
              <img src="${imgSrc}" alt="${escapeHtml(name)}" width="56" height="56" style="width:56px;height:56px;object-fit:cover;border-radius:8px;margin-right:14px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};" onerror="this.onerror=null;this.src='${BRAND_ASSETS.logoSquareUrl}';" />
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:600;color:${BRAND_ASSETS.colors.dark};">${escapeHtml(name)}</div>
                <div style="font-size:12px;color:${BRAND_ASSETS.colors.textSubtle};margin-top:2px;">Qty: ${qty}</div>
              </div>
              <div style="font-size:14px;font-weight:700;color:${BRAND_ASSETS.colors.dark};">${formatCurrency(price * qty)}</div>
            </div>
          `
        })
        .join("")

      const content = `
        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.borderGold};border-radius:14px;padding:26px 20px;text-align:center;margin-bottom:28px;">
          <div style="width:58px;height:58px;background-color:${BRAND_ASSETS.colors.primary};border-radius:50%;margin:0 auto 12px;color:#ffffff;font-size:26px;line-height:58px;text-align:center;">
            📄
          </div>
          <h1 style="font-size:22px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 8px;">Quotation Request Received</h1>
          <p style="font-size:14px;color:${BRAND_ASSETS.colors.textMuted};margin:0 0 14px;">Hi ${customerName}, we have received your quotation request #${quotationNumber}.</p>
          <div style="font-size:12px;color:${BRAND_ASSETS.colors.textSubtle};">Requested on: ${quotationDate}</div>
        </div>

        <div style="margin-bottom:24px;">
          <h3 style="font-size:14px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">Requested Items</h3>
          ${itemsHtml || `<p style="font-size:14px;color:${BRAND_ASSETS.colors.textSubtle};">Quotation items</p>`}
        </div>

        <div style="text-align:center;margin:30px 0 10px;">
          <a href="${BRAND_ASSETS.websiteUrl}" target="_blank" class="btn-gold">
            Visit Irha's Wardrobe
          </a>
        </div>
      `
      return wrapEmail({
        title: `Quotation #${quotationNumber} - Irha's Wardrobe`,
        content,
        senderEmail: "order@irhaas.com",
      })
    }

    case "guestAccountCreated": {
      const name = escapeHtml(data.name || "Customer")
      const email = escapeHtml(data.email || "")
      const password = escapeHtml(data.password || "")
      const content = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:60px;height:60px;background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.borderGold};border-radius:50%;margin:0 auto 16px;font-size:26px;line-height:60px;color:${BRAND_ASSETS.colors.primary};">
            ✨
          </div>
          <h1 style="font-size:22px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 10px;">Welcome to Irha's Wardrobe</h1>
          <p style="font-size:15px;color:${BRAND_ASSETS.colors.textMuted};line-height:1.6;margin:0;">
            Hi <strong>${name}</strong>,<br />
            Thank you for shopping with us! For your convenience, an account has been created so you can track your orders, manage saved addresses, and enjoy an enhanced shopping experience.
          </p>
        </div>

        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1.5px solid ${BRAND_ASSETS.colors.borderGold};border-radius:12px;padding:22px 24px;margin:24px auto;max-width:420px;text-align:left;">
          <div style="margin-bottom:14px;">
            <div style="font-size:12px;font-weight:700;color:${BRAND_ASSETS.colors.textSubtle};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Login Email</div>
            <div style="font-size:16px;font-weight:600;color:${BRAND_ASSETS.colors.dark};">${email}</div>
          </div>
          <div>
            <div style="font-size:12px;font-weight:700;color:${BRAND_ASSETS.colors.textSubtle};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Temporary Password</div>
            <div style="font-size:18px;font-weight:700;color:${BRAND_ASSETS.colors.primary};font-family:Courier, monospace;letter-spacing:1px;">${password}</div>
          </div>
        </div>

        <div style="background-color:#ffffff;border:1px solid ${BRAND_ASSETS.colors.border};border-radius:10px;padding:14px 18px;margin:20px 0;text-align:center;">
          <p style="margin:0;font-size:13px;color:${BRAND_ASSETS.colors.textSubtle};line-height:1.5;">
            🔒 For security, we recommend changing your password after logging in from your profile.
          </p>
        </div>

        <div style="text-align:center;margin:30px 0 10px;">
          <a href="${BRAND_ASSETS.websiteUrl}/login" target="_blank" class="btn-gold">
            Login to Your Account
          </a>
        </div>
      `
      return wrapEmail({
        title: "Your Account Credentials - Irha's Wardrobe",
        content,
        senderEmail: "info@irhaas.com",
      })
    }

    case "accountDeletion": {
      const name = escapeHtml(data.name || "User")
      const code = escapeHtml(data.code || "000000")
      const content = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:60px;height:60px;background-color:${BRAND_ASSETS.colors.dangerBg};border:1px solid ${BRAND_ASSETS.colors.dangerBorder};border-radius:50%;margin:0 auto 16px;font-size:26px;line-height:60px;color:${BRAND_ASSETS.colors.danger};">
            ⚠️
          </div>
          <h1 style="font-size:22px;font-weight:700;color:${BRAND_ASSETS.colors.danger};margin:0 0 10px;">Account Deletion Request</h1>
          <p style="font-size:15px;color:${BRAND_ASSETS.colors.textMuted};line-height:1.6;margin:0;">
            Hi <strong>${name}</strong>,<br />
            We received a request to permanently delete your Irha's Wardrobe account. To confirm this action, please enter the code below:
          </p>
        </div>

        <div style="background-color:${BRAND_ASSETS.colors.dangerBg};border:1.5px solid ${BRAND_ASSETS.colors.dangerBorder};border-radius:12px;margin:24px auto;padding:20px 0;text-align:center;max-width:320px;">
          <div style="font-size:32px;font-weight:700;color:${BRAND_ASSETS.colors.danger};letter-spacing:8px;font-family:Courier, monospace;">${code}</div>
        </div>

        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.border};border-radius:10px;padding:16px 20px;margin:20px 0;text-align:left;">
          <strong style="color:${BRAND_ASSETS.colors.danger};font-size:13px;">⚠️ Warning: Permanent Action</strong>
          <ul style="margin:8px 0 0 0;padding-left:18px;font-size:13px;color:${BRAND_ASSETS.colors.textSubtle};line-height:1.6;">
            <li>All personal data and saved addresses will be deleted.</li>
            <li>Your past order history and loyalty benefits will be removed.</li>
            <li>This action cannot be undone.</li>
          </ul>
        </div>

        <p style="text-align:center;font-size:13px;color:${BRAND_ASSETS.colors.textSubtle};">
          This code will expire in 10 minutes. If you did not make this request, please change your password immediately.
        </p>
      `
      return wrapEmail({
        title: "Account Deletion Verification - Irha's Wardrobe",
        content,
        senderEmail: "info@irhaas.com",
      })
    }

    case "reviewVerification": {
      const name = escapeHtml(data.name || "Customer")
      const code = escapeHtml(data.code || "000000")
      const productName = escapeHtml(data.productName || "Product")
      const rating = Number(data.rating || 5)
      const stars = "★".repeat(Math.max(1, Math.min(5, rating))) + "☆".repeat(Math.max(0, 5 - rating))
      const comment = escapeHtml(data.comment || "")

      const content = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="width:60px;height:60px;background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.borderGold};border-radius:50%;margin:0 auto 16px;font-size:26px;line-height:60px;color:${BRAND_ASSETS.colors.primary};">
            ⭐
          </div>
          <h1 style="font-size:22px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 10px;">Verify Your Product Review</h1>
          <p style="font-size:15px;color:${BRAND_ASSETS.colors.textMuted};line-height:1.6;margin:0;">
            Hi <strong>${name}</strong>,<br />
            Thank you for sharing your feedback with <strong>Irha's Wardrobe</strong>. Please enter the verification code below to publish your review:
          </p>
        </div>

        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1.5px solid ${BRAND_ASSETS.colors.borderGold};border-radius:12px;margin:24px auto;padding:20px 0;text-align:center;max-width:320px;">
          <div style="font-size:32px;font-weight:700;color:${BRAND_ASSETS.colors.primary};letter-spacing:8px;font-family:Courier, monospace;">${code}</div>
        </div>

        <div style="background-color:#ffffff;border:1px solid ${BRAND_ASSETS.colors.border};border-radius:10px;padding:16px 20px;margin:20px 0;text-align:left;">
          <div style="font-size:14px;font-weight:600;color:${BRAND_ASSETS.colors.dark};margin-bottom:4px;">${productName}</div>
          <div style="font-size:16px;color:#d97706;margin-bottom:8px;">${stars}</div>
          ${comment ? `<div style="font-size:13px;color:${BRAND_ASSETS.colors.textMuted};font-style:italic;">&ldquo;${comment}&rdquo;</div>` : ""}
        </div>

        <p style="text-align:center;font-size:13px;color:${BRAND_ASSETS.colors.textSubtle};">
          This code will expire in 10 minutes.
        </p>
      `
      return wrapEmail({
        title: "Verify Your Product Review - Irha's Wardrobe",
        content,
        senderEmail: "info@irhaas.com",
      })
    }

    default: {
      const content = `
        <div style="text-align:center;padding:20px 0;">
          <h2 style="font-size:22px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 12px;">Irha's Wardrobe</h2>
          <p style="font-size:15px;color:${BRAND_ASSETS.colors.textMuted};line-height:1.6;margin:0 0 24px;">
            Thank you for being part of Irha's Wardrobe. Discover the latest in luxury fashion, premium apparel, and timeless collections.
          </p>
          <a href="${BRAND_ASSETS.websiteUrl}" target="_blank" class="btn-gold">
            Visit Our Store
          </a>
        </div>
      `
      return wrapEmail({
        title: "Irha's Wardrobe",
        content,
        senderEmail: "info@irhaas.com",
      })
    }
  }
}

/**
 * Internal Admin Order Notification Template
 */
export const getAdminOrderNotificationTemplate = (data) => {
  const orderItems = Array.isArray(data.orderItems) ? data.orderItems : []
  const orderNumber = escapeHtml(data.orderNumber || data._id?.toString().slice(-6) || "N/A")
  const customerName = escapeHtml(data.shippingAddress?.name || data.pickupDetails?.name || data.user?.name || "N/A")
  const customerEmail = escapeHtml(data.shippingAddress?.email || data.pickupDetails?.email || data.user?.email || "N/A")
  const customerPhone = escapeHtml(data.shippingAddress?.phone || data.pickupDetails?.phone || "N/A")
  const orderDate = data.createdAt || new Date().toISOString()
  const isGuestOrder = !data.user
  const userId = escapeHtml(data.user?._id?.toString?.() || data.user?.toString?.() || "N/A")

  const shippingAddress = data.shippingAddress
    ? `${data.shippingAddress.address || ""}, ${data.shippingAddress.city || ""}, ${data.shippingAddress.state || ""}, ${data.shippingAddress.zipCode || ""}`
        .replace(/,\s*,/g, ",")
        .replace(/^,\s*|\s*,$/g, "")
        .trim() || "N/A"
    : "N/A"

  const pickupLocation = data.pickupDetails?.location || "N/A"
  const pickupStoreId = data.pickupDetails?.storeId || "N/A"
  const customerNotes = data.customerNotes || "N/A"

  const itemRows = orderItems
    .map((item, index) => {
      const name = item.product?.name || item.name || "Product"
      const quantity = Number(item.quantity) || 1
      const unitPrice = Number(item.price) || 0
      const lineTotal = quantity * unitPrice
      const size = item.selectedSizeData ? ` | Size: ${item.selectedSizeData.code || item.selectedSizeData.name}` : ""
      const color = item.selectedColorData?.color ? ` | Color: ${item.selectedColorData.color}` : ""

      return `
        <tr>
          <td style="padding:10px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:center;">${index + 1}</td>
          <td style="padding:10px;border:1px solid ${BRAND_ASSETS.colors.border};font-weight:600;color:${BRAND_ASSETS.colors.dark};">${escapeHtml(name)}${escapeHtml(size)}${escapeHtml(color)}</td>
          <td style="padding:10px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:center;">${quantity}</td>
          <td style="padding:10px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:right;">${formatCurrency(unitPrice)}</td>
          <td style="padding:10px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:right;font-weight:700;">${formatCurrency(lineTotal)}</td>
        </tr>
      `
    })
    .join("")

  const itemsPrice = Number(data.itemsPrice) || 0
  const shippingPrice = Number(data.shippingPrice) || 0
  const totalPrice = Number(data.totalPrice) || 0

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>New Order #${orderNumber} - Admin Notification</title>
    </head>
    <body style="margin:0;padding:20px;background-color:${BRAND_ASSETS.colors.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND_ASSETS.colors.textMuted};">
      <div style="max-width:850px;margin:0 auto;background:#ffffff;border:1px solid ${BRAND_ASSETS.colors.border};border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
        <!-- Admin Header -->
        <div style="background-color:${BRAND_ASSETS.colors.dark};color:#ffffff;padding:22px 24px;border-bottom:4px solid ${BRAND_ASSETS.colors.primary};">
          <table style="width:100%;">
            <tr>
              <td>
                <h2 style="margin:0;font-size:20px;font-weight:700;letter-spacing:0.3px;">Irha's Wardrobe &bull; New Order Received</h2>
                <div style="margin-top:4px;font-size:13px;color:${BRAND_ASSETS.colors.primaryLight};">Order #${orderNumber} (${escapeHtml(data._id?.toString?.() || "N/A")})</div>
              </td>
              <td style="text-align:right;">
                <img src="${BRAND_ASSETS.logoWideUrl}" alt="Irha's Wardrobe" width="140" style="max-width:140px;height:auto;filter:brightness(0) invert(1);" />
              </td>
            </tr>
          </table>
        </div>

        <div style="padding:24px;">
          <h3 style="margin:0 0 10px;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;color:${BRAND_ASSETS.colors.primary};">Customer Details</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};width:200px;background:${BRAND_ASSETS.colors.surface};font-weight:600;">Name</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};">${customerName}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:600;">Email</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};"><a href="mailto:${customerEmail}" style="color:${BRAND_ASSETS.colors.primary};text-decoration:none;">${customerEmail}</a></td></tr>
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:600;">Phone</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};">${customerPhone}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:600;">Customer Type</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};">${isGuestOrder ? "Guest Checkout" : "Registered User"}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:600;">User ID</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};">${userId}</td></tr>
          </table>

          <h3 style="margin:0 0 10px;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;color:${BRAND_ASSETS.colors.primary};">Order & Delivery Details</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};width:200px;background:${BRAND_ASSETS.colors.surface};font-weight:600;">Order Date</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};">${formatDateTime(orderDate)}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:600;">Delivery Method</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};">${escapeHtml(formatDeliveryType(data.deliveryType))}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:600;">Shipping Address</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};">${escapeHtml(shippingAddress)}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:600;">Pickup Details</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};">${escapeHtml(pickupLocation)} (${escapeHtml(pickupStoreId)})</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:600;">Payment Method</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};font-weight:600;">${escapeHtml(formatPaymentMethod(data.actualPaymentMethod, data.paymentMethod))}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:600;">Status</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};font-weight:600;color:${BRAND_ASSETS.colors.primary};">${escapeHtml(data.status || "New")}</td></tr>
            ${customerNotes && customerNotes !== "N/A" ? `<tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:600;">Customer Notes</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};">${escapeHtml(customerNotes)}</td></tr>` : ""}
          </table>

          <h3 style="margin:0 0 10px;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;color:${BRAND_ASSETS.colors.primary};">Ordered Products</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
            <thead>
              <tr style="background:${BRAND_ASSETS.colors.surface};">
                <th style="padding:10px;border:1px solid ${BRAND_ASSETS.colors.border};width:40px;">#</th>
                <th style="padding:10px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:left;">Product</th>
                <th style="padding:10px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:center;width:60px;">Qty</th>
                <th style="padding:10px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:right;width:120px;">Unit Price</th>
                <th style="padding:10px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:right;width:120px;">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows || `<tr><td colspan="5" style="padding:12px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:center;">No items recorded</td></tr>`}
            </tbody>
          </table>

          <h3 style="margin:0 0 10px;font-size:15px;text-transform:uppercase;letter-spacing:0.5px;color:${BRAND_ASSETS.colors.primary};">Financial Summary</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};width:200px;background:${BRAND_ASSETS.colors.surface};">Items Subtotal</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:right;">${formatCurrency(itemsPrice)}</td></tr>
            <tr><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};">Shipping Fee</td><td style="padding:8px 12px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:right;">${(shippingPrice || 0) === 0 ? "Free" : formatCurrency(shippingPrice)}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid ${BRAND_ASSETS.colors.border};background:${BRAND_ASSETS.colors.surface};font-weight:700;font-size:15px;">Total Order Amount</td><td style="padding:10px 12px;border:1px solid ${BRAND_ASSETS.colors.border};text-align:right;font-weight:700;font-size:16px;color:${BRAND_ASSETS.colors.primary};">${formatCurrency(totalPrice)}</td></tr>
          </table>
        </div>
      </div>
    </body>
    </html>
  `
}

// Generic send email function with sender type and automatic fallback.
const sendEmail = async (to, subject, html, senderType = "support", options = {}) => {
  try {
    console.log(`[sendEmail] Starting - To: ${to}, Subject: ${subject}, Sender: ${senderType}`)
    const { transporter, from } = getMailConfig(senderType)
    console.log(`[sendEmail] Transporter configured, From: ${from}`)
    const mailOptions = {
      from,
      to,
      subject,
      html,
      ...(options.headers ? { headers: options.headers } : {}),
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
      ...(options.text ? { text: options.text } : {}),
    }
    const result = await transporter.sendMail(mailOptions)
    console.log(`[sendEmail] Email sent successfully from ${from}:`, result.messageId)
    return { success: true, messageId: result.messageId }
  } catch (error) {
    console.warn(`[sendEmail] Primary transporter error for ${senderType}:`, error.message)

    // Fallback: if order/sales sending fails, route through verified support transporter
    if (senderType === "order" || senderType === "sales") {
      try {
        console.warn(`[sendEmail] Attempting fallback delivery via verified support transporter (info@irhaas.com)...`)
        const fallbackFrom = `Irha's Wardrobe Orders <${process.env.SUPPORT_EMAIL_USER || "info@irhaas.com"}>`
        const fallbackOptions = {
          from: fallbackFrom,
          to,
          subject,
          html,
          replyTo: process.env.ORDER_EMAIL_USER || "order@irhaas.com",
          ...(options.headers ? { headers: options.headers } : {}),
          ...(options.text ? { text: options.text } : {}),
        }
        const fallbackResult = await supportTransporter.sendMail(fallbackOptions)
        console.log(`[sendEmail] Fallback email delivered successfully from ${fallbackFrom}:`, fallbackResult.messageId)
        return { success: true, messageId: fallbackResult.messageId, fallbackUsed: true }
      } catch (fallbackError) {
        console.error(`[sendEmail] Fallback transporter also failed:`, fallbackError.message)
      }
    }

    // Fallback: if support/info sending fails, attempt delivery via contact mailbox
    if (senderType === "support" || senderType === "info") {
      try {
        console.warn(`[sendEmail] Support transporter failed. Attempting fallback via contact mailbox...`)
        const contactTransporter = nodemailer.createTransport({
          host: process.env.SUPPORT_EMAIL_HOST || "smtp.hostinger.com",
          port: Number(process.env.SUPPORT_EMAIL_PORT) || 465,
          secure: process.env.SUPPORT_EMAIL_SECURE !== "false",
          auth: {
            user: process.env.CONTACT_EMAIL || "contact@irhaas.com",
            pass: process.env.SUPPORT_EMAIL_PASS || "@Tech#38521",
          },
          pool: true,
          connectionTimeout: 10000,
        })
        const fallbackOptions = {
          from: `Irha's Wardrobe <${process.env.CONTACT_EMAIL || "contact@irhaas.com"}>`,
          to,
          subject,
          html,
          replyTo: process.env.SUPPORT_EMAIL_USER || "info@irhaas.com",
          ...(options.headers ? { headers: options.headers } : {}),
          ...(options.text ? { text: options.text } : {}),
        }
        const fallbackResult = await contactTransporter.sendMail(fallbackOptions)
        console.log(`[sendEmail] Fallback email delivered successfully via contact transporter:`, fallbackResult.messageId)
        return { success: true, messageId: fallbackResult.messageId, fallbackUsed: true }
      } catch (fallbackError) {
        console.error(`[sendEmail] Contact fallback transporter also failed:`, fallbackError.message)
      }
    }

    console.error("[sendEmail] Failed to send email:", error)
    throw new Error(`Email sending failed: ${error.message}`)
  }
}

// Send verification email
export const sendVerificationEmail = async (email, name, code) => {
  try {
    const html = getEmailTemplate("emailVerification", { name, code })
    const text = `Hi ${name || "User"},\n\nThank you for registering with Irha's Wardrobe.\n\nYour email verification code is: ${code}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this, you can safely ignore this email.\n\nBest regards,\nIrha's Wardrobe Team`
    await sendEmail(email, "Verify Your Email - Irha's Wardrobe", html, "support", { text })
    return { success: true }
  } catch (error) {
    console.error("Failed to send verification email:", error)
    throw error
  }
}

// Send order placed email
export const sendOrderPlacedEmail = async (order) => {
  try {
    const orderData = typeof order.toObject === "function" ? order.toObject() : order
    const orderNumber = (orderData._id || "").toString().slice(-6)

    const { customerEmail, customerName } = await resolveCustomerInfo(orderData)

    if (!customerEmail) {
      console.warn(`[sendOrderPlacedEmail] No customer email found for order ${orderData._id}. Sending internal email only.`)
    }

    const isGuestOrder = !orderData.user
    const recipientsSent = []
    const orderEmail = ORDER_NOTIFICATION_EMAIL || ""

    const shouldSendCustomerEmail =
      !!customerEmail &&
      (!orderEmail || customerEmail.toLowerCase().trim() !== orderEmail.toLowerCase().trim())

    if (shouldSendCustomerEmail) {
      const customerHtml = getEmailTemplate("orderConfirmation", {
        ...orderData,
        orderNumber,
        customerName,
        customerEmail,
      })

      const customerSubject = `Order Confirmation #${orderNumber} - Irha's Wardrobe`
      await sendEmail(customerEmail, customerSubject, customerHtml, "order")
      recipientsSent.push(customerEmail)
    }

    if (orderEmail) {
      const adminHtml = getAdminOrderNotificationTemplate({
        ...orderData,
        orderNumber,
        customerName,
        customerEmail,
      })
      const adminSubject = `New Order #${orderNumber} - Admin Notification`
      await sendEmail(orderEmail, adminSubject, adminHtml, "order")
      recipientsSent.push(orderEmail)
    }

    if (recipientsSent.length === 0) {
      console.error("No email recipients found for order:", orderData._id)
      return { success: false, error: "No recipients" }
    }

    console.log(
      `[sendOrderPlacedEmail] Sent order placed emails for ${isGuestOrder ? "GUEST" : "LOGGED-IN"} user order ${orderData._id} to ${recipientsSent.join(", ")}`,
    )
    return { success: true, recipients: recipientsSent }
  } catch (error) {
    console.error("Failed to send order placed email:", error)
    throw error
  }
}

// Send order payment confirmation email
export const sendOrderPaymentConfirmationEmail = async (orderInput) => {
  try {
    const orderData = typeof orderInput.toObject === "function" ? orderInput.toObject() : orderInput
    const orderId = orderData._id ? orderData._id.toString() : ""

    if (orderData.paymentEmailSentAt) {
      console.log(`[sendOrderPaymentConfirmationEmail] Payment email already sent for order ${orderId} on ${orderData.paymentEmailSentAt}`)
      return { success: true, alreadySent: true }
    }

    const { customerEmail, customerName } = await resolveCustomerInfo(orderData)
    const orderNumber = orderId.slice(-6)
    const orderEmail = ORDER_NOTIFICATION_EMAIL || ""
    const recipientsSent = []

    const shouldSendCustomerEmail =
      !!customerEmail &&
      (!orderEmail || customerEmail.toLowerCase().trim() !== orderEmail.toLowerCase().trim())

    const templateData = {
      ...orderData,
      orderNumber,
      customerName,
      customerEmail,
    }

    if (shouldSendCustomerEmail) {
      const customerHtml = getEmailTemplate("orderPaymentConfirmation", templateData)
      const customerSubject = `Payment Confirmation #${orderNumber} - Irha's Wardrobe`
      await sendEmail(customerEmail, customerSubject, customerHtml, "order")
      recipientsSent.push(customerEmail)
    }

    if (orderEmail) {
      const adminHtml = getAdminOrderNotificationTemplate({
        ...templateData,
      })
      const adminSubject = `Payment Received #${orderNumber} - Admin Notification`
      await sendEmail(orderEmail, adminSubject, adminHtml, "order")
      recipientsSent.push(orderEmail)
    }

    if (orderData._id) {
      try {
        await Order.findByIdAndUpdate(orderData._id, { paymentEmailSentAt: new Date() })
      } catch (dbErr) {
        console.warn("[sendOrderPaymentConfirmationEmail] Could not update paymentEmailSentAt:", dbErr.message)
      }
    }

    console.log(
      `[sendOrderPaymentConfirmationEmail] Payment confirmation email sent for order ${orderId} to ${recipientsSent.join(", ")}`,
    )
    return { success: true, recipients: recipientsSent }
  } catch (error) {
    console.error("Failed to send order payment confirmation email:", error)
    return { success: false, error: error.message }
  }
}

// Send quotation created email
export const sendQuotationCreatedEmail = async (quotation) => {
  try {
    const quotationNumber = quotation._id.toString().slice(-6)
    const customerName = quotation.shippingAddress?.name || quotation.pickupDetails?.name || quotation.user?.name || "Customer"
    const customerEmail = quotation.shippingAddress?.email || quotation.pickupDetails?.email || quotation.user?.email

    const quotationData = typeof quotation.toObject === "function" ? quotation.toObject() : quotation
    const recipientsSent = []
    const orderEmail = ORDER_NOTIFICATION_EMAIL || ""

    const shouldSendCustomerEmail =
      !!customerEmail &&
      (!orderEmail || customerEmail.toLowerCase().trim() !== orderEmail.toLowerCase().trim())

    if (shouldSendCustomerEmail) {
      const customerHtml = getEmailTemplate("quotationConfirmation", {
        ...quotationData,
        orderNumber: quotationNumber,
        customerName,
        customerEmail,
      })

      const customerSubject = `Quotation #${quotationNumber} - Irha's Wardrobe`
      await sendEmail(customerEmail, customerSubject, customerHtml, "order")
      recipientsSent.push(customerEmail)
    }

    if (orderEmail) {
      const adminHtml = getAdminOrderNotificationTemplate({
        ...quotationData,
        orderNumber: quotationNumber,
        customerName,
        customerEmail,
      })
      const adminSubject = `New Quotation #${quotationNumber} - Admin Notification`
      await sendEmail(orderEmail, adminSubject, adminHtml, "order")
      recipientsSent.push(orderEmail)
    }

    return { success: true, recipients: recipientsSent }
  } catch (error) {
    console.error("Failed to send quotation created email:", error)
    throw error
  }
}

// Send order status update email
export const sendOrderStatusUpdateEmail = async (order) => {
  try {
    const orderData = typeof order.toObject === "function" ? order.toObject() : order
    const normalizedStatus = (orderData.status || "").toString().trim().toLowerCase()
    const sendToCustomer = normalizedStatus !== "deleted"
    const orderNumber = (orderData._id || "").toString().slice(-6)

    const { customerEmail, customerName } = await resolveCustomerInfo(orderData)

    if (!customerEmail && sendToCustomer) {
      console.warn(`[sendOrderStatusUpdateEmail] No customer email found for order ${orderData._id}. Sending internal email only.`)
    }

    const recipients = getOrderEmailRecipients(customerEmail, sendToCustomer)
    if (recipients.length === 0) {
      console.error("No email recipients found for order:", orderData._id)
      return { success: false, error: "No recipients" }
    }

    const html = getEmailTemplate("orderStatusUpdate", {
      ...orderData,
      orderNumber,
      customerName,
      customerEmail,
    })

    const statusMessages = {
      processing: "Order Processing",
      "in process": "Order Processing",
      "order processing": "Order Processing",
      placed: "Order Placed",
      "order placed": "Order Placed",
      "new order": "Order Placed",
      new: "Order Placed",
      confirmed: "Order Confirmed",
      "ready for shipment": "Order Ready for Shipment",
      "ready for shipping": "Order Ready for Shipment",
      "ready to ship": "Order Ready for Shipment",
      rts: "Order Ready for Shipment",
      shipped: "Order Shipped",
      dispatched: "Order Dispatched",
      "on the way": "Order On The Way",
      "out for delivery": "Order Out for Delivery",
      delivered: "Order Delivered",
      cancelled: "Order Cancelled",
      canceled: "Order Cancelled",
      hold: "Order On Hold",
      "on hold": "Order On Hold",
      returned: "Order Returned",
    }

    const subject = `${statusMessages[normalizedStatus] || "Order Update"} #${orderNumber} - Irha's Wardrobe`
    for (const recipient of recipients) {
      await sendEmail(recipient, subject, html, "order")
    }

    console.log(`[sendOrderStatusUpdateEmail] Email sent successfully for order ${orderData._id} to ${recipients.length} recipient(s)`)
    return { success: true, recipients }
  } catch (error) {
    console.error("Failed to send order status update email:", error)
    return { success: false, error: error.message }
  }
}

// Send review verification email
export const sendReviewVerificationEmail = async (email, name, code, productName, rating, comment) => {
  try {
    const html = getEmailTemplate("reviewVerification", { name, code, productName, rating, comment })
    await sendEmail(email, "Verify Your Product Review - Irha's Wardrobe", html, "support")
    return { success: true }
  } catch (error) {
    console.error("Failed to send review verification email:", error)
    throw error
  }
}

// Send account deletion verification email
export const sendAccountDeletionEmail = async (email, name, code) => {
  try {
    const html = getEmailTemplate("accountDeletion", { name, code })
    await sendEmail(email, "Account Deletion Verification - Irha's Wardrobe", html, "support")
    return { success: true }
  } catch (error) {
    console.error("[sendAccountDeletionEmail] Failed to send account deletion email:", error)
    throw error
  }
}

// Send guest account created email with login credentials
export const sendGuestAccountCreatedEmail = async (email, name, password) => {
  try {
    const html = getEmailTemplate("guestAccountCreated", { name, email, password })
    await sendEmail(email, "Your Irha's Wardrobe Account Has Been Created - Irha's Wardrobe", html, "support")
    return { success: true }
  } catch (error) {
    console.error("[sendGuestAccountCreatedEmail] Failed to send email:", error)
    throw error
  }
}

// Send newsletter confirmation
export const sendNewsletterConfirmation = async (email, preferences) => {
  const content = `
    <div style="text-align:center;padding:10px 0;">
      <div style="width:60px;height:60px;background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.borderGold};border-radius:50%;margin:0 auto 16px;font-size:26px;line-height:60px;color:${BRAND_ASSETS.colors.primary};">
        💌
      </div>
      <h2 style="font-size:22px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 12px;">Welcome to Irha's Wardrobe Newsletter!</h2>
      <p style="font-size:15px;color:${BRAND_ASSETS.colors.textMuted};line-height:1.6;margin:0 0 20px;">
        Thank you for subscribing to our newsletter! You'll now be the first to know about new collection launches, exclusive offers, and VIP seasonal arrivals.
      </p>
      ${preferences && preferences.length ? `
        <div style="background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.border};border-radius:10px;padding:14px 18px;margin:20px 0;font-size:13px;color:${BRAND_ASSETS.colors.textMuted};">
          Selected preferences: <strong>${escapeHtml(preferences.join(", "))}</strong>
        </div>
      ` : ""}
      <div style="text-align:center;margin-top:24px;">
        <a href="${BRAND_ASSETS.websiteUrl}" target="_blank" class="btn-gold">
          Explore The Collection
        </a>
      </div>
    </div>
  `
  const html = wrapEmail({
    title: "Newsletter Subscription Confirmed - Irha's Wardrobe",
    content,
    senderEmail: "info@irhaas.com",
  })
  await sendEmail(email, "Newsletter Subscription Confirmed - Irha's Wardrobe", html, "support")
}

// Send reset password email
export const sendResetPasswordEmail = async (email, name, resetLink) => {
  try {
    const content = `
      <div style="text-align:center;padding:10px 0;">
        <div style="width:60px;height:60px;background-color:${BRAND_ASSETS.colors.surface};border:1px solid ${BRAND_ASSETS.colors.borderGold};border-radius:50%;margin:0 auto 16px;font-size:26px;line-height:60px;color:${BRAND_ASSETS.colors.primary};">
          🔐
        </div>
        <h2 style="font-size:22px;font-weight:700;color:${BRAND_ASSETS.colors.dark};margin:0 0 12px;">Reset Your Password</h2>
        <p style="font-size:15px;color:${BRAND_ASSETS.colors.textMuted};line-height:1.6;margin:0 0 24px;">
          Hi <strong>${escapeHtml(name || "Customer")}</strong>,<br />
          We received a request to reset your password for your Irha's Wardrobe account. Click the button below to choose a new password:
        </p>
        <div style="margin:28px 0;">
          <a href="${resetLink}" target="_blank" class="btn-gold">
            Reset Password
          </a>
        </div>
        <p style="font-size:13px;color:${BRAND_ASSETS.colors.textSubtle};margin-top:24px;">
          This link is valid for 60 minutes. If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    `
    const html = wrapEmail({
      title: "Reset Your Password - Irha's Wardrobe",
      content,
      senderEmail: "info@irhaas.com",
    })
    await sendEmail(email, "Reset Your Password - Irha's Wardrobe", html, "support")
    return { success: true }
  } catch (error) {
    console.error("Failed to send reset password email:", error)
    throw error
  }
}

// Backward compatibility exports
export const sendOrderNotification = sendOrderStatusUpdateEmail
export const sendTrackingUpdateEmail = sendOrderStatusUpdateEmail

export { sendEmail }

export default {
  sendVerificationEmail,
  sendOrderPlacedEmail,
  sendOrderPaymentConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendOrderNotification,
  sendTrackingUpdateEmail,
  sendQuotationCreatedEmail,
  sendReviewVerificationEmail,
  sendAccountDeletionEmail,
  sendGuestAccountCreatedEmail,
  sendResetPasswordEmail,
  sendNewsletterConfirmation,
  getEmailTemplate,
  getAdminOrderNotificationTemplate,
  BRAND_ASSETS,
}
