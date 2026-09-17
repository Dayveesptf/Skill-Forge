import { Types } from "mongoose";

import GapAnalysis, {
  GapAnalysisSource,
  GapClassification,
  IGapCompetency
} from "../../models/GapAnalysis";

import { User } from "../../models/User.js";

import {
  RoleProfile
} from "../../models/RoleProfile";

import {
  Skill
} from "../../models/Skill";

import {
  BehaviouralFactor
} from "../../models/BehaviouralFactor";

import SelfAssessment, {
  SelfAssessmentStatus
} from "../../models/SelfAssessment";

import SelfAssessmentResponse from "../../models/SelfAssessmentResponse";

import AssessmentEvaluation from "../../models/AssessmentEvaluation";

import { cached, invalidateCache } from "../../config/redis";

interface GenerateGapAnalysisInput {
  candidateId: string;
  roleProfileId: string;
  organizationId?: string;
  assessmentEvaluationId?: string;
}

interface CandidateDashboardInput {
  candidateId: string;
  organizationId?: string;
}

interface OrganizationDashboardInput {
  organizationId?: string;
}

interface CompetencySource {
  competencyId: string;
  targetLevel: number;
  weight: number;
  type: "SKILL" | "BEHAVIOURAL_FACTOR";
}

interface EvidenceData {
  selfLevel?: number;
  selfEvidence?: string;
  confidence?: string;
  objectiveLevel?: number;
}

function toObjectId(
  value: string,
  fieldName: string
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return new Types.ObjectId(value);
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function normalizePercentage(
  value: unknown
): number | undefined {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return undefined;
  }

  if (
    numericValue >= 0 &&
    numericValue <= 1
  ) {
    return clamp(
      numericValue * 100,
      0,
      100
    );
  }

  if (
    numericValue >= 0 &&
    numericValue <= 100
  ) {
    return clamp(
      numericValue,
      0,
      100
    );
  }

  return undefined;
}

function percentageToLevel(
  value: unknown
): number | undefined {
  const percentage =
    normalizePercentage(value);

  if (percentage === undefined) {
    return undefined;
  }

  return clamp(
    Math.round(percentage / 10),
    0,
    10
  );
}

function extractObjectiveLevel(
  scores: unknown[],
  competencyId: string,
  type:
    | "SKILL"
    | "BEHAVIOURAL_FACTOR"
): number | undefined {
  if (!Array.isArray(scores)) {
    return undefined;
  }

  const entry = scores.find((item) => {
    if (
      !item ||
      typeof item !== "object"
    ) {
      return false;
    }

    const record =
      item as Record<string, unknown>;

    const possibleId =
      type === "SKILL"
        ? record.skillId
        : record.behaviouralFactorId;

    return (
      possibleId?.toString() ===
      competencyId
    );
  });

  if (
    !entry ||
    typeof entry !== "object"
  ) {
    return undefined;
  }

  const record =
    entry as Record<string, unknown>;

  const directLevelValues = [
    record.level,
    record.achievedLevel,
    record.scoreLevel,
    record.averageLevel,
    record.currentLevel
  ];

  for (
    const value of directLevelValues
  ) {
    const level = Number(value);

    if (
      Number.isFinite(level) &&
      level >= 0 &&
      level <= 10
    ) {
      return Math.round(level);
    }
  }

  const percentageValues = [
    record.percentage,
    record.score,
    record.scorePercentage
  ];

  for (
    const value of percentageValues
  ) {
    const level =
      percentageToLevel(value);

    if (level !== undefined) {
      return level;
    }
  }

  return undefined;
}

function getCurrentLevel(
  selfLevel?: number,
  objectiveLevel?: number
): number {
  if (
    objectiveLevel !== undefined
  ) {
    return clamp(
      objectiveLevel,
      0,
      10
    );
  }

  if (
    selfLevel !== undefined
  ) {
    return clamp(
      selfLevel,
      0,
      10
    );
  }

  return 0;
}

