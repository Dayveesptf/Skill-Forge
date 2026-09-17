import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  UserPlus,
  Users,
  UserX,
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

type OrganizationUserRole =
  | "ORGANIZATION_ADMIN"
  | "MANAGER"
  | "STAFF";

interface Manager {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface OrganizationUser {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: OrganizationUserRole | string;
  managerId?: Manager | string;
  jobTitle?: string;
  department?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface UsersResponse {
  items: OrganizationUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: OrganizationUserRole;
  managerId: string;
  jobTitle: string;
  department: string;
}

function getUserId(user: OrganizationUser): string {
  return user._id || user.id || "";
}

function getUserName(user: OrganizationUser): string {
  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "Unnamed user";
}

function getManagerName(user: OrganizationUser): string {
  if (!user.managerId) {
    return "Unassigned";
  }

  if (typeof user.managerId === "string") {
    return "Assigned";
  }

  const name = [
    user.managerId.firstName,
    user.managerId.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    name ||
    user.managerId.email ||
    "Assigned"
  );
}

function getManagerId(user: OrganizationUser): string {
  if (!user.managerId) {
    return "";
  }

  if (typeof user.managerId === "string") {
    return user.managerId;
  }

  return user.managerId._id || user.managerId.id || "";
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString();
}

function formatRole(role?: string): string {
  if (!role) {
    return "Staff";
  }

  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string;
          };
        };
      }
    ).response;

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AdminUsersPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [managerId, setManagerId] = useState("");
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [editingUser, setEditingUser] =
    useState<OrganizationUser | null>(null);

  const [actionUser, setActionUser] =
    useState<OrganizationUser | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Users query                                                              */
  /* ------------------------------------------------------------------------ */

  const query = useQuery<UsersResponse>({
    queryKey: [
      "organization-users",
      {
        search,
        role,
        managerId,
        page,
      },
    ],

    queryFn: async () =>
      unwrap<UsersResponse>(
        await api.get("/users", {
          params: {
            search:
              search.trim() || undefined,

            role:
              role || undefined,

            managerId:
              managerId || undefined,

            page,

            limit: 25,
          },
        }),
      ),
  });

  const users = query.data?.items ?? [];

  /* ------------------------------------------------------------------------ */
  /* Managers                                                                 */
  /* ------------------------------------------------------------------------ */

  const managers = useMemo(() => {
    const managerMap =
      new Map<string, OrganizationUser>();

    for (const user of users) {
      if (
        user.role === "MANAGER" &&
        getUserId(user)
      ) {
        managerMap.set(
          getUserId(user),
          user,
        );
      }
    }

    return Array.from(
      managerMap.values(),
    );
  }, [users]);

  /* ------------------------------------------------------------------------ */
  /* Create mutation                                                          */
  /* ------------------------------------------------------------------------ */

  const createMutation = useMutation({
    mutationFn: async (
      data: UserFormData,
    ) =>
      unwrap<OrganizationUser>(
        await api.post("/users", {
          firstName:
            data.firstName.trim(),

          lastName:
            data.lastName.trim(),

          email:
            data.email.trim(),

          password:
            data.password,

          role:
            data.role,

          managerId:
            data.managerId || undefined,

          jobTitle:
            data.jobTitle.trim() ||
            undefined,

          department:
            data.department.trim() ||
            undefined,
        }),
      ),

    onSuccess: () => {
      setShowCreateModal(false);

      queryClient.invalidateQueries({
        queryKey: [
          "organization-users",
        ],
      });
    },
  });

  /* ------------------------------------------------------------------------ */
  /* Update mutation                                                          */
  /* ------------------------------------------------------------------------ */

  const updateMutation = useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: Partial<UserFormData>;
    }) =>
      unwrap<OrganizationUser>(
        await api.patch(
          `/users/${userId}`,
          {
            firstName:
              data.firstName?.trim(),

            lastName:
              data.lastName?.trim(),

            role:
              data.role,

            managerId:
              data.managerId === ""
                ? null
                : data.managerId,

            jobTitle:
              data.jobTitle?.trim(),

            department:
              data.department?.trim(),
          },
        ),
      ),

    onSuccess: () => {
      setEditingUser(null);

      queryClient.invalidateQueries({
        queryKey: [
          "organization-users",
        ],
      });
    },
  });

  /* ------------------------------------------------------------------------ */
  /* Deactivate mutation                                                      */
  /* ------------------------------------------------------------------------ */

  const deactivateMutation =
    useMutation({
      mutationFn: async (
        userId: string,
      ) =>
        unwrap<OrganizationUser>(
          await api.delete(
            `/users/${userId}`,
          ),
        ),

      onSuccess: () => {
        setActionUser(null);

        queryClient.invalidateQueries({
          queryKey: [
            "organization-users",
          ],
        });
      },
    });

  /* ------------------------------------------------------------------------ */
  /* Table columns                                                            */
  /* ------------------------------------------------------------------------ */

  const columns: DataTableColumn<OrganizationUser>[] =
    [
      {
        key: "firstName",
        label: "User",

        render: (user) => (
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-800 text-xs font-bold text-slate-400">
              {(
                user.firstName?.[0] ||
                user.email?.[0] ||
                "?"
              ).toUpperCase()}
            </div>

            <div className="min-w-0">
              <p className="truncate font-semibold text-white">
                {getUserName(user)}
              </p>

              <p className="mt-1 truncate text-xs text-slate-600">
                {user.email ||
                  "No email address"}
              </p>
            </div>
          </div>
        ),
      },

      {
        key: "role",
        label: "Role",

        render: (user) => (
          <Badge>
            {formatRole(user.role)}
          </Badge>
        ),
      },

      {
        key: "jobTitle",
        label: "Position",

        render: (user) => (
          <div>
            <p className="text-sm text-slate-300">
              {user.jobTitle || "—"}
            </p>

            {user.department && (
              <p className="mt-1 text-xs text-slate-600">
                {user.department}
              </p>
            )}
          </div>
        ),
      },

      {
        key: "managerId",
        label: "Manager",

        render: (user) => (
          <span className="text-sm text-slate-500">
            {getManagerName(user)}
          </span>
        ),
      },

      {
        key: "isActive",
        label: "Status",

        render: (user) => (
          <Badge
            tone={
              user.isActive === false
                ? "red"
                : "green"
            }
          >
            {user.isActive === false
              ? "Inactive"
              : "Active"}
          </Badge>
        ),
      },

      {
        key: "createdAt",
        label: "Joined",

        render: (user) => (
          <span className="text-sm text-slate-500">
            {formatDate(
              user.createdAt,
            )}
          </span>
        ),
      },

      {
        key: "actions",
        label: "",

        render: (user) => {
          const isInactive =
            user.isActive === false;

          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() =>
                  setEditingUser(user)
                }
                className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white"
                title="Edit user"
              >
                <Pencil size={15} />
              </button>

              {!isInactive && (
                <button
                  type="button"
                  onClick={() =>
                    setActionUser(user)
                  }
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
                  title="Deactivate user"
                >
                  <UserX size={15} />
                </button>
              )}
            </div>
          );
        },
      },
    ];

  /* ------------------------------------------------------------------------ */
  /* Pagination                                                               */
  /* ------------------------------------------------------------------------ */

  const total =
    query.data?.pagination.total ?? 0;

  const pages =
    query.data?.pagination.pages ?? 1;

  const active =
    users.filter(
      (user) =>
        user.isActive !== false,
    ).length;

  const currentPage =
    query.data?.pagination.page ??
    page;

  function changePage(
    nextPage: number,
  ) {
    setPage(
      Math.min(
        Math.max(nextPage, 1),
        Math.max(pages, 1),
      ),
    );
  }

  function handleSearch(
    value: string,
  ) {
    setSearch(value);
    setPage(1);
  }

  function handleRoleChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    setRole(event.target.value);
    setPage(1);
  }

  function handleManagerChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    setManagerId(
      event.target.value,
    );
    setPage(1);
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Manage organization members, roles, managers and account status."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              setShowCreateModal(true)
            }
          >
            <UserPlus size={16} />
            Add user
          </button>
        }
      />

      <UsersSummary
        total={total}
        active={active}
      />

      <div className="rounded-2xl border border-line bg-panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <Toolbar
              search={search}
              onSearch={handleSearch}
              placeholder="Search name, email, job title..."
            />
          </div>

          <select
            value={role}
            onChange={handleRoleChange}
            className="h-10 rounded-xl border border-line bg-ink px-3 text-sm text-slate-300 outline-none focus:border-brand-500"
          >
            <option value="">
              All roles
            </option>

            <option value="ORGANIZATION_ADMIN">
              Organization Admin
            </option>

            <option value="MANAGER">
              Manager
            </option>

            <option value="STAFF">
              Staff
            </option>
          </select>

          <select
            value={managerId}
            onChange={
              handleManagerChange
            }
            className="h-10 rounded-xl border border-line bg-ink px-3 text-sm text-slate-300 outline-none focus:border-brand-500"
          >
            <option value="">
              All managers
            </option>

            {managers.map(
              (manager) => (
                <option
                  key={getUserId(
                    manager,
                  )}
                  value={getUserId(
                    manager,
                  )}
                >
                  {getUserName(
                    manager,
                  )}
                </option>
              ),
            )}
          </select>
        </div>
      </div>

      <DataTable
        rows={users}
        columns={columns}
        empty={
          query.isLoading ? (
            <Loading label="Loading organization users..." />
          ) : query.isError ? (
            <ErrorState
              title="Users unavailable"
              text={getErrorMessage(
                query.error,
              )}
              onRetry={() =>
                query.refetch()
              }
            />
          ) : (
            <EmptyState
              title={
                search ||
                role ||
                managerId
                  ? "No matching users"
                  : "No users found"
              }
              text={
                search ||
                role ||
                managerId
                  ? "Try changing your search or filters."
                  : "Users in this organization will appear here."
              }
            />
          )
        }
      />

      {total > 0 && (
        <Pagination
          page={currentPage}
          pages={pages}
          total={total}
          limit={
            query.data?.pagination
              .limit ?? 25
          }
          onPageChange={
            changePage
          }
        />
      )}

      {showCreateModal && (
        <UserFormModal
          mode="create"
          managers={managers}
          loading={
            createMutation.isPending
          }
          error={
            createMutation.isError
              ? getErrorMessage(
                  createMutation.error,
                )
              : undefined
          }
          onClose={() =>
            setShowCreateModal(false)
          }
          onSubmit={(data) =>
            createMutation.mutate(
              data,
            )
          }
        />
      )}

      {editingUser && (
        <UserFormModal
          mode="edit"
          user={editingUser}
          managers={managers}
          loading={
            updateMutation.isPending
          }
          error={
            updateMutation.isError
              ? getErrorMessage(
                  updateMutation.error,
                )
              : undefined
          }
          onClose={() =>
            setEditingUser(null)
          }
          onSubmit={(data) => {
            const userId =
              getUserId(
                editingUser,
              );

            if (!userId) {
              return;
            }

            updateMutation.mutate({
              userId,
              data,
            });
          }}
        />
      )}

      {actionUser && (
        <DeactivateModal
          user={actionUser}
          loading={
            deactivateMutation.isPending
          }
          error={
            deactivateMutation.isError
              ? getErrorMessage(
                  deactivateMutation.error,
                )
              : undefined
          }
          onClose={() =>
            setActionUser(null)
          }
          onConfirm={() => {
            const userId =
              getUserId(
                actionUser,
              );

            if (userId) {
              deactivateMutation.mutate(
                userId,
              );
            }
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

function UsersSummary({
  total,
  active,
}: {
  total: number;
  active: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
          <Users size={18} />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Organization users
          </p>

          <p className="mt-1 text-xl font-bold text-white">
            {total}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-panel p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Active on this page
        </p>

        <p className="mt-1 text-xl font-bold text-white">
          {active}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                 */
/* -------------------------------------------------------------------------- */

function Pagination({
  page,
  pages,
  total,
  limit,
  onPageChange,
}: {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPageChange: (
    page: number,
  ) => void;
}) {
  const start =
    total === 0
      ? 0
      : (page - 1) * limit + 1;

  const end = Math.min(
    page * limit,
    total,
  );

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">
        Showing{" "}
        <span className="text-slate-400">
          {start}–{end}
        </span>{" "}
        of{" "}
        <span className="text-slate-400">
          {total}
        </span>{" "}
        users
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() =>
            onPageChange(
              page - 1,
            )
          }
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-500 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="px-2 text-sm text-slate-500">
          Page{" "}
          <span className="font-semibold text-white">
            {page}
          </span>{" "}
          of {pages}
        </span>

        <button
          type="button"
          disabled={page >= pages}
          onClick={() =>
            onPageChange(
              page + 1,
            )
          }
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-500 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* User Form Modal                                                            */
/* -------------------------------------------------------------------------- */

function UserFormModal({
  mode,
  user,
  managers,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  user?: OrganizationUser;
  managers: OrganizationUser[];
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (
    data: UserFormData,
  ) => void;
}) {
  const [firstName, setFirstName] =
    useState(user?.firstName || "");

  const [lastName, setLastName] =
    useState(user?.lastName || "");

  const [email, setEmail] =
    useState(user?.email || "");

  const [password, setPassword] =
    useState("");

  const [role, setRole] =
    useState<OrganizationUserRole>(
      user?.role === "MANAGER"
        ? "MANAGER"
        : user?.role ===
            "ORGANIZATION_ADMIN"
          ? "ORGANIZATION_ADMIN"
          : "STAFF",
    );

  const [
    selectedManagerId,
    setSelectedManagerId,
  ] = useState(
    getManagerId(
      user || {},
    ),
  );

  const [jobTitle, setJobTitle] =
    useState(
      user?.jobTitle || "",
    );

  const [department, setDepartment] =
    useState(
      user?.department || "",
    );

  const canSubmit =
    Boolean(
      firstName.trim() &&
        lastName.trim() &&
        email.trim() &&
        (mode === "edit" ||
          password.length >= 8),
    );

  function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onSubmit({
      firstName,
      lastName,
      email,
      password,
      role,
      managerId:
        selectedManagerId,
      jobTitle,
      department,
    });
  }

  return (
    <Modal
      title={
        mode === "create"
          ? "Add organization user"
          : "Edit user"
      }
      description={
        mode === "create"
          ? "Create an account and assign the user's organization role."
          : "Update this user's organization details and reporting relationship."
      }
      onClose={onClose}
    >
      <form
        onSubmit={submit}
        className="space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            value={firstName}
            onChange={setFirstName}
            placeholder="John"
            required
          />

          <Field
            label="Last name"
            value={lastName}
            onChange={setLastName}
            placeholder="Doe"
            required
          />
        </div>

        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="john@example.com"
          required
          disabled={
            mode === "edit"
          }
        />

        {mode === "create" && (
          <Field
            label="Temporary password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
            required
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Role"
            value={role}
            onChange={(value) =>
              setRole(
                value as OrganizationUserRole,
              )
            }
            options={[
              {
                value: "STAFF",
                label: "Staff",
              },
              {
                value: "MANAGER",
                label: "Manager",
              },
              {
                value:
                  "ORGANIZATION_ADMIN",
                label:
                  "Organization Admin",
              },
            ]}
          />

          <SelectField
            label="Manager"
            value={
              selectedManagerId
            }
            onChange={
              setSelectedManagerId
            }
            options={[
              {
                value: "",
                label: "No manager",
              },
              ...managers
                .filter(
                  (manager) =>
                    getUserId(
                      manager,
                    ) !==
                    getUserId(
                      user || {},
                    ),
                )
                .map(
                  (manager) => ({
                    value:
                      getUserId(
                        manager,
                      ),
                    label:
                      getUserName(
                        manager,
                      ),
                  }),
                ),
            ]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Job title"
            value={jobTitle}
            onChange={setJobTitle}
            placeholder="Frontend Developer"
          />

          <Field
            label="Department"
            value={department}
            onChange={
              setDepartment
            }
            placeholder="Engineering"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="btn-primary"
            disabled={
              !canSubmit ||
              loading
            }
          >
            {loading
              ? "Saving..."
              : mode === "create"
                ? "Create user"
                : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Deactivate Modal                                                           */
/* -------------------------------------------------------------------------- */

function DeactivateModal({
  user,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  user: OrganizationUser;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title="Deactivate user"
      description="This will prevent the user from accessing the organization account."
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="font-semibold text-white">
            {getUserName(user)}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {user.email}
          </p>

          <p className="mt-3 text-sm leading-6 text-red-200/80">
            The user's active status
            will be changed to inactive
            and their refresh token will
            be cleared.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
          >
            {loading
              ? "Deactivating..."
              : "Deactivate user"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-white">
              {title}
            </h2>

            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl text-slate-600 transition hover:bg-white/5 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Field                                                                      */
/* -------------------------------------------------------------------------- */

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}

        {required && (
          <span className="ml-1 text-red-400">
            *
          </span>
        )}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-700 focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Select                                                                      */
/* -------------------------------------------------------------------------- */

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  options: {
    value: string;
    label: string;
  }[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-white outline-none focus:border-brand-500"
      >
        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {option.label}
            </option>
          ),
        )}
      </select>
    </label>
  );
}