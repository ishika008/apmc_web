import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { getOverview } from '../controllers/overview.controller.js';
import { listLots, createLot, getLot } from '../controllers/lots.controller.js';
import { listBuyers, createBuyer, updateBuyer } from '../controllers/buyers.controller.js';
import { listTickets, createTicket, voidTicketHandler } from '../controllers/tickets.controller.js';
import { listWeighments, createWeighment } from '../controllers/weighments.controller.js';
import { listBills, listPayments, createPayment } from '../controllers/billing.controller.js';
import { listGatePasses, issuePass, dispatchPass } from '../controllers/gatePasses.controller.js';
import { listComplaints, createComplaint, updateComplaint } from '../controllers/complaints.controller.js';
import { getSummary, getCatalog, exportDataset } from '../controllers/reports.controller.js';
import { getDashboard, getNavCounts } from '../controllers/dashboard.controller.js';
import { search } from '../controllers/search.controller.js';
import { getSettings, updateSettings } from '../controllers/settings.controller.js';
import { listUsers, createUser, updateUser } from '../controllers/users.controller.js';
import { listAuditLogs } from '../controllers/audit.controller.js';

/**
 * Yard operations API, mounted at /api/yard. Every route requires authentication;
 * role guards below are unchanged from the original implementation.
 */
const router = Router();
router.use(requireAuth);

router.get('/overview', getOverview);
router.get('/dashboard', getDashboard);
router.get('/nav-counts', getNavCounts);
router.get('/search', search);

// Gate entries / lots
router.get('/lots', listLots);
router.post('/lots', allowRoles('admin','gate'), createLot);
router.get('/lots/:id', getLot);

// Buyer master and credit
router.get('/buyers', listBuyers);
router.post('/buyers', allowRoles('admin','accounts'), createBuyer);
router.patch('/buyers/:id', allowRoles('admin','accounts'), updateBuyer);

// Auction price tickets
router.get('/tickets', listTickets);
router.post('/tickets', allowRoles('admin','auction'), createTicket);
router.post('/tickets/:id/void', allowRoles('admin'), voidTicketHandler);

// Weighbridge
router.get('/weighments', listWeighments);
router.post('/weighments', allowRoles('admin','weighment'), createWeighment);

// Bills and payment ledgers
router.get('/bills', listBills);
router.get('/payments', listPayments);
router.post('/payments', allowRoles('admin','accounts'), createPayment);

// Gate pass and physical exit
router.get('/gate-passes', listGatePasses);
router.post('/gate-passes/:lotId/issue', allowRoles('admin','gate'), issuePass);
router.post('/gate-passes/:id/dispatch', allowRoles('admin','gate'), dispatchPass);

// Grievance / dispute register
router.get('/complaints', listComplaints);
router.post('/complaints', allowRoles('admin','gate','auction','weighment','accounts','inspector'), createComplaint);
router.patch('/complaints/:id', allowRoles('admin','inspector'), updateComplaint);

// Reports
router.get('/reports/summary', getSummary);
router.get('/reports/catalog', getCatalog);
// Audit export keeps the same role restriction as GET /audit.
router.get('/reports/export/audit', allowRoles('admin','inspector'), exportDataset);
router.get('/reports/export/:dataset', exportDataset);

// Settings / master data
router.get('/settings', getSettings);
router.patch('/settings', allowRoles('admin'), updateSettings);

// Staff / user administration
router.get('/users', allowRoles('admin'), listUsers);
router.post('/users', allowRoles('admin'), createUser);
router.patch('/users/:id', allowRoles('admin'), updateUser);

// Append-only audit log
router.get('/audit', allowRoles('admin','inspector'), listAuditLogs);

export default router;
