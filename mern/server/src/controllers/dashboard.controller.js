import { asyncHandler } from '../utils/asyncHandler.js';
import { buildDashboard, buildNavCounts } from '../services/dashboard.service.js';

export const getDashboard = asyncHandler(async (req, res) => res.json(await buildDashboard(req.user)));
export const getNavCounts = asyncHandler(async (_req, res) => res.json(await buildNavCounts()));
