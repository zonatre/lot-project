const express = require("express");
const parasutAuthController = require("../controllers/parasutAuth.controller");

const router = express.Router();

router.get("/auth-url", parasutAuthController.getAuthUrl);
router.get("/token/status", parasutAuthController.tokenStatus);
router.get("/proxy", parasutAuthController.proxyGet);
router.get("/products", parasutAuthController.getProducts);
router.get("/products/all", parasutAuthController.getAllProducts);
router.get("/drafts", parasutAuthController.getDraftProducts);
router.get("/mappings", parasutAuthController.listProductMappings);
router.delete("/mappings/:id", parasutAuthController.deleteProductMapping);
router.post("/token/exchange", parasutAuthController.exchangeCode);
router.post("/token/refresh", parasutAuthController.refreshToken);
router.post("/sync-drafts", parasutAuthController.syncDraftProducts);
router.post("/sync-sales-lots", parasutAuthController.syncSalesInvoicesAndAssignLots);
router.post("/mappings", parasutAuthController.saveProductMappings);

module.exports = router;
