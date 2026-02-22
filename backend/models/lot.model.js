const mongoose = require("mongoose");

const lotSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    lotNumber: { type: String, required: true, trim: true },
    skt: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    status: { type: String, enum: ["Active", "Passive"], default: "Active", index: true },
    activatedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true, collection: "lots" },
);

lotSchema.index({ productId: 1, lotNumber: 1 }, { unique: true });

module.exports = mongoose.model("Lot", lotSchema);
