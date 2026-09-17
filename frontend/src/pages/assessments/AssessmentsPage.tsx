import { useMemo } from "react";
import {
  ClipboardCheck,
  Eye,
  FilePlus2,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  api,
  errorMessage,
  unwrap,
} from "../../api";

import { useAuth } from "../../auth";

import {
  Badge,
  ErrorState,
  Loading,
} from "../../components/ui";

interface Assessment {
  _id?: string;
  id?: string;

  title?: string;
  name?: string;

  description?: string;

  status?: string;
  type?: string;

  createdAt?: string;
  updatedAt?: string;

  durationMinutes?: number;

  questionCount?: number;
  questionsCount?: number;

  roleProfileId?:
    | string
    | {
        _id?: string;
        name?: string;
      };
}

interface AssessmentResponse {
  assessments?: Assessment[];
  items?: Assessment[];
  data?: Assessment[];
}

function getAssessmentId(
  assessment: Assessment,
): string {
  return (
    assessment._id ??
    assessment.id ??
    ""
  );
}

function getAssessmentTitle(
  assessment: Assessment,
): string {
  return (
    assessment.title ??
    assessment.name ??
    "Untitled assessment"
  );
}

function getStatusTone(
  status?: string,
): "green" | "amber" | "red" | "blue" | "slate" {
  switch (
    status?.toUpperCase()
  ) {
    case "PUBLISHED":
    case "ACTIVE":
      return "green";

    case "READY":
    case "IN_REVIEW":
      return "blue";

    case "DRAFT":
      return "amber";

    case "ARCHIVED":
      return "red";

    default:
      return "slate";
  }
}

function extractAssessments(
  payload:
    | AssessmentResponse
    | Assessment[]
    | undefined,
): Assessment[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    Array.isArray(
      payload?.assessments,
    )
  ) {
    return payload.assessments;
  }

  if (
    Array.isArray(payload?.items)
  ) {
    return payload.items;
  }

  if (
    Array.isArray(payload?.data)
  ) {
    return payload.data;
  }

  return [];
}

export default function AssessmentsPage() {
  const {
    user,
    isAdmin,
  } = useAuth();

  const location =
    useLocation();

  const query = useQuery({
    queryKey: [
      "assessments",
      user?.organizationId,
    ],

    queryFn: async () => {
      const response =
        await api.get(
          "/assessments",
        );

      return unwrap<
        AssessmentResponse |
          Assessment[]
      >(response);
    },

    enabled: Boolean(user),
  });

  const assessments =
    useMemo(
      () =>
        extractAssessments(
          query.data,
        ),
      [query.data],
    );

  const state =
    location.state as
      | {
          message?: string;
        }
      | null
      | undefined;

  if (query.isLoading) {
    return (
      <div>
        <PageHeader
          eyebrow={
            isAdmin
              ? "Assessment authoring"
              : "Assessment workspace"
          }
          title={
            isAdmin
              ? "Assessment library"
              : "Assessments"
          }
          description={
            isAdmin
              ? "Create, configure and manage structured assessments."
              : "View assessment activity and complete work assigned to you."
          }
        />

        <Loading />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div>
        <PageHeader
          eyebrow="Assessments"
          title="Assessment library"
          description="Manage and review assessment activity."
        />

        <ErrorState
          text={errorMessage(
            query.error,
            "Could not load assessments.",
          )}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          isAdmin
            ? "Assessment authoring"
            : "Assessment workspace"
        }
        title={
          isAdmin
            ? "Assessment library"
            : "Assessments"
        }
        description={
          isAdmin
            ? "Create, configure and manage structured assessments."
            : "View assessment activity and complete work assigned to you."
        }
        action={
          isAdmin ? (
            <Link
              to="/assessments/new"
              className="btn-primary"
            >
              <Plus size={16} />
              New assessment
            </Link>
          ) : (
            <Link
              to="/self-assessments"
              className="btn-secondary"
            >
              <ClipboardCheck
                size={16}
              />
              My assessments
            </Link>
          )
        }
      />

      {state?.message && (
        <div className="mt-5 rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-sm text-brand-200">
          {state.message}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-panel/70 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink">
              <ClipboardCheck
                size={18}
                className="text-brand-300"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-white">
                {isAdmin
                  ? "Assessment authoring"
                  : "Assessment activity"}
              </p>

              <p className="mt-1 text-xs text-slate-600">
                {isAdmin
                  ? "Manage your organisation's assessment catalogue."
                  : "Your assigned work is available from My Assessments."}
              </p>
            </div>
          </div>

          <div className="relative w-full md:max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />

            <input
              className="field pl-9"
              placeholder="Search assessments..."
              disabled
              aria-label="Search assessments"
            />
          </div>
        </div>
      </div>

      {assessments.length === 0 ? (
        <EmptyState
          isAdmin={isAdmin}
        />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {assessments.map(
            (assessment) => {
              const id =
                getAssessmentId(
                  assessment,
                );

              if (!id) {
                return null;
              }

              const title =
                getAssessmentTitle(
                  assessment,
                );

              const roleProfile =
                typeof assessment.roleProfileId ===
                "object"
                  ? assessment
                      .roleProfileId
                      ?.name
                  : undefined;

              const questionCount =
                assessment.questionCount ??
                assessment.questionsCount;

              return (
                <article
                  key={id}
                  className="rounded-2xl border border-line bg-panel/70 p-5 transition hover:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink">
                        <ClipboardCheck
                          size={18}
                          className="text-brand-300"
                        />
                      </div>

                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-white">
                          {title}
                        </h2>

                        {roleProfile && (
                          <p className="mt-1 text-xs text-slate-600">
                            {roleProfile}
                          </p>
                        )}
                      </div>
                    </div>

                    <Badge
                      tone={getStatusTone(
                        assessment.status,
                      )}
                    >
                      {assessment.status ??
                        "DRAFT"}
                    </Badge>
                  </div>

                  <p className="mt-5 min-h-12 text-sm leading-6 text-slate-500">
                    {assessment.description ??
                      "No description has been provided for this assessment."}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 border-y border-line py-4 text-xs">
                    <div>
                      <span className="block text-slate-600">
                        Duration
                      </span>

                      <span className="mt-1 block font-medium text-slate-300">
                        {assessment.durationMinutes
                          ? `${assessment.durationMinutes} min`
                          : "Not set"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-slate-600">
                        Questions
                      </span>

                      <span className="mt-1 block font-medium text-slate-300">
                        {questionCount ??
                          "Not configured"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link
                      to={`/assessments/${id}`}
                      className="btn-secondary flex-1"
                    >
                      <Eye size={15} />
                      View
                    </Link>

                    {isAdmin && (
                      <Link
                        to={`/assessments/${id}/edit`}
                        className="btn-secondary"
                      >
                        <Pencil size={15} />
                        <span className="hidden sm:inline">
                          Edit
                        </span>
                      </Link>
                    )}
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-300">
          {eyebrow}
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>

      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  isAdmin,
}: {
  isAdmin: boolean;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-line bg-panel/70 p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-ink">
        <ClipboardCheck
          size={24}
          className="text-brand-300"
        />
      </div>

      <h2 className="mt-5 text-lg font-semibold text-white">
        {isAdmin
          ? "No assessments yet"
          : "No assessment records yet"}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {isAdmin
          ? "Create your first structured assessment to start measuring capability."
          : "When an assessment is assigned to you, your assessment work will appear in My Assessments."}
      </p>

      <div className="mt-6">
        {isAdmin ? (
          <Link
            to="/assessments/new"
            className="btn-primary"
          >
            <FilePlus2 size={16} />
            Create assessment
          </Link>
        ) : (
          <Link
            to="/self-assessments"
            className="btn-secondary"
          >
            <ClipboardCheck
              size={16}
            />
            View my assessments
          </Link>
        )}
      </div>
    </div>
  );
}