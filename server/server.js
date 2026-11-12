import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, ".env"), override: true })
dotenv.config({ override: false })

import express from "express"
import cors from "cors"
import compression from "compression"
import fs from "fs"
import sharp from "sharp"
import connectDB, { connectBlogDB } from "./config/db.js"
import config from "./config/config.js"
import { notFound, errorHandler } from "./middleware/errorMiddleware.js"
import { ensurePortAvailable, setupGracefulShutdown } from "./utils/portManager.js"
import cacheService from "./services/cacheService.js"
import { attachCacheService, autoInvalidateAllCacheOnMutation } from "./middleware/cacheMiddleware.js"
import publicCache from "./middleware/publicCacheMiddleware.js"



import googleMerchantRoutes from "./routes/googleMerchantRoutes.js"
import acerProductsRoutes from "./routes/acerProductsRoutes.js"
import sitemapRoutes from './routes/sitemapRoutes.js'
import indexNowRoutes from "./routes/indexNowRoutes.js"

// Routes
import userRoutes from "./routes/userRoutes.js"
import productRoutes from "./routes/productRoutes.js"
import orderRoutes from "./routes/orderRoutes.js"
import uploadRoutes from "./routes/uploadRoutes.js"
import categoryRoutes from "./routes/categoryRoutes.js"
import subCategoryRoutes from "./routes/subCategoryRoutes.js"
import brandRoutes from "./routes/brandRoutes.js"
import colorRoutes from "./routes/colorRoutes.js"
import sizeRoutes from "./routes/sizeRoutes.js"
import unitRoutes from "./routes/unitRoutes.js"
import volumeRoutes from "./routes/volumeRoutes.js"
import warrantyRoutes from "./routes/warrantyRoutes.js"
import taxRoutes from "./routes/taxRoutes.js"
import productSystemOptionRoutes from "./routes/productSystemOptionRoutes.js"
import deliveryChargeRoutes from "./routes/deliveryChargeRoutes.js"
import paymentMethodChargeRoutes from "./routes/paymentMethodChargeRoutes.js"
import couponRoutes from "./routes/couponRoutes.js"
import appDiscountRoutes from "./routes/appDiscountRoutes.js"
import loyaltyRoutes from "./routes/loyaltyRoutes.js"
import referralRoutes from "./routes/referralRoutes.js"
import notificationRoutes from "./routes/notificationRoutes.js"
import { startPushScheduler } from "./utils/push.js"
import popupSettingsRoutes from "./routes/popupSettingsRoutes.js"
import bannerRoutes from "./routes/bannerRoutes.js"
import bannerCardRoutes from "./routes/bannerCardRoutes.js"
import homeSectionRoutes from "./routes/homeSectionRoutes.js"
import offerPageRoutes from "./routes/offerPageRoutes.js"
import offerProductRoutes from "./routes/offerProductRoutes.js"
import offerBrandRoutes from "./routes/offerBrandRoutes.js"
import offerCategoryRoutes from "./routes/offerCategoryRoutes.js"
import blogRoutes from "./routes/blogRoutes.js"
import blogCategoryRoutes from "./routes/blogCategoryRoutes.js"
import blogTopicRoutes from "./routes/blogTopicRoutes.js"
import blogRatingRoutes from "./routes/blogRatingRoutes.js"
import blogBrandRoutes from "./routes/blogBrandRoutes.js"
import blogCommentRoutes from "./routes/blogCommentRoutes.js"
import blogDashboardRoutes from "./routes/blogDashboardRoutes.js"
import settingsRoutes from "./routes/settingsRoutes.js"
import themeRoutes from "./routes/themeRoutes.js"
import wishlistRoutes from "./routes/wishlistRoutes.js"
import requestCallbackRoutes from "./routes/requestCallbackRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import emailTemplateRoutes from "./routes/emailTemplateRoutes.js"
import emailBuilderRoutes from "./routes/emailBuilderRoutes.js"
import emailCampaignRoutes from "./routes/emailCampaignRoutes.js"
import unsubscribeRoutes from "./routes/unsubscribeRoutes.js"
import { recoverInterrupted } from "./services/campaignSender.js"
import newsletterRoutes from "./routes/newsletterRoutes.js"
import tamaraAdminRoutes from "./routes/tamaraAdminRoutes.js"
import { captureRawBody, webhookRateLimit, authenticateWebhook } from "./middleware/webhookMiddleware.js"
import whatsappRoutes from "./routes/whatsappRoutes.js"
import appRoutes from "./routes/appRoutes.js"
import mobileApiRoutes from "./routes/mobileApiRoutes.js"
import reviewRoutes from "./routes/reviewRoutes.js"
import adminReviewRoutes from "./routes/adminReviewRoutes.js"
import priceAdjustmentRoutes from "./routes/priceAdjustmentRoutes.js"
import redirectRoutes from "./routes/redirectRoutes.js"
import bulkPurchaseRoutes from "./routes/bulkPurchaseRoutes.js"
import buyerProtectionRoutes from "./routes/buyerProtectionRoutes.js"
import cacheRoutes from "./routes/cacheRoutes.js"
import customSliderItemRoutes from "./routes/customSliderItemRoutes.js"
import superAdminRoutes from "./routes/superAdminRoutes.js"
import reportsRoutes from "./routes/reportsRoutes.js"
import homepageRoutes from "./routes/homepageRoutes.js"
import seoPageRoutes from "./routes/seoPageRoutes.js"
import staticPageTranslationRoutes from "./routes/staticPageTranslationRoutes.js"
import arabicConversionRoutes from "./routes/arabicConversionRoutes.js"
import productPaymentMethodRoutes from "./routes/productPaymentMethodRoutes.js"
import countryPaymentMethodRoutes from "./routes/countryPaymentMethodRoutes.js"
import countryRoutes, { seedDefaultCountries } from "./routes/countryRoutes.js"
import { ensureSubCategorySlugIndexes } from "./utils/ensureSubCategorySlugIndexes.js"
import { ensurePaymentChargeIndexes } from "./utils/ensurePaymentChargeIndexes.js"

