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
  TAMARA_API_KEY: import.meta.env.VITE_TAMARA_API_KEY,
  TABBY_MERCHANT_CODE: import.meta.env.VITE_TABBY_MERCHANT_CODE,
  TABBY_SECRET_KEY: import.meta.env.VITE_TABBY_SECRET_KEY,
  NGENIUS_API_KEY: import.meta.env.VITE_NGENIUS_API_KEY,

  // App Configuration
  APP_NAME: "Irhaas",
  APP_VERSION: "1.0.0",
  ANDROID_APP_URL: import.meta.env.VITE_ANDROID_APP_URL || "",
  IOS_APP_URL: import.meta.env.VITE_IOS_APP_URL || "",
}

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
  
