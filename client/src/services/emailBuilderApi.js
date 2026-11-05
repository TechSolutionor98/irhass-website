/**
 * Every call the email builder and Bulk Mails make.
 *
 * One file so the endpoints are visible in one place -- the campaign screens are the
 * part of the admin where a wrong URL means mail goes to the wrong people, and that
 * is much easier to check when the list is short and together.
 */

import axios from "axios"
import config from "../config/config"

const BASE = config.API_URL

const authHeaders = () => {
  const token =
    localStorage.getItem("adminToken") || localStorage.getItem("token") || localStorage.getItem("authToken")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const get = async (url, params) => (await axios.get(`${BASE}${url}`, { headers: authHeaders(), params })).data
const post = async (url, body) => (await axios.post(`${BASE}${url}`, body, { headers: authHeaders() })).data
const put = async (url, body) => (await axios.put(`${BASE}${url}`, body, { headers: authHeaders() })).data
const patch = async (url, body) => (await axios.patch(`${BASE}${url}`, body, { headers: authHeaders() })).data
const del = async (url) => (await axios.delete(`${BASE}${url}`, { headers: authHeaders() })).data

/* ------------------------------------------------------------------ builder -- */

export const fetchDefaults = () => get("/api/email-builder/defaults")
export const fetchTemplates = () => get("/api/email-builder/templates")
export const fetchTemplate = (id) => get(`/api/email-builder/templates/${id}`)
export const createTemplate = (body) => post("/api/email-builder/templates", body)
export const updateTemplate = (id, body) => put(`/api/email-builder/templates/${id}`, body)
export const duplicateTemplate = (id) => post(`/api/email-builder/templates/${id}/duplicate`)
export const deleteTemplate = (id) => del(`/api/email-builder/templates/${id}`)

/** The real email HTML, from the same renderer the sender uses. */
export const renderPreview = (body) => post("/api/email-builder/preview", body)

export const searchProducts = (q) => get("/api/email-builder/products", { q })

/* ------------------------------------------------------------------- images -- */

export const fetchImages = (folder) => get("/api/email-builder/images", folder ? { folder } : undefined)
export const uploadImage = async (file, folder) => {
  const form = new FormData()
  form.append("image", file)
  if (folder) form.append("folder", folder)
  const { data } = await axios.post(`${BASE}/api/email-builder/images`, form, {
    headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
  })
  return data
}
export const updateImage = (id, body) => patch(`/api/email-builder/images/${id}`, body)
export const deleteImage = (id) => del(`/api/email-builder/images/${id}`)

/* ---------------------------------------------------------------- campaigns -- */

export const fetchCampaigns = () => get("/api/email-campaigns")
export const fetchCampaign = (id) => get(`/api/email-campaigns/${id}`)
export const createCampaign = (body) => post("/api/email-campaigns", body)
export const updateCampaign = (id, body) => put(`/api/email-campaigns/${id}`, body)
export const duplicateCampaign = (id) => post(`/api/email-campaigns/${id}/duplicate`)
export const deleteCampaign = (id) => del(`/api/email-campaigns/${id}`)

export const previewAudience = (body) => post("/api/email-campaigns/audience/preview", body)
export const fetchContacts = () => get("/api/email-campaigns/contacts")
export const fetchRecipients = (id, status) =>
  get(`/api/email-campaigns/${id}/recipients`, status ? { status } : undefined)

export const sendTest = (id, email) => post(`/api/email-campaigns/${id}/test`, { email })
export const startCampaign = (id) => post(`/api/email-campaigns/${id}/send`)
export const pauseCampaign = (id) => post(`/api/email-campaigns/${id}/pause`)
export const resumeCampaign = (id) => post(`/api/email-campaigns/${id}/resume`)

export const fetchUnsubscribes = () => get("/api/email-campaigns/unsubscribes/list")

/** Turn an API error into the sentence the server actually sent. */
export const errorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Something went wrong"

export default {
  fetchDefaults,
  fetchTemplates,
  fetchTemplate,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  deleteTemplate,
  renderPreview,
  searchProducts,
  fetchImages,
  uploadImage,
  updateImage,
  deleteImage,
  fetchCampaigns,
  fetchCampaign,
  createCampaign,
  updateCampaign,
  duplicateCampaign,
  deleteCampaign,
  previewAudience,
  fetchContacts,
  fetchRecipients,
  sendTest,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  fetchUnsubscribes,
  errorMessage,
}
