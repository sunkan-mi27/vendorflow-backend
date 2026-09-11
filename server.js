import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import orderRoutes from "./routes/orders.js";
import paymentRoutes from "./routes/payments.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/", (req, res) => {
  res.json({ status: "VendorFlow API running" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`VendorFlow API listening on port ${PORT}`));
