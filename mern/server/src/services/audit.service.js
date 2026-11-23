import { AuditLog } from '../models/index.js';

/** Appends an immutable audit record. `ctx` is `{ user, ip }` from the request. */
export const audit = async (ctx, action, resource, resourceId, before = null, after = null, reason = '') => {
  await AuditLog.create({
    actor: ctx.user._id, actorName: ctx.user.name, role: ctx.user.role, action, resource,
    resourceId: String(resourceId || ''), before, after, reason, ipAddress: ctx.ip
  });
};

export const auditContext = req => ({ user: req.user, ip: req.ip });
