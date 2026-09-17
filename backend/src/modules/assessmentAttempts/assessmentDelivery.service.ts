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
  AssessmentQuestion
} from "../../models/AssessmentQuestion";

import {
  AssessmentResponse
} from "../../models/AssessmentResponse";

interface DeliveryQuestionOption {
  key: string;
  text: string;
}

interface DeliveryQuestion {
  id: Types.ObjectId;
  sectionId?: Types.ObjectId;
  question: string;
  scenario?: string;
  type: string;
  difficulty: string;
  level?: number;
  isRequired: boolean;
  order: number;
  options: DeliveryQuestionOption[];
  response: {
    selectedOptionKeys?: string[];
    textAnswer?: string;
    answeredAt: Date;
  } | null;
}

interface DeliveryResponse {
  questionId: Types.ObjectId;
  selectedOptionKeys?: string[];
  textAnswer?: string;
  answeredAt: Date;
}

function ensureObjectId(
  value: string,
  fieldName: string
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(
      `${fieldName} is invalid`
    );
  }

  return new Types.ObjectId(value);
}

export async function getCandidateAssessmentDelivery(
  attemptId: string,
  candidateId: string,
  organizationId?: string
) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(
      attemptId,
      "attemptId"
    ),

    candidateId: ensureObjectId(
      candidateId,
      "candidateId"
    )
  };

  if (organizationId) {
    query.organizationId =
      ensureObjectId(
        organizationId,
        "organizationId"
      );
  }

  const attempt =
    await AssessmentAttempt.findOne(query);

  if (!attempt) {
    throw new Error(
      "Assessment attempt not found"
    );
  }

  /*
   * Automatically expire an attempt whose timer
   * has elapsed.
   */
  if (
    attempt.status ===
      AssessmentAttemptStatus.IN_PROGRESS &&
    attempt.expiresAt &&
    attempt.expiresAt.getTime() <= Date.now()
  ) {
    attempt.status =
      AssessmentAttemptStatus.EXPIRED;

    await attempt.save();
  }

  const assessment =
    await Assessment.findById(
      attempt.assessmentId
    ).select(
      [
        "title",
        "description",
        "type",
        "instructions",
        "durationMinutes",
        "showResultsImmediately",
        "status"
      ].join(" ")
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
      AssessmentAttemptStatus.IN_PROGRESS
  ) {
    throw new Error(
      "This assessment is no longer available"
    );
  }

  const questions =
    await AssessmentQuestion.find({
      _id: {
        $in: attempt.questionOrder
      }
    })
      .select(
        [
          "_id",
          "sectionId",
          "question",
          "scenario",
          "type",
          "difficulty",
          "level",
          "options",
          "order",
          "isRequired"
        ].join(" ")
      )
      .lean();

  const questionMap =
    new Map<string, (typeof questions)[number]>();

  for (const question of questions) {
    questionMap.set(
      question._id.toString(),
      question
    );
  }

  const responses =
    await AssessmentResponse.find({
      attemptId: attempt._id
    })
      .select(
        [
          "questionId",
          "selectedOptionKeys",
          "textAnswer",
          "answeredAt"
        ].join(" ")
      )
      .lean();

  const responseMap =
    new Map<string, DeliveryResponse>();

  for (const response of responses) {
    responseMap.set(
      response.questionId.toString(),
      {
        questionId:
          response.questionId,
        selectedOptionKeys:
          response.selectedOptionKeys,
        textAnswer:
          response.textAnswer,
        answeredAt:
          response.answeredAt
      }
    );
  }

  const orderedQuestions: DeliveryQuestion[] =
    [];

  for (
    const questionId of attempt.questionOrder
  ) {
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

    const options: DeliveryQuestionOption[] =
      (question.options ?? []).map(
        (option) => ({
          key: option.key,
          text: option.text
        })
      );

    orderedQuestions.push({
      id: question._id,

      sectionId:
        question.sectionId,

      question:
        question.question,

      scenario:
        question.scenario,

      type:
        question.type,

      difficulty:
        question.difficulty,

      level:
        question.level,

      isRequired:
        question.isRequired,

      order:
        question.order,

      options,

      response: response
        ? {
            selectedOptionKeys:
              response.selectedOptionKeys,

            textAnswer:
              response.textAnswer,

            answeredAt:
              response.answeredAt
          }
        : null
    });
  }

  return {
    attempt: {
      id: attempt._id,

      attemptNumber:
        attempt.attemptNumber,

      status:
        attempt.status,

      startedAt:
        attempt.startedAt,

      expiresAt:
        attempt.expiresAt,

      currentQuestionIndex:
        attempt.currentQuestionIndex
    },

    assessment: {
      id: assessment._id,

      title:
        assessment.title,

      description:
        assessment.description,

      type:
        assessment.type,

      instructions:
        assessment.instructions,

      durationMinutes:
        assessment.durationMinutes,

      showResultsImmediately:
        assessment.showResultsImmediately
    },

    questions:
      orderedQuestions,

    progress: {
      totalQuestions:
        orderedQuestions.length,

      answeredQuestions:
        responses.length,

      unansweredQuestions:
        Math.max(
          orderedQuestions.length -
            responses.length,
          0
        )
    }
  };
}