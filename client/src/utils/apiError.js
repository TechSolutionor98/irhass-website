/**
 * Turn an axios failure into a sentence that names the actual cause.
 *
 * The distinction that matters: a request that never got a response (API not running,
 * wrong port, network down) is not the same as one the server rejected. Collapsing both
 * into "Failed to save" sends you hunting for a validation bug when the backend is simply
 * not up.
 */
export const describeApiError = (error, fallback = "Something went wrong") => {
  // The server answered — prefer its own message.
  if (error?.response) {
    const { status, data } = error.response
    const serverMessage = typeof data === "string" ? data : data?.message

    if (status === 401) return "Your session has expired. Sign in again."
    if (status === 403) return serverMessage || "You do not have permission to do that."
    if (status === 404) return serverMessage || "That endpoint does not exist. The server may be running old code."
    if (serverMessage) return serverMessage
    return `${fallback} (server responded ${status})`
  }

  // The request went out but nothing came back.
  if (error?.request) {
    const base = error?.config?.baseURL || error?.config?.url || ""
    let origin = ""
    try {
      origin = base ? new URL(base, window.location.origin).origin : ""
    } catch {
      origin = ""
    }
    return `Could not reach the server${origin ? ` at ${origin}` : ""}. Check that the API is running.`
  }

  return error?.message || fallback
}

export default describeApiError
