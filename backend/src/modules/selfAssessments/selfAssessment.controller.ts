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
  SelfAssessmentConfidence,
} from "../../models/SelfAssessmentResponse";

import {
  createSelfAssessment,
  getSelfAssessment,
  startSelfAssessment,
  upsertSelfAssessmentResponse,
  deleteSelfAssessmentResponse,
  submitSelfAssessment,
  listCandidateSelfAssessments,
  getSelfAssessmentCorroboration,
} from "./selfAssessment.service";

import {
  createPendingCorroborationForSubmittedAssessment,
} from "../managerCorroboration/managerCorroboration.service";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getRouteParam(
  value:
    | string
    | string[]
    | undefined,
  paramName: string,
): string {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(
      `${paramName} is required`,
    );
  }

  return value;
}

function getOrganizationId(
  req: AuthenticatedRequest,
): string | undefined {
  return req.user?.organizationId;
}

function getCandidateId(
  req: AuthenticatedRequest,
): string {
  if (!req.user) {
    throw new Error(
      "Authentication required",
    );
  }

  return req.user.userId;
}

/* -------------------------------------------------------------------------- */
/* Access control                                                             */
/* -------------------------------------------------------------------------- */

function canAccessCandidateAssessment(
  req: AuthenticatedRequest,
  candidateId: string,
): boolean {
  if (!req.user) {
    return false;
  }

  if (
    req.user.role ===
      UserRole.PLATFORM_ADMIN ||
    req.user.role ===
      UserRole.ORGANIZATION_ADMIN
  ) {
    return true;
  }

  return (
    req.user.role === UserRole.STAFF &&
    req.user.userId === candidateId
  );
}

function canModifyCandidateAssessment(
  req: AuthenticatedRequest,
  candidateId: string,
): boolean {
  if (!req.user) {
    return false;
  }

  return (
    req.user.role === UserRole.STAFF &&
    req.user.userId === candidateId
  );
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function create(
  req: AuthenticatedRequest,
  res: Response,
) {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message:
        "Authentication required",
    });
    return;
  }

  if (
    req.user.role !== UserRole.STAFF
  ) {
    res.status(403).json({
      success: false,
      message:
        "Only staff members can create a self-assessment",
    });
    return;
  }

  const roleProfileId =
    getRouteParam(
      req.params.roleProfileId,
      "roleProfileId",
    );

  const candidateId =
    getCandidateId(req);

  const selfAssessment =
    await createSelfAssessment({
      candidateId,
      roleProfileId,
      organizationId:
        getOrganizationId(req),
    });

  await writeAuditLog(
    req,
    "SELF_ASSESSMENT_CREATED",
    "SelfAssessment",
    selfAssessment.id,
  );

  res.status(201).json({
    success: true,
    data: selfAssessment,
  });
}

/* -------------------------------------------------------------------------- */
/* Get                                                                        */
/* -------------------------------------------------------------------------- */

export async function get(
  req: AuthenticatedRequest,
  res: Response,
) {
  const selfAssessmentId =
    getRouteParam(
      req.params.id,
      "id",
    );

  const result =
    await getSelfAssessment(
      selfAssessmentId,
      getOrganizationId(req),
    );

  if (
    req.user &&
    !canAccessCandidateAssessment(
      req,
      result.selfAssessment.candidateId.toString(),
    )
  ) {
    res.status(403).json({
      success: false,
      message:
        "You cannot access this self-assessment",
    });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
}

/* -------------------------------------------------------------------------- */
/* List candidate self-assessments                                            */
/* -------------------------------------------------------------------------- */

export async function listMine(
  req: AuthenticatedRequest,
  res: Response,
) {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message:
        "Authentication required",
    });
    return;
  }

  /*
   * Staff:
   *
   * Always use the authenticated user's ID.
   *
   * Do not accept candidateId from the frontend
   * for normal staff access.
   *
   * This is what keeps:
   *
   * GET /self-assessments
   *
   * tied to the logged-in staff member.
   */
  let candidateId:
    | string
    | undefined;

  if (
    req.user.role ===
      UserRole.PLATFORM_ADMIN ||
    req.user.role ===
      UserRole.ORGANIZATION_ADMIN
  ) {
    if (
      typeof req.query.candidateId ===
      "string"
    ) {
      candidateId =
        req.query.candidateId;
    }
  } else if (
    req.user.role === UserRole.STAFF
  ) {
    candidateId =
      req.user.userId;
  }

  if (!candidateId) {
    res.status(400).json({
      success: false,
      message:
        "candidateId is required for administrative access",
    });
    return;
  }

  if (
    !canAccessCandidateAssessment(
      req,
      candidateId,
    )
  ) {
    res.status(403).json({
      success: false,
      message:
        "You cannot access these self-assessments",
    });
    return;
  }

  const assessments =
    await listCandidateSelfAssessments({
      candidateId,
      organizationId:
        getOrganizationId(req),
    });

  res.json({
    success: true,
    data: assessments,
  });
}

/* -------------------------------------------------------------------------- */
/* Start                                                                      */
/* -------------------------------------------------------------------------- */

