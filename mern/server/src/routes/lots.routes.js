import { Router } from 'express';
import Lot from '../models/Lot.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    // Exact match avoids compiling user-provided input as a regular expression.
    if (req.query.search) {
      const term = String(req.query.search).trim();
      filter.$or = [{ lotNumber: term }, { farmerName: term }, { commodity: term }];
    }
    const [items, total] = await Promise.all([
      Lot.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Lot.countDocuments(filter)
    ]);
    res.json({ items, total, page, limit });
  } catch (error) {
    next(error);
  }
});

router.post('/', allowRoles('admin', 'clerk', 'gate_operator'), async (req, res, next) => {
  try {
    const { lotNumber, farmerName, commodity, quantity, unit } = req.body || {};
    if (!lotNumber || !farmerName || !commodity || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
      return res.status(400).json({ message: 'Lot number, farmer, commodity and positive quantity are required' });
    }
    const item = await Lot.create({
      lotNumber, farmerName, commodity, quantity: Number(quantity), unit, createdBy: req.user.sub
    });
    res.status(201).json({ item });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Lot number already exists' });
    next(error);
  }
});

export default router;
