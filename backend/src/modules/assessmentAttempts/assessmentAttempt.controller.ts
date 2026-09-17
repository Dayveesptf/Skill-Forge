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
  getCandidateAssessmentDelivery
} from "./assessmentDelivery.service";

import {
  getCandidateAttempt,
  listAttemptResponses,
  saveAssessmentResponse,
  startAssessmentAttempt,
  submitAssessmentAttempt
} from "./assessmentAttempt.service";

import {
  evaluateAssessmentAttempt
} from "../scoring/scoring.service";

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
  /*
   * Platform admins are not restricted to a
   * specific organization.
   */
  if (
    req.user?.role ===
    UserRole.PLATFORM_ADMIN
  ) {
    return undefined;
  }

  return req.user?.organizationId;
}

export async function startAttempt(
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
        req.params.assignmentId,
        "assignmentId"
      );

    const result =
      await startAssessmentAttempt({
        assignmentId,

        candidateId:
          req.user.userId,

        organizationId:
          getOrganizationId(req)
      });

    res
      .status(
        result.resumed
          ? 200
          : 201
      )
      .json({
        success: true,
        data: result
      });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to start assessment"
    });
  }
}

export async function getAttempt(
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

    const attemptId =
      getRouteParam(
        req.params.id,
        "attemptId"
      );

    const attempt =
      await getCandidateAttempt(
        attemptId,
        {
          candidateId:
            req.user.userId,

          organizationId:
            getOrganizationId(req)
        }
      );

    res.json({
      success: true,
      data: attempt
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Assessment attempt not found"
    });
  }
}

export async function getDelivery(
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

    const attemptId =
      getRouteParam(
        req.params.id,
        "attemptId"
      );

    const delivery =
      await getCandidateAssessmentDelivery(
        attemptId,

        req.user.userId,

        getOrganizationId(req)
      );

    res.json({
      success: true,
      data: delivery
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to load assessment"
    });
  }
}

export async function saveResponse(
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

    const attemptId =
      getRouteParam(
        req.params.id,
        "attemptId"
      );

    const questionId =
      getRouteParam(
        req.params.questionId,
        "questionId"
      );

    const response =
      await saveAssessmentResponse({
        attemptId,

        candidateId:
          req.user.userId,

        questionId,

        selectedOptionKeys:
          Array.isArray(
            req.body.selectedOptionKeys
          )
            ? req.body.selectedOptionKeys
            : undefined,

        textAnswer:
          typeof req.body.textAnswer ===
          "string"
            ? req.body.textAnswer
            : undefined,

        organizationId:
          getOrganizationId(req)
      });

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to save response"
    });
  }
}

export async function getResponses(
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

    const attemptId =
      getRouteParam(
        req.params.id,
        "attemptId"
      );

    const responses =
      await listAttemptResponses({
        attemptId,

        candidateId:
          req.user.userId,

        organizationId:
          getOrganizationId(req)
      });

    res.json({
      success: true,
      data: responses
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to load responses"
    });
  }
}

export async function submitAttempt(
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

    const attemptId =
      getRouteParam(
        req.params.id,
        "attemptId"
      );

    /*
     * First submit the assessment attempt.
     */
    const attempt =
      await submitAssessmentAttempt({
        attemptId,

        candidateId:
          req.user.userId,

        organizationId:
          getOrganizationId(req)
      });

    /*
     * Record the submission in the audit trail.
     */
    await writeAuditLog(
      req,
      "ASSESSMENT_ATTEMPT_SUBMITTED",
      "AssessmentAttempt",
      attempt.id
    );

    /*
     * Automatically evaluate the submitted attempt.
     *
     * We intentionally keep evaluation in its own
     * try/catch so a scoring failure does not undo
     * an already successful assessment submission.
     */
    let evaluation = null;

    try {
      evaluation =
        await evaluateAssessmentAttempt({
          attemptId:
            attempt.id,

          organizationId:
            getOrganizationId(req)
        });

      /*
       * Record successful evaluation.
       */
      if (evaluation) {
        await writeAuditLog(
          req,
          "ASSESSMENT_ATTEMPT_EVALUATED",
          "AssessmentEvaluation",
          evaluation.evaluation.id
        );
      }
    } catch (evaluationError) {
      /*
       * The attempt has already been submitted.
       *
       * If scoring fails, the candidate should not
       * receive a failed submission response.
       *
       * The admin evaluation endpoint can retry the
       * evaluation later.
       */
      console.error(
        "Assessment evaluation failed:",
        evaluationError
      );
    }

    /*
     * One and only one response is sent.
     */
    res.json({
      success: true,

      data: {
        attempt,

        evaluation
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,

      message:
        error instanceof Error
          ? error.message
          : "Failed to submit assessment"
    });
  }
}