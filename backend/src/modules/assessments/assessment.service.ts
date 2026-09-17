import mongoose, { Types } from "mongoose";

import {
  Assessment,
  AssessmentStatus,
  AssessmentType
} from "../../models/Assessment";

import { AssessmentSection } from "../../models/AssessmentSection";

import {
  AssessmentQuestion,
  AssessmentQuestionType,
  QuestionDifficulty
} from "../../models/AssessmentQuestion";

import { FrameworkVersion } from "../../models/FrameworkVersion";
import { Skill } from "../../models/Skill";
import { BehaviouralFactor } from "../../models/BehaviouralFactor";

function ensureObjectId(
  value: string,
  fieldName: string
): Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return new mongoose.Types.ObjectId(value);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

async function verifyFramework(
  frameworkVersionId: string,
  organizationId?: string
) {
  const frameworkId = ensureObjectId(
    frameworkVersionId,
    "frameworkVersionId"
  );

  const framework = await FrameworkVersion.findById(
    frameworkId
  );

  if (!framework) {
    throw new Error("Framework version not found");
  }

  if (
    organizationId &&
    framework.organizationId &&
    String(framework.organizationId) !== organizationId
  ) {
    throw new Error(
      "Framework version does not belong to this organization"
    );
  }

  return framework;
}

async function verifySkill(
  skillId: string,
  frameworkVersionId: string
) {
  const skill = await Skill.findById(
    ensureObjectId(skillId, "skillId")
  );

  if (!skill) {
    throw new Error("Skill not found");
  }

  if (
    String(skill.frameworkVersionId) !==
    String(frameworkVersionId)
  ) {
    throw new Error(
      "Skill does not belong to the selected framework version"
    );
  }

  return skill;
}

async function verifyBehaviouralFactor(
  behaviouralFactorId: string,
  frameworkVersionId: string
) {
  const factor = await BehaviouralFactor.findById(
    ensureObjectId(
      behaviouralFactorId,
      "behaviouralFactorId"
    )
  );

  if (!factor) {
    throw new Error("Behavioural factor not found");
  }

  if (
    String(factor.frameworkVersionId) !==
    String(frameworkVersionId)
  ) {
    throw new Error(
      "Behavioural factor does not belong to the selected framework version"
    );
  }

  return factor;
}

async function getAssessmentOrThrow(
  assessmentId: string,
  organizationId?: string
) {
  const assessment = await Assessment.findById(
    ensureObjectId(assessmentId, "assessmentId")
  );

  if (!assessment) {
    throw new Error("Assessment not found");
  }

  if (
    organizationId &&
    String(assessment.organizationId) !== organizationId
  ) {
    throw new Error(
      "Assessment does not belong to this organization"
    );
  }

  return assessment;
}

function assertEditableStatus(
  status: AssessmentStatus
) {
  if (
    status === AssessmentStatus.PUBLISHED ||
    status === AssessmentStatus.ARCHIVED
  ) {
    throw new Error(
      "Published or archived assessments cannot be modified"
    );
  }
}

/* =========================================================
   ASSESSMENTS
========================================================= */

export async function createAssessment(
  organizationId: string | undefined,
  userId: string,
  data: {
    title: string;
    description?: string;
    frameworkVersionId: string;
    industryTemplateId?: string;
    type?: AssessmentType;
    instructions?: string;
    durationMinutes?: number;
    passingScore?: number;
    maxAttempts?: number;
    randomizeQuestions?: boolean;
    randomizeOptions?: boolean;
    showResultsImmediately?: boolean;
  }
) {
  if (!data.title?.trim()) {
    throw new Error("Assessment title is required");
  }

  await verifyFramework(
    data.frameworkVersionId,
    organizationId
  );

  const slug = slugify(data.title);

  const existing = await Assessment.findOne({
    ...(organizationId
      ? {
          organizationId: normalizeOrganizationId(
            organizationId
          )
        }
      : {}),
    slug
  });

  if (existing) {
    throw new Error(
      "An assessment with this title already exists"
    );
  }

  const assessment = await Assessment.create({
    organizationId:
      normalizeOrganizationId(organizationId),

    frameworkVersionId: ensureObjectId(
      data.frameworkVersionId,
      "frameworkVersionId"
    ),

    industryTemplateId: data.industryTemplateId
      ? ensureObjectId(
          data.industryTemplateId,
          "industryTemplateId"
        )
      : undefined,

    title: data.title.trim(),

    slug,

    description: data.description?.trim(),

    type:
      data.type || AssessmentType.MIXED,

    status: AssessmentStatus.DRAFT,

    instructions: data.instructions?.trim(),

    durationMinutes: data.durationMinutes,

    passingScore:
      data.passingScore ?? 60,

    maxAttempts:
      data.maxAttempts ?? 1,

    randomizeQuestions:
      data.randomizeQuestions ?? false,

    randomizeOptions:
      data.randomizeOptions ?? false,

    showResultsImmediately:
      data.showResultsImmediately ?? false,

    createdBy: ensureObjectId(
      userId,
      "userId"
    )
  });

  return assessment;
}

