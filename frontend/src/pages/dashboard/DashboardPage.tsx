import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileBarChart2,
  FileText,
  Target,
  Users,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api, errorMessage, unwrap } from "../../api";
import { useAuth } from "../../auth";
import {
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Section,
  StatCard,
} from "../../components/ui";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type UserRole =
  | "PLATFORM_ADMIN"
  | "ORGANIZATION_ADMIN"
  | "MANAGER"
  | "STAFF";

interface OrganizationStats {
  totalUsers?: number;
  admins?: number;
  managers?: number;
  staff?: number;
}

interface OrganizationAnalytics {
  overview?: {
    candidates?: number;
    roleProfiles?: number;
    analyses?: number;
    averageReadinessPercentage?: number;
    totalCompetencies?: number;
    totalStrengths?: number;
    totalDevelopmentAreas?: number;
  };

  readinessDistribution?: {
    exceptional?: number;
    strong?: number;
    developing?: number;
    needsImprovement?: number;
  };

  topDevelopmentAreas?: Array<{
    competencyId: string;
    competencyName: string;
    competencyType: string;
    candidateCount: number;
    totalGap: number;
    averageGap: number;
  }>;
}

interface CandidateOverview {
  overview?: {
    roleProfiles?: number;
    averageReadinessPercentage?: number;
    totalCompetencies?: number;
    totalStrengths?: number;
    totalDevelopmentAreas?: number;
  };

  roleReports?: Array<{
    gapAnalysisId?: string;
    roleProfileId?: string;
    roleProfile?: {
      id?: string;
      name?: string;
      slug?: string;
      status?: string;
      department?: string;
    } | null;

    readinessPercentage?: number;
    overallTargetLevel?: number;
    overallCurrentLevel?: number;
    overallGap?: number;
    competencyCount?: number;
    strengthsCount?: number;
    developmentAreasCount?: number;
    generatedAt?: string;
  }>;

  topDevelopmentAreas?: Array<{
    competencyName?: string;
    competencyType?: string;
    gap?: number;
  }>;

  topStrengths?: Array<{
    competencyName?: string;
    competencyType?: string;
    currentLevel?: number;
  }>;
}

interface TeamMember {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  managerId?: string;
  isActive: boolean;
  createdAt?: string;
}

interface Corroboration {
  _id: string;
  status?: string;
  createdAt?: string;

  candidateId?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    jobTitle?: string;
    department?: string;
  };

  selfAssessmentId?: {
    _id?: string;
    status?: string;
    submittedAt?: string;
    dueAt?: string;
  };
}

interface QuickActionProps {
  title: string;
  text: string;
  to: string;
  icon: LucideIcon;
}

interface ChartPoint {
  name: string;
  value: number;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function QuickAction({
  title,
  text,
  to,
  icon: Icon,
}: QuickActionProps) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-xl border border-line p-4 transition hover:border-brand-500/30 hover:bg-panel2"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-600">
          {text}
        </p>
      </div>

      <ArrowRight
        size={16}
        className="text-slate-700 transition group-hover:translate-x-1 group-hover:text-brand-300"
      />
    </Link>
  );
}

function buildCandidateChart(
  data: CandidateOverview,
): ChartPoint[] {
  const firstRole = data.roleReports?.[0];

  return [
    {
      name: "Current",
      value: Number(
        firstRole?.overallCurrentLevel ?? 0,
      ),
    },
    {
      name: "Target",
      value: Number(
        firstRole?.overallTargetLevel ?? 0,
      ),
    },
    {
      name: "Readiness",
      value: Math.round(
        Number(
          firstRole?.readinessPercentage ?? 0,
        ) / 10,
      ),
    },
  ];
}

function getUserRole(
  user: { role?: string } | null | undefined,
): UserRole | undefined {
  if (
    user?.role === "PLATFORM_ADMIN" ||
    user?.role === "ORGANIZATION_ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "STAFF"
  ) {
    return user.role;
  }

  return undefined;
}

function getCandidateName(
  candidate?: Corroboration["candidateId"],
) {
  if (!candidate) {
    return "Staff member";
  }

  return (
    `${candidate.firstName ?? ""} ${
      candidate.lastName ?? ""
    }`.trim() || "Staff member"
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function DashboardPage() {
  const {
    user,
    isAdmin,
    userId,
  } = useAuth();

  const role = getUserRole(user);

  const isPlatformAdmin =
    role === "PLATFORM_ADMIN";

  const isOrganizationAdmin =
    role === "ORGANIZATION_ADMIN";

  const isManager =
    role === "MANAGER";

  const isStaff =
    role === "STAFF";

  const isRegularUser =
    isManager || isStaff;

  /* ------------------------------------------------------------------------ */
  /* Organization stats                                                       */
  /* ------------------------------------------------------------------------ */

  const organizationStatsQuery =
    useQuery({
      queryKey: [
        "organization-stats",
      ],

      queryFn: async () =>
        unwrap<OrganizationStats>(
          await api.get(
            "/organizations/me/stats",
          ),
        ),

      enabled:
        isOrganizationAdmin,
    });

  /* ------------------------------------------------------------------------ */
  /* Organization analytics                                                  */
  /* ------------------------------------------------------------------------ */

  const organizationAnalyticsQuery =
    useQuery({
      queryKey: [
        "organization-analytics",
      ],

      queryFn: async () =>
        unwrap<OrganizationAnalytics>(
          await api.get(
            "/reports/organization/analytics",
          ),
        ),

      enabled:
        isAdmin,
    });

  /* ------------------------------------------------------------------------ */
  /* Candidate overview                                                       */
  /* ------------------------------------------------------------------------ */

  const candidateQuery =
    useQuery({
      queryKey: [
        "candidate-overview",
        userId,
      ],

      queryFn: async () =>
        unwrap<CandidateOverview>(
          await api.get(
            `/reports/candidates/${userId}/overview`,
          ),
        ),

      enabled:
        Boolean(userId) &&
        isStaff,
    });

  /* ------------------------------------------------------------------------ */
  /* Manager team                                                             */
  /* ------------------------------------------------------------------------ */

  const managerTeamQuery =
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

  /* ------------------------------------------------------------------------ */
  /* Manager pending corroborations                                          */
  /* ------------------------------------------------------------------------ */

  const managerCorroborationsQuery =
    useQuery({
      queryKey: [
        "manager",
        "corroborations",
        "pending",
      ],

      queryFn: async () =>
        unwrap<Corroboration[]>(
          await api.get(
            "/manager-corroborations/pending",
          ),
        ),

      enabled:
        isManager,
    });

  const organizationStats =
    organizationStatsQuery.data ?? {};

  const organizationAnalytics =
    organizationAnalyticsQuery.data ?? {};

  const candidateData =
    candidateQuery.data ?? {};

  const teamMembers =
    managerTeamQuery.data ?? [];

  const pendingCorroborations =
    managerCorroborationsQuery.data ?? [];

  /* ------------------------------------------------------------------------ */
  /* Loading / error state                                                    */
  /* ------------------------------------------------------------------------ */

  const isLoading =
    organizationStatsQuery.isLoading ||
    organizationAnalyticsQuery.isLoading ||
    candidateQuery.isLoading ||
    managerTeamQuery.isLoading ||
    managerCorroborationsQuery.isLoading;

  const isError =
    (isOrganizationAdmin &&
      organizationStatsQuery.isError) ||
    (isAdmin &&
      organizationAnalyticsQuery.isError) ||
    (isStaff &&
      candidateQuery.isError) ||
    (isManager &&
      (managerTeamQuery.isError ||
        managerCorroborationsQuery.isError));

  function retry() {
    if (isOrganizationAdmin) {
      organizationStatsQuery.refetch();
    }

    if (isAdmin) {
      organizationAnalyticsQuery.refetch();
    }

    if (isStaff) {
      candidateQuery.refetch();
    }

    if (isManager) {
      managerTeamQuery.refetch();
      managerCorroborationsQuery.refetch();
    }
  }

  const chartData =
    buildCandidateChart(candidateData);

  return (
    <>
      <PageHeader
        eyebrow={
          isManager
            ? "Manager overview"
            : "Overview"
        }
        title={`Good to see you, ${
          user?.firstName ?? "there"
        }.`}
        description={
          isManager
            ? "Monitor your team, review corroborations and keep staff development moving."
            : "A single workspace for assessments, capability evidence, role expectations and development."
        }
        actions={
          <>
            {isManager ? (
              <>
                <Link
                  className="btn-secondary"
                  to="/manager/team"
                >
                  <Users size={16} />
                  My team
                </Link>

                <Link
                  className="btn-primary"
                  to="/manager-corroborations"
                >
                  <ClipboardCheck size={16} />
                  Review corroborations
                </Link>
              </>
            ) : (
              <>
                <Link
                  className="btn-secondary"
                  to="/reports"
                >
                  <FileBarChart2 size={16} />
                  View reports
                </Link>

                <Link
                  className="btn-primary"
                  to="/assessments"
                >
                  <ClipboardCheck size={16} />
                  Assessments
                </Link>
              </>
            )}
          </>
        }
      />

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState
          text="The dashboard metrics could not be loaded."
          onRetry={retry}
        />
      ) : (
        <>
          {isManager ? (
            <ManagerDashboard
              teamMembers={teamMembers}
              pendingCorroborations={
                pendingCorroborations
              }
            />
          ) : (
            <>
              <DashboardStats
                role={role}
                organizationStats={
                  organizationStats
                }
                organizationAnalytics={
                  organizationAnalytics
                }
                candidateData={
                  candidateData
                }
              />

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
                <Card className="p-6">
                  <Section
                    title="Capability snapshot"
                    description={
                      isAdmin
                        ? "Organization-level capability and operating metrics."
                        : "Current capability compared with your role expectations."
                    }
                  >
                    {isAdmin ? (
                      <AdminCapabilitySnapshot
                        analytics={
                          organizationAnalytics
                        }
                      />
                    ) : chartData.some(
                        (point) =>
                          point.value > 0,
                      ) ? (
                      <CapabilityChart
                        data={chartData}
                      />
                    ) : (
                      <EmptyState
                        title="Your capability snapshot will appear here"
                        text="Complete an assessment or self-assessment to populate objective evidence and readiness."
                        action={
                          <Link
                            to="/assessments"
                            className="btn-primary"
                          >
                            Explore assessments
                          </Link>
                        }
                      />
                    )}
                  </Section>
                </Card>

                <Card className="p-6">
                  <Section
                    title="What you can do next"
                    description="Keep the workspace moving."
                  >
                    <div className="space-y-3">
                      {isAdmin ? (
                        <AdminQuickActions
                          isPlatformAdmin={
                            isPlatformAdmin
                          }
                        />
                      ) : (
                        <>
                          <QuickAction
                            title="Take a self-assessment"
                            text="Rate competencies and attach evidence."
                            to="/self-assessments"
                            icon={
                              UserRoundCheck
                            }
                          />

                          <QuickAction
                            title="Review your gaps"
                            text="See strengths and development areas."
                            to="/reports"
                            icon={
                              FileBarChart2
                            }
                          />

                          <QuickAction
                            title="Manage role expectations"
                            text="Browse the role profiles available to you."
                            to="/role-profiles"
                            icon={Users}
                          />
                        </>
                      )}
                    </div>
                  </Section>
                </Card>
              </div>

              {isAdmin && (
                <AdminDevelopmentSnapshot
                  analytics={
                    organizationAnalytics
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Manager Dashboard                                                          */
/* -------------------------------------------------------------------------- */

interface ManagerDashboardProps {
  teamMembers: TeamMember[];
  pendingCorroborations: Corroboration[];
}

function ManagerDashboard({
  teamMembers,
  pendingCorroborations,
}: ManagerDashboardProps) {
  const activeStaff =
    teamMembers.filter(
      (member) => member.isActive,
    ).length;

  const departments = new Set(
    teamMembers
      .map(
        (member) =>
          member.department?.trim(),
      )
      .filter(Boolean),
  ).size;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Team members"
          value={teamMembers.length}
          sub="Staff assigned to you"
          icon={Users}
        />

        <StatCard
          label="Active staff"
          value={activeStaff}
          sub="Currently active"
          icon={CheckCircle2}
        />

        <StatCard
          label="Pending reviews"
          value={
            pendingCorroborations.length
          }
          sub="Corroborations awaiting review"
          icon={Clock3}
        />

        <StatCard
          label="Departments"
          value={departments}
          sub="Represented across your team"
          icon={Building2}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <Card className="p-6">
          <Section
            title="My team"
            description="Staff members currently assigned to you."
            actions={
              <Link
                to="/manager/team"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-300 transition hover:text-brand-200"
              >
                View all
                <ArrowRight size={14} />
              </Link>
            }
          >
            {teamMembers.length === 0 ? (
              <EmptyState
                title="No staff assigned yet"
                text="Staff members assigned to you will appear here."
              />
            ) : (
              <div className="space-y-2">
                {teamMembers
                  .slice(0, 6)
                  .map((member) => (
                    <Link
                      key={member._id}
                      to={`/reports?candidateId=${encodeURIComponent(
                        member._id,
                      )}`}
                      className="group flex items-center gap-4 rounded-xl border border-line p-4 transition hover:border-brand-500/30 hover:bg-panel2"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-300">
                        {member.firstName?.[0] ?? ""}
                        {member.lastName?.[0] ?? ""}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {member.firstName}{" "}
                          {member.lastName}
                        </p>

                        <p className="mt-1 truncate text-xs text-slate-600">
                          {member.jobTitle ||
                            "Staff member"}
                          {member.department
                            ? ` · ${member.department}`
                            : ""}
                        </p>
                      </div>

                      <div className="hidden text-right sm:block">
                        <p className="text-xs text-slate-500">
                          {member.email}
                        </p>

                        <p
                          className={[
                            "mt-1 text-[10px] font-semibold uppercase tracking-wide",
                            member.isActive
                              ? "text-emerald-400"
                              : "text-slate-600",
                          ].join(" ")}
                        >
                          {member.isActive
                            ? "Active"
                            : "Inactive"}
                        </p>
                      </div>

                      <ArrowRight
                        size={15}
                        className="shrink-0 text-slate-700 transition group-hover:translate-x-1 group-hover:text-brand-300"
                      />
                    </Link>
                  ))}
              </div>
            )}
          </Section>
        </Card>

        <Card className="p-6">
          <Section
            title="Pending corroborations"
            description="Self-assessments waiting for your review."
            actions={
              <Link
                to="/manager-corroborations"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-300 transition hover:text-brand-200"
              >
                Open queue
                <ArrowRight size={14} />
              </Link>
            }
          >
            {pendingCorroborations.length ===
            0 ? (
              <EmptyState
                title="You're all caught up"
                text="There are no pending corroborations requiring your attention."
              />
            ) : (
              <div className="space-y-3">
                {pendingCorroborations
                  .slice(0, 5)
                  .map((item) => (
                    <Link
                      key={item._id}
                      to={`/manager-corroborations/${item._id}`}
                      className="group block rounded-xl border border-line p-4 transition hover:border-brand-500/30 hover:bg-panel2"
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-300">
                          <Clock3 size={16} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {getCandidateName(
                              item.candidateId,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            Submitted{" "}
                            {formatDate(
                              item
                                .selfAssessmentId
                                ?.submittedAt ??
                                item.createdAt,
                            )}
                          </p>
                        </div>

                        <ArrowRight
                          size={15}
                          className="shrink-0 text-slate-700 transition group-hover:translate-x-1 group-hover:text-brand-300"
                        />
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </Section>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <Section
          title="Manager actions"
          description="Common tasks for managing your team's capability development."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction
              title="My team"
              text="View everyone assigned to you."
              to="/manager/team"
              icon={Users}
            />

            <QuickAction
              title="Review corroborations"
              text="Confirm or adjust staff self-assessment levels."
              to="/manager-corroborations"
              icon={ClipboardCheck}
            />

            <QuickAction
              title="Team reports"
              text="Open a staff member's capability and gap report."
              to="/manager/team"
              icon={FileBarChart2}
            />

            <QuickAction
              title="Role profiles"
              text="Review the role expectations used by your team."
              to="/role-profiles"
              icon={Target}
            />

            <QuickAction
              title="Assessments"
              text="Review available structured assessments."
              to="/assessments"
              icon={ClipboardCheck}
            />

            <QuickAction
              title="Learning resources"
              text="Explore development resources for capability gaps."
              to="/learning-resources"
              icon={BrainCircuit}
            />
          </div>
        </Section>
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard Stats                                                            */
/* -------------------------------------------------------------------------- */

interface DashboardStatsProps {
  role?: UserRole;
  organizationStats: OrganizationStats;
  organizationAnalytics: OrganizationAnalytics;
  candidateData: CandidateOverview;
}

function DashboardStats({
  role,
  organizationStats,
  organizationAnalytics,
  candidateData,
}: DashboardStatsProps) {
  const isAdmin =
    role === "PLATFORM_ADMIN" ||
    role === "ORGANIZATION_ADMIN";

  if (isAdmin) {
    const overview =
      organizationAnalytics.overview ?? {};

    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users"
          value={
            role === "ORGANIZATION_ADMIN"
              ? organizationStats.totalUsers ??
                "—"
              : "—"
          }
          sub={
            role === "ORGANIZATION_ADMIN"
              ? `${organizationStats.managers ?? 0} managers · ${
                  organizationStats.staff ?? 0
                } staff`
              : "Platform-level access"
          }
          icon={Users}
        />

        <StatCard
          label="Candidates"
          value={
            overview.candidates ??
            "—"
          }
          icon={Users}
        />

        <StatCard
          label="Role profiles"
          value={
            overview.roleProfiles ??
            "—"
          }
          icon={Target}
        />

        <StatCard
          label="Analyses"
          value={
            overview.analyses ??
            "—"
          }
          icon={BarChart3}
        />
      </div>
    );
  }

  const overview =
    candidateData.overview ?? {};

  const firstRole =
    candidateData.roleReports?.[0];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Readiness"
        value={
          overview.averageReadinessPercentage !=
          null
            ? `${Math.round(
                overview.averageReadinessPercentage,
              )}%`
            : "—"
        }
        sub={
          overview.roleProfiles
            ? `${overview.roleProfiles} role profile${
                overview.roleProfiles === 1
                  ? ""
                  : "s"
              }`
            : "No role analysis yet"
        }
        icon={Target}
      />

      <StatCard
        label="Current level"
        value={
          firstRole?.overallCurrentLevel ??
          "—"
        }
        icon={Activity}
      />

      <StatCard
        label="Target level"
        value={
          firstRole?.overallTargetLevel ??
          "—"
        }
        icon={Target}
      />

      <StatCard
        label="Overall gap"
        value={
          firstRole?.overallGap ??
          "—"
        }
        icon={BarChart3}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Admin Capability Snapshot                                                  */
/* -------------------------------------------------------------------------- */

interface AdminCapabilitySnapshotProps {
  analytics: OrganizationAnalytics;
}

function AdminCapabilitySnapshot({
  analytics,
}: AdminCapabilitySnapshotProps) {
  const distribution =
    analytics.readinessDistribution;

  if (!distribution) {
    return (
      <EmptyState
        title="No capability data yet"
        text="Organization readiness information will appear here once candidates have completed assessments and gap analyses."
      />
    );
  }

  const data: ChartPoint[] = [
    {
      name: "Exceptional",
      value:
        distribution.exceptional ?? 0,
    },
    {
      name: "Strong",
      value:
        distribution.strong ?? 0,
    },
    {
      name: "Developing",
      value:
        distribution.developing ?? 0,
    },
    {
      name: "Needs improvement",
      value:
        distribution.needsImprovement ?? 0,
    },
  ];

  const hasData =
    data.some(
      (item) => item.value > 0,
    );

  if (!hasData) {
    return (
      <EmptyState
        title="No capability data yet"
        text="Readiness distribution will appear after gap analyses have been generated."
      />
    );
  }

  return (
    <div>
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <MiniMetric
          label="Exceptional"
          value={
            distribution.exceptional ?? 0
          }
        />

        <MiniMetric
          label="Strong"
          value={
            distribution.strong ?? 0
          }
        />

        <MiniMetric
          label="Developing"
          value={
            distribution.developing ?? 0
          }
        />

        <MiniMetric
          label="Needs improvement"
          value={
            distribution.needsImprovement ?? 0
          }
        />
      </div>

      <div className="h-64">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: -25,
              bottom: 0,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="name"
              tick={{
                fontSize: 11,
              }}
            />

            <YAxis
              allowDecimals={false}
            />

            <Tooltip />

            <Bar
              dataKey="value"
              radius={[
                7,
                7,
                0,
                0,
              ]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Admin Development Snapshot                                                 */
/* -------------------------------------------------------------------------- */

interface AdminDevelopmentSnapshotProps {
  analytics: OrganizationAnalytics;
}

function AdminDevelopmentSnapshot({
  analytics,
}: AdminDevelopmentSnapshotProps) {
  const areas =
    analytics.topDevelopmentAreas ?? [];

  return (
    <Card className="mt-6 p-6">
      <Section
        title="Top development areas"
        description="Competencies with the largest organization-wide development demand."
      >
        {areas.length === 0 ? (
          <EmptyState
            title="No development areas yet"
            text="Development areas will appear here as organization gap analyses are generated."
          />
        ) : (
          <div className="space-y-3">
            {areas.slice(0, 5).map(
              (area) => (
                <div
                  key={
                    area.competencyId
                  }
                  className="flex items-center gap-4 rounded-xl border border-line p-4"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
                    <Target size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {
                        area.competencyName
                      }
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      {
                        area.competencyType
                      }
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">
                      {
                        area.candidateCount
                      }
                    </p>

                    <p className="text-xs text-slate-600">
                      candidate
                      {area.candidateCount ===
                      1
                        ? ""
                        : "s"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">
                      {Number(
                        area.averageGap,
                      ).toFixed(1)}
                    </p>

                    <p className="text-xs text-slate-600">
                      avg gap
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </Section>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Admin Quick Actions                                                        */
/* -------------------------------------------------------------------------- */

interface AdminQuickActionsProps {
  isPlatformAdmin: boolean;
}

function AdminQuickActions({
  isPlatformAdmin,
}: AdminQuickActionsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {!isPlatformAdmin && (
        <QuickAction
          title="Organization"
          text="Manage organization details, plan and seat usage."
          to="/admin/organization"
          icon={Building2}
        />
      )}

      {!isPlatformAdmin && (
        <QuickAction
          title="Users"
          text="Manage organization users, roles and managers."
          to="/admin/users"
          icon={Users}
        />
      )}

      <QuickAction
        title="Assessments"
        text="Create and manage structured assessment content."
        to="/assessments"
        icon={ClipboardCheck}
      />

      <QuickAction
        title="Role profiles"
        text="Define target skills and behavioural expectations."
        to="/role-profiles"
        icon={Target}
      />

      <QuickAction
        title="Analytics"
        text="Review organization capability patterns."
        to="/admin/analytics"
        icon={BarChart3}
      />

      <QuickAction
        title="AI review"
        text="Review AI-generated mappings and questions."
        to="/admin/ai-review"
        icon={BrainCircuit}
      />

      <QuickAction
        title="Audit logs"
        text="Review administrative activity across the workspace."
        to="/admin/audit"
        icon={FileBarChart2}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mini Metric                                                                */
/* -------------------------------------------------------------------------- */

interface MiniMetricProps {
  label: string;
  value: number;
}

function MiniMetric({
  label,
  value,
}: MiniMetricProps) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Candidate Capability Chart                                                 */
/* -------------------------------------------------------------------------- */

interface CapabilityChartProps {
  data: ChartPoint[];
}

function CapabilityChart({
  data,
}: CapabilityChartProps) {
  return (
    <div className="h-72">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: -25,
            bottom: 0,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
          />

          <XAxis dataKey="name" />

          <YAxis />

          <Tooltip />

          <Bar
            dataKey="value"
            radius={[
              7,
              7,
              0,
              0,
            ]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}