function getClassification(
  currentLevel: number,
  targetLevel: number
): GapClassification {
  if (currentLevel === 0) {
    return GapClassification.NO_EVIDENCE;
  }

  if (currentLevel > targetLevel) {
    return GapClassification.STRENGTH;
  }

  if (currentLevel === targetLevel) {
    return GapClassification.AT_TARGET;
  }

  return GapClassification.DEVELOPMENT_GAP;
}

function getSource(
  hasSelfEvidence: boolean,
  hasObjectiveEvidence: boolean
): GapAnalysisSource {
  if (
    hasSelfEvidence &&
    hasObjectiveEvidence
  ) {
    return (
      GapAnalysisSource.SELF_ASSESSMENT_AND_OBJECTIVE
    );
  }

  if (hasSelfEvidence) {
    return (
      GapAnalysisSource.SELF_ASSESSMENT_ONLY
    );
  }

  if (hasObjectiveEvidence) {
    return GapAnalysisSource.OBJECTIVE_ONLY;
  }

  return GapAnalysisSource.ROLE_PROFILE_ONLY;
}

function buildSummary(
  competencyCount: number,
  strengthsCount: number,
  developmentAreasCount: number,
  readinessPercentage: number,
  competenciesWithObjectiveEvidence: number
): string {
  if (competencyCount === 0) {
    return "No competencies have been configured for this role profile.";
  }

  const readiness =
    Math.round(
      readinessPercentage
    );

  if (
    competenciesWithObjectiveEvidence === 0
  ) {
    return `Current readiness is approximately ${readiness}%. Objective assessment evidence is not yet available, so the analysis is primarily based on self-assessment data.`;
  }

  if (
    developmentAreasCount === 0
  ) {
    return `Current readiness is approximately ${readiness}%. The candidate currently meets or exceeds the target level across all assessed competencies.`;
  }

  return `Current readiness is approximately ${readiness}%. ${strengthsCount} competency area(s) currently meet or exceed the target, while ${developmentAreasCount} area(s) require further development.`;
}

/**
 * SECURITY HARDENING
 *
 * Validates that the candidate and selected role profile
 * belong to the same organization.
 *
 * The controller still performs the user-level candidate
 * authorization through canAccessCandidate().
 *
 * This is an additional service-level defense so that even
 * if this service is called internally with arbitrary IDs,
 * candidates and role profiles cannot be mixed across
 * organizations.
 *
 * Platform admins may operate across organizations, so
 * organizationId can be omitted for them.
 */
async function verifyCandidateRoleRelationship(
  candidateId: Types.ObjectId,
  roleProfileId: Types.ObjectId,
  organizationId?: Types.ObjectId
): Promise<{
  candidate: {
    _id: Types.ObjectId;
    organizationId?: Types.ObjectId;
    isActive?: boolean;
  };
  roleProfile: any;
}> {
  const candidate =
    await import('../../models/User.js').then(
      ({ User }) =>
        User.findById(candidateId)
          .select(
            "_id organizationId isActive"
          )
          .lean()
          .exec()
    );

  if (!candidate) {
    throw new Error(
      "Candidate not found"
    );
  }

  if (candidate.isActive === false) {
    throw new Error(
      "Candidate is inactive"
    );
  }

  /*
   * If an organization context exists,
   * the candidate must belong to it.
   */
  if (
    organizationId &&
    (
      !candidate.organizationId ||
      candidate.organizationId.toString() !==
        organizationId.toString()
    )
  ) {
    throw new Error(
      "Candidate does not belong to this organization"
    );
  }

  const roleProfileQuery: Record<
    string,
    unknown
  > = {
    _id: roleProfileId
  };

  /*
   * Organization-scoped users can only
   * access role profiles belonging to
   * their organization.
   */
  if (organizationId) {
    roleProfileQuery.organizationId =
      organizationId;
  }
  /*
   * Platform admins may omit organizationId.
   * In that case, when the candidate belongs
   * to an organization, use that organization
   * to ensure the candidate and role profile
   * still belong together.
   */
  else if (candidate.organizationId) {
    roleProfileQuery.organizationId =
      candidate.organizationId;
  }

  const roleProfile =
    await RoleProfile.findOne(
      roleProfileQuery
    )
      .lean()
      .exec();

  if (!roleProfile) {
    throw new Error(
      "Role profile does not belong to the candidate's organization"
    );
  }

  /*
   * Final explicit relationship check.
   */
  if (
    candidate.organizationId &&
    roleProfile.organizationId &&
    candidate.organizationId.toString() !==
      roleProfile.organizationId.toString()
  ) {
    throw new Error(
      "Candidate and role profile belong to different organizations"
    );
  }

  return {
    candidate,
    roleProfile
  };
}