export async function listAssessments(
  organizationId?: string,
  filters?: {
    status?: AssessmentStatus;
    type?: AssessmentType;
    frameworkVersionId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = Math.max(
    Number(filters?.page || 1),
    1
  );

  const limit = Math.min(
    Math.max(
      Number(filters?.limit || 25),
      1
    ),
    100
  );

  const query: Record<string, any> = {};

  if (organizationId) {
    query.organizationId =
      normalizeOrganizationId(organizationId);
  }

  if (filters?.status) {
    query.status = filters.status;
  }

  if (filters?.type) {
    query.type = filters.type;
  }

  if (filters?.frameworkVersionId) {
    query.frameworkVersionId =
      ensureObjectId(
        filters.frameworkVersionId,
        "frameworkVersionId"
      );
  }

  if (filters?.search) {
    query.$or = [
      {
        title: {
          $regex: filters.search,
          $options: "i"
        }
      },
      {
        description: {
          $regex: filters.search,
          $options: "i"
        }
      }
    ];
  }

  const [items, total] = await Promise.all([
    Assessment.find(query)
      .populate(
        "frameworkVersionId",
        "name version status"
      )
      .sort({
        createdAt: -1
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Assessment.countDocuments(query)
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}

export async function getAssessment(
  assessmentId: string,
  organizationId?: string
) {
  const assessment =
    await getAssessmentOrThrow(
      assessmentId,
      organizationId
    );

  const [sections, questions] =
    await Promise.all([
      AssessmentSection.find({
        assessmentId: assessment._id
      })
        .sort({
          order: 1
        })
        .lean(),

      AssessmentQuestion.find({
        assessmentId: assessment._id
      })
        .populate(
          "skillId",
          "name slug category"
        )
        .populate(
          "behaviouralFactorId",
          "name slug"
        )
        .sort({
          order: 1
        })
        .lean()
    ]);

  return {
    assessment,
    sections,
    questions
  };
}

export async function updateAssessment(
  assessmentId: string,
  organizationId: string | undefined,
  userId: string,
  data: Partial<{
    title: string;
    description: string;
    frameworkVersionId: string;
    industryTemplateId: string;
    type: AssessmentType;
    instructions: string;
    durationMinutes: number;
    passingScore: number;
    maxAttempts: number;
    randomizeQuestions: boolean;
    randomizeOptions: boolean;
    showResultsImmediately: boolean;
  }>
) {
  const assessment =
    await getAssessmentOrThrow(
      assessmentId,
      organizationId
    );

  assertEditableStatus(
    assessment.status
  );

  if (data.frameworkVersionId) {
    await verifyFramework(
      data.frameworkVersionId,
      organizationId
    );

    assessment.frameworkVersionId =
      ensureObjectId(
        data.frameworkVersionId,
        "frameworkVersionId"
      );
  }

  if (data.title !== undefined) {
    assessment.title =
      data.title.trim();

    assessment.slug =
      slugify(data.title);
  }

  if (data.description !== undefined) {
    assessment.description =
      data.description.trim();
  }

  if (data.industryTemplateId !== undefined) {
    assessment.industryTemplateId =
      data.industryTemplateId
        ? ensureObjectId(
            data.industryTemplateId,
            "industryTemplateId"
          )
        : undefined;
  }

  if (data.type !== undefined) {
    assessment.type = data.type;
  }

  if (data.instructions !== undefined) {
    assessment.instructions =
      data.instructions.trim();
  }

  if (data.durationMinutes !== undefined) {
    assessment.durationMinutes =
      data.durationMinutes;
  }

  if (data.passingScore !== undefined) {
    assessment.passingScore =
      data.passingScore;
  }

  if (data.maxAttempts !== undefined) {
    assessment.maxAttempts =
      data.maxAttempts;
  }

  if (
    data.randomizeQuestions !== undefined
  ) {
    assessment.randomizeQuestions =
      data.randomizeQuestions;
  }

  if (
    data.randomizeOptions !== undefined
  ) {
    assessment.randomizeOptions =
      data.randomizeOptions;
  }

  if (
    data.showResultsImmediately !== undefined
  ) {
    assessment.showResultsImmediately =
      data.showResultsImmediately;
  }

  assessment.updatedBy =
    ensureObjectId(
      userId,
      "userId"
    );

  await assessment.save();

  return assessment;
}

export async function publishAssessment(
  assessmentId: string,
  organizationId?: string
) {
  const assessment =
    await getAssessmentOrThrow(
      assessmentId,
      organizationId
    );

  if (
    assessment.status ===
    AssessmentStatus.ARCHIVED
  ) {
    throw new Error(
      "Archived assessments cannot be published"
    );
  }

  if (
    assessment.status ===
    AssessmentStatus.PUBLISHED
  ) {
    throw new Error(
      "Assessment is already published"
    );
  }

  const questionCount =
    await AssessmentQuestion.countDocuments({
      assessmentId: assessment._id
    });

  if (questionCount === 0) {
    throw new Error(
      "Assessment must contain at least one question before publishing"
    );
  }

  assessment.status =
    AssessmentStatus.PUBLISHED;

  assessment.publishedAt =
    new Date();

  await assessment.save();

  return assessment;
}

export async function archiveAssessment(
  assessmentId: string,
  organizationId?: string
) {
  const assessment =
    await getAssessmentOrThrow(
      assessmentId,
      organizationId
    );

  if (
    assessment.status ===
    AssessmentStatus.ARCHIVED
  ) {
    throw new Error(
      "Assessment is already archived"
    );
  }

  assessment.status =
    AssessmentStatus.ARCHIVED;

  assessment.archivedAt =
    new Date();

  await assessment.save();

  return assessment;
}

/* =========================================================
   SECTIONS
========================================================= */

export async function createAssessmentSection(
  assessmentId: string,
  organizationId: string | undefined,
  data: {
    title: string;
    description?: string;
    order?: number;
    instructions?: string;
  }
) {
  const assessment =
    await getAssessmentOrThrow(
      assessmentId,
      organizationId
    );

  assertEditableStatus(
    assessment.status
  );

  let order = data.order;

  if (!order) {
    const last =
      await AssessmentSection.findOne({
        assessmentId: assessment._id
      }).sort({
        order: -1
      });

    order = last
      ? last.order + 1
      : 1;
  }

  return AssessmentSection.create({
    assessmentId:
      assessment._id,

    title: data.title.trim(),

    description:
      data.description?.trim(),

    order,

    instructions:
      data.instructions?.trim()
  });
}

export async function listAssessmentSections(
  assessmentId: string,
  organizationId?: string
) {
  const assessment =
    await getAssessmentOrThrow(
      assessmentId,
      organizationId
    );

  return AssessmentSection.find({
    assessmentId: assessment._id
  })
    .sort({
      order: 1
    })
    .lean();
}

/* =========================================================
   QUESTIONS
========================================================= */

export async function createAssessmentQuestion(
  assessmentId: string,
  organizationId: string | undefined,
  data: {
    sectionId?: string;
    question: string;
    scenario?: string;
    type: AssessmentQuestionType;
    difficulty?: QuestionDifficulty;
    level?: number;
    skillId?: string;
    behaviouralFactorId?: string;
    options?: {
      key: string;
      text: string;
      score: number;
      isCorrect?: boolean;
    }[];
    explanation?: string;
    guidance?: string;
    weight?: number;
    order?: number;
    isRequired?: boolean;
  }
) {
  const assessment =
    await getAssessmentOrThrow(
      assessmentId,
      organizationId
    );

  assertEditableStatus(
    assessment.status
  );

  if (
    data.skillId &&
    data.behaviouralFactorId
  ) {
    throw new Error(
      "Question cannot be mapped to both skill and behavioural factor"
    );
  }

  if (
    !data.skillId &&
    !data.behaviouralFactorId
  ) {
    throw new Error(
      "Question must be mapped to either a skill or behavioural factor"
    );
  }

  if (data.skillId) {
    await verifySkill(
      data.skillId,
      String(assessment.frameworkVersionId)
    );
  }

  if (data.behaviouralFactorId) {
    await verifyBehaviouralFactor(
      data.behaviouralFactorId,
      String(
        assessment.frameworkVersionId
      )
    );
  }

  let sectionId: Types.ObjectId | undefined;

  if (data.sectionId) {
    const section =
      await AssessmentSection.findOne({
        _id: ensureObjectId(
          data.sectionId,
          "sectionId"
        ),
        assessmentId: assessment._id
      });

    if (!section) {
      throw new Error(
        "Section does not belong to this assessment"
      );
    }

    sectionId = section._id;
  }

  let order = data.order;

  if (!order) {
    const last =
      await AssessmentQuestion.findOne({
        assessmentId: assessment._id
      }).sort({
        order: -1
      });

    order = last
      ? last.order + 1
      : 1;
  }

  return AssessmentQuestion.create({
    assessmentId:
      assessment._id,

    sectionId,

    frameworkVersionId:
      assessment.frameworkVersionId,

    skillId: data.skillId
      ? ensureObjectId(
          data.skillId,
          "skillId"
        )
      : undefined,

    behaviouralFactorId:
      data.behaviouralFactorId
        ? ensureObjectId(
            data.behaviouralFactorId,
            "behaviouralFactorId"
          )
        : undefined,

    question:
      data.question.trim(),

    scenario:
      data.scenario?.trim(),

    type: data.type,

    difficulty:
      data.difficulty ||
      QuestionDifficulty.MEDIUM,

    level: data.level,

    options:
      data.options || [],

    explanation:
      data.explanation?.trim(),

    guidance:
      data.guidance?.trim(),

    weight:
      data.weight ?? 1,

    order,

    isRequired:
      data.isRequired ?? true
  });
}

export async function listAssessmentQuestions(
  assessmentId: string,
  organizationId?: string
) {
  const assessment =
    await getAssessmentOrThrow(
      assessmentId,
      organizationId
    );

  return AssessmentQuestion.find({
    assessmentId: assessment._id
  })
    .populate(
      "skillId",
      "name slug category"
    )
    .populate(
      "behaviouralFactorId",
      "name slug"
    )
    .sort({
      order: 1
    })
    .lean();
}

export async function updateAssessmentQuestion(
  assessmentId: string,
  questionId: string,
  organizationId: string | undefined,
  data: Partial<{
    sectionId: string;
    question: string;
    scenario: string;
    type: AssessmentQuestionType;
    difficulty: QuestionDifficulty;
    level: number;
    skillId: string;
    behaviouralFactorId: string;
    options: {
      key: string;
      text: string;
      score: number;
      isCorrect?: boolean;
    }[];
    explanation: string;
    guidance: string;
    weight: number;
    order: number;
    isRequired: boolean;
  }>
) {
  const assessment =
    await getAssessmentOrThrow(
      assessmentId,
      organizationId
    );

  assertEditableStatus(
    assessment.status
  );

  const question =
    await AssessmentQuestion.findOne({
      _id: ensureObjectId(
        questionId,
        "questionId"
      ),
      assessmentId: assessment._id
    });

  if (!question) {
    throw new Error(
      "Assessment question not found"
    );
  }

  if (
    data.skillId &&
    data.behaviouralFactorId
  ) {
    throw new Error(
      "Question cannot be mapped to both skill and behavioural factor"
    );
  }

  if (data.skillId) {
    await verifySkill(
      data.skillId,
      String(
        assessment.frameworkVersionId
      )
    );

    question.skillId =
      ensureObjectId(
        data.skillId,
        "skillId"
      );

    question.behaviouralFactorId =
      undefined;
  }

  if (data.behaviouralFactorId) {
    await verifyBehaviouralFactor(
      data.behaviouralFactorId,
      String(
        assessment.frameworkVersionId
      )
    );

    question.behaviouralFactorId =
      ensureObjectId(
        data.behaviouralFactorId,
        "behaviouralFactorId"
      );

    question.skillId =
      undefined;
  }

  if (
    data.sectionId !== undefined
  ) {
    if (data.sectionId) {
      const section =
        await AssessmentSection.findOne({
          _id: ensureObjectId(
            data.sectionId,
            "sectionId"
          ),
          assessmentId:
            assessment._id
        });

      if (!section) {
        throw new Error(
          "Section does not belong to this assessment"
        );
      }

      question.sectionId =
        section._id;
    } else {
      question.sectionId =
        undefined;
    }
  }

  if (data.question !== undefined) {
    question.question =
      data.question.trim();
  }

  if (data.scenario !== undefined) {
    question.scenario =
      data.scenario.trim();
  }

  if (data.type !== undefined) {
    question.type = data.type;
  }

  if (data.difficulty !== undefined) {
    question.difficulty =
      data.difficulty;
  }

  if (data.level !== undefined) {
    question.level =
      data.level;
  }

  if (data.options !== undefined) {
    question.options =
      data.options;
  }

  if (data.explanation !== undefined) {
    question.explanation =
      data.explanation.trim();
  }

  if (data.guidance !== undefined) {
    question.guidance =
      data.guidance.trim();
  }

  if (data.weight !== undefined) {
    question.weight =
      data.weight;
  }

  if (data.order !== undefined) {
    question.order =
      data.order;
  }

  if (data.isRequired !== undefined) {
    question.isRequired =
      data.isRequired;
  }

  await question.save();

  return question;
}

export async function deleteAssessmentQuestion(
  assessmentId: string,
  questionId: string,
  organizationId?: string
) {
  const assessment =
    await getAssessmentOrThrow(
      assessmentId,
      organizationId
    );

  assertEditableStatus(
    assessment.status
  );

  const deleted =
    await AssessmentQuestion.findOneAndDelete({
      _id: ensureObjectId(
        questionId,
        "questionId"
      ),
      assessmentId: assessment._id
    });

  if (!deleted) {
    throw new Error(
      "Assessment question not found"
    );
  }

  return deleted;
}