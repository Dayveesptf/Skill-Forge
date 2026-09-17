import {
  useMemo,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import {
  Plus,
} from "lucide-react";

import { api, unwrap } from "../../api";
import {
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Toolbar,
} from "../../components/ui";
import {
  DataTable,
  type DataTableColumn,
} from "../../components/DataTable";

interface RoleProfileReference {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
}

interface FrameworkReference {
  _id?: string;
  id?: string;
  name?: string;
  version?: string;
}

interface SelfAssessment {
  _id?: string;
  id?: string;

  roleProfileId?:
    | string
    | RoleProfileReference;

  roleProfile?:
    | RoleProfileReference;

  frameworkVersionId?:
    | string
    | FrameworkReference;

  status?: string;

  startedAt?: string;
  submittedAt?: string;
}

interface SelfAssessmentsResponse {
  selfAssessments?: SelfAssessment[];
  items?: SelfAssessment[];
  data?: SelfAssessment[];
}

function getSelfAssessments(
  response:
    | SelfAssessment[]
    | SelfAssessmentsResponse
    | undefined,
): SelfAssessment[] {
  if (Array.isArray(response)) {
    return response;
  }

  return (
    response?.selfAssessments ??
    response?.items ??
    response?.data ??
    []
  );
}

function getSelfAssessmentId(
  assessment: SelfAssessment,
): string {
  return (
    assessment._id ??
    assessment.id ??
    ""
  );
}

function getRoleProfileName(
  assessment: SelfAssessment,
): string {
  if (assessment.roleProfile?.name) {
    return assessment.roleProfile.name;
  }

  if (assessment.roleProfile?.title) {
    return assessment.roleProfile.title;
  }

  if (
    assessment.roleProfileId &&
    typeof assessment.roleProfileId !==
      "string"
  ) {
    return (
      assessment.roleProfileId.name ??
      assessment.roleProfileId.title ??
      "Role profile"
    );
  }

  if (
    typeof assessment.roleProfileId ===
    "string"
  ) {
    return assessment.roleProfileId;
  }

  return "Role profile";
}

function getFrameworkName(
  framework:
    | SelfAssessment["frameworkVersionId"]
    | undefined,
): string {
  if (!framework) {
    return "Framework not shown";
  }

  if (typeof framework === "string") {
    return framework;
  }

  return (
    framework.name ??
    framework.version ??
    framework._id ??
    framework.id ??
    "Framework not shown"
  );
}

function getStatusTone(
  status?: string,
): "green" | "blue" | "slate" {
  switch (status) {
    case "SUBMITTED":
    case "COMPLETED":
      return "green";

    case "IN_PROGRESS":
      return "blue";

    default:
      return "slate";
  }
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

export default function SelfAssessmentsPage() {
  const [search, setSearch] =
    useState("");

  const navigate = useNavigate();

  const query = useQuery({
    queryKey: [
      "self-assessments",
    ],
    queryFn: async () =>
      unwrap<
        SelfAssessment[] |
          SelfAssessmentsResponse
      >(
        await api.get(
          "/self-assessments",
        ),
      ),
  });

  const assessments =
    getSelfAssessments(
      query.data,
    );

  const filteredAssessments =
    useMemo(() => {
      const term = search
        .trim()
        .toLowerCase();

      if (!term) {
        return assessments;
      }

      return assessments.filter(
        (assessment) => {
          const searchableText = [
            getRoleProfileName(
              assessment,
            ),
            getFrameworkName(
              assessment.frameworkVersionId,
            ),
            assessment.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            term,
          );
        },
      );
    }, [assessments, search]);

  const columns: DataTableColumn<SelfAssessment>[] =
    [
      {
        key: "roleProfileId",
        label: "Role profile",
        render: (assessment) => (
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">
              {getRoleProfileName(
                assessment,
              )}
            </p>

            <p className="mt-1 truncate text-xs text-slate-600">
              {getFrameworkName(
                assessment.frameworkVersionId,
              )}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (assessment) => {
          const status =
            assessment.status ??
            "DRAFT";

          return (
            <Badge
              tone={getStatusTone(
                status,
              )}
            >
              {status}
            </Badge>
          );
        },
      },
      {
        key: "startedAt",
        label: "Started",
        render: (assessment) => (
          <span className="text-sm text-slate-300">
            {formatDate(
              assessment.startedAt,
            )}
          </span>
        ),
      },
      {
        key: "submittedAt",
        label: "Submitted",
        render: (assessment) => (
          <span className="text-sm text-slate-300">
            {formatDate(
              assessment.submittedAt,
            )}
          </span>
        ),
      },
    ];

  function openSelfAssessment(
    assessment: SelfAssessment,
  ) {
    const assessmentId =
      getSelfAssessmentId(
        assessment,
      );

    if (assessmentId) {
      navigate(
        `/self-assessments/${assessmentId}`,
      );
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Self evidence"
        title="Self assessments"
        description="Capture perceived competency levels, confidence and supporting evidence before comparing them with objective results."
        actions={
          <Link
            className="btn-primary"
            to="/self-assessments/new"
          >
            <Plus size={16} />
            New self-assessment
          </Link>
        }
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search role profiles..."
      />

      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          text="Could not load self assessments."
          onRetry={() =>
            query.refetch()
          }
        />
      ) : (
        <DataTable
          rows={filteredAssessments}
          columns={columns}
          onRowClick={
            openSelfAssessment
          }
          empty={
            <EmptyState
              title="No self-assessments yet"
              text="Start a self-assessment against a published role profile."
              action={
                <Link
                  to="/self-assessments/new"
                  className="btn-primary"
                >
                  <Plus size={16} />
                  Start one
                </Link>
              }
            />
          }
        />
      )}
    </>
  );
}