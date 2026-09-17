import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardCheck,
  Eye,
  Play,
  RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import {
  api,
  errorMessage,
  unwrap,
} from "../../api";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Section,
} from "../../components/ui";

interface RoleProfile {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  department?: string;
  status?: string;
}

interface SelfAssessment {
  _id?: string;
  id?: string;

  candidateId?: string;

  roleProfileId?:
    | string
    | RoleProfile;

  frameworkVersionId?:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
        version?: string;
      };

  campaignId?: string;

  dueAt?: string;
  startAt?: string;

  corroborationRequired?: boolean;

  status?: string;

  startedAt?: string;
  submittedAt?: string;
  completedAt?: string;

  createdAt?: string;
  updatedAt?: string;

  roleProfile?: RoleProfile;
}

function getId(
  value: unknown,
): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record =
    value as Record<string, unknown>;

  if (
    typeof record._id === "string"
  ) {
    return record._id;
  }

  if (
    typeof record.id === "string"
  ) {
    return record.id;
  }

  return "";
}

function getRoleProfileName(
  assessment: SelfAssessment,
): string {
  if (assessment.roleProfile) {
    return (
      assessment.roleProfile.name ??
      "Role profile"
    );
  }

  if (
    assessment.roleProfileId &&
    typeof assessment.roleProfileId ===
      "object"
  ) {
    return (
      assessment.roleProfileId.name ??
      "Role profile"
    );
  }

  return "Self-assessment";
}

function getStatusTone(
  status?: string,
) {
  switch (
    status?.toUpperCase()
  ) {
    case "COMPLETED":
    case "FINALIZED":
      return "green" as const;

    case "SUBMITTED":
    case "PENDING_CORROBORATION":
      return "amber" as const;

    case "IN_PROGRESS":
    case "STARTED":
      return "blue" as const;

    case "CANCELLED":
    case "REJECTED":
      return "red" as const;

    default:
      return "slate" as const;
  }
}

function statusLabel(
  status?: string,
): string {
  if (!status) {
    return "NOT STARTED";
  }

  return status
    .replaceAll("_", " ")
    .toUpperCase();
}

function formatDate(
  value?: string,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString();
}

function isCompleted(
  assessment: SelfAssessment,
): boolean {
  const status =
    assessment.status?.toUpperCase();

  return (
    status === "COMPLETED" ||
    status === "FINALIZED"
  );
}

function isSubmitted(
  assessment: SelfAssessment,
): boolean {
  const status =
    assessment.status?.toUpperCase();

  return (
    status === "SUBMITTED" ||
    status ===
      "PENDING_CORROBORATION"
  );
}

function isStarted(
  assessment: SelfAssessment,
): boolean {
  return Boolean(
    assessment.startedAt,
  ) || assessment.status?.toUpperCase() ===
    "IN_PROGRESS";
}

function extractSelfAssessments(
  value: unknown,
): SelfAssessment[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const source =
    value as Record<string, unknown>;

  if (
    Array.isArray(source.selfAssessments)
  ) {
    return source.selfAssessments as SelfAssessment[];
  }

  if (
    Array.isArray(source.assessments)
  ) {
    return source.assessments as SelfAssessment[];
  }

  if (
    Array.isArray(source.items)
  ) {
    return source.items as SelfAssessment[];
  }

  if (
    Array.isArray(source.data)
  ) {
    return source.data as SelfAssessment[];
  }

  /*
   * Some API wrappers return:
   *
   * {
   *   data: {
   *     selfAssessments: [...]
   *   }
   * }
   */
  if (
    source.data &&
    typeof source.data === "object"
  ) {
    const nested =
      source.data as Record<
        string,
        unknown
      >;

    if (
      Array.isArray(
        nested.selfAssessments,
      )
    ) {
      return nested.selfAssessments as SelfAssessment[];
    }

    if (
      Array.isArray(nested.items)
    ) {
      return nested.items as SelfAssessment[];
    }

    if (
      Array.isArray(nested.data)
    ) {
      return nested.data as SelfAssessment[];
    }
  }

  return [];
}

export default function SelfAssessmentsPage() {
  const query = useQuery({
    queryKey: ["self-assessments"],

    queryFn: async () => {
      /*
       * IMPORTANT:
       *
       * This is the skills self-assessment
       * endpoint.
       *
       * It must NEVER call:
       *
       * /assessments
       * /assessments/:id
       *
       * and it must NEVER use an objective
       * assessmentId.
       *
       * The backend automatically scopes STAFF
       * users to their authenticated user ID.
       */
      const response =
        await api.get(
          "/self-assessments",
        );

      return extractSelfAssessments(
        unwrap<unknown>(response),
      );
    },
  });

  const assessments =
    query.data ?? [];

  const statistics = useMemo(() => {
    let completed = 0;
    let submitted = 0;
    let inProgress = 0;
    let notStarted = 0;

    for (const assessment of assessments) {
      if (isCompleted(assessment)) {
        completed += 1;
      } else if (
        isSubmitted(assessment)
      ) {
        submitted += 1;
      } else if (
        isStarted(assessment)
      ) {
        inProgress += 1;
      } else {
        notStarted += 1;
      }
    }

    return {
      total: assessments.length,
      completed,
      submitted,
      inProgress,
      notStarted,
    };
  }, [assessments]);

  if (query.isLoading) {
    return (
      <Loading label="Loading your self-assessments..." />
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load self-assessments"
        text={errorMessage(
          query.error,
          "Your self-assessments could not be loaded.",
        )}
        onRetry={() => {
          query.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Skills assessment"
        title="Self Assessments"
        description="Assess your current technical skills and behavioural factors against the expectations of your role profile."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              query.refetch()
            }
            disabled={query.isFetching}
          >
            <RefreshCw
              size={15}
              className={
                query.isFetching
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">
            Total
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {statistics.total}
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">
            Not started
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {statistics.notStarted}
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">
            In progress
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {statistics.inProgress}
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">
            Completed
          </p>

          <p className="mt-2 text-2xl font-bold text-white">
            {statistics.completed}
          </p>
        </Card>
      </div>

      <Section
        title="My self-assessments"
        description="These are competency self-assessments assigned to your staff account. Objective question-based assessments are managed separately."
      >
        {assessments.length === 0 ? (
          <Card>
            <EmptyState
              title="No self-assessments assigned"
              text="You do not currently have a skills self-assessment assigned to your account."
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {assessments.map(
              (assessment) => {
                /*
                 * IMPORTANT:
                 *
                 * This is a SELF-ASSESSMENT ID.
                 *
                 * We intentionally do not fall back
                 * to assessmentId because that could
                 * accidentally navigate into the
                 * objective assessment workflow.
                 */
                const selfAssessmentId =
                  getId(assessment);

                if (!selfAssessmentId) {
                  return null;
                }

                const completed =
                  isCompleted(
                    assessment,
                  );

                const submitted =
                  isSubmitted(
                    assessment,
                  );

                const started =
                  isStarted(
                    assessment,
                  );

                let actionText =
                  "Start assessment";

                let ActionIcon = Play;

                if (completed) {
                  actionText =
                    "View assessment";
                  ActionIcon = Eye;
                } else if (
                  submitted
                ) {
                  actionText =
                    "View submission";
                  ActionIcon = Eye;
                } else if (
                  started
                ) {
                  actionText =
                    "Continue assessment";
                  ActionIcon = Play;
                }

                return (
                  <Card
                    key={
                      selfAssessmentId
                    }
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-ink">
                            <ClipboardCheck
                              size={18}
                              className="text-brand-300"
                            />
                          </div>

                          <div>
                            <h2 className="font-semibold text-white">
                              {getRoleProfileName(
                                assessment,
                              )}
                            </h2>

                            <p className="mt-0.5 text-xs text-slate-600">
                              Skills self-assessment
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge
                            tone={getStatusTone(
                              assessment.status,
                            )}
                          >
                            {statusLabel(
                              assessment.status,
                            )}
                          </Badge>

                          {assessment.corroborationRequired && (
                            <Badge tone="amber">
                              Manager corroboration
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 text-sm sm:grid-cols-3 lg:min-w-[440px]">
                        <div className="rounded-xl border border-line bg-ink/50 p-3">
                          <p className="text-xs text-slate-600">
                            Assigned
                          </p>

                          <p className="mt-1 text-slate-300">
                            {formatDate(
                              assessment.createdAt,
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-line bg-ink/50 p-3">
                          <p className="text-xs text-slate-600">
                            Due
                          </p>

                          <p className="mt-1 text-slate-300">
                            {formatDate(
                              assessment.dueAt,
                            )}
                          </p>
                        </div>

                        <div className="flex items-center">
                          <Link
                            to={`/self-assessments/${selfAssessmentId}`}
                            className="btn-primary w-full justify-center"
                          >
                            <ActionIcon
                              size={15}
                            />
                            {actionText}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              },
            )}
          </div>
        )}
      </Section>
    </div>
  );
}