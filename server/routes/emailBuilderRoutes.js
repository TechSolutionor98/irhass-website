/**
 * The email builder's API: saved designs, the built-in ones, the product picker and
 * the image library. Admin-only throughout -- everything here either reads the
 * catalogue or writes something that will later be mailed to customers.
 */

import express from "express"
import asyncHandler from "express-async-handler"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { protect, admin } from "../middleware/authMiddleware.js"
import { uploadEmailImage } from "../config/multer.js"
import EmailCampaignTemplate from "../models/emailCampaignTemplateModel.js"
import EmailImage from "../models/emailImageModel.js"
import Product from "../models/productModel.js"
import { DEFAULT_EMAIL_TEMPLATES, getDefaultTemplate } from "../data/defaultEmailTemplates.js"
import { renderEmail } from "../services/emailRenderer.js"
import { applyMergeFields, sampleRecipient, MERGE_FIELDS } from "../services/emailMergeFields.js"
import { EMAIL_THEME } from "../data/emailTheme.js"
import { buildProductUrl } from "../utils/publicSiteUrl.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const router = express.Router()
router.use(protect, admin)

/* ----------------------------------------------------------------- defaults -- */

// @desc    The three built-in designs, and the palette/merge fields the editor needs
// @route   GET /api/email-builder/defaults
router.get(
  "/defaults",
  asyncHandler(async (req, res) => {
    res.json({
      templates: DEFAULT_EMAIL_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        preview: t.preview,
        subject: t.subject,
        preheader: t.preheader,
        blocks: t.blocks,
      })),
      theme: EMAIL_THEME,
      mergeFields: MERGE_FIELDS,
    })
  }),
)

/* ---------------------------------------------------------------- templates -- */

// @desc    Saved designs (My Templates)
// @route   GET /api/email-builder/templates
router.get(
  "/templates",
  asyncHandler(async (req, res) => {
    const templates = await EmailCampaignTemplate.find({}, "-blocks -html")
      .sort({ updatedAt: -1 })
      .lean()
    res.json(templates)
  }),
)

// @desc    One saved design, with its blocks
// @route   GET /api/email-builder/templates/:id
router.get(
  "/templates/:id",
  asyncHandler(async (req, res) => {
    const template = await EmailCampaignTemplate.findById(req.params.id).lean()
    if (!template) return res.status(404).json({ message: "Template not found" })
    res.json(template)
  }),
)

/**
 * Create a design.
 *
 * `fromDefault` starts it from a built-in one. The built-in is read from code and
 * copied; it is never read back out of the database, so there is nothing to corrupt.
 */
// @route   POST /api/email-builder/templates
router.post(
  "/templates",
  asyncHandler(async (req, res) => {
    const { name, subject, preheader, blocks, fromDefault } = req.body

    let seed = { subject: subject || "", preheader: preheader || "", blocks: Array.isArray(blocks) ? blocks : [] }
    let basedOn = ""

    if (fromDefault) {
      const base = getDefaultTemplate(fromDefault)
      if (!base) return res.status(400).json({ message: "Unknown default template" })
      // Deep copy, so editing the new row can never reach the built-in's block objects.
      seed = {
        subject: subject || base.subject,
        preheader: preheader || base.preheader,
        blocks: JSON.parse(JSON.stringify(base.blocks)),
      }
      basedOn = base.name
    }

    const template = await EmailCampaignTemplate.create({
      name: String(name || "Untitled design").trim(),
      ...seed,
      basedOn,
      html: renderEmail(seed),
      createdBy: req.user?._id || null,
    })

    res.status(201).json(template)
  }),
)

// @desc    Update a saved design. The cached html is re-rendered here, never sent in.
// @route   PUT /api/email-builder/templates/:id
router.put(
  "/templates/:id",
  asyncHandler(async (req, res) => {
    const template = await EmailCampaignTemplate.findById(req.params.id)
    if (!template) return res.status(404).json({ message: "Template not found" })

    const { name, subject, preheader, blocks } = req.body
    if (name !== undefined) template.name = String(name).trim()
    if (subject !== undefined) template.subject = String(subject)
    if (preheader !== undefined) template.preheader = String(preheader)
    if (Array.isArray(blocks)) template.blocks = blocks

    template.html = renderEmail({
      subject: template.subject,
      preheader: template.preheader,
      blocks: template.blocks,
    })

    await template.save()
    res.json(template)
  }),
)

// @desc    Duplicate a saved design
// @route   POST /api/email-builder/templates/:id/duplicate
router.post(
  "/templates/:id/duplicate",
  asyncHandler(async (req, res) => {
    const source = await EmailCampaignTemplate.findById(req.params.id).lean()
    if (!source) return res.status(404).json({ message: "Template not found" })

    const copy = await EmailCampaignTemplate.create({
      name: `${source.name} (copy)`,
      subject: source.subject,
      preheader: source.preheader,
      blocks: JSON.parse(JSON.stringify(source.blocks || [])),
      html: source.html,
      basedOn: source.basedOn,
      createdBy: req.user?._id || null,
    })

    res.status(201).json(copy)
  }),
)