async function getSelfAssessmentEvidence(
  candidateId: Types.ObjectId,
  roleProfileId: Types.ObjectId,
  organizationId?: Types.ObjectId
): Promise<{
  assessmentId?: Types.ObjectId;
  responses: Map<
    string,
    EvidenceData
  >;
}> {
  const query: Record<
    string,
    unknown
  > = {
    candidateId,
    roleProfileId,
    status:
      SelfAssessmentStatus.SUBMITTED
  };

  if (organizationId) {
    query.organizationId =
      organizationId;
  }

  const assessment =
    await SelfAssessment.findOne(query)
      .sort({
        submittedAt: -1,
        createdAt: -1
      })
      .lean()
      .exec();

  if (!assessment) {
    return {
      responses: new Map()
    };
  }

  const responseQuery: Record<
    string,
    unknown
  > = {
    selfAssessmentId:
      assessment._id
  };

  if (organizationId) {
    responseQuery.organizationId =
      organizationId;
  }

  const responses =
    await SelfAssessmentResponse.find(
      responseQuery
    )
      .lean()
      .exec();

  const map = new Map<
    string,
    EvidenceData
  >();

  for (const response of responses) {
    const record =
      response as unknown as Record<
        string,
        unknown
      >;

    const skillId =
      record.skillId?.toString();

    const behaviouralFactorId =
      record.behaviouralFactorId?.toString();

    const competencyId =
      skillId ||
      behaviouralFactorId;

    if (!competencyId) {
      continue;
    }

    map.set(competencyId, {
      selfLevel:
        Number(record.selectedLevel),

      selfEvidence:
        typeof record.evidence ===
        "string"
          ? record.evidence
          : undefined,

      confidence:
        typeof record.confidence ===
        "string"
          ? record.confidence
          : undefined
    });
  }

  return {
    assessmentId:
      assessment._id,
    responses: map
  };
}

async function getObjectiveEvidence(
  candidateId: Types.ObjectId,
  organizationId:
    | Types.ObjectId
    | undefined,
  assessmentEvaluationId?: string
): Promise<{
  evaluationId?: Types.ObjectId;
  skillScores: unknown[];
  behaviouralFactorScores: unknown[];
}> {
  const query: Record<
    string,
    unknown
  > = {
    candidateId
  };

  if (organizationId) {
    query.organizationId =
      organizationId;
  }

  if (assessmentEvaluationId) {
    query._id = toObjectId(
      assessmentEvaluationId,
      "assessmentEvaluationId"
    );
  }

  const evaluation =
    await AssessmentEvaluation.findOne(
      query
    )
      .sort({
        evaluatedAt: -1,
        createdAt: -1
      })
      .lean()
      .exec();

  if (!evaluation) {
    return {
      skillScores: [],
      behaviouralFactorScores: []
    };
  }

  const record =
    evaluation as unknown as Record<
      string,
      unknown
    >;

  return {
    evaluationId:
      evaluation._id,

    skillScores:
      Array.isArray(
        record.skillScores
      )
        ? record.skillScores
        : [],

    behaviouralFactorScores:
      Array.isArray(
        record.behaviouralFactorScores
      )
        ? record.behaviouralFactorScores
        : []
  };
}

