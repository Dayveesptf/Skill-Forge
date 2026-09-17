import { Types } from "mongoose";

import {
  Assessment,
  AssessmentStatus
} from "../../models/Assessment";

import {
  AssessmentAssignment,
  AssessmentAssignmentStatus
} from "../../models/AssessmentAssignment";

import {
  AssessmentAttempt,
  AssessmentAttemptStatus
} from "../../models/AssessmentAttempt";

import {
  AssessmentQuestion
} from "../../models/AssessmentQuestion";

import {
  AssessmentResponse
} from "../../models/AssessmentResponse";

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

  return ensureObjectId(
    organizationId,
    "organizationId"
  );
}

async function getAssignmentOrThrow(params: {
  assignmentId: string;
  candidateId?: string;
  organizationId?: string;
}) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(
      params.assignmentId,
      "assignmentId"
    )
  };

  if (params.candidateId) {
    query.candidateId = ensureObjectId(
      params.candidateId,
      "candidateId"
    );
  }

  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (organizationId) {
    query.organizationId = organizationId;
  }

  const assignment =
    await AssessmentAssignment.findOne(query);

  if (!assignment) {
    throw new Error(
      "Assessment assignment not found"
    );
  }

  return assignment;
}

async function getAssessmentOrThrow(
  assessmentId: Types.ObjectId
) {
  const assessment = await Assessment.findById(
    assessmentId
  );

  if (!assessment) {
    throw new Error("Assessment not found");
  }

  return assessment;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (
    let index = result.length - 1;
    index > 0;
    index--
  ) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1)
    );

    [result[index], result[randomIndex]] = [
      result[randomIndex],
      result[index]
    ];
  }

  return result;
}

async function expireAttemptIfNecessary(
  attempt: InstanceType<typeof AssessmentAttempt>
) {
  if (
    attempt.status ===
      AssessmentAttemptStatus.IN_PROGRESS &&
    attempt.expiresAt &&
    attempt.expiresAt.getTime() <= Date.now()
  ) {
    attempt.status =
      AssessmentAttemptStatus.EXPIRED;

    await attempt.save();

    return true;
  }

  return false;
}

export async function startAssessmentAttempt(params: {
  assignmentId: string;
  candidateId: string;
  organizationId?: string;
}) {
  const assignment =
    await getAssignmentOrThrow(params);

  if (
    assignment.status ===
    AssessmentAssignmentStatus.CANCELLED
  ) {
    throw new Error(
      "This assessment assignment has been cancelled"
    );
  }

  if (
    assignment.status ===
    AssessmentAssignmentStatus.COMPLETED
  ) {
    throw new Error(
      "This assessment has already been completed"
    );
  }

  if (
    assignment.dueAt &&
    assignment.dueAt.getTime() <= Date.now()
  ) {
    assignment.status =
      AssessmentAssignmentStatus.EXPIRED;

    await assignment.save();

    throw new Error(
      "This assessment assignment has expired"
    );
  }

  const assessment = await getAssessmentOrThrow(
    assignment.assessmentId
  );

  if (
    assessment.status !==
    AssessmentStatus.PUBLISHED
  ) {
    throw new Error(
      "This assessment is no longer available"
    );
  }

  const existingAttempt =
    await AssessmentAttempt.findOne({
      assignmentId: assignment._id,
      candidateId: assignment.candidateId,
      status:
        AssessmentAttemptStatus.IN_PROGRESS
    });

  if (existingAttempt) {
    const expired =
      await expireAttemptIfNecessary(
        existingAttempt
      );

    if (!expired) {
      return {
        attempt: existingAttempt,
        resumed: true
      };
    }
  }

  const attemptCount =
    await AssessmentAttempt.countDocuments({
      assignmentId: assignment._id,
      candidateId: assignment.candidateId,
      status: {
        $in: [
          AssessmentAttemptStatus.SUBMITTED,
          AssessmentAttemptStatus.EXPIRED,
          AssessmentAttemptStatus.IN_PROGRESS
        ]
      }
    });

  if (attemptCount >= assignment.maxAttempts) {
    throw new Error(
      "Maximum number of attempts has been reached"
    );
  }

  const questions =
    await AssessmentQuestion.find({
      assessmentId: assessment._id
    })
      .select("_id order")
      .sort({ order: 1 });

  if (questions.length === 0) {
    throw new Error(
      "This assessment has no questions"
    );
  }

  let questionOrder = questions.map(
    (question) => question._id
  );

  if (assessment.randomizeQuestions) {
    questionOrder = shuffle(questionOrder);
  }

  const attemptNumber = attemptCount + 1;

  const startedAt = new Date();

  let expiresAt: Date | undefined;

  if (assessment.durationMinutes) {
    expiresAt = new Date(
      startedAt.getTime() +
        assessment.durationMinutes * 60 * 1000
    );

    if (
      assignment.dueAt &&
      assignment.dueAt.getTime() < expiresAt.getTime()
    ) {
      expiresAt = assignment.dueAt;
    }
  } else if (assignment.dueAt) {
    expiresAt = assignment.dueAt;
  }

  const attempt =
    await AssessmentAttempt.create({
      organizationId:
        assignment.organizationId,
      assignmentId: assignment._id,
      assessmentId: assessment._id,
      candidateId: assignment.candidateId,
      attemptNumber,
      status:
        AssessmentAttemptStatus.IN_PROGRESS,
      startedAt,
      expiresAt,
      questionOrder
    });

  assignment.status =
    AssessmentAssignmentStatus.STARTED;

  if (!assignment.startedAt) {
    assignment.startedAt = startedAt;
  }

  await assignment.save();

  return {
    attempt,
    resumed: false
  };
}

export async function getCandidateAttempt(
  attemptId: string,
  params: {
    candidateId: string;
    organizationId?: string;
  }
) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(
      attemptId,
      "attemptId"
    ),
    candidateId: ensureObjectId(
      params.candidateId,
      "candidateId"
    )
  };

  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (organizationId) {
    query.organizationId = organizationId;
  }

  const attempt =
    await AssessmentAttempt.findOne(query);

  if (!attempt) {
    throw new Error("Assessment attempt not found");
  }

  await expireAttemptIfNecessary(attempt);

  return attempt;
}

