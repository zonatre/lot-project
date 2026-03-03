const crypto = require("crypto");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

module.exports = function cronAuth(req, res, next) {
  const secret = String(process.env.CRON_SYNC_SECRET || "").trim();
  if (!secret) {
    return res.status(500).json({ message: "CRON_SYNC_SECRET is not configured" });
  }

  const headerToken = String(req.headers["x-cron-secret"] || "").trim();
  const bearerToken = String(req.headers.authorization || "").startsWith("Bearer ")
    ? String(req.headers.authorization).slice(7).trim()
    : "";
  const queryToken = String(req.query.token || "").trim();

  const provided = headerToken || bearerToken || queryToken;
  if (!provided || !safeEqual(provided, secret)) {
    return res.status(401).json({ message: "Unauthorized cron request" });
  }

  return next();
};
