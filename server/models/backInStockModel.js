import mongoose from "mongoose"

const backInStockSubscriptionSchema = mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    size: {
      type: String,
      trim: true,
      default: "",
    },
    notified: {
      type: Boolean,
      default: false,
      index: true,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      productName: { type: String, default: "" },
      productImage: { type: String, default: "" },
      productPrice: { type: Number, default: 0 },
      slug: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  },
)

// Compound index to quickly find active subscriptions and prevent duplicate alerts
backInStockSubscriptionSchema.index({ product: 1, email: 1, size: 1, notified: 1 })

const BackInStockSubscription = mongoose.model("BackInStockSubscription", backInStockSubscriptionSchema)

export default BackInStockSubscription

