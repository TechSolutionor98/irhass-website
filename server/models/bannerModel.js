import mongoose from "mongoose"

const bannerSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    subtitle: {
      type: String,
    },
    description: {
      type: String,
    },
    image: {
      type: String,
      required: false,
      default: "",
    },
    video: {
      type: String,
      default: "",
    },
    backgroundColor: {
      type: String,
      default: "#8b5e34",
    },
    mediaType: {
      type: String,
      enum: ["none", "image", "video"],
      default: "none",
    },
    showText: {
      type: Boolean,
      default: true,
    },
    finePrint: {
      type: String,
      default: "",
    },
    textColor: {
      type: String,
      default: "#ffffff",
    },
    overlayOpacity: {
      type: Number,
      default: 0,
    },
    heroHeight: {
      type: String,
      enum: ["compact", "medium", "large", "fullscreen"],
      default: "large",
    },
    backgroundImage: {
      type: String,
    },
    buttonText: {
      type: String,
      default: "Shop Now",
    },
    buttonLink: {
      type: String,
      default: "/shop",
    },
    position: {
      type: String,
      required: true,
      enum: [
        "season-bottom",
        "sale-bottom",
        "hero",
        "hero-desktop",
        "hero-mobile",
        "second-banner-desktop",
        "second-banner-mobile",
        "category",
        "promotional",
        "footer",
        "home-top-triple",
        "home-brand-single",
        "home-brand-dual",
        "home-category-banner",
        "home-custom"
      ],
      default: "season-bottom",
    },
    section: {
      type: String,
      // Used to group banners by specific sections on home page
      // e.g., "hp-section", "dell-section", "accessories-section", etc.
    },
    link: {
      type: String,
      // Direct link for the banner (alternative to buttonLink)
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: function () {
        return this.position === "category"
      },
    },
    discount: {
      type: Number,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    deviceType: {
      type: String,
      enum: ["desktop", "mobile"],
      default: "desktop",
    },
    targetCountries: {
      type: [String],
      default: ["ALL"],
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

bannerSchema.index({ isActive: 1, position: 1, sortOrder: 1 })

const Banner = mongoose.model("Banner", bannerSchema)

export default Banner
