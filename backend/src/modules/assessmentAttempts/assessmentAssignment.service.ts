import { Types } from "mongoose";

import {
  Assessment,
  AssessmentStatus
} from "../../models/Assessment";

import {
  AssessmentAssignment,
  AssessmentAssignmentStatus
} from "../../models/AssessmentAssignment";

import { User } from "../../models/User";

import { UserRole } from "../../constants/roles";

function ensureObjectId(
  value: string,
  fieldName: string
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} is invalid`);
  }

  return new Types.ObjectId(value);
}

function normalizeOrganizationId(
  organizationId?: string
): Types.ObjectId | undefined {
  if (!organizationId) {
    return undefined;
  }

  return ensureObjectId(organizationId, "organizationId");
}

async function getAssessmentOrThrow(
  assessmentId: string,
  organizationId?: string
) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(assessmentId, "assessmentId")
  };

  const orgId = normalizeOrganizationId(organizationId);

  if (orgId) {
    query.organizationId = orgId;
  }

  const assessment = await Assessment.findOne(query);

  if (!assessment) {
    throw new Error("Assessment not found");
  }

  return assessment;
}

async function getCandidateOrThrow(
  candidateId: string,
  organizationId?: string
) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(
      candidateId,
      "candidateId"
    ),
    role: UserRole.STAFF
  };

  const orgId = normalizeOrganizationId(
    organizationId
  );

  if (orgId) {
    query.organizationId = orgId;
  }

  const candidate =
    await User.findOne(query);

  if (!candidate) {
    throw new Error("Candidate not found. Assessments can only be assigned to staff accounts.");
  }

  return candidate;
}

export async function createAssessmentAssignment(params: {
  organizationId?: string;
  assessmentId: string;
  candidateId: string;
  assignedBy: string;
  dueAt?: Date;
  maxAttempts?: number;
  instructions?: string;
}) {
  const assessment = await getAssessmentOrThrow(
    params.assessmentId,
    params.organizationId
  );

  if (assessment.status !== AssessmentStatus.PUBLISHED) {
    throw new Error(
      "Only published assessments can be assigned"
    );
  }

  const candidate = await getCandidateOrThrow(
    params.candidateId,
    params.organizationId
  );

  const existingAssignment =
    await AssessmentAssignment.findOne({
      assessmentId: assessment._id,
      candidateId: candidate._id,
      status: {
        $nin: [
          AssessmentAssignmentStatus.CANCELLED,
          AssessmentAssignmentStatus.EXPIRED
        ]
      }
    });

  if (existingAssignment) {
    throw new Error(
      "This assessment is already assigned to the candidate"
    );
  }

  if (
    params.dueAt &&
    params.dueAt.getTime() <= Date.now()
  ) {
    throw new Error("dueAt must be in the future");
  }

  const maxAttempts =
    params.maxAttempts ?? assessment.maxAttempts;

  if (maxAttempts < 1) {
    throw new Error(
      "maxAttempts must be at least 1"
    );
  }

  if (maxAttempts > assessment.maxAttempts) {
    throw new Error(
      "Assignment maxAttempts cannot exceed the assessment maxAttempts"
    );
  }

  const organizationId =
    params.organizationId
      ? ensureObjectId(
          params.organizationId,
          "organizationId"
        )
      : undefined;

  const assignment =
    await AssessmentAssignment.create({
      organizationId,
      assessmentId: assessment._id,
      candidateId: candidate._id,
      assignedBy: ensureObjectId(
        params.assignedBy,
        "assignedBy"
      ),
      status: AssessmentAssignmentStatus.ASSIGNED,
      dueAt: params.dueAt,
      maxAttempts,
      instructions: params.instructions
    });

  return assignment;
}

export async function listAssessmentAssignments(params: {
  organizationId?: string;
  assessmentId?: string;
  candidateId?: string;
  status?: AssessmentAssignmentStatus;
}) {
  const query: Record<string, unknown> = {};

  const organizationId = normalizeOrganizationId(
    params.organizationId
  );

  if (organizationId) {
    query.organizationId = organizationId;
  }

  if (params.assessmentId) {
    query.assessmentId = ensureObjectId(
      params.assessmentId,
      "assessmentId"
    );
  }

  if (params.candidateId) {
    query.candidateId = ensureObjectId(
      params.candidateId,
      "candidateId"
    );
  }

  if (params.status) {
    query.status = params.status;
  }

  return AssessmentAssignment.find(query)
    .populate(
      "assessmentId",
      "title type status durationMinutes maxAttempts"
    )
    .populate(
      "candidateId",
      "firstName lastName email"
    )
    .sort({ createdAt: -1 });
}

export async function getAssessmentAssignment(
  assignmentId: string,
  params: {
    organizationId?: string;
    candidateId?: string;
  } = {}
) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(
      assignmentId,
      "assignmentId"
    )
  };

  const organizationId = normalizeOrganizationId(
    params.organizationId
  );

  if (organizationId) {
    query.organizationId = organizationId;
  }

  if (params.candidateId) {
    query.candidateId = ensureObjectId(
      params.candidateId,
      "candidateId"
    );
  }

  const assignment =
    await AssessmentAssignment.findOne(query)
      .populate(
        "assessmentId",
        "title description type status instructions durationMinutes maxAttempts randomizeQuestions randomizeOptions showResultsImmediately"
      )
      .populate(
        "candidateId",
        "firstName lastName email"
      );

  if (!assignment) {
    throw new Error("Assessment assignment not found");
  }

  return assignment;
}

export async function cancelAssessmentAssignment(
  assignmentId: string,
  organizationId?: string
) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(
      assignmentId,
      "assignmentId"
    )
  };

  const orgId = normalizeOrganizationId(
    organizationId
  );

  if (orgId) {
    query.organizationId = orgId;
  }

  const assignment =
    await AssessmentAssignment.findOne(query);

  if (!assignment) {
    throw new Error("Assessment assignment not found");
  }

  if (
    assignment.status ===
      AssessmentAssignmentStatus.COMPLETED ||
    assignment.status ===
      AssessmentAssignmentStatus.STARTED
  ) {
    throw new Error(
      "A started or completed assignment cannot be cancelled"
    );
  }

  assignment.status =
    AssessmentAssignmentStatus.CANCELLED;

  await assignment.save();

  return assignment;
}