import { Response } from "express";

import {
  AuthenticatedRequest
} from "../../middleware/auth";

import {
  UserRole
} from "../../constants/roles";

import {
  listAuditLogs,
  getAuditLogById,
  AuditValidationError
} from "./audit.service";

function getRouteParam(
  value:
    | string
    | string[]
    | undefined,
  paramName: string
): string {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new AuditValidationError(
      `${paramName} is required`
    );
  }

  return value.trim();
}

function isAdmin(
  req: AuthenticatedRequest
) {
  return (
    req.user?.role ===
      UserRole.PLATFORM_ADMIN ||
    req.user?.role ===
      UserRole.ORGANIZATION_ADMIN
  );
}

function getOptionalQueryString(
  value: unknown
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new AuditValidationError(
      "Query parameter must be a non-empty string"
    );
  }

  return value.trim();
}

function getQueryNumber(
  value: unknown,
  fieldName: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new AuditValidationError(
      `${fieldName} must be a number`
    );
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1
  ) {
    throw new AuditValidationError(
      `${fieldName} must be a positive integer`
    );
  }

  return parsed;
}

export async function getAuditLogs(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message:
          "Administrator access required"
      });
    }

    const organizationId =
      req.user!.role ===
      UserRole.PLATFORM_ADMIN
        ? getOptionalQueryString(
            req.query.organizationId
          )
        : req.user!.organizationId;

    const result =
      await listAuditLogs({
        organizationId,

        actorId:
          getOptionalQueryString(
            req.query.actorId
          ),

        action:
          getOptionalQueryString(
            req.query.action
          ),

        entityType:
          getOptionalQueryString(
            req.query.entityType
          ),

        entityId:
          getOptionalQueryString(
            req.query.entityId
          ),

        page:
          getQueryNumber(
            req.query.page,
            "page"
          ),

        limit:
          getQueryNumber(
            req.query.limit,
            "limit"
          )
      });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (
      error instanceof AuditValidationError
    ) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error(
      "Get audit logs error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve audit logs"
    });
  }
}

export async function getAuditLog(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message:
          "Administrator access required"
      });
    }

    const id =
      getRouteParam(
        req.params.id,
        "audit log id"
      );

    const organizationId =
      req.user!.role ===
      UserRole.PLATFORM_ADMIN
        ? undefined
        : req.user!.organizationId;

    const log =
      await getAuditLogById(
        id,
        organizationId
      );

    if (!log) {
      return res.status(404).json({
        success: false,
        message:
          "Audit log not found"
      });
    }

    return res.json({
      success: true,
      data: log
    });
  } catch (error) {
    if (
      error instanceof AuditValidationError
    ) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    console.error(
      "Get audit log error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve audit log"
    });
  }
}