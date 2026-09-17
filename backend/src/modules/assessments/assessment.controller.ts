import { Response } from "express";

import { AuthenticatedRequest } from "../../middleware/auth";

import { UserRole } from "../../constants/roles";

import { writeAuditLog } from "../../utils/audit";

import {
  AssessmentStatus,
  AssessmentType
} from "../../models/Assessment";

import {
  AssessmentQuestionType,
  QuestionDifficulty
} from "../../models/AssessmentQuestion";

import {
  archiveAssessment,
  createAssessment,
  createAssessmentQuestion,
  createAssessmentSection,
  deleteAssessmentQuestion,
  getAssessment,
  listAssessmentQuestions,
  listAssessmentSections,
  listAssessments,
  publishAssessment,
  updateAssessment,
  updateAssessmentQuestion
} from "./assessment.service";

function getRouteParam(
  value: string | string[] | undefined,
  paramName: string
): string {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(`${paramName} is required`);
  }

  return value;
}

function getQueryString(
  value: unknown
): string | undefined {
  return typeof value === "string"
    ? value
    : undefined;
}

function getOrganizationId(
  req: AuthenticatedRequest
): string | undefined {
  if (
    req.user?.role ===
    UserRole.PLATFORM_ADMIN
  ) {
    return getQueryString(
      req.query.organizationId
    );
  }

  return req.user?.organizationId;
}

/* =========================================================
   ASSESSMENTS
========================================================= */

export async function create(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessment =
      await createAssessment(
        getOrganizationId(req),
        req.user!.userId,
        {
          title: req.body.title,
          description:
            req.body.description,
          frameworkVersionId:
            req.body.frameworkVersionId,
          industryTemplateId:
            req.body.industryTemplateId,
          type:
            req.body.type as AssessmentType,
          instructions:
            req.body.instructions,
          durationMinutes:
            req.body.durationMinutes,
          passingScore:
            req.body.passingScore,
          maxAttempts:
            req.body.maxAttempts,
          randomizeQuestions:
            req.body.randomizeQuestions,
          randomizeOptions:
            req.body.randomizeOptions,
          showResultsImmediately:
            req.body.showResultsImmediately
        }
      );

    await writeAuditLog(
      req,
      "ASSESSMENT_CREATED",
      "Assessment",
      String(assessment._id),
      {
        title: assessment.title
      }
    );

    res.status(201).json({
      success: true,
      data: assessment
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function list(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const data =
      await listAssessments(
        getOrganizationId(req),
        {
          status:
            getQueryString(
              req.query.status
            ) as
              | AssessmentStatus
              | undefined,

          type:
            getQueryString(
              req.query.type
            ) as
              | AssessmentType
              | undefined,

          frameworkVersionId:
            getQueryString(
              req.query.frameworkVersionId
            ),

          search:
            getQueryString(
              req.query.search
            ),

          page: Number(
            req.query.page || 1
          ),

          limit: Number(
            req.query.limit || 25
          )
        }
      );

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function getOne(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.id,
        "id"
      );

    const data =
      await getAssessment(
        assessmentId,
        getOrganizationId(req)
      );

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
}

export async function update(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.id,
        "id"
      );

    const assessment =
      await updateAssessment(
        assessmentId,
        getOrganizationId(req),
        req.user!.userId,
        req.body
      );

    await writeAuditLog(
      req,
      "ASSESSMENT_UPDATED",
      "Assessment",
      assessmentId,
      {
        changedFields:
          Object.keys(req.body)
      }
    );

    res.json({
      success: true,
      data: assessment
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function publish(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.id,
        "id"
      );

    const assessment =
      await publishAssessment(
        assessmentId,
        getOrganizationId(req)
      );

    await writeAuditLog(
      req,
      "ASSESSMENT_PUBLISHED",
      "Assessment",
      assessmentId
    );

    res.json({
      success: true,
      data: assessment
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function archive(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.id,
        "id"
      );

    const assessment =
      await archiveAssessment(
        assessmentId,
        getOrganizationId(req)
      );

    await writeAuditLog(
      req,
      "ASSESSMENT_ARCHIVED",
      "Assessment",
      assessmentId
    );

    res.json({
      success: true,
      data: assessment
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/* =========================================================
   SECTIONS
========================================================= */

export async function createSection(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.id,
        "id"
      );

    const section =
      await createAssessmentSection(
        assessmentId,
        getOrganizationId(req),
        req.body
      );

    await writeAuditLog(
      req,
      "ASSESSMENT_SECTION_CREATED",
      "AssessmentSection",
      String(section._id),
      {
        assessmentId
      }
    );

    res.status(201).json({
      success: true,
      data: section
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function listSections(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.id,
        "id"
      );

    const sections =
      await listAssessmentSections(
        assessmentId,
        getOrganizationId(req)
      );

    res.json({
      success: true,
      data: sections
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

/* =========================================================
   QUESTIONS
========================================================= */

export async function createAssessmentQuestionHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.id,
        "id"
      );

    const question =
      await createAssessmentQuestion(
        assessmentId,
        getOrganizationId(req),
        {
          ...req.body,

          type:
            req.body.type as
              | AssessmentQuestionType
              | undefined,

          difficulty:
            req.body.difficulty as
              | QuestionDifficulty
              | undefined
        }
      );

    await writeAuditLog(
      req,
      "QUESTION_CREATED",
      "AssessmentQuestion",
      String(question._id),
      {
        assessmentId
      }
    );

    res.status(201).json({
      success: true,
      data: question
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function listQuestions(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.id,
        "id"
      );

    const questions =
      await listAssessmentQuestions(
        assessmentId,
        getOrganizationId(req)
      );

    res.json({
      success: true,
      data: questions
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function updateQuestion(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.id,
        "id"
      );

    const questionId =
      getRouteParam(
        req.params.questionId,
        "questionId"
      );

    const question =
      await updateAssessmentQuestion(
        assessmentId,
        questionId,
        getOrganizationId(req),
        req.body
      );

    await writeAuditLog(
      req,
      "QUESTION_UPDATED",
      "AssessmentQuestion",
      questionId,
      {
        assessmentId,
        changedFields:
          Object.keys(req.body)
      }
    );

    res.json({
      success: true,
      data: question
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function deleteQuestion(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const assessmentId =
      getRouteParam(
        req.params.id,
        "id"
      );

    const questionId =
      getRouteParam(
        req.params.questionId,
        "questionId"
      );

    const question =
      await deleteAssessmentQuestion(
        assessmentId,
        questionId,
        getOrganizationId(req)
      );

    await writeAuditLog(
      req,
      "QUESTION_DELETED",
      "AssessmentQuestion",
      questionId,
      {
        assessmentId
      }
    );

    res.json({
      success: true,
      data: question
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}