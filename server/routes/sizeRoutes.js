import express from "express"
import asyncHandler from "express-async-handler"
import Size from "../models/sizeModel.js"
import { protect, admin } from "../middleware/authMiddleware.js"

const router = express.Router()

// @desc    Fetch all sizes (Admin only - includes inactive)
// @route   GET /api/sizes/admin
// @access  Private/Admin
router.get(
  "/admin",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const sizes = await Size.find({ isDeleted: { $ne: true } }).sort({ sortOrder: 1, name: 1 })
    res.json(sizes)
  }),
)

// @desc    Fetch all sizes
// @route   GET /api/sizes
// @access  Public
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const sizes = await Size.find({ isActive: true, isDeleted: { $ne: true } }).sort({ sortOrder: 1, name: 1 })
    res.json(sizes)
  }),
)

// @desc    Create a size
// @route   POST /api/sizes
// @access  Private/Admin
router.post(
  "/",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const { name, code, category, sortOrder, isActive, status } = req.body

    const activeStatus =
      isActive !== undefined
        ? (isActive === true || isActive === "true")
        : status !== undefined
          ? status === "active"
          : true

    const size = new Size({
      name,
      code,
      category: category || "clothing",
      sortOrder: Number(sortOrder) || 0,
      isActive: activeStatus,
      createdBy: req.user._id,
    })

    const createdSize = await size.save()
    res.status(201).json(createdSize)
  }),
)

// @desc    Update a size
// @route   PUT /api/sizes/:id
// @access  Private/Admin
router.put(
  "/:id",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const size = await Size.findById(req.params.id)

    if (size) {
      const { name, code, category, sortOrder, isActive, status } = req.body

      size.name = name || size.name
      size.code = code || size.code
      size.category = category || size.category
      size.sortOrder = sortOrder !== undefined ? Number(sortOrder) : size.sortOrder
      if (isActive !== undefined) {
        size.isActive = isActive === true || isActive === "true"
      } else if (status !== undefined) {
        size.isActive = status === "active"
      }

      const updatedSize = await size.save()
      res.json(updatedSize)
    } else {
      res.status(404)
      throw new Error("Size not found")
    }
  }),
)

// @desc    Delete a size
// @route   DELETE /api/sizes/:id
// @access  Private/Admin
router.delete(
  "/:id",
  protect,
  admin,
  asyncHandler(async (req, res) => {
    const size = await Size.findById(req.params.id)

    if (size) {
      size.isDeleted = true
      await size.save()
      res.json({ message: "Size removed" })
    } else {
      res.status(404)
      throw new Error("Size not found")
    }
  }),
)

export default router
