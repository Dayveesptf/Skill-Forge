import { Response } from "express";

import { AuthenticatedRequest } from "../../middleware/auth";

import { UserRole } from "../../constants/roles";

import { writeAuditLog } from "../../utils/audit";

import {
  AssessmentAssignmentStatus
} from "../../models/AssessmentAssignment";

import {
  cancelAssessmentAssignment,
  createAssessmentAssignment,
  getAssessmentAssignment,
  listAssessmentAssignments
} from "./assessmentAssignment.service";

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
  if (
    req.user?.role === UserRole.PLATFORM_ADMIN
  ) {
    return undefined;
  }

  return req.user?.organizationId;
}

export async function createAssignment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const assignment =
      await createAssessmentAssignment({
        organizationId:
          getOrganizationId(req),

        assessmentId:
          req.body.assessmentId,

        candidateId:
          req.body.candidateId,

        assignedBy:
          req.user.userId,

        dueAt: req.body.dueAt
          ? new Date(req.body.dueAt)
          : undefined,

        maxAttempts:
          req.body.maxAttempts,

        instructions:
          req.body.instructions
      });

    await writeAuditLog(
      req,
      "ASSESSMENT_ASSIGNMENT_CREATED",
      "AssessmentAssignment",
      assignment.id
    );

    res.status(201).json({
      success: true,
      data: assignment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create assessment assignment"
    });
  }
}

export async function listAssignments(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assignments =
      await listAssessmentAssignments({
        organizationId:
          getOrganizationId(req),

        assessmentId:
          typeof req.query.assessmentId ===
          "string"
            ? req.query.assessmentId
            : undefined,

        candidateId:
          typeof req.query.candidateId ===
          "string"
            ? req.query.candidateId
            : undefined,

        status:
          typeof req.query.status ===
          "string"
            ? (
                req.query.status as
                  AssessmentAssignmentStatus
              )
            : undefined
      });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to list assessment assignments"
    });
  }
}

export async function getAssignment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assignmentId =
      getRouteParam(
        req.params.id,
        "assignmentId"
      );

    const assignment =
      await getAssessmentAssignment(
        assignmentId,
        {
          organizationId:
            getOrganizationId(req)
        }
      );

    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Assessment assignment not found"
    });
  }
}

export async function cancelAssignment(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }

    const assignmentId =
      getRouteParam(
        req.params.id,
        "assignmentId"
      );

    const assignment =
      await cancelAssessmentAssignment(
        assignmentId,
        getOrganizationId(req)
      );

    await writeAuditLog(
      req,
      "ASSESSMENT_ASSIGNMENT_CANCELLED",
      "AssessmentAssignment",
      assignment.id
    );

    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to cancel assessment assignment"
    });
  }
}