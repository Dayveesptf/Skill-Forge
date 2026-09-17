import mongoose, { Types } from "mongoose";

import {
  ManagerCorroboration,
  ManagerCorroborationDecision,
  ManagerCorroborationStatus,
} from "../../models/ManagerCorroboration";

import {
  SelfAssessment,
  SelfAssessmentStatus,
} from "../../models/SelfAssessment";

import {
  SelfAssessmentResponse,
} from "../../models/SelfAssessmentResponse";

import {
  User,
} from "../../models/User";

import {
  UserRole,
} from "../../constants/roles";

import {
  Notification,
  NotificationPriority,
} from "../../models/Notification";

import {
  writeAuditLog,
} from "../../utils/audit";

import {
  finalizeAfterCorroboration,
} from "../selfAssessments/assessmentScoring.service";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface CreatePendingInput {
  selfAssessmentId: string;
  organizationId?: string;
}

interface ListInput {
  managerId: string;
  organizationId?: string;
}

interface ReviewDecision {
  responseId: string;
  finalLevel: number;
  decision:
    | ManagerCorroborationDecision.CONFIRMED
    | ManagerCorroborationDecision.ADJUSTED;
  justification?: string;
}

interface ReviewInput {
  corroborationId: string;
  managerId: string;
  organizationId?: string;
  decisions: ReviewDecision[];
  ipAddress?: string;
  userAgent?: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function toObjectId(
  value: string,
  name: string
) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(
      `Invalid ${name}`
    );
  }

  return new mongoose.Types.ObjectId(value);
}

function normalizeOrganizationId(
  organizationId?: string
) {
  if (!organizationId) {
    return undefined;
  }

  return toObjectId(
    organizationId,
    "organizationId"
  );
}

/* -------------------------------------------------------------------------- */
/* Create Pending                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Creates the manager corroboration record after
 * a staff self-assessment requiring corroboration
 * has been submitted.
 */
export async function createPendingCorroborationForSubmittedAssessment(
  selfAssessmentId: string,
  organizationId?: string
) {
  const assessment = await SelfAssessment.findById(selfAssessmentId);

  if (!assessment) throw new Error("Self-assessment not found");
  if (assessment.status !== SelfAssessmentStatus.SUBMITTED) {
    throw new Error("Only submitted self-assessments can be sent for corroboration");
  }
  if (!assessment.corroborationRequired) {
    throw new Error("This self-assessment does not require manager corroboration");
  }

  const candidate = await User.findById(assessment.candidateId).select(
    "_id firstName lastName email role managerId organizationId isActive"
  );

  if (!candidate) throw new Error("Candidate not found");
  if (candidate.role !== UserRole.STAFF) throw new Error("Only staff assessments can require manager corroboration");
  if (!candidate.isActive) throw new Error("The candidate account is inactive");
  if (!candidate.managerId) throw new Error("The candidate does not have a manager assigned");

  const requestOrganizationId = normalizeOrganizationId(organizationId);
  if (requestOrganizationId && candidate.organizationId && !sameId(requestOrganizationId, candidate.organizationId)) {
    throw new Error("Candidate does not belong to the requested organization");
  }
  if (assessment.organizationId && candidate.organizationId && !sameId(assessment.organizationId, candidate.organizationId)) {
    throw new Error("Self-assessment organization does not match the candidate organization");
  }

  const manager = await User.findById(candidate.managerId).select(
    "_id role organizationId isActive"
  );
  if (!manager) throw new Error("Assigned manager not found");
  if (manager.role !== UserRole.MANAGER) throw new Error("The candidate's assigned user is not a manager");
  if (!manager.isActive) throw new Error("The candidate's manager account is inactive");
  if (candidate.organizationId && manager.organizationId && !sameId(candidate.organizationId, manager.organizationId)) {
    throw new Error("Candidate and manager must belong to the same organization");
  }

  const organization = assessment.organizationId ?? candidate.organizationId ?? requestOrganizationId;

  const existing = await ManagerCorroboration.findOne({ selfAssessmentId: assessment._id });
  if (existing) {
    if (!sameId(existing.candidateId, candidate._id) || !sameId(existing.managerId, manager._id)) {
      throw new Error("Existing corroboration record does not match the current candidate-manager relationship");
    }
    if (existing.status === ManagerCorroborationStatus.COMPLETED) return existing;
    return existing;
  }

  const corroboration = await ManagerCorroboration.create({
    selfAssessmentId: assessment._id,
    candidateId: candidate._id,
    managerId: manager._id,
    organizationId: organization,
    status: ManagerCorroborationStatus.PENDING,
  });

  try {
    await Notification.create({
      userId: manager._id,
      organizationId: organization,
      type: "MANAGER_CORROBORATION_PENDING",
      title: "Self-assessment awaiting corroboration",
      message: `${candidate.firstName} ${candidate.lastName}'s self-assessment is ready for your review.`,
      priority: NotificationPriority.HIGH,
      entityType: "ManagerCorroboration",
      entityId: corroboration._id,
      isRead: false,
    });
  } catch {
    // Notification failure must not invalidate the corroboration record.
  }

  return corroboration;
}

