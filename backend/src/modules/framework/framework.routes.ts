import {
  Types
} from "mongoose";

import {
  SelfAssessment,
  SelfAssessmentStatus
} from "../../models/SelfAssessment";

import {
  SelfAssessmentResponse,
  SelfAssessmentConfidence
} from "../../models/SelfAssessmentResponse";

import {
  finalizeWithoutCorroboration,
} from "../selfAssessments/assessmentScoring.service";

import {
  RoleProfile,
  RoleProfileStatus
} from "../../models/RoleProfile";

import {
  Skill
} from "../../models/Skill";

import {
  BehaviouralFactor
} from "../../models/BehaviouralFactor";

import {
  SkillLevel
} from "../../models/SkillLevel";

import {
  AssessmentEvaluation
} from "../../models/AssessmentEvaluation";

function ensureObjectId(
  value: string,
  fieldName: string
): Types.ObjectId {
  if (
    !Types.ObjectId.isValid(value)
  ) {
    throw new Error(
      `${fieldName} is invalid`
    );
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

function normalizeLevel(
  value: unknown
): number {
  const level = Number(value);

  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 10
  ) {
    throw new Error(
      "selectedLevel must be an integer between 1 and 10"
    );
  }

  return level;
}

function normalizeConfidence(
  value: unknown
): SelfAssessmentConfidence {
  if (
    Object.values(
      SelfAssessmentConfidence
    ).includes(
      value as SelfAssessmentConfidence
    )
  ) {
    return value as SelfAssessmentConfidence;
  }

  return SelfAssessmentConfidence.MEDIUM;
}

function normalizeEvidence(
  value: unknown
): string | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  const evidence =
    String(value).trim();

  if (!evidence) {
    return undefined;
  }

  if (evidence.length > 5000) {
    throw new Error(
      "Evidence cannot exceed 5000 characters"
    );
  }

  return evidence;
}

async function getRoleProfileOrThrow(
  roleProfileId: string,
  organizationId?: string
) {
  const query: Record<
    string,
    unknown
  > = {
    _id: ensureObjectId(
      roleProfileId,
      "roleProfileId"
    )
  };

  const orgId =
    normalizeOrganizationId(
      organizationId
    );

  if (orgId) {
    query.organizationId = orgId;
  }

  const profile =
    await RoleProfile.findOne(
      query
    );

  if (!profile) {
    throw new Error(
      "Role profile not found"
    );
  }

  return profile;
}

async function getSelfAssessmentOrThrow(
  selfAssessmentId: string,
  organizationId?: string
) {
  const query: Record<
    string,
    unknown
  > = {
    _id: ensureObjectId(
      selfAssessmentId,
      "selfAssessmentId"
    )
  };

  const orgId =
    normalizeOrganizationId(
      organizationId
    );

  if (orgId) {
    query.organizationId = orgId;
  }

  const selfAssessment =
    await SelfAssessment.findOne(
      query
    );

  if (!selfAssessment) {
    throw new Error(
      "Self-assessment not found"
    );
  }

  return selfAssessment;
}

async function getResponseOrThrow(
  responseId: string,
  organizationId?: string
) {
  const query: Record<
    string,
    unknown
  > = {
    _id: ensureObjectId(
      responseId,
      "responseId"
    )
  };

  const orgId =
    normalizeOrganizationId(
      organizationId
    );

  if (orgId) {
    query.organizationId = orgId;
  }

  const response =
    await SelfAssessmentResponse.findOne(
      query
    );

  if (!response) {
    throw new Error(
      "Self-assessment response not found"
    );
  }

  return response;
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createSelfAssessment(
  params: {
    candidateId: string;
    roleProfileId: string;
    organizationId?: string;
  }
) {
  const candidateId =
    ensureObjectId(
      params.candidateId,
      "candidateId"
    );

  const profile =
    await getRoleProfileOrThrow(
      params.roleProfileId,
      params.organizationId
    );

  if (
    profile.status !==
    RoleProfileStatus.PUBLISHED
  ) {
    throw new Error(
      "Self-assessment can only be created for a published role profile"
    );
  }

  /*
   * Prevent duplicate active self-assessments.
   */
  const existingQuery: Record<
    string,
    unknown
  > = {
    candidateId,
    roleProfileId:
      profile._id,
    status: {
      $in: [
        SelfAssessmentStatus.DRAFT,
        SelfAssessmentStatus.IN_PROGRESS,
        SelfAssessmentStatus.SUBMITTED
      ]
    }
  };

  if (
    profile.organizationId
  ) {
    existingQuery.organizationId =
      profile.organizationId;
  }

  const existing =
    await SelfAssessment.findOne(
      existingQuery
    ).sort({
      createdAt: -1
    });

  if (existing) {
    return existing;
  }

  const selfAssessment =
    await SelfAssessment.create({
      organizationId:
        profile.organizationId,

      candidateId,

      roleProfileId:
        profile._id,

      frameworkVersionId:
        profile.frameworkVersionId,

      status:
        SelfAssessmentStatus.DRAFT
    });

  return selfAssessment;
}

/* -------------------------------------------------------------------------- */
/* Get                                                                       */
/* -------------------------------------------------------------------------- */

export async function getSelfAssessment(
  selfAssessmentId: string,
  organizationId?: string
) {
  const selfAssessment =
    await getSelfAssessmentOrThrow(
      selfAssessmentId,
      organizationId
    );

  const responses =
    await SelfAssessmentResponse.find(
      {
        selfAssessmentId:
          selfAssessment._id
      }
    )
      .populate(
        "skillId",
        "name slug category description"
      )
      .populate(
        "behaviouralFactorId",
        "name slug description indicators"
      )
      .sort({
        createdAt: 1
      });

  const profile =
    await RoleProfile.findById(
      selfAssessment.roleProfileId
    ).select(
      "name slug description department status frameworkVersionId skills behaviouralFactors"
    );

  return {
    selfAssessment,
    roleProfile: profile,
    responses
  };
}

/* -------------------------------------------------------------------------- */
/* Start                                                                      */
/* -------------------------------------------------------------------------- */

export async function startSelfAssessment(
  selfAssessmentId: string,
  organizationId?: string
) {
  const selfAssessment =
    await getSelfAssessmentOrThrow(
      selfAssessmentId,
      organizationId
    );

  if (
    selfAssessment.status ===
    SelfAssessmentStatus.SUBMITTED
  ) {
    throw new Error(
      "This self-assessment has already been submitted"
    );
  }

  if (
    !selfAssessment.startedAt
  ) {
    selfAssessment.startedAt =
      new Date();
  }

  selfAssessment.status =
    SelfAssessmentStatus.IN_PROGRESS;

  await selfAssessment.save();

  return selfAssessment;
}

/* -------------------------------------------------------------------------- */
/* Add / Update Response                                                      */
/* -------------------------------------------------------------------------- */

export async function upsertSelfAssessmentResponse(
  params: {
    selfAssessmentId: string;
    organizationId?: string;
    skillId?: string;
    behaviouralFactorId?: string;
    selectedLevel: unknown;
    evidence?: unknown;
    confidence?: unknown;
  }
) {
  const selfAssessment =
    await getSelfAssessmentOrThrow(
      params.selfAssessmentId,
      params.organizationId
    );

  if (
    selfAssessment.status ===
    SelfAssessmentStatus.SUBMITTED
  ) {
    throw new Error(
      "Submitted self-assessments cannot be modified"
    );
  }

  const hasSkill =
    Boolean(params.skillId);

  const hasFactor =
    Boolean(
      params.behaviouralFactorId
    );

  if (
    hasSkill === hasFactor
  ) {
    throw new Error(
      "Provide exactly one of skillId or behaviouralFactorId"
    );
  }

  const selectedLevel =
    normalizeLevel(
      params.selectedLevel
    );

  const confidence =
    normalizeConfidence(
      params.confidence
    );

  const evidence =
    normalizeEvidence(
      params.evidence
    );

  const frameworkVersionId =
    selfAssessment.frameworkVersionId;

  if (params.skillId) {
    const skillId =
      ensureObjectId(
        params.skillId,
        "skillId"
      );

    const skill =
      await Skill.findOne({
        _id: skillId,
        frameworkVersionId,
        isActive: true
      });

    if (!skill) {
      throw new Error(
        "Skill is not active in this self-assessment's framework"
      );
    }

    const response =
      await SelfAssessmentResponse.findOneAndUpdate(
        {
          selfAssessmentId:
            selfAssessment._id,

          skillId
        },
        {
          organizationId:
            selfAssessment.organizationId,

          selfAssessmentId:
            selfAssessment._id,

          skillId,

          $unset: {
            behaviouralFactorId:
              ""
          },

          selectedLevel,

          evidence,

          confidence
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );

    if (
      selfAssessment.status ===
      SelfAssessmentStatus.DRAFT
    ) {
      selfAssessment.status =
        SelfAssessmentStatus.IN_PROGRESS;

      selfAssessment.startedAt =
        selfAssessment.startedAt ||
        new Date();

      await selfAssessment.save();
    }

    return response;
  }

  const behaviouralFactorId =
    ensureObjectId(
      params.behaviouralFactorId!,
      "behaviouralFactorId"
    );

  const factor =
    await BehaviouralFactor.findOne({
      _id: behaviouralFactorId,
      frameworkVersionId,
      isActive: true
    });

  if (!factor) {
    throw new Error(
      "Behavioural factor is not active in this self-assessment's framework"
    );
  }

  const response =
    await SelfAssessmentResponse.findOneAndUpdate(
      {
        selfAssessmentId:
          selfAssessment._id,

        behaviouralFactorId
      },
      {
        organizationId:
          selfAssessment.organizationId,

        selfAssessmentId:
          selfAssessment._id,

        behaviouralFactorId,

        $unset: {
          skillId: ""
        },

        selectedLevel,

        evidence,

        confidence
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

  if (
    selfAssessment.status ===
    SelfAssessmentStatus.DRAFT
  ) {
    selfAssessment.status =
      SelfAssessmentStatus.IN_PROGRESS;

    selfAssessment.startedAt =
      selfAssessment.startedAt ||
      new Date();

    await selfAssessment.save();
  }

  return response;
}

/* -------------------------------------------------------------------------- */
/* Delete Response                                                            */
/* -------------------------------------------------------------------------- */

export async function deleteSelfAssessmentResponse(
  responseId: string,
  organizationId?: string
) {
  const response =
    await getResponseOrThrow(
      responseId,
      organizationId
    );

  const selfAssessment =
    await getSelfAssessmentOrThrow(
      response.selfAssessmentId.toString(),
      organizationId
    );

  if (
    selfAssessment.status ===
    SelfAssessmentStatus.SUBMITTED
  ) {
    throw new Error(
      "Submitted self-assessments cannot be modified"
    );
  }

  await response.deleteOne();

  return {
    deleted: true,
    responseId: response._id.toString(),
    selfAssessmentId:
      response.selfAssessmentId.toString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Submit                                                                     */
/* -------------------------------------------------------------------------- */

export async function submitSelfAssessment(
  selfAssessmentId: string,
  organizationId?: string
) {
  const selfAssessment =
    await getSelfAssessmentOrThrow(
      selfAssessmentId,
      organizationId
    );

  if (
    selfAssessment.status ===
    SelfAssessmentStatus.SUBMITTED
  ) {
    throw new Error(
      "This self-assessment has already been submitted"
    );
  }

  const profile =
    await RoleProfile.findById(
      selfAssessment.roleProfileId
    );

  if (!profile) {
    throw new Error(
      "Role profile not found"
    );
  }

  const responses =
    await SelfAssessmentResponse.find({
      selfAssessmentId:
        selfAssessment._id
    });

  const expectedCompetencyCount =
    profile.skills.length +
    profile.behaviouralFactors.length;

  if (responses.length !== expectedCompetencyCount) {
    throw new Error(
      `Every role profile competency must be answered before submission. Expected ${expectedCompetencyCount} responses but received ${responses.length}.`
    );
  }

  /*
   * Validate that every submitted response still
   * belongs to the role profile.
   */
  const roleSkillIds =
    new Set(
      profile.skills.map(
        (item) =>
          item.skillId.toString()
      )
    );

  const roleFactorIds =
    new Set(
      profile.behaviouralFactors.map(
        (item) =>
          item.behaviouralFactorId.toString()
      )
    );

  for (const response of responses) {
    if (response.skillId) {
      if (
        !roleSkillIds.has(
          response.skillId.toString()
        )
      ) {
        throw new Error(
          "A self-assessment response references a skill that is not part of the role profile"
        );
      }
    }

    if (
      response.behaviouralFactorId
    ) {
      if (
        !roleFactorIds.has(
          response.behaviouralFactorId.toString()
        )
      ) {
        throw new Error(
          "A self-assessment response references a behavioural factor that is not part of the role profile"
        );
      }
    }
  }

  selfAssessment.status =
    SelfAssessmentStatus.SUBMITTED;

  selfAssessment.submittedAt =
    new Date();

  selfAssessment.startedAt =
    selfAssessment.startedAt ||
    new Date();

  await selfAssessment.save();

  if (!selfAssessment.corroborationRequired) {
    await finalizeWithoutCorroboration(
      selfAssessmentId
    );
  }

  return getSelfAssessment(
    selfAssessmentId,
    organizationId
  );
}

/* -------------------------------------------------------------------------- */
/* Candidate Self Assessments                                                 */
/* -------------------------------------------------------------------------- */

export async function listCandidateSelfAssessments(
  params: {
    candidateId?: string;
    organizationId?: string;
  }
) {
  /*
   * candidateId is optional so administrators can list every
   * self-assessment in their organization. At least one of
   * candidateId / organizationId must be supplied by the caller;
   * the controller enforces that.
   */
  const query: Record<
    string,
    unknown
  > = {};

  if (params.candidateId) {
    query.candidateId =
      ensureObjectId(
        params.candidateId,
        "candidateId"
      );
  }

  const orgId =
    normalizeOrganizationId(
      params.organizationId
    );

  if (orgId) {
    query.organizationId = orgId;
  }

  return SelfAssessment.find(
    query
  )
    .populate(
      "roleProfileId",
      "name slug department status"
    )
    .populate(
      "candidateId",
      "firstName lastName email jobTitle department"
    )
    .sort({
      createdAt: -1
    });
}

/* -------------------------------------------------------------------------- */
/* Corroboration                                                              */
/* -------------------------------------------------------------------------- */

interface CorroborationItem {
  competencyType:
    | "SKILL"
    | "BEHAVIOURAL_FACTOR";

  competencyId: string;

  competencyName: string;

  selfAssessmentLevel: number;

  targetLevel: number;

  objectiveLevel?: number;

  selfVsObjectiveGap?: number;

  selfVsTargetGap: number;

  confidence: SelfAssessmentConfidence;

  evidence?: string;

  status:
    | "CORROBORATED"
    | "OVER_SELF_ASSESSED"
    | "UNDER_SELF_ASSESSED"
    | "NO_OBJECTIVE_EVIDENCE";
}

function determineCorroborationStatus(
  selfLevel: number,
  objectiveLevel?: number
):
  | "CORROBORATED"
  | "OVER_SELF_ASSESSED"
  | "UNDER_SELF_ASSESSED"
  | "NO_OBJECTIVE_EVIDENCE" {
  if (
    objectiveLevel === undefined
  ) {
    return "NO_OBJECTIVE_EVIDENCE";
  }

  const difference =
    selfLevel - objectiveLevel;

  if (
    Math.abs(difference) <= 1
  ) {
    return "CORROBORATED";
  }

  if (difference > 1) {
    return "OVER_SELF_ASSESSED";
  }

  return "UNDER_SELF_ASSESSED";
}

function getObjectiveLevel(
  evaluation: any,
  competencyId: string,
  competencyType:
    | "SKILL"
    | "BEHAVIOURAL_FACTOR"
): number | undefined {
  if (!evaluation) {
    return undefined;
  }

  const collection =
    competencyType === "SKILL"
      ? evaluation.skillScores
      : evaluation.behaviouralFactorScores;

  if (
    !Array.isArray(collection)
  ) {
    return undefined;
  }

  const item =
    collection.find(
      (entry: any) => {
        const id =
          competencyType ===
          "SKILL"
            ? entry.skillId
            : entry.behaviouralFactorId;

        return (
          id?.toString() ===
          competencyId
        );
      }
    );

  if (!item) {
    return undefined;
  }

  const level = Number(
    item.level ??
      item.scoreLevel ??
      item.achievedLevel ??
      item.averageLevel
  );

  if (
    !Number.isFinite(level)
  ) {
    return undefined;
  }

  return level;
}

export async function getSelfAssessmentCorroboration(
  params: {
    selfAssessmentId: string;
    organizationId?: string;
  }
) {
  const selfAssessment =
    await getSelfAssessmentOrThrow(
      params.selfAssessmentId,
      params.organizationId
    );

  const profile =
    await RoleProfile.findById(
      selfAssessment.roleProfileId
    );

  if (!profile) {
    throw new Error(
      "Role profile not found"
    );
  }

  const responses =
    await SelfAssessmentResponse.find({
      selfAssessmentId:
        selfAssessment._id
    })
      .populate(
        "skillId",
        "name"
      )
      .populate(
        "behaviouralFactorId",
        "name"
      );

  /*
   * Batch 9 uses the latest completed/pending
   * objective evaluation for the candidate.
   *
   * The query is deliberately scoped to the candidate
   * and assessment evaluation documents.
   */
  const evaluation =
    await AssessmentEvaluation.findOne(
      {
        candidateId:
          selfAssessment.candidateId,

        assessmentId: {
          $exists: true
        },

        status: {
          $in: [
            "COMPLETED",
            "PENDING_REVIEW"
          ]
        }
      }
    ).sort({
      evaluatedAt: -1,
      createdAt: -1
    });

  const items: CorroborationItem[] =
    [];

  for (const response of responses) {
    if (response.skillId) {
      const skillId =
        response.skillId.toString();

      const roleSkill =
        profile.skills.find(
          (item) =>
            item.skillId.toString() ===
            skillId
        );

      if (!roleSkill) {
        continue;
      }

      const populatedSkill =
        response.skillId as any;

      const objectiveLevel =
        getObjectiveLevel(
          evaluation,
          skillId,
          "SKILL"
        );

      items.push({
        competencyType: "SKILL",

        competencyId: skillId,

        competencyName:
          populatedSkill?.name ||
          "Skill",

        selfAssessmentLevel:
          response.selectedLevel,

        targetLevel:
          roleSkill.targetLevel,

        objectiveLevel,

        selfVsObjectiveGap:
          objectiveLevel ===
          undefined
            ? undefined
            : response.selectedLevel -
              objectiveLevel,

        selfVsTargetGap:
          response.selectedLevel -
          roleSkill.targetLevel,

        confidence:
          response.confidence,

        evidence:
          response.evidence,

        status:
          determineCorroborationStatus(
            response.selectedLevel,
            objectiveLevel
          )
      });
    }

    if (
      response.behaviouralFactorId
    ) {
      const factorId =
        response.behaviouralFactorId.toString();

      const roleFactor =
        profile.behaviouralFactors.find(
          (item) =>
            item.behaviouralFactorId.toString() ===
            factorId
        );

      if (!roleFactor) {
        continue;
      }

      const populatedFactor =
        response.behaviouralFactorId as any;

      const objectiveLevel =
        getObjectiveLevel(
          evaluation,
          factorId,
          "BEHAVIOURAL_FACTOR"
        );

      items.push({
        competencyType:
          "BEHAVIOURAL_FACTOR",

        competencyId:
          factorId,

        competencyName:
          populatedFactor?.name ||
          "Behavioural factor",

        selfAssessmentLevel:
          response.selectedLevel,

        targetLevel:
          roleFactor.targetLevel,

        objectiveLevel,

        selfVsObjectiveGap:
          objectiveLevel ===
          undefined
            ? undefined
            : response.selectedLevel -
              objectiveLevel,

        selfVsTargetGap:
          response.selectedLevel -
          roleFactor.targetLevel,

        confidence:
          response.confidence,

        evidence:
          response.evidence,

        status:
          determineCorroborationStatus(
            response.selectedLevel,
            objectiveLevel
          )
      });
    }
  }

  const summary = {
    totalCompetencies:
      items.length,

    corroborated:
      items.filter(
        (item) =>
          item.status ===
          "CORROBORATED"
      ).length,

    overSelfAssessed:
      items.filter(
        (item) =>
          item.status ===
          "OVER_SELF_ASSESSED"
      ).length,

    underSelfAssessed:
      items.filter(
        (item) =>
          item.status ===
          "UNDER_SELF_ASSESSED"
      ).length,

    noObjectiveEvidence:
      items.filter(
        (item) =>
          item.status ===
          "NO_OBJECTIVE_EVIDENCE"
      ).length
  };

  return {
    selfAssessment,
    roleProfile: profile,
    objectiveEvaluation: evaluation,
    summary,
    items
  };
}