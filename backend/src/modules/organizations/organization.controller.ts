import { Request, Response } from "express";

import { UserRole } from "../../constants/roles";
import { AuthenticatedRequest } from "../../middleware/auth";
import { writeAuditLog } from "../../utils/audit";

import {
  createOrganization,
  getOrganizationById,
  getOrganizationStats,
  listOrganizations,
  updateOrganization
} from "./organization.service";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getRouteParam(
  value: string | string[] | undefined,
  paramName: string
): string {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(`${paramName} is required`);
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* Create Organization                                                        */
/* -------------------------------------------------------------------------- */

export async function create(
  req: Request,
  res: Response
) {
  try {
    const organization =
      await createOrganization(
        req.body
      );

    await writeAuditLog(
      req,
      "ORGANIZATION_CREATED",
      "Organization",
      organization.id
    );

    res.status(201).json({
      success: true,
      data: organization
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/* -------------------------------------------------------------------------- */
/* List Organizations                                                         */
/* -------------------------------------------------------------------------- */

export async function list(
  _req: AuthenticatedRequest,
  res: Response
) {
  const organizations = await listOrganizations();

  res.json({
    success: true,
    data: organizations
  });
}

/* -------------------------------------------------------------------------- */
/* Get Organization                                                           */
/* -------------------------------------------------------------------------- */

export async function getOne(
  req: AuthenticatedRequest,
  res: Response
) {
  let organizationId:
    | string
    | undefined;

  if (
    req.user?.role ===
    UserRole.PLATFORM_ADMIN
  ) {
    organizationId =
      getRouteParam(
        req.params.id,
        "id"
      );
  } else {
    organizationId =
      req.user?.organizationId;
  }

  if (!organizationId) {
    res.status(400).json({
      success: false,
      message:
        "Organization context is required"
    });
    return;
  }

  const organization =
    await getOrganizationById(
      organizationId
    );

  if (!organization) {
    res.status(404).json({
      success: false,
      message:
        "Organization not found"
    });
    return;
  }

  res.json({
    success: true,
    data: organization
  });
}

/* -------------------------------------------------------------------------- */
/* Organization Stats                                                         */
/* -------------------------------------------------------------------------- */

export async function stats(
  req: AuthenticatedRequest,
  res: Response
) {
  let organizationId:
    | string
    | undefined;

  if (
    req.user?.role ===
    UserRole.PLATFORM_ADMIN
  ) {
    organizationId =
      getRouteParam(
        req.params.id,
        "id"
      );
  } else {
    organizationId =
      req.user?.organizationId;
  }

  if (!organizationId) {
    res.status(400).json({
      success: false,
      message:
        "Organization context is required"
    });
    return;
  }

  const data =
    await getOrganizationStats(
      organizationId
    );

  res.json({
    success: true,
    data
  });
}

/* -------------------------------------------------------------------------- */
/* Update Organization                                                        */
/* -------------------------------------------------------------------------- */

export async function update(
  req: AuthenticatedRequest,
  res: Response
) {
  let organizationId:
    | string
    | undefined;

  if (
    req.user?.role ===
    UserRole.PLATFORM_ADMIN
  ) {
    organizationId =
      getRouteParam(
        req.params.id,
        "id"
      );
  } else {
    organizationId =
      req.user?.organizationId;
  }

  if (!organizationId) {
    res.status(400).json({
      success: false,
      message:
        "Organization context is required"
    });
    return;
  }

  const organization =
    await updateOrganization(
      organizationId,
      req.body
    );

  if (!organization) {
    res.status(404).json({
      success: false,
      message:
        "Organization not found"
    });
    return;
  }

  await writeAuditLog(
    req,
    "ORGANIZATION_UPDATED",
    "Organization",
    organization.id,
    {
      changedFields:
        Object.keys(req.body)
    }
  );

  res.json({
    success: true,
    data: organization
  });
}