function sameId(
  a?: mongoose.Types.ObjectId | null,
  b?: mongoose.Types.ObjectId | null
): boolean {
  return Boolean(a && b && a.toString() === b.toString());
}

/* -------------------------------------------------------------------------- */
/* Pending                                                                    */
/* -------------------------------------------------------------------------- */

export async function getPendingManagerCorroborations(
  input: ListInput
) {
  const filter: Record<string, unknown> = {
    managerId: toObjectId(
      input.managerId,
      "managerId"
    ),
    status:
      ManagerCorroborationStatus.PENDING,
  };

  const organizationId =
    normalizeOrganizationId(
      input.organizationId
    );

  if (organizationId) {
    filter.organizationId =
      organizationId;
  }

  return ManagerCorroboration.find(
    filter
  )
    .populate(
      "candidateId",
      "firstName lastName email jobTitle department"
    )
    .populate(
      "selfAssessmentId",
      "roleProfileId status startedAt submittedAt dueAt frameworkVersionId"
    )
    .sort({
      createdAt: 1,
    })
    .lean();
}

/* -------------------------------------------------------------------------- */
/* Mine                                                                      */
/* -------------------------------------------------------------------------- */

export async function getManagerCorroborations(
  input: ListInput
) {
  const filter: Record<string, unknown> = {
    managerId: toObjectId(
      input.managerId,
      "managerId"
    ),
  };

  const organizationId =
    normalizeOrganizationId(
      input.organizationId
    );

  if (organizationId) {
    filter.organizationId =
      organizationId;
  }

  return ManagerCorroboration.find(
    filter
  )
    .populate(
      "candidateId",
      "firstName lastName email jobTitle department"
    )
    .populate(
      "selfAssessmentId",
      "roleProfileId status startedAt submittedAt dueAt frameworkVersionId"
    )
    .sort({
      createdAt: -1,
    })
    .lean();
}

/* -------------------------------------------------------------------------- */
/* Get One                                                                    */
/* -------------------------------------------------------------------------- */

