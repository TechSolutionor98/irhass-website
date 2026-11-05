// What the server needs to tie its own Meta Purchase event to this visitor.
//
// The browser pixel reports the sale, and so does the server -- the server
// event is the one that survives ad blockers and Safari. For Meta to recognise
// them as the same person rather than two strangers, the server event has to
// carry the pixel's own cookies, and only the browser can read those.
//
// They travel inside the order payload rather than as real cookies, because the
// shop is on irhaas.com and the API on api.irhaas.com -- a cross-origin
// request sends neither.

const readCookie = (name) => {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : ""
  } catch (error) {
    return ""
  }
}

/**
 * @returns {{fbp?: string, fbc?: string, sourceUrl?: string}} Empty when the
 *          pixel never loaded -- the server simply reports a weaker match.
 */
export const readMetaAttribution = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return {}

  const fbp = readCookie("_fbp")
  let fbc = readCookie("_fbc")

  // _fbc only exists once the visitor has arrived from an ad. If they are on
  // such a landing page right now the cookie may not be written yet, so build
  // the same value Meta would: fb.1.<timestamp>.<click id>.
  if (!fbc) {
    try {
      const clickId = new URLSearchParams(window.location.search).get("fbclid")
      if (clickId) fbc = `fb.1.${Date.now()}.${clickId}`
    } catch (error) {
      // A malformed query string is not worth failing a checkout over.
    }
  }

  return {
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
    sourceUrl: window.location.href,
  }
}
