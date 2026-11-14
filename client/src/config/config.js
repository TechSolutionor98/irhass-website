// Central app configuration
const resolveApiUrl = () => {
  const envUrl = (import.meta.env?.VITE_API_URL || "").trim()

  if (envUrl && /^https?:\/\//i.test(envUrl)) return envUrl.replace(/\/$/, "")

  // Local fallback for development, live fallback for production.
  if (import.meta.env?.DEV) return "http://localhost:5000"

  return "https://api.irhaas.com"
}

// Resolve Translation API URL
const resolveTranslationApiUrl = () => {
  const envUrl = (import.meta.env?.VITE_TRANSLATION_API_URL || "").trim()

  if (envUrl && /^https?:\/\//i.test(envUrl)) return envUrl.replace(/\/$/, "")

  // Live fallback.
  return "https://langaimodel.irhaas.com" // Production translation API on VPS
}

// Resolve Uploads / Media Base URL
const resolveUploadsUrl = () => {
  const envUrl = (
    import.meta.env?.VITE_UPLOADS_URL ||
    import.meta.env?.VITE_IMAGE_BASE_URL ||
    import.meta.env?.VITE_MEDIA_URL ||
    ""
  ).trim()

  if (envUrl && /^https?:\/\//i.test(envUrl)) return envUrl.replace(/\/$/, "")

  // Local fallback for development, live fallback for production.
  if (import.meta.env?.DEV) return "http://localhost:5000/uploads"

  return "https://api.irhaas.com/uploads"
}

const config = {
  // API Configuration - Handle both development and production
  API_URL: resolveApiUrl(),

  // Uploads / Image Base URL from .env
  UPLOADS_URL: resolveUploadsUrl(),
  IMAGE_BASE_URL: resolveUploadsUrl(),

  // Translation Model API
  TRANSLATION_API_URL: resolveTranslationApiUrl(),

  // Payment Gateway Configuration
  TAMARA_API_KEY: import.meta.env?.VITE_TAMARA_API_KEY,
  TABBY_MERCHANT_CODE: import.meta.env?.VITE_TABBY_MERCHANT_CODE,
  TABBY_SECRET_KEY: import.meta.env?.VITE_TABBY_SECRET_KEY,
  NGENIUS_API_KEY: import.meta.env?.VITE_NGENIUS_API_KEY,

  // App Configuration
  APP_NAME: "Irhaas",
  APP_VERSION: "1.0.0",
  ANDROID_APP_URL: import.meta.env?.VITE_ANDROID_APP_URL || "",
  IOS_APP_URL: import.meta.env?.VITE_IOS_APP_URL || "",

  // Live storefront public URL (used for WhatsApp messages, callbacks, share links)
  // Ensures links always point to live https://irhaas.com even when tested on localhost
  SITE_URL: (import.meta.env?.VITE_SITE_URL || "https://irhaas.com").replace(/\/$/, ""),

  // Centralized WhatsApp Number
  // Used across the entire site (floating button, maintenance, restock alerts, inquiries).
  // Can be overridden via VITE_WHATSAPP_NUMBER in .env
  COMPANY_WHATSAPP_NUMBER: (import.meta.env?.VITE_WHATSAPP_NUMBER || "923257847744").replace(/\D/g, ""),
  COMPANY_WHATSAPP_DISPLAY: "+92 325 7847744",
}

/**
 * Direct WhatsApp URL generator:
 * - On desktop: uses web.whatsapp.com/send directly so it immediately opens the chat in WhatsApp Web
 *   without stopping at the intermediate "Open app / Continue to WhatsApp Web" landing prompt.
 * - On mobile: uses api.whatsapp.com/send which directly triggers the WhatsApp mobile app.
 */
export const getWhatsAppUrl = (text = "", customPhone = null) => {
  const targetPhone = String(customPhone || config.COMPANY_WHATSAPP_NUMBER || "923257847744").replace(/\D/g, "")
  const encodedText = text ? encodeURIComponent(text) : ""

  const isMobile =
    typeof navigator !== "undefined" &&
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(
      navigator.userAgent || navigator.vendor || window?.opera || ""
    )

  const baseUrl = isMobile ? "https://api.whatsapp.com/send" : "https://web.whatsapp.com/send"
  return `${baseUrl}?phone=${targetPhone}${encodedText ? `&text=${encodedText}` : ""}`
}

config.getWhatsAppUrl = getWhatsAppUrl

export default config




// const config = {
//     // API Configuration - Handle both development and production
//   API_URL:  'ht tp://localhost:5000', // Make sure to include http:// or https://
// //  API_URL: import.meta.env.VITE_API_URL || 'https://api.irhaas.com',
   
     
 


//     // Payment Gateway Configuration
//     TAMARA_API_KEY: import.meta.env.VITE_TAMARA_API_KEY,
//     TABBY_MERCHANT_CODE: import.meta.env.VITE_TABBY_MERCHANT_CODE,
//     TABBY_SECRET_KEY: import.meta.env.VITE_TABBY_SECRET_KEY,
//     NGENIUS_API_KEY: import.meta.env.VITE_NGENIUS_API_KEY,
  
//     // App Configuration
//     APP_NAME: "Irhaas",
//     APP_VERSION: "1.0.0",
//   }
  
//   export default config
  
