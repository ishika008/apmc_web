import { Router } from 'express';
import GateEntry from '../models/GateEntry.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
router.get('/', async (_req, res, next) => {
  try {
    const items = await GateEntry.find().sort({ entryTime: -1 }).limit(100);
    res.json({ items });
  } catch (error) { next(error); }
});
router.post('/', allowRoles('admin', 'clerk', 'gate_operator'), async (req, res, next) => {
  try {
    const { entryNumber, vehicleNumber, farmerName, commodity, estimatedQuantity, notes } = req.body || {};
    if (!entryNumber || !vehicleNumber || !farmerName || !commodity)
      return res.status(400).json({ message: 'Entry number, vehicle, farmer and commodity are required' });
    const item = await GateEntry.create({
      entryNumber, vehicleNumber, farmerName, commodity,
      estimatedQuantity: Number(estimatedQuantity) || 0, notes, createdBy: req.user.sub
    });
    res.status(201).json({ item });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Entry number already exists' });
    next(error);
  }
});
export default router;