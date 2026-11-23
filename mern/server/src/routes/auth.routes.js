import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { login, me } from '../controllers/auth.controller.js';
import { env } from '../config/env.js';

const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isProduction ? 8 : 100, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many login attempts. Try again in 15 minutes.' } });

router.post('/login', loginLimiter, login);
router.get('/me', requireAuth, me);

export default router;