async function buildCompetency(
  source: CompetencySource,
  name: string,
  selfEvidence:
    | EvidenceData
    | undefined,
  objectiveScores: unknown[]
): Promise<IGapCompetency> {
  const competencyId =
    source.competencyId;

  const objectiveLevel =
    extractObjectiveLevel(
      objectiveScores,
      competencyId,
      source.type
    );

  const selfLevel =
    selfEvidence?.selfLevel;

  const currentLevel =
    getCurrentLevel(
      selfLevel,
      objectiveLevel
    );

  const gap =
    source.targetLevel -
    currentLevel;

  const readinessPercentage =
    source.targetLevel > 0
      ? clamp(
          (currentLevel /
            source.targetLevel) *
            100,
          0,
          100
        )
      : 0;

  const classification =
    getClassification(
      currentLevel,
      source.targetLevel
    );

  const result: IGapCompetency = {
    competencyType:
      source.type,

    competencyId:
      new Types.ObjectId(
        competencyId
      ),

    competencyName: name,

    targetLevel:
      source.targetLevel,

    currentLevel,

    gap,

    readinessPercentage,

    weight: source.weight,

    classification
  };

  if (
    selfLevel !== undefined
  ) {
    result.selfAssessmentLevel =
      selfLevel;
  }

  if (
    objectiveLevel !== undefined
  ) {
    result.objectiveLevel =
      objectiveLevel;
  }

  if (
    selfLevel !== undefined &&
    objectiveLevel !== undefined
  ) {
    result.selfVsObjectiveGap =
      selfLevel -
      objectiveLevel;
  }

  if (
    selfEvidence?.selfEvidence
  ) {
    result.evidence =
      selfEvidence.selfEvidence;
  }

  if (
    selfEvidence?.confidence
  ) {
    result.confidence =
      selfEvidence.confidence;
  }

  return result;
}

