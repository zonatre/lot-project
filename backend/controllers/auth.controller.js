const crypto = require("crypto");
const nodemailer = require("nodemailer");
const LoginCode = require("../models/loginCode.model");

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = Number(process.env.LOGIN_CODE_TTL_MINUTES || 10);
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.LOGIN_CODE_RESEND_COOLDOWN_SECONDS || 30);
const OTP_MAX_ATTEMPTS = Number(process.env.LOGIN_CODE_MAX_ATTEMPTS || 5);
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24);
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || process.env.PARASUT_CLIENT_SECRET || "change-me";

const GMAIL_USER = process.env.GMAIL_SENDER_EMAIL;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const ALLOWED_LOGIN_EMAILS = String(process.env.ALLOWED_LOGIN_EMAILS || "")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input) {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function assertAuthEnv() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    const error = new Error("GMAIL_SENDER_EMAIL and GMAIL_APP_PASSWORD are required");
    error.statusCode = 500;
    throw error;
  }

  if (ALLOWED_LOGIN_EMAILS.length === 0) {
    const error = new Error("ALLOWED_LOGIN_EMAILS is required");
    error.statusCode = 500;
    throw error;
  }

  if (!TOKEN_SECRET || TOKEN_SECRET === "change-me") {
    const error = new Error("AUTH_TOKEN_SECRET is required");
    error.statusCode = 500;
    throw error;
  }
}

function isAllowedEmail(email) {
  return ALLOWED_LOGIN_EMAILS.includes(email);
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function signToken(email) {
  const payload = {
    email,
    exp: Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000,
  };

  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(
    crypto.createHmac("sha256", TOKEN_SECRET).update(payloadEncoded).digest(),
  );
  return `${payloadEncoded}.${signature}`;
}

function verifyToken(token) {
  const raw = String(token || "");
  const [payloadEncoded, signature] = raw.split(".");
  if (!payloadEncoded || !signature) return null;

  const expected = toBase64Url(
    crypto.createHmac("sha256", TOKEN_SECRET).update(payloadEncoded).digest(),
  );
  if (expected !== signature) return null;

  try {
    const payload = JSON.parse(fromBase64Url(payloadEncoded));
    if (!payload?.email || !payload?.exp) return null;
    if (Date.now() > Number(payload.exp)) return null;
    if (!isAllowedEmail(normalizeEmail(payload.email))) return null;
    return payload;
  } catch {
    return null;
  }
}

exports.requestCode = async (req, res, next) => {
  try {
    assertAuthEnv();
    const email = normalizeEmail(req.body?.email);
    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Geçerli bir e-posta gerekli" });
    }
    if (!isAllowedEmail(email)) {
      return res.status(403).json({ message: "Bu e-posta ile giriş izni yok" });
    }

    const existing = await LoginCode.findOne({ email });
    if (existing?.lastSentAt) {
      const secondsSinceLastSend = (Date.now() - new Date(existing.lastSentAt).getTime()) / 1000;
      if (secondsSinceLastSend < OTP_RESEND_COOLDOWN_SECONDS) {
        return res.status(429).json({
          message: `Lütfen ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastSend)} sn bekleyin`,
        });
      }
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await LoginCode.findOneAndUpdate(
      { email },
      {
        email,
        codeHash: hashCode(code),
        expiresAt,
        lastSentAt: new Date(),
        attempts: 0,
        consumedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await transporter.sendMail({
      from: `"Krijen LOT Tracking" <${GMAIL_USER}>`,
      to: email,
      subject: "Krijen LOT Tracking - Giriş Doğrulama Kodu",
      text: `Giriş kodunuz: ${code}\nBu kod ${OTP_TTL_MINUTES} dakika geçerlidir.`,
      html: `<p>Giriş kodunuz:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px;">${code}</p><p>Bu kod ${OTP_TTL_MINUTES} dakika geçerlidir.</p>`,
    });

    return res.status(200).json({
      message: "Doğrulama kodu gönderildi",
      expiresInSeconds: OTP_TTL_MINUTES * 60,
    });
  } catch (error) {
    return next(error);
  }
};

exports.verifyCode = async (req, res, next) => {
  try {
    assertAuthEnv();
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();

    if (!email || !code) {
      return res.status(400).json({ message: "email ve code zorunlu" });
    }
    if (!isAllowedEmail(email)) {
      return res.status(403).json({ message: "Bu e-posta ile giriş izni yok" });
    }

    const doc = await LoginCode.findOne({ email });
    if (!doc) {
      return res.status(400).json({ message: "Önce doğrulama kodu talep edin" });
    }
    if (doc.consumedAt) {
      return res.status(400).json({ message: "Kod kullanıldı. Yeni kod talep edin" });
    }
    if (Date.now() > new Date(doc.expiresAt).getTime()) {
      return res.status(400).json({ message: "Kod süresi doldu. Yeni kod talep edin" });
    }
    if (doc.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ message: "Maksimum deneme sayısı aşıldı. Yeni kod talep edin" });
    }

    const isValid = doc.codeHash === hashCode(code);
    if (!isValid) {
      doc.attempts += 1;
      await doc.save();
      return res.status(400).json({ message: "Kod hatalı" });
    }

    doc.consumedAt = new Date();
    await doc.save();

    const token = signToken(email);
    return res.status(200).json({
      message: "Giriş başarılı",
      token,
      email,
      expiresInSeconds: SESSION_TTL_HOURS * 60 * 60,
    });
  } catch (error) {
    return next(error);
  }
};

exports.sessionStatus = async (req, res, next) => {
  try {
    assertAuthEnv();
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({ authenticated: false });
    }

    return res.status(200).json({
      authenticated: true,
      email: payload.email,
      expiresAt: new Date(Number(payload.exp)).toISOString(),
    });
  } catch (error) {
    return next(error);
  }
};
