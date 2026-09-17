import { Types } from "mongoose";

import LearningResource, {
  LearningResourceCompetencyType,
  LearningResourceType,
} from "../../models/LearningResource";

import GapAnalysis, {
  GapClassification,
  IGapCompetency,
} from "../../models/GapAnalysis";

import { Skill } from "../../models/Skill";
import { BehaviouralFactor } from "../../models/BehaviouralFactor";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface CreateLearningResourceInput {
  organizationId?: string;

  competencyType: LearningResourceCompetencyType;
  competencyId: string;

  title: string;
  description?: string;

  url: string;

  provider?: string;

  resourceType: LearningResourceType;

  targetLevel: number;

  createdBy: string;
}

interface ListLearningResourcesInput {
  organizationId?: string;

  competencyType?: LearningResourceCompetencyType;

  competencyId?: string;

  includeInactive?: boolean;
}

interface UpdateLearningResourceInput {
  id: string;

  organizationId?: string;

  updates: {
    title?: string;
    description?: string;
    url?: string;
    provider?: string;
    resourceType?: LearningResourceType;
    targetLevel?: number;
    isActive?: boolean;
  };
}

interface DeleteLearningResourceInput {
  id: string;

  organizationId?: string;
}

interface RecommendationInput {
  gapAnalysisId: string;

  organizationId?: string;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function ensureObjectId(
  value: string,
  fieldName: string,
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(
      `${fieldName} is invalid`,
    );
  }

  return new Types.ObjectId(value);
}

function normalizeText(
  value: unknown,
  fieldName: string,
  required = false,
): string | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    if (required) {
      throw new Error(
        `${fieldName} is required`,
      );
    }

    return undefined;
  }

  const text = String(value).trim();

  if (!text) {
    if (required) {
      throw new Error(
        `${fieldName} is required`,
      );
    }

    return undefined;
  }

  return text;
}

function normalizeLevel(
  value: unknown,
  fieldName = "targetLevel",
): number {
  const level = Number(value);

  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 10
  ) {
    throw new Error(
      `${fieldName} must be an integer between 1 and 10`,
    );
  }

  return level;
}

function normalizeUrl(
  value: unknown,
): string {
  const url = normalizeText(
    value,
    "url",
    true,
  )!;

  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      "url must be a valid HTTP or HTTPS URL",
    );
  }

  return url;
}

function normalizeCompetencyType(
  value: unknown,
): LearningResourceCompetencyType {
  if (
    value !== "SKILL" &&
    value !== "BEHAVIOURAL_FACTOR"
  ) {
    throw new Error(
      "competencyType must be SKILL or BEHAVIOURAL_FACTOR",
    );
  }

  return value;
}

function normalizeResourceType(
  value: unknown,
): LearningResourceType {
  const allowed: LearningResourceType[] = [
    "COURSE",
    "ARTICLE",
    "VIDEO",
    "DOCUMENT",
    "CERTIFICATION",
    "OTHER",
  ];

  if (
    typeof value !== "string" ||
    !allowed.includes(
      value as LearningResourceType,
    )
  ) {
    throw new Error(
      `resourceType must be one of: ${allowed.join(", ")}`,
    );
  }

  return value as LearningResourceType;
}

/* -------------------------------------------------------------------------- */
/* Competency verification                                                    */
/* -------------------------------------------------------------------------- */

async function verifyCompetency(
  competencyType: LearningResourceCompetencyType,
  competencyId: string,
) {
  const objectId = ensureObjectId(
    competencyId,
    "competencyId",
  );

  if (competencyType === "SKILL") {
    const skill = await Skill.findById(
      objectId,
    )
      .select("_id name isActive")
      .lean()
      .exec();

    if (!skill) {
      throw new Error(
        "Skill not found",
      );
    }

    if (!skill.isActive) {
      throw new Error(
        "Skill is not active",
      );
    }

    return skill;
  }

  const behaviouralFactor =
    await BehaviouralFactor.findById(
      objectId,
    )
      .select("_id name isActive")
      .lean()
      .exec();

  if (!behaviouralFactor) {
    throw new Error(
      "Behavioural factor not found",
    );
  }

  if (!behaviouralFactor.isActive) {
    throw new Error(
      "Behavioural factor is not active",
    );
  }

  return behaviouralFactor;
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createLearningResource(
  input: CreateLearningResourceInput,
) {
  const competencyType =
    normalizeCompetencyType(
      input.competencyType,
    );

  const competencyId =
    ensureObjectId(
      input.competencyId,
      "competencyId",
    );

  const title = normalizeText(
    input.title,
    "title",
    true,
  )!;

  const description =
    normalizeText(
      input.description,
      "description",
    );

  const url = normalizeUrl(
    input.url,
  );

  const provider =
    normalizeText(
      input.provider,
      "provider",
    );

  const resourceType =
    normalizeResourceType(
      input.resourceType,
    );

  const targetLevel =
    normalizeLevel(
      input.targetLevel,
    );

  const createdBy =
    ensureObjectId(
      input.createdBy,
      "createdBy",
    );

  let organizationId:
    | Types.ObjectId
    | undefined;

  if (input.organizationId) {
    organizationId =
      ensureObjectId(
        input.organizationId,
        "organizationId",
      );
  }

  await verifyCompetency(
    competencyType,
    competencyId.toString(),
  );

  const resource =
    await LearningResource.create({
      organizationId,

      competencyType,

      competencyId,

      title,

      description,

      url,

      provider,

      resourceType,

      targetLevel,

      isActive: true,

      createdBy,
    });

  return resource;
}

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export async function listLearningResources(
  input: ListLearningResourcesInput,
) {
  const query: Record<
    string,
    unknown
  > = {};

  /*
   * Platform admins have no organization
   * restriction when organizationId is undefined.
   *
   * Organization users can see:
   *
   * 1. resources belonging to their organization
   * 2. global resources with no organizationId
   */
  if (input.organizationId) {
    const organizationId =
      ensureObjectId(
        input.organizationId,
        "organizationId",
      );

    query.$or = [
      {
        organizationId,
      },
      {
        organizationId: {
          $exists: false,
        },
      },
    ];
  }

  if (input.competencyType) {
    query.competencyType =
      normalizeCompetencyType(
        input.competencyType,
      );
  }

  if (input.competencyId) {
    query.competencyId =
      ensureObjectId(
        input.competencyId,
        "competencyId",
      );
  }

  if (!input.includeInactive) {
    query.isActive = true;
  }

  return LearningResource.find(
    query,
  )
    .populate(
      "createdBy",
      "firstName lastName email",
    )
    .sort({
      competencyType: 1,
      targetLevel: 1,
      createdAt: -1,
    })
    .lean()
    .exec();
}

/* -------------------------------------------------------------------------- */
/* Get one                                                                    */
/* -------------------------------------------------------------------------- */

export async function getLearningResourceById(
  id: string,
  organizationId?: string,
) {
  const query: Record<
    string,
    unknown
  > = {
    _id: ensureObjectId(
      id,
      "id",
    ),
  };

  if (organizationId) {
    const organizationObjectId =
      ensureObjectId(
        organizationId,
        "organizationId",
      );

    query.$or = [
      {
        organizationId:
          organizationObjectId,
      },
      {
        organizationId: {
          $exists: false,
        },
      },
    ];
  }

  const resource =
    await LearningResource.findOne(
      query,
    )
      .populate(
        "createdBy",
        "firstName lastName email",
      )
      .lean()
      .exec();

  if (!resource) {
    throw new Error(
      "Learning resource not found",
    );
  }

  return resource;
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateLearningResource(
  input: UpdateLearningResourceInput,
) {
  const id = ensureObjectId(
    input.id,
    "id",
  );

  const query: Record<
    string,
    unknown
  > = {
    _id: id,
  };

  if (input.organizationId) {
    query.organizationId =
      ensureObjectId(
        input.organizationId,
        "organizationId",
      );
  }

  const updates: Record<
    string,
    unknown
  > = {};

  if (
    input.updates.title !==
    undefined
  ) {
    updates.title =
      normalizeText(
        input.updates.title,
        "title",
        true,
      );
  }

  if (
    input.updates.description !==
    undefined
  ) {
    updates.description =
      normalizeText(
        input.updates.description,
        "description",
      );
  }

  if (
    input.updates.url !==
    undefined
  ) {
    updates.url =
      normalizeUrl(
        input.updates.url,
      );
  }

  if (
    input.updates.provider !==
    undefined
  ) {
    updates.provider =
      normalizeText(
        input.updates.provider,
        "provider",
      );
  }

  if (
    input.updates.resourceType !==
    undefined
  ) {
    updates.resourceType =
      normalizeResourceType(
        input.updates.resourceType,
      );
  }

  if (
    input.updates.targetLevel !==
    undefined
  ) {
    updates.targetLevel =
      normalizeLevel(
        input.updates.targetLevel,
      );
  }

  if (
    input.updates.isActive !==
    undefined
  ) {
    updates.isActive =
      Boolean(
        input.updates.isActive,
      );
  }

  if (
    Object.keys(updates)
      .length === 0
  ) {
    throw new Error(
      "No changes supplied",
    );
  }

  const resource =
    await LearningResource.findOneAndUpdate(
      query,
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate(
        "createdBy",
        "firstName lastName email",
      )
      .lean()
      .exec();

  if (!resource) {
    throw new Error(
      "Learning resource not found",
    );
  }

  return resource;
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteLearningResource(
  input: DeleteLearningResourceInput,
) {
  const query: Record<
    string,
    unknown
  > = {
    _id: ensureObjectId(
      input.id,
      "id",
    ),
  };

  if (input.organizationId) {
    query.organizationId =
      ensureObjectId(
        input.organizationId,
        "organizationId",
      );
  }

  /*
   * Soft-delete rather than physically
   * removing the resource.
   *
   * This preserves auditability and allows
   * old recommendations to remain explainable.
   */
  const resource =
    await LearningResource.findOneAndUpdate(
      query,
      {
        $set: {
          isActive: false,
        },
      },
      {
        new: true,
      },
    )
      .lean()
      .exec();

  if (!resource) {
    throw new Error(
      "Learning resource not found",
    );
  }

  return {
    id: resource._id,
    isActive: resource.isActive,
  };
}

/* -------------------------------------------------------------------------- */
/* Recommendation helpers                                                     */
/* -------------------------------------------------------------------------- */

function getCompetencyGaps(
  gapAnalysis: {
    skillGaps?: IGapCompetency[];
    behaviouralFactorGaps?: IGapCompetency[];
  },
): IGapCompetency[] {
  return [
    ...(gapAnalysis.skillGaps ?? []),
    ...(gapAnalysis.behaviouralFactorGaps ?? []),
  ].filter(
    (competency) =>
      competency.classification ===
      GapClassification.DEVELOPMENT_GAP,
  );
}

function resourceScore(
  resourceTargetLevel: number,
  currentLevel: number,
  targetLevel: number,
): number {
  /*
   * Lower score = closer match.
   *
   * Prefer resources that target a level
   * between the candidate's current level
   * and role target.
   */
  if (
    resourceTargetLevel >=
      currentLevel &&
    resourceTargetLevel <=
      targetLevel
  ) {
    return Math.abs(
      targetLevel -
        resourceTargetLevel,
    );
  }

  /*
   * Resources beyond the target are still
   * useful, but ranked after resources that
   * directly address the development range.
   */
  if (
    resourceTargetLevel >
    targetLevel
  ) {
    return (
      100 +
      resourceTargetLevel -
      targetLevel
    );
  }

  /*
   * Resources below current level are
   * fallback material.
   */
  return (
    200 +
    currentLevel -
    resourceTargetLevel
  );
}

/* -------------------------------------------------------------------------- */
/* Recommendations                                                            */
/* -------------------------------------------------------------------------- */

export async function getRecommendationsForGapAnalysis(
  input: RecommendationInput,
) {
  const gapQuery: Record<
    string,
    unknown
  > = {
    _id: ensureObjectId(
      input.gapAnalysisId,
      "gapAnalysisId",
    ),
  };

  if (input.organizationId) {
    gapQuery.organizationId =
      ensureObjectId(
        input.organizationId,
        "organizationId",
      );
  }

  const gapAnalysis =
    await GapAnalysis.findOne(
      gapQuery,
    )
      .lean()
      .exec();

  if (!gapAnalysis) {
    throw new Error(
      "Gap analysis not found",
    );
  }

  const gaps =
    getCompetencyGaps(
      gapAnalysis,
    );

  if (gaps.length === 0) {
    return {
      gapAnalysisId:
        gapAnalysis._id,
      gaps: [],
      totalGaps: 0,
      recommendations: [],
    };
  }

  const recommendations =
    [];

  for (const gap of gaps) {
    const resourceQuery: Record<
      string,
      unknown
    > = {
      competencyType:
        gap.competencyType,

      competencyId:
        gap.competencyId,

      isActive: true,
    };

    /*
     * Organization resources + global resources.
     */
    if (input.organizationId) {
      const organizationId =
        ensureObjectId(
          input.organizationId,
          "organizationId",
        );

      resourceQuery.$or = [
        {
          organizationId,
        },
        {
          organizationId: {
            $exists: false,
          },
        },
      ];
    }

    const resources =
      await LearningResource.find(
        resourceQuery,
      )
        .populate(
          "createdBy",
          "firstName lastName",
        )
        .lean()
        .exec();

    const sorted =
      resources
        .map((resource) => ({
          resource,
          recommendationScore:
            resourceScore(
              resource.targetLevel,
              gap.currentLevel,
              gap.targetLevel,
            ),
        }))
        .sort(
          (a, b) =>
            a.recommendationScore -
            b.recommendationScore,
        )
        .slice(0, 5);

    recommendations.push({
      competencyId:
        gap.competencyId,
      competencyType:
        gap.competencyType,
      competencyName:
        gap.competencyName,

      currentLevel:
        gap.currentLevel,

      targetLevel:
        gap.targetLevel,

      gap: gap.gap,

      classification:
        gap.classification,

      resources: sorted.map(
        (item) => item.resource,
      ),
    });
  }

  return {
    gapAnalysisId:
      gapAnalysis._id,

    totalGaps: gaps.length,

    gaps: recommendations,
  };
}