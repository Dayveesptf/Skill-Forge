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
  Assessment
} from "../../models/Assessment";

import {
  evaluateAssessmentAttempt,
  getAssessmentEvaluation,
  listAssessmentEvaluations
} from "./scoring.service";

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

function getOrganizationId(
  req: AuthenticatedRequest
): string | undefined {
  return req.user?.organizationId;
}

function isAdmin(
  req: AuthenticatedRequest
): boolean {
  return (
    req.user?.role ===
      UserRole.PLATFORM_ADMIN ||
    req.user?.role ===
      UserRole.ORGANIZATION_ADMIN
  );
}

export async function evaluateAttempt(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const attemptId =
      getRouteParam(
        req.params.attemptId,
        "attemptId"
      );

    const evaluation =
      await evaluateAssessmentAttempt({
        attemptId,
        organizationId:
          getOrganizationId(req)
      });

    await writeAuditLog(
      req,
      "ASSESSMENT_ATTEMPT_EVALUATED",
      "AssessmentEvaluation",
      evaluation.evaluation.id
    );

    return res.json({
      success: true,
      data: evaluation
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to evaluate assessment attempt"
    });
  }
}

export async function getEvaluation(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const attemptId =
      getRouteParam(
        req.params.attemptId,
        "attemptId"
      );

    const admin =
      isAdmin(req);

    const result =
      await getAssessmentEvaluation({
        attemptId,
        organizationId:
          getOrganizationId(req),
        candidateId: admin
          ? undefined
          : req.user!.userId
      });

    /*
     * Non-admin users can only see results
     * when the assessment explicitly allows
     * immediate result visibility.
     */
    if (!admin) {
      if (
        result.assessment
          ?.showResultsImmediately !== true
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Assessment results are not currently available"
        });
      }
    }

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Assessment evaluation not found"
    });
  }
}

export async function listEvaluations(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.assessmentId,
        "assessmentId"
      );

    const evaluations =
      await listAssessmentEvaluations({
        assessmentId,
        organizationId:
          getOrganizationId(req)
      });

    return res.json({
      success: true,
      data: evaluations
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to list assessment evaluations"
    });
  }
}