/**
 * Make an email field case-insensitive, on the way in *and* on the way out.
 *
 * The bug this closes: someone registers as "Fahad@Gmail.com", later types
 * "fahad@gmail.com", and is told their details are invalid. The record is right
 * there -- the lookup simply did not match it. The same mismatch also lets the
 * unique index treat the two spellings as two different people, so the address can
 * be registered twice.
 *
 * Mongoose's `lowercase: true` only covers half of it. It is a setter, so it runs
 * when a document is saved and NOT when a value is used in a query:
 *
 *     User.find({ email: "Fahad@Gmail.com" }).getFilter()
 *     // -> { email: "Fahad@Gmail.com" }   <- unchanged
 *
 * So the schema option fixes new writes while every `findOne({ email })` in the
 * codebase keeps missing. This plugin does both, which is why it is a plugin rather
 * than a field option copied into each model: there are a dozen lookup sites across
 * the routes and the fix has to hold for the ones written next year too.
 */

const normalize = (value) => (typeof value === "string" ? value.trim().toLowerCase() : value)

/** Normalise a filter value, including the operator forms a query might use. */
const normalizeCondition = (condition) => {
  if (typeof condition === "string") return normalize(condition)

  if (condition && typeof condition === "object" && !Array.isArray(condition)) {
    const out = { ...condition }
    for (const op of ["$eq", "$ne"]) {
      if (typeof out[op] === "string") out[op] = normalize(out[op])
    }
    for (const op of ["$in", "$nin"]) {
      if (Array.isArray(out[op])) out[op] = out[op].map(normalize)
    }
    // $regex is left alone: a caller writing one has chosen their own matching rules,
    // and lowercasing the pattern would silently change them.
    return out
  }

  return condition
}

/**
 * @param {import('mongoose').Schema} schema
 * @param {{ path?: string }} options which field holds the address
 */
export default function normalizeEmailPlugin(schema, { path = "email" } = {}) {
  const field = schema.path(path)
  if (field) {
    // Writes, including `new Model()` and `doc.email = ...`.
    field.options.lowercase = true
    field.options.trim = true
    field.lowercase(true)
    field.trim(true)
  }

  // Reads and updates. Covers find, findOne, count, update*, delete*, findOneAnd*.
  schema.pre(/^(find|count|update|delete|replace)/i, function normalizeQueryEmail() {
    const filter = this.getFilter?.()
    if (filter && filter[path] !== undefined) {
      filter[path] = normalizeCondition(filter[path])
    }

    // An upsert writes its filter values, so $setOnInsert has to agree with it.
    const update = this.getUpdate?.()
    if (update && typeof update === "object" && !Array.isArray(update)) {
      for (const key of ["$set", "$setOnInsert"]) {
        if (update[key] && typeof update[key][path] === "string") {
          update[key][path] = normalize(update[key][path])
        }
      }
      if (typeof update[path] === "string") update[path] = normalize(update[path])
    }
  })

  // insertMany skips document setters in some paths; normalise explicitly.
  schema.pre("insertMany", function normalizeInsertMany(next, docs) {
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        if (doc && typeof doc[path] === "string") doc[path] = normalize(doc[path])
      }
    }
    next()
  })
}

export { normalize as normalizeEmailValue }
