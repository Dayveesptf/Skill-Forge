import {
  ArrowLeft,
  ArrowRight,
  Save,
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
  Card,
  ErrorState,
  Loading,
  PageHeader,
} from "../../components/ui";

import {
  useAuth,
} from "../../auth";

interface RoleProfile {
  _id: string;
  name: string;
  description?: string;
  department?: string;
  frameworkVersionId?: string;
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
}

function getRoleId(
  value:
    | RoleProfile
    | string,
) {
  return typeof value ===
    "string"
    ? value
    : value._id;
}

export default function CareerPathFormPage() {
  const {
    id,
  } = useParams();

  const navigate =
    useNavigate();

  const {
    user,
  } = useAuth();

  const isEdit =
    Boolean(id);

  const canManage =
    user?.role ===
    "ORGANIZATION_ADMIN";

  const [
    roles,
    setRoles,
  ] = useState<RoleProfile[]>(
    [],
  );

  const [
    sourceRoleProfileId,
    setSourceRoleProfileId,
  ] = useState("");

  const [
    targetRoleProfileId,
    setTargetRoleProfileId,
  ] = useState("");

  const [
    name,
    setName,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }

    void load();
  }, [id, canManage]);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const rolesResponse =
        await api.get(
          "/career-paths/options/roles",
        );

      const roleData =
        unwrap<RoleProfile[]>(
          rolesResponse,
        );

      setRoles(
        Array.isArray(roleData)
          ? roleData
          : [],
      );

      if (isEdit && id) {
        const pathResponse =
          await api.get(
            `/career-paths/${id}`,
          );

        const result =
          unwrap<{
            careerPath: CareerPath;
          }>(
            pathResponse,
          );

        const careerPath =
          result.careerPath;

        setName(
          careerPath.name ||
            "",
        );

        setDescription(
          careerPath.description ||
            "",
        );

        setSourceRoleProfileId(
          getRoleId(
            careerPath.sourceRoleProfileId,
          ),
        );

        setTargetRoleProfileId(
          getRoleId(
            careerPath.targetRoleProfileId,
          ),
        );
      }
    } catch (err) {
      setError(
        errorMessage(
          err,
          "Unable to load career path form.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (!sourceRoleProfileId) {
      setError(
        "Select a source role profile.",
      );
      return;
    }

    if (!targetRoleProfileId) {
      setError(
        "Select a target role profile.",
      );
      return;
    }

    if (
      sourceRoleProfileId ===
      targetRoleProfileId
    ) {
      setError(
        "Source and target roles must be different.",
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEdit && id) {
        await api.put(
          `/career-paths/${id}`,
          {
            name,
            description,
          },
        );

        navigate(
          `/career-paths/${id}`,
        );

        return;
      }

      const response =
        await api.post(
          "/career-paths",
          {
            sourceRoleProfileId,
            targetRoleProfileId,
            name,
            description,
          },
        );

      const created =
        unwrap<{
          _id: string;
        }>(
          response,
        );

      navigate(
        `/career-paths/${created._id}`,
      );
    } catch (err) {
      setError(
        errorMessage(
          err,
          isEdit
            ? "Unable to update career path."
            : "Unable to create career path.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-5">
        <Link
          to="/career-paths"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-white"
        >
          <ArrowLeft size={15} />
          Career Paths
        </Link>

        <ErrorState
          text="Only organization administrators can manage career paths."
        />
      </div>
    );
  }

  if (loading) {
    return <Loading />;
  }

  if (error && roles.length === 0) {
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Career development"
        title={
          isEdit
            ? "Edit career path"
            : "Create career path"
        }
        description={
          isEdit
            ? "Update the career path details."
            : "Connect two published role profiles. Skill and behavioural-factor deltas will be calculated automatically."
        }
        actions={
          <Link
            to={
              isEdit && id
                ? `/career-paths/${id}`
                : "/career-paths"
            }
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft size={15} />
            Cancel
          </Link>
        }
      />

      {error && (
        <ErrorState text={error} />
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <Card>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
            <div>
              <label
                htmlFor="sourceRole"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Source role profile
              </label>

              <select
                id="sourceRole"
                value={
                  sourceRoleProfileId
                }
                onChange={(event) =>
                  setSourceRoleProfileId(
                    event.target.value,
                  )
                }
                disabled={isEdit}
                className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm text-white outline-none transition focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  Select current role
                </option>

                {roles.map((role) => (
                  <option
                    key={role._id}
                    value={role._id}
                  >
                    {role.name}
                    {role.department
                      ? ` — ${role.department}`
                      : ""}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs leading-5 text-slate-600">
                The role the employee is
                moving from.
              </p>
            </div>

            <div className="hidden place-items-center lg:grid">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel text-brand-300">
                <ArrowRight
                  size={17}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="targetRole"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Target role profile
              </label>

              <select
                id="targetRole"
                value={
                  targetRoleProfileId
                }
                onChange={(event) =>
                  setTargetRoleProfileId(
                    event.target.value,
                  )
                }
                disabled={isEdit}
                className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm text-white outline-none transition focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  Select target role
                </option>

                {roles.map((role) => (
                  <option
                    key={role._id}
                    value={role._id}
                  >
                    {role.name}
                    {role.department
                      ? ` — ${role.department}`
                      : ""}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs leading-5 text-slate-600">
                The role the employee is
                developing toward.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Career path name
              </label>

              <input
                id="name"
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                placeholder="e.g. Junior Developer → Senior Developer"
                maxLength={150}
                className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm text-white outline-none placeholder:text-slate-700 focus:border-brand-500"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Description
              </label>

              <textarea
                id="description"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="Describe the development journey represented by this career path."
                rows={5}
                maxLength={2000}
                className="w-full resize-none rounded-xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-700 focus:border-brand-500"
              />

              <p className="mt-2 text-xs text-slate-600">
                {description.length}/2000
              </p>
            </div>
          </div>
        </Card>

        {!isEdit && (
          <Card>
            <div className="flex gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
                <ArrowRight
                  size={16}
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white">
                  Automatic capability mapping
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Once created, SkillForge
                  compares the target levels
                  in both published role
                  profiles and records added,
                  increased, unchanged,
                  decreased and removed
                  competencies.
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />

            {saving
              ? "Saving..."
              : isEdit
                ? "Save changes"
                : "Create career path"}
          </button>
        </div>
      </form>
    </div>
  );
}