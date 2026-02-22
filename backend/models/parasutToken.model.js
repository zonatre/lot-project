const mongoose = require("mongoose");

const parasutTokenSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      unique: true,
      default: "parasut",
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    tokenType: {
      type: String,
      default: "bearer",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    raw: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ParasutToken", parasutTokenSchema);
