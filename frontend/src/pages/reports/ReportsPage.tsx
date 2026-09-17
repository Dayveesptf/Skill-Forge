import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  api,
  errorMessage,
  unwrap,
} from "../../api";

import {
  useAuth,
} from "../../auth";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from "../../components/ui";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface TeamMember {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  managerId?: string;
  isActive: boolean;
}

interface RoleProfileSummary {
  _id: string;
  name?: string;
  title?: string;
  description?: string;
}

interface TopArea {
  competencyId?: string;
  competencyName?: string;
  competencyType?: string;

  candidateCount?: number;
  totalGap?: number;
  averageGap?: number;

  currentLevel?: number;
  targetLevel?: number;
  gap?: number;
}

interface RoleReport {
  gapAnalysisId?: string;
  roleProfileId?: string;
  roleProfile?: RoleProfileSummary | string;
  readinessPercentage?: number;
  overallTargetLevel?: number;
  overallCurrentLevel?: number;
  overallGap?: number;
  competencyCount?: number;
  strengthsCount?: number;
  developmentAreasCount?: number;
  generatedAt?: string;
}

interface CandidateOverview {
  roleProfiles?: number;
  averageReadinessPercentage?: number;
  totalCompetencies?: number;
  totalStrengths?: number;
  totalDevelopmentAreas?: number;
}

interface CandidateReport {
  reportType?: string;
  generatedAt?: string;
  candidateId?: string;

  overview?: CandidateOverview;

  roleReports?: RoleReport[];

  topDevelopmentAreas?: TopArea[];

  topStrengths?: TopArea[];
}

interface GapCompetency {
  competencyId?: string;
  competencyName?: string;
  competencyType?: string;

  targetLevel?: number;
  currentLevel?: number;
  gap?: number;

  classification?: string;

  evidenceCount?: number;
  evidence?: unknown[];
}

interface GapAnalysis {
  _id?: string;

  readinessPercentage?: number;

  overallTargetLevel?: number;
  overallCurrentLevel?: number;
  overallGap?: number;

  skillGaps?: GapCompetency[];
  behavioralFactorGaps?: GapCompetency[];

  competencyGaps?: GapCompetency[];

  strengths?: GapCompetency[];
  developmentAreas?: GapCompetency[];
}

interface LearningResource {
  _id?: string;
  title?: string;
  description?: string;
  url?: string;
  provider?: string;
  resourceType?: string;
  targetLevel?: number;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getDisplayName(
  member: TeamMember,
) {
  return (
    `${member.firstName ?? ""} ${member.lastName ?? ""}`
      .trim() ||
    member.email
  );
}

function getRoleProfileName(
  roleProfile: RoleProfileSummary | string | undefined,
) {
  if (!roleProfile) {
    return "Role Profile";
  }

  if (typeof roleProfile === "string") {
    return roleProfile;
  }

  return (
    roleProfile.name ||
    roleProfile.title ||
    "Role Profile"
  );
}

function percentage(
  value?: number,
) {
  if (
    typeof value !== "number" ||
    Number.isNaN(value)
  ) {
    return 0;
  }

  return Math.round(value);
}

function level(
  value?: number,
) {
  if (
    typeof value !== "number" ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return value.toFixed(1);
}

function gapTone(
  gap?: number,
): "slate" | "green" | "amber" | "red" {
  if (typeof gap !== "number") {
    return "slate";
  }

  if (gap <= 0) {
    return "green";
  }

  if (gap <= 2) {
    return "amber";
  }

  return "red";
}

function normalizeGapLists(
  gapAnalysis?: GapAnalysis,
) {
  if (!gapAnalysis) {
    return {
      skills: [] as GapCompetency[],
      behavioural: [] as GapCompetency[],
    };
  }

  if (
    gapAnalysis.skillGaps ||
    gapAnalysis.behavioralFactorGaps
  ) {
    return {
      skills:
        gapAnalysis.skillGaps ?? [],

      behavioural:
        gapAnalysis.behavioralFactorGaps ?? [],
    };
  }

  const all =
    gapAnalysis.competencyGaps ?? [];

  return {
    skills: all.filter(
      (item) =>
        item.competencyType !==
        "BEHAVIOURAL_FACTOR",
    ),

    behavioural: all.filter(
      (item) =>
        item.competencyType ===
        "BEHAVIOURAL_FACTOR",
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function ReportsPage() {
  const {
    user,
    userId,
  } = useAuth();

  const navigate =
    useNavigate();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  const candidateIdFromUrl =
    searchParams.get(
      "candidateId",
    );

  const isManager =
    user?.role === "MANAGER";

  /*
   * For staff, the candidate is always themselves.
   *
   * For managers, candidateId comes from the URL.
   */
  const candidateId =
    isManager
      ? candidateIdFromUrl
      : userId;

  const [
    activeRoleId,
    setActiveRoleId,
  ] = useState<
    string | null
  >(null);

  /* ------------------------------------------------------------------------ */
  /* Manager team                                                             */
  /* ------------------------------------------------------------------------ */

  const teamQuery =
    useQuery({
      queryKey: [
        "manager",
        "team",
      ],

      queryFn: async () =>
        unwrap<TeamMember[]>(
          await api.get(
            "/users/my-team",
          ),
        ),

      enabled:
        isManager,
    });

  const team =
    teamQuery.data ?? [];

  /*
   * A manager can only open reports for staff returned by /users/my-team.
   *
   * This is primarily a UX restriction. The backend report endpoint remains
   * responsible for enforcing authorization.
   */
  const selectedTeamMember =
    useMemo(() => {
      if (
        !isManager ||
        !candidateId
      ) {
        return null;
      }

      return (
        team.find(
          (member) =>
            member._id ===
            candidateId,
        ) ?? null
      );
    }, [
      isManager,
      candidateId,
      team,
    ]);

  const managerCandidateIsValid =
    !isManager ||
    !candidateId ||
    Boolean(
      selectedTeamMember,
    );

  /* ------------------------------------------------------------------------ */
  /* Candidate report                                                         */
  /* ------------------------------------------------------------------------ */

  const reportQuery =
    useQuery({
      queryKey: [
        "candidate-report",
        candidateId,
      ],

      queryFn: async () =>
        unwrap<CandidateReport>(
          await api.get(
            `/reports/candidates/${candidateId}/overview`,
          ),
        ),

      enabled:
        Boolean(candidateId) &&
        managerCandidateIsValid,
    });

  const report =
    reportQuery.data;

  /* ------------------------------------------------------------------------ */
  /* Active role                                                              */
  /* ------------------------------------------------------------------------ */

  const roleReports =
    report?.roleReports ?? [];

  useEffect(() => {
    if (
      roleReports.length ===
      0
    ) {
      setActiveRoleId(null);
      return;
    }

    const exists =
      activeRoleId &&
      roleReports.some(
        (role) =>
          role.roleProfileId ===
          activeRoleId,
      );

    if (!exists) {
      setActiveRoleId(
        roleReports[0]
          ?.roleProfileId ??
          null,
      );
    }
  }, [
    roleReports,
    activeRoleId,
  ]);

  const activeRole =
    roleReports.find(
      (role) =>
        role.roleProfileId ===
        activeRoleId,
    ) ??
    roleReports[0];

  const selectedRoleId =
    activeRole?.roleProfileId ??
    null;

  /* ------------------------------------------------------------------------ */
  /* Gap analysis                                                             */
  /* ------------------------------------------------------------------------ */

  const gapQuery =
    useQuery({
      queryKey: [
        "candidate-gap-analysis",
        candidateId,
        selectedRoleId,
      ],

      queryFn: async () =>
        unwrap<GapAnalysis>(
          await api.get(
            `/gap-analysis/candidates/${candidateId}/role-profiles/${selectedRoleId}`,
          ),
        ),

      enabled:
        Boolean(
          candidateId &&
          selectedRoleId,
        ),
    });

  const gapAnalysis =
    gapQuery.data;

  const {
    skills,
    behavioural,
  } =
    normalizeGapLists(
      gapAnalysis,
    );

  /* ------------------------------------------------------------------------ */
  /* Learning resources                                                       */
  /* ------------------------------------------------------------------------ */

  const recommendationsQuery =
    useQuery({
      queryKey: [
        "learning-resources",
        "recommendations",
        gapAnalysis?._id,
      ],

      queryFn: async () =>
        unwrap<LearningResource[]>(
          await api.get(
            `/learning-resources/recommendations/${gapAnalysis?._id}`,
          ),
        ),

      enabled:
        Boolean(
          gapAnalysis?._id,
        ),
    });

  const recommendations =
    recommendationsQuery.data ??
    [];

  /* ------------------------------------------------------------------------ */
  /* Candidate switch                                                         */
  /* ------------------------------------------------------------------------ */

  function handleCandidateChange(
    nextCandidateId: string,
  ) {
    setActiveRoleId(null);

    const nextParams =
      new URLSearchParams(
        searchParams,
      );

    if (!nextCandidateId) {
      nextParams.delete(
        "candidateId",
      );
    } else {
      nextParams.set(
        "candidateId",
        nextCandidateId,
      );
    }

    setSearchParams(
      nextParams,
    );
  }

  function handleBackToTeam() {
    navigate(
      "/manager/team",
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Loading / errors                                                         */
  /* ------------------------------------------------------------------------ */

  if (!user) {
    return null;
  }

  if (
    isManager &&
    teamQuery.isLoading
  ) {
    return <Loading />;
  }

  if (
    isManager &&
    teamQuery.isError
  ) {
    return (
      <ErrorState
        text={errorMessage(
          teamQuery.error,
          "Could not load your team.",
        )}
        onRetry={() =>
          teamQuery.refetch()
        }
      />
    );
  }

  if (
    isManager &&
    candidateId &&
    !selectedTeamMember
  ) {
    return (
      <>
        <PageHeader
          eyebrow="Manager"
          title="Reports"
          description="Select a staff member from your team to view their performance report."
        />

        <Card>
          <EmptyState
            title="Staff member not found"
            text="This staff member is not assigned to you or is no longer active."
          />

          <div className="mt-5 flex justify-center">
            <Button
              onClick={
                handleBackToTeam
              }
            >
              <ArrowLeft
                size={16}
              />
              Back to my team
            </Button>
          </div>
        </Card>
      </>
    );
  }

  if (
    isManager &&
    !candidateId
  ) {
    return (
      <>
        <PageHeader
          eyebrow="Manager"
          title="Reports"
          description="Select a staff member to view their skills and performance report."
        />

        <Card>
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-brand-500/10 p-3">
              <Users
                size={21}
                className="text-brand-300"
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">
                Select a team member
              </h2>

              <p className="text-sm text-slate-500">
                You can only view reports for staff assigned to you.
              </p>
            </div>
          </div>

          {team.length === 0 ? (
            <EmptyState
              title="No staff assigned"
              text="There are currently no active staff members assigned to you."
            />
          ) : (
            <div className="grid gap-3">
              {team.map(
                (member) => (
                  <button
                    key={
                      member._id
                    }
                    type="button"
                    onClick={() =>
                      handleCandidateChange(
                        member._id,
                      )
                    }
                    className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-4 text-left transition hover:border-brand-500/40 hover:bg-surface-muted"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-sm font-semibold text-brand-300">
                        {member.firstName?.[0]?.toUpperCase() ??
                          ""}
                        {member.lastName?.[0]?.toUpperCase() ??
                          ""}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {getDisplayName(
                            member,
                          )}
                        </p>

                        <p className="truncate text-sm text-slate-500">
                          {member.jobTitle ??
                            "Staff member"}
                        </p>
                      </div>
                    </div>

                    <ArrowRight
                      size={17}
                      className="shrink-0 text-slate-500"
                    />
                  </button>
                ),
              )}
            </div>
          )}
        </Card>
      </>
    );
  }

  if (
    reportQuery.isLoading
  ) {
    return <Loading />;
  }

  if (
    reportQuery.isError
  ) {
    return (
      <>
        {isManager && (
          <div className="mb-4">
            <Button
              variant="secondary"
              onClick={
                handleBackToTeam
              }
            >
              <ArrowLeft
                size={16}
              />
              Back to my team
            </Button>
          </div>
        )}

        <ErrorState
          text={errorMessage(
            reportQuery.error,
            "Could not load the report.",
          )}
          onRetry={() =>
            reportQuery.refetch()
          }
        />
      </>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Empty report                                                             */
  /* ------------------------------------------------------------------------ */

  if (
    !report ||
    roleReports.length === 0
  ) {
    return (
      <>
        <PageHeader
          eyebrow={
            isManager
              ? "Manager"
              : "Performance"
          }
          title="Performance Report"
          description={
            isManager &&
            selectedTeamMember
              ? `Performance information for ${getDisplayName(selectedTeamMember)}.`
              : "Your skills and performance report."
          }
        />

        {isManager && (
          <div className="mb-5">
            <Button
              variant="secondary"
              onClick={
                handleBackToTeam
              }
            >
              <ArrowLeft
                size={16}
              />
              Back to my team
            </Button>
          </div>
        )}

        <Card>
          <EmptyState
            title="No report available yet"
            text={
              isManager
                ? "This staff member does not have a completed performance report yet."
                : "Complete the required assessment process to generate your performance report."
            }
          />
        </Card>
      </>
    );
  }

  const overview =
    report.overview ?? {};

  const readiness =
    percentage(
      overview.averageReadinessPercentage,
    );

  const roleReadiness =
    percentage(
      activeRole?.readinessPercentage,
    );

  const developmentAreas =
    report.topDevelopmentAreas ??
    [];

  const strengths =
    report.topStrengths ??
    [];

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}

      <PageHeader
        eyebrow={
          isManager
            ? "Manager"
            : "Performance"
        }
        title="Performance Report"
        description={
          isManager &&
          selectedTeamMember
            ? `Reviewing ${getDisplayName(selectedTeamMember)}'s skills and development.`
            : "Understand your current capabilities, strengths, and development areas."
        }
      />

      {/* ------------------------------------------------------------------ */}
      {/* Manager controls                                                   */}
      {/* ------------------------------------------------------------------ */}

      {isManager && (
        <Card className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-white">
                Staff member
              </label>

              <div className="relative">
                <select
                  value={
                    candidateId ??
                    ""
                  }
                  onChange={(
                    event,
                  ) =>
                    handleCandidateChange(
                      event.target
                        .value,
                    )
                  }
                  className="w-full appearance-none rounded-xl border border-line bg-surface px-4 py-3 pr-10 text-sm text-white outline-none transition focus:border-brand-500 lg:max-w-xl"
                >
                  <option value="">
                    Select a staff member
                  </option>

                  {team.map(
                    (member) => (
                      <option
                        key={
                          member._id
                        }
                        value={
                          member._id
                        }
                      >
                        {getDisplayName(
                          member,
                        )}
                        {member.jobTitle
                          ? ` — ${member.jobTitle}`
                          : ""}
                      </option>
                    ),
                  )}
                </select>

                <ChevronDown
                  size={17}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                />
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={
                handleBackToTeam
              }
            >
              <Users
                size={16}
              />
              My Team
            </Button>
          </div>

          {selectedTeamMember && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <Badge>
                {
                  selectedTeamMember.email
                }
              </Badge>

              {selectedTeamMember.department && (
                <Badge>
                  {
                    selectedTeamMember.department
                  }
                </Badge>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Staff identity                                                     */}
      {/* ------------------------------------------------------------------ */}

      {isManager &&
        selectedTeamMember && (
          <Card className="mb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-lg font-bold text-brand-300">
                {selectedTeamMember.firstName?.[0]?.toUpperCase() ??
                  ""}
                {selectedTeamMember.lastName?.[0]?.toUpperCase() ??
                  ""}
              </div>

              <div>
                <h2 className="text-xl font-semibold text-white">
                  {getDisplayName(
                    selectedTeamMember,
                  )}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {selectedTeamMember.jobTitle ??
                    "Staff member"}

                  {selectedTeamMember.department
                    ? ` · ${selectedTeamMember.department}`
                    : ""}
                </p>
              </div>
            </div>
          </Card>
        )}

      {/* ------------------------------------------------------------------ */}
      {/* Overview cards                                                     */}
      {/* ------------------------------------------------------------------ */}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-500/10 p-3">
              <TrendingUp
                size={20}
                className="text-brand-300"
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                Overall readiness
              </p>

              <p className="mt-1 text-2xl font-bold text-white">
                {readiness}%
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-500/10 p-3">
              <Target
                size={20}
                className="text-blue-300"
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                Competencies
              </p>

              <p className="mt-1 text-2xl font-bold text-white">
                {
                  overview.totalCompetencies ??
                  0
                }
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <CheckCircle2
                size={20}
                className="text-emerald-300"
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                Strengths
              </p>

              <p className="mt-1 text-2xl font-bold text-white">
                {
                  overview.totalStrengths ??
                  0
                }
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/10 p-3">
              <BookOpen
                size={20}
                className="text-amber-300"
              />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                Development areas
              </p>

              <p className="mt-1 text-2xl font-bold text-white">
                {
                  overview.totalDevelopmentAreas ??
                  0
                }
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Role selector                                                      */}
      {/* ------------------------------------------------------------------ */}

      {roleReports.length > 1 && (
        <Card className="mt-6">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                Role profile
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Select a role profile to inspect the detailed competency gaps.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {roleReports.map(
                (role) => {
                  const isActive =
                    role.roleProfileId ===
                    selectedRoleId;

                  return (
                    <button
                      key={
                        role.roleProfileId
                      }
                      type="button"
                      onClick={() =>
                        setActiveRoleId(
                          role.roleProfileId ??
                            null,
                        )
                      }
                      className={[
                        "rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                        isActive
                          ? "border-brand-500 bg-brand-500/10 text-brand-300"
                          : "border-line bg-surface text-slate-500 hover:border-brand-500/40 hover:text-white",
                      ].join(" ")}
                    >
                      {getRoleProfileName(
                        role.roleProfile,
                      )}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Active role summary                                                */}
      {/* ------------------------------------------------------------------ */}

      {activeRole && (
        <Card className="mt-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                Selected role
              </p>

              <h2 className="mt-1 text-xl font-semibold text-white">
                {getRoleProfileName(
                  activeRole.roleProfile,
                )}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-5">
              <div>
                <p className="text-xs text-slate-600">
                  Readiness
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  {roleReadiness}%
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-600">
                  Current
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  {level(
                    activeRole.overallCurrentLevel,
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-600">
                  Target
                </p>

                <p className="mt-1 text-lg font-semibold text-white">
                  {level(
                    activeRole.overallTargetLevel,
                  )}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Gap analysis                                                       */}
      {/* ------------------------------------------------------------------ */}

      {gapQuery.isLoading ? (
        <Card className="mt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2
              size={22}
              className="animate-spin text-brand-300"
            />
          </div>
        </Card>
      ) : gapQuery.isError ? (
        <Card className="mt-6">
          <ErrorState
            text={errorMessage(
              gapQuery.error,
              "Could not load the detailed gap analysis.",
            )}
            onRetry={() =>
              gapQuery.refetch()
            }
          />
        </Card>
      ) : gapAnalysis ? (
        <>
          {/* Overall gap */}

          <Card className="mt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-600">
                  Gap analysis
                </p>

                <h2 className="mt-1 text-xl font-semibold text-white">
                  Current capability vs target
                </h2>
              </div>

              <Badge
                tone={gapTone(
                  gapAnalysis.overallGap,
                )}
              >
                Overall gap:{" "}
                {level(
                  gapAnalysis.overallGap,
                )}
              </Badge>
            </div>
          </Card>

          {/* Skills */}

          <Card className="mt-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white">
                Skills
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Technical competency areas identified in the assessment.
              </p>
            </div>

            {skills.length === 0 ? (
              <EmptyState
                title="No skill gaps recorded"
                text="There are no technical competency gaps to display for this role."
              />
            ) : (
              <div className="space-y-3">
                {skills.map(
                  (
                    item,
                    index,
                  ) => (
                    <div
                      key={
                        item.competencyId ??
                        `skill-${index}`
                      }
                      className="rounded-xl border border-line bg-surface p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <h3 className="font-medium text-white">
                            {item.competencyName ??
                              "Skill"}
                          </h3>

                          {item.classification && (
                            <p className="mt-1 text-xs text-slate-600">
                              {
                                item.classification
                              }
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-xs text-slate-600">
                              Current
                            </p>

                            <p className="mt-1 font-semibold text-white">
                              {level(
                                item.currentLevel,
                              )}
                            </p>
                          </div>

                          <div className="text-center">
                            <p className="text-xs text-slate-600">
                              Target
                            </p>

                            <p className="mt-1 font-semibold text-white">
                              {level(
                                item.targetLevel,
                              )}
                            </p>
                          </div>

                          <Badge
                            tone={gapTone(
                              item.gap,
                            )}
                          >
                            Gap{" "}
                            {level(
                              item.gap,
                            )}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </Card>

          {/* Behavioural factors */}

          <Card className="mt-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white">
                Behavioural factors
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Behavioural competency areas included in the role assessment.
              </p>
            </div>

            {behavioural.length === 0 ? (
              <EmptyState
                title="No behavioural gaps recorded"
                text="There are no behavioural competency gaps to display for this role."
              />
            ) : (
              <div className="space-y-3">
                {behavioural.map(
                  (
                    item,
                    index,
                  ) => (
                    <div
                      key={
                        item.competencyId ??
                        `behavioural-${index}`
                      }
                      className="rounded-xl border border-line bg-surface p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <h3 className="font-medium text-white">
                            {item.competencyName ??
                              "Behavioural factor"}
                          </h3>

                          {item.classification && (
                            <p className="mt-1 text-xs text-slate-600">
                              {
                                item.classification
                              }
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-xs text-slate-600">
                              Current
                            </p>

                            <p className="mt-1 font-semibold text-white">
                              {level(
                                item.currentLevel,
                              )}
                            </p>
                          </div>

                          <div className="text-center">
                            <p className="text-xs text-slate-600">
                              Target
                            </p>

                            <p className="mt-1 font-semibold text-white">
                              {level(
                                item.targetLevel,
                              )}
                            </p>
                          </div>

                          <Badge
                            tone={gapTone(
                              item.gap,
                            )}
                          >
                            Gap{" "}
                            {level(
                              item.gap,
                            )}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card className="mt-6">
          <EmptyState
            title="No detailed gap analysis"
            text="A detailed gap analysis is not available for this role yet."
          />
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Top strengths                                                      */}
      {/* ------------------------------------------------------------------ */}

      {strengths.length > 0 && (
        <Card className="mt-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              Top strengths
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Competencies where the current capability meets or exceeds the target.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {strengths.map(
              (
                item,
                index,
              ) => (
                <div
                  key={
                    item.competencyId ??
                    `strength-${index}`
                  }
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0 text-emerald-300"
                    />

                    <div>
                      <p className="font-medium text-white">
                        {item.competencyName ??
                          "Competency"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Current level{" "}
                        {level(
                          item.currentLevel,
                        )}
                        {" "}
                        · Target{" "}
                        {level(
                          item.targetLevel,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Development areas                                                  */}
      {/* ------------------------------------------------------------------ */}

      {developmentAreas.length > 0 && (
        <Card className="mt-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              Top development areas
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Areas with the largest identified capability gaps.
            </p>
          </div>

          <div className="space-y-3">
            {developmentAreas.map(
              (
                item,
                index,
              ) => (
                <div
                  key={
                    item.competencyId ??
                    `development-${index}`
                  }
                  className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">
                      {item.competencyName ??
                        "Competency"}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {item.competencyType ??
                        "Competency"}
                    </p>
                  </div>

                  <Badge tone="amber">
                    Avg. gap{" "}
                    {level(
                      item.averageGap,
                    )}
                  </Badge>
                </div>
              ),
            )}
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Learning recommendations                                           */}
      {/* ------------------------------------------------------------------ */}

      <Card className="mt-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Recommended learning
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Resources matched to the identified development areas.
            </p>
          </div>

          <BookOpen
            size={20}
            className="text-brand-300"
          />
        </div>

        {recommendationsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2
              size={21}
              className="animate-spin text-brand-300"
            />
          </div>
        ) : recommendations.length === 0 ? (
          <EmptyState
            title="No recommendations yet"
            text="Learning resources will appear here when relevant resources are available for the identified gaps."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recommendations.map(
              (
                resource,
                index,
              ) => (
                <div
                  key={
                    resource._id ??
                    `resource-${index}`
                  }
                  className="rounded-xl border border-line bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">
                        {resource.title ??
                          "Learning resource"}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {resource.provider && (
                          <Badge>
                            {
                              resource.provider
                            }
                          </Badge>
                        )}

                        {resource.resourceType && (
                          <Badge>
                            {
                              resource.resourceType
                            }
                          </Badge>
                        )}
                      </div>
                    </div>

                    <FileText
                      size={18}
                      className="shrink-0 text-slate-500"
                    />
                  </div>

                  {resource.description && (
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      {
                        resource.description
                      }
                    </p>
                  )}

                  {resource.url && (
                    <a
                      href={
                        resource.url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-300 transition hover:text-brand-200"
                    >
                      Open resource
                      <ExternalLink
                        size={14}
                      />
                    </a>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Report metadata                                                    */}
      {/* ------------------------------------------------------------------ */}

      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span>
          Role profiles:{" "}
          {
            overview.roleProfiles ??
            roleReports.length
          }
        </span>

        <span>•</span>

        <span>
          Last generated:{" "}
          {report.generatedAt
            ? new Date(
                report.generatedAt,
              ).toLocaleString()
            : "—"}
        </span>
      </div>
    </>
  );
}