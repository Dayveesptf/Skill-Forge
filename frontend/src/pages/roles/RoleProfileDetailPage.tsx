import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BrainCircuit,
  Edit3,
  Layers3,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

import { api, unwrap } from "../../api";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Section,
} from "../../components/ui";

interface RoleSkill {
  skillId?: string;
  name?: string;
  competencyName?: string;
  targetLevel?: number;
  level?: number;
  weight?: number;
}

interface BehaviouralFactor {
  behaviouralFactorId?: string;
  name?: string;
  competencyName?: string;
  targetLevel?: number;
  level?: number;
  weight?: number;
}

interface RoleProfile {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  frameworkVersionId?:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
        version?: string;
      };
  skills?: RoleSkill[];
  behaviouralFactors?: BehaviouralFactor[];
}

interface CompetencySectionProps {
  title: string;
  items: Array<RoleSkill | BehaviouralFactor>;
  type: "skill" | "behavioural";
}

interface MiniProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
}

function getFrameworkLabel(
  framework:
    | RoleProfile["frameworkVersionId"]
    | undefined,
): string {
  if (!framework) {
    return "—";
  }

  if (typeof framework === "string") {
    return framework;
  }

  return (
    framework.name ??
    framework.version ??
    framework._id ??
    framework.id ??
    "—"
  );
}

function getCompetencyId(
  item: RoleSkill | BehaviouralFactor,
  type: "skill" | "behavioural",
): string | undefined {
  return type === "skill"
    ? (item as RoleSkill).skillId
    : (item as BehaviouralFactor)
        .behaviouralFactorId;
}

function getCompetencyName(
  item: RoleSkill | BehaviouralFactor,
  type: "skill" | "behavioural",
  index: number,
): string {
  return (
    item.name ??
    item.competencyName ??
    getCompetencyId(item, type) ??
    `${type === "skill" ? "Skill" : "Behavioural factor"} ${index + 1}`
  );
}

function Mini({
  icon: Icon,
  label,
  value,
}: MiniProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
          <Icon size={16} />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-slate-600">
            {label}
          </p>

          <p className="mt-1 max-w-[160px] truncate text-sm font-semibold text-white">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

function CompetencySection({
  title,
  items,
  type,
}: CompetencySectionProps) {
  return (
    <Card className="p-6">
      <Section
        title={title}
        description="Target competency level and weighting."
      >
        {items.length > 0 ? (
          <div className="divide-y divide-line">
            {items.map((item, index) => {
              const name = getCompetencyName(
                item,
                type,
                index,
              );

              return (
                <div
                  key={
                    getCompetencyId(
                      item,
                      type,
                    ) ?? `${type}-${index}`
                  }
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-white">
                      {name}
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      Weight {item.weight ?? 1}
                    </p>
                  </div>

                  <Badge tone="blue">
                    Level{" "}
                    {item.targetLevel ??
                      item.level ??
                      "—"}
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={`No ${title.toLowerCase()} configured`}
            text="Add competencies to define this role."
          />
        )}
      </Section>
    </Card>
  );
}

export default function RoleProfileDetailPage() {
  const { id } = useParams<{
    id: string;
  }>();

  const query = useQuery({
    queryKey: ["role-profile", id],
    queryFn: async () =>
      unwrap<RoleProfile>(
        await api.get(
          `/role-profiles/${id}`,
        ),
      ),
    enabled: Boolean(id),
  });

  if (query.isLoading) {
    return <Loading />;
  }

  if (query.isError) {
    return (
      <ErrorState
        text="Role profile could not be loaded."
        onRetry={() => query.refetch()}
      />
    );
  }

  const roleProfile = query.data ?? {};
  const skills = roleProfile.skills ?? [];
  const behaviouralFactors =
    roleProfile.behaviouralFactors ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Role profile"
        title={
          roleProfile.name ??
          roleProfile.title ??
          "Role profile"
        }
        description={
          roleProfile.description ??
          "Competency expectations for this role."
        }
        actions={
          <>
            <Link
              to="/role-profiles"
              className="btn-secondary"
            >
              <ArrowLeft size={16} />
              Back
            </Link>

            <Link
              to={`/role-profiles/${id}/edit`}
              className="btn-secondary"
            >
              <Edit3 size={16} />
              Edit
            </Link>

            <Link
              to={`/admin/ai-review?roleProfileId=${id}`}
              className="btn-secondary"
            >
              <BrainCircuit size={16} />
              AI suggestions
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Mini
          icon={Layers3}
          label="Skills"
          value={skills.length}
        />

        <Mini
          icon={UserRoundCheck}
          label="Behavioural factors"
          value={behaviouralFactors.length}
        />

        <Mini
          icon={Layers3}
          label="Framework"
          value={getFrameworkLabel(
            roleProfile.frameworkVersionId,
          )}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <CompetencySection
          title="Skills"
          items={skills}
          type="skill"
        />

        <CompetencySection
          title="Behavioural factors"
          items={behaviouralFactors}
          type="behavioural"
        />
      </div>
    </>
  );
}