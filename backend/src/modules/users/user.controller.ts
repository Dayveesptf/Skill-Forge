import { Response } from "express";

import { AuthenticatedRequest } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";
import { writeAuditLog } from "../../utils/audit";

import {
  createOrganizationUser,
  deactivateOrganizationUser,
  getOrganizationUser,
  listManagerTeam,
  listOrganizationUsers,
  updateOrganizationUser
} from "./user.service";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function orgId(
  req: AuthenticatedRequest
): string | undefined {
  return req.user?.organizationId;
}

function getRouteParam(
  value: string | string[] | undefined,
  paramName: string
): string {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(
      `${paramName} is required`
    );
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* List Users                                                                 */
/* -------------------------------------------------------------------------- */

export async function list(
  req: AuthenticatedRequest,
  res: Response
) {
  const organizationId =
    orgId(req);

  if (!organizationId) {
    res.status(400).json({
      success: false,
      message:
        "Organization context is required"
    });

    return;
  }

  const data =
    await listOrganizationUsers(
      organizationId,
      {
        role:
          typeof req.query.role ===
          "string"
            ? (req.query.role as UserRole)
            : undefined,

        managerId:
          typeof req.query.managerId ===
          "string"
            ? req.query.managerId
            : undefined,

        search:
          typeof req.query.search ===
          "string"
            ? req.query.search
            : undefined,

        page: Number(
          req.query.page || 1
        ),

        limit: Number(
          req.query.limit || 25
        )
      }
    );

  res.json({
    success: true,
    data
  });
}

/* -------------------------------------------------------------------------- */
/* List My Team                                                               */
/* -------------------------------------------------------------------------- */

export async function listMyTeam(
  req: AuthenticatedRequest,
  res: Response
) {
  const managerId =
    req.user?.userId;

  if (!managerId) {
    res.status(401).json({
      success: false,
      message:
        "Authentication required"
    });

    return;
  }

  const organizationId =
    orgId(req);

  if (!organizationId) {
    res.status(400).json({
      success: false,
      message:
        "Organization context is required"
    });

    return;
  }

  if (
    req.user?.role !==
    UserRole.MANAGER
  ) {
    res.status(403).json({
      success: false,
      message:
        "Manager access required"
    });

    return;
  }

  const data =
    await listManagerTeam(
      managerId,
      organizationId
    );

  res.json({
    success: true,
    data
  });
}

/* -------------------------------------------------------------------------- */
/* Get One User                                                               */
/* -------------------------------------------------------------------------- */

export async function getOne(
  req: AuthenticatedRequest,
  res: Response
) {
  const organizationId =
    orgId(req);

  if (!organizationId) {
    res.status(400).json({
      success: false,
      message:
        "Organization context is required"
    });

    return;
  }

  const id =
    getRouteParam(
      req.params.id,
      "id"
    );

  const user =
    await getOrganizationUser(
      organizationId,
      id
    );

  if (!user) {
    res.status(404).json({
      success: false,
      message:
        "User not found"
    });

    return;
  }

  res.json({
    success: true,
    data: user
  });
}

/* -------------------------------------------------------------------------- */
/* Create User                                                                */
/* -------------------------------------------------------------------------- */

export async function create(
  req: AuthenticatedRequest,
  res: Response
) {
  const organizationId =
    orgId(req);

  if (!organizationId) {
    res.status(400).json({
      success: false,
      message:
        "Organization context is required"
    });

    return;
  }

  const user =
    await createOrganizationUser(
      organizationId,
      req.body
    );

  await writeAuditLog(
    req,
    "USER_CREATED",
    "User",
    String(user.id),
    {
      role: user.role,
      email: user.email
    }
  );

  res.status(201).json({
    success: true,
    data: user
  });
}

/* -------------------------------------------------------------------------- */
/* Update User                                                                */
/* -------------------------------------------------------------------------- */

export async function update(
  req: AuthenticatedRequest,
  res: Response
) {
  const organizationId =
    orgId(req);

  if (!organizationId) {
    res.status(400).json({
      success: false,
      message:
        "Organization context is required"
    });

    return;
  }

  const id =
    getRouteParam(
      req.params.id,
      "id"
    );

  const user =
    await updateOrganizationUser(
      organizationId,
      id,
      req.body
    );

  if (!user) {
    res.status(404).json({
      success: false,
      message:
        "User not found"
    });

    return;
  }

  await writeAuditLog(
    req,
    "USER_UPDATED",
    "User",
    id,
    {
      changedFields:
        Object.keys(req.body)
    }
  );

  res.json({
    success: true,
    data: user
  });
}

/* -------------------------------------------------------------------------- */
/* Deactivate User                                                            */
/* -------------------------------------------------------------------------- */

export async function deactivate(
  req: AuthenticatedRequest,
  res: Response
) {
  const organizationId =
    orgId(req);

  if (!organizationId) {
    res.status(400).json({
      success: false,
      message:
        "Organization context is required"
    });

    return;
  }

  const id =
    getRouteParam(
      req.params.id,
      "id"
    );

  const user =
    await deactivateOrganizationUser(
      organizationId,
      id
    );

  if (!user) {
    res.status(404).json({
      success: false,
      message:
        "User not found"
    });

    return;
  }

  await writeAuditLog(
    req,
    "USER_DEACTIVATED",
    "User",
    id
  );

  res.json({
    success: true,
    data: user
  });
}