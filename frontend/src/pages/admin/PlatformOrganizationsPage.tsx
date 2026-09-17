import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  Plus,
  RefreshCw,
  Users,
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

interface Organization {
  _id: string;
  name: string;
  slug: string;
  industry?: string;
  subscription?: {
    plan?: string;
    seatLimit?: number;
    status?: "TRIAL" | "ACTIVE" | "SUSPENDED";
    startsAt?: string;
    endsAt?: string;
  };
  isActive?: boolean;
  createdAt?: string;
  totalUsers?: number;
}

interface CreateOrganizationForm {
  name: string;
  industry: string;
  plan: string;
  seatLimit: number;
}

type SubscriptionStatus =
  | "TRIAL"
  | "ACTIVE"
  | "SUSPENDED";

function statusTone(
  status?: SubscriptionStatus,
) {
  if (status === "ACTIVE") return "green" as const;
  if (status === "SUSPENDED") return "red" as const;
  return "amber" as const;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString();
}

export default function PlatformOrganizationsPage() {
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] =
    useState<CreateOrganizationForm>({
      name: "",
      industry: "",
      plan: "STANDARD",
      seatLimit: 50,
    });

  const [formError, setFormError] = useState("");
  const [createdOrganization, setCreatedOrganization] =
    useState<Organization | null>(null);

  const organizationsQuery = useQuery({
    queryKey: ["platform-organizations"],
    queryFn: async () => {
      const response = await api.get("/organizations");
      return unwrap<Organization[]>(response);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (
      payload: CreateOrganizationForm,
    ) => {
      const response = await api.post(
        "/organizations",
        payload,
      );
      return unwrap<Organization>(response);
    },
    onSuccess: (organization) => {
      setCreatedOrganization(organization);
      setForm({
        name: "",
        industry: "",
        plan: "STANDARD",
        seatLimit: 50,
      });
      setFormError("");
      setShowCreate(false);
      queryClient.invalidateQueries({
        queryKey: ["platform-organizations"],
      });
    },
    onError: (error) => {
      setFormError(
        errorMessage(
          error,
          "Unable to create the organization.",
        ),
      );
    },
  });

  function submitCreate(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setFormError("");
    setCreatedOrganization(null);

    if (!form.name.trim()) {
      setFormError("Organization name is required.");
      return;
    }

    if (
      !Number.isInteger(form.seatLimit) ||
      form.seatLimit < 1
    ) {
      setFormError(
        "Seat limit must be a whole number greater than 0.",
      );
      return;
    }

    createMutation.mutate({
      name: form.name.trim(),
      industry: form.industry.trim(),
      plan: form.plan.trim() || "STANDARD",
      seatLimit: form.seatLimit,
    });
  }

  if (organizationsQuery.isLoading) {
    return <Loading label="Loading organizations..." />;
  }

  if (organizationsQuery.isError) {
    return (
      <ErrorState
        title="Unable to load organizations"
        text={errorMessage(
          organizationsQuery.error,
          "The platform organizations could not be loaded.",
        )}
        onRetry={() => organizationsQuery.refetch()}
      />
    );
  }

  const organizations =
    organizationsQuery.data ?? [];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Platform Administration"
        title="Organizations"
        description="Provision and monitor tenant organizations across the SkillForge platform."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                organizationsQuery.refetch()
              }
              disabled={organizationsQuery.isFetching}
            >
              <RefreshCw
                size={15}
                className={
                  organizationsQuery.isFetching
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </Button>

            <Button
              onClick={() => {
                setCreatedOrganization(null);
                setFormError("");
                setShowCreate((value) => !value);
              }}
            >
              <Plus size={16} />
              New organization
            </Button>
          </>
        }
      />

      {createdOrganization && (
        <SuccessMessage
          text={`Organization "${createdOrganization.name}" was created successfully.`}
        />
      )}

      {showCreate && (
        <Card>
          <Section
            title="Create organization"
            description="Create a new tenant. Organization administrators and users can be added through invitations after provisioning."
          >
            <form
              onSubmit={submitCreate}
              className="grid gap-5 md:grid-cols-2"
            >
              <Input
                label="Organization name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Acme Technologies"
                required
              />

              <Input
                label="Industry"
                value={form.industry}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    industry: event.target.value,
                  }))
                }
                placeholder="e.g. Financial Services"
              />

              <Input
                label="Plan"
                value={form.plan}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    plan: event.target.value,
                  }))
                }
                placeholder="STANDARD"
              />

              <Input
                label="Seat limit"
                type="number"
                min={1}
                step={1}
                value={form.seatLimit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    seatLimit: Number(
                      event.target.value,
                    ),
                  }))
                }
              />

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
                  Create organization
                </Button>
              </div>
            </form>
          </Section>
        </Card>
      )}

      <Section
        title="Tenant organizations"
        description={`${organizations.length} organization${organizations.length === 1 ? "" : "s"} provisioned on the platform.`}
      >
        {organizations.length === 0 ? (
          <EmptyState
            title="No organizations yet"
            text="Create the first tenant organization to begin platform provisioning."
            action={
              <Button
                onClick={() => setShowCreate(true)}
              >
                <Plus size={15} />
                Create organization
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
                      Organization
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Industry
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Plan
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Seats
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Status
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Created
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {organizations.map(
                    (organization) => {
                      const seatLimit =
                        organization.subscription
                          ?.seatLimit ?? 0;
                      const totalUsers =
                        organization.totalUsers ?? 0;

                      return (
                        <tr
                          key={organization._id}
                          className="border-b border-line/70 last:border-0"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
                                <Building2
                                  size={17}
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">
                                  {organization.name}
                                </p>

                                <p className="mt-0.5 truncate text-xs text-slate-600">
                                  {organization.slug}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-400">
                            {organization.industry ||
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            <span className="text-sm text-slate-300">
                              {organization.subscription
                                ?.plan ||
                                "STANDARD"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                              <Users size={14} className="text-slate-600" />
                              {totalUsers} /{" "}
                              {seatLimit}
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <Badge
                              tone={statusTone(
                                organization
                                  .subscription
                                  ?.status,
                              )}
                            >
                              {organization
                                .subscription
                                ?.status ||
                                "TRIAL"}
                            </Badge>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-500">
                            {formatDate(
                              organization.createdAt,
                            )}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">
            Total tenants
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {organizations.length}
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">
            Active tenants
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {
              organizations.filter(
                (organization) =>
                  organization.subscription
                    ?.status === "ACTIVE",
              ).length
            }
          </p>
        </Card>

        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">
            Total seats in use
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {organizations.reduce(
              (sum, organization) =>
                sum +
                (organization.totalUsers ?? 0),
              0,
            )}
          </p>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-600">
        <CheckCircle2 size={14} />
        Tenant isolation is enforced by organization context on organization-scoped APIs.
      </div>
    </div>
  );
}
