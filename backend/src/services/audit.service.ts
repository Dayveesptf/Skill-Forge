import mongoose from "mongoose";
import { Request } from "express";
import { AuditLog } from "../models/AuditLog";

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    organizationId?: string;
  };
}

export async function writeAuditLog(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  const authenticatedRequest =
    req as AuthenticatedRequest;

  try {
    await AuditLog.create({
      actorId: authenticatedRequest.user?.userId
        ? new mongoose.Types.ObjectId(
            authenticatedRequest.user.userId
          )
        : undefined,

      organizationId:
        authenticatedRequest.user?.organizationId
          ? new mongoose.Types.ObjectId(
              authenticatedRequest.user.organizationId
            )
          : undefined,

      action,

      entityType,

      entityId:
        entityId &&
        mongoose.Types.ObjectId.isValid(entityId)
          ? new mongoose.Types.ObjectId(entityId)
          : undefined,

      metadata,

      ipAddress:
        req.ip ||
        req.headers["x-forwarded-for"]?.toString() ||
        undefined,

      userAgent:
        req.headers["user-agent"] || undefined
    });
  } catch (error) {
    // Audit logging must never break the main operation.
    console.error("Audit log write failed:", error);
  }
}