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
  Target,
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

interface RoleProfile {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  status?: string;
  skills?: unknown[];
  skillCount?: number;
  behaviouralFactors?: unknown[];
  behaviouralFactorCount?: number;
  targetLevel?: number | string;
}

interface RoleProfilesResponse {
  roleProfiles?: RoleProfile[];
  items?: RoleProfile[];
  data?: RoleProfile[];
}

function getRoleProfiles(
  response:
    | RoleProfile[]
    | RoleProfilesResponse
    | undefined,
): RoleProfile[] {
  if (Array.isArray(response)) {
    return response;
  }

  return (
    response?.roleProfiles ??
    response?.items ??
    response?.data ??
    []
  );
}

function getRoleProfileId(
  role: RoleProfile,
): string {
  return role._id ?? role.id ?? "";
}

function getStatusTone(
  status?: string,
): "green" | "red" | "slate" {
  switch (status) {
    case "PUBLISHED":
      return "green";
    case "ARCHIVED":
      return "red";
    default:
      return "slate";
  }
}

export default function RoleProfilesPage() {
  const [search, setSearch] =
    useState("");

  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["role-profiles"],
    queryFn: async () =>
      unwrap<
        RoleProfile[] | RoleProfilesResponse
      >(
        await api.get(
          "/role-profiles",
        ),
      ),
  });

  const roles = getRoleProfiles(
    query.data,
  );

  const filteredRoles = useMemo(() => {
    const term = search
      .trim()
      .toLowerCase();

    if (!term) {
      return roles;
    }

    return roles.filter((role) => {
      const searchableText = [
        role.name,
        role.title,
        role.description,
        role.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        term,
      );
    });
  }, [roles, search]);

  const columns: DataTableColumn<RoleProfile>[] =
    [
      {
        key: "name",
        label: "Role",
        render: (role) => (
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">
              {role.name ??
                role.title ??
                "Untitled role"}
            </p>

            <p className="mt-1 line-clamp-2 text-xs text-slate-600">
              {role.description ??
                "No description"}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (role) => {
          const status =
            role.status ?? "DRAFT";

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
        key: "skills",
        label: "Skills",
        render: (role) => (
          <span className="text-sm text-slate-300">
            {role.skills?.length ??
              role.skillCount ??
              "—"}
          </span>
        ),
      },
      {
        key: "behaviouralFactors",
        label: "Behavioural",
        render: (role) => (
          <span className="text-sm text-slate-300">
            {role.behaviouralFactors
              ?.length ??
              role.behaviouralFactorCount ??
              "—"}
          </span>
        ),
      },
      {
        key: "targetLevel",
        label: "Target level",
        render: (role) => (
          <span className="text-sm text-slate-300">
            {role.targetLevel ?? "—"}
          </span>
        ),
      },
    ];

  function openRoleProfile(
    role: RoleProfile,
  ) {
    const roleId =
      getRoleProfileId(role);

    if (roleId) {
      navigate(
        `/role-profiles/${roleId}`,
      );
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Capability architecture"
        title="Role profiles"
        description="Define what good looks like for a role: skills, behavioural factors, target levels and weights."
        actions={
          <Link
            className="btn-primary"
            to="/role-profiles/new"
          >
            <Plus size={16} />
            New role profile
          </Link>
        }
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search roles..."
      />

      {query.isLoading ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState
          text="Could not load role profiles."
          onRetry={() =>
            query.refetch()
          }
        />
      ) : (
        <DataTable
          rows={filteredRoles}
          columns={columns}
          onRowClick={
            openRoleProfile
          }
          empty={
            <EmptyState
              title="No role profiles yet"
              text="Create a role profile to define competency expectations and support gap analysis."
              action={
                <Link
                  className="btn-primary"
                  to="/role-profiles/new"
                >
                  <Plus size={16} />
                  Create role profile
                </Link>
              }
            />
          }
        />
      )}
    </>
  );
}