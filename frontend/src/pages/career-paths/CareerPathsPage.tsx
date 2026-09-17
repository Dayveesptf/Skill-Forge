import {
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  Plus,
  Route,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import {
  useEffect,
  useState,
} from "react";

import {
  api,
  errorMessage,
  unwrap,
} from "../../api";

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Section,
} from "../../components/ui";

import {
  useAuth,
} from "../../auth";

interface RoleProfile {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  department?: string;
  frameworkVersionId?: string;
  status?: string;
}

interface CareerPath {
  _id: string;
  name?: string;
  description?: string;

  sourceRoleProfileId:
    | RoleProfile
    | string;

  targetRoleProfileId:
    | RoleProfile
    | string;

  skillDeltas: Array<{
    skillId: string;
    sourceLevel?: number;
    targetLevel?: number;
    delta: number;
    changeType: string;
  }>;

  behaviouralFactorDeltas: Array<{
    behaviouralFactorId: string;
    sourceLevel?: number;
    targetLevel?: number;
    delta: number;
    changeType: string;
  }>;

  createdAt: string;
}

function getRoleName(
  role:
    | RoleProfile
    | string,
) {
  if (
    typeof role === "string"
  ) {
    return "Role profile";
  }

  return role.name;
}

function changeCounts(
  careerPath: CareerPath,
) {
  const changes = [
    ...careerPath.skillDeltas,
    ...careerPath.behaviouralFactorDeltas,
  ];

  return {
    increased: changes.filter(
      (item) =>
        item.changeType ===
        "INCREASED",
    ).length,

    decreased: changes.filter(
      (item) =>
        item.changeType ===
        "DECREASED",
    ).length,

    added: changes.filter(
      (item) =>
        item.changeType ===
        "ADDED",
    ).length,

    removed: changes.filter(
      (item) =>
        item.changeType ===
        "REMOVED",
    ).length,

    unchanged: changes.filter(
      (item) =>
        item.changeType ===
        "UNCHANGED",
    ).length,
  };
}

export default function CareerPathsPage() {
  const {
    user,
  } = useAuth();

  const [
    careerPaths,
    setCareerPaths,
  ] = useState<CareerPath[]>(
    [],
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const canCreate =
    user?.role ===
    "ORGANIZATION_ADMIN";

  async function loadCareerPaths() {
    try {
      setLoading(true);
      setError(null);

      const response =
        await api.get(
          "/career-paths",
        );

      const data =
        unwrap<CareerPath[]>(
          response,
        );

      setCareerPaths(
        Array.isArray(data)
          ? data
          : [],
      );
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Unable to load career paths.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCareerPaths();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Career development"
        title="Career Paths"
        description="Connect published roles and understand the capability changes required to move from one role to another."
        actions={
          canCreate ? (
            <Link
              to="/career-paths/new"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400"
            >
              <Plus size={16} />
              Create career path
            </Link>
          ) : undefined
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState text={error} />
      ) : careerPaths.length === 0 ? (
        <EmptyState
        title="No career paths yet"
        text={
            canCreate
            ? "Create a career path between two published role profiles to define the development journey."
            : "No career paths have been configured for your organization yet."
        }
        />
      ) : (
        <Section
          title="Configured career paths"
          description={`${careerPaths.length} career ${
            careerPaths.length === 1
              ? "path"
              : "paths"
          }`}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {careerPaths.map(
              (careerPath) => {
                const counts =
                  changeCounts(
                    careerPath,
                  );

                return (
                  <Card
                    key={careerPath._id}
                    className="group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-3 flex items-center gap-2">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
                            <Route
                              size={17}
                            />
                          </div>

                          <Badge tone="green">
                            Published roles
                          </Badge>
                        </div>

                        <h3 className="text-lg font-semibold text-white">
                          {careerPath.name ||
                            "Career path"}
                        </h3>

                        {careerPath.description && (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                            {
                              careerPath.description
                            }
                          </p>
                        )}
                      </div>

                      <Link
                        to={`/career-paths/${careerPath._id}`}
                        className="rounded-xl border border-line p-2 text-slate-500 transition hover:border-brand-500/40 hover:text-white"
                        aria-label="View career path"
                      >
                        <ChevronRight
                          size={18}
                        />
                      </Link>
                    </div>

                    <div className="mt-6 flex items-center gap-3 rounded-xl border border-line bg-slate-950/30 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                          From
                        </p>

                        <p className="mt-1 truncate text-sm font-semibold text-white">
                          {getRoleName(
                            careerPath.sourceRoleProfileId,
                          )}
                        </p>
                      </div>

                      <ArrowRight
                        size={18}
                        className="shrink-0 text-brand-300"
                      />

                      <div className="min-w-0 flex-1 text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                          To
                        </p>

                        <p className="mt-1 truncate text-sm font-semibold text-white">
                          {getRoleName(
                            careerPath.targetRoleProfileId,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <ChangeStat
                        icon={
                          <TrendingUp
                            size={14}
                          />
                        }
                        label="Increase"
                        value={
                          counts.increased
                        }
                      />

                      <ChangeStat
                        icon={
                          <TrendingDown
                            size={14}
                          />
                        }
                        label="Decrease"
                        value={
                          counts.decreased
                        }
                      />

                      <ChangeStat
                        icon={
                          <Plus
                            size={14}
                          />
                        }
                        label="Added"
                        value={
                          counts.added
                        }
                      />

                      <ChangeStat
                        icon={
                          <BriefcaseBusiness
                            size={14}
                          />
                        }
                        label="Total"
                        value={
                          careerPath
                            .skillDeltas
                            .length +
                          careerPath
                            .behaviouralFactorDeltas
                            .length
                        }
                      />
                    </div>
                  </Card>
                );
              },
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function ChangeStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center gap-2 text-brand-300">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {label}
        </span>
      </div>

      <p className="mt-2 text-lg font-semibold text-white">
        {value}
      </p>
    </div>
  );
}