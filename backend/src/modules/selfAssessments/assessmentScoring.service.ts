import { Types } from "mongoose";

import {
  SelfAssessment,
  SelfAssessmentStatus,
} from "../../models/SelfAssessment";

import { SelfAssessmentResponse } from "../../models/SelfAssessmentResponse";

import {
  ManagerCorroboration,
  ManagerCorroborationStatus,
} from "../../models/ManagerCorroboration";

import {
  SelfAssessmentResult,
  SelfAssessmentResultStatus,
} from "../../models/selfAssessmentResult.model";

import { RoleProfile } from "../../models/RoleProfile";
import { User } from "../../models/User";
import { UserRole } from "../../constants/roles";

export interface FinalAssessmentResultItem {
  responseId: string;
  competencyType: "SKILL" | "BEHAVIOURAL_FACTOR";
  competencyId: string;
  selfAssessmentLevel: number;
  assessedLevel: number;
  targetLevel: number;
  gap: number;
}

export interface FinalAssessmentResult {
  selfAssessmentId: string;
  candidateId: string;
  roleProfileId: string;
  frameworkVersionId: string;
  assessedAt: Date;

  items: FinalAssessmentResultItem[];

  summary: {
    totalCompetencies: number;
    competenciesAtTarget: number;
    competenciesBelowTarget: number;
    competenciesAboveTarget: number;
    averageAssessedLevel: number;
    averageTargetLevel: number;
  };
}

function toObjectId(
  value: string | Types.ObjectId,
  fieldName: string,
): Types.ObjectId {
  if (value instanceof Types.ObjectId) {
    return value;
  }

  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return new Types.ObjectId(value);
}

function sameId(
  a?: Types.ObjectId | null,
  b?: Types.ObjectId | null,
): boolean {
  return Boolean(
    a &&
      b &&
      a.toString() === b.toString(),
  );
}

async function getAssessment(
  selfAssessmentId: Types.ObjectId,
) {
  const assessment = await SelfAssessment.findById(
    selfAssessmentId,
  );

  if (!assessment) {
    throw new Error("Self-assessment not found");
  }

  if (
    assessment.status !==
    SelfAssessmentStatus.SUBMITTED
  ) {
    throw new Error(
      "Only submitted self-assessments can be finalized",
    );
  }

  return assessment;
}

async function getCompleteResponses(
  assessmentId: Types.ObjectId,
) {
  const responses =
    await SelfAssessmentResponse.find({
      selfAssessmentId: assessmentId,
    });

  if (responses.length === 0) {
    throw new Error(
      "No self-assessment responses found",
    );
  }

  return responses;
}

function validateResponseCompetency(
  response: any,
) {
  const hasSkill = Boolean(response.skillId);
  const hasFactor = Boolean(
    response.behaviouralFactorId,
  );

  if (hasSkill === hasFactor) {
    throw new Error(
      `Response ${response._id} must reference exactly one competency`,
    );
  }
}

async function resolveFinalLevels(
  selfAssessmentId: Types.ObjectId,
) {
  const assessment =
    await getAssessment(selfAssessmentId);

  const profile = await RoleProfile.findById(
    assessment.roleProfileId,
  );

  if (!profile) {
    throw new Error("Role profile not found");
  }

  const responses =
    await getCompleteResponses(
      assessment._id,
    );

  const expectedSkillIds = new Set(
    profile.skills.map((item) =>
      item.skillId.toString(),
    ),
  );

  const expectedFactorIds = new Set(
    profile.behaviouralFactors.map((item) =>
      item.behaviouralFactorId.toString(),
    ),
  );

  const expectedCount =
    expectedSkillIds.size +
    expectedFactorIds.size;

  if (responses.length !== expectedCount) {
    throw new Error(
      "Every role profile competency must have a self-assessment response before final scoring",
    );
  }

  const seen = new Set<string>();

  for (const response of responses) {
    validateResponseCompetency(response);

    const key = response.skillId
      ? `SKILL:${response.skillId.toString()}`
      : `BEHAVIOURAL_FACTOR:${response.behaviouralFactorId!.toString()}`;

    if (seen.has(key)) {
      throw new Error(
        "Duplicate self-assessment competency response detected",
      );
    }

    seen.add(key);

    if (
      response.skillId &&
      !expectedSkillIds.has(
        response.skillId.toString(),
      )
    ) {
      throw new Error(
        "A response references a skill outside the role profile",
      );
    }

    if (
      response.behaviouralFactorId &&
      !expectedFactorIds.has(
        response.behaviouralFactorId.toString(),
      )
    ) {
      throw new Error(
        "A response references a behavioural factor outside the role profile",
      );
    }

    const selectedLevel =
      response.selectedLevel;

    if (
      !Number.isInteger(selectedLevel) ||
      selectedLevel < 1 ||
      selectedLevel > 10
    ) {
      throw new Error(
        `Response ${response._id} must have a valid self-assessment level between 1 and 10`,
      );
    }
  }

  const decisionMap = new Map<
    string,
    number
  >();

  if (assessment.corroborationRequired) {
    const corroboration =
      await ManagerCorroboration.findOne({
        selfAssessmentId:
          assessment._id,
        status:
          ManagerCorroborationStatus.COMPLETED,
      });

    if (!corroboration) {
      throw new Error(
        "Manager corroboration must be completed before final scoring",
      );
    }

    if (
      !sameId(
        corroboration.candidateId,
        assessment.candidateId,
      )
    ) {
      throw new Error(
        "Corroboration candidate does not match the self-assessment",
      );
    }

    const candidate =
      await User.findById(
        assessment.candidateId,
      ).select(
        "_id role managerId organizationId isActive",
      );

    const manager =
      await User.findById(
        corroboration.managerId,
      ).select(
        "_id role organizationId isActive",
      );

    if (
      !candidate ||
      candidate.role !== UserRole.STAFF ||
      !candidate.isActive
    ) {
      throw new Error(
        "Candidate is not a valid active staff member",
      );
    }

    if (
      !manager ||
      manager.role !== UserRole.MANAGER ||
      !manager.isActive
    ) {
      throw new Error(
        "Corroborating manager is not a valid active manager",
      );
    }

    if (
      !sameId(
        candidate.managerId,
        manager._id,
      )
    ) {
      throw new Error(
        "The corroborating manager is not the candidate's assigned manager",
      );
    }

    if (
      assessment.organizationId &&
      !sameId(
        assessment.organizationId,
        candidate.organizationId,
      )
    ) {
      throw new Error(
        "Self-assessment organization does not match the candidate organization",
      );
    }

    if (
      corroboration.organizationId &&
      candidate.organizationId &&
      !sameId(
        corroboration.organizationId,
        candidate.organizationId,
      )
    ) {
      throw new Error(
        "Corroboration organization does not match the candidate organization",
      );
    }

    if (
      manager.organizationId &&
      candidate.organizationId &&
      !sameId(
        manager.organizationId,
        candidate.organizationId,
      )
    ) {
      throw new Error(
        "Manager and candidate must belong to the same organization",
      );
    }

    const responseIds = new Set(
      responses.map((response) =>
        response._id.toString(),
      ),
    );

    const decisionIds = new Set<string>();

    for (const decision of corroboration.decisions ||
      []) {
      const responseId =
        decision.responseId.toString();

      if (decisionIds.has(responseId)) {
        throw new Error(
          "A corroboration response was reviewed more than once",
        );
      }

      decisionIds.add(responseId);

      if (!responseIds.has(responseId)) {
        throw new Error(
          "Corroboration contains a decision for an unknown response",
        );
      }

      const finalLevel =
        decision.finalLevel;

      if (
        !Number.isInteger(finalLevel) ||
        finalLevel < 1 ||
        finalLevel > 10
      ) {
        throw new Error(
          "Final assessed level must be an integer between 1 and 10",
        );
      }

      decisionMap.set(
        responseId,
        finalLevel,
      );
    }

    if (
      decisionIds.size !==
      responses.length
    ) {
      throw new Error(
        "Every self-assessment response must have a completed manager decision",
      );
    }

    for (const response of responses) {
      const responseId =
        response._id.toString();

      if (!decisionMap.has(responseId)) {
        throw new Error(
          `Missing manager decision for response ${responseId}`,
        );
      }
    }

    for (const responseId of decisionMap.keys()) {
      if (!responseIds.has(responseId)) {
        throw new Error(
          `Corroboration contains an invalid response ${responseId}`,
        );
      }
    }
  }

  return {
    assessment,
    profile,
    responses,
    decisionMap,
  };
}

async function buildFinalResultFromResolved(
  assessment: any,
  profile: any,
  responses: any[],
  finalLevelMap: Map<string, number>,
): Promise<FinalAssessmentResult> {
  const items: FinalAssessmentResultItem[] =
    [];

  for (const response of responses) {
    const finalLevel =
      finalLevelMap.get(
        response._id.toString(),
      );

    if (finalLevel === undefined) {
      throw new Error(
        `No final assessed level exists for response ${response._id}`,
      );
    }

    const selfAssessmentLevel =
      response.selectedLevel;

    if (
      !Number.isInteger(
        selfAssessmentLevel,
      ) ||
      selfAssessmentLevel < 1 ||
      selfAssessmentLevel > 10
    ) {
      throw new Error(
        `Response ${response._id} does not have a valid self-assessment level`,
      );
    }

    if (response.skillId) {
      const target =
        profile.skills.find(
          (item: any) =>
            item.skillId.toString() ===
            response.skillId.toString(),
        );

      if (!target) {
        throw new Error(
          "Skill response does not belong to the role profile",
        );
      }

      const targetLevel =
        target.targetLevel;

      if (
        !Number.isInteger(targetLevel) ||
        targetLevel < 1 ||
        targetLevel > 10
      ) {
        throw new Error(
          `Invalid target level configured for skill ${response.skillId}`,
        );
      }

      items.push({
        responseId:
          response._id.toString(),

        competencyType: "SKILL",

        competencyId:
          response.skillId.toString(),

        selfAssessmentLevel,

        assessedLevel: finalLevel,

        targetLevel,

        gap:
          targetLevel -
          finalLevel,
      });
    } else {
      const behaviouralFactorId =
        response.behaviouralFactorId;

      if (!behaviouralFactorId) {
        throw new Error(
          `Response ${response._id} does not reference a valid competency`,
        );
      }

      const target =
        profile.behaviouralFactors.find(
          (item: any) =>
            item.behaviouralFactorId.toString() ===
            behaviouralFactorId.toString(),
        );

      if (!target) {
        throw new Error(
          "Behavioural factor response does not belong to the role profile",
        );
      }

      const targetLevel =
        target.targetLevel;

      if (
        !Number.isInteger(targetLevel) ||
        targetLevel < 1 ||
        targetLevel > 10
      ) {
        throw new Error(
          `Invalid target level configured for behavioural factor ${behaviouralFactorId}`,
        );
      }

      items.push({
        responseId:
          response._id.toString(),

        competencyType:
          "BEHAVIOURAL_FACTOR",

        competencyId:
          behaviouralFactorId.toString(),

        selfAssessmentLevel,

        assessedLevel: finalLevel,

        targetLevel,

        gap:
          targetLevel -
          finalLevel,
      });
    }
  }

  if (
    items.length !==
    responses.length
  ) {
    throw new Error(
      "Unable to build a complete finalized result",
    );
  }

  const total = items.length;

  const atTarget =
    items.filter(
      (item) => item.gap === 0,
    ).length;

  const belowTarget =
    items.filter(
      (item) => item.gap > 0,
    ).length;

  const aboveTarget =
    items.filter(
      (item) => item.gap < 0,
    ).length;

  const averageAssessedLevel =
    total > 0
      ? Number(
          (
            items.reduce(
              (sum, item) =>
                sum +
                item.assessedLevel,
              0,
            ) / total
          ).toFixed(2),
        )
      : 0;

  const averageTargetLevel =
    total > 0
      ? Number(
          (
            items.reduce(
              (sum, item) =>
                sum +
                item.targetLevel,
              0,
            ) / total
          ).toFixed(2),
        )
      : 0;

  return {
    selfAssessmentId:
      assessment._id.toString(),

    candidateId:
      assessment.candidateId.toString(),

    roleProfileId:
      assessment.roleProfileId.toString(),

    frameworkVersionId:
      assessment.frameworkVersionId.toString(),

    assessedAt: new Date(),

    items,

    summary: {
      totalCompetencies: total,
      competenciesAtTarget: atTarget,
      competenciesBelowTarget:
        belowTarget,
      competenciesAboveTarget:
        aboveTarget,
      averageAssessedLevel,
      averageTargetLevel,
    },
  };
}

async function persistFinalResult(
  result: FinalAssessmentResult,
) {
  const selfAssessmentId =
    toObjectId(
      result.selfAssessmentId,
      "selfAssessmentId",
    );

  const assessment =
    await SelfAssessment.findById(
      selfAssessmentId,
    );

  if (!assessment) {
    throw new Error(
      "Self-assessment not found",
    );
  }

  const existing =
    await SelfAssessmentResult.findOne(
      {
        selfAssessmentId,
      },
    );

  if (existing) {
    if (
      existing.candidateId.toString() !==
        result.candidateId ||
      existing.roleProfileId.toString() !==
        result.roleProfileId ||
      existing.frameworkVersionId.toString() !==
        result.frameworkVersionId ||
      existing.status !==
        SelfAssessmentResultStatus.FINALIZED
    ) {
      throw new Error(
        "Existing self-assessment result does not match the finalized assessment",
      );
    }

    return existing;
  }

  return SelfAssessmentResult.create({
    organizationId:
      assessment.organizationId,

    selfAssessmentId,

    candidateId: toObjectId(
      result.candidateId,
      "candidateId",
    ),

    roleProfileId: toObjectId(
      result.roleProfileId,
      "roleProfileId",
    ),

    frameworkVersionId:
      toObjectId(
        result.frameworkVersionId,
        "frameworkVersionId",
      ),

    status:
      SelfAssessmentResultStatus.FINALIZED,

    assessedAt:
      result.assessedAt,

    items: result.items.map(
      (item) => ({
        responseId: toObjectId(
          item.responseId,
          "responseId",
        ),

        competencyType:
          item.competencyType,

        competencyId: toObjectId(
          item.competencyId,
          "competencyId",
        ),

        selfAssessmentLevel:
          item.selfAssessmentLevel,

        assessedLevel:
          item.assessedLevel,

        targetLevel:
          item.targetLevel,

        gap: item.gap,
      }),
    ),

    totalCompetencies:
      result.summary.totalCompetencies,

    competenciesAtTarget:
      result.summary
        .competenciesAtTarget,

    competenciesBelowTarget:
      result.summary
        .competenciesBelowTarget,

    competenciesAboveTarget:
      result.summary
        .competenciesAboveTarget,

    averageAssessedLevel:
      result.summary
        .averageAssessedLevel,

    averageTargetLevel:
      result.summary
        .averageTargetLevel,
  });
}

export async function finalizeWithoutCorroboration(
  selfAssessmentId: string,
) {
  const {
    assessment,
    profile,
    responses,
  } = await resolveFinalLevels(
    toObjectId(
      selfAssessmentId,
      "selfAssessmentId",
    ),
  );

  if (
    assessment.corroborationRequired
  ) {
    throw new Error(
      "This assessment requires manager corroboration",
    );
  }

  const existing =
    await SelfAssessmentResult.findOne(
      {
        selfAssessmentId:
          assessment._id,
      },
    );

  if (existing) {
    return existing;
  }

  const assessedAt = new Date();

  const finalLevelMap =
    new Map<string, number>();

  for (const response of responses) {
    const selectedLevel =
      response.selectedLevel;

    if (
      !Number.isInteger(selectedLevel) ||
      selectedLevel < 1 ||
      selectedLevel > 10
    ) {
      throw new Error(
        `Response ${response._id} does not have a valid self-assessment level`,
      );
    }

    if (
      response.resultLocked &&
      response.assessedLevel !==
        selectedLevel
    ) {
      throw new Error(
        "A locked response contains an invalid assessed level",
      );
    }

    finalLevelMap.set(
      response._id.toString(),
      selectedLevel,
    );
  }

  const result =
    await buildFinalResultFromResolved(
      assessment,
      profile,
      responses,
      finalLevelMap,
    );

  for (const response of responses) {
    const assessedLevel =
      finalLevelMap.get(
        response._id.toString(),
      );

    if (assessedLevel === undefined) {
      throw new Error(
        `Unable to determine final assessed level for response ${response._id}`,
      );
    }

    response.assessedLevel =
      assessedLevel;

    response.assessedAt =
      assessedAt;

    response.assessedBy =
      undefined;

    response.resultLocked =
      true;
  }

  await Promise.all(
    responses.map((response) =>
      response.save(),
    ),
  );

  result.assessedAt =
    assessedAt;

  return persistFinalResult(
    result,
  );
}

export async function finalizeAfterCorroboration(
  selfAssessmentId: string,
  managerId: string,
) {
  const {
    assessment,
    profile,
    responses,
    decisionMap,
  } = await resolveFinalLevels(
    toObjectId(
      selfAssessmentId,
      "selfAssessmentId",
    ),
  );

  if (
    !assessment.corroborationRequired
  ) {
    throw new Error(
      "This assessment does not require manager corroboration",
    );
  }

  const manager =
    await User.findOne({
      _id: toObjectId(
        managerId,
        "managerId",
      ),
      role: UserRole.MANAGER,
      isActive: true,
    });

  if (!manager) {
    throw new Error(
      "Manager not found",
    );
  }

  const candidate =
    await User.findById(
      assessment.candidateId,
    ).select(
      "_id role managerId organizationId isActive",
    );

  if (
    !candidate ||
    candidate.role !== UserRole.STAFF ||
    !candidate.isActive
  ) {
    throw new Error(
      "Candidate not found or inactive",
    );
  }

  if (
    !sameId(
      candidate.managerId,
      manager._id,
    )
  ) {
    throw new Error(
      "The manager is not assigned to this candidate",
    );
  }

  if (
    candidate.organizationId &&
    manager.organizationId &&
    !sameId(
      candidate.organizationId,
      manager.organizationId,
    )
  ) {
    throw new Error(
      "Manager and candidate must belong to the same organization",
    );
  }

  if (
    assessment.organizationId &&
    candidate.organizationId &&
    !sameId(
      assessment.organizationId,
      candidate.organizationId,
    )
  ) {
    throw new Error(
      "Self-assessment organization does not match the candidate organization",
    );
  }

  const existing =
    await SelfAssessmentResult.findOne(
      {
        selfAssessmentId:
          assessment._id,
      },
    );

  if (existing) {
    return existing;
  }

  const assessedAt =
    new Date();

  const finalLevelMap =
    new Map<string, number>();

  for (const response of responses) {
    const responseId =
      response._id.toString();

    const finalLevel =
      decisionMap.get(
        responseId,
      );

    if (finalLevel === undefined) {
      throw new Error(
        `No final decision exists for response ${responseId}`,
      );
    }

    if (
      !Number.isInteger(finalLevel) ||
      finalLevel < 1 ||
      finalLevel > 10
    ) {
      throw new Error(
        `Invalid final assessed level for response ${responseId}`,
      );
    }

    if (
      response.resultLocked &&
      response.assessedLevel !==
        finalLevel
    ) {
      throw new Error(
        `Response ${responseId} is already locked with a different final level`,
      );
    }

    finalLevelMap.set(
      responseId,
      finalLevel,
    );
  }

  const result =
    await buildFinalResultFromResolved(
      assessment,
      profile,
      responses,
      finalLevelMap,
    );

  for (const response of responses) {
    const finalLevel =
      finalLevelMap.get(
        response._id.toString(),
      );

    if (finalLevel === undefined) {
      throw new Error(
        `Unable to determine final assessed level for response ${response._id}`,
      );
    }

    response.assessedLevel =
      finalLevel;

    response.assessedAt =
      assessedAt;

    response.assessedBy =
      manager._id;

    response.resultLocked =
      true;
  }

  await Promise.all(
    responses.map((response) =>
      response.save(),
    ),
  );

  result.assessedAt =
    assessedAt;

  return persistFinalResult(
    result,
  );
}

/**
 * Builds the canonical finalized result
 * from responses that already contain final
 * assessed levels.
 *
 * This function does not finalize or mutate
 * the assessment.
 */
export async function buildFinalResult(
  selfAssessmentId: string | Types.ObjectId,
): Promise<FinalAssessmentResult> {
  const {
    assessment,
    profile,
    responses,
  } = await resolveFinalLevels(
    toObjectId(
      selfAssessmentId,
      "selfAssessmentId",
    ),
  );

  const finalLevelMap =
    new Map<string, number>();

  for (const response of responses) {
    const assessedLevel: number | undefined =
      response.assessedLevel;

    if (assessedLevel === undefined) {
      throw new Error(
        `Response ${response._id} does not have a final assessed level`,
      );
    }

    if (
      !Number.isInteger(assessedLevel) ||
      assessedLevel < 1 ||
      assessedLevel > 10
    ) {
      throw new Error(
        `Response ${response._id} must have a valid final assessed level between 1 and 10`,
      );
    }

    finalLevelMap.set(
      response._id.toString(),
      assessedLevel,
    );
  }

  return buildFinalResultFromResolved(
    assessment,
    profile,
    responses,
    finalLevelMap,
  );
}

export async function getPersistedFinalResult(
  selfAssessmentId:
    | string
    | Types.ObjectId,
) {
  return SelfAssessmentResult.findOne(
    {
      selfAssessmentId:
        toObjectId(
          selfAssessmentId,
          "selfAssessmentId",
        ),

      status:
        SelfAssessmentResultStatus.FINALIZED,
    },
  ).lean();
}

export async function assertResponsesUnlocked(
  selfAssessmentId: string,
) {
  const locked =
    await SelfAssessmentResponse.exists(
      {
        selfAssessmentId:
          toObjectId(
            selfAssessmentId,
            "selfAssessmentId",
          ),

        resultLocked: true,
      },
    );

  if (locked) {
    throw new Error(
      "The assessment result has been finalized and is locked",
    );
  }
}