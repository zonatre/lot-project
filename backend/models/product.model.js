const mongoose = require("mongoose");

const productSourceItemSchema = new mongoose.Schema(
  {
    source: { type: String, default: "parasut" },
    parasutId: { type: String, required: true },
    name: { type: String, required: true },
    code: { type: String, default: "" },
    barcode: { type: String, default: "" },
    archived: { type: Boolean, default: false },
    unit: { type: String, default: "" },
    currency: { type: String, default: "" },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    canonicalName: { type: String, required: true, unique: true, trim: true, index: true },
    status: { type: String, enum: ["Active", "Passive"], default: "Active" },
    currentActiveLot: { type: String, default: null },
    skt: { type: String, default: null },
    parasutProductIds: [{ type: String, index: true }],
    sourceItems: [productSourceItemSchema],
  },
  { timestamps: true, collection: "products" },
);

module.exports = mongoose.model("Product", productSchema);
