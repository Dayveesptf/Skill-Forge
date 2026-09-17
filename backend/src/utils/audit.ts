import { Request } from "express";
import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog";
import { AuthenticatedRequest } from "../middleware/auth";

export async function writeAuditLog(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  const authReq = req as AuthenticatedRequest;

  return AuditLog.create({
    actorId: authReq.user?.userId,
    organizationId: authReq.user?.organizationId,
    action,
    entityType,
    entityId: entityId && mongoose.isValidObjectId(entityId) ? entityId : undefined,
    metadata,
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  });
}