export async function getManagerCorroboration(
  id: string,
  managerId: string,
  organizationId?: string
) {
  const filter: Record<string, unknown> = {
    _id: toObjectId(
      id,
      "corroborationId"
    ),
    managerId: toObjectId(
      managerId,
      "managerId"
    ),
  };

  const organizationObjectId =
    normalizeOrganizationId(
      organizationId
    );

  if (organizationObjectId) {
    filter.organizationId =
      organizationObjectId;
  }

  const corroboration =
    await ManagerCorroboration.findOne(
      filter
    )
      .populate(
        "candidateId",
        "firstName lastName email jobTitle department managerId"
      )
      .populate(
        "selfAssessmentId",
        "roleProfileId status startedAt submittedAt dueAt frameworkVersionId corroborationRequired"
      )
      .lean();

  if (!corroboration) {
    throw new Error(
      "Corroboration record not found"
    );
  }

  const assessment =
    await SelfAssessment.findById(
      corroboration.selfAssessmentId
    ).lean();

  if (!assessment) {
    throw new Error(
      "Self-assessment not found"
    );
  }

  if (!assessment.corroborationRequired) {
    throw new Error(
      "This self-assessment does not require manager corroboration"
    );
  }

  const candidate = await User.findById(
    corroboration.candidateId
  ).select(
    "_id role managerId organizationId isActive"
  );

  const manager = await User.findById(
    corroboration.managerId
  ).select(
    "_id role organizationId isActive"
  );

  if (
    !candidate ||
    candidate.role !== UserRole.STAFF ||
    !candidate.isActive
  ) {
    throw new Error(
      "Candidate not found or inactive"
    );
  }

  if (
    !manager ||
    manager.role !== UserRole.MANAGER ||
    !manager.isActive
  ) {
    throw new Error(
      "Manager not found or inactive"
    );
  }

  if (
    !sameId(
      candidate.managerId,
      manager._id
    )
  ) {
    throw new Error(
      "The corroboration manager is not the candidate's assigned manager"
    );
  }

  if (
    assessment.organizationId &&
    candidate.organizationId &&
    !sameId(
      assessment.organizationId,
      candidate.organizationId
    )
  ) {
    throw new Error(
      "Self-assessment organization does not match the candidate organization"
    );
  }

  if (
    candidate.organizationId &&
    manager.organizationId &&
    !sameId(
      candidate.organizationId,
      manager.organizationId
    )
  ) {
    throw new Error(
      "Manager and candidate must belong to the same organization"
    );
  }

  const responses =
    await SelfAssessmentResponse.find({
      selfAssessmentId:
        assessment._id,
    })
      .sort({
        createdAt: 1,
      })
      .lean();

  return {
    corroboration,
    selfAssessment:
      assessment,
    responses,
  };
}

/* -------------------------------------------------------------------------- */
/* Review                                                                     */
/* -------------------------------------------------------------------------- */

