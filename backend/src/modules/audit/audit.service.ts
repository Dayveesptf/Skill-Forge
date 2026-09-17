import { Types } from "mongoose";
import { AuditLog } from "../../models/AuditLog";

interface ListAuditLogsInput {
  organizationId?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  page?: number;
  limit?: number;
}

export class AuditValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditValidationError";
  }
}

function ensureObjectId(
  value: string,
  fieldName: string
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new AuditValidationError(
      `${fieldName} is invalid`
    );
  }

  return new Types.ObjectId(value);
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
  fieldName: string
): number {
  if (value === undefined) {
    return fallback;
  }

  if (
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new AuditValidationError(
      `${fieldName} must be a positive integer`
    );
  }

  return value;
}

export async function listAuditLogs(
  input: ListAuditLogsInput
) {
  const page =
    normalizePositiveInteger(
      input.page,
      1,
      "page"
    );

  const requestedLimit =
    normalizePositiveInteger(
      input.limit,
      50,
      "limit"
    );

  const limit = Math.min(
    100,
    requestedLimit
  );

  const filter: Record<string, unknown> = {};

  if (input.organizationId) {
    filter.organizationId =
      ensureObjectId(
        input.organizationId,
        "organizationId"
      );
  }

  if (input.actorId) {
    filter.actorId =
      ensureObjectId(
        input.actorId,
        "actorId"
      );
  }

  if (input.action) {
    filter.action = input.action;
  }

  if (input.entityType) {
    filter.entityType =
      input.entityType;
  }

  if (input.entityId) {
    filter.entityId =
      ensureObjectId(
        input.entityId,
        "entityId"
      );
  }

  const [logs, total] =
    await Promise.all([
      AuditLog.find(filter)
        .populate(
          "actorId",
          "firstName lastName email role"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      AuditLog.countDocuments(filter)
    ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(
        total / limit
      )
    }
  };
}

export async function getAuditLogById(
  id: string,
  organizationId?: string
) {
  const filter: Record<string, unknown> = {
    _id: ensureObjectId(
      id,
      "audit log id"
    )
  };

  if (organizationId) {
    filter.organizationId =
      ensureObjectId(
        organizationId,
        "organizationId"
      );
  }

  return AuditLog.findOne(filter)
    .populate(
      "actorId",
      "firstName lastName email role"
    );
}