dotenv.config()

// Ensure PORT is available before initializing database pools and background tasks
await ensurePortAvailable(config.PORT, { isDev: config.NODE_ENV === "development" })

// Connect to databases - await both
await connectDB()
// Sends admin-scheduled push notifications when their time comes.
startPushScheduler()
await ensureSubCategorySlugIndexes()
await ensurePaymentChargeIndexes()
await connectBlogDB()
await seedDefaultCountries()

// Initialize cache service
await cacheService.initialize()
console.log('📦 Cache service initialized')


const app = express()

// Trust proxy - required to get real IP address behind proxies (Vercel, Cloudflare, etc.)
app.set('trust proxy', true)

// CORS configuration
const allowedOrigins = [
  'https://irhaas.com',
  'https://www.irhaas.com',
  'https://irhaas.ae',
  'https://www.irhaas.ae',
  'https://api.irhaas.com',
  'https://api.irhaas.ae',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (
      allowedOrigins.includes(origin) ||
      /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?irhaas\.(?:com|ae)(?::\d+)?$/.test(origin) ||
      /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-SEO-Unlock-Token',
    'X-SEO-Settings-Unlock',
    'Cache-Control',
    'Pragma',
    'X-Requested-With',
    'Range'
  ],
  exposedHeaders: ['WWW-Authenticate', 'Server-Authorization', 'Content-Range', 'Accept-Ranges'],
  maxAge: 86400,
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const uploadsPath = path.join(__dirname, 'uploads');

// Dynamic image optimization for local /uploads assets.
// Example: /uploads/products/a.webp?w=330&h=330&q=70&fmt=webp
app.get('/uploads/*', async (req, res, next) => {
  try {
    const width = Number.parseInt(req.query.w, 10) || 0
    const height = Number.parseInt(req.query.h, 10) || 0
    const quality = Math.min(100, Math.max(1, Number.parseInt(req.query.q, 10) || 72))
    const format = String(req.query.fmt || "").toLowerCase()

    // Only optimize when a target dimension is requested OR a specific format is requested
    const isJpgRequest = req.path.toLowerCase().endsWith('.jpg') || req.path.toLowerCase().endsWith('.jpeg')
    if (!width && !height && !format && !isJpgRequest) return next()

    // req.path can be "/uploads//products/file.webp" - normalize and strip route prefix.
    const normalizedPath = String(req.path || "").replace(/\\/g, "/").replace(/\/+/g, "/")
    const relPath = normalizedPath.replace(/^\/uploads\/?/, "")
    if (!relPath) return next()
    let absPath = path.resolve(uploadsPath, relPath)
    
    // If a .jpg was requested but doesn't exist, check if the .webp version exists
    if (isJpgRequest && !fs.existsSync(absPath)) {
      const webpPath = absPath.replace(/\.jpe?g$/i, '.webp')
      if (fs.existsSync(webpPath)) {
        absPath = webpPath
      } else {
        return res.status(400).send("Invalid image path")
      }
    } else if (!absPath.startsWith(path.resolve(uploadsPath))) {
      return res.status(400).send("Invalid image path")
    }

    let pipeline = sharp(absPath).rotate()
    if (width || height) {
      pipeline = pipeline.resize({
        width: width || undefined,
        height: height || undefined,
        fit: "inside",
        withoutEnlargement: true,
      })
    }

    // Default modern output.
    if (format === "jpeg" || format === "jpg" || isJpgRequest) {
      pipeline = pipeline.jpeg({ quality: quality || 80, mozjpeg: true })
      res.type("image/jpeg")
    } else if (format === "png") {
      pipeline = pipeline.png({ quality })
      res.type("image/png")
    } else if (format === "avif") {
      pipeline = pipeline.avif({ quality })
      res.type("image/avif")
    } else {
      pipeline = pipeline.webp({ quality })
      res.type("image/webp")
    }

    res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
    const output = await pipeline.toBuffer()
    return res.send(output)
  } catch (error) {
    return next()
  }
})

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsPath));