export async function start(
  req: AuthenticatedRequest,
  res: Response,
) {
  const selfAssessmentId =
    getRouteParam(
      req.params.id,
      "id",
    );

  const existing =
    await getSelfAssessment(
      selfAssessmentId,
      getOrganizationId(req),
    );

  const candidateId =
    existing.selfAssessment.candidateId.toString();

  if (
    !canModifyCandidateAssessment(
      req,
      candidateId,
    )
  ) {
    res.status(403).json({
      success: false,
      message:
        "Only the staff member who owns this self-assessment can start it",
    });
    return;
  }

  const selfAssessment =
    await startSelfAssessment(
      selfAssessmentId,
      getOrganizationId(req),
    );

  await writeAuditLog(
    req,
    "SELF_ASSESSMENT_STARTED",
    "SelfAssessment",
    selfAssessment.id,
  );

  res.json({
    success: true,
    data: selfAssessment,
  });
}

/* -------------------------------------------------------------------------- */
/* Save response                                                              */
/* -------------------------------------------------------------------------- */

export async function saveResponse(
  req: AuthenticatedRequest,
  res: Response,
) {
  const selfAssessmentId =
    getRouteParam(
      req.params.id,
      "id",
    );

  const existing =
    await getSelfAssessment(
      selfAssessmentId,
      getOrganizationId(req),
    );

  const candidateId =
    existing.selfAssessment.candidateId.toString();

  if (
    !canModifyCandidateAssessment(
      req,
      candidateId,
    )
  ) {
    res.status(403).json({
      success: false,
      message:
        "Only the staff member who owns this self-assessment can modify it",
    });
    return;
  }

  const response =
    await upsertSelfAssessmentResponse({
      selfAssessmentId,

      organizationId:
        getOrganizationId(req),

      skillId:
        req.body.skillId,

      behaviouralFactorId:
        req.body.behaviouralFactorId,

      selectedLevel:
        req.body.selectedLevel,

      evidence:
        req.body.evidence,

      confidence:
        req.body.confidence ||
        SelfAssessmentConfidence.MEDIUM,
    });

  res.json({
    success: true,
    data: response,
  });
}

/* -------------------------------------------------------------------------- */
/* Delete response                                                            */
/* -------------------------------------------------------------------------- */

export async function removeResponse(
  req: AuthenticatedRequest,
  res: Response,
) {
  const selfAssessmentId =
    getRouteParam(
      req.params.id,
      "id",
    );

  const responseId =
    getRouteParam(
      req.params.responseId,
      "responseId",
    );

  const existing =
    await getSelfAssessment(
      selfAssessmentId,
      getOrganizationId(req),
    );

  const candidateId =
    existing.selfAssessment.candidateId.toString();

  if (
    !canModifyCandidateAssessment(
      req,
      candidateId,
    )
  ) {
    res.status(403).json({
      success: false,
      message:
        "Only the staff member who owns this self-assessment can remove responses",
    });
    return;
  }

  const deleted =
    await deleteSelfAssessmentResponse(
      responseId,
      getOrganizationId(req),
    );

  if (
    deleted.selfAssessmentId?.toString() !==
    selfAssessmentId
  ) {
    res.status(403).json({
      success: false,
      message:
        "This response does not belong to the specified self-assessment",
    });
    return;
  }

  res.json({
    success: true,
    data: deleted,
  });
}

/* -------------------------------------------------------------------------- */
/* Submit                                                                     */
/* -------------------------------------------------------------------------- */

export async function submit(
  req: AuthenticatedRequest,
  res: Response,
) {
  const selfAssessmentId =
    getRouteParam(
      req.params.id,
      "id",
    );

  const existing =
    await getSelfAssessment(
      selfAssessmentId,
      getOrganizationId(req),
    );

  const candidateId =
    existing.selfAssessment.candidateId.toString();

  if (
    !canModifyCandidateAssessment(
      req,
      candidateId,
    )
  ) {
    res.status(403).json({
      success: false,
      message:
        "Only the staff member who owns this self-assessment can submit it",
    });
    return;
  }

  const result =
    await submitSelfAssessment(
      selfAssessmentId,
      getOrganizationId(req),
    );

  if (
    result.selfAssessment
      .corroborationRequired
  ) {
    await createPendingCorroborationForSubmittedAssessment(
      selfAssessmentId,
      getOrganizationId(req),
    );
  }

  await writeAuditLog(
    req,
    "SELF_ASSESSMENT_SUBMITTED",
    "SelfAssessment",
    selfAssessmentId,
  );

  res.json({
    success: true,
    data: result,
  });
}

/* -------------------------------------------------------------------------- */
/* Corroboration                                                              */
/* -------------------------------------------------------------------------- */

export async function corroboration(
  req: AuthenticatedRequest,
  res: Response,
) {
  const selfAssessmentId =
    getRouteParam(
      req.params.id,
      "id",
    );

  const existing =
    await getSelfAssessment(
      selfAssessmentId,
      getOrganizationId(req),
    );

  if (
    !canAccessCandidateAssessment(
      req,
      existing.selfAssessment.candidateId.toString(),
    )
  ) {
    res.status(403).json({
      success: false,
      message:
        "You cannot access this corroboration result",
    });
    return;
  }

  /*
   * IMPORTANT FIX:
   *
   * getSelfAssessmentCorroboration()
   * expects an object:
   *
   * {
   *   selfAssessmentId,
   *   organizationId
   * }
   *
   * Do not pass positional arguments here.
   */
  const result =
    await getSelfAssessmentCorroboration({
      selfAssessmentId,

      organizationId:
        getOrganizationId(req),
    });

  res.json({
    success: true,
    data: result,
  });
}