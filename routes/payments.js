import express from "express";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/verify", requireAuth, async (req, res) => {
  const { reference } = req.body;

  if (!reference) {
    return res.status(400).json({ error: "reference is required" });
  }

  try {
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.sk_test_8b3fdfb229b4cc801dd3e4f30663936beebd48d0}`,
        },
      },
    );
    const data = await paystackRes.json();
    if (!data.status || !data.data) {
      console.error("Paystack verfy failed:", data);
      return res
        .status(400)
        .json({ error: "Payment verification failed", details: data.message });
    }

    if (data.data.status === "success") {
      await prisma.vendor.update({
        where: { id: req.vendorId },
        data: { isPaid: true },
      });
      return res.json({ verified: true });
    } else {
      return res.status(400).json({ error: "Payment not successful" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
