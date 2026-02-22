const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();
const parasutRoutes = require("./routes/parasut.routes");
const productRoutes = require("./routes/product.routes");

const app = express();

const PORT = Number(process.env.PORT) || 5001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const MONGO_URI = process.env.MONGO_URI;

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json());
app.use("/api/parasut", parasutRoutes);
app.use("/api/products", productRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "backend",
    dbState: mongoose.connection.readyState,
  });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    message: error.message || "Internal Server Error",
    details: error.details || null,
  });
});

async function startServer() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is missing in backend/.env");
  }

  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start backend:", error.message);
  process.exit(1);
});
