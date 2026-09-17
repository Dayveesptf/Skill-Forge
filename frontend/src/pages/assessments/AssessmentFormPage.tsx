import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Save,
} from "lucide-react";

import { api, errorMessage, unwrap } from "../../api";
import { useAuth } from "../../auth";
import {
  Badge,
  ErrorState,
  PageHeader,
  Section,
} from "../../components/ui";

interface Assessment {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  status?: string;
  frameworkVersionId?: string;
  roleProfileId?: string;
  durationMinutes?: number;
  passingScore?: number;
  isPublished?: boolean;
  corroborationRequired?: boolean;
}

interface AssessmentForm {
  title: string;
  description: string;
  frameworkVersionId: string;
  roleProfileId: string;
  durationMinutes: string;
  passingScore: string;
  corroborationRequired: boolean;
}

const EMPTY_FORM: AssessmentForm = {
  title: "",
  description: "",
  frameworkVersionId: "",
  roleProfileId: "",
  durationMinutes: "",
  passingScore: "",
  corroborationRequired: false,
};

/**
 * Safely extracts an ID from:
 *
 * "65..."
 *
 * or:
 *
 * { _id: "65..." }
 *
 * or:
 *
 * { id: "65..." }
 */
function getId(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  if (typeof record._id === "string") {
    return record._id;
  }

  if (typeof record.id === "string") {
    return record.id;
  }

  return "";
}

/**
 * Handles both:
 *
 * {
 *   _id: "...",
 *   title: "..."
 * }
 *
 * and wrapped API responses such as:
 *
 * {
 *   assessment: {
 *     _id: "...",
 *     title: "..."
 *   }
 * }
 *
 * and:
 *
 * {
 *   data: {
 *     assessment: {...}
 *   }
 * }
 */
function normaliseAssessment(value: unknown): Assessment {
  let source: any = value;

  if (
    source &&
    typeof source === "object" &&
    source.assessment &&
    typeof source.assessment === "object"
  ) {
    source = source.assessment;
  }

  if (
    source &&
    typeof source === "object" &&
    source.data &&
    typeof source.data === "object" &&
    source.data.assessment &&
    typeof source.data.assessment === "object"
  ) {
    source = source.data.assessment;
  }

  const assessmentId = getId(source);

  return {
    ...source,
    _id: assessmentId,
    id: assessmentId,
    frameworkVersionId: getId(
      source?.frameworkVersionId,
    ),
    roleProfileId: getId(
      source?.roleProfileId,
    ),
  };
}

export default function AssessmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    user,
    isAdmin,
    loading: authLoading,
  } = useAuth();

  const editing = Boolean(id);

  const [form, setForm] =
    useState<AssessmentForm>(EMPTY_FORM);

  const [assessment, setAssessment] =
    useState<Assessment | null>(null);

  const [loading, setLoading] =
    useState(editing);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [frameworks, setFrameworks] =
    useState<any[]>([]);

  const [roleProfiles, setRoleProfiles] =
    useState<any[]>([]);

  const canSubmit = useMemo(() => {
    return (
      form.title.trim().length >= 2 &&
      form.frameworkVersionId.trim().length > 0
    );
  }, [
    form.title,
    form.frameworkVersionId,
  ]);

  /**
   * Load the objective assessment being edited.
   */
  useEffect(() => {
    if (!isAdmin || !editing || !id) {
      return;
    }

    let mounted = true;

    async function loadAssessment() {
      setLoading(true);
      setError("");

      try {
        const response =
          await api.get(`/assessments/${id}`);

        const raw = unwrap<any>(response);

        const data =
          normaliseAssessment(raw);

        if (!mounted) {
          return;
        }

        /*
         * The route ID is authoritative.
         *
         * Even if the backend serializes the assessment
         * differently, we know which assessment was requested
         * because it came from /assessments/:id.
         */
        const resolvedId: string =
          getId(data) || id || "";

        setAssessment({
          ...data,
          _id: resolvedId,
          id: resolvedId,
        });

        setForm({
          title: data.title ?? "",
          description:
            data.description ?? "",
          frameworkVersionId:
            getId(data.frameworkVersionId),
          roleProfileId:
            getId(data.roleProfileId),
          durationMinutes:
            data.durationMinutes != null
              ? String(data.durationMinutes)
              : "",
          passingScore:
            data.passingScore != null
              ? String(data.passingScore)
              : "",
          corroborationRequired:
            Boolean(
              data.corroborationRequired,
            ),
        });
      } catch (requestError) {
        if (mounted) {
          setError(
            errorMessage(
              requestError,
              "Unable to load this assessment.",
            ),
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadAssessment();

    return () => {
      mounted = false;
    };
  }, [
    id,
    editing,
    isAdmin,
  ]);

  /**
   * Load framework and role-profile options.
   */
  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let mounted = true;

    async function loadSupportingData() {
      try {
        const [
          frameworkResponse,
          roleResponse,
        ] = await Promise.allSettled([
          api.get("/frameworks"),
          api.get("/role-profiles"),
        ]);

        if (!mounted) {
          return;
        }

        if (
          frameworkResponse.status ===
          "fulfilled"
        ) {
          const data =
            unwrap<any>(
              frameworkResponse.value,
            );

          setFrameworks(
            Array.isArray(data)
              ? data
              : data?.frameworks ??
                  data?.items ??
                  data?.data ??
                  [],
          );
        }

        if (
          roleResponse.status ===
          "fulfilled"
        ) {
          const data =
            unwrap<any>(
              roleResponse.value,
            );

          setRoleProfiles(
            Array.isArray(data)
              ? data
              : data?.roleProfiles ??
                  data?.items ??
                  data?.data ??
                  [],
          );
        }
      } catch {
        /*
         * Supporting data is optional.
         *
         * The form can still work when existing
         * framework/profile IDs are already available.
         */
      }
    }

    loadSupportingData();

    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  function update<K extends keyof AssessmentForm>(
    field: K,
    value: AssessmentForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!isAdmin) {
      setError(
        "Only Platform Admins and Organization Admins can create or edit assessments.",
      );
      return;
    }

    if (!canSubmit) {
      setError(
        "Assessment title and framework version are required.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload: Record<
      string,
      unknown
    > = {
      title: form.title.trim(),
      description:
        form.description.trim() ||
        undefined,
      frameworkVersionId:
        form.frameworkVersionId,
      corroborationRequired:
        form.corroborationRequired,
    };

    if (form.roleProfileId.trim()) {
      payload.roleProfileId =
        form.roleProfileId;
    }

    if (form.durationMinutes.trim()) {
      const duration =
        Number(form.durationMinutes);

      if (
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        setSaving(false);
        setError(
          "Duration must be a positive number of minutes.",
        );
        return;
      }

      payload.durationMinutes =
        duration;
    }

    if (form.passingScore.trim()) {
      const passingScore =
        Number(form.passingScore);

      if (
        !Number.isFinite(passingScore) ||
        passingScore < 0 ||
        passingScore > 100
      ) {
        setSaving(false);
        setError(
          "Passing score must be between 0 and 100.",
        );
        return;
      }

      payload.passingScore =
        passingScore;
    }

    try {
      if (editing && id) {
        await api.patch(
          `/assessments/${id}`,
          payload,
        );
      } else {
        await api.post(
          "/assessments",
          payload,
        );
      }

      navigate("/assessments", {
        replace: true,
        state: {
          message: editing
            ? "Assessment updated successfully."
            : "Assessment created successfully.",
        },
      });
    } catch (requestError) {
      setError(
        errorMessage(
          requestError,
          editing
            ? "Unable to update assessment."
            : "Unable to create assessment.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2
          size={28}
          className="animate-spin text-brand-400"
        />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader
          eyebrow="Access restricted"
          title="Assessment authoring"
          description="Assessment creation and editing are restricted to administrators."
        />

        <div className="mt-6 rounded-2xl border border-line bg-panel/70 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-ink">
            <ClipboardCheck
              size={24}
              className="text-brand-300"
            />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-white">
            Administrator access required
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Staff accounts complete assessments
            assigned to them. They do not create
            or author assessments.
          </p>

          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-slate-950"
          >
            <ArrowLeft size={16} />
            Back to dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          editing
            ? "Assessment authoring"
            : "New assessment"
        }
        title={
          editing
            ? "Edit assessment"
            : "Create assessment"
        }
        description={
          editing
            ? "Update the assessment configuration before publishing."
            : "Create a structured assessment for your organisation."
        }

        /*
         * IMPORTANT:
         *
         * Cancel must NOT depend on assessment._id.
         *
         * The URL already contains the authoritative
         * objective assessment ID.
         *
         * Going directly back to /assessments also prevents
         * /assessments/undefined when an API response is
         * wrapped differently.
         */
        actions={
          <Link
            to="/assessments"
            className="btn-secondary"
          >
            <ArrowLeft size={16} />
            Cancel
          </Link>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-6"
      >
        {error && (
          <ErrorState text={error} />
        )}

        <Section title="Assessment details">
          <div className="grid gap-5">
            <label>
              <span className="label">
                Assessment title
              </span>

              <input
                className="field"
                value={form.title}
                onChange={(event) =>
                  update(
                    "title",
                    event.target.value,
                  )
                }
                placeholder="e.g. Frontend Engineering Capability Assessment"
                required
              />
            </label>

            <label>
              <span className="label">
                Description
              </span>

              <textarea
                className="field min-h-32 resize-y"
                value={form.description}
                onChange={(event) =>
                  update(
                    "description",
                    event.target.value,
                  )
                }
                placeholder="Describe what this assessment measures and who it is intended for."
              />
            </label>
          </div>
        </Section>

        <Section title="Framework & role">
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className="label">
                Framework version
              </span>

              <select
                className="field"
                value={
                  form.frameworkVersionId
                }
                onChange={(event) =>
                  update(
                    "frameworkVersionId",
                    event.target.value,
                  )
                }
                required
              >
                <option value="">
                  Select framework version
                </option>

                {frameworks.map(
                  (framework) => {
                    const frameworkId =
                      framework._id ??
                      framework.id;

                    return (
                      <option
                        key={frameworkId}
                        value={frameworkId}
                      >
                        {framework.name ??
                          "Framework"}{" "}
                        {framework.version
                          ? `· ${framework.version}`
                          : ""}
                      </option>
                    );
                  },
                )}
              </select>

              {frameworks.length ===
                0 && (
                <p className="mt-2 text-xs text-slate-600">
                  No framework versions were
                  returned. Entering a framework
                  ID manually may be required
                  until framework authoring is
                  populated.
                </p>
              )}
            </label>

            <label>
              <span className="label">
                Role profile
              </span>

              <select
                className="field"
                value={form.roleProfileId}
                onChange={(event) =>
                  update(
                    "roleProfileId",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  No role profile
                </option>

                {roleProfiles.map(
                  (profile) => {
                    const profileId =
                      profile._id ??
                      profile.id;

                    return (
                      <option
                        key={profileId}
                        value={profileId}
                      >
                        {profile.name ??
                          profile.title ??
                          "Role profile"}
                      </option>
                    );
                  },
                )}
              </select>

              <p className="mt-2 text-xs text-slate-600">
                A role profile can provide the
                competency expectations used by
                the assessment.
              </p>
            </label>
          </div>
        </Section>

        <Section title="Assessment configuration">
          <div className="grid gap-5 md:grid-cols-2">
            <label>
              <span className="label">
                Duration (minutes)
              </span>

              <input
                className="field"
                type="number"
                min="1"
                value={form.durationMinutes}
                onChange={(event) =>
                  update(
                    "durationMinutes",
                    event.target.value,
                  )
                }
                placeholder="60"
              />
            </label>

            <label>
              <span className="label">
                Passing score (%)
              </span>

              <input
                className="field"
                type="number"
                min="0"
                max="100"
                value={form.passingScore}
                onChange={(event) =>
                  update(
                    "passingScore",
                    event.target.value,
                  )
                }
                placeholder="70"
              />
            </label>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-ink/40 p-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-brand-500"
              checked={
                form.corroborationRequired
              }
              onChange={(event) =>
                update(
                  "corroborationRequired",
                  event.target.checked,
                )
              }
            />

            <span>
              <span className="block text-sm font-semibold text-white">
                Require manager corroboration
              </span>

              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Submitted self-assessments can be
                routed to the employee's manager
                for review before scoring is
                finalised.
              </span>
            </span>
          </label>
        </Section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            to="/assessments"
            className="btn-secondary"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="btn-primary"
          >
            {saving ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <Save size={16} />
            )}

            {saving
              ? "Saving..."
              : editing
                ? "Save changes"
                : "Create assessment"}
          </button>
        </div>

        {editing && assessment && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CheckCircle2
              size={14}
              className="text-brand-300"
            />

            Current status:

            <Badge>
              {assessment.status ??
                "DRAFT"}
            </Badge>
          </div>
        )}
      </form>
    </>
  );
}