// @desc    Delete a saved design
// @route   DELETE /api/email-builder/templates/:id
router.delete(
  "/templates/:id",
  asyncHandler(async (req, res) => {
    const removed = await EmailCampaignTemplate.findByIdAndDelete(req.params.id)
    if (!removed) return res.status(404).json({ message: "Template not found" })
    res.json({ message: "Design deleted" })
  }),
)

/* ------------------------------------------------------------------ preview -- */

/**
 * Render blocks to the real email HTML.
 *
 * The editor's canvas is an approximation drawn with React; this is the markup that
 * will actually be sent. Previewing through the same renderer the sender uses is the
 * only way the preview can be trusted.
 */
// @route   POST /api/email-builder/preview
router.post(
  "/preview",
  asyncHandler(async (req, res) => {
    const { subject, preheader, blocks } = req.body
    const html = renderEmail({ subject, preheader, blocks: Array.isArray(blocks) ? blocks : [] })
    res.json({ html: applyMergeFields(html, sampleRecipient()) })
  }),
)

/* ----------------------------------------------------------- product picker -- */

/**
 * Search the live catalogue, and return a SNAPSHOT.
 *
 * The block stores these values, not a reference to the product. If it held a link,
 * tomorrow's price change would silently rewrite what a customer was promised in an
 * email they can still open -- and the email would stop matching the record of what
 * was sent. What went out has to stay what went out.
 */
// @route   GET /api/email-builder/products?q=
router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || "").trim()
    if (q.length < 2) return res.json([])

    // Escaped: a customer-facing search box is not the only way a regex gets here.
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = new RegExp(safe, "i")

    const products = await Product.find(
      { $or: [{ name: pattern }, { sku: pattern }] },
      "name sku slug image price offerPrice discount parentCategory category",
    )
      .populate("parentCategory", "name")
      .populate("category", "name")
      .limit(20)
      .lean()

    res.json(
      products.map((p) => {
        const price = Number(p.offerPrice) > 0 ? Number(p.offerPrice) : Number(p.price) || 0
        const wasReduced = Number(p.offerPrice) > 0 && Number(p.offerPrice) < Number(p.price)
        const discount = wasReduced ? Math.round(((p.price - p.offerPrice) / p.price) * 100) : 0

        return {
          id: String(p._id),
          name: p.name,
          sku: p.sku || "",
          image: p.image || "",
          price: `PKR ${price.toLocaleString("en-PK")}`,
          oldPrice: wasReduced ? `PKR ${Number(p.price).toLocaleString("en-PK")}` : "",
          badge: discount > 0 ? `${discount}% off` : "",
          category: p.parentCategory?.name || p.category?.name || "",
          url: buildProductUrl(p.slug || p._id),
        }
      }),
    )
  }),
)

/* ------------------------------------------------------------ image manager -- */

// @desc    Images, optionally filtered to one folder
// @route   GET /api/email-builder/images
router.get(
  "/images",
  asyncHandler(async (req, res) => {
    const folder = String(req.query.folder || "").trim()
    const filter = folder && folder !== "All" ? { folder } : {}

    const [images, folders] = await Promise.all([
      EmailImage.find(filter).sort({ createdAt: -1 }).limit(300).lean(),
      EmailImage.distinct("folder"),
    ])

    res.json({ images, folders: folders.filter(Boolean).sort() })
  }),
)

// @desc    Upload an image for use in emails
// @route   POST /api/email-builder/images
router.post(
  "/images",
  (req, res, next) =>
    uploadEmailImage.single("image")(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message })
      next()
    }),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No image was uploaded" })

    const image = await EmailImage.create({
      folder: String(req.body.folder || "General").trim() || "General",
      name: req.file.originalname,
      // Stored site-relative; made absolute at render time, because the public host
      // can change and a stored absolute URL would outlive it.
      url: `/uploads/emails/${req.file.filename}`,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user?._id || null,
    })

    res.status(201).json(image)
  }),
)

// @desc    Move an image to another folder
// @route   PATCH /api/email-builder/images/:id
router.patch(
  "/images/:id",
  asyncHandler(async (req, res) => {
    const image = await EmailImage.findById(req.params.id)
    if (!image) return res.status(404).json({ message: "Image not found" })

    if (req.body.folder !== undefined) image.folder = String(req.body.folder).trim() || "General"
    if (req.body.name !== undefined) image.name = String(req.body.name).trim()

    await image.save()
    res.json(image)
  }),
)

// @desc    Delete an image, file and record
// @route   DELETE /api/email-builder/images/:id
router.delete(
  "/images/:id",
  asyncHandler(async (req, res) => {
    const image = await EmailImage.findById(req.params.id)
    if (!image) return res.status(404).json({ message: "Image not found" })

    // The record goes either way. A file left behind is wasted disk; a record left
    // behind is a picture in the library that 404s in somebody's inbox.
    if (image.url.startsWith("/uploads/")) {
      const absolute = path.join(__dirname, "..", image.url)
      await fs.unlink(absolute).catch(() => {})
    }

    await image.deleteOne()
    res.json({ message: "Image deleted" })
  }),
)

export default router
