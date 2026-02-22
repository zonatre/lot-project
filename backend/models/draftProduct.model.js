const mongoose = require("mongoose");

const draftProductSchema = new mongoose.Schema(
  {
    source: { type: String, default: "parasut", index: true },
    parasutId: { type: String, required: true, unique: true, index: true },
    companyId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, default: "", trim: true },
    barcode: { type: String, default: "", trim: true },
    archived: { type: Boolean, default: false },
    unit: { type: String, default: "" },
    currency: { type: String, default: "" },
    raw: { type: Object, default: {} },
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: "draftProducts" },
);

module.exports = mongoose.model("DraftProduct", draftProductSchema);