export async function generateGapAnalysis(
  input: GenerateGapAnalysisInput
) {
  const candidateId =
    toObjectId(
      input.candidateId,
      "candidateId"
    );

  const roleProfileId =
    toObjectId(
      input.roleProfileId,
      "roleProfileId"
    );

  const organizationId =
    input.organizationId
      ? toObjectId(
          input.organizationId,
          "organizationId"
        )
      : undefined;

  /*
   * SECURITY HARDENING
   *
   * Validate the candidate ↔ role-profile
   * relationship before doing any evidence
   * lookup or creating an analysis.
   */
  const {
    roleProfile
  } =
    await verifyCandidateRoleRelationship(
      candidateId,
      roleProfileId,
      organizationId
    );

  const selfEvidence =
    await getSelfAssessmentEvidence(
      candidateId,
      roleProfileId,
      organizationId
    );

  const objectiveEvidence =
    await getObjectiveEvidence(
      candidateId,
      organizationId,
      input.assessmentEvaluationId
    );

  const roleSkills =
    Array.isArray(
      roleProfile.skills
    )
      ? roleProfile.skills
      : [];

  const roleBehaviouralFactors =
    Array.isArray(
      roleProfile.behaviouralFactors
    )
      ? roleProfile.behaviouralFactors
      : [];

  const skillIds =
    roleSkills.map(
      (item: { skillId: { toString: () => any; }; }) =>
        item.skillId.toString()
    );

  const behaviouralFactorIds =
    roleBehaviouralFactors.map(
      (item: { behaviouralFactorId: { toString: () => any; }; }) =>
        item.behaviouralFactorId.toString()
    );

  const [
    skills,
    behaviouralFactors
  ] = await Promise.all([
    Skill.find({
      _id: {
        $in: skillIds
      },
      frameworkVersionId:
        roleProfile.frameworkVersionId
    })
      .lean()
      .exec(),

    BehaviouralFactor.find({
      _id: {
        $in: behaviouralFactorIds
      },
      frameworkVersionId:
        roleProfile.frameworkVersionId
    })
      .lean()
      .exec()
  ]);

  const skillNameMap =
    new Map<string, string>();

  for (
    const skill of skills
  ) {
    skillNameMap.set(
      skill._id.toString(),
      String(skill.name)
    );
  }

  const behaviouralFactorNameMap =
    new Map<string, string>();

  for (
    const factor of behaviouralFactors
  ) {
    behaviouralFactorNameMap.set(
      factor._id.toString(),
      String(factor.name)
    );
  }

  const skillGaps:
    IGapCompetency[] = [];

  for (
    const roleSkill of roleSkills
  ) {
    const skillId =
      roleSkill.skillId.toString();

    const name =
      skillNameMap.get(skillId) ||
      "Unknown Skill";

    const targetLevel =
      Number(
        roleSkill.targetLevel
      );

    const weight =
      Number(
        roleSkill.weight ?? 1
      );

    const competency =
      await buildCompetency(
        {
          competencyId:
            skillId,

          targetLevel,

          weight,

          type: "SKILL"
        },

        name,

        selfEvidence.responses.get(
          skillId
        ),

        objectiveEvidence.skillScores
      );

    skillGaps.push(
      competency
    );
  }

  const behaviouralFactorGaps:
    IGapCompetency[] = [];

  for (
    const roleFactor of
      roleBehaviouralFactors
  ) {
    const factorId =
      roleFactor.behaviouralFactorId.toString();

    const name =
      behaviouralFactorNameMap.get(
        factorId
      ) ||
      "Unknown Behavioural Factor";

    const targetLevel =
      Number(
        roleFactor.targetLevel
      );

    const weight =
      Number(
        roleFactor.weight ?? 1
      );

    const competency =
      await buildCompetency(
        {
          competencyId:
            factorId,

          targetLevel,

          weight,

          type:
            "BEHAVIOURAL_FACTOR"
        },

        name,

        selfEvidence.responses.get(
          factorId
        ),

        objectiveEvidence.behaviouralFactorScores
      );

    behaviouralFactorGaps.push(
      competency
    );
  }

  const allCompetencies = [
    ...skillGaps,
    ...behaviouralFactorGaps
  ];

  let totalWeight = 0;
  let weightedTarget = 0;
  let weightedCurrent = 0;
  let weightedReadiness = 0;

  let strengthsCount = 0;
  let developmentAreasCount = 0;

  let competenciesWithObjectiveEvidence =
    0;

  let competenciesWithSelfEvidence =
    0;

  for (
    const competency of
      allCompetencies
  ) {
    const weight =
      competency.weight > 0
        ? competency.weight
        : 1;

    totalWeight += weight;

    weightedTarget +=
      competency.targetLevel *
      weight;

    weightedCurrent +=
      competency.currentLevel *
      weight;

    weightedReadiness +=
      competency.readinessPercentage *
      weight;

    if (
      competency.classification ===
        GapClassification.STRENGTH ||
      competency.classification ===
        GapClassification.AT_TARGET
    ) {
      strengthsCount++;
    }

    if (
      competency.classification ===
      GapClassification.DEVELOPMENT_GAP
    ) {
      developmentAreasCount++;
    }

    if (
      competency.objectiveLevel !==
      undefined
    ) {
      competenciesWithObjectiveEvidence++;
    }

    if (
      competency.selfAssessmentLevel !==
      undefined
    ) {
      competenciesWithSelfEvidence++;
    }
  }

  const overallTargetLevel =
    totalWeight > 0
      ? weightedTarget /
        totalWeight
      : 0;

  const overallCurrentLevel =
    totalWeight > 0
      ? weightedCurrent /
        totalWeight
      : 0;

  const readinessPercentage =
    totalWeight > 0
      ? weightedReadiness /
        totalWeight
      : 0;

  const overallGap =
    overallTargetLevel -
    overallCurrentLevel;

  const source =
    getSource(
      competenciesWithSelfEvidence >
        0,

      competenciesWithObjectiveEvidence >
        0
    );

  const summary =
    buildSummary(
      allCompetencies.length,
      strengthsCount,
      developmentAreasCount,
      readinessPercentage,
      competenciesWithObjectiveEvidence
    );

  const gapAnalysis =
    await GapAnalysis.create({
      organizationId,

      candidateId,

      roleProfileId,

      frameworkVersionId:
        roleProfile.frameworkVersionId,

      selfAssessmentId:
        selfEvidence.assessmentId,

      objectiveEvaluationId:
        objectiveEvidence.evaluationId,

      source,

      status: "GENERATED",

      overallTargetLevel:
        Number(
          overallTargetLevel.toFixed(2)
        ),

      overallCurrentLevel:
        Number(
          overallCurrentLevel.toFixed(2)
        ),

      overallGap:
        Number(
          overallGap.toFixed(2)
        ),

      readinessPercentage:
        Number(
          readinessPercentage.toFixed(2)
        ),

      competencyCount:
        allCompetencies.length,

      competenciesWithObjectiveEvidence,

      competenciesWithSelfEvidence,

      strengthsCount,

      developmentAreasCount,

      skillGaps,

      behaviouralFactorGaps,

      summary,

      generatedAt: new Date()
    });

  await invalidateCache(
    `gap-analysis:org-dashboard:${input.organizationId || "platform"}`
  );

  return gapAnalysis;
}

export async function getLatestGapAnalysis(
  candidateId: string,
  roleProfileId: string,
  organizationId?: string
) {
  const candidateObjectId =
    toObjectId(
      candidateId,
      "candidateId"
    );

  const roleProfileObjectId =
    toObjectId(
      roleProfileId,
      "roleProfileId"
    );

  const organizationObjectId =
    organizationId
      ? toObjectId(
          organizationId,
          "organizationId"
        )
      : undefined;

  /*
   * SECURITY HARDENING
   *
   * Prevent arbitrary candidate/role-profile
   * combinations.
   */
  await verifyCandidateRoleRelationship(
    candidateObjectId,
    roleProfileObjectId,
    organizationObjectId
  );

  const query: Record<
    string,
    unknown
  > = {
    candidateId:
      candidateObjectId,

    roleProfileId:
      roleProfileObjectId
  };

  if (
    organizationObjectId
  ) {
    query.organizationId =
      organizationObjectId;
  }

  const analysis =
    await GapAnalysis.findOne(
      query
    )
      .sort({
        generatedAt: -1
      })
      .populate(
        "roleProfileId",
        "name slug status"
      )
      .populate(
        "frameworkVersionId",
        "name version"
      )
      .lean()
      .exec();

  /*
   * IMPORTANT:
   *
   * No analysis is not an application
   * error. Return null so the controller
   * can correctly return HTTP 404.
   */
  return analysis ?? null;
}

export async function getGapAnalysisById(
  id: string,
  organizationId?: string
) {
  const organizationObjectId =
    organizationId
      ? toObjectId(
          organizationId,
          "organizationId"
        )
      : undefined;

  const query: Record<
    string,
    unknown
  > = {
    _id: toObjectId(
      id,
      "gapAnalysisId"
    )
  };

  if (
    organizationObjectId
  ) {
    query.organizationId =
      organizationObjectId;
  }

  const analysis =
    await GapAnalysis.findOne(
      query
    )
      .populate(
        "roleProfileId",
        "name slug status organizationId"
      )
      .populate(
        "frameworkVersionId",
        "name version"
      )
      .populate(
        "selfAssessmentId",
        "status submittedAt"
      )
      .populate(
        "objectiveEvaluationId",
        "status overallScore passed performanceBand"
      )
      .lean()
      .exec();

  /*
   * Return null so the controller can
   * correctly distinguish "not found"
   * from an actual service failure.
   */
  if (!analysis) {
    return null;
  }

  /*
   * SECURITY HARDENING
   *
   * Validate that the stored candidate
   * and role profile still form a valid
   * organizational relationship.
   */
  const analysisCandidateId =
    analysis.candidateId?.toString();

  const analysisRoleProfileId =
    analysis.roleProfileId?._id?.toString() ||
    analysis.roleProfileId?.toString();

  if (
    !analysisCandidateId ||
    !analysisRoleProfileId
  ) {
    throw new Error(
      "Gap analysis contains invalid candidate or role profile references"
    );
  }

  await verifyCandidateRoleRelationship(
    toObjectId(
      analysisCandidateId,
      "candidateId"
    ),
    toObjectId(
      analysisRoleProfileId,
      "roleProfileId"
    ),
    organizationObjectId
  );

  return analysis;
}

export async function getCandidateDashboard(
  input: CandidateDashboardInput
) {
  const candidateObjectId =
    toObjectId(
      input.candidateId,
      "candidateId"
    );

  const organizationObjectId =
    input.organizationId
      ? toObjectId(
          input.organizationId,
          "organizationId"
        )
      : undefined;

  const query: Record<
    string,
    unknown
  > = {
    candidateId:
      candidateObjectId
  };

  if (
    organizationObjectId
  ) {
    query.organizationId =
      organizationObjectId;
  }

  const analyses =
    await GapAnalysis.find(
      query
    )
      .sort({
        generatedAt: -1
      })
      .populate(
        "roleProfileId",
        "name slug status"
      )
      .lean()
      .exec();

  const latestByRole =
    new Map<
      string,
      (typeof analyses)[number]
    >();

  for (
    const analysis of analyses
  ) {
    const roleId =
      analysis.roleProfileId?._id?.toString() ||
      analysis.roleProfileId?.toString();

    if (!roleId) {
      continue;
    }

    if (
      !latestByRole.has(roleId)
    ) {
      latestByRole.set(
        roleId,
        analysis
      );
    }
  }

  const roleProfiles =
    Array.from(
      latestByRole.values()
    );

  const readinessValues =
    roleProfiles.map(
      (analysis) =>
        analysis.readinessPercentage
    );

  const averageReadiness =
    readinessValues.length > 0
      ? readinessValues.reduce(
          (sum, value) =>
            sum + value,
          0
        ) /
        readinessValues.length
      : 0;

  const totalStrengths =
    roleProfiles.reduce(
      (sum, analysis) =>
        sum +
        analysis.strengthsCount,
      0
    );

  const totalDevelopmentAreas =
    roleProfiles.reduce(
      (sum, analysis) =>
        sum +
        analysis.developmentAreasCount,
      0
    );

  const totalCompetencies =
    roleProfiles.reduce(
      (sum, analysis) =>
        sum +
        analysis.competencyCount,
      0
    );

  const developmentAreas =
    roleProfiles
      .flatMap(
        (analysis) => [
          ...analysis.skillGaps,
          ...analysis.behaviouralFactorGaps
        ]
      )
      .filter(
        (competency) =>
          competency.classification ===
          GapClassification.DEVELOPMENT_GAP
      )
      .sort(
        (a, b) =>
          b.gap - a.gap
      )
      .slice(0, 10);

  const strengths =
    roleProfiles
      .flatMap(
        (analysis) => [
          ...analysis.skillGaps,
          ...analysis.behaviouralFactorGaps
        ]
      )
      .filter(
        (competency) =>
          competency.classification ===
            GapClassification.STRENGTH ||
          competency.classification ===
            GapClassification.AT_TARGET
      )
      .sort(
        (a, b) =>
          b.currentLevel -
          a.currentLevel
      )
      .slice(0, 10);

  return {
    candidateId:
      input.candidateId,

    overview: {
      roleProfiles:
        roleProfiles.length,

      averageReadinessPercentage:
        Number(
          averageReadiness.toFixed(2)
        ),

      totalCompetencies,

      totalStrengths,

      totalDevelopmentAreas
    },

    roleProfiles,

    developmentAreas,

    strengths
  };
}

async function computeOrganizationDashboard(
  input: OrganizationDashboardInput
) {
  const query: Record<
    string,
    unknown
  > = {};

  if (
    input.organizationId
  ) {
    query.organizationId =
      toObjectId(
        input.organizationId,
        "organizationId"
      );
  }

  const analyses =
    await GapAnalysis.find(
      query
    )
      .sort({
        generatedAt: -1
      })
      .populate(
        "roleProfileId",
        "name slug status"
      )
      .lean()
      .exec();

  const latestByCandidateRole =
    new Map<
      string,
      (typeof analyses)[number]
    >();

  for (
    const analysis of analyses
  ) {
    const candidateId =
      analysis.candidateId.toString();

    const roleId =
      analysis.roleProfileId?._id?.toString() ||
      analysis.roleProfileId?.toString() ||
      "unknown";

    const key =
      `${candidateId}:${roleId}`;

    if (
      !latestByCandidateRole.has(
        key
      )
    ) {
      latestByCandidateRole.set(
        key,
        analysis
      );
    }
  }

  const latestAnalyses =
    Array.from(
      latestByCandidateRole.values()
    );

  const readinessValues =
    latestAnalyses.map(
      (analysis) =>
        analysis.readinessPercentage
    );

  const averageReadiness =
    readinessValues.length > 0
      ? readinessValues.reduce(
          (sum, value) =>
            sum + value,
          0
        ) /
        readinessValues.length
      : 0;

  const candidateIds =
    new Set(
      latestAnalyses.map(
        (analysis) =>
          analysis.candidateId.toString()
      )
    );

  const roleProfileIds =
    new Set(
      latestAnalyses.map(
        (analysis) =>
          analysis.roleProfileId?._id?.toString() ||
          analysis.roleProfileId?.toString()
      )
    );

  const competencyMap =
    new Map<
      string,
      {
        competencyName: string;
        competencyType: string;
        count: number;
        totalGap: number;
        averageGap: number;
      }
    >();

  for (
    const analysis of latestAnalyses
  ) {
    const competencies = [
      ...analysis.skillGaps,
      ...analysis.behaviouralFactorGaps
    ];

    for (
      const competency of competencies
    ) {
      if (
        competency.classification !==
        GapClassification.DEVELOPMENT_GAP
      ) {
        continue;
      }

      const key =
        competency.competencyId.toString();

      const existing =
        competencyMap.get(key);

      if (existing) {
        existing.count++;

        existing.totalGap +=
          competency.gap;

        existing.averageGap =
          existing.totalGap /
          existing.count;
      } else {
        competencyMap.set(
          key,
          {
            competencyName:
              competency.competencyName,

            competencyType:
              competency.competencyType,

            count: 1,

            totalGap:
              competency.gap,

            averageGap:
              competency.gap
          }
        );
      }
    }
  }

  const topDevelopmentAreas =
    Array.from(
      competencyMap.values()
    )
      .sort((a, b) => {
        if (
          b.count !==
          a.count
        ) {
          return (
            b.count -
            a.count
          );
        }

        return (
          b.averageGap -
          a.averageGap
        );
      })
      .slice(0, 10);

  const totalStrengths =
    latestAnalyses.reduce(
      (sum, analysis) =>
        sum +
        analysis.strengthsCount,
      0
    );

  const totalDevelopmentAreas =
    latestAnalyses.reduce(
      (sum, analysis) =>
        sum +
        analysis.developmentAreasCount,
      0
    );

  return {
    overview: {
      candidates:
        candidateIds.size,

      roleProfiles:
        roleProfileIds.size,

      analyses:
        latestAnalyses.length,

      averageReadinessPercentage:
        Number(
          averageReadiness.toFixed(2)
        ),

      totalStrengths,

      totalDevelopmentAreas
    },

    topDevelopmentAreas,

    analyses:
      latestAnalyses
  };
}

/*
 * This aggregates every gap analysis for an organization and can get
 * expensive as the number of candidates/analyses grows. It doesn't
 * need to be perfectly real-time — a short cache window trades a
 * little staleness (at most 60s) for avoiding that recomputation on
 * every dashboard load. Falls back to computing directly whenever
 * Redis isn't configured.
 */
export async function getOrganizationDashboard(
  input: OrganizationDashboardInput
) {
  const cacheKey = `gap-analysis:org-dashboard:${input.organizationId || "platform"}`;

  return cached(cacheKey, 60, () => computeOrganizationDashboard(input));
}