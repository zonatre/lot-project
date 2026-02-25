const express = require("express");
const productController = require("../controllers/product.controller");

const router = express.Router();

router.get("/", productController.listProducts);
router.get("/sales-lot-assignments/export", productController.listSalesLotAssignmentsForExport);
router.patch("/:id", productController.updateProduct);
router.post("/:id/source-items", productController.addProductSourceItem);
router.delete("/:id/source-items/:parasutId", productController.removeProductSourceItem);
router.get("/:id", productController.getProductById);
router.get("/:id/lots", productController.listProductLots);
router.get("/:id/lots/:lotId", productController.getProductLotDetail);
router.get("/:id/sales-lot-assignments", productController.listProductSalesLotAssignments);
router.post("/:id/lots", productController.createProductLot);

module.exports = router;
