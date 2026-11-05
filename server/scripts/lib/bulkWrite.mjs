/**
 * The shape every bulk-write script in this repo follows.
 *
 * A one-off script that rewrites thousands of documents is the most dangerous code in
 * the project: it runs once, usually in a hurry, usually against production, and it is
 * the only thing here with no undo. The rules below exist because each of them is a
 * mistake somebody has actually made.
 *
 *   1. DRY RUN BY DEFAULT. Nothing is written without an explicit --write. A script
 *      that acts the moment you run it will eventually be run before it was ready.
 *
 *   2. REPORT BEFORE ACTING. What matched, what did not, what was already correct.
 *      A number on its own ("1,284 updated") cannot be checked by anyone.
 *
 *   3. BACK UP BEFORE THE FIRST WRITE, not after, and back up every document the run
 *      will touch -- whole documents, not just the fields being changed, because the
 *      field you did not expect to change is the one you will need back.
 *
 *      The backup is EJSON (`mongoose.mongo.BSON.EJSON`), not JSON. Plain JSON turns
 *      an ObjectId into a string and a Date into a string, so restoring from it gives
 *      you documents that look right and no longer match anything by reference. EJSON
 *      keeps them as themselves and the restore is exact.
 *
 *   4. --restore LIVES IN THE SAME SCRIPT. A backup whose restore code has to be
 *      written afterwards, under pressure, is not a backup. It is a file.
 *
 *   5. PREFER HIDING TO DELETING. Anything an order or an invoice points at is
 *      deactivated, never destroyed, or the order history stops resolving.
 *
 * Usage:
 *
 *     import { runBulkScript } from "./lib/bulkWrite.mjs"
 *
 *     await runBulkScript({
 *       name: "normalize-emails",
 *       plan: async () => [{ model: User, _id, before: {...}, after: {...}, label }],
 *     })
 */

import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import mongoose from "mongoose"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKUP_DIR = path.join(__dirname, "..", "backups")

const EJSON = () => mongoose.mongo.BSON.EJSON

const exists = async (candidate) => {
  try {
    await fs.access(candidate)
    return true
  } catch {
    return false
  }
}

/** An absolute path, a path from the current directory, or a bare filename. */
const resolveBackupPath = async (file) => {
  const candidates = path.isAbsolute(file)
    ? [file]
    : [path.resolve(process.cwd(), file), path.join(BACKUP_DIR, path.basename(file))]

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate
  }

  throw new Error(
    `Backup not found: ${file}\nLooked in:\n  ${candidates.join("\n  ")}`,
  )
}

export const parseArgs = (argv = process.argv.slice(2)) => {
  const args = { write: false, restore: null, limit: 0 }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--write") args.write = true
    else if (arg === "--restore") args.restore = argv[++i]
    else if (arg === "--limit") args.limit = Number(argv[++i]) || 0
  }
  return args
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-")

/**
 * Write the backup. Every whole document that is about to change, as EJSON.
 * Returns the path, which is printed before any write happens.
 */
const writeBackup = async (name, documents) => {
  await fs.mkdir(BACKUP_DIR, { recursive: true })
  const file = path.join(BACKUP_DIR, `${name}-${stamp()}.ejson`)

  await fs.writeFile(
    file,
    EJSON().stringify(
      { script: name, takenAt: new Date(), count: documents.length, documents },
      { relaxed: false },
    ),
  )

  return file
}

/**
 * Put a backup back exactly as it was.
 *
 * `collection` is recorded per document so one backup can span several collections
 * and still restore each row to the right place.
 */
export const restoreBackup = async (file) => {
  // Accept whatever the operator pastes: an absolute path, a path relative to where
  // they are standing, or the bare filename the script printed. Joining a relative
  // path onto the backup directory unconditionally produces
  // "scripts/backups/scripts/backups/..." and a confusing ENOENT.
  const resolved = await resolveBackupPath(file)
  const raw = await fs.readFile(resolved, "utf8")
  const parsed = EJSON().parse(raw, { relaxed: false })
  const documents = parsed.documents || []

  console.log(`Restoring ${documents.length} document(s) from ${path.basename(file)}`)
  console.log(`Backup taken ${parsed.takenAt}\n`)

  let restored = 0
  for (const entry of documents) {
    const collection = mongoose.connection.db.collection(entry.collection)
    // replaceOne, not updateOne: the document goes back exactly as it was, including
    // fields the script added, which an update would leave behind.
    await collection.replaceOne({ _id: entry.document._id }, entry.document, { upsert: true })
    restored += 1
  }

  console.log(`Restored ${restored} document(s).`)
  return restored
}

/**
 * @param {object} options
 * @param {string} options.name used for the backup filename
 * @param {() => Promise<Array<{model: any, _id: any, label: string, after: object, skip?: boolean, reason?: string}>>} options.plan
 *        Return one entry per document that WOULD change. Entries with `skip: true`
 *        are reported and not written -- that is how "already correct" gets counted.
 */
export const runBulkScript = async ({ name, plan }) => {
  const args = parseArgs()

  if (args.restore) {
    await restoreBackup(args.restore)
    return
  }

  console.log(`\n${name}`)
  console.log("=".repeat(name.length))
  console.log(args.write ? "MODE: WRITE — changes will be saved\n" : "MODE: DRY RUN — nothing will be written (pass --write to apply)\n")

  const entries = await plan()
  const changes = entries.filter((entry) => !entry.skip)
  const skipped = entries.filter((entry) => entry.skip)

  // 2. Report before acting.
  console.log(`Examined : ${entries.length}`)
  console.log(`To change: ${changes.length}`)
  console.log(`Unchanged: ${skipped.length}\n`)

  if (changes.length) {
    const preview = args.limit ? changes.slice(0, args.limit) : changes.slice(0, 25)
    console.log("Changes:")
    for (const change of preview) {
      console.log(`  ${change.label}`)
    }
    if (changes.length > preview.length) {
      console.log(`  … and ${changes.length - preview.length} more`)
    }
    console.log()
  }

  if (!args.write) {
    console.log("Dry run complete. Re-run with --write to apply.\n")
    return
  }

  if (!changes.length) {
    console.log("Nothing to do.\n")
    return
  }

  // 3. Back up BEFORE the first write — whole documents.
  const documents = []
  for (const change of changes) {
    const existing = await change.model.findById(change._id).lean()
    if (existing) {
      documents.push({ collection: change.model.collection.collectionName, document: existing })
    }
  }

  const backupFile = await writeBackup(name, documents)
  console.log(`Backup written: ${backupFile}`)
  console.log(`Undo with:      node scripts/${name}.mjs --restore ${path.basename(backupFile)}\n`)

  let written = 0
  let failed = 0
  for (const change of changes) {
    try {
      await change.model.updateOne({ _id: change._id }, { $set: change.after })
      written += 1
    } catch (error) {
      failed += 1
      console.error(`  FAILED ${change.label}: ${error.message}`)
    }
  }

  console.log(`\nWritten: ${written}`)
  if (failed) console.log(`Failed : ${failed}`)
  console.log()
}

export default { runBulkScript, restoreBackup, parseArgs }
