import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { env, JWT_ISSUER, JWT_AUDIENCE, JWT_EXPIRES_IN } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  // Strings only: a non-string password makes bcrypt throw (500) and an object email could smuggle query operators.
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return res.status(400).json({ message: 'Email and password are required' });
  if (!env.jwtSecret) {
    logger.error('Login attempted but JWT_SECRET is not configured');
    return res.status(500).json({ message: 'Server authentication is not configured' });
  }
  const user = await User.findOne({ email: String(email).toLowerCase().trim(), active: true }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    logger.warn('Failed login attempt', { ip: req.ip });
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  user.lastLoginAt = new Date();
  await user.save();
  const token = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: JWT_EXPIRES_IN, issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
  logger.info('User logged in', { userId: user.id, role: user.role });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, active: req.user.active } });
});