// Add logging for static file requests
app.use('/uploads', (req, res, next) => {
  console.log('📁 Static file request:', req.path);
  next();
});

console.log('📂 Serving static files from:', uploadsPath);

// Apply webhook middleware before body parser for webhook routes
app.use("/api/payment/tamara/webhook", captureRawBody, webhookRateLimit, authenticateWebhook)

// Meta signs the WhatsApp webhook over the raw bytes, so the body must be captured
// before express.json() reserialises it. No authenticateWebhook here: the signature
// check lives in the route, keyed to the app secret stored in the database.
app.use("/api/whatsapp/webhook", captureRawBody, webhookRateLimit)

// Response compression for all API and static responses (gzip/deflate for payloads > 1KB)
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false
      return compression.filter(req, res)
    },
  }),
)

// Body parser middleware
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Attach cache service to all requests
app.use(attachCacheService)

// Keep server cache in sync automatically after any successful data mutation.
app.use(autoInvalidateAllCacheOnMutation())

// Catalogue reads are the same for everyone, so let Cloudflare and the browser
// hold on to them. Without this every visitor re-downloads the whole category
// tree and homepage payload on every page.
app.use(
  [
    "/api/homepage",
    "/api/categories",
    "/api/subcategories",
    "/api/brands",
    "/api/banners",
    "/api/home-sections",
    "/api/products",
    "/api/theme",
    "/api/settings",
    "/api/countries",
    "/api/loyalty/settings",
    "/api/referrals/settings",
    "/api/delivery-charges",
    "/api/popup-settings",
  ],
  publicCache,
)

// Routes
app.use("/api/users", userRoutes)
app.use("/api/products", productRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/whatsapp", whatsappRoutes)
app.use("/api/upload", uploadRoutes)
app.use("/api/categories", categoryRoutes)
app.use("/api/subcategories", subCategoryRoutes)
app.use("/api/brands", brandRoutes)
app.use("/api/colors", colorRoutes)
app.use("/api/sizes", sizeRoutes)
app.use("/api/units", unitRoutes)
app.use("/api/volumes", volumeRoutes)
app.use("/api/warranty", warrantyRoutes)
app.use("/api/tax", taxRoutes)
app.use("/api/product-system-options", productSystemOptionRoutes)
app.use("/api/delivery-charges", deliveryChargeRoutes)
app.use("/api/coupons", couponRoutes)
app.use("/api/app-discounts", appDiscountRoutes)
app.use("/api/loyalty", loyaltyRoutes)
app.use("/api/referrals", referralRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/popup-settings", popupSettingsRoutes)
app.use("/api/banners", bannerRoutes)
app.use("/api/banner-cards", bannerCardRoutes)
app.use("/api/home-sections", homeSectionRoutes)
app.use("/api/offer-pages", offerPageRoutes)
app.use("/api/offer-products", offerProductRoutes)
app.use("/api/offer-brands", offerBrandRoutes)
app.use("/api/offer-categories", offerCategoryRoutes)
app.use("/api/blogs", blogRoutes)
app.use("/api/blog-categories", blogCategoryRoutes)
app.use("/api/blog-topics", blogTopicRoutes)
app.use("/api/blog-ratings", blogRatingRoutes)
app.use("/api/blog-brands", blogBrandRoutes)
app.use("/api/blog-comments", blogCommentRoutes)
app.use("/api/blog-dashboard", blogDashboardRoutes)
app.use("/api/settings", settingsRoutes)
app.use("/api/theme", themeRoutes)
app.use("/api/wishlist", wishlistRoutes)
app.use("/api/request-callback", requestCallbackRoutes)
app.use("/api/bulk-purchase", bulkPurchaseRoutes)
app.use("/api/payment", paymentRoutes)
app.use("/api/payment-charges", paymentMethodChargeRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/super-admin", superAdminRoutes)
app.use("/api/reports", reportsRoutes)
app.use("/api/email-templates", emailTemplateRoutes)
app.use("/api/email-builder", emailBuilderRoutes)
app.use("/api/email-campaigns", emailCampaignRoutes)
// Public: the recipient is not signed in. Safety comes from the signed token, not
// from a session -- see routes/unsubscribeRoutes.js.
app.use("/api/unsubscribe", unsubscribeRoutes)
app.use("/api/newsletter", newsletterRoutes)

// Optimized homepage endpoint (combines multiple API calls)
app.use("/api/homepage", homepageRoutes)

app.use("/api/price-adjustment", priceAdjustmentRoutes)
app.use("/api/countries", countryRoutes)
app.use("/api/redirects", redirectRoutes)
app.use("/api/buyer-protection", buyerProtectionRoutes)
app.use("/api/cache", cacheRoutes)
app.use("/api/custom-slider-items", customSliderItemRoutes)
app.use("/api/seo-pages", seoPageRoutes)
app.use("/api/static-page-translations", staticPageTranslationRoutes)
app.use("/api/admin/arabic-conversion", arabicConversionRoutes)
app.use("/api/product-payment-methods", productPaymentMethodRoutes)
app.use("/api/country-payment-methods", countryPaymentMethodRoutes)
app.use("/api/indexnow", indexNowRoutes)
// @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@


app.use("/api/google-merchant", googleMerchantRoutes)
app.use("/acer-products", acerProductsRoutes)
app.use('/api/app', appRoutes)
app.use('/api/mobile', mobileApiRoutes)


// Add review routes
app.use("/api/reviews", reviewRoutes)
app.use("/api/admin/reviews", adminReviewRoutes)



app.use('/', sitemapRoutes)   

// Health check route
app.get("/", (req, res) => {
  res.json({
    message: "Irhaas API is running!",
    version: "1.0.0",
    environment: config.NODE_ENV,
  })
})

// Add a simple test route
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server working!', 
    time: new Date(),
    uploadsPath: './uploads'
  });
});

// Error handling middleware
app.use(notFound)
app.use(errorHandler)

const PORT = config.PORT

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running in ${config.NODE_ENV} mode on port ${PORT}`)

  // A campaign still marked "sending" means the process died partway through it.
  // It is left paused for a person to look at, never restarted automatically: a
  // crash loop that resumes itself mails the same list over and over.
  recoverInterrupted().catch((error) =>
    console.error("[campaignSender] could not check for interrupted campaigns:", error),
  )
})

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use (EADDRINUSE). Please ensure no duplicate instance is running.`)
  } else {
    console.error("❌ Server listen error:", error)
  }
  process.exit(1)
})

setupGracefulShutdown(server)

export default server
