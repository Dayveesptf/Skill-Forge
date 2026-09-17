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
  AIGenerationStatus,
  AIGenerationType
} from "../../models/AIGeneration";

import {
  generateRoleSkillMapping,
  generateInterviewQuestions,
  getAIGeneration,
  listAIGenerations,
  reviewAIGeneration
} from "./ai.service";

function getRouteParam(
  value:
    | string
    | string[]
    | undefined,
  paramName: string
): string {
  if (
    typeof value !==
      "string" ||
    value.trim() === ""
  ) {
    throw new Error(
      `${paramName} is required`
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

function getQueryString(
  value: unknown
): string | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  if (
    typeof value !==
      "string" ||
    value.trim() === ""
  ) {
    return undefined;
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* Role Skill Mapping                                                         */
/* -------------------------------------------------------------------------- */

export async function generateRoleMapping(
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

    const roleProfileId =
      getRouteParam(
        req.params.roleProfileId,
        "roleProfileId"
      );

    const generation =
      await generateRoleSkillMapping({
        roleProfileId,

        organizationId:
          getOrganizationId(req),

        createdBy:
          req.user.userId
      });

    await writeAuditLog(
      req,
      "AI_ROLE_SKILL_MAPPING_GENERATED",
      "AIGeneration",
      generation.id
    );

    res.status(201).json({
      success: true,
      data: generation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate AI skill mapping"
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Interview Questions                                                        */
/* -------------------------------------------------------------------------- */

export async function generateQuestions(
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

    const assessmentId =
      getRouteParam(
        req.params.assessmentId,
        "assessmentId"
      );

    const generation =
      await generateInterviewQuestions({
        assessmentId,

        roleProfileId:
          req.body.roleProfileId,

        organizationId:
          getOrganizationId(req),

        count:
          req.body.count,

        questionTypes:
          Array.isArray(
            req.body.questionTypes
          )
            ? req.body.questionTypes
            : undefined,

        createdBy:
          req.user.userId
      });

    await writeAuditLog(
      req,
      "AI_INTERVIEW_QUESTIONS_GENERATED",
      "AIGeneration",
      generation.id
    );

    res.status(201).json({
      success: true,
      data: generation
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate interview questions"
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Generation Retrieval                                                       */
/* -------------------------------------------------------------------------- */

export async function getGeneration(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const id =
      getRouteParam(
        req.params.id,
        "id"
      );

    const generation =
      await getAIGeneration(
        id,
        getOrganizationId(req)
      );

    res.json({
      success: true,
      data: generation
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "AI generation not found"
    });
  }
}

export async function getGenerations(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const generationType =
      getQueryString(
        req.query.generationType
      );

    const status =
      getQueryString(
        req.query.status
      );

    let normalizedType:
      | AIGenerationType
      | undefined;

    let normalizedStatus:
      | AIGenerationStatus
      | undefined;

    if (generationType) {
      if (
        !Object.values(
          AIGenerationType
        ).includes(
          generationType as AIGenerationType
        )
      ) {
        throw new Error(
          "Invalid AI generation type"
        );
      }

      normalizedType =
        generationType as AIGenerationType;
    }

    if (status) {
      if (
        !Object.values(
          AIGenerationStatus
        ).includes(
          status as AIGenerationStatus
        )
      ) {
        throw new Error(
          "Invalid AI generation status"
        );
      }

      normalizedStatus =
        status as AIGenerationStatus;
    }

    const generations =
      await listAIGenerations({
        organizationId:
          getOrganizationId(req),

        generationType:
          normalizedType,

        status:
          normalizedStatus
      });

    res.json({
      success: true,
      data: generations
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to load AI generations"
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Human Review                                                               */
/* -------------------------------------------------------------------------- */

export async function reviewGeneration(
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

    const decision =
      req.body.decision;

    if (
      decision !== "APPROVE" &&
      decision !== "REJECT"
    ) {
      res.status(400).json({
        success: false,
        message:
          "decision must be APPROVE or REJECT"
      });

      return;
    }

    const result =
      await reviewAIGeneration({
        generationId:
          id,

        organizationId:
          getOrganizationId(req),

        decision,

        approvedIndexes:
          req.body.approvedIndexes,

        reviewNotes:
          req.body.reviewNotes,

        reviewedBy:
          req.user.userId,

        applyToRoleProfile:
          req.body.applyToRoleProfile ===
          true,

        applyToAssessment:
          req.body.applyToAssessment ===
          true
      });

    await writeAuditLog(
      req,
      "AI_GENERATION_REVIEWED",
      "AIGeneration",
      id,
      {
        decision,

        approvedIndexes:
          result.generation
            .approvedIndexes,

        applied:
          result.applied
      }
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
          : "Failed to review AI generation"
    });
  }
}