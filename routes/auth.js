import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Resend } from "resend";
import prisma from "../prismaClient.js";
import { error } from "console";

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/register", async (req, res) => {
  const { businessName, email, password, phone } = req.body;

  if (!businessName || !email || !password) {
    return res
      .status(400)
      .json({ error: "businessName, email, and password are required" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  try {
    const existing = await prisma.vendor.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const vendor = await prisma.vendor.create({
      data: { businessName, email, passwordHash, phone },
    });

    const token = jwt.sign({ vendorId: vendor.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(201).json({
      token,
      vendor: {
        id: vendor.id,
        businessName: vendor.businessName,
        email: vendor.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const vendor = await prisma.vendor.findUnique({ where: { email } });
    if (!vendor) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, vendor.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ vendorId: vendor.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({
      token,
      vendor: {
        id: vendor.id,
        businessName: vendor.businessName,
        email: vendor.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const vendor = await prisma.vendor.findUnique({ where: { email } });

    if (!vendor) {
      return res.json({
        message: "If that email exists, a reset link has been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { resetToken, resetTokenExpiry },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: vendor.email,
      subject: "Reset your VendorFlow password",
      html: `<p>Hi ${vendor.businessName},</p>
             <p>Click below to reset your password. This link expires in 30 minutes.</p>
             <p><a href="${resetLink}">Reset Password</a></p>
             <p>If you didn't request this, you can ignore this email.</p>`,
    });

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ error: "token and newPassword are required" });
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  try {
    const vendor = await prisma.vendor.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!vendor) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/admin-reset-password", async (req, res) => {
  const { adminSecret, email, newPassword } = req.body;

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const vendor = await prisma.vendor.findUnique({ where: { email } });
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { passwordHash },
    });

    res.json({ message: "Password reset by admin" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset" });
  }
});

export default router;
