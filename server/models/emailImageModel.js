import mongoose from "mongoose"

/**
 * The image manager's index.
 *
 * The files themselves sit in uploads/emails. This records what was uploaded and
 * which folder the admin filed it under, so the picker can show folders without
 * reading the disk on every request.
 *
 * `url` is stored as the site-relative path; it is made absolute at render time
 * (utils/emailAssets.js), never here, because the public host can change.
 */
const emailImageSchema = new mongoose.Schema(
  {
    folder: { type: String, default: "General", trim: true, index: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
)

const EmailImage = mongoose.model("EmailImage", emailImageSchema)

export default EmailImage
