import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Download,
  Layers3,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api, unwrap } from "../../api";

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

interface ReadinessDistribution {
  exceptional: number;
  strong: number;
  developing: number;
  needsImprovement: number;
}

interface OrganizationOverview {
  candidates: number;
  roleProfiles: number;
  analyses: number;
  averageReadinessPercentage: number;
  totalCompetencies: number;
  totalStrengths: number;
  totalDevelopmentAreas: number;
}

interface DevelopmentArea {
  competencyId: string;
  competencyName: string;
  competencyType: string;
  candidateCount: number;
  totalGap: number;
  averageGap: number;
}

interface OrganizationAnalytics {
  reportType: string;
  generatedAt: string;

  overview: OrganizationOverview;

  readinessDistribution: ReadinessDistribution;

  topDevelopmentAreas: DevelopmentArea[];

  analyses: unknown[];
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AdminAnalyticsPage() {
  const query = useQuery<OrganizationAnalytics>({
    queryKey: ["organization-analytics"],

    queryFn: async () =>
      unwrap<OrganizationAnalytics>(
        await api.get(
          "/reports/organization/analytics",
        ),
      ),
  });

  async function handleExport() {
    try {
      const response = await api.get(
        "/reports/organization/export.csv",
        {
          responseType: "blob",
        },
      );

      const blob = new Blob(
        [response.data],
        {
          type: "text/csv;charset=utf-8;",
        },
      );

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        "skillforge-organization-report.csv";

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(
        "Organization CSV export failed:",
        error,
      );

      window.alert(
        "Unable to export the organization report. Please try again.",
      );
    }
  }

  if (query.isLoading) {
    return (
      <Loading label="Loading organization analytics..." />
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Analytics unavailable"
        text="We couldn't load the organization analytics. Please try again."
        onRetry={() => query.refetch()}
      />
    );
  }

  const analytics = query.data;

  if (!analytics) {
    return (
      <EmptyState
        title="No analytics available"
        text="There is currently no organizational analytics data to display."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Organization intelligence"
        title="Analytics"
        description="Monitor capability, readiness and development patterns across your organization."
        actions={
          <button
            type="button"
            onClick={handleExport}
            className="btn-secondary"
          >
            <Download size={16} />
            Export CSV
          </button>
        }
      />

      <OverviewMetrics
        overview={analytics.overview}
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <ReadinessDistribution
          distribution={
            analytics.readinessDistribution
          }
        />

        <OrganizationSnapshot
          overview={analytics.overview}
        />
      </div>

      <DevelopmentAreas
        areas={
          analytics.topDevelopmentAreas
        }
      />

      <AnalyticsSummary
        overview={analytics.overview}
        distribution={
          analytics.readinessDistribution
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview Metrics                                                            */
/* -------------------------------------------------------------------------- */

function OverviewMetrics({
  overview,
}: {
  overview: OrganizationOverview;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Candidates"
        value={overview.candidates}
        sub="Candidates with gap analysis"
        icon={Users}
      />

      <StatCard
        label="Role profiles"
        value={overview.roleProfiles}
        sub="Roles represented in analysis"
        icon={Target}
      />

      <StatCard
        label="Analyses"
        value={overview.analyses}
        sub="Latest candidate-role analyses"
        icon={ClipboardCheck}
      />

      <StatCard
        label="Average readiness"
        value={`${Math.round(
          overview.averageReadinessPercentage,
        )}%`}
        sub="Across latest analyses"
        icon={TrendingUp}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Readiness Distribution                                                      */
/* -------------------------------------------------------------------------- */

function ReadinessDistribution({
  distribution,
}: {
  distribution: ReadinessDistribution;
}) {
  const data = [
    {
      band: "Exceptional",
      count: distribution.exceptional,
    },
    {
      band: "Strong",
      count: distribution.strong,
    },
    {
      band: "Developing",
      count: distribution.developing,
    },
    {
      band: "Needs improvement",
      count: distribution.needsImprovement,
    },
  ];

  const hasData =
    data.some(
      (item) => item.count > 0,
    );

  return (
    <Card padding="lg">
      <Section
        title="Readiness distribution"
        description="Distribution of the latest candidate-role analyses by readiness percentage."
      >
        {hasData ? (
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={data}
                margin={{
                  top: 10,
                  right: 10,
                  left: -20,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="band"
                  tick={{
                    fontSize: 11,
                  }}
                  tickLine={false}
                  axisLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{
                    fontSize: 11,
                  }}
                  tickLine={false}
                  axisLine={false}
                />

                <Tooltip
                  cursor={{
                    opacity: 0.08,
                  }}
                  contentStyle={{
                    borderRadius: 12,
                    border:
                      "1px solid rgba(148,163,184,0.15)",
                    background: "#0b1726",
                  }}
                />

                <Bar
                  dataKey="count"
                  radius={[
                    7,
                    7,
                    0,
                    0,
                  ]}
                  maxBarSize={52}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-8">
            <EmptyState
              title="No readiness data yet"
              text="Readiness distribution will appear once gap analyses have been generated."
            />
          </div>
        )}
      </Section>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Organization Snapshot                                                      */
/* -------------------------------------------------------------------------- */

function OrganizationSnapshot({
  overview,
}: {
  overview: OrganizationOverview;
}) {
  return (
    <Card padding="lg">
      <Section
        title="Organization snapshot"
        description="High-level capability indicators from the reporting service."
      >
        <div className="mt-5 space-y-1">
          <SnapshotRow
            label="Average readiness"
            value={`${Math.round(
              overview.averageReadinessPercentage,
            )}%`}
          />

          <SnapshotRow
            label="Total competencies"
            value={
              overview.totalCompetencies
            }
          />

          <SnapshotRow
            label="Strengths identified"
            value={
              overview.totalStrengths
            }
          />

          <SnapshotRow
            label="Development areas"
            value={
              overview.totalDevelopmentAreas
            }
          />
        </div>
      </Section>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Snapshot Row                                                               */
/* -------------------------------------------------------------------------- */

function SnapshotRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-b-0">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span className="text-sm font-semibold text-white">
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Development Areas                                                          */
/* -------------------------------------------------------------------------- */

function DevelopmentAreas({
  areas,
}: {
  areas: DevelopmentArea[];
}) {
  return (
    <Card padding="lg">
      <Section
        title="Top development areas"
        description="Competencies appearing most frequently as development gaps across the latest analyses."
      >
        {areas.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-xl border border-line">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-line bg-panel px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <span>Competency</span>
              <span>Candidates</span>
              <span>Avg. gap</span>
            </div>

            <div className="divide-y divide-line">
              {areas.map(
                (area) => (
                  <div
                    key={
                      area.competencyId
                    }
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-4"
                  >
                    <div className="min-w-0">
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

                    <span className="text-sm font-semibold text-slate-300">
                      {
                        area.candidateCount
                      }
                    </span>

                    <span className="text-sm font-semibold text-white">
                      {area.averageGap.toFixed(
                        1,
                      )}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        ) : (
          <div className="py-8">
            <EmptyState
              title="No development gaps yet"
              text="Top development areas will appear once competency gaps have been identified."
            />
          </div>
        )}
      </Section>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Analytics Summary                                                          */
/* -------------------------------------------------------------------------- */

function AnalyticsSummary({
  overview,
  distribution,
}: {
  overview: OrganizationOverview;
  distribution: ReadinessDistribution;
}) {
  const needsImprovement =
    distribution.needsImprovement;

  const developmentAreas =
    overview.totalDevelopmentAreas;

  return (
    <Section
      title="Analytics summary"
      description="Key signals that help administrators understand the current state of organizational capability."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <InsightCard
          icon={TrendingUp}
          label="Average readiness"
          value={`${Math.round(
            overview.averageReadinessPercentage,
          )}%`}
          description="Average readiness across the latest candidate-role gap analyses."
        />

        <InsightCard
          icon={AlertTriangle}
          label="Needs improvement"
          value={`${needsImprovement} ${
            needsImprovement === 1
              ? "analysis"
              : "analyses"
          }`}
          description="Latest analyses with readiness below 60%."
        />

        <InsightCard
          icon={Layers3}
          label="Development gaps"
          value={String(
            developmentAreas,
          )}
          description="Total competency-level development areas identified across the latest analyses."
        />
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Insight Card                                                               */
/* -------------------------------------------------------------------------- */

function InsightCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Card padding="lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>

          <p className="mt-3 text-xl font-bold text-white">
            {value}
          </p>
        </div>

        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
          <Icon size={17} />
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-600">
        {description}
      </p>
    </Card>
  );
}