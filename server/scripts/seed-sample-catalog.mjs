/**
 * Seeds a sample catalogue for Irha's Wardrobe: one super admin, house labels,
 * a womenswear category tree and N demo products.
 *
 * Additive and idempotent by default. Records are matched on their natural key
 * (email / slug / sku) and updated in place, so re-running refreshes the sample data
 * instead of duplicating it. Existing records it did not create are left alone.
 *
 * --reset clears the catalogue collections first (products, brands, categories,
 * subcategories). It never touches users, orders, themes, settings, countries or SEO
 * pages. Contrast with scripts/seed-users-products.js, which wipes users too.
 *
 * Usage:
 *   node scripts/seed-sample-catalog.mjs                 # add/update 100 products
 *   node scripts/seed-sample-catalog.mjs --reset         # replace the catalogue
 *   node scripts/seed-sample-catalog.mjs --count 25
 *   node scripts/seed-sample-catalog.mjs --dry-run       # report, write nothing
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import slugify from "slugify"

import User from "../models/userModel.js"
import Product from "../models/productModel.js"
import Category from "../models/categoryModel.js"
import SubCategory from "../models/subCategoryModel.js"
import Brand from "../models/brandModel.js"

dotenv.config()

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i === -1 ? fallback : process.argv[i + 1]
}
const TARGET_COUNT = Number(arg("--count", 100))
const DRY_RUN = process.argv.includes("--dry-run")
const RESET = process.argv.includes("--reset")

const ADMIN = {
  name: "Irhaas Super Admin",
  email: "irhaas@gmail.com",
  password: "irhaas@gmail.com",
}

const slug = (s) => slugify(s, { lower: true, strict: true })

// ---------------------------------------------------------------------------
// Catalogue definition -- a GCC womenswear boutique
// ---------------------------------------------------------------------------

const BRANDS = [
  "Irha's Signature", "Noor Atelier", "Dala Couture", "Layali",
  "Maison Rida", "Sahar Label", "Velvet Thread", "Zahra Collective",
  "Amal & Co", "Mirage Studio",
]

const TREE = {
  "Abayas & Modest Wear": ["Everyday Abayas", "Occasion Abayas", "Kaftans"],
  Dresses: ["Evening Gowns", "Maxi Dresses", "Midi Dresses"],
  "Tops & Blouses": ["Blouses", "Tunics", "Knitwear"],
  Bottoms: ["Trousers", "Skirts", "Wide-Leg & Palazzo"],
  Accessories: ["Scarves & Shawls", "Handbags", "Jewellery"],
  Footwear: ["Heels", "Flats", "Sandals"],
}

// [name, brand, parentCategory, subCategory, price PKR, [colourways], fabric, fit]
const BASE_PRODUCTS = [
  ["Crepe Open Abaya", "Irha's Signature", "Abayas & Modest Wear", "Everyday Abayas", 5750, ["Black", "Charcoal", "Stone"], "Japanese crepe", "Relaxed"],
  ["Linen Wrap Abaya", "Noor Atelier", "Abayas & Modest Wear", "Everyday Abayas", 6700, ["Sand", "Olive", "Ivory"], "Washed linen", "Straight"],
  ["Pleated Nida Abaya", "Layali", "Abayas & Modest Wear", "Everyday Abayas", 5050, ["Black", "Navy"], "Nida", "A-line"],
  ["Embroidered Occasion Abaya", "Dala Couture", "Abayas & Modest Wear", "Occasion Abayas", 17400, ["Black / Gold", "Midnight / Silver"], "Silk crepe", "Tailored"],
  ["Beaded Cuff Abaya", "Maison Rida", "Abayas & Modest Wear", "Occasion Abayas", 22200, ["Champagne", "Rose"], "Georgette", "Straight"],
  ["Satin Kaftan", "Sahar Label", "Abayas & Modest Wear", "Kaftans", 8300, ["Emerald", "Burgundy", "Ink"], "Satin", "Loose"],
  ["Printed Resort Kaftan", "Mirage Studio", "Abayas & Modest Wear", "Kaftans", 6500, ["Azure Print", "Coral Print"], "Viscose", "Loose"],
  ["Silk Column Gown", "Dala Couture", "Dresses", "Evening Gowns", 26400, ["Deep Teal", "Garnet", "Black"], "Mulberry silk", "Column"],
  ["Draped Shoulder Gown", "Maison Rida", "Dresses", "Evening Gowns", 23750, ["Champagne", "Slate"], "Crepe georgette", "Draped"],
  ["Sequin Overlay Gown", "Zahra Collective", "Dresses", "Evening Gowns", 29400, ["Gold", "Midnight"], "Sequined tulle", "A-line"],
  ["Tiered Maxi Dress", "Layali", "Dresses", "Maxi Dresses", 7450, ["Ivory", "Dusty Rose", "Sage"], "Cotton poplin", "Tiered"],
  ["Belted Shirt Maxi", "Noor Atelier", "Dresses", "Maxi Dresses", 6950, ["Khaki", "White", "Black"], "Tencel", "Belted"],
  ["Floral Midi Dress", "Mirage Studio", "Dresses", "Midi Dresses", 5900, ["Meadow Print", "Noir Print"], "Viscose", "Fit & flare"],
  ["Knit Midi Dress", "Velvet Thread", "Dresses", "Midi Dresses", 6250, ["Camel", "Charcoal", "Cream"], "Fine knit", "Bodycon"],
  ["Silk Tie-Neck Blouse", "Irha's Signature", "Tops & Blouses", "Blouses", 4550, ["Ivory", "Blush", "Black"], "Silk", "Relaxed"],
  ["Poplin Oversized Shirt", "Noor Atelier", "Tops & Blouses", "Blouses", 3500, ["White", "Sky", "Stripe"], "Cotton poplin", "Oversized"],
  ["Embroidered Tunic", "Sahar Label", "Tops & Blouses", "Tunics", 4900, ["Off-White", "Indigo"], "Cotton voile", "Straight"],
  ["Linen Longline Tunic", "Layali", "Tops & Blouses", "Tunics", 4300, ["Sand", "Sage", "Black"], "Linen blend", "Longline"],
  ["Cashmere Blend Cardigan", "Velvet Thread", "Tops & Blouses", "Knitwear", 8900, ["Oatmeal", "Charcoal", "Rose"], "Cashmere blend", "Relaxed"],
  ["Ribbed Mock-Neck Top", "Velvet Thread", "Tops & Blouses", "Knitwear", 3100, ["Black", "Cream", "Mocha"], "Ribbed knit", "Slim"],
  ["High-Waist Tailored Trousers", "Irha's Signature", "Bottoms", "Trousers", 5400, ["Black", "Navy", "Taupe"], "Wool blend", "Tailored"],
  ["Pleated Cigarette Trousers", "Maison Rida", "Bottoms", "Trousers", 5900, ["Charcoal", "Ivory"], "Crepe", "Cigarette"],
  ["Satin Bias Skirt", "Zahra Collective", "Bottoms", "Skirts", 5050, ["Champagne", "Emerald", "Black"], "Satin", "Bias-cut"],
  ["Pleated Midi Skirt", "Layali", "Bottoms", "Skirts", 4700, ["Sand", "Forest"], "Polyester crepe", "Pleated"],
  ["Linen Palazzo Trousers", "Noor Atelier", "Bottoms", "Wide-Leg & Palazzo", 5150, ["White", "Olive", "Black"], "Linen", "Wide-leg"],
  ["Flowing Wide-Leg Pants", "Mirage Studio", "Bottoms", "Wide-Leg & Palazzo", 4800, ["Stone", "Ink"], "Viscose", "Wide-leg"],
  ["Modal Hijab Scarf", "Irha's Signature", "Accessories", "Scarves & Shawls", 1450, ["Black", "Dusty Rose", "Sand", "Ivory"], "Modal", "One size"],
  ["Pashmina Shawl", "Amal & Co", "Accessories", "Scarves & Shawls", 3850, ["Camel", "Grey", "Plum"], "Wool pashmina", "One size"],
  ["Structured Tote Bag", "Amal & Co", "Accessories", "Handbags", 10700, ["Tan", "Black", "Cream"], "Full-grain leather", "Tote"],
  ["Quilted Shoulder Bag", "Zahra Collective", "Accessories", "Handbags", 13800, ["Black", "Ivory"], "Lambskin", "Shoulder"],
  ["Gold Plated Hoop Earrings", "Amal & Co", "Accessories", "Jewellery", 2150, ["Gold", "Rose Gold"], "18k gold plate", "One size"],
  ["Layered Chain Necklace", "Zahra Collective", "Accessories", "Jewellery", 2900, ["Gold", "Silver"], "Brass, gold plate", "Adjustable"],
  ["Pointed Stiletto Heels", "Mirage Studio", "Footwear", "Heels", 7450, ["Black", "Nude", "Burgundy"], "Leather", "Stiletto 9cm"],
  ["Block Heel Mules", "Sahar Label", "Footwear", "Heels", 6500, ["Camel", "Black"], "Suede", "Block 6cm"],
  ["Leather Ballet Flats", "Amal & Co", "Footwear", "Flats", 4700, ["Black", "Beige", "Burgundy"], "Nappa leather", "Flat"],
  ["Woven Slide Sandals", "Mirage Studio", "Footwear", "Sandals", 3700, ["Tan", "White"], "Woven leather", "Flat"],
  ["Satin Camisole", "Irha's Signature", "Tops & Blouses", "Blouses", 2750, ["Ivory", "Black", "Champagne"], "Satin", "Slim"],
  ["Leather Loafers", "Amal & Co", "Footwear", "Flats", 5750, ["Black", "Tan", "Burgundy"], "Polished leather", "Flat"],
  ["Strappy Heeled Sandals", "Sahar Label", "Footwear", "Sandals", 6700, ["Gold", "Black", "Nude"], "Metallic leather", "Heel 7cm"],
]

const DESCRIPTIONS = {
  "Everyday Abayas": "An easy everyday layer cut for movement, finished to sit cleanly over whatever is underneath.",
  "Occasion Abayas": "Hand-finished detailing on a fluid drape, made for weddings, Eid and evening events.",
  Kaftans: "A loose, breathable cut that works from a summer lunch to a resort evening.",
  "Evening Gowns": "A floor-length silhouette with a considered drape, cut for formal evenings.",
  "Maxi Dresses": "Full-length and unrestrictive, in fabrics chosen for warm weather.",
  "Midi Dresses": "A mid-calf length that moves easily between the office and dinner.",
  Blouses: "A refined top that tucks cleanly and layers without bulk.",
  Tunics: "A longline cut with generous coverage, worn loose over trousers.",
  Knitwear: "Soft, fine-gauge knitwear that holds its shape through the season.",
  Trousers: "A high-rise, tailored leg with a clean front and a considered fall.",
  Skirts: "A fluid cut that drapes rather than stiffens, finished with a smooth waistband.",
  "Wide-Leg & Palazzo": "A full, flowing leg in a breathable weave, cut long for heels or flats.",
  "Scarves & Shawls": "A lightweight wrap that holds its fold and drapes without slipping.",
  Handbags: "Structured, fully lined and built to carry daily essentials.",
  Jewellery: "A finishing piece designed for daily wear, made to keep its finish.",
  Heels: "A balanced heel with a cushioned footbed for all-evening wear.",
  Flats: "A soft, broken-in feel from the first wear, with a flexible sole.",
  Sandals: "An open, easy-wearing sandal for warm weather.",
}

const SIZES = {
  Footwear: ["36", "37", "38", "39", "40", "41"],
  Accessories: ["One Size"],
  default: ["XS", "S", "M", "L", "XL", "XXL"],
}

// A fixed seed keeps re-runs stable: the same product always gets the same stock,
// rating and discount rather than churning on every run.
let seed = 20261012
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const pick = (n, lo, hi) => lo + Math.floor(n * (hi - lo + 1))

// ---------------------------------------------------------------------------

const buildProductRows = (count) => {
  const rows = []
  // Walk the colourways in rounds so the first pass covers every garment once before
  // any second colour appears -- a smaller --count still gets a broad catalogue.
  const maxColours = Math.max(...BASE_PRODUCTS.map((p) => p[5].length))
  for (let round = 0; round < maxColours && rows.length < count; round++) {
    for (const [base, brand, parent, sub, price, colours, fabric, fit] of BASE_PRODUCTS) {
      if (rows.length >= count) break
      if (round >= colours.length) continue
      const colour = colours[round]
      const name = `${brand} ${base} - ${colour}`
      // r5 is drawn separately for `featured`. Deriving it from r1 like the discount
      // made the two mutually exclusive, so no product was ever both featured and
      // on offer -- and the sale badge on the featured rail could never appear.
      const r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand(), r5 = rand()

      const hasOffer = r1 < 0.35
      const discountPct = hasOffer ? pick(r2, 5, 30) : 0
      const offerPrice = hasOffer ? Math.round((price * (100 - discountPct)) / 100 / 50) * 50 : 0

      rows.push({
        name, base, brand, parent, sub, colour, fabric, fit,
        price,
        offerPrice,
        discount: discountPct,
        oldPrice: hasOffer ? price : undefined,
        buyingPrice: Math.round((price * 0.45) / 50) * 50,
        countInStock: pick(r3, 4, 40),
        rating: Number((3.7 + r4 * 1.3).toFixed(1)),
        numReviews: pick(r4, 3, 120),
        featured: r5 > 0.78,
        sizes: SIZES[parent] || SIZES.default,
      })
    }
  }
  return rows
}

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set -- check server/.env")
    process.exit(1)
  }

  const conn = await mongoose.connect(process.env.MONGO_URI)
  console.log(`Connected: ${conn.connection.host}/${conn.connection.db.databaseName}`)
  if (DRY_RUN) console.log("DRY RUN -- nothing will be written\n")

  // --- Reset (catalogue only) ---------------------------------------------
  if (RESET) {
    const before = {
      products: await Product.countDocuments(),
      brands: await Brand.countDocuments(),
      categories: await Category.countDocuments(),
      subCategories: await SubCategory.countDocuments(),
    }
    console.log("Reset: clearing catalogue only (users, orders, themes and settings are untouched)")
    console.log("  before:", before)
    if (!DRY_RUN) {
      await Product.deleteMany({})
      await Brand.deleteMany({})
      await SubCategory.deleteMany({})
      await Category.deleteMany({})
    }
    console.log("  cleared\n")
  }

  // --- Super admin ---------------------------------------------------------
  let admin = await User.findOne({ email: ADMIN.email })
  if (admin) {
    admin.isAdmin = true
    admin.isSuperAdmin = true
    admin.isEmailVerified = true
    admin.mustChangePassword = false
    admin.adminPermissions = { fullAccess: true }
    // Only reset the password when it no longer matches, so a changed password survives.
    if (!(await admin.matchPassword(ADMIN.password))) admin.password = ADMIN.password
    if (!DRY_RUN) await admin.save()
    console.log(`Super admin updated: ${ADMIN.email}`)
  } else if (!DRY_RUN) {
    admin = await User.create({
      name: ADMIN.name,
      email: ADMIN.email,
      password: ADMIN.password,
      isAdmin: true,
      isSuperAdmin: true,
      isEmailVerified: true,
      adminPermissions: { fullAccess: true },
    })
    console.log(`Super admin created: ${ADMIN.email}`)
  }
  const createdBy = admin?._id

  // --- Brands --------------------------------------------------------------
  const brandIds = {}
  for (const name of BRANDS) {
    if (DRY_RUN) { brandIds[name] = null; continue }
    const saved = await Brand.findOneAndUpdate(
      { slug: slug(name) },
      { $set: { name, slug: slug(name), isActive: true, createdBy } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    brandIds[name] = saved._id
  }
  console.log(`Brands ready: ${BRANDS.length}`)

  // --- Categories & subcategories -----------------------------------------
  const parentIds = {}
  const subIds = {}
  for (const [parent, subs] of Object.entries(TREE)) {
    if (!DRY_RUN) {
      const savedParent = await Category.findOneAndUpdate(
        { slug: slug(parent) },
        { $set: { name: parent, slug: slug(parent), isActive: true, createdBy } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      parentIds[parent] = savedParent._id
    }
    for (const sub of subs) {
      if (DRY_RUN) continue
      const savedSub = await SubCategory.findOneAndUpdate(
        { slug: slug(sub) },
        { $set: { name: sub, slug: slug(sub), category: parentIds[parent], isActive: true, createdBy } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      subIds[sub] = savedSub._id
    }
  }
  const subCount = Object.values(TREE).flat().length
  console.log(`Categories ready: ${Object.keys(TREE).length} parent, ${subCount} sub`)

  // --- Products ------------------------------------------------------------
  const rows = buildProductRows(TARGET_COUNT)
  if (rows.length < TARGET_COUNT) {
    console.warn(`Catalogue can only produce ${rows.length} unique products (asked ${TARGET_COUNT})`)
  }

  // slug carries a unique index, so a collision would abort the run part-written.
  // Catch it here, before the first write.
  const seen = new Map()
  for (const row of rows) {
    const s = slug(row.name)
    if (seen.has(s)) throw new Error(`Duplicate product slug "${s}": "${seen.get(s)}" vs "${row.name}"`)
    seen.set(s, row.name)
  }

  let created = 0
  let updated = 0
  for (const [i, row] of rows.entries()) {
    const sku = `IRH-${String(i + 1).padStart(4, "0")}`
    const doc = {
      name: row.name,
      sku,
      slug: slug(row.name),
      stockStatus: row.countInStock > 0 ? "In Stock" : "Out of Stock",
      brand: brandIds[row.brand],
      parentCategory: parentIds[row.parent],
      parentCategoryName: row.parent,
      parentCategorySlug: slug(row.parent),
      category: subIds[row.sub],
      categoryName: row.sub,
      categorySlug: slug(row.sub),
      subCategory: subIds[row.sub],
      description: `${row.name}. ${DESCRIPTIONS[row.sub]} Cut in ${row.fabric.toLowerCase()} with a ${row.fit.toLowerCase()} fit. Sample catalogue data for development.`,
      shortDescription: DESCRIPTIONS[row.sub],
      specifications: [
        { key: "Fabric", value: row.fabric },
        { key: "Fit", value: row.fit },
        { key: "Colour", value: row.colour },
        { key: "Available Sizes", value: row.sizes.join(", ") },
        { key: "Care", value: "Dry clean recommended" },
      ],
      buyingPrice: row.buyingPrice,
      price: row.price,
      offerPrice: row.offerPrice,
      discount: row.discount,
      ...(row.oldPrice ? { oldPrice: row.oldPrice } : {}),
      image: `https://placehold.co/800x1000/f5f3f0/1c1917/png?text=${encodeURIComponent(row.name)}`,
      countInStock: row.countInStock,
      rating: row.rating,
      numReviews: row.numReviews,
      featured: row.featured,
      isActive: true,
      hideFromShop: false,
      canPurchase: true,
      targetCountries: ["ALL"],
      tags: [row.brand, row.sub, row.colour, row.fabric, "sample"],
      createdBy,
    }

    if (DRY_RUN) { created++; continue }
    const res = await Product.updateOne({ sku }, { $set: doc }, { upsert: true, setDefaultsOnInsert: true })
    if (res.upsertedCount) created++
    else updated++
  }

  console.log(`Products: ${created} created, ${updated} updated (${rows.length} total)`)

  // --- Colourway cross-links -------------------------------------------------
  // Every colourway is its own product, the way it is on the storefronts this
  // catalogue is modelled on. Siblings are attached as `variations` so the product
  // page can show a colour row whose tiles navigate to that colour's own page.
  if (!DRY_RUN) {
    const bySlug = new Map(
      (await Product.find({ sku: /^IRH-/ }).select("_id slug").lean()).map((d) => [d.slug, d]),
    )
    const groups = new Map()
    for (const row of rows) {
      const doc = bySlug.get(slug(row.name))
      if (!doc) continue
      // Brand is part of the key: two labels can use the same garment name.
      const key = `${row.brand}::${row.base}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push({ _id: doc._id, colour: row.colour })
    }

    let linked = 0
    for (const siblings of groups.values()) {
      if (siblings.length < 2) continue
      for (const self of siblings) {
        await Product.updateOne(
          { _id: self._id },
          {
            $set: {
              selfVariationText: self.colour,
              variations: siblings
                .filter((other) => String(other._id) !== String(self._id))
                .map((other) => ({ product: other._id, variationText: other.colour })),
            },
          },
        )
        linked++
      }
    }
    console.log(`Colourways: ${linked} products cross-linked across ${groups.size} garments`)
  }

  if (!DRY_RUN) {
    console.log("\nCollection totals:", {
      users: await User.countDocuments(),
      brands: await Brand.countDocuments(),
      categories: await Category.countDocuments(),
      subCategories: await SubCategory.countDocuments(),
      products: await Product.countDocuments(),
    })
  }

  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error("Seed failed:", err.message)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
