const SEO_UNLOCK_TOKEN_KEY = "seoUnlockToken"
const SEO_UNLOCK_EXPIRES_AT_KEY = "seoUnlockExpiresAt"

export const clearSeoUnlockStorage = () => {
  localStorage.removeItem(SEO_UNLOCK_TOKEN_KEY)
  localStorage.removeItem(SEO_UNLOCK_EXPIRES_AT_KEY)
}

export const isSeoUnlockTokenValid = () => {
  const token = localStorage.getItem(SEO_UNLOCK_TOKEN_KEY)
  if (!token) return false

  try {
    const payloadBase64 = token.split(".")[1]
    if (!payloadBase64) {
      clearSeoUnlockStorage()
      return false
    }

    const normalizedPayloadBase64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/")
    const paddedPayloadBase64 = normalizedPayloadBase64.padEnd(
      normalizedPayloadBase64.length + ((4 - (normalizedPayloadBase64.length % 4)) % 4),
      "=",
    )
    const payload = JSON.parse(atob(paddedPayloadBase64))

    if (!payload?.exp) return true

    const isExpired = Date.now() >= payload.exp * 1000
    if (isExpired) {
      clearSeoUnlockStorage()
      return false
    }

    return true
  } catch (_error) {
    clearSeoUnlockStorage()
    return false
  }
}

export const getSeoUnlockTokenIfValid = () => {
  if (!isSeoUnlockTokenValid()) return ""
  return localStorage.getItem(SEO_UNLOCK_TOKEN_KEY) || ""
}

