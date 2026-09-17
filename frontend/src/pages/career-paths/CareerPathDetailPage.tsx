import {
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  Link,
  useNavigate,
  useParams,
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
  description?: string;
  department?: string;
}

interface CareerPathItem {
  skillId?: string;
  behaviouralFactorId?: string;
  sourceLevel?: number;
  targetLevel?: number;
  delta: number;
  changeType: string;
}

interface CareerPath {
  _id: string;
  name?: string;
  description?: string;
  skillDeltas: CareerPathItem[];
  behaviouralFactorDeltas: CareerPathItem[];
}

interface Skill {
  _id: string;
  name: string;
  description?: string;
}

interface BehaviouralFactor {
  _id: string;
  name: string;
  description?: string;
}

interface CareerPathResponse {
  careerPath: CareerPath;
  sourceRoleProfile?: RoleProfile;
  targetRoleProfile?: RoleProfile;
  skills: Skill[];
  behaviouralFactors: BehaviouralFactor[];
}

function changeTone(
  changeType: string,
) {
  switch (changeType) {
    case "INCREASED":
      return "green";

    case "ADDED":
      return "blue";

    case "DECREASED":
      return "red";

    case "REMOVED":
      return "red";

    default:
      return "slate";
  }
}

function changeLabel(
  changeType: string,
) {
  switch (changeType) {
    case "INCREASED":
      return "Increase";

    case "ADDED":
      return "Added";

    case "DECREASED":
      return "Decrease";

    case "REMOVED":
      return "Removed";

    default:
      return "Unchanged";
  }
}

function ChangeIcon({
  changeType,
}: {
  changeType: string;
}) {
  if (
    changeType === "INCREASED"
  ) {
    return <TrendingUp size={15} />;
  }

  if (
    changeType === "DECREASED" ||
    changeType === "REMOVED"
  ) {
    return <TrendingDown size={15} />;
  }

  if (
    changeType === "ADDED"
  ) {
    return <Plus size={15} />;
  }

  if (
    changeType === "UNCHANGED"
  ) {
    return <Check size={15} />;
  }

  return <Minus size={15} />;
}

export default function CareerPathDetailPage() {
  const {
    id,
  } = useParams();

  const navigate =
    useNavigate();

  const {
    user,
  } = useAuth();

  const [
    data,
    setData,
  ] = useState<
    CareerPathResponse | null
  >(null);

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

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const canManage =
    user?.role ===
    "ORGANIZATION_ADMIN";

  async function load() {
    if (!id) {
      setError(
        "Career path ID is missing.",
      );
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response =
        await api.get(
          `/career-paths/${id}`,
        );

      setData(
        unwrap<CareerPathResponse>(
          response,
        ),
      );
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Unable to load career path.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function handleDelete() {
    if (!id) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this career path? This action cannot be undone.",
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);

      await api.delete(
        `/career-paths/${id}`,
      );

      navigate(
        "/career-paths",
        {
          replace: true,
        },
      );
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Unable to delete career path.",
        ),
      );
      setDeleting(false);
    }
  }

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="space-y-5">
        <Link
          to="/career-paths"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white"
        >
          <ArrowLeft size={15} />
          Career Paths
        </Link>

        <ErrorState text={error} />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Career path not found"
        text="The requested career path could not be found."
      />
    );
  }

  const {
    careerPath,
    sourceRoleProfile,
    targetRoleProfile,
    skills,
    behaviouralFactors,
  } = data;

  const skillMap =
    new Map(
      skills.map((skill) => [
        skill._id,
        skill,
      ]),
    );

  const factorMap =
    new Map(
      behaviouralFactors.map(
        (factor) => [
          factor._id,
          factor,
        ],
      ),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Career development"
        title={
          careerPath.name ||
          "Career Path"
        }
        description={
          careerPath.description ||
          "Capability changes between two published role profiles."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/career-paths"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white"
            >
              <ArrowLeft size={15} />
              Back
            </Link>

            {canManage && (
              <>
                <Link
                  to={`/career-paths/${careerPath._id}/edit`}
                  className="rounded-xl border border-line bg-panel px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white"
                >
                  Edit
                </Link>

                <button
                  type="button"
                  onClick={
                    handleDelete
                  }
                  disabled={deleting}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                >
                  <Trash2
                    size={15}
                  />
                  {deleting
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <RoleCard
          label="Current role"
          role={sourceRoleProfile}
        />

        <RoleCard
          label="Target role"
          role={targetRoleProfile}
          target
        />
      </div>

      <Section
        title="Capability changes"
        description="Automatically calculated from the target levels defined on the two published role profiles."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <ChangeTable
            title="Technical skills"
            items={
              careerPath.skillDeltas
            }
            resolveName={(id) =>
              skillMap.get(id)
                ?.name ||
              "Skill"
            }
            idKey="skillId"
          />

          <ChangeTable
            title="Behavioural factors"
            items={
              careerPath.behaviouralFactorDeltas
            }
            resolveName={(id) =>
              factorMap.get(id)
                ?.name ||
              "Behavioural factor"
            }
            idKey="behaviouralFactorId"
          />
        </div>
      </Section>
    </div>
  );
}

function RoleCard({
  label,
  role,
  target = false,
}: {
  label: string;
  role?: RoleProfile;
  target?: boolean;
}) {
  return (
    <Card>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
        {label}
      </p>

      <div className="mt-4 flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
          <BriefcaseIcon />
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-white">
            {role?.name ||
              "Role profile"}
          </h2>

          {role?.department && (
            <p className="mt-1 text-xs text-slate-600">
              {role.department}
            </p>
          )}
        </div>

        {target && (
          <ArrowRight
            size={18}
            className="ml-auto shrink-0 text-brand-300"
          />
        )}
      </div>

      {role?.description && (
        <p className="mt-4 text-sm leading-6 text-slate-500">
          {role.description}
        </p>
      )}
    </Card>
  );
}

function BriefcaseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="3"
        y="7"
        width="18"
        height="13"
        rx="2"
      />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}

function ChangeTable({
  title,
  items,
  resolveName,
  idKey,
}: {
  title: string;
  items: CareerPathItem[];
  resolveName: (
    id: string,
  ) => string;
  idKey:
    | "skillId"
    | "behaviouralFactorId";
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-white">
          {title}
        </h3>

        <Badge>
          {items.length}{" "}
          {items.length === 1
            ? "item"
            : "items"}
        </Badge>
      </div>

      {items.length === 0 ? (
        <p className="mt-5 text-sm text-slate-600">
          No changes recorded.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map(
            (item, index) => {
              const id =
                item[idKey];

              if (!id) {
                return null;
              }

              return (
                <div
                  key={`${id}-${index}`}
                  className="rounded-xl border border-line p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white">
                        {resolveName(
                          id,
                        )}
                      </p>

                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <span>
                          {item.sourceLevel ??
                            "—"}
                        </span>

                        <ArrowRight
                          size={13}
                        />

                        <span>
                          {item.targetLevel ??
                            "—"}
                        </span>

                        <span className="text-slate-700">
                          levels
                        </span>
                      </div>
                    </div>

                    <Badge
                      tone={
                        changeTone(
                          item.changeType,
                        ) as any
                      }
                    >
                      <span className="mr-1 inline-flex align-middle">
                        <ChangeIcon
                          changeType={
                            item.changeType
                          }
                        />
                      </span>

                      {changeLabel(
                        item.changeType,
                      )}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
                    <span className="text-slate-600">
                      Level delta
                    </span>

                    <span
                      className={
                        item.delta > 0
                          ? "font-semibold text-emerald-300"
                          : item.delta < 0
                            ? "font-semibold text-red-300"
                            : "font-semibold text-slate-500"
                      }
                    >
                      {item.delta > 0
                        ? `+${item.delta}`
                        : item.delta}
                    </span>
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
    </Card>
  );
}