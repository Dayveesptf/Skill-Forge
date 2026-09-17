import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { api, errorMessage, unwrap } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, ErrorState, Loading, PageHeader, Section } from "../../components/ui";

interface Framework {
  _id: string;
  name: string;
  version: string;
  description?: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  effectiveFrom?: string;
  effectiveTo?: string;
}

interface Organization {
  _id?: string;
  name?: string;
  frameworkVersionId?: string | { _id?: string; name?: string; version?: string };
}

function id(value?: Organization["frameworkVersionId"]) {
  return typeof value === "string" ? value : value?._id ?? "";
}

export default function FrameworkMigrationPage() {
  const queryClient = useQueryClient();
  const { isPlatformAdmin } = useAuth();

  /*
   * A PLATFORM_ADMIN has no organizationId, so GET /organizations/me
   * returns 403 for that role (it authorizes ORGANIZATION_ADMIN,
   * MANAGER and STAFF only). Platform admins pick a tenant instead and
   * we read/write that tenant through /organizations/:id, which the
   * organization controller already supports for this role.
   */
  const [selectedOrgId, setSelectedOrgId] = useState("");

  const orgListQuery = useQuery({
    queryKey: ["organizations", "list"],
    enabled: isPlatformAdmin,
    queryFn: async () => unwrap<Organization[]>(await api.get("/organizations")),
  });

  const orgQuery = useQuery({
    queryKey: ["organization", "framework", isPlatformAdmin ? selectedOrgId : "me"],
    enabled: !isPlatformAdmin || Boolean(selectedOrgId),
    queryFn: async () =>
      unwrap<Organization>(
        await api.get(isPlatformAdmin ? `/organizations/${selectedOrgId}` : "/organizations/me"),
      ),
  });

  const frameworksQuery = useQuery({
    queryKey: ["frameworks", "available"],
    queryFn: async () => unwrap<Framework[]>(await api.get("/frameworks")),
  });

  const adoptMutation = useMutation({
    mutationFn: async (frameworkVersionId: string) =>
      unwrap(
        await api.patch(isPlatformAdmin ? `/organizations/${selectedOrgId}` : "/organizations/me", {
          frameworkVersionId,
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      orgQuery.refetch();
    },
  });

  function refetchAll() {
    if (isPlatformAdmin) orgListQuery.refetch();
    if (!isPlatformAdmin || selectedOrgId) orgQuery.refetch();
    frameworksQuery.refetch();
  }

  const waitingForOrgChoice = isPlatformAdmin && !selectedOrgId;

  const loading =
    frameworksQuery.isLoading ||
    (isPlatformAdmin ? orgListQuery.isLoading : orgQuery.isLoading);

  const error =
    frameworksQuery.error ||
    orgListQuery.error ||
    (waitingForOrgChoice ? null : orgQuery.error);

  if (loading) return <Loading label="Loading framework versions..." />;

  if (error)
    return (
      <ErrorState
        text={errorMessage(error, "Could not load framework versions.")}
        onRetry={refetchAll}
      />
    );

  const currentId = id(orgQuery.data?.frameworkVersionId);
  const frameworks = frameworksQuery.data ?? [];
  const organizations = orgListQuery.data ?? [];
  const canAdopt = !isPlatformAdmin || Boolean(selectedOrgId);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Framework governance"
        title="Framework versioning"
        description="Review available framework versions and adopt the version an organization should use for new assessments. Completed assessments retain the framework version they were scored against."
        actions={
          <Button variant="secondary" onClick={refetchAll}>
            <RefreshCw size={15} /> Refresh
          </Button>
        }
      />

      {isPlatformAdmin && (
        <Card>
          <Section
            title="Organization context"
            description="Platform administrators are not attached to a tenant. Choose the organization you are managing."
          >
            <select
              value={selectedOrgId}
              onChange={(event) => setSelectedOrgId(event.target.value)}
              className="w-full max-w-md rounded-xl border border-line bg-ink px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Select an organization...</option>
              {organizations.map((organization) => (
                <option key={organization._id} value={organization._id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </Section>
        </Card>
      )}

      {waitingForOrgChoice ? (
        <Card>
          <p className="text-sm text-slate-500">
            Select an organization above to see which framework version it has adopted.
          </p>
        </Card>
      ) : (
        <Card>
          <Section
            title="Current adopted version"
            description="New role profiles and assessments should use the adopted framework version."
          >
            <div className="flex items-center gap-3 rounded-xl border border-line bg-ink p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {frameworks.find((item) => item._id === currentId)?.name ?? "No framework adopted"}
                </p>
                <p className="text-xs text-slate-600">
                  {frameworks.find((item) => item._id === currentId)?.version ??
                    "Select a version below"}
                </p>
              </div>
            </div>
          </Section>
        </Card>
      )}

      <div className="space-y-3">
        {frameworks.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">No framework versions are available.</p>
          </Card>
        ) : (
          frameworks.map((framework) => (
            <Card key={framework._id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-white">{framework.name}</h2>
                    <Badge
                      tone={
                        framework.status === "ACTIVE"
                          ? "green"
                          : framework.status === "DRAFT"
                            ? "amber"
                            : "slate"
                      }
                    >
                      {framework.status}
                    </Badge>
                    {framework._id === currentId && <Badge tone="blue">Adopted</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Version {framework.version}</p>
                  {framework.description && (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      {framework.description}
                    </p>
                  )}
                </div>

                {framework._id !== currentId && framework.status !== "ARCHIVED" ? (
                  <Button
                    disabled={!canAdopt}
                    onClick={() => adoptMutation.mutate(framework._id)}
                    loading={adoptMutation.isPending && adoptMutation.variables === framework._id}
                  >
                    Adopt version
                  </Button>
                ) : framework._id === currentId ? (
                  <span className="inline-flex items-center gap-2 text-sm text-emerald-300">
                    <CheckCircle2 size={16} /> Current version
                  </span>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}