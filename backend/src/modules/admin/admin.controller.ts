import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import {
  getPlatformOverview,
  getOrganizationOverview,
  getUserAdministrationList,
  setUserActiveStatus
} from "./admin.service";
import { writeAuditLog } from "../../services/audit.service";

function getRouteParam(
  value: string | string[] | undefined,
  paramName: string
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${paramName} is required`);
  }

  return value;
}

function isPlatformAdmin(req: AuthenticatedRequest) {
  return req.user?.role === UserRole.PLATFORM_ADMIN;
}

function isOrganizationAdmin(req: AuthenticatedRequest) {
  return (
    req.user?.role === UserRole.ORGANIZATION_ADMIN
  );
}

export async function platformOverview(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!isPlatformAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Platform administrator access required"
      });
    }

    const data = await getPlatformOverview();

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("Platform overview error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve platform overview"
    });
  }
}

export async function organizationOverview(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (
      !isPlatformAdmin(req) &&
      !isOrganizationAdmin(req)
    ) {
      return res.status(403).json({
        success: false,
        message: "Administrator access required"
      });
    }

    const organizationId =
      isPlatformAdmin(req)
        ? getRouteParam(
            req.params.organizationId,
            "organization id"
          )
        : req.user!.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization is required"
      });
    }

    const data =
      await getOrganizationOverview(organizationId);

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error(
      "Organization overview error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve organization overview"
    });
  }
}

export async function listOrganizationUsers(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (
      !isPlatformAdmin(req) &&
      !isOrganizationAdmin(req)
    ) {
      return res.status(403).json({
        success: false,
        message: "Administrator access required"
      });
    }

    const organizationId =
      isPlatformAdmin(req)
        ? getRouteParam(
            req.params.organizationId,
            "organization id"
          )
        : req.user!.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization is required"
      });
    }

    const users =
      await getUserAdministrationList(
        organizationId
      );

    return res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error(
      "List organization users error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users"
    });
  }
}

export async function updateUserStatus(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (
      !isPlatformAdmin(req) &&
      !isOrganizationAdmin(req)
    ) {
      return res.status(403).json({
        success: false,
        message: "Administrator access required"
      });
    }

    const userId = getRouteParam(
      req.params.userId,
      "user id"
    );

    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean"
      });
    }

    const organizationId =
      isPlatformAdmin(req)
        ? undefined
        : req.user!.organizationId;

    const user = await setUserActiveStatus(
      userId,
      isActive,
      organizationId
    );

    await writeAuditLog(
      req,
      isActive
        ? "USER_ACTIVATED"
        : "USER_DEACTIVATED",
      "User",
      user.id
    );

    return res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(
      "Update user status error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update user status"
    });
  }
}