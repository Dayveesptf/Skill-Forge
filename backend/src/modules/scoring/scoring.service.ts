import { Types } from "mongoose";

import {
  Assessment,
  AssessmentStatus
} from "../../models/Assessment";

import {
  AssessmentAttempt,
  AssessmentAttemptStatus
} from "../../models/AssessmentAttempt";

import {
  AssessmentQuestion,
  AssessmentQuestionType
} from "../../models/AssessmentQuestion";

import {
  AssessmentResponse
} from "../../models/AssessmentResponse";

import {
  AssessmentEvaluation,
  AssessmentEvaluationStatus,
  PerformanceBand
} from "../../models/AssessmentEvaluation";

import {
  AssessmentScore,
  AssessmentScoringMethod
} from "../../models/AssessmentScore";

interface QuestionOptionForScoring {
  key: string;
  score?: number;
  isCorrect?: boolean;
}

interface QuestionForScoring {
  _id: Types.ObjectId;
  skillId?: Types.ObjectId;
  behaviouralFactorId?: Types.ObjectId;
  level?: number;
  type: AssessmentQuestionType;
  options?: QuestionOptionForScoring[];
  weight?: number;
}

interface ResponseForScoring {
  questionId: Types.ObjectId;
  selectedOptionKeys?: string[];
  textAnswer?: string;
}

interface QuestionCalculation {
  earnedPoints: number;
  possiblePoints: number;
  scoringMethod: AssessmentScoringMethod;
  pendingReason?: string;
}

interface SummaryAccumulator {
  earnedPoints: number;
  possiblePoints: number;
  questionCount: number;
}

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

function getOptionScore(
  option: QuestionOptionForScoring
): number {
  if (
    typeof option.score === "number" &&
    Number.isFinite(option.score)
  ) {
    return option.score;
  }

  return option.isCorrect ? 1 : 0;
}

function getWeight(question: QuestionForScoring): number {
  if (
    typeof question.weight === "number" &&
    Number.isFinite(question.weight) &&
    question.weight > 0
  ) {
    return question.weight;
  }

  return 1;
}

function getPerformanceBand(
  score: number
): PerformanceBand {
  if (score >= 90) {
    return PerformanceBand.EXCEPTIONAL;
  }

  if (score >= 75) {
    return PerformanceBand.STRONG;
  }

  if (score >= 60) {
    return PerformanceBand.DEVELOPING;
  }

  return PerformanceBand.NEEDS_IMPROVEMENT;
}

function calculateQuestionScore(
  question: QuestionForScoring,
  response?: ResponseForScoring
): QuestionCalculation {
  const weight = getWeight(question);

  const options = question.options ?? [];

  /*
   * Questions with no options are treated as free-text /
   * human-reviewed questions.
   */
  if (options.length === 0) {
    const possiblePoints = weight;

    /*
     * An unanswered question is automatically zero.
     * A supplied free-text answer requires manual review.
     */
    if (
      response?.textAnswer &&
      response.textAnswer.trim() !== ""
    ) {
      return {
        earnedPoints: 0,
        possiblePoints,
        scoringMethod: AssessmentScoringMethod.PENDING,
        pendingReason:
          "Free-text response requires human evaluation."
      };
    }

    return {
      earnedPoints: 0,
      possiblePoints,
      scoringMethod: AssessmentScoringMethod.AUTO
    };
  }

  const optionScores = new Map<string, number>();

  for (const option of options) {
    optionScores.set(
      option.key,
      getOptionScore(option)
    );
  }

  const positiveScores = options
    .map(getOptionScore)
    .filter((score) => score > 0);

  let maximumRawScore = 0;

  if (
    question.type ===
    AssessmentQuestionType.MULTIPLE_CHOICE
  ) {
    maximumRawScore = positiveScores.reduce(
      (total, score) => total + score,
      0
    );
  } else {
    maximumRawScore =
      positiveScores.length > 0
        ? Math.max(...positiveScores)
        : 1;
  }

  const selectedKeys =
    response?.selectedOptionKeys ?? [];

  let earnedRawScore = 0;

  if (
    question.type ===
    AssessmentQuestionType.MULTIPLE_CHOICE
  ) {
    const uniqueSelectedKeys = [
      ...new Set(selectedKeys)
    ];

    for (const key of uniqueSelectedKeys) {
      const score = optionScores.get(key);

      if (typeof score === "number") {
        earnedRawScore += score;
      }
    }
  } else {
    const selectedKey = selectedKeys[0];

    if (selectedKey) {
      earnedRawScore =
        optionScores.get(selectedKey) ?? 0;
    }
  }

  earnedRawScore = Math.max(
    0,
    Math.min(
      earnedRawScore,
      maximumRawScore
    )
  );

  return {
    earnedPoints:
      earnedRawScore * weight,

    possiblePoints:
      maximumRawScore * weight,

    scoringMethod:
      AssessmentScoringMethod.AUTO
  };
}

