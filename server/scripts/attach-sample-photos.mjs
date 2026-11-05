/**
 * Swap the sample catalogue's placeholder images for real photographs.
 *
 * The 100 seeded products ship pointing at placehold.co, which renders a grey card
 * with the product name on it. This attaches free-licence Pexels photography instead
 * so the storefront can be looked at properly.
 *
 * These are stock photos of garments the shop does not sell. They are development
 * dressing, not product photography -- every one of these products must get its own
 * picture before the shop takes real orders.
 *
 *   node scripts/attach-sample-photos.mjs            # attach
 *   node scripts/attach-sample-photos.mjs --revert   # back to placeholders
 *   node scripts/attach-sample-photos.mjs --dry-run
 */

import mongoose from "mongoose"
import dotenv from "dotenv"
import Product from "../models/productModel.js"

dotenv.config()

const DRY_RUN = process.argv.includes("--dry-run")
const REVERT = process.argv.includes("--revert")

// Pexels photo ids, grouped by the subcategory they suit. Pools are larger than the
// number of products in each subcategory so no two products share a photo.
const POOLS = {
  "Everyday Abayas": [8069812, 19298225, 14693247, 8995906, 9340638, 7920188, 7451485, 7653719, 6879815, 9880858, 9881075],
  Kaftans: [13838842, 14876544, 33539326, 32178223, 33287561, 9880848, 32688174, 32347431],
  "Occasion Abayas": [18410346, 8995806, 33108120, 32208656, 34201033, 32279501, 31049717],
  Handbags: [5352628, 7953286, 22432991, 9327162, 22434759, 21897147, 8989582, 21897141, 8335273, 16117896],
  Jewellery: [29043373, 5301351, 7314460, 7314466, 28933801, 14587263, 29013500, 12753202],
  "Scarves & Shawls": [33775823, 9218389, 12486130, 35226950, 8068685, 33064878, 8217789, 4577190, 11719178, 7951667],
  Skirts: [39030338, 7391126, 19451307, 16431244, 22670642, 37914449, 35182320, 31411871, 33317708, 18040012],
  Trousers: [2897539, 17082930, 19995460, 9464625, 7205905, 2897533, 10341113, 8121927, 15973341, 7890401],
  "Wide-Leg & Palazzo": [7506920, 22021124, 7716960, 18434636, 13958659, 19915582, 7716929, 32275941],
  "Evening Gowns": [7545423, 29017408, 6181955, 18586865, 8576047, 29124227, 6675408, 16247436, 8180704, 18123990],
  "Maxi Dresses": [27729272, 15752094, 36941400, 18904271, 5351265, 29147761, 34430282, 14247257],
  "Midi Dresses": [34037596, 30957211, 29538467, 4672084, 2774198, 18685528, 17640130, 17305436],
  Flats: [34294446, 134064, 10070653, 17739689, 28821783, 31997236, 27023941, 10827097, 10114295],
  Heels: [37827333, 37827334, 34327718, 33868462, 34431026, 30015950, 17826424, 6920411, 9733835],
  Sandals: [37595216, 36076377, 37190208, 38708847, 37906245, 10494661],
  Blouses: [9594685, 17153130, 6123725, 18467220, 14825166, 31580592, 8289271, 28428043, 31518837, 17899636, 28428049, 37851043],
  Knitwear: [37415219, 37607882, 38748660, 40106866, 36416660, 39655902, 8201205, 27849638],
  Tunics: [12133990, 10164658, 7700270, 7413284, 5737286, 7679447, 13155693, 14579309],
}

// Portrait crop at a size that serves the 4:5 product tiles without being wasteful.
const photoUrl = (id, w = 900, h = 1200) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`

const placeholderUrl = (name) =>
  `https://placehold.co/800x1000/f5f3f0/1c1917/png?text=${encodeURIComponent(name)}`

// A dead image is worse than a placeholder, so every url is checked before it is
// written. HEAD is enough and avoids pulling ~200 full-size photographs.
const isLive = async (url) => {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) })
    return res.ok
  } catch {
    return false
  }
}

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set -- check server/.env")
    process.exit(1)
  }

  const conn = await mongoose.connect(process.env.MONGO_URI)
  console.log(`Connected: ${conn.connection.host}/${conn.connection.db.databaseName}`)

  // Only ever touches the seeded sample catalogue; anything added through the admin
  // keeps whatever image it was given.
  const products = await Product.find({ sku: /^IRH-/ })
    .select("_id name sku categoryName image")
    .sort({ sku: 1 })
    .lean()

  if (products.length === 0) {
    console.log("No sample products found (sku IRH-*). Nothing to do.")
    await mongoose.disconnect()
    return
  }

  if (REVERT) {
    let n = 0
    for (const p of products) {
      if (!DRY_RUN) {
        await Product.updateOne({ _id: p._id }, { $set: { image: placeholderUrl(p.name), galleryImages: [] } })
      }
      n++
    }
    console.log(`Reverted ${n} products to placeholders.`)
    await mongoose.disconnect()
    return
  }

  // Hand out one photo per product, walking each subcategory's pool in order.
  const cursor = {}
  const assignments = []
  const noPool = new Set()

  for (const p of products) {
    const pool = POOLS[p.categoryName]
    if (!pool?.length) {
      noPool.add(p.categoryName)
      continue
    }
    const i = cursor[p.categoryName] ?? 0
    cursor[p.categoryName] = i + 1
    if (i >= pool.length) {
      console.warn(`  pool exhausted for "${p.categoryName}" -- ${p.sku} keeps its placeholder`)
      continue
    }
    assignments.push({ product: p, id: pool[i] })
  }

  if (noPool.size) console.warn("No pool for:", [...noPool].join(", "))
  console.log(`Assigning ${assignments.length} photos; verifying each one...`)

  let ok = 0
  let dead = 0
  for (const { product, id } of assignments) {
    const main = photoUrl(id)
    if (!(await isLive(main))) {
      console.warn(`  DEAD ${id} -- ${product.sku} keeps its placeholder`)
      dead++
      continue
    }

    if (!DRY_RUN) {
      await Product.updateOne(
        { _id: product._id },
        {
          $set: {
            image: main,
            // Same photo at three crops: the product page's thumbnail strip needs more
            // than one entry to render at all.
            galleryImages: [main, photoUrl(id, 900, 1125), photoUrl(id, 1200, 1200)],
          },
        },
      )
    }
    ok++
    if (ok % 20 === 0) console.log(`  ${ok}/${assignments.length}`)
  }

  console.log(`\nDone: ${ok} products updated, ${dead} skipped (dead url).`)
  if (DRY_RUN) console.log("DRY RUN -- nothing was written.")
  await mongoose.disconnect()
}

run().catch(async (err) => {
  console.error("Failed:", err.message)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
