import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { businessName, email, password, phone } = req.body;

  if (!businessName || !email || !password) {
    return res.status(400).json({ error: 'businessName, email, and password are required' });
  }

  try {
    const existing = await prisma.vendor.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const vendor = await prisma.vendor.create({
      data: { businessName, email, passwordHash, phone },
    });

    const token = jwt.sign({ vendorId: vendor.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      vendor: { id: vendor.id, businessName: vendor.businessName, email: vendor.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const vendor = await prisma.vendor.findUnique({ where: { email } });
    if (!vendor) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, vendor.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ vendorId: vendor.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      vendor: { id: vendor.id, businessName: vendor.businessName, email: vendor.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
