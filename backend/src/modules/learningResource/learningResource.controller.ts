import { Response } from "express";

import { AuthenticatedRequest } from "../../middleware/auth";
import { UserRole } from "../../constants/roles";

import { writeAuditLog } from "../../utils/audit";

import {
  createLearningResource,
  listLearningResources,
  updateLearningResource,
  deleteLearningResource,
  getRecommendationsForGapAnalysis,
} from "./learningResource.service";

import { GapAnalysis } from "../../models/GapAnalysis";
import { canAccessCandidate } from "../access/candidateAccess";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getOrganizationId(
  req: AuthenticatedRequest,
): string | undefined {
  if (
    req.user?.role ===
    UserRole.PLATFORM_ADMIN
  ) {
    return undefined;
  }

  return req.user?.organizationId;
}

function getRouteParam(
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

  return value.trim();
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function create(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });

      return;
    }

    const resource =
      await createLearningResource({
        organizationId:
          req.user.role ===
          UserRole.PLATFORM_ADMIN
            ? req.body.organizationId
            : req.user.organizationId,

        competencyType:
          req.body.competencyType,

        competencyId:
          req.body.competencyId,

        title:
          req.body.title,

        description:
          req.body.description,

        url:
          req.body.url,

        provider:
          req.body.provider,

        resourceType:
          req.body.resourceType,

        targetLevel:
          Number(
            req.body.targetLevel,
          ),

        createdBy:
          req.user.userId,
      });

    await writeAuditLog(
      req,
      "LEARNING_RESOURCE_CREATED",
      "LearningResource",
      resource.id,
    );

    res.status(201).json({
      success: true,
      data: resource,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not create learning resource",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export async function list(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const resources =
      await listLearningResources({
        organizationId:
          getOrganizationId(req),

        competencyType:
          req.query.competencyType as
            | "SKILL"
            | "BEHAVIOURAL_FACTOR"
            | undefined,

        competencyId:
          req.query.competencyId as
            | string
            | undefined,

        includeInactive:
          req.user?.role ===
            UserRole.ORGANIZATION_ADMIN ||
          req.user?.role ===
            UserRole.PLATFORM_ADMIN
            ? req.query.includeInactive ===
              "true"
            : false,
      });

    res.json({
      success: true,
      data: resources,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not load learning resources",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function update(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });

      return;
    }

    const id = getRouteParam(
      req.params.id,
      "id",
    );

    const resource =
      await updateLearningResource({
        id,

        organizationId:
          getOrganizationId(req),

        updates: {
          title:
            req.body.title,

          description:
            req.body.description,

          url:
            req.body.url,

          provider:
            req.body.provider,

          resourceType:
            req.body.resourceType,

          targetLevel:
            req.body.targetLevel !==
            undefined
              ? Number(
                  req.body.targetLevel,
                )
              : undefined,

          isActive:
            req.body.isActive,
        },
      });

    await writeAuditLog(
      req,
      "LEARNING_RESOURCE_UPDATED",
      "LearningResource",
      id,
    );

    res.json({
      success: true,
      data: resource,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not update learning resource",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function remove(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });

      return;
    }

    const id = getRouteParam(
      req.params.id,
      "id",
    );

    const result =
      await deleteLearningResource({
        id,

        organizationId:
          getOrganizationId(req),
      });

    await writeAuditLog(
      req,
      "LEARNING_RESOURCE_DELETED",
      "LearningResource",
      id,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not delete learning resource",
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Recommendations                                                            */
/* -------------------------------------------------------------------------- */

export async function recommendationsForGapAnalysis(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message:
          "Authentication required",
      });

      return;
    }

    const gapAnalysisId =
      getRouteParam(
        req.params.gapAnalysisId,
        "gapAnalysisId",
      );

    const gapQuery: Record<
      string,
      unknown
    > = {
      _id: gapAnalysisId,
    };

    if (
      req.user.role !==
        UserRole.PLATFORM_ADMIN &&
      req.user.organizationId
    ) {
      gapQuery.organizationId =
        req.user.organizationId;
    }

    const gapAnalysis =
      await GapAnalysis.findOne(
        gapQuery,
      )
        .select(
          "_id candidateId organizationId",
        )
        .lean()
        .exec();

    if (!gapAnalysis) {
      res.status(404).json({
        success: false,
        message:
          "Gap analysis not found",
      });

      return;
    }

    const allowed = await canAccessCandidate(
      req,
      gapAnalysis.candidateId.toString(),
    );

    if (!allowed) {
      res.status(403).json({
        success: false,
        message:
          "You do not have access to this gap analysis",
      });

      return;
    }

    const result =
      await getRecommendationsForGapAnalysis(
        {
          gapAnalysisId,

          organizationId:
            gapAnalysis.organizationId?.toString(),
        },
      );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not load recommendations",
    });
  }
}