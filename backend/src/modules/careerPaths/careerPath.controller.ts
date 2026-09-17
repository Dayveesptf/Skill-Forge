import {
  Response,
} from "express";

import {
  AuthenticatedRequest,
} from "../../middleware/auth";

import {
  UserRole,
} from "../../constants/roles";

import {
  writeAuditLog,
} from "../../utils/audit";

import {
  listCareerPaths,
  listCareerPathRoleOptions,
  getCareerPath,
  createCareerPath,
  updateCareerPath,
  deleteCareerPath,
} from "./careerPath.service";

function getParam(
  value:
    | string
    | string[]
    | undefined,
  name: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${name} is required`,
    );
  }

  return value;
}

function getOrganizationId(
  req: AuthenticatedRequest,
): string {
  if (!req.user?.organizationId) {
    throw new Error(
      "This account is not associated with an organization",
    );
  }

  return req.user.organizationId;
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export async function list(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const organizationId =
      getOrganizationId(req);

    const careerPaths =
      await listCareerPaths(
        organizationId,
      );

    return res.status(200).json({
      success: true,
      data: careerPaths,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to load career paths",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Role Options                                                               */
/* -------------------------------------------------------------------------- */

export async function roleOptions(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const organizationId =
      getOrganizationId(req);

    const roles =
      await listCareerPathRoleOptions(
        organizationId,
      );

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to load role profiles",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Get One                                                                    */
/* -------------------------------------------------------------------------- */

export async function getOne(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const id = getParam(
      req.params.id,
      "careerPathId",
    );

    const organizationId =
      getOrganizationId(req);

    const careerPath =
      await getCareerPath(
        id,
        organizationId,
      );

    return res.status(200).json({
      success: true,
      data: careerPath,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Career path not found",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function create(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    if (
      req.user.role !==
      UserRole.ORGANIZATION_ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only organization administrators can create career paths",
      });
    }

    const organizationId =
      getOrganizationId(req);

    const {
      sourceRoleProfileId,
      targetRoleProfileId,
      name,
      description,
    } = req.body;

    if (
      typeof sourceRoleProfileId !==
      "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "sourceRoleProfileId is required",
      });
    }

    if (
      typeof targetRoleProfileId !==
      "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "targetRoleProfileId is required",
      });
    }

    const careerPath =
      await createCareerPath({
        organizationId,
        sourceRoleProfileId,
        targetRoleProfileId,
        name:
          typeof name === "string"
            ? name
            : undefined,
        description:
          typeof description ===
          "string"
            ? description
            : undefined,
        createdBy:
          req.user.userId,
      });

    await writeAuditLog(
      req,
      "CAREER_PATH_CREATED",
      "CareerPath",
      careerPath.id,
    );

    return res.status(201).json({
      success: true,
      data: careerPath,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to create career path",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function update(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    if (
      req.user.role !==
      UserRole.ORGANIZATION_ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only organization administrators can update career paths",
      });
    }

    const id = getParam(
      req.params.id,
      "careerPathId",
    );

    const organizationId =
      getOrganizationId(req);

    const {
      name,
      description,
    } = req.body;

    const careerPath =
      await updateCareerPath({
        careerPathId: id,
        organizationId,
        name:
          typeof name === "string"
            ? name
            : undefined,
        description:
          typeof description ===
          "string"
            ? description
            : undefined,
        updatedBy:
          req.user.userId,
      });

    await writeAuditLog(
      req,
      "CAREER_PATH_UPDATED",
      "CareerPath",
      careerPath.id,
    );

    return res.status(200).json({
      success: true,
      data: careerPath,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to update career path",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function remove(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });
    }

    if (
      req.user.role !==
      UserRole.ORGANIZATION_ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only organization administrators can delete career paths",
      });
    }

    const id = getParam(
      req.params.id,
      "careerPathId",
    );

    const organizationId =
      getOrganizationId(req);

    const result =
      await deleteCareerPath(
        id,
        organizationId,
      );

    await writeAuditLog(
      req,
      "CAREER_PATH_DELETED",
      "CareerPath",
      id,
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to delete career path",
    });
  }
}