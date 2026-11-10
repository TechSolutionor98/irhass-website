import mongoose from "mongoose"

const settingsSchema = mongoose.Schema(
  {
    siteName: {
      type: String,
      default: "Watch-Hub",
    },
    siteDescription: {
      type: String,
      default: "Premium watches for every occasion",
    },
    primaryColor: {
      type: String,
      default: "#3B82F6", // Blue
    },
    secondaryColor: {
      type: String,
      default: "#1F2937", // Gray
    },
    accentColor: {
      type: String,
      default: "#10B981", // Green
    },
    theme: {
      type: String,
      enum: ["blue", "green", "purple", "red", "orange", "custom"],
      default: "blue",
    },
    currency: {
      type: String,
      default: "PKR",
    },
    taxRate: {
      type: Number,
      default: 0, // Percentage
    },
    shippingRate: {
      type: Number,
      default: 200,
    },
    freeShippingThreshold: {
      type: Number,
      default: 5000,
    },
    contactEmail: {
      type: String,
      default: "info@irhaas.com",
    },
    contactPhone: {
      type: String,
      default: "+92 321 498 0835",
    },
    socialMedia: {
      facebook: { type: String, default: "https://facebook.com/irhaswardrobe/" },
      instagram: { type: String, default: "https://instagram.com/irhaswardrob/" },
      tiktok: { type: String, default: "https://www.tiktok.com/@irhaswardrobe" },
      linkedin: { type: String, default: "https://linkedin.com/company/irhaswardrobe/" },
      twitter: { type: String, default: "https://x.com/irhaswardrobe" },
      youtube: { type: String, default: "https://www.youtube.com/channel/UCRoX9oOzkqk2r0VlnG0SfXA" },
    },
    homeSections: {
      categoryCards: {
        type: Boolean,
        default: true,
      },
      brandsCards: {
        type: Boolean,
        default: true,
      },
      productsCards: {
        type: Boolean,
        default: true,
      },
      flashSaleCards: {
        type: Boolean,
        default: true,
      },
      limitedSaleCards: {
        type: Boolean,
        default: true,
      },
    },
    categorySliderShape: {
      type: String,
      enum: ["circle", "square", "octagon"],
      default: "circle",
    },
    categorySliderLayoutType: {
      type: String,
      enum: ["default", "compact", "modern", "minimal", "card", "banner", "circularCard"],
      default: "default",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
)

const Settings = mongoose.model("Settings", settingsSchema)

export default Settings