export async function saveAssessmentResponse(params: {
  attemptId: string;
  candidateId: string;
  questionId: string;
  selectedOptionKeys?: string[];
  textAnswer?: string;
  organizationId?: string;
}) {
  const attemptQuery: Record<string, unknown> = {
    _id: ensureObjectId(
      params.attemptId,
      "attemptId"
    ),
    candidateId: ensureObjectId(
      params.candidateId,
      "candidateId"
    )
  };

  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (organizationId) {
    attemptQuery.organizationId =
      organizationId;
  }

  const attempt =
    await AssessmentAttempt.findOne(
      attemptQuery
    );

  if (!attempt) {
    throw new Error("Assessment attempt not found");
  }

  const expired =
    await expireAttemptIfNecessary(attempt);

  if (expired) {
    throw new Error(
      "This assessment attempt has expired"
    );
  }

  if (
    attempt.status !==
    AssessmentAttemptStatus.IN_PROGRESS
  ) {
    throw new Error(
      "This assessment attempt is no longer active"
    );
  }

  const questionId = ensureObjectId(
    params.questionId,
    "questionId"
  );

  const questionBelongsToAttempt =
    attempt.questionOrder.some(
      (id) => id.toString() === questionId.toString()
    );

  if (!questionBelongsToAttempt) {
    throw new Error(
      "This question does not belong to the assessment attempt"
    );
  }

  const question =
    await AssessmentQuestion.findOne({
      _id: questionId,
      assessmentId: attempt.assessmentId
    });

  if (!question) {
    throw new Error("Question not found");
  }

  const isChoiceQuestion = [
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "TRUE_FALSE"
  ].includes(question.type);

  if (
    isChoiceQuestion &&
    (!params.selectedOptionKeys ||
      params.selectedOptionKeys.length === 0)
  ) {
    throw new Error(
      "An option must be selected for this question"
    );
  }

  if (
    question.type === "SINGLE_CHOICE" ||
    question.type === "TRUE_FALSE"
  ) {
    if (
      params.selectedOptionKeys &&
      params.selectedOptionKeys.length > 1
    ) {
      throw new Error(
        "Only one option can be selected"
      );
    }
  }

  if (
    params.selectedOptionKeys &&
    params.selectedOptionKeys.length > 0
  ) {
    const validOptionKeys =
      question.options.map(
        (option) => option.key
      );

    const invalidOptions =
      params.selectedOptionKeys.filter(
        (key) => !validOptionKeys.includes(key)
      );

    if (invalidOptions.length > 0) {
      throw new Error(
        "One or more selected options are invalid"
      );
    }
  }

  const response =
    await AssessmentResponse.findOneAndUpdate(
      {
        attemptId: attempt._id,
        questionId
      },
      {
        $set: {
          organizationId:
            attempt.organizationId,
          assessmentId:
            attempt.assessmentId,
          candidateId:
            attempt.candidateId,
          selectedOptionKeys:
            params.selectedOptionKeys,
          textAnswer: params.textAnswer,
          answeredAt: new Date()
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

  return response;
}

export async function listAttemptResponses(params: {
  attemptId: string;
  candidateId: string;
  organizationId?: string;
}) {
  const attemptQuery: Record<string, unknown> = {
    _id: ensureObjectId(
      params.attemptId,
      "attemptId"
    ),
    candidateId: ensureObjectId(
      params.candidateId,
      "candidateId"
    )
  };

  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (organizationId) {
    attemptQuery.organizationId =
      organizationId;
  }

  const attempt =
    await AssessmentAttempt.findOne(
      attemptQuery
    );

  if (!attempt) {
    throw new Error("Assessment attempt not found");
  }

  return AssessmentResponse.find({
    attemptId: attempt._id
  }).sort({ createdAt: 1 });
}

export async function submitAssessmentAttempt(params: {
  attemptId: string;
  candidateId: string;
  organizationId?: string;
}) {
  const attemptQuery: Record<string, unknown> = {
    _id: ensureObjectId(
      params.attemptId,
      "attemptId"
    ),
    candidateId: ensureObjectId(
      params.candidateId,
      "candidateId"
    )
  };

  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (organizationId) {
    attemptQuery.organizationId =
      organizationId;
  }

  const attempt =
    await AssessmentAttempt.findOne(
      attemptQuery
    );

  if (!attempt) {
    throw new Error("Assessment attempt not found");
  }

  if (
    attempt.status ===
    AssessmentAttemptStatus.SUBMITTED
  ) {
    return attempt;
  }

  if (
    attempt.status !==
    AssessmentAttemptStatus.IN_PROGRESS
  ) {
    throw new Error(
      "This assessment attempt cannot be submitted"
    );
  }

  if (
    attempt.expiresAt &&
    attempt.expiresAt.getTime() <= Date.now()
  ) {
    attempt.status =
      AssessmentAttemptStatus.EXPIRED;

    await attempt.save();

    throw new Error(
      "This assessment attempt has expired"
    );
  }

  attempt.status =
    AssessmentAttemptStatus.SUBMITTED;

  attempt.submittedAt = new Date();

  await attempt.save();

  const assignment =
    await AssessmentAssignment.findById(
      attempt.assignmentId
    );

  if (assignment) {
    assignment.status =
      AssessmentAssignmentStatus.COMPLETED;

    assignment.completedAt = new Date();

    await assignment.save();
  }

  return attempt;
}