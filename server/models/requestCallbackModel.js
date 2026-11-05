import mongoose from 'mongoose';

import normalizeEmailPlugin from "./plugins/normalizeEmail.js"
const requestCallbackSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    countryCode: { type: String },
    customerNote: { type: String },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String },
    productLink: { type: String },
    status: {
      type: String,
      enum: ['pending', 'done', 'spam'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// Addresses are matched case-insensitively. See the plugin for why the schema's
// own `lowercase: true` is not enough on its own.
requestCallbackSchema.plugin(normalizeEmailPlugin)

const RequestCallback = mongoose.model('RequestCallback', requestCallbackSchema);
export default RequestCallback;
