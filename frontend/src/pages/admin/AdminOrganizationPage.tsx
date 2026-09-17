import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Users,
  ShieldCheck,
  UserCog,
  UserRound,
  Save,
  RefreshCw,
} from "lucide-react";

import { api, errorMessage, unwrap } from "../../api";
import { PageHeader } from "../../components/ui";

interface Organization {
  _id: string;
  name: string;
  slug: string;
  industry?: string;
  subscription: {
    plan: string;
    seatLimit: number;
    status: "TRIAL" | "ACTIVE" | "SUSPENDED";
    startsAt?: string;
    endsAt?: string;
  };
  frameworkVersionId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationStats {
  totalUsers: number;
  admins: number;
  managers: number;
  staff: number;
}

interface OrganizationForm {
  name: string;
  industry: string;
  plan: string;
  seatLimit: number;
}

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString();
}

function getStatusClasses(
  status: Organization["subscription"]["status"],
) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700";

    case "TRIAL":
      return "bg-amber-100 text-amber-700";

    case "SUSPENDED":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getStatusLabel(
  status: Organization["subscription"]["status"],
) {
  switch (status) {
    case "ACTIVE":
      return "Active";

    case "TRIAL":
      return "Trial";

    case "SUSPENDED":
      return "Suspended";

    default:
      return status;
  }
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
}

function StatCard({
  label,
  value,
  icon,
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </p>
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AdminOrganizationPage() {
  const queryClient = useQueryClient();

  const [form, setForm] =
    useState<OrganizationForm>({
      name: "",
      industry: "",
      plan: "",
      seatLimit: 50,
    });

  const [saveMessage, setSaveMessage] =
    useState("");

  const [saveError, setSaveError] =
    useState("");

  const organizationQuery =
    useQuery({
      queryKey: ["organization", "me"],

      queryFn: async () => {
        const response =
          await api.get("/organizations/me");

        return unwrap<Organization>(
          response,
        );
      },
    });

  const statsQuery =
    useQuery({
      queryKey: ["organization", "me", "stats"],

      queryFn: async () => {
        const response =
          await api.get(
            "/organizations/me/stats",
          );

        return unwrap<OrganizationStats>(
          response,
        );
      },
    });

  const organization =
    organizationQuery.data;

  const stats =
    statsQuery.data;

  useEffect(() => {
    if (!organization) {
      return;
    }

    setForm({
      name: organization.name ?? "",
      industry: organization.industry ?? "",
      plan:
        organization.subscription?.plan ??
        "STANDARD",
      seatLimit:
        organization.subscription?.seatLimit ??
        50,
    });
  }, [organization]);

  const updateMutation =
    useMutation({
      mutationFn: async (
        payload: OrganizationForm,
      ) => {
        const response =
          await api.patch(
            "/organizations/me",
            payload,
          );

        return unwrap<Organization>(
          response,
        );
      },

      onSuccess: () => {
        setSaveMessage(
          "Organization settings saved successfully.",
        );
        setSaveError("");

        queryClient.invalidateQueries({
          queryKey: ["organization"],
        });
      },

      onError: (error) => {
        setSaveMessage("");
        setSaveError(
          errorMessage(
            error,
            "Unable to save organization settings.",
          ),
        );
      },
    });

  function handleChange(
    field: keyof OrganizationForm,
    value: string | number,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setSaveMessage("");
    setSaveError("");
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!form.name.trim()) {
      setSaveError(
        "Organization name is required.",
      );
      setSaveMessage("");
      return;
    }

    if (
      !Number.isInteger(form.seatLimit) ||
      form.seatLimit < 1
    ) {
      setSaveError(
        "Seat limit must be a whole number greater than 0.",
      );
      setSaveMessage("");
      return;
    }

    updateMutation.mutate({
      name: form.name.trim(),
      industry: form.industry.trim(),
      plan: form.plan.trim(),
      seatLimit: form.seatLimit,
    });
  }

  const isLoading =
    organizationQuery.isLoading ||
    statsQuery.isLoading;

  const isError =
    organizationQuery.isError ||
    statsQuery.isError;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization"
        description="Manage your organization's details, subscription information, and seat usage."
        actions={
          <button
            type="button"
            onClick={() => {
              organizationQuery.refetch();
              statsQuery.refetch();
            }}
            disabled={isLoading}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw
              size={16}
              className={
                isLoading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        }
      />

      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading organization information...
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Unable to load organization information.
        </div>
      )}

      {!isLoading &&
        !isError &&
        organization && (
          <>
            {/* Organization overview */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white">
                    <Building2 size={26} />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {organization.name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      {organization.slug}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${getStatusClasses(
                      organization.subscription
                        ?.status,
                    )}`}
                  >
                    <CheckCircle2 size={14} />

                    {getStatusLabel(
                      organization.subscription
                        ?.status,
                    )}
                  </span>

                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {organization.subscription
                      ?.plan || "STANDARD"}
                  </span>
                </div>
              </div>
            </div>

            {/* Organization statistics */}
            {stats && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Total users"
                  value={stats.totalUsers}
                  icon={<Users size={20} />}
                />

                <StatCard
                  label="Administrators"
                  value={stats.admins}
                  icon={
                    <ShieldCheck size={20} />
                  }
                />

                <StatCard
                  label="Managers"
                  value={stats.managers}
                  icon={
                    <UserCog size={20} />
                  }
                />

                <StatCard
                  label="Staff"
                  value={stats.staff}
                  icon={
                    <UserRound size={20} />
                  }
                />
              </div>
            )}

            {/* Subscription / seat usage */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Seat usage
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Current organization users compared with the configured seat limit.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-3xl font-semibold text-slate-900">
                    {stats?.totalUsers ?? 0}
                    <span className="text-base font-normal text-slate-400">
                      {" "}
                      /{" "}
                      {organization.subscription
                        ?.seatLimit ?? 0}
                    </span>
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    seats used
                  </p>
                </div>

                <div className="text-sm text-slate-500">
                  {Math.max(
                    0,
                    (organization.subscription
                      ?.seatLimit ?? 0) -
                      (stats?.totalUsers ?? 0),
                  )}{" "}
                  seats remaining
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      ((stats?.totalUsers ?? 0) /
                        Math.max(
                          1,
                          organization
                            .subscription
                            ?.seatLimit ?? 1,
                        )) *
                        100,
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Organization settings */}
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <div className="mb-6">
                <h2 className="text-base font-semibold text-slate-900">
                  Organization settings
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Update the information associated with your organization.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Organization name
                  </span>

                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) =>
                      handleChange(
                        "name",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="Organization name"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Industry
                  </span>

                  <input
                    type="text"
                    value={form.industry}
                    onChange={(event) =>
                      handleChange(
                        "industry",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g. Technology"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Subscription plan
                  </span>

                  <input
                    type="text"
                    value={form.plan}
                    onChange={(event) =>
                      handleChange(
                        "plan",
                        event.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="STANDARD"
                  />

                  <span className="mt-1 block text-xs text-slate-400">
                    Current plan:{" "}
                    {organization.subscription
                      ?.plan || "STANDARD"}
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Seat limit
                  </span>

                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={form.seatLimit}
                    onChange={(event) =>
                      handleChange(
                        "seatLimit",
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />

                  <span className="mt-1 block text-xs text-slate-400">
                    Current users:{" "}
                    {stats?.totalUsers ?? 0}
                  </span>
                </label>
              </div>

              {/* Subscription dates */}
              <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Subscription started
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(
                      organization.subscription
                        ?.startsAt,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Subscription ends
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDate(
                      organization.subscription
                        ?.endsAt,
                    )}
                  </p>
                </div>
              </div>

              {saveMessage && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {saveMessage}
                </div>
              )}

              {saveError && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {saveError}
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={
                    updateMutation.isPending
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />

                  {updateMutation.isPending
                    ? "Saving..."
                    : "Save changes"}
                </button>
              </div>
            </form>

            {/* Organization metadata */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-base font-semibold text-slate-900">
                Organization information
              </h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Organization ID
                  </p>

                  <p className="mt-1 break-all text-sm text-slate-600">
                    {organization._id}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Created
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {formatDate(
                      organization.createdAt,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Last updated
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {formatDate(
                      organization.updatedAt,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  );
}