import {
  Types,
  startSession,
  type ClientSession,
} from "mongoose";

import {
  Assessment,
  AssessmentStatus,
} from "../../models/Assessment";

import {
  AssessmentQuestion,
  AssessmentQuestionType,
  QuestionDifficulty,
} from "../../models/AssessmentQuestion";

import {
  BehaviouralFactor,
} from "../../models/BehaviouralFactor";

import {
  EvidencePrompt,
} from "../../models/EvidencePrompt";

import {
  FrameworkVersion,
} from "../../models/FrameworkVersion";

import {
  Skill,
} from "../../models/Skill";

import {
  SkillLevel,
} from "../../models/SkillLevel";

import {
  RoleProfile,
  RoleProfileStatus,
} from "../../models/RoleProfile";

import {
  AIGeneration,
  AIGenerationStatus,
  AIGenerationType,
  IAIGeneration,
} from "../../models/AIGeneration";

import {
  generateGeminiJson,
  getGeminiModel,
} from "./ai.provider";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function ensureObjectId(
  value: string,
  fieldName: string,
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} is invalid`);
  }

  return new Types.ObjectId(value);
}

function normalizeOrganizationId(
  organizationId?: string,
): Types.ObjectId | undefined {
  if (!organizationId) {
    return undefined;
  }

  return ensureObjectId(
    organizationId,
    "organizationId",
  );
}

function normalizeLevel(
  value: unknown,
  fallback = 1,
): number {
  const level = Number(value);

  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 10
  ) {
    return fallback;
  }

  return level;
}

function normalizeConfidence(
  value: unknown,
): number {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(
      0,
      confidence,
    ),
  );
}

function normalizeQuestionCount(
  value: unknown,
): number {
  const count = Number(value);

  if (
    !Number.isInteger(count) ||
    count < 1
  ) {
    return 5;
  }

  return Math.min(
    count,
    30,
  );
}

async function getRoleProfileOrThrow(
  roleProfileId: string,
  organizationId?: string,
) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(
      roleProfileId,
      "roleProfileId",
    ),
  };

  const orgId =
    normalizeOrganizationId(
      organizationId,
    );

  if (orgId) {
    query.organizationId = orgId;
  }

  const profile =
    await RoleProfile.findOne(query);

  if (!profile) {
    throw new Error(
      "Role profile not found",
    );
  }

  return profile;
}

async function getAssessmentOrThrow(
  assessmentId: string,
  organizationId?: string,
) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(
      assessmentId,
      "assessmentId",
    ),
  };

  const orgId =
    normalizeOrganizationId(
      organizationId,
    );

  if (orgId) {
    query.organizationId = orgId;
  }

  const assessment =
    await Assessment.findOne(query);

  if (!assessment) {
    throw new Error(
      "Assessment not found",
    );
  }

  return assessment;
}

/* -------------------------------------------------------------------------- */
/* Skill Mapping                                                              */
/* -------------------------------------------------------------------------- */

interface AISkillSuggestion {
  skillId: string;
  targetLevel: number;
  confidence: number;
  rationale: string;
}

interface AIBehaviouralSuggestion {
  behaviouralFactorId: string;
  targetLevel: number;
  confidence: number;
  rationale: string;
}

interface AIRoleSkillMapping {
  skills: AISkillSuggestion[];
  behaviouralFactors: AIBehaviouralSuggestion[];
  summary: string;
}

export async function generateRoleSkillMapping(
  params: {
    roleProfileId: string;
    organizationId?: string;
    createdBy: string;
  },
) {
  const profile =
    await getRoleProfileOrThrow(
      params.roleProfileId,
      params.organizationId,
    );

  const framework =
    await FrameworkVersion.findById(
      profile.frameworkVersionId,
    );

  if (!framework) {
    throw new Error(
      "Framework version not found",
    );
  }

  const skills =
    await Skill.find({
      frameworkVersionId:
        profile.frameworkVersionId,
      isActive: true,
    }).lean();

  const behaviouralFactors =
    await BehaviouralFactor.find({
      frameworkVersionId:
        profile.frameworkVersionId,
      isActive: true,
    }).lean();

  const skillLevels =
    await SkillLevel.find({
      frameworkVersionId:
        profile.frameworkVersionId,
    })
      .select(
        "skillId level name description behaviours",
      )
      .lean();

  if (skills.length === 0) {
    throw new Error(
      "The selected framework has no active skills for Gemini to map against",
    );
  }

  const skillCatalog =
    skills.map(
      (skill) => ({
        id: skill._id.toString(),
        name: skill.name,
        description: skill.description,
        category: skill.category,

        levels:
          skillLevels
            .filter(
              (level) =>
                level.skillId.toString() ===
                skill._id.toString(),
            )
            .map(
              (level) => ({
                level: level.level,
                name: level.name,
                description: level.description,
                behaviours:
                  level.behaviours,
              }),
            ),
      }),
    );

  const factorCatalog =
    behaviouralFactors.map(
      (factor) => ({
        id: factor._id.toString(),
        name: factor.name,
        description: factor.description,
        indicators: factor.indicators,
      }),
    );

  const prompt = `
You are the competency-mapping engine for SkillForge.

Your task is to recommend existing competency skills and behavioural factors for a job role.

IMPORTANT RULES:

1. Only select skills from the supplied skill catalog.
2. Only select behavioural factors from the supplied behavioural-factor catalog.
3. Never invent IDs.
4. Do not create new skills.
5. Do not create new behavioural factors.
6. Recommend only competencies genuinely relevant to the role.
7. Target levels must be integers from 1 to 10.
8. Give a confidence value between 0 and 1.
9. Explain why each recommendation is relevant.
10. Return JSON only.
11. This is a recommendation. A human administrator will review it before anything is applied.

ROLE:

Name:
${profile.name}

Description:
${profile.description || "No description provided"}

Department:
${profile.department || "Not specified"}

FRAMEWORK:

${framework.name} ${framework.version}

EXISTING SKILLS:

${JSON.stringify(skillCatalog)}

EXISTING BEHAVIOURAL FACTORS:

${JSON.stringify(factorCatalog)}

RETURN EXACTLY THIS JSON SHAPE:

{
  "skills": [
    {
      "skillId": "existing-skill-id",
      "targetLevel": 1,
      "confidence": 0.95,
      "rationale": "Why this competency is relevant."
    }
  ],
  "behaviouralFactors": [
    {
      "behaviouralFactorId": "existing-factor-id",
      "targetLevel": 1,
      "confidence": 0.9,
      "rationale": "Why this factor is relevant."
    }
  ],
  "summary": "Short explanation of the overall competency recommendation."
}
`;

  const generated =
    await generateGeminiJson<
      AIRoleSkillMapping
    >(prompt);

  const validSkillIds =
    new Set(
      skills.map(
        (skill) =>
          skill._id.toString(),
      ),
    );

  const validFactorIds =
    new Set(
      behaviouralFactors.map(
        (factor) =>
          factor._id.toString(),
      ),
    );

  const normalizedSkills =
    Array.isArray(
      generated.skills,
    )
      ? generated.skills
          .filter(
            (item) =>
              validSkillIds.has(
                item.skillId,
              ),
          )
          .map(
            (item) => ({
              skillId:
                item.skillId,

              targetLevel:
                normalizeLevel(
                  item.targetLevel,
                ),

              confidence:
                normalizeConfidence(
                  item.confidence,
                ),

              rationale:
                String(
                  item.rationale || "",
                ).trim(),
            }),
          )
      : [];

  const normalizedFactors =
    Array.isArray(
      generated.behaviouralFactors,
    )
      ? generated.behaviouralFactors
          .filter(
            (item) =>
              validFactorIds.has(
                item.behaviouralFactorId,
              ),
          )
          .map(
            (item) => ({
              behaviouralFactorId:
                item.behaviouralFactorId,

              targetLevel:
                normalizeLevel(
                  item.targetLevel,
                ),

              confidence:
                normalizeConfidence(
                  item.confidence,
                ),

              rationale:
                String(
                  item.rationale || "",
                ).trim(),
            }),
          )
      : [];

  const output = {
    skills:
      normalizedSkills,

    behaviouralFactors:
      normalizedFactors,

    summary:
      String(
        generated.summary || "",
      ).trim(),
  };

  const generation =
    await AIGeneration.create({
      organizationId:
        profile.organizationId,

      generationType:
        AIGenerationType.ROLE_SKILL_MAPPING,

      frameworkVersionId:
        profile.frameworkVersionId,

      roleProfileId:
        profile._id,

      aiModel:
        getGeminiModel(),

      inputSnapshot: {
        roleName:
          profile.name,

        description:
          profile.description,

        department:
          profile.department,
      },

      output,

      status:
        AIGenerationStatus.PENDING_REVIEW,

      createdBy:
        ensureObjectId(
          params.createdBy,
          "createdBy",
        ),
    });

  return generation;
}

/* -------------------------------------------------------------------------- */
/* Interview Question Generation                                              */
/* -------------------------------------------------------------------------- */

interface AIQuestionOption {
  key: string;
  text: string;
  score?: number;
  isCorrect?: boolean;
}

interface AIQuestionOptionInput {
  key?: unknown;
  text?: unknown;
  score?: unknown;
  isCorrect?: unknown;
}

interface AIInterviewQuestion {
  question: string;
  scenario?: string;

  type: AssessmentQuestionType;

  difficulty: QuestionDifficulty;

  skillId?: string;

  behaviouralFactorId?: string;

  level?: number;

  options?: AIQuestionOption[];

  explanation?: string;

  guidance?: string;

  weight?: number;

  isRequired?: boolean;
}

interface AIInterviewQuestionResponse {
  questions: AIInterviewQuestion[];
  summary: string;
}

function isValidQuestionType(
  value: unknown,
): value is AssessmentQuestionType {
  return Object.values(
    AssessmentQuestionType,
  ).includes(
    value as AssessmentQuestionType,
  );
}

function isValidDifficulty(
  value: unknown,
): value is QuestionDifficulty {
  return Object.values(
    QuestionDifficulty,
  ).includes(
    value as QuestionDifficulty,
  );
}

function normalizeOptions(
  options: unknown,
): AIQuestionOption[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options
    .filter(
      (
        option,
      ): option is AIQuestionOptionInput =>
        Boolean(
          option &&
          typeof option === "object",
        ),
    )
    .map(
      (
        option,
        index,
      ): AIQuestionOption => ({
        key:
          String(
            option.key ||
              String.fromCharCode(
                65 + index,
              ),
          ),

        text:
          String(
            option.text || "",
          ).trim(),

        score:
          option.score === undefined
            ? undefined
            : Number(
                option.score,
              ),

        isCorrect:
          option.isCorrect === undefined
            ? undefined
            : Boolean(
                option.isCorrect,
              ),
      }),
    )
    .filter(
      (option) =>
        option.text.length > 0,
    );
}

export async function generateInterviewQuestions(
  params: {
    assessmentId: string;
    roleProfileId: string;
    organizationId?: string;
    count?: number;
    questionTypes?: string[];
    createdBy: string;
  },
) {
  const profile =
    await getRoleProfileOrThrow(
      params.roleProfileId,
      params.organizationId,
    );

  if (
    profile.status !==
    RoleProfileStatus.PUBLISHED
  ) {
    throw new Error(
      "Interview questions can only be generated from a published role profile",
    );
  }

  const assessment =
    await getAssessmentOrThrow(
      params.assessmentId,
      params.organizationId,
    );

  if (
    assessment.status ===
      AssessmentStatus.PUBLISHED ||
    assessment.status ===
      AssessmentStatus.ARCHIVED
  ) {
    throw new Error(
      "AI-generated questions can only be added to a draft or ready assessment",
    );
  }

  if (
    assessment.frameworkVersionId.toString() !==
    profile.frameworkVersionId.toString()
  ) {
    throw new Error(
      "Assessment and role profile must use the same framework version",
    );
  }

  const skills =
    await Skill.find({
      _id: {
        $in:
          profile.skills.map(
            (item) =>
              item.skillId,
          ),
      },

      frameworkVersionId:
        profile.frameworkVersionId,

      isActive: true,
    }).lean();

  const factors =
    await BehaviouralFactor.find({
      _id: {
        $in:
          profile.behaviouralFactors.map(
            (item) =>
              item.behaviouralFactorId,
          ),
      },

      frameworkVersionId:
        profile.frameworkVersionId,

      isActive: true,
    }).lean();

  const skillLevels =
    await SkillLevel.find({
      frameworkVersionId:
        profile.frameworkVersionId,

      skillId: {
        $in:
          profile.skills.map(
            (item) =>
              item.skillId,
          ),
      },
    })
      .select(
        "skillId level name description behaviours",
      )
      .lean();

  const evidencePrompts =
    await EvidencePrompt.find({
      frameworkVersionId:
        profile.frameworkVersionId,

      isActive: true,

      $or: [
        {
          skillId: {
            $in:
              profile.skills.map(
                (item) =>
                  item.skillId,
              ),
          },
        },

        {
          behaviouralFactorId: {
            $in:
              profile.behaviouralFactors.map(
                (item) =>
                  item.behaviouralFactorId,
              ),
          },
        },
      ],
    })
      .select(
        "skillId behaviouralFactorId prompt evidenceType minimumLevel maximumLevel guidance",
      )
      .limit(50)
      .lean();

  const roleSkills =
    profile.skills.map(
      (item) => {
        const skill =
          skills.find(
            (candidate) =>
              candidate._id.toString() ===
              item.skillId.toString(),
          );

        return {
          skillId:
            item.skillId.toString(),

          name:
            skill?.name,

          description:
            skill?.description,

          targetLevel:
            item.targetLevel,

          weight:
            item.weight,

          levels:
            skillLevels
              .filter(
                (level) =>
                  level.skillId.toString() ===
                  item.skillId.toString(),
              )
              .map(
                (level) => ({
                  level:
                    level.level,

                  name:
                    level.name,

                  description:
                    level.description,

                  behaviours:
                    level.behaviours,
                }),
              ),
        };
      },
    );

  const roleFactors =
    profile.behaviouralFactors.map(
      (item) => {
        const factor =
          factors.find(
            (candidate) =>
              candidate._id.toString() ===
              item.behaviouralFactorId.toString(),
          );

        return {
          behaviouralFactorId:
            item.behaviouralFactorId.toString(),

          name:
            factor?.name,

          description:
            factor?.description,

          indicators:
            factor?.indicators,

          targetLevel:
            item.targetLevel,

          weight:
            item.weight,
        };
      },
    );

  const count =
    normalizeQuestionCount(
      params.count,
    );

  const requestedTypes =
    Array.isArray(
      params.questionTypes,
    )
      ? params.questionTypes.filter(
          (type) =>
            isValidQuestionType(
              type,
            ),
        )
      : [];

  const prompt = `
You are the structured interview-question generation engine for SkillForge.

Generate high-quality assessment/interview questions based ONLY on the supplied published role profile and competency framework.

IMPORTANT RULES:

1. Questions must be relevant to the role.
2. Every question must map to either an existing skill OR an existing behavioural factor.
3. Never invent skill IDs.
4. Never invent behavioural-factor IDs.
5. Use only supplied IDs.
6. Respect the target level of the competency.
7. Questions should assess capability, not merely recall.
8. Include realistic scenarios where appropriate.
9. Avoid discriminatory, protected-class, or personal questions.
10. Do not ask for unnecessary sensitive personal information.
11. For multiple-choice questions, provide plausible distractors.
12. For single-choice/multiple-choice/true-false questions, provide scoring information.
13. For SCENARIO, TECHNICAL, and BEHAVIOURAL questions, an options array may be empty when the question is intended for a written/interviewer response.
14. Provide useful evaluator guidance.
15. Provide an explanation or scoring rationale.
16. Return JSON only.
17. These are AI suggestions and will be reviewed by a human administrator before being applied or published.

ROLE:

${profile.name}

ROLE DESCRIPTION:

${profile.description || "No description provided"}

DEPARTMENT:

${profile.department || "Not specified"}

FRAMEWORK:

${assessment.frameworkVersionId.toString()}

TARGET ROLE SKILLS:

${JSON.stringify(roleSkills)}

TARGET BEHAVIOURAL FACTORS:

${JSON.stringify(roleFactors)}

RELEVANT EVIDENCE PROMPTS:

${JSON.stringify(evidencePrompts)}

REQUESTED QUESTION COUNT:

${count}

REQUESTED QUESTION TYPES:

${JSON.stringify(
  requestedTypes.length > 0
    ? requestedTypes
    : Object.values(
        AssessmentQuestionType,
      ),
)}

RETURN EXACTLY:

{
  "questions": [
    {
      "question": "Question text",
      "scenario": "Optional scenario context",
      "type": "SCENARIO",
      "difficulty": "MEDIUM",
      "skillId": "existing-skill-id",
      "behaviouralFactorId": null,
      "level": 5,
      "options": [],
      "explanation": "Why this question measures the competency.",
      "guidance": "What a strong response should demonstrate.",
      "weight": 1,
      "isRequired": true
    }
  ],
  "summary": "Short summary of the generated question set."
}
`;

  const generated =
    await generateGeminiJson<
      AIInterviewQuestionResponse
    >(prompt);

  const validSkillIds =
    new Set(
      skills.map(
        (skill) =>
          skill._id.toString(),
      ),
    );

  const validFactorIds =
    new Set(
      factors.map(
        (factor) =>
          factor._id.toString(),
      ),
    );

  const normalizedQuestions =
    Array.isArray(
      generated.questions,
    )
      ? generated.questions
          .map(
            (
              item,
            ) => {
              const type =
                isValidQuestionType(
                  item.type,
                )
                  ? item.type
                  : AssessmentQuestionType.SCENARIO;

              const difficulty =
                isValidDifficulty(
                  item.difficulty,
                )
                  ? item.difficulty
                  : QuestionDifficulty.MEDIUM;

              const skillId =
                item.skillId &&
                validSkillIds.has(
                  item.skillId,
                )
                  ? item.skillId
                  : undefined;

              const behaviouralFactorId =
                item.behaviouralFactorId &&
                validFactorIds.has(
                  item.behaviouralFactorId,
                )
                  ? item.behaviouralFactorId
                  : undefined;

              if (
                !skillId &&
                !behaviouralFactorId
              ) {
                return null;
              }

              if (
                skillId &&
                behaviouralFactorId
              ) {
                return null;
              }

              const options =
                normalizeOptions(
                  item.options,
                );

              return {
                question:
                  String(
                    item.question ||
                      "",
                  ).trim(),

                scenario:
                  item.scenario
                    ? String(
                        item.scenario,
                      ).trim()
                    : undefined,

                type,

                difficulty,

                skillId,

                behaviouralFactorId,

                level:
                  normalizeLevel(
                    item.level,
                  ),

                options,

                explanation:
                  item.explanation
                    ? String(
                        item.explanation,
                      ).trim()
                    : undefined,

                guidance:
                  item.guidance
                    ? String(
                        item.guidance,
                      ).trim()
                    : undefined,

                weight:
                  Number.isFinite(
                    Number(
                      item.weight,
                    ),
                  ) &&
                  Number(
                    item.weight,
                  ) > 0
                    ? Number(
                        item.weight,
                      )
                    : 1,

                isRequired:
                  item.isRequired !==
                  false,
              };
            },
          )
          .filter(
            (
              item,
            ): item is NonNullable<
              typeof item
            > =>
              item !== null &&
              item.question.length > 0,
          )
          .slice(
            0,
            count,
          )
      : [];

  if (
    normalizedQuestions.length === 0
  ) {
    throw new Error(
      "Gemini did not return any valid interview questions",
    );
  }

  const output = {
    questions:
      normalizedQuestions,

    summary:
      String(
        generated.summary || "",
      ).trim(),
  };

  const generation =
    await AIGeneration.create({
      organizationId:
        profile.organizationId,

      generationType:
        AIGenerationType.INTERVIEW_QUESTIONS,

      frameworkVersionId:
        profile.frameworkVersionId,

      roleProfileId:
        profile._id,

      assessmentId:
        assessment._id,

      aiModel:
        getGeminiModel(),

      inputSnapshot: {
        roleProfileId:
          profile._id.toString(),

        assessmentId:
          assessment._id.toString(),

        roleName:
          profile.name,

        count,

        questionTypes:
          requestedTypes,
      },

      output,

      status:
        AIGenerationStatus.PENDING_REVIEW,

      createdBy:
        ensureObjectId(
          params.createdBy,
          "createdBy",
        ),
    });

  return generation;
}

/* -------------------------------------------------------------------------- */
/* AI Generation Retrieval                                                    */
/* -------------------------------------------------------------------------- */

export async function getAIGeneration(
  generationId: string,
  organizationId?: string,
) {
  const query: Record<string, unknown> = {
    _id: ensureObjectId(
      generationId,
      "generationId",
    ),
  };

  const orgId =
    normalizeOrganizationId(
      organizationId,
    );

  if (orgId) {
    query.organizationId = orgId;
  }

  const generation =
    await AIGeneration.findOne(
      query,
    )
      .populate(
        "roleProfileId",
        "name slug status",
      )
      .populate(
        "assessmentId",
        "title status",
      );

  if (!generation) {
    throw new Error(
      "AI generation not found",
    );
  }

  return generation;
}

export async function listAIGenerations(
  params: {
    organizationId?: string;
    generationType?: AIGenerationType;
    status?: AIGenerationStatus;
  },
) {
  const query: Record<
    string,
    unknown
  > = {};

  const organizationId =
    normalizeOrganizationId(
      params.organizationId,
    );

  if (organizationId) {
    query.organizationId =
      organizationId;
  }

  if (params.generationType) {
    query.generationType =
      params.generationType;
  }

  if (params.status) {
    query.status =
      params.status;
  }

  return AIGeneration.find(
    query,
  )
    .populate(
      "roleProfileId",
      "name slug status",
    )
    .populate(
      "assessmentId",
      "title status",
    )
    .sort({
      createdAt: -1,
    });
}

/* -------------------------------------------------------------------------- */
/* Human Review                                                               */
/* -------------------------------------------------------------------------- */

function getApprovedIndexes(
  value: unknown,
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          (item) =>
            Number(item),
        )
        .filter(
          (item) =>
            Number.isInteger(item) &&
            item >= 0,
        ),
    ),
  );
}

/**
 * Validate that every approved index actually exists
 * inside the generated AI output.
 */
function validateApprovedIndexes(
  generation: IAIGeneration,
  approvedIndexes: number[],
): void {
  let itemCount = 0;

  if (
    generation.generationType ===
    AIGenerationType.ROLE_SKILL_MAPPING
  ) {
    const output =
      generation.output as {
        skills?: AISkillSuggestion[];
        behaviouralFactors?:
          AIBehaviouralSuggestion[];
      };

    const skills =
      Array.isArray(output.skills)
        ? output.skills
        : [];

    const factors =
      Array.isArray(
        output.behaviouralFactors,
      )
        ? output.behaviouralFactors
        : [];

    itemCount =
      skills.length +
      factors.length;
  }

  if (
    generation.generationType ===
    AIGenerationType.INTERVIEW_QUESTIONS
  ) {
    const output =
      generation.output as {
        questions?: AIInterviewQuestion[];
      };

    itemCount =
      Array.isArray(output.questions)
        ? output.questions.length
        : 0;
  }

  if (itemCount === 0) {
    throw new Error(
      "This AI generation contains no reviewable output",
    );
  }

  const invalidIndexes =
    approvedIndexes.filter(
      (index) =>
        index < 0 ||
        index >= itemCount,
    );

  if (
    invalidIndexes.length > 0
  ) {
    throw new Error(
      `One or more approved indexes are invalid. Valid indexes are 0 to ${
        itemCount - 1
      }`,
    );
  }
}

/**
 * Ensure the requested application target matches
 * the type of AI generation being reviewed.
 */
function validateApplicationTargets(
  generation: IAIGeneration,
  applyToRoleProfile: boolean,
  applyToAssessment: boolean,
): void {
  if (
    generation.generationType ===
    AIGenerationType.ROLE_SKILL_MAPPING
  ) {
    if (applyToAssessment) {
      throw new Error(
        "Role skill mapping generations cannot be applied to assessments",
      );
    }

    return;
  }

  if (
    generation.generationType ===
    AIGenerationType.INTERVIEW_QUESTIONS
  ) {
    if (applyToRoleProfile) {
      throw new Error(
        "Interview-question generations cannot be applied to role profiles",
      );
    }

    return;
  }

  if (
    applyToRoleProfile ||
    applyToAssessment
  ) {
    throw new Error(
      "This AI generation type cannot be applied automatically",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Apply Skill Mapping                                                        */
/* -------------------------------------------------------------------------- */

async function applySkillMappingToRoleProfile(
  generation: IAIGeneration,
  approvedIndexes: number[],
  session?: ClientSession,
) {
  if (
    generation.generationType !==
    AIGenerationType.ROLE_SKILL_MAPPING
  ) {
    throw new Error(
      "This generation is not a role skill mapping",
    );
  }

  if (!generation.roleProfileId) {
    throw new Error(
      "Role profile is missing from AI generation",
    );
  }

  let profileQuery =
    RoleProfile.findOne({
      _id:
        generation.roleProfileId,

      organizationId:
        generation.organizationId,
    });

  if (session) {
    profileQuery =
      profileQuery.session(session);
  }

  const profile =
    await profileQuery;

  if (!profile) {
    throw new Error(
      "Role profile not found",
    );
  }

  if (
    profile.status !==
    RoleProfileStatus.DRAFT
  ) {
    throw new Error(
      "AI skill mapping can only be applied to a draft role profile",
    );
  }

  const output =
    generation.output as {
      skills?: AISkillSuggestion[];

      behaviouralFactors?:
        AIBehaviouralSuggestion[];
    };

  const skills =
    Array.isArray(
      output.skills,
    )
      ? output.skills
      : [];

  const factors =
    Array.isArray(
      output.behaviouralFactors,
    )
      ? output.behaviouralFactors
      : [];

  /*
   * approvedIndexes are indexes across
   * the combined list:
   *
   * [skills..., behaviouralFactors...]
   */

  const combined = [
    ...skills.map(
      (item) => ({
        type:
          "skill" as const,
        item,
      }),
    ),

    ...factors.map(
      (item) => ({
        type:
          "factor" as const,
        item,
      }),
    ),
  ];

  const approved =
    approvedIndexes
      .map(
        (index) =>
          combined[index],
      )
      .filter(
        Boolean,
      );

  const currentSkills =
    profile.skills.map(
      (item) => ({
        skillId:
          item.skillId,

        targetLevel:
          item.targetLevel,

        weight:
          item.weight,
      }),
    );

  const currentFactors =
    profile.behaviouralFactors.map(
      (item) => ({
        behaviouralFactorId:
          item.behaviouralFactorId,

        targetLevel:
          item.targetLevel,

        weight:
          item.weight,
      }),
    );

  for (const entry of approved) {
    if (
      entry.type ===
      "skill"
    ) {
      const existing =
        currentSkills.find(
          (item) =>
            item.skillId.toString() ===
            entry.item.skillId,
        );

      if (existing) {
        existing.targetLevel =
          normalizeLevel(
            entry.item.targetLevel,
          );
      } else {
        currentSkills.push({
          skillId:
            ensureObjectId(
              entry.item.skillId,
              "skillId",
            ),

          targetLevel:
            normalizeLevel(
              entry.item.targetLevel,
            ),

          weight:
            1,
        });
      }
    }

    if (
      entry.type ===
      "factor"
    ) {
      const existing =
        currentFactors.find(
          (item) =>
            item.behaviouralFactorId.toString() ===
            entry.item.behaviouralFactorId,
        );

      if (existing) {
        existing.targetLevel =
          normalizeLevel(
            entry.item.targetLevel,
          );
      } else {
        currentFactors.push({
          behaviouralFactorId:
            ensureObjectId(
              entry.item
                .behaviouralFactorId,
              "behaviouralFactorId",
            ),

          targetLevel:
            normalizeLevel(
              entry.item.targetLevel,
            ),

          weight:
            1,
        });
      }
    }
  }

  profile.skills =
    currentSkills;

  profile.behaviouralFactors =
    currentFactors;

  if (session) {
    await profile.save({
      session,
    });
  } else {
    await profile.save();
  }

  return {
    type:
      "ROLE_PROFILE_SKILL_MAPPING",

    roleProfileId:
      profile._id,

    skillsApplied:
      approved.filter(
        (item) =>
          item.type ===
          "skill",
      ).length,

    behaviouralFactorsApplied:
      approved.filter(
        (item) =>
          item.type ===
          "factor",
      ).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Apply Interview Questions                                                  */
/* -------------------------------------------------------------------------- */

async function applyQuestionsToAssessment(
  generation: IAIGeneration,
  approvedIndexes: number[],
  session?: ClientSession,
) {
  if (
    generation.generationType !==
    AIGenerationType.INTERVIEW_QUESTIONS
  ) {
    throw new Error(
      "This generation is not interview-question generation",
    );
  }

  if (!generation.assessmentId) {
    throw new Error(
      "Assessment is missing from AI generation",
    );
  }

  let assessmentQuery =
    Assessment.findOne({
      _id:
        generation.assessmentId,

      organizationId:
        generation.organizationId,
    });

  if (session) {
    assessmentQuery =
      assessmentQuery.session(
        session,
      );
  }

  const assessment =
    await assessmentQuery;

  if (!assessment) {
    throw new Error(
      "Assessment not found",
    );
  }

  if (
    assessment.status ===
      AssessmentStatus.PUBLISHED ||
    assessment.status ===
      AssessmentStatus.ARCHIVED
  ) {
    throw new Error(
      "AI questions can only be applied to a draft or ready assessment",
    );
  }

  const output =
    generation.output as {
      questions?: AIInterviewQuestion[];
    };

  const questions =
    Array.isArray(
      output.questions,
    )
      ? output.questions
      : [];

  const selected =
    approvedIndexes
      .map(
        (index) =>
          questions[index],
      )
      .filter(
        Boolean,
      );

  if (
    selected.length === 0
  ) {
    throw new Error(
      "No valid AI questions were selected",
    );
  }

  let lastQuestionQuery =
    AssessmentQuestion.findOne({
      assessmentId:
        assessment._id,
    })
      .sort({
        order: -1,
      })
      .select("order")
      .lean();

  if (session) {
    lastQuestionQuery =
      lastQuestionQuery.session(
        session,
      );
  }

  const lastQuestion =
    await lastQuestionQuery;

  let nextOrder =
    lastQuestion
      ? lastQuestion.order + 1
      : 0;

  const questionDocuments =
    [];

  for (const item of selected) {
    const skillId =
      item.skillId
        ? ensureObjectId(
            item.skillId,
            "skillId",
          )
        : undefined;

    const behaviouralFactorId =
      item.behaviouralFactorId
        ? ensureObjectId(
            item.behaviouralFactorId,
            "behaviouralFactorId",
          )
        : undefined;

    if (
      !skillId &&
      !behaviouralFactorId
    ) {
      continue;
    }

    questionDocuments.push({
      assessmentId:
        assessment._id,

      frameworkVersionId:
        assessment.frameworkVersionId,

      skillId,

      behaviouralFactorId,

      question:
        item.question,

      scenario:
        item.scenario,

      type:
        item.type,

      difficulty:
        item.difficulty,

      level:
        normalizeLevel(
          item.level,
        ),

      options:
        Array.isArray(
          item.options,
        )
          ? item.options
          : [],

      explanation:
        item.explanation,

      guidance:
        item.guidance,

      weight:
        Number.isFinite(
          Number(
            item.weight,
          ),
        ) &&
        Number(
          item.weight,
        ) > 0
          ? Number(
              item.weight,
            )
          : 1,

      order:
        nextOrder++,

      isRequired:
        item.isRequired !==
        false,
    });
  }

  if (
    questionDocuments.length === 0
  ) {
    throw new Error(
      "No valid AI questions could be applied",
    );
  }

  const createdQuestions =
    session
      ? await AssessmentQuestion.create(
          questionDocuments,
          {
            session,
          },
        )
      : await AssessmentQuestion.create(
          questionDocuments,
        );

  return {
    type:
      "INTERVIEW_QUESTIONS",

    assessmentId:
      assessment._id,

    questionsCreated:
      createdQuestions.length,

    questionIds:
      createdQuestions.map(
        (question) =>
          question._id,
      ),
  };
}

/* -------------------------------------------------------------------------- */
/* Transactional Human Review                                                 */
/* -------------------------------------------------------------------------- */

export async function reviewAIGeneration(
  params: {
    generationId: string;

    organizationId?: string;

    decision:
      | "APPROVE"
      | "REJECT";

    approvedIndexes?: unknown;

    reviewNotes?: string;

    reviewedBy: string;

    applyToRoleProfile?: boolean;

    applyToAssessment?: boolean;
  },
) {
  const session =
    await startSession();

  try {
    let result:
      | {
          generation: IAIGeneration;
          applied?: Record<
            string,
            unknown
          >;
        }
      | undefined;

    await session.withTransaction(
      async () => {
        const generationQuery =
          AIGeneration.findOne({
            _id:
              ensureObjectId(
                params.generationId,
                "generationId",
              ),
          });

        const organizationId =
          normalizeOrganizationId(
            params.organizationId,
          );

        if (organizationId) {
          generationQuery.where(
            "organizationId",
            organizationId,
          );
        }

        generationQuery.session(
          session,
        );

        const generation =
          await generationQuery;

        if (!generation) {
          throw new Error(
            "AI generation not found",
          );
        }

        if (
          generation.status !==
          AIGenerationStatus.PENDING_REVIEW
        ) {
          throw new Error(
            "This AI generation has already been reviewed",
          );
        }

        if (
          params.decision !==
            "APPROVE" &&
          params.decision !==
            "REJECT"
        ) {
          throw new Error(
            "Invalid review decision",
          );
        }

        const parsedIndexes =
          getApprovedIndexes(
            params.approvedIndexes,
          );

        /*
         * A rejected generation cannot
         * have approved output items.
         */
        const approvedIndexes =
          params.decision ===
          "APPROVE"
            ? parsedIndexes
            : [];

        if (
          params.decision ===
            "APPROVE" &&
          approvedIndexes.length ===
            0
        ) {
          throw new Error(
            "At least one approved item is required",
          );
        }

        /*
         * Validate indexes before changing
         * anything.
         */
        if (
          params.decision ===
          "APPROVE"
        ) {
          validateApprovedIndexes(
            generation,
            approvedIndexes,
          );
        }

        const applyToRoleProfile =
          Boolean(
            params.applyToRoleProfile,
          );

        const applyToAssessment =
          Boolean(
            params.applyToAssessment,
          );

        validateApplicationTargets(
          generation,
          applyToRoleProfile,
          applyToAssessment,
        );

        let applied:
          | Record<
              string,
              unknown
            >
          | undefined;

        /*
         * IMPORTANT:
         *
         * Apply changes BEFORE marking the
         * generation as approved.
         *
         * Everything runs inside the same
         * transaction, so if application
         * fails, the generation remains
         * PENDING_REVIEW.
         */
        if (
          params.decision ===
            "APPROVE" &&
          applyToRoleProfile
        ) {
          applied =
            await applySkillMappingToRoleProfile(
              generation,
              approvedIndexes,
              session,
            );
        }

        if (
          params.decision ===
            "APPROVE" &&
          applyToAssessment
        ) {
          applied =
            await applyQuestionsToAssessment(
              generation,
              approvedIndexes,
              session,
            );
        }

        generation.status =
          params.decision ===
          "APPROVE"
            ? AIGenerationStatus.APPROVED
            : AIGenerationStatus.REJECTED;

        generation.approvedIndexes =
          approvedIndexes;

        generation.reviewNotes =
          params.reviewNotes?.trim();

        generation.reviewedBy =
          ensureObjectId(
            params.reviewedBy,
            "reviewedBy",
          );

        generation.reviewedAt =
          new Date();

        await generation.save({
          session,
        });

        result = {
          generation,
          applied,
        };
      },
    );

    if (!result) {
      throw new Error(
        "AI generation review failed",
      );
    }

    return result;
  } finally {
    await session.endSession();
  }
}