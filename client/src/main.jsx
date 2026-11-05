import React from "react"
import ReactDOM from "react-dom/client"
import axios from "axios"
import App from "./App"
import "./index.css"
import { HelmetProvider } from "react-helmet-async"
import { checkCacheVersion } from "./utils/cacheManager"
import { getSeoUnlockTokenIfValid } from "./utils/seoUnlock"

axios.interceptors.request.use((requestConfig) => {
  const seoUnlockToken = getSeoUnlockTokenIfValid()
  if (!seoUnlockToken) return requestConfig

  requestConfig.headers = requestConfig.headers || {}
  requestConfig.headers["X-SEO-Unlock-Token"] = seoUnlockToken
  return requestConfig
})

// Check cache version on app start
checkCacheVersion()

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
)