function percentage(
  earned: number,
  possible: number
): number {
  if (possible <= 0) {
    return 0;
  }

  return Number(
    Math.min(
      100,
      Math.max(
        0,
        (earned / possible) * 100
      )
    ).toFixed(2)
  );
}

export async function evaluateAssessmentAttempt(
  params: {
    attemptId: string;
    organizationId?: string;
  }
) {
  const attemptQuery: Record<string, unknown> = {
    _id: ensureObjectId(
      params.attemptId,
      "attemptId"
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
    throw new Error(
      "Assessment attempt not found"
    );
  }

  if (
    attempt.status !==
      AssessmentAttemptStatus.SUBMITTED &&
    attempt.status !==
      AssessmentAttemptStatus.EXPIRED
  ) {
    throw new Error(
      "Only submitted or expired attempts can be evaluated"
    );
  }

  /*
   * Evaluation is intentionally idempotent.
   * We never create duplicate evaluations for
   * the same attempt.
   */
  const existingEvaluation =
    await AssessmentEvaluation.findOne({
      attemptId: attempt._id
    });

  if (existingEvaluation) {
    return getEvaluationWithScores(
      existingEvaluation._id.toString()
    );
  }

  const assessment =
    await Assessment.findById(
      attempt.assessmentId
    );

  if (!assessment) {
    throw new Error(
      "Assessment not found"
    );
  }

  if (
    assessment.status !==
      AssessmentStatus.PUBLISHED &&
    attempt.status ===
      AssessmentAttemptStatus.SUBMITTED
  ) {
    throw new Error(
      "This assessment is not published"
    );
  }

  const questions =
    (await AssessmentQuestion.find({
      _id: {
        $in: attempt.questionOrder
      }
    })
      .select(
        [
          "_id",
          "skillId",
          "behaviouralFactorId",
          "level",
          "type",
          "options",
          "weight"
        ].join(" ")
      )
      .lean()) as unknown as QuestionForScoring[];

  const responses =
    (await AssessmentResponse.find({
      attemptId: attempt._id
    })
      .select(
        [
          "questionId",
          "selectedOptionKeys",
          "textAnswer"
        ].join(" ")
      )
      .lean()) as unknown as ResponseForScoring[];

  const questionMap =
    new Map<string, QuestionForScoring>();

  for (const question of questions) {
    questionMap.set(
      question._id.toString(),
      question
    );
  }

  const responseMap =
    new Map<string, ResponseForScoring>();

  for (const response of responses) {
    responseMap.set(
      response.questionId.toString(),
      response
    );
  }

  const skillSummary =
    new Map<string, SummaryAccumulator>();

  const behaviouralSummary =
    new Map<string, SummaryAccumulator>();

  const scoreDocuments: Record<string, unknown>[] =
    [];

  let earnedPoints = 0;
  let scorablePoints = 0;
  let pendingPoints = 0;
  let totalPossiblePoints = 0;

  let scoredQuestions = 0;
  let pendingQuestions = 0;

  for (const questionId of attempt.questionOrder) {
    const question =
      questionMap.get(
        questionId.toString()
      );

    if (!question) {
      continue;
    }

    const response =
      responseMap.get(
        question._id.toString()
      );

    const calculation =
      calculateQuestionScore(
        question,
        response
      );

    totalPossiblePoints +=
      calculation.possiblePoints;

    if (
      calculation.scoringMethod ===
      AssessmentScoringMethod.AUTO
    ) {
      earnedPoints +=
        calculation.earnedPoints;

      scorablePoints +=
        calculation.possiblePoints;

      scoredQuestions += 1;
    } else {
      pendingPoints +=
        calculation.possiblePoints;

      pendingQuestions += 1;
    }

    const questionPercentage =
      percentage(
        calculation.earnedPoints,
        calculation.possiblePoints
      );

    if (question.skillId) {
      const key =
        question.skillId.toString();

      const current =
        skillSummary.get(key) ?? {
          earnedPoints: 0,
          possiblePoints: 0,
          questionCount: 0
        };

      if (
        calculation.scoringMethod ===
        AssessmentScoringMethod.AUTO
      ) {
        current.earnedPoints +=
          calculation.earnedPoints;

        current.possiblePoints +=
          calculation.possiblePoints;
      }

      current.questionCount += 1;

      skillSummary.set(
        key,
        current
      );
    }

    if (
      question.behaviouralFactorId
    ) {
      const key =
        question.behaviouralFactorId.toString();

      const current =
        behaviouralSummary.get(key) ?? {
          earnedPoints: 0,
          possiblePoints: 0,
          questionCount: 0
        };

      if (
        calculation.scoringMethod ===
        AssessmentScoringMethod.AUTO
      ) {
        current.earnedPoints +=
          calculation.earnedPoints;

        current.possiblePoints +=
          calculation.possiblePoints;
      }

      current.questionCount += 1;

      behaviouralSummary.set(
        key,
        current
      );
    }

    scoreDocuments.push({
      organizationId:
        organizationId ??
        attempt.organizationId,

      attemptId: attempt._id,

      assessmentId:
        attempt.assessmentId,

      candidateId:
        attempt.candidateId,

      questionId:
        question._id,

      skillId:
        question.skillId,

      behaviouralFactorId:
        question.behaviouralFactorId,

      level:
        question.level,

      earnedPoints:
        calculation.earnedPoints,

      possiblePoints:
        calculation.possiblePoints,

      percentage:
        questionPercentage,

      weight:
        getWeight(question),

      scoringMethod:
        calculation.scoringMethod,

      selectedOptionKeys:
        response?.selectedOptionKeys,

      textAnswer:
        response?.textAnswer,

      pendingReason:
        calculation.pendingReason
    });
  }

  const overallScore =
    percentage(
      earnedPoints,
      scorablePoints
    );

  const evaluationStatus =
    pendingQuestions > 0
      ? AssessmentEvaluationStatus.PENDING_REVIEW
      : AssessmentEvaluationStatus.COMPLETED;

  let passed: boolean | undefined;

  if (
    evaluationStatus ===
      AssessmentEvaluationStatus.COMPLETED &&
    typeof assessment.passingScore ===
      "number"
  ) {
    passed =
      overallScore >=
      assessment.passingScore;
  }

  const skillScores =
    Array.from(
      skillSummary.entries()
    ).map(
      ([skillId, summary]) => ({
        skillId:
          new Types.ObjectId(skillId),

        earnedPoints:
          Number(
            summary.earnedPoints.toFixed(4)
          ),

        possiblePoints:
          Number(
            summary.possiblePoints.toFixed(4)
          ),

        percentage:
          percentage(
            summary.earnedPoints,
            summary.possiblePoints
          ),

        questionCount:
          summary.questionCount
      })
    );

  const behaviouralFactorScores =
    Array.from(
      behaviouralSummary.entries()
    ).map(
      ([behaviouralFactorId, summary]) => ({
        behaviouralFactorId:
          new Types.ObjectId(
            behaviouralFactorId
          ),

        earnedPoints:
          Number(
            summary.earnedPoints.toFixed(4)
          ),

        possiblePoints:
          Number(
            summary.possiblePoints.toFixed(4)
          ),

        percentage:
          percentage(
            summary.earnedPoints,
            summary.possiblePoints
          ),

        questionCount:
          summary.questionCount
      })
    );

  const evaluation =
    new AssessmentEvaluation({
      organizationId:
        organizationId ??
        attempt.organizationId,

      attemptId:
        attempt._id,

      assessmentId:
        attempt.assessmentId,

      candidateId:
        attempt.candidateId,

      status:
        evaluationStatus,

      totalQuestions:
        questions.length,

      answeredQuestions:
        responses.length,

      scoredQuestions,

      pendingQuestions,

      earnedPoints:
        Number(
          earnedPoints.toFixed(4)
        ),

      scorablePoints:
        Number(
          scorablePoints.toFixed(4)
        ),

      pendingPoints:
        Number(
          pendingPoints.toFixed(4)
        ),

      totalPossiblePoints:
        Number(
          totalPossiblePoints.toFixed(4)
        ),

      overallScore,

      passingScore:
        assessment.passingScore,

      passed,

      performanceBand:
        getPerformanceBand(
          overallScore
        ),

      skillScores,

      behaviouralFactorScores,

      evaluatedAt:
        new Date()
    });

  try {
    await evaluation.save();

    await AssessmentScore.insertMany(
      scoreDocuments.map(
        (score) => ({
          ...score,
          evaluationId:
            evaluation._id
        })
      )
    );
  } catch (error) {
    await AssessmentEvaluation.deleteOne({
      _id: evaluation._id
    });

    throw error;
  }

  return getEvaluationWithScores(
    evaluation._id.toString()
  );
}

export async function getEvaluationWithScores(
  evaluationId: string
) {
  const evaluation =
    await AssessmentEvaluation.findById(
      ensureObjectId(
        evaluationId,
        "evaluationId"
      )
    ).lean();

  if (!evaluation) {
    throw new Error(
      "Assessment evaluation not found"
    );
  }

  const scores =
    await AssessmentScore.find({
      evaluationId:
        evaluation._id
    })
      .sort({ createdAt: 1 })
      .lean();

  const assessment =
    await Assessment.findById(
      evaluation.assessmentId
    )
      .select(
        [
          "title",
          "description",
          "type",
          "passingScore",
          "showResultsImmediately"
        ].join(" ")
      )
      .lean();

  return {
    evaluation,
    assessment,
    scores
  };
}

export async function getAssessmentEvaluation(
  params: {
    attemptId: string;
    organizationId?: string;
    candidateId?: string;
  }
) {
  const query: Record<string, unknown> = {
    attemptId: ensureObjectId(
      params.attemptId,
      "attemptId"
    )
  };

  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (organizationId) {
    query.organizationId =
      organizationId;
  }

  if (params.candidateId) {
    query.candidateId =
      ensureObjectId(
        params.candidateId,
        "candidateId"
      );
  }

  const evaluation =
    await AssessmentEvaluation.findOne(
      query
    );

  if (!evaluation) {
    throw new Error(
      "Assessment evaluation not found"
    );
  }

  return getEvaluationWithScores(
    evaluation._id.toString()
  );
}

export async function listAssessmentEvaluations(
  params: {
    assessmentId: string;
    organizationId?: string;
    candidateId?: string;
  }
) {
  const query: Record<string, unknown> = {
    assessmentId: ensureObjectId(
      params.assessmentId,
      "assessmentId"
    )
  };

  const organizationId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (organizationId) {
    query.organizationId =
      organizationId;
  }

  if (params.candidateId) {
    query.candidateId =
      ensureObjectId(
        params.candidateId,
        "candidateId"
      );
  }

  return AssessmentEvaluation.find(
    query
  )
    .sort({
      evaluatedAt: -1
    })
    .lean();
}