const ParasutToken = require("../models/parasutToken.model");
const DraftProduct = require("../models/draftProduct.model");
const Product = require("../models/product.model");
const Lot = require("../models/lot.model");
const SalesLotAssignment = require("../models/salesLotAssignment.model");

const PARASUT_BASE_URL = process.env.PARASUT_BASE_URL || "https://api.parasut.com";
const PARASUT_CLIENT_ID = process.env.PARASUT_CLIENT_ID;
const PARASUT_CLIENT_SECRET = process.env.PARASUT_CLIENT_SECRET;
const PARASUT_REDIRECT_URI =
  process.env.PARASUT_REDIRECT_URI || "urn:ietf:wg:oauth:2.0:oob";
const PARASUT_COMPANY_ID = process.env.PARASUT_COMPANY_ID;
const PARASUT_PAGE_SIZE = Math.min(
  Math.max(Number(process.env.PARASUT_PAGE_SIZE || 15), 1),
  25,
);
const PARASUT_REQUEST_DELAY_MS = Math.max(
  Number(process.env.PARASUT_REQUEST_DELAY_MS || 250),
  0,
);
const PARASUT_MAX_RETRY = Math.max(Number(process.env.PARASUT_MAX_RETRY || 5), 0);
const PARASUT_RETRY_BASE_MS = Math.max(Number(process.env.PARASUT_RETRY_BASE_MS || 750), 100);
const PARASUT_MAX_PAGES = Math.max(Number(process.env.PARASUT_MAX_PAGES || 0), 0);
const DEFAULT_WAREHOUSE_NAME = process.env.DEFAULT_WAREHOUSE_NAME || "Ana Depo";

function assertParasutEnv() {
  if (!PARASUT_CLIENT_ID || !PARASUT_CLIENT_SECRET) {
    const error = new Error("PARASUT_CLIENT_ID and PARASUT_CLIENT_SECRET are required");
    error.statusCode = 500;
    throw error;
  }
}

function buildAuthorizeUrl() {
  assertParasutEnv();

  const params = new URLSearchParams({
    client_id: PARASUT_CLIENT_ID,
    redirect_uri: PARASUT_REDIRECT_URI,
    response_type: "code",
  });

  return `${PARASUT_BASE_URL}/oauth/authorize?${params.toString()}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getYesterdayDateString() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

async function postToken(payload) {
  assertParasutEnv();

  const body = new URLSearchParams({
    ...payload,
    client_id: PARASUT_CLIENT_ID,
    client_secret: PARASUT_CLIENT_SECRET,
  });

  const response = await fetch(`${PARASUT_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error("Parasut token request failed");
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function persistToken(data) {
  const expiresInSec = Number(data.expires_in || 7200);
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);

  const token = await ParasutToken.findOneAndUpdate(
    { provider: "parasut" },
    {
      provider: "parasut",
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type || "bearer",
      expiresAt,
      raw: data,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return token;
}

async function getValidAccessToken() {
  const saved = await ParasutToken.findOne({ provider: "parasut" });
  if (!saved) {
    const error = new Error("No Parasut token found. Exchange code first.");
    error.statusCode = 400;
    throw error;
  }

  const isExpired = Date.now() >= new Date(saved.expiresAt).getTime();
  if (!isExpired) {
    return saved.accessToken;
  }

  const refreshed = await postToken({
    grant_type: "refresh_token",
    refresh_token: saved.refreshToken,
  });

  const token = await persistToken(refreshed);
  return token.accessToken;
}

async function parasutGet(path, query = {}) {
  const targetUrl = new URL(`${PARASUT_BASE_URL}${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      targetUrl.searchParams.append(key, String(value));
    }
  });

  let attempt = 0;
  while (true) {
    const accessToken = await getValidAccessToken();
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await response.json().catch(() => ({}));

    if (response.ok) {
      return payload;
    }

    if (response.status === 429 && attempt < PARASUT_MAX_RETRY) {
      const retryAfterHeader = Number(response.headers.get("retry-after"));
      const retryAfterMs =
        Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : PARASUT_RETRY_BASE_MS * Math.pow(2, attempt);

      attempt += 1;
      await sleep(retryAfterMs);
      continue;
    }

    const error = new Error("Parasut GET request failed");
    error.statusCode = response.status;
    error.details = payload;
    throw error;
  }
}

async function fetchAllProducts(query = {}) {
  const size = Math.min(
    Math.max(Number(query["page[size]"] || PARASUT_PAGE_SIZE), 1),
    25,
  );
  let currentPage = 1;
  let totalPages = 1;
  const allData = [];
  const includedMap = new Map();

  while (
    currentPage <= totalPages &&
    (PARASUT_MAX_PAGES === 0 || currentPage <= PARASUT_MAX_PAGES)
  ) {
    const payload = await parasutGet(`/v4/${query.companyId}/products`, {
      "filter[name]": query["filter[name]"],
      "filter[code]": query["filter[code]"],
      sort: query.sort || "-id",
      "page[number]": currentPage,
      "page[size]": size,
      include: query.include,
    });

    if (Array.isArray(payload.data)) {
      allData.push(...payload.data);
    }

    if (Array.isArray(payload.included)) {
      payload.included.forEach((item) => {
        if (item?.id && item?.type) {
          includedMap.set(`${item.type}:${item.id}`, item);
        }
      });
    }

    totalPages = Number(payload?.meta?.total_pages || 1);
    currentPage += 1;

    if (currentPage <= totalPages && PARASUT_REQUEST_DELAY_MS > 0) {
      await sleep(PARASUT_REQUEST_DELAY_MS);
    }
  }

  return {
    data: allData,
    included: Array.from(includedMap.values()),
    meta: {
      current_page: 1,
      total_pages: totalPages,
      total_count: allData.length,
    },
  };
}

async function fetchAllSalesInvoices(query = {}) {
  const size = Math.min(
    Math.max(Number(query["page[size]"] || PARASUT_PAGE_SIZE), 1),
    25,
  );
  let currentPage = 1;
  let totalPages = 1;
  const allData = [];
  const includedMap = new Map();

  while (
    currentPage <= totalPages &&
    (PARASUT_MAX_PAGES === 0 || currentPage <= PARASUT_MAX_PAGES)
  ) {
    const payload = await parasutGet(`/v4/${query.companyId}/sales_invoices`, {
      "filter[issue_date]": query["filter[issue_date]"],
      sort: query.sort || "-id",
      "page[number]": currentPage,
      "page[size]": size,
      include: query.include || "details,details.product",
    });

    if (Array.isArray(payload.data)) {
      allData.push(...payload.data);
    }

    if (Array.isArray(payload.included)) {
      payload.included.forEach((item) => {
        if (item?.id && item?.type) {
          includedMap.set(`${item.type}:${item.id}`, item);
        }
      });
    }

    totalPages = Number(payload?.meta?.total_pages || 1);
    currentPage += 1;

    if (currentPage <= totalPages && PARASUT_REQUEST_DELAY_MS > 0) {
      await sleep(PARASUT_REQUEST_DELAY_MS);
    }
  }

  return {
    data: allData,
    includedMap,
  };
}

function normalizeDraftProduct(item, companyId) {
  const attrs = item?.attributes || {};
  return {
    source: "parasut",
    parasutId: String(item?.id || ""),
    companyId: String(companyId),
    name: String(attrs.name || "").trim(),
    code: String(attrs.code || "").trim(),
    barcode: String(attrs.barcode || "").trim(),
    archived: Boolean(attrs.archived),
    unit: String(attrs.unit || "").trim(),
    currency: String(attrs.currency || "").trim(),
    raw: item || {},
    syncedAt: new Date(),
  };
}

exports.getAuthUrl = async (req, res, next) => {
  try {
    const authUrl = buildAuthorizeUrl();
    res.status(200).json({ authUrl, redirectUri: PARASUT_REDIRECT_URI });
  } catch (error) {
    next(error);
  }
};

exports.exchangeCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: "code is required" });
    }

    const tokenData = await postToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: PARASUT_REDIRECT_URI,
    });

    const token = await persistToken(tokenData);

    return res.status(200).json({
      message: "Parasut token stored",
      expiresAt: token.expiresAt,
      tokenType: token.tokenType,
    });
  } catch (error) {
    return next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const saved = await ParasutToken.findOne({ provider: "parasut" });
    if (!saved?.refreshToken) {
      return res.status(400).json({ message: "No refresh token found. Exchange code first." });
    }

    const tokenData = await postToken({
      grant_type: "refresh_token",
      refresh_token: saved.refreshToken,
    });

    const token = await persistToken(tokenData);

    return res.status(200).json({
      message: "Parasut token refreshed",
      expiresAt: token.expiresAt,
      tokenType: token.tokenType,
    });
  } catch (error) {
    return next(error);
  }
};

exports.tokenStatus = async (req, res, next) => {
  try {
    const saved = await ParasutToken.findOne({ provider: "parasut" });
    if (!saved) {
      return res.status(200).json({ connected: false });
    }

    return res.status(200).json({
      connected: true,
      expiresAt: saved.expiresAt,
      isExpired: Date.now() >= new Date(saved.expiresAt).getTime(),
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    return next(error);
  }
};

exports.proxyGet = async (req, res, next) => {
  try {
    const { path } = req.query;
    if (!path) {
      return res.status(400).json({ message: "path query parameter is required" });
    }

    const normalizedPath = String(path).startsWith("/") ? String(path) : `/${String(path)}`;
    const targetUrl = new URL(`${PARASUT_BASE_URL}${normalizedPath}`);

    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== "path" && typeof value === "string") {
        targetUrl.searchParams.append(key, value);
      }
    });

    const accessToken = await getValidAccessToken();
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(payload);
    }

    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
};

exports.getProducts = async (req, res, next) => {
  try {
    const companyId = req.query.company_id || PARASUT_COMPANY_ID;
    if (!companyId) {
      return res.status(400).json({
        message: "company_id is required (query or PARASUT_COMPANY_ID env)",
      });
    }

    const payload = await parasutGet(`/v4/${companyId}/products`, {
      "filter[name]": req.query["filter[name]"],
      "filter[code]": req.query["filter[code]"],
      sort: req.query.sort || "-id",
      "page[number]": req.query["page[number]"] || 1,
      "page[size]": req.query["page[size]"] || PARASUT_PAGE_SIZE,
      include: req.query.include,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
};

exports.getAllProducts = async (req, res, next) => {
  try {
    const companyId = req.query.company_id || PARASUT_COMPANY_ID;
    if (!companyId) {
      return res.status(400).json({
        message: "company_id is required (query or PARASUT_COMPANY_ID env)",
      });
    }

    const payload = await fetchAllProducts({
      companyId,
      "filter[name]": req.query["filter[name]"],
      "filter[code]": req.query["filter[code]"],
      sort: req.query.sort || "-id",
      "page[size]": req.query["page[size]"] || PARASUT_PAGE_SIZE,
      include: req.query.include,
    });

    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
};

exports.syncDraftProducts = async (req, res, next) => {
  try {
    const companyId = req.query.company_id || PARASUT_COMPANY_ID;
    if (!companyId) {
      return res.status(400).json({
        message: "company_id is required (query or PARASUT_COMPANY_ID env)",
      });
    }

    const payload = await fetchAllProducts({
      companyId,
      "filter[name]": req.query["filter[name]"],
      "filter[code]": req.query["filter[code]"],
      sort: req.query.sort || "-id",
      "page[size]": req.query["page[size]"] || PARASUT_PAGE_SIZE,
      include: req.query.include || "category",
    });

    const rows = Array.isArray(payload.data)
      ? payload.data.map((item) => normalizeDraftProduct(item, companyId)).filter((r) => r.parasutId)
      : [];

    let upserted = 0;
    for (const row of rows) {
      await DraftProduct.findOneAndUpdate(
        { parasutId: row.parasutId },
        row,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      upserted += 1;
    }

    return res.status(200).json({
      message: "Draft products synced",
      companyId: String(companyId),
      upserted,
      total: rows.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
};

exports.getDraftProducts = async (req, res, next) => {
  try {
    const companyId = req.query.company_id || PARASUT_COMPANY_ID;
    const filter = companyId ? { companyId: String(companyId) } : {};
    const drafts = await DraftProduct.find(filter).sort({ name: 1, parasutId: 1 });

    const products = await Product.find({}, { parasutProductIds: 1 });
    const mappedIds = new Set(
      products.flatMap((p) => (Array.isArray(p.parasutProductIds) ? p.parasutProductIds : [])),
    );

    const data = drafts.map((draft) => ({
      _id: draft._id,
      parasutId: draft.parasutId,
      name: draft.name,
      code: draft.code,
      barcode: draft.barcode,
      archived: draft.archived,
      unit: draft.unit,
      currency: draft.currency,
      companyId: draft.companyId,
      syncedAt: draft.syncedAt,
      mapped: mappedIds.has(draft.parasutId),
    }));

    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
};

exports.syncSalesInvoicesAndAssignLots = async (req, res, next) => {
  try {
    const companyId = req.query.company_id || PARASUT_COMPANY_ID;
    if (!companyId) {
      return res.status(400).json({
        message: "company_id is required (query or PARASUT_COMPANY_ID env)",
      });
    }

    const issueDate = String(req.query.issue_date || getYesterdayDateString());
    const include = String(req.query.include || "") || "details,details.product";

    let invoicesPayload;
    let usedServerSideIssueDateFilter = true;
    try {
      invoicesPayload = await fetchAllSalesInvoices({
        companyId,
        "filter[issue_date]": issueDate,
        include,
        sort: "-id",
        "page[size]": req.query["page[size]"] || PARASUT_PAGE_SIZE,
      });
    } catch (error) {
      // Paraşüt ortamlari bazı hesaplarda issue_date için aralık formatı bekleyebiliyor.
      if (error?.statusCode === 400) {
        try {
          invoicesPayload = await fetchAllSalesInvoices({
            companyId,
            "filter[issue_date]": `${issueDate}..${issueDate}`,
            include,
            sort: "-id",
            "page[size]": req.query["page[size]"] || PARASUT_PAGE_SIZE,
          });
        } catch (rangeError) {
          // Bazı hesaplarda issue_date filtresi hiç kabul edilmiyor.
          // Filtresiz çekip backend tarafında issue_date ile filtreliyoruz.
          usedServerSideIssueDateFilter = false;
          invoicesPayload = await fetchAllSalesInvoices({
            companyId,
            include,
            sort: "-issue_date",
            "page[size]": req.query["page[size]"] || PARASUT_PAGE_SIZE,
          });
        }
      } else {
        throw error;
      }
    }

    const { data: invoices, includedMap } = invoicesPayload;

    let invoicesProcessed = 0;
    let detailsProcessed = 0;
    let matchedProducts = 0;
    let assignedLots = 0;
    let alreadyAssigned = 0;
    let skippedNoProductMatch = 0;
    let skippedNoActiveLot = 0;

    for (const invoice of invoices) {
      invoicesProcessed += 1;

        const invoiceIssueDate = String(invoice?.attributes?.issue_date || "");
        if ((!usedServerSideIssueDateFilter || invoiceIssueDate) && invoiceIssueDate !== issueDate) {
          continue;
        }

      const invoiceId = String(invoice?.id || "");
      const invoiceNumber = String(invoice?.attributes?.invoice_no || "");
      const invoiceName = String(
        invoice?.attributes?.description ||
          invoice?.attributes?.invoice_id ||
          invoice?.attributes?.invoice_no ||
          "",
      );
      const detailRefs = Array.isArray(invoice?.relationships?.details?.data)
        ? invoice.relationships.details.data
        : [];

      for (const ref of detailRefs) {
        const detail = includedMap.get(`${ref?.type}:${ref?.id}`);
        if (!detail) continue;

        detailsProcessed += 1;

        const invoiceDetailId = String(detail?.id || "");
        const parasutProductId = String(
          detail?.relationships?.product?.data?.id ||
            detail?.relationships?.item?.data?.id ||
            "",
        );
        const unit = String(detail?.attributes?.unit || "");

        if (!invoiceDetailId || !parasutProductId) continue;

        const exists = await SalesLotAssignment.findOne({ invoiceDetailId });
        if (exists) {
          alreadyAssigned += 1;
          continue;
        }

        const product = await Product.findOne({ parasutProductIds: parasutProductId });
        if (!product) {
          skippedNoProductMatch += 1;
          continue;
        }
        matchedProducts += 1;

        const activeLot = await Lot.findOne({
          productId: product._id,
          status: "Active",
        }).sort({ createdAt: -1 });

        if (!activeLot) {
          skippedNoActiveLot += 1;
          continue;
        }

        await SalesLotAssignment.create({
          companyId: String(companyId),
          issueDate,
          invoiceId,
          invoiceNumber,
          invoiceName,
          invoiceDetailId,
          parasutProductId,
          productId: product._id,
          lotId: activeLot._id,
          lotNumber: activeLot.lotNumber,
          unit,
          warehouse: DEFAULT_WAREHOUSE_NAME,
          raw: {
            invoice,
            detail,
          },
        });

        assignedLots += 1;
      }
    }

    return res.status(200).json({
      message: "Sales invoices processed and lot assignments completed",
      issueDate,
      companyId: String(companyId),
      usedServerSideIssueDateFilter,
      invoicesProcessed,
      detailsProcessed,
      matchedProducts,
      assignedLots,
      alreadyAssigned,
      skippedNoProductMatch,
      skippedNoActiveLot,
    });
  } catch (error) {
    return next(error);
  }
};

exports.saveProductMappings = async (req, res, next) => {
  try {
    const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];
    if (groups.length === 0) {
      return res.status(400).json({ message: "groups is required and must be non-empty" });
    }

    const saved = [];

    for (const group of groups) {
      const canonicalName = String(group?.canonicalName || "").trim();
      const items = Array.isArray(group?.items) ? group.items : [];
      if (!canonicalName || items.length === 0) continue;

      const normalizedItems = items
        .map((item) => ({
          parasutId: String(item?.parasutId || item?.id || "").trim(),
          name: String(item?.name || "").trim(),
          code: String(item?.code || "").trim(),
          barcode: String(item?.barcode || "").trim(),
          archived: Boolean(item?.archived),
          unit: String(item?.unit || "").trim(),
          currency: String(item?.currency || "").trim(),
        }))
        .filter((item) => item.parasutId && item.name);

      if (normalizedItems.length === 0) continue;

      const parasutProductIds = Array.from(
        new Set(normalizedItems.map((item) => item.parasutId)),
      );

      let target = await Product.findOne({ canonicalName });
      if (!target) {
        target = await Product.create({
          canonicalName,
          parasutProductIds: [],
          sourceItems: [],
        });
      }

      const conflicts = await Product.find({
        _id: { $ne: target._id },
        parasutProductIds: { $in: parasutProductIds },
      });

      for (const conflict of conflicts) {
        conflict.parasutProductIds = conflict.parasutProductIds.filter(
          (id) => !parasutProductIds.includes(id),
        );
        conflict.sourceItems = conflict.sourceItems.filter(
          (item) => !parasutProductIds.includes(item.parasutId),
        );

        if (conflict.parasutProductIds.length === 0) {
          await Product.deleteOne({ _id: conflict._id });
        } else {
          await conflict.save();
        }
      }

      const existingItemsById = new Map(
        target.sourceItems.map((item) => [
          item.parasutId,
          item.toObject ? item.toObject() : item,
        ]),
      );
      normalizedItems.forEach((item) => {
        existingItemsById.set(item.parasutId, item);
      });

      target.parasutProductIds = Array.from(
        new Set([...target.parasutProductIds, ...parasutProductIds]),
      );
      target.sourceItems = Array.from(existingItemsById.values());
      target.status = "Active";
      await target.save();

      saved.push({
        id: target._id,
        canonicalName: target.canonicalName,
        mappedCount: target.parasutProductIds.length,
      });
    }

    return res.status(200).json({ message: "Mappings saved", saved });
  } catch (error) {
    return next(error);
  }
};

exports.listProductMappings = async (req, res, next) => {
  try {
    const mappings = await Product.find({}).sort({ updatedAt: -1 });
    return res.status(200).json({ data: mappings, collection: "products" });
  } catch (error) {
    return next(error);
  }
};
