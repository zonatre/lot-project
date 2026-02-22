const Product = require("../models/product.model");
const Lot = require("../models/lot.model");
const SalesLotAssignment = require("../models/salesLotAssignment.model");
const DraftProduct = require("../models/draftProduct.model");

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeSktToMonth(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const monthFormat = /^(\d{4})-(\d{2})$/;
  const dayFormat = /^(\d{4})-(\d{2})-(\d{2})$/;

  const monthMatch = raw.match(monthFormat);
  if (monthMatch) {
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) return raw;
    return "";
  }

  const dayMatch = raw.match(dayFormat);
  if (dayMatch) {
    const month = Number(dayMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${dayMatch[1]}-${dayMatch[2]}`;
    }
  }

  return "";
}

function extractOrderAndChannel(invoiceName, invoiceId) {
  const raw = String(invoiceName || "").trim();
  if (!raw) {
    return { orderNumber: String(invoiceId || ""), channel: "-" };
  }

  const [left, ...rest] = raw.split("|");
  const orderNumber = String(left || "").trim() || String(invoiceId || "");
  const channel = String(rest.join("|") || "").trim() || "-";
  return { orderNumber, channel };
}

async function detachParasutIdsFromConflicts(excludedProductId, parasutIds) {
  const conflicts = await Product.find({
    _id: { $ne: excludedProductId },
    parasutProductIds: { $in: parasutIds },
  });

  for (const conflict of conflicts) {
    conflict.parasutProductIds = conflict.parasutProductIds.filter(
      (id) => !parasutIds.includes(id),
    );
    conflict.sourceItems = conflict.sourceItems.filter(
      (item) => !parasutIds.includes(item.parasutId),
    );

    if (conflict.parasutProductIds.length === 0) {
      await Product.deleteOne({ _id: conflict._id });
    } else {
      await conflict.save();
    }
  }
}

exports.listProducts = async (req, res, next) => {
  try {
    const products = await Product.find({}).sort({ updatedAt: -1, canonicalName: 1 });
    return res.status(200).json({ data: products });
  } catch (error) {
    return next(error);
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({ data: product });
  } catch (error) {
    return next(error);
  }
};

exports.listProductLots = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const lots = await Lot.find({ productId: product._id }).sort({ createdAt: -1 });
    return res.status(200).json({ data: lots });
  } catch (error) {
    return next(error);
  }
};

exports.createProductLot = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const { lotNumber, skt, note } = req.body || {};
    if (!lotNumber || !skt) {
      return res.status(400).json({ message: "lotNumber and skt are required" });
    }
    const normalizedSkt = normalizeSktToMonth(skt);
    if (!normalizedSkt) {
      return res.status(400).json({ message: "skt must be in YYYY-MM format" });
    }

    await Lot.updateMany(
      { productId: product._id, status: "Active" },
      { $set: { status: "Passive", closedAt: new Date() } },
    );

    const lot = await Lot.create({
      productId: product._id,
      lotNumber: String(lotNumber).trim(),
      skt: normalizedSkt,
      status: "Active",
      activatedAt: new Date(),
      note: note ? String(note) : "",
    });

    product.currentActiveLot = lot.lotNumber;
    product.skt = lot.skt;
    await product.save();

    return res.status(201).json({ data: lot });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This lotNumber already exists for this product" });
    }
    return next(error);
  }
};

exports.listProductSalesLotAssignments = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const assignments = await SalesLotAssignment.find({ productId: product._id })
      .sort({ createdAt: -1 })
      .limit(200);

    return res.status(200).json({ data: assignments });
  } catch (error) {
    return next(error);
  }
};

exports.listSalesLotAssignmentsForExport = async (req, res, next) => {
  try {
    const startDate = String(req.query.start_date || "").trim();
    const endDate = String(req.query.end_date || "").trim();
    const all = String(req.query.all || "").toLowerCase() === "true";

    const page = parsePositiveInteger(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInteger(req.query.page_size, 100), 500);

    const filter = {};
    if (startDate || endDate) {
      filter.issueDate = {};
      if (startDate) filter.issueDate.$gte = startDate;
      if (endDate) filter.issueDate.$lte = endDate;
    }

    const totalCount = await SalesLotAssignment.countDocuments(filter);

    let query = SalesLotAssignment.find(filter)
      .sort({ issueDate: -1, createdAt: -1 })
      .populate({ path: "productId", select: "canonicalName skt sourceItems" });

    if (!all) {
      query = query.skip((page - 1) * pageSize).limit(pageSize);
    }

    const assignments = await query.lean();

    const rows = assignments.map((row) => {
      const product = row?.productId && typeof row.productId === "object" ? row.productId : null;
      const sourceItem = Array.isArray(product?.sourceItems)
        ? product.sourceItems.find((item) => item?.parasutId === row.parasutProductId)
        : null;
      const { orderNumber, channel } = extractOrderAndChannel(
        row.invoiceName || row.invoiceNumber,
        row.invoiceId,
      );

      return {
        id: String(row._id),
        issueDate: String(row.issueDate || ""),
        orderNumber,
        channel,
        productName: String(product?.canonicalName || "Bilinmiyor"),
        sku: String(sourceItem?.code || row.parasutProductId || ""),
        skt: product?.skt || null,
        lotNumber: String(row.lotNumber || ""),
        warehouse: String(row.warehouse || "Ana Depo"),
        quantity: Number(row?.raw?.detail?.attributes?.quantity || 1),
        invoiceNo: String(row.invoiceNumber || row.invoiceId || ""),
      };
    });

    return res.status(200).json({
      data: rows,
      meta: {
        page: all ? 1 : page,
        pageSize: all ? rows.length : pageSize,
        totalCount,
        totalPages: all ? 1 : Math.max(Math.ceil(totalCount / pageSize), 1),
      },
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const canonicalName = String(req.body?.canonicalName || "").trim();
    if (!canonicalName) {
      return res.status(400).json({ message: "canonicalName is required" });
    }

    const existing = await Product.findOne({
      _id: { $ne: product._id },
      canonicalName,
    });
    if (existing) {
      return res.status(409).json({ message: "Another product already uses this name" });
    }

    product.canonicalName = canonicalName;
    await product.save();

    return res.status(200).json({ data: product });
  } catch (error) {
    return next(error);
  }
};

exports.addProductSourceItem = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const parasutId = String(req.body?.parasutId || "").trim();
    const fallbackCode = String(req.body?.code || "").trim();
    const fallbackBarcode = String(req.body?.barcode || "").trim();
    const fallbackUnit = String(req.body?.unit || "").trim();
    const fallbackCurrency = String(req.body?.currency || "").trim();

    if (!parasutId) {
      return res.status(400).json({ message: "parasutId is required" });
    }

    const draft = await DraftProduct.findOne({ parasutId });
    const name = String(draft?.name || "").trim();
    if (!name) {
      return res.status(400).json({
        message: "Draft kaydı bulunamadı. Lütfen önce Paraşüt taslaklarını senkronize edin.",
      });
    }

    await detachParasutIdsFromConflicts(product._id, [parasutId]);

    const sourceItem = {
      parasutId,
      name,
      code: String(draft?.code || fallbackCode).trim(),
      barcode: String(draft?.barcode || fallbackBarcode).trim(),
      archived: Boolean(draft?.archived),
      unit: String(draft?.unit || fallbackUnit).trim(),
      currency: String(draft?.currency || fallbackCurrency).trim(),
    };

    const existingById = new Map(
      product.sourceItems.map((item) => [
        item.parasutId,
        item.toObject ? item.toObject() : item,
      ]),
    );
    existingById.set(parasutId, sourceItem);

    product.parasutProductIds = Array.from(
      new Set([...(product.parasutProductIds || []), parasutId]),
    );
    product.sourceItems = Array.from(existingById.values());
    await product.save();

    return res.status(200).json({ data: product });
  } catch (error) {
    return next(error);
  }
};
