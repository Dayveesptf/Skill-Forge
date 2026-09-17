import { Types } from "mongoose";

import GapAnalysis, {
  GapClassification
} from "../../models/GapAnalysis";

interface ReportCompetency {
  competencyType: string;
  competencyId: string;
  competencyName: string;

  targetLevel: number;
  currentLevel: number;
  gap: number;
  readinessPercentage: number;
  weight: number;

  selfAssessmentLevel?: number;
  objectiveLevel?: number;
  selfVsObjectiveGap?: number;

  classification: string;

  evidence?: string;
  confidence?: string;
}

interface RoleProfileReportDetails {
  id: string;
  name?: string;
  slug?: string;
  status?: string;
  department?: string;
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

function buildOrganizationQuery(
  organizationId?: string
) {
  const query: Record<string, unknown> = {};

  if (organizationId) {
    query.organizationId = ensureObjectId(
      organizationId,
      "organizationId"
    );
  }

  return query;
}

/**
 * Safely extracts information from a populated
 * Mongoose reference.
 *
 * Depending on whether the document is populated,
 * Mongoose may give us either:
 *
 * - an ObjectId
 * - a populated object
 * - null
 */
function getRoleProfileDetails(
  value: unknown
): RoleProfileReportDetails | null {
  if (!value) {
    return null;
  }

  /*
   * ObjectId / primitive reference
   */
  if (
    value instanceof Types.ObjectId
  ) {
    return {
      id: value.toString()
    };
  }

  /*
   * Populated document/object.
   *
   * We intentionally treat this as an unknown record
   * instead of relying on Mongoose's inferred populated
   * type, which is what was causing the TypeScript errors.
   */
  if (
    typeof value === "object" &&
    value !== null
  ) {
    const record =
      value as Record<string, unknown>;

    const rawId =
      record._id;

    if (!rawId) {
      return null;
    }

    return {
      id: String(rawId),
      name:
        typeof record.name === "string"
          ? record.name
          : undefined,
      slug:
        typeof record.slug === "string"
          ? record.slug
          : undefined,
      status:
        typeof record.status === "string"
          ? record.status
          : undefined,
      department:
        typeof record.department === "string"
          ? record.department
          : undefined
    };
  }

  /*
   * Fallback for anything that behaves like an ID.
   */
  return {
    id: String(value)
  };
}

function mapCompetency(
  competency: {
    competencyType: string;
    competencyId: Types.ObjectId;
    competencyName: string;
    targetLevel: number;
    currentLevel: number;
    gap: number;
    readinessPercentage: number;
    weight: number;
    selfAssessmentLevel?: number;
    objectiveLevel?: number;
    selfVsObjectiveGap?: number;
    classification: string;
    evidence?: string;
    confidence?: string;
  }
): ReportCompetency {
  return {
    competencyType:
      competency.competencyType,

    competencyId:
      competency.competencyId.toString(),

    competencyName:
      competency.competencyName,

    targetLevel:
      competency.targetLevel,

    currentLevel:
      competency.currentLevel,

    gap:
      competency.gap,

    readinessPercentage:
      competency.readinessPercentage,

    weight:
      competency.weight,

    ...(competency.selfAssessmentLevel !==
    undefined
      ? {
          selfAssessmentLevel:
            competency.selfAssessmentLevel
        }
      : {}),

    ...(competency.objectiveLevel !==
    undefined
      ? {
          objectiveLevel:
            competency.objectiveLevel
        }
      : {}),

    ...(competency.selfVsObjectiveGap !==
    undefined
      ? {
          selfVsObjectiveGap:
            competency.selfVsObjectiveGap
        }
      : {}),

    classification:
      competency.classification,

    ...(competency.evidence
      ? {
          evidence:
            competency.evidence
        }
      : {}),

    ...(competency.confidence
      ? {
          confidence:
            competency.confidence
        }
      : {})
  };
}

/* -------------------------------------------------------------------------- */
/* Candidate Role Report                                                      */
/* -------------------------------------------------------------------------- */

export async function getCandidateRoleReport(
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

  const roleProfileId =
    ensureObjectId(
      params.roleProfileId,
      "roleProfileId"
    );

  const query: Record<string, unknown> = {
    candidateId,
    roleProfileId
  };

  if (params.organizationId) {
    query.organizationId =
      ensureObjectId(
        params.organizationId,
        "organizationId"
      );
  }

  const analysis =
    await GapAnalysis.findOne(query)
      .sort({
        generatedAt: -1
      })
      .populate(
        "roleProfileId",
        "name slug status description department"
      )
      .populate(
        "frameworkVersionId",
        "name version status"
      )
      .populate(
        "selfAssessmentId",
        "status startedAt submittedAt"
      )
      .populate(
        "objectiveEvaluationId",
        "status overallScore passed performanceBand evaluatedAt"
      )
      .lean()
      .exec();

  if (!analysis) {
    throw new Error(
      "No gap analysis exists for this candidate and role profile"
    );
  }

  const skills =
    analysis.skillGaps.map(
      mapCompetency
    );

  const behaviouralFactors =
    analysis.behaviouralFactorGaps.map(
      mapCompetency
    );

  const allCompetencies = [
    ...skills,
    ...behaviouralFactors
  ];

  const developmentAreas =
    allCompetencies
      .filter(
        (item) =>
          item.classification ===
          GapClassification.DEVELOPMENT_GAP
      )
      .sort(
        (a, b) =>
          b.gap - a.gap
      );

  const strengths =
    allCompetencies
      .filter(
        (item) =>
          item.classification ===
            GapClassification.STRENGTH ||
          item.classification ===
            GapClassification.AT_TARGET
      )
      .sort(
        (a, b) =>
          b.currentLevel -
          a.currentLevel
      );

  const noEvidence =
    allCompetencies.filter(
      (item) =>
        item.classification ===
        GapClassification.NO_EVIDENCE
    );

  const selfAssessmentAvailable =
    allCompetencies.some(
      (item) =>
        item.selfAssessmentLevel !==
        undefined
    );

  const objectiveAssessmentAvailable =
    allCompetencies.some(
      (item) =>
        item.objectiveLevel !==
        undefined
    );

  return {
    reportType:
      "CANDIDATE_ROLE_PERFORMANCE",

    generatedAt:
      new Date().toISOString(),

    candidateId:
      candidateId.toString(),

    roleProfile:
      analysis.roleProfileId,

    frameworkVersion:
      analysis.frameworkVersionId,

    source:
      analysis.source,

    summary: {
      readinessPercentage:
        analysis.readinessPercentage,

      overallTargetLevel:
        analysis.overallTargetLevel,

      overallCurrentLevel:
        analysis.overallCurrentLevel,

      overallGap:
        analysis.overallGap,

      competencyCount:
        analysis.competencyCount,

      strengthsCount:
        analysis.strengthsCount,

      developmentAreasCount:
        analysis.developmentAreasCount,

      competenciesWithSelfEvidence:
        analysis.competenciesWithSelfEvidence,

      competenciesWithObjectiveEvidence:
        analysis.competenciesWithObjectiveEvidence
    },

    evidence: {
      selfAssessmentAvailable,

      objectiveAssessmentAvailable,

      selfAssessment:
        analysis.selfAssessmentId,

      objectiveEvaluation:
        analysis.objectiveEvaluationId
    },

    narrative: {
      summary:
        analysis.summary,

      strengths,

      developmentAreas,

      noEvidence
    },

    competencies: {
      skills,

      behaviouralFactors,

      all:
        allCompetencies
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Candidate Dashboard Report                                                 */
/* -------------------------------------------------------------------------- */

export async function getCandidateReportOverview(
  params: {
    candidateId: string;
    organizationId?: string;
  }
) {
  const candidateId =
    ensureObjectId(
      params.candidateId,
      "candidateId"
    );

  const query: Record<string, unknown> = {
    candidateId
  };

  if (params.organizationId) {
    query.organizationId =
      ensureObjectId(
        params.organizationId,
        "organizationId"
      );
  }

  const analyses =
    await GapAnalysis.find(query)
      .sort({
        generatedAt: -1
      })
      .populate(
        "roleProfileId",
        "name slug status department"
      )
      .lean()
      .exec();

  /*
   * Keep only the newest gap analysis
   * for each role profile.
   *
   * Because analyses are sorted newest-first,
   * the first analysis we encounter for a role
   * is the latest one.
   */
  const latestByRole =
    new Map<
      string,
      (typeof analyses)[number]
    >();

  for (const analysis of analyses) {
    const roleProfileDetails =
      getRoleProfileDetails(
        analysis.roleProfileId
      );

    if (!roleProfileDetails) {
      continue;
    }

    const roleId =
      roleProfileDetails.id;

    if (
      roleId &&
      !latestByRole.has(roleId)
    ) {
      latestByRole.set(
        roleId,
        analysis
      );
    }
  }

  /*
   * Convert each latest analysis into the
   * structure expected by the frontend.
   *
   * IMPORTANT:
   *
   * gapAnalysisId is included here so the
   * frontend can identify the exact gap
   * analysis being displayed.
   *
   * roleProfileId is also included separately
   * so the frontend can request:
   *
   * /gap-analysis/candidates/:candidateId/role-profiles/:roleProfileId
   */
  const roleReports =
    Array.from(
      latestByRole.values()
    ).map(
      (analysis) => {
        const roleProfile =
          getRoleProfileDetails(
            analysis.roleProfileId
          );

        return {
          gapAnalysisId:
            analysis._id.toString(),

          roleProfileId:
            roleProfile?.id ||
            "",

          roleProfile,

          readinessPercentage:
            analysis.readinessPercentage,

          overallTargetLevel:
            analysis.overallTargetLevel,

          overallCurrentLevel:
            analysis.overallCurrentLevel,

          overallGap:
            analysis.overallGap,

          competencyCount:
            analysis.competencyCount,

          strengthsCount:
            analysis.strengthsCount,

          developmentAreasCount:
            analysis.developmentAreasCount,

          generatedAt:
            analysis.generatedAt
        };
      }
    );

  const averageReadiness =
    roleReports.length > 0
      ? roleReports.reduce(
          (sum, item) =>
            sum +
            item.readinessPercentage,
          0
        ) / roleReports.length
      : 0;

  const developmentAreas =
    roleReports.length > 0
      ? Array.from(
          latestByRole.values()
        )
          .flatMap(
            (analysis) => [
              ...analysis.skillGaps,
              ...analysis.behaviouralFactorGaps
            ]
          )
          .filter(
            (item) =>
              item.classification ===
              GapClassification.DEVELOPMENT_GAP
          )
          .sort(
            (a, b) =>
              b.gap - a.gap
          )
          .slice(0, 10)
          .map(mapCompetency)
      : [];

  const strengths =
    roleReports.length > 0
      ? Array.from(
          latestByRole.values()
        )
          .flatMap(
            (analysis) => [
              ...analysis.skillGaps,
              ...analysis.behaviouralFactorGaps
            ]
          )
          .filter(
            (item) =>
              item.classification ===
                GapClassification.STRENGTH ||
              item.classification ===
                GapClassification.AT_TARGET
          )
          .sort(
            (a, b) =>
              b.currentLevel -
              a.currentLevel
          )
          .slice(0, 10)
          .map(mapCompetency)
      : [];

  return {
    reportType:
      "CANDIDATE_PERFORMANCE_OVERVIEW",

    generatedAt:
      new Date().toISOString(),

    candidateId:
      candidateId.toString(),

    overview: {
      roleProfiles:
        roleReports.length,

      averageReadinessPercentage:
        Number(
          averageReadiness.toFixed(2)
        ),

      totalCompetencies:
        roleReports.reduce(
          (sum, item) =>
            sum +
            item.competencyCount,
          0
        ),

      totalStrengths:
        roleReports.reduce(
          (sum, item) =>
            sum +
            item.strengthsCount,
          0
        ),

      totalDevelopmentAreas:
        roleReports.reduce(
          (sum, item) =>
            sum +
            item.developmentAreasCount,
          0
        )
    },

    roleReports,

    topDevelopmentAreas:
      developmentAreas,

    topStrengths:
      strengths
  };
}

/* -------------------------------------------------------------------------- */
/* Organization Analytics                                                     */
/* -------------------------------------------------------------------------- */

export async function getOrganizationAnalytics(
  params: {
    organizationId?: string;
  }
) {
  const query =
    buildOrganizationQuery(
      params.organizationId
    );

  const analyses =
    await GapAnalysis.find(query)
      .sort({
        generatedAt: -1
      })
      .populate(
        "roleProfileId",
        "name slug status department"
      )
      .lean()
      .exec();

  /*
   * Keep only the newest analysis for each
   * candidate + role profile combination.
   */
  const latest =
    new Map<
      string,
      (typeof analyses)[number]
    >();

  for (const analysis of analyses) {
    const candidateId =
      analysis.candidateId.toString();

    const roleProfile =
      getRoleProfileDetails(
        analysis.roleProfileId
      );

    const roleId =
      roleProfile?.id ||
      "unknown";

    const key =
      `${candidateId}:${roleId}`;

    if (!latest.has(key)) {
      latest.set(
        key,
        analysis
      );
    }
  }

  const latestAnalyses =
    Array.from(
      latest.values()
    );

  const candidates =
    new Set(
      latestAnalyses.map(
        (analysis) =>
          analysis.candidateId.toString()
      )
    );

  const roleProfiles =
    new Set(
      latestAnalyses.map(
        (analysis) => {
          const role =
            getRoleProfileDetails(
              analysis.roleProfileId
            );

          return role?.id;
        }
      )
    );

  const readinessTotal =
    latestAnalyses.reduce(
      (sum, analysis) =>
        sum +
        analysis.readinessPercentage,
      0
    );

  const averageReadiness =
    latestAnalyses.length > 0
      ? readinessTotal /
        latestAnalyses.length
      : 0;

  const totalCompetencies =
    latestAnalyses.reduce(
      (sum, analysis) =>
        sum +
        analysis.competencyCount,
      0
    );

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

  const competencyMap =
    new Map<
      string,
      {
        competencyId: string;
        competencyName: string;
        competencyType: string;
        candidateCount: number;
        totalGap: number;
        averageGap: number;
      }
    >();

  for (const analysis of latestAnalyses) {
    const competencies = [
      ...analysis.skillGaps,
      ...analysis.behaviouralFactorGaps
    ];

    for (const competency of competencies) {
      if (
        competency.classification !==
        GapClassification.DEVELOPMENT_GAP
      ) {
        continue;
      }

      const id =
        competency.competencyId.toString();

      const existing =
        competencyMap.get(id);

      if (existing) {
        existing.candidateCount++;

        existing.totalGap +=
          competency.gap;

        existing.averageGap =
          existing.totalGap /
          existing.candidateCount;
      } else {
        competencyMap.set(
          id,
          {
            competencyId: id,

            competencyName:
              competency.competencyName,

            competencyType:
              competency.competencyType,

            candidateCount: 1,

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
          b.candidateCount !==
          a.candidateCount
        ) {
          return (
            b.candidateCount -
            a.candidateCount
          );
        }

        return (
          b.averageGap -
          a.averageGap
        );
      })
      .slice(0, 10);

  const readinessDistribution = {
    exceptional: 0,
    strong: 0,
    developing: 0,
    needsImprovement: 0
  };

  for (const analysis of latestAnalyses) {
    const readiness =
      analysis.readinessPercentage;

    if (readiness >= 90) {
      readinessDistribution.exceptional++;
    } else if (readiness >= 75) {
      readinessDistribution.strong++;
    } else if (readiness >= 60) {
      readinessDistribution.developing++;
    } else {
      readinessDistribution.needsImprovement++;
    }
  }

  return {
    reportType:
      "ORGANIZATION_PERFORMANCE_ANALYTICS",

    generatedAt:
      new Date().toISOString(),

    overview: {
      candidates:
        candidates.size,

      roleProfiles:
        roleProfiles.size,

      analyses:
        latestAnalyses.length,

      averageReadinessPercentage:
        Number(
          averageReadiness.toFixed(2)
        ),

      totalCompetencies,

      totalStrengths,

      totalDevelopmentAreas
    },

    readinessDistribution,

    topDevelopmentAreas,

    analyses:
      latestAnalyses.map(
        (analysis) => ({
          candidateId:
            analysis.candidateId,

          roleProfile:
            analysis.roleProfileId,

          readinessPercentage:
            analysis.readinessPercentage,

          overallTargetLevel:
            analysis.overallTargetLevel,

          overallCurrentLevel:
            analysis.overallCurrentLevel,

          overallGap:
            analysis.overallGap,

          strengthsCount:
            analysis.strengthsCount,

          developmentAreasCount:
            analysis.developmentAreasCount,

          generatedAt:
            analysis.generatedAt
        })
      )
  };
}

/* -------------------------------------------------------------------------- */
/* CSV Export                                                                 */
/* -------------------------------------------------------------------------- */

function csvEscape(
  value: unknown
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  const text =
    String(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r")
  ) {
    return `"${text.replace(
      /"/g,
      '""'
    )}"`;
  }

  return text;
}

export async function getCandidateRoleCsv(
  params: {
    candidateId: string;
    roleProfileId: string;
    organizationId?: string;
  }
): Promise<string> {
  const report =
    await getCandidateRoleReport(
      params
    );

  const rows: string[][] = [];

  rows.push([
    "Competency Type",
    "Competency",
    "Target Level",
    "Current Level",
    "Gap",
    "Readiness %",
    "Weight",
    "Self Assessment Level",
    "Objective Level",
    "Self vs Objective Gap",
    "Classification",
    "Confidence",
    "Evidence"
  ]);

  for (const competency of report
    .competencies.all) {
    rows.push([
      competency.competencyType,

      competency.competencyName,

      String(
        competency.targetLevel
      ),

      String(
        competency.currentLevel
      ),

      String(
        competency.gap
      ),

      String(
        competency.readinessPercentage
      ),

      String(
        competency.weight
      ),

      competency.selfAssessmentLevel !==
      undefined
        ? String(
            competency.selfAssessmentLevel
          )
        : "",

      competency.objectiveLevel !==
      undefined
        ? String(
            competency.objectiveLevel
          )
        : "",

      competency.selfVsObjectiveGap !==
      undefined
        ? String(
            competency.selfVsObjectiveGap
          )
        : "",

      competency.classification,

      competency.confidence || "",

      competency.evidence || ""
    ]);
  }

  return rows
    .map((row) =>
      row
        .map(csvEscape)
        .join(",")
    )
    .join("\r\n");
}

export async function getOrganizationCsv(
  params: {
    organizationId?: string;
  }
): Promise<string> {
  const report =
    await getOrganizationAnalytics(
      params
    );

  const rows: string[][] = [];

  rows.push([
    "Candidate ID",
    "Role Profile",
    "Readiness %",
    "Target Level",
    "Current Level",
    "Gap",
    "Strengths",
    "Development Areas",
    "Generated At"
  ]);

  for (const analysis of report.analyses) {
    const role =
      analysis.roleProfile as unknown as
        | {
            name?: string;
          }
        | Types.ObjectId
        | null;

    const roleName =
      role &&
      typeof role === "object" &&
      "name" in role
        ? role.name || ""
        : role?.toString() || "";

    rows.push([
      analysis.candidateId.toString(),

      roleName,

      String(
        analysis.readinessPercentage
      ),

      String(
        analysis.overallTargetLevel
      ),

      String(
        analysis.overallCurrentLevel
      ),

      String(
        analysis.overallGap
      ),

      String(
        analysis.strengthsCount
      ),

      String(
        analysis.developmentAreasCount
      ),

      new Date(
        analysis.generatedAt
      ).toISOString()
    ]);
  }

  return rows
    .map((row) =>
      row
        .map(csvEscape)
        .join(",")
    )
    .join("\r\n");
}