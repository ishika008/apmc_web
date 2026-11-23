import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env, JWT_ISSUER, JWT_AUDIENCE } from '../config/env.js';
import { logger } from '../utils/logger.js';

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    if (!env.jwtSecret) {
      logger.error('JWT_SECRET is not configured');
      return res.status(500).json({ message: 'Authentication is not configured' });
    }
    const payload = jwt.verify(token, env.jwtSecret, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    const user = await User.findById(payload.sub).select('name email role active');
    if (!user || !user.active) return res.status(401).json({ message: 'User account is inactive or no longer exists' });
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Invalid or expired token' });
    next(error);
  }
}
export const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    logger.warn('Permission denied', { userId: req.user?.id, role: req.user?.role, method: req.method, path: req.originalUrl.split('?')[0] });
    return res.status(403).json({ message: 'You do not have permission for this action' });
  }
  next();
};
