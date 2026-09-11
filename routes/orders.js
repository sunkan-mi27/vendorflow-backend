import express from "express";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

// GET all orders for the logged-in vendor
router.get("/", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { vendorId: req.vendorId },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET today's sales summary
router.get("/summary", async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaysOrders = await prisma.order.findMany({
      where: {
        vendorId: req.vendorId,
        createdAt: { gte: startOfDay },
      },
    });

    const total = todaysOrders.reduce((sum, o) => sum + o.amount, 0);
    res.json({ count: todaysOrders.length, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// POST create a new order
router.post("/", async (req, res) => {
  const { customerName, customerPhone, item, amount } = req.body;

  if (!customerName || !customerPhone || !item || amount == null) {
    return res
      .status(400)
      .json({
        error: "customerName, customerPhone, item, and amount are required",
      });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: req.vendorId },
  });

  if (!vendor.isPaid) {
    const orderCount = await prisma.order.count({
      where: { vendorId: req.vendorId },
    });
    if (orderCount >= 3) {
      return res.status(403).json({
        error: "Free limit reached. Upgrade to keep adding orders.",
        code: "UPGRADE_REQUIRED",
      });
    }
  }

  try {
    const order = await prisma.order.create({
      data: {
        vendorId: req.vendorId,
        customerName,
        customerPhone,
        item,
        amount: parseFloat(amount),
      },
    });
    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// PATCH update order status
router.patch("/:id", async (req, res) => {
  const { status } = req.body;
  const validStatuses = ["pending", "paid", "shipped"];

  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ error: `status must be one of ${validStatuses.join(", ")}` });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });
    if (!order || order.vendorId !== req.vendorId) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// DELETE an order
router.delete("/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
    });
    if (!order || order.vendorId !== req.vendorId) {
      return res.status(404).json({ error: "Order not found" });
    }

    await prisma.order.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
