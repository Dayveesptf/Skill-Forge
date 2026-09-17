import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import { api, errorMessage, unwrap } from "../../api";
import {
  Badge,
  Button,
  Card,
  ErrorState,
  PageHeader,
  Section,
} from "../../components/ui";
import ConfigurationNotice from "../../components/ConfigurationNotice";

interface Scheduled {
  _id: string;
  name: string;
  format: string;
  frequency: string;
  recipients: string[];
  nextRunAt: string;
  active: boolean;
}

interface ConfigurationStatus {
  stripeConfigured: boolean;
  stripeWebhookConfigured: boolean;
  resendConfigured: boolean;
  encryptionConfigured: boolean;
}

export default function ScheduledReportsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("Weekly organization report");
  const [format, setFormat] = useState("PDF");
  const [frequency, setFrequency] = useState("WEEKLY");
  const [recipients, setRecipients] = useState("");
  const [notice, setNotice] = useState<{
    title: string;
    text: string;
  } | null>(null);

  const query = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: async () =>
      unwrap<Scheduled[]>(
        await api.get("/infrastructure/scheduled-reports"),
      ),
  });

  const configQuery = useQuery({
    queryKey: ["infrastructure-config-status"],
    queryFn: async () =>
      unwrap<ConfigurationStatus>(
        await api.get("/infrastructure/config-status"),
      ),
  });

  const create = useMutation({
    mutationFn: async () =>
      unwrap<Scheduled>(
        await api.post("/infrastructure/scheduled-reports", {
          name,
          format,
          frequency,
          recipients: recipients
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      ),
    onSuccess: () => {
      setRecipients("");
      queryClient.invalidateQueries({
        queryKey: ["scheduled-reports"],
      });
    },
    onError: (error) => {
      setNotice({
        title: "Scheduled reports could not be created",
        text: errorMessage(error),
      });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) =>
      api.delete(`/infrastructure/scheduled-reports/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["scheduled-reports"],
      }),
  });

  function createSchedule() {
    if (!configQuery.data?.resendConfigured) {
      setNotice({
        title: "Report email delivery is not configured yet",
        text: "The scheduled-report controllers, PDF/XLSX generation services and automation worker are already installed in SkillForge, but RESEND_API_KEY has not been configured. Add the Resend credentials when you are ready to send reports by email.",
      });
      return;
    }

    const parsedRecipients = recipients
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (parsedRecipients.length === 0) {
      setNotice({
        title: "Recipient required",
        text: "Add at least one email address before creating a scheduled report.",
      });
      return;
    }

    create.mutate();
  }

  if (query.isLoading || configQuery.isLoading) {
    return <div className="p-8 text-slate-500">Loading scheduled reports...</div>;
  }

  if (query.isError || configQuery.isError) {
    return (
      <ErrorState
        text={
          query.isError
            ? errorMessage(query.error)
            : errorMessage(
                configQuery.error,
                "Unable to load report configuration status.",
              )
        }
      />
    );
  }

  const reports = query.data || [];
  const resendReady = Boolean(configQuery.data?.resendConfigured);

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Reporting"
          title="Scheduled reports"
          description="Deliver recurring PDF or Excel reports to selected recipients. Email delivery remains safely disabled until Resend is configured."
        />

        {!resendReady && (
          <Card className="border-amber-400/20 bg-amber-400/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  Scheduled email delivery is not configured yet
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  PDF/XLSX generation and the scheduled-report worker are
                  installed. RESEND_API_KEY is the only missing provider
                  configuration for email delivery.
                </p>
              </div>
              <Badge tone="amber">NOT CONFIGURED</Badge>
            </div>
          </Card>
        )}

        <Card>
          <Section title="New schedule">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="label">Name</span>
                <input
                  className="field"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>

              <label>
                <span className="label">Format</span>
                <select
                  className="field"
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                >
                  <option>PDF</option>
                  <option>XLSX</option>
                </select>
              </label>

              <label>
                <span className="label">Frequency</span>
                <select
                  className="field"
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value)}
                >
                  <option>DAILY</option>
                  <option>WEEKLY</option>
                  <option>MONTHLY</option>
                </select>
              </label>

              <label>
                <span className="label">Recipients</span>
                <input
                  className="field"
                  value={recipients}
                  onChange={(event) => setRecipients(event.target.value)}
                  placeholder="admin@company.com, manager@company.com"
                />
              </label>
            </div>

            <div className="mt-4">
              <Button
                onClick={createSchedule}
                loading={create.isPending}
                disabled={!resendReady}
              >
                Create schedule
              </Button>
            </div>
          </Section>
        </Card>

        <Section title="Active schedules">
          <div className="space-y-3">
            {reports.map((report) => (
              <Card key={report._id} padding="sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{report.name}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {report.frequency} · {report.format} · Next run{" "}
                      {new Date(report.nextRunAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge tone={report.active ? "green" : "slate"}>
                      {report.active ? "ACTIVE" : "PAUSED"}
                    </Badge>
                    <Button
                      variant="danger"
                      onClick={() => remove.mutate(report._id)}
                      loading={remove.isPending}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {!reports.length && (
              <p className="text-sm text-slate-600">
                No scheduled reports.
              </p>
            )}
          </div>
        </Section>
      </div>

      {notice && (
        <ConfigurationNotice
          title={notice.title}
          text={notice.text}
        />
      )}
    </>
  );
}
