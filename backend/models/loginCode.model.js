const mongoose = require("mongoose");

const loginCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    lastSentAt: { type: Date, required: true, default: Date.now },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "loginCodes" },
);

loginCodeSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("LoginCode", loginCodeSchema);
