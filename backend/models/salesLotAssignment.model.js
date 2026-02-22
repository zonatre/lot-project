const mongoose = require("mongoose");

const salesLotAssignmentSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true, index: true },
    issueDate: { type: String, required: true, index: true },
    invoiceId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, default: "" },
    invoiceName: { type: String, default: "" },
    invoiceDetailId: { type: String, required: true, unique: true, index: true },
    parasutProductId: { type: String, required: true, index: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lot",
      required: true,
      index: true,
    },
    lotNumber: { type: String, required: true },
    unit: { type: String, default: "" },
    warehouse: { type: String, default: "Ana Depo", index: true },
    source: { type: String, default: "parasut_sales_invoice" },
    raw: { type: Object, default: {} },
  },
  { timestamps: true, collection: "salesLotAssignments" },
);

module.exports = mongoose.model("SalesLotAssignment", salesLotAssignmentSchema);