export async function reviewManagerCorroboration(
  input: ReviewInput
) {
  if (!Array.isArray(input.decisions) || input.decisions.length === 0) {
    throw new Error("At least one corroboration decision is required");
  }

  const managerId = toObjectId(input.managerId, "managerId");
  const organizationId = normalizeOrganizationId(input.organizationId);

  const filter: Record<string, unknown> = {
    _id: toObjectId(input.corroborationId, "corroborationId"),
    managerId,
    status: ManagerCorroborationStatus.PENDING,
  };
  if (organizationId) filter.organizationId = organizationId;

  const corroboration = await ManagerCorroboration.findOne(filter);
  if (!corroboration) throw new Error("Pending corroboration not found or access denied");

  const manager = await User.findById(managerId).select("_id role organizationId isActive");
  if (!manager || manager.role !== UserRole.MANAGER || !manager.isActive) {
    throw new Error("Manager not found or inactive");
  }

  const assessment = await SelfAssessment.findById(corroboration.selfAssessmentId);
  if (!assessment) throw new Error("Self-assessment not found");
  if (assessment.status !== SelfAssessmentStatus.SUBMITTED) {
    throw new Error("Only submitted self-assessments can be corroborated");
  }
  if (!assessment.corroborationRequired) {
    throw new Error("This self-assessment does not require manager corroboration");
  }

  const candidate = await User.findById(corroboration.candidateId).select(
    "_id role managerId organizationId isActive firstName lastName"
  );
  if (!candidate || candidate.role !== UserRole.STAFF || !candidate.isActive) {
    throw new Error("Candidate not found or inactive");
  }
  if (!sameId(candidate.managerId, manager._id)) {
    throw new Error("You are not the assigned manager for this candidate");
  }
  if (assessment.candidateId.toString() !== candidate._id.toString()) {
    throw new Error("Corroboration candidate does not match the self-assessment");
  }
  if (assessment.organizationId && candidate.organizationId && !sameId(assessment.organizationId, candidate.organizationId)) {
    throw new Error("Self-assessment organization does not match the candidate organization");
  }
  if (candidate.organizationId && manager.organizationId && !sameId(candidate.organizationId, manager.organizationId)) {
    throw new Error("Manager and candidate must belong to the same organization");
  }
  if (corroboration.organizationId && candidate.organizationId && !sameId(corroboration.organizationId, candidate.organizationId)) {
    throw new Error("Corroboration organization does not match the candidate organization");
  }

  const responses = await SelfAssessmentResponse.find({ selfAssessmentId: assessment._id }).sort({ createdAt: 1 });
  if (responses.length === 0) throw new Error("No self-assessment responses found");

  const responseMap = new Map(responses.map((response) => [response._id.toString(), response]));
  const reviewedResponseIds = new Set<string>();

  for (const decision of input.decisions) {
    if (!Types.ObjectId.isValid(decision.responseId)) {
      throw new Error(`Invalid responseId: ${decision.responseId}`);
    }
    if (!Number.isInteger(decision.finalLevel) || decision.finalLevel < 1 || decision.finalLevel > 10) {
      throw new Error("Final level must be an integer between 1 and 10");
    }
    if (!responseMap.has(decision.responseId)) {
      throw new Error(`Response ${decision.responseId} does not belong to this self-assessment`);
    }
    if (reviewedResponseIds.has(decision.responseId)) {
      throw new Error(`Response ${decision.responseId} was reviewed more than once`);
    }
    reviewedResponseIds.add(decision.responseId);

    if (decision.decision !== ManagerCorroborationDecision.CONFIRMED && decision.decision !== ManagerCorroborationDecision.ADJUSTED) {
      throw new Error("Decision must be CONFIRMED or ADJUSTED");
    }

    const justification = decision.justification?.trim();
    if (decision.decision === ManagerCorroborationDecision.ADJUSTED && !justification) {
      throw new Error("Written justification is required when adjusting a level");
    }
    if (justification && justification.length > 5000) {
      throw new Error("Justification cannot exceed 5000 characters");
    }
  }

  if (reviewedResponseIds.size !== responses.length) {
    throw new Error("Every self-assessment response must be reviewed before submission");
  }

  const decisions = input.decisions.map((decision) => {
    const response = responseMap.get(decision.responseId)!;
    return {
      responseId: response._id,
      competencyType: response.skillId ? "SKILL" : "BEHAVIOURAL_FACTOR",
      competencyId: (response.skillId ?? response.behaviouralFactorId)!,
      selfAssessmentLevel: response.selectedLevel,
      finalLevel: decision.finalLevel,
      decision: decision.decision,
      justification: decision.justification?.trim() || undefined,
    };
  });

  // Save COMPLETED temporarily because the scoring service deliberately reads
  // the persisted completed decision set. If finalization fails, restore PENDING
  // so the manager can retry rather than leaving a false completed state.
  corroboration.decisions = decisions as any;
  corroboration.status = ManagerCorroborationStatus.COMPLETED;
  corroboration.completedAt = new Date();
  await corroboration.save();

  try {
    await finalizeAfterCorroboration(assessment._id.toString(), manager._id.toString());
  } catch (error) {
    corroboration.status = ManagerCorroborationStatus.PENDING;
    corroboration.decisions = [];
    corroboration.completedAt = undefined;
    await corroboration.save().catch(() => undefined);
    throw error;
  }

  await writeAuditLog(
    {
      user: {
        userId: manager._id.toString(),
        role: UserRole.MANAGER,
        organizationId: candidate.organizationId?.toString() ?? input.organizationId,
      },
      ip: input.ipAddress,
      get: (header: string) => header.toLowerCase() === "user-agent" ? input.userAgent : undefined,
      headers: { "user-agent": input.userAgent ?? "" },
    } as any,
    "MANAGER_CORROBORATION_COMPLETED",
    "ManagerCorroboration",
    corroboration.id
  );

  try {
    await Notification.create({
      userId: candidate._id,
      organizationId: corroboration.organizationId,
      type: "MANAGER_CORROBORATION_COMPLETED",
      title: "Your assessment has been reviewed",
      message: "Your manager has completed the corroboration of your self-assessment.",
      priority: NotificationPriority.NORMAL,
      entityType: "ManagerCorroboration",
      entityId: corroboration._id,
      isRead: false,
    });
  } catch {
    // Notification failure must not fail a finalized assessment.
  }

  return {
    corroboration,
    decisions,
  };
}

