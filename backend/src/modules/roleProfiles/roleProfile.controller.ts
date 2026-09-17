import { Response } from "express";

import {
  AuthenticatedRequest
} from "../../middleware/auth";

import {
  UserRole
} from "../../constants/roles";

import {
  writeAuditLog
} from "../../utils/audit";

import {
  RoleProfileStatus
} from "../../models/RoleProfile";

import {
  createRoleProfile,
  listRoleProfiles,
  getRoleProfile,
  updateRoleProfile,
  publishRoleProfile,
  archiveRoleProfile,
  createCareerPath,
  listCareerPaths,
  getCareerPath,
  updateCareerPath,
  deleteCareerPath
} from "./roleProfile.service";

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

function getQueryParam(
  value: unknown,
  paramName: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(
      `${paramName} must be a valid string`
    );
  }

  return value;
}

function getOrganizationId(
  req: AuthenticatedRequest
): string | undefined {
  if (
    req.user?.role ===
    UserRole.PLATFORM_ADMIN
  ) {
    return undefined;
  }

  return req.user?.organizationId;
}

function getAdminOrganizationId(
  req: AuthenticatedRequest
): string | undefined {
  if (
    req.user?.role ===
    UserRole.PLATFORM_ADMIN
  ) {
    return getQueryParam(
      req.body.organizationId,
      "organizationId"
    );
  }

  return req.user?.organizationId;
}

/* -------------------------------------------------------------------------- */
/* Role Profiles                                                              */
/* -------------------------------------------------------------------------- */

export async function createRoleProfileHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required"
      });
      return;
    }

    const organizationId =
      getAdminOrganizationId(req);

    if (!organizationId) {
      res.status(400).json({
        success: false,
        message:
          "organizationId is required"
      });
      return;
    }

    const profile =
      await createRoleProfile({
        organizationId,

        frameworkVersionId:
          req.body.frameworkVersionId,

        industryTemplateId:
          req.body.industryTemplateId,

        name:
          req.body.name,

        slug:
          req.body.slug,

        description:
          req.body.description,

        department:
          req.body.department,

        skills:
          req.body.skills,

        behaviouralFactors:
          req.body.behaviouralFactors,

        createdBy:
          req.user.userId
      });

    await writeAuditLog(
      req,
      "ROLE_PROFILE_CREATED",
      "RoleProfile",
      profile.id
    );

    res.status(201).json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create role profile"
    });
  }
}

export async function getRoleProfiles(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const status =
      getQueryParam(
        req.query.status,
        "status"
      );

    let normalizedStatus:
      | RoleProfileStatus
      | undefined;

    if (status) {
      if (
        !Object.values(
          RoleProfileStatus
        ).includes(
          status as RoleProfileStatus
        )
      ) {
        throw new Error(
          "Invalid role profile status"
        );
      }

      normalizedStatus =
        status as RoleProfileStatus;
    }

    const profiles =
      await listRoleProfiles({
        organizationId:
          getOrganizationId(req),

        frameworkVersionId:
          getQueryParam(
            req.query.frameworkVersionId,
            "frameworkVersionId"
          ),

        status:
          normalizedStatus
      });

    res.json({
      success: true,
      data: profiles
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to load role profiles"
    });
  }
}

export async function getRoleProfileHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id =
      getRouteParam(
        req.params.id,
        "id"
      );

    const profile =
      await getRoleProfile(
        id,
        getOrganizationId(req)
      );

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Role profile not found"
    });
  }
}

export async function updateRoleProfileHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required"
      });
      return;
    }

    const id =
      getRouteParam(
        req.params.id,
        "id"
      );

    const profile =
      await updateRoleProfile(
        id,
        {
          organizationId:
            getOrganizationId(req),

          name:
            req.body.name,

          slug:
            req.body.slug,

          description:
            req.body.description,

          department:
            req.body.department,

          skills:
            req.body.skills,

          behaviouralFactors:
            req.body.behaviouralFactors,

          updatedBy:
            req.user.userId
        }
      );

    await writeAuditLog(
      req,
      "ROLE_PROFILE_UPDATED",
      "RoleProfile",
      profile.id,
      {
        changedFields:
          Object.keys(req.body)
      }
    );

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update role profile"
    });
  }
}

export async function publishRoleProfileHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id =
      getRouteParam(
        req.params.id,
        "id"
      );

    const profile =
      await publishRoleProfile(
        id,
        getOrganizationId(req)
      );

    await writeAuditLog(
      req,
      "ROLE_PROFILE_PUBLISHED",
      "RoleProfile",
      profile.id
    );

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to publish role profile"
    });
  }
}

export async function archiveRoleProfileHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id =
      getRouteParam(
        req.params.id,
        "id"
      );

    const profile =
      await archiveRoleProfile(
        id,
        getOrganizationId(req)
      );

    await writeAuditLog(
      req,
      "ROLE_PROFILE_ARCHIVED",
      "RoleProfile",
      profile.id
    );

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to archive role profile"
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Career Paths                                                               */
/* -------------------------------------------------------------------------- */

export async function createCareerPathHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required"
      });
      return;
    }

    const organizationId =
      getAdminOrganizationId(req);

    if (!organizationId) {
      res.status(400).json({
        success: false,
        message:
          "organizationId is required"
      });
      return;
    }

    const careerPath =
      await createCareerPath({
        organizationId,

        sourceRoleProfileId:
          req.body.sourceRoleProfileId,

        targetRoleProfileId:
          req.body.targetRoleProfileId,

        name:
          req.body.name,

        description:
          req.body.description,

        createdBy:
          req.user.userId
      });

    await writeAuditLog(
      req,
      "CAREER_PATH_CREATED",
      "CareerPath",
      careerPath.id
    );

    res.status(201).json({
      success: true,
      data: careerPath
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create career path"
    });
  }
}

export async function getCareerPaths(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const paths =
      await listCareerPaths({
        organizationId:
          getOrganizationId(req),

        sourceRoleProfileId:
          getQueryParam(
            req.query.sourceRoleProfileId,
            "sourceRoleProfileId"
          ),

        targetRoleProfileId:
          getQueryParam(
            req.query.targetRoleProfileId,
            "targetRoleProfileId"
          )
      });

    res.json({
      success: true,
      data: paths
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to load career paths"
    });
  }
}

export async function getCareerPathHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id =
      getRouteParam(
        req.params.id,
        "id"
      );

    const careerPath =
      await getCareerPath(
        id,
        getOrganizationId(req)
      );

    res.json({
      success: true,
      data: careerPath
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Career path not found"
    });
  }
}

export async function updateCareerPathHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required"
      });
      return;
    }

    const id =
      getRouteParam(
        req.params.id,
        "id"
      );

    const careerPath =
      await updateCareerPath(
        id,
        {
          organizationId:
            getOrganizationId(req),

          sourceRoleProfileId:
            req.body.sourceRoleProfileId,

          targetRoleProfileId:
            req.body.targetRoleProfileId,

          name:
            req.body.name,

          description:
            req.body.description,

          updatedBy:
            req.user.userId
        }
      );

    await writeAuditLog(
      req,
      "CAREER_PATH_UPDATED",
      "CareerPath",
      careerPath.id
    );

    res.json({
      success: true,
      data: careerPath
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update career path"
    });
  }
}

export async function deleteCareerPathHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id =
      getRouteParam(
        req.params.id,
        "id"
      );

    const result =
      await deleteCareerPath(
        id,
        getOrganizationId(req)
      );

    await writeAuditLog(
      req,
      "CAREER_PATH_DELETED",
      "CareerPath",
      id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete career path"
    });
  }
}