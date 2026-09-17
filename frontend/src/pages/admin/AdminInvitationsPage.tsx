import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clipboard,
  Link2,
  Plus,
  RefreshCw,
  UserPlus,
  XCircle,
} from "lucide-react";

import { api, errorMessage, unwrap } from "../../api";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  PageHeader,
  Section,
  SuccessMessage,
} from "../../components/ui";

type InviteRole =
  | "ORGANIZATION_ADMIN"
  | "MANAGER"
  | "STAFF";

interface Invitation {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: InviteRole;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  createdAt: string;
  invitedBy?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  managerId?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

interface Manager {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  role: InviteRole;
  managerId: string;
}

interface CreateInvitationPayload {
  email: string;
  firstName?: string;
  lastName?: string;
  role: InviteRole;
  managerId?: string;
}

function roleLabel(role: InviteRole) {
  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function statusTone(
  status: Invitation["status"],
) {
  switch (status) {
    case "PENDING":
      return "amber" as const;
    case "ACCEPTED":
      return "green" as const;
    case "REVOKED":
      return "red" as const;
    default:
      return "slate" as const;
  }
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString();
}

export default function AdminInvitationsPage() {
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [formError, setFormError] = useState("");
  const [generatedLink, setGeneratedLink] =
    useState("");

  const [form, setForm] =
    useState<FormState>({
      email: "",
      firstName: "",
      lastName: "",
      role: "STAFF",
      managerId: "",
    });

  const invitationsQuery = useQuery({
    queryKey: ["organization-invitations"],
    queryFn: async () => {
      const response = await api.get(
        "/invitations",
      );
      return unwrap<Invitation[]>(response);
    },
  });

  const managersQuery = useQuery({
    queryKey: ["organization-managers-for-invitations"],
    queryFn: async () => {
      const response = await api.get(
        "/users",
        {
          params: {
            role: "MANAGER",
            page: 1,
            limit: 100,
          },
        },
      );

      const data = unwrap<{
        items?: Manager[];
        users?: Manager[];
        data?: Manager[];
      } | Manager[]>(response);

      if (Array.isArray(data)) return data;
      return data.items ?? data.users ?? data.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (
      payload: CreateInvitationPayload,
    ) => {
      const response = await api.post(
        "/invitations",
        payload,
      );

      return unwrap<{
        invitation: Invitation;
        inviteToken: string;
      }>(response);
    },
    onSuccess: (result) => {
      const link = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(result.inviteToken)}`;

      setGeneratedLink(link);
      setForm({
        email: "",
        firstName: "",
        lastName: "",
        role: "STAFF",
        managerId: "",
      });
      setFormError("");
      setShowCreate(false);

      queryClient.invalidateQueries({
        queryKey: ["organization-invitations"],
      });
    },
    onError: (error) => {
      setFormError(
        errorMessage(
          error,
          "Unable to create the invitation.",
        ),
      );
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(
        `/invitations/${id}`,
      );

      return unwrap<Invitation>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organization-invitations"],
      });
    },
  });

  const pendingCount = useMemo(
    () =>
      (invitationsQuery.data ?? []).filter(
        (invitation) =>
          invitation.status === "PENDING",
      ).length,
    [invitationsQuery.data],
  );

  function submitCreate(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setFormError("");

    if (!form.email.trim()) {
      setFormError("Email address is required.");
      return;
    }

    if (
      form.role === "STAFF" &&
      !form.managerId
    ) {
      setFormError(
        "Select a manager for the staff member.",
      );
      return;
    }

    createMutation.mutate({
      email: form.email.trim(),
      firstName: form.firstName.trim() || undefined,
      lastName: form.lastName.trim() || undefined,
      role: form.role,
      managerId:
        form.role === "STAFF"
          ? form.managerId || undefined
          : undefined,
    });
  }

  async function copyLink() {
    if (!generatedLink) return;

    await navigator.clipboard.writeText(
      generatedLink,
    );
  }

  if (
    invitationsQuery.isLoading ||
    managersQuery.isLoading
  ) {
    return <Loading label="Loading invitations..." />;
  }

  if (
    invitationsQuery.isError ||
    managersQuery.isError
  ) {
    return (
      <ErrorState
        title="Unable to load invitation data"
        text={
          invitationsQuery.isError
            ? errorMessage(
                invitationsQuery.error,
                "The invitation list could not be loaded.",
              )
            : errorMessage(
                managersQuery.error,
                "Managers could not be loaded.",
              )
        }
        onRetry={() => {
          invitationsQuery.refetch();
          managersQuery.refetch();
        }}
      />
    );
  }

  const invitations =
    invitationsQuery.data ?? [];
  const managers =
    managersQuery.data ?? [];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Organization Administration"
        title="Invitations"
        description="Invite organization administrators, managers, and staff. The generated invitation link can be shared directly when email delivery is not configured."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                invitationsQuery.refetch()
              }
              disabled={
                invitationsQuery.isFetching
              }
            >
              <RefreshCw
                size={15}
                className={
                  invitationsQuery.isFetching
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </Button>

            <Button
              onClick={() => {
                setGeneratedLink("");
                setFormError("");
                setShowCreate((value) => !value);
              }}
            >
              <UserPlus size={16} />
              New invitation
            </Button>
          </>
        }
      />

      {generatedLink && (
        <Card>
          <Section
            title="Invitation link generated"
            description="Share this link with the invited person. It expires according to the invitation settings."
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-ink px-3 py-3">
                <Link2
                  size={16}
                  className="shrink-0 text-brand-400"
                />
                <span className="min-w-0 break-all text-xs text-slate-400">
                  {generatedLink}
                </span>
              </div>

              <Button
                variant="secondary"
                onClick={copyLink}
              >
                <Clipboard size={15} />
                Copy link
              </Button>

              <Button
                variant="ghost"
                onClick={() =>
                  setGeneratedLink("")
                }
              >
                <XCircle size={15} />
                Dismiss
              </Button>
            </div>
          </Section>
        </Card>
      )}

      {showCreate && (
        <Card>
          <Section
            title="Create invitation"
            description="Choose the role and, for staff members, the manager who will receive corroboration requests."
          >
            <form
              onSubmit={submitCreate}
              className="grid gap-5 md:grid-cols-2"
            >
              <Input
                label="Email address"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="person@company.com"
                required
              />

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-slate-400">
                  Role
                </span>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as InviteRole,
                      managerId: "",
                    }))
                  }
                  className="field"
                >
                  <option value="STAFF">
                    Staff
                  </option>
                  <option value="MANAGER">
                    Manager
                  </option>
                  <option value="ORGANIZATION_ADMIN">
                    Organization Admin
                  </option>
                </select>
              </label>

              <Input
                label="First name"
                value={form.firstName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    firstName:
                      event.target.value,
                  }))
                }
                placeholder="First name"
              />

              <Input
                label="Last name"
                value={form.lastName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lastName:
                      event.target.value,
                  }))
                }
                placeholder="Last name"
              />

              {form.role === "STAFF" && (
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-xs font-semibold text-slate-400">
                    Manager
                  </span>

                  <select
                    value={form.managerId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        managerId:
                          event.target.value,
                      }))
                    }
                    className="field"
                    required
                  >
                    <option value="">
                      Select manager
                    </option>

                    {managers.map(
                      (manager) => (
                        <option
                          key={manager._id}
                          value={manager._id}
                        >
                          {manager.firstName}{" "}
                          {manager.lastName} —{" "}
                          {manager.email}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}

              {formError && (
                <div className="md:col-span-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 md:col-span-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCreate(false);
                    setFormError("");
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  loading={createMutation.isPending}
                >
                  <Plus size={15} />
                  Create invitation
                </Button>
              </div>
            </form>
          </Section>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">
            Total invitations
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {invitations.length}
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">
            Pending
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {pendingCount}
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">
            Accepted
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {
              invitations.filter(
                (invitation) =>
                  invitation.status ===
                  "ACCEPTED",
              ).length
            }
          </p>
        </Card>
      </div>

      <Section
        title="Invitation history"
        description="Track pending, accepted, expired, and revoked invitations."
      >
        {invitations.length === 0 ? (
          <EmptyState
            title="No invitations yet"
            text="Create an invitation to add people to your organization."
            action={
              <Button
                onClick={() =>
                  setShowCreate(true)
                }
              >
                <UserPlus size={15} />
                New invitation
              </Button>
            }
          />
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-[0.15em] text-slate-600">
                    <th className="px-5 py-4 font-semibold">
                      Invitee
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Role
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Manager
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Status
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Expires
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {invitations.map(
                    (invitation) => (
                      <tr
                        key={invitation._id}
                        className="border-b border-line/70 last:border-0"
                      >
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-white">
                            {invitation.firstName ||
                            invitation.lastName
                              ? `${invitation.firstName ?? ""} ${invitation.lastName ?? ""}`.trim()
                              : invitation.email}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            {invitation.email}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-400">
                          {roleLabel(
                            invitation.role,
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-400">
                          {invitation.managerId
                            ? `${invitation.managerId.firstName ?? ""} ${invitation.managerId.lastName ?? ""}`.trim() ||
                              invitation.managerId.email ||
                              "—"
                            : "—"}
                        </td>

                        <td className="px-5 py-4">
                          <Badge
                            tone={statusTone(
                              invitation.status,
                            )}
                          >
                            {invitation.status}
                          </Badge>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {formatDate(
                            invitation.expiresAt,
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {invitation.status ===
                            "PENDING" && (
                            <Button
                              variant="danger"
                              onClick={() =>
                                revokeMutation.mutate(
                                  invitation._id,
                                )
                              }
                              loading={
                                revokeMutation.isPending &&
                                revokeMutation.variables ===
                                  invitation._id
                              }
                            >
                              <XCircle
                                size={14}
                              />
                              Revoke
                            </Button>
                          )}

                          {invitation.status ===
                            "ACCEPTED" && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                              <Check size={14} />
                              Accepted
                            </span>
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>
    </div>
  );
}
