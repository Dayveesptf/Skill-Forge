import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { api, errorMessage, unwrap } from "../../api";
import {
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Toolbar,
} from "../../components/ui";
import { DataTable, type DataTableColumn } from "../../components/DataTable";

interface CorroborationCandidate {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  jobTitle?: string;
  department?: string;
}

interface CorroborationSelfAssessment {
  status?: string;
  submittedAt?: string;
  dueAt?: string;
}

interface Corroboration {
  _id: string;
  status: "PENDING" | "COMPLETED";
  createdAt: string;
  completedAt?: string;
  candidateId?: CorroborationCandidate;
  selfAssessmentId?: CorroborationSelfAssessment;
}

type ViewFilter = "pending" | "all";

function candidateName(candidate?: CorroborationCandidate): string {
  const name = `${candidate?.firstName ?? ""} ${candidate?.lastName ?? ""}`.trim();
  return name || candidate?.email || "Unknown candidate";
}

export default function ManagerCorroborationsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewFilter>("pending");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["manager", "corroborations", view],
    queryFn: async () =>
      unwrap<Corroboration[]>(
        await api.get(`/manager-corroborations/${view === "pending" ? "pending" : "mine"}`),
      ),
  });

  const corroborations = query.data ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return corroborations;

    return corroborations.filter((item) => {
      const name = candidateName(item.candidateId).toLowerCase();
      const email = item.candidateId?.email?.toLowerCase() ?? "";
      return name.includes(term) || email.includes(term);
    });
  }, [corroborations, search]);

  const columns: DataTableColumn<Corroboration>[] = [
    {
      key: "candidate",
      label: "Candidate",
      render: (row) => (
        <div>
          <p className="font-medium text-white">{candidateName(row.candidateId)}</p>
          <p className="text-xs text-slate-600">
            {row.candidateId?.jobTitle ?? row.candidateId?.department ?? row.candidateId?.email}
          </p>
        </div>
      ),
    },
    {
      key: "assessmentStatus",
      label: "Assessment",
      render: (row) => (
        <span className="text-sm text-slate-400">
          {row.selfAssessmentId?.status ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Corroboration",
      render: (row) => (
        <Badge tone={row.status === "COMPLETED" ? "green" : "amber"}>{row.status}</Badge>
      ),
    },
    {
      key: "submittedAt",
      label: "Submitted",
      render: (row) =>
        row.selfAssessmentId?.submittedAt
          ? new Date(row.selfAssessmentId.submittedAt).toLocaleDateString()
          : "—",
    },
  ];

  if (query.isLoading) return <Loading />;

  if (query.isError) {
    return (
      <ErrorState
        text={errorMessage(query.error, "Could not load manager corroborations.")}
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title="Corroborations"
        description="Review your team's self-assessments, confirm or adjust claimed competency levels, and provide justification for any changes."
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by candidate name or email..."
        filters={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView("pending")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                view === "pending"
                  ? "bg-brand-500/10 text-brand-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => setView("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                view === "all"
                  ? "bg-brand-500/10 text-brand-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              All
            </button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row._id}
        onRowClick={(row) => navigate(`/manager-corroborations/${row._id}`)}
        empty={
          <EmptyState
            title={view === "pending" ? "No pending corroborations" : "No corroborations yet"}
            text={
              view === "pending"
                ? "You're all caught up — nothing from your team needs review right now."
                : "Corroborations will appear here once your team submits self-assessments that require your review."
            }
          />
        }
      />
    </>
  );
}