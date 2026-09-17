import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  ShieldCheck,
  X,
} from "lucide-react";

import { api, unwrap } from "../../api";
import {
  Badge,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from "../../components/ui";
import { DataTable, type DataTableColumn } from "../../components/DataTable";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface AuditActor {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

interface AuditLog {
  _id?: string;
  id?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: AuditActor | string;
  organizationId?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

interface AuditPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface AuditResponse {
  logs: AuditLog[];
  pagination: AuditPagination;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getAuditId(log: AuditLog): string {
  return log._id || log.id || "";
}

function getActorName(actor?: AuditActor | string): string {
  if (!actor) {
    return "System";
  }

  if (typeof actor === "string") {
    return actor;
  }

  const fullName = [actor.firstName, actor.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || actor.email || "System";
}

function getActorEmail(actor?: AuditActor | string): string {
  if (!actor || typeof actor === "string") {
    return "";
  }

  return actor.email || "";
}

function getActorRole(actor?: AuditActor | string): string {
  if (!actor || typeof actor === "string") {
    return "";
  }

  return actor.role || "";
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function formatMetadataValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "—";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [actorId, setActorId] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const query = useQuery<AuditResponse>({
    queryKey: [
      "audit",
      {
        page,
        action,
        entityType,
        entityId,
        actorId,
      },
    ],

    queryFn: async () =>
      unwrap<AuditResponse>(
        await api.get("/audit", {
          params: {
            page,
            limit: 25,

            ...(action.trim()
              ? {
                  action: action.trim(),
                }
              : {}),

            ...(entityType.trim()
              ? {
                  entityType: entityType.trim(),
                }
              : {}),

            ...(entityId.trim()
              ? {
                  entityId: entityId.trim(),
                }
              : {}),

            ...(actorId.trim()
              ? {
                  actorId: actorId.trim(),
                }
              : {}),
          },
        }),
      ),
  });

  const logs = query.data?.logs ?? [];

  const pagination = query.data?.pagination ?? {
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
  };

  const hasFilters =
    Boolean(action.trim()) ||
    Boolean(entityType.trim()) ||
    Boolean(entityId.trim()) ||
    Boolean(actorId.trim());

  function clearFilters() {
    setAction("");
    setEntityType("");
    setEntityId("");
    setActorId("");
    setPage(1);
  }

  function goToPage(nextPage: number) {
    if (
      nextPage < 1 ||
      (pagination.pages > 0 && nextPage > pagination.pages)
    ) {
      return;
    }

    setPage(nextPage);
  }

  const columns = useMemo(
    () => createAuditColumns(setSelectedLogId),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security & governance"
        title="Audit logs"
        description="Review administrative and system activity recorded by the platform."
      />

      <AuditOverview
        total={pagination.total}
        hasFilters={hasFilters}
      />

      <AuditFilters
        action={action}
        entityType={entityType}
        entityId={entityId}
        actorId={actorId}
        hasFilters={hasFilters}
        onActionChange={(value) => {
          setAction(value);
          setPage(1);
        }}
        onEntityTypeChange={(value) => {
          setEntityType(value);
          setPage(1);
        }}
        onEntityIdChange={(value) => {
          setEntityId(value);
          setPage(1);
        }}
        onActorIdChange={(value) => {
          setActorId(value);
          setPage(1);
        }}
        onClear={clearFilters}
      />

      <DataTable
        columns={columns}
        rows={logs}
        empty={
          query.isLoading ? (
            <Loading label="Loading audit events..." />
          ) : query.isError ? (
            <ErrorState
              title="Audit logs unavailable"
              text="We couldn't load the recorded audit activity."
              onRetry={() => query.refetch()}
            />
          ) : (
            <EmptyState
              title={
                hasFilters
                  ? "No matching audit events"
                  : "No audit events"
              }
              text={
                hasFilters
                  ? "Try changing or clearing your filters."
                  : "Tracked platform activity will appear here."
              }
            />
          )
        }
      />

      {!query.isLoading &&
        !query.isError &&
        logs.length > 0 && (
          <AuditPagination
            pagination={pagination}
            onPrevious={() => goToPage(page - 1)}
            onNext={() => goToPage(page + 1)}
          />
        )}

      {selectedLogId && (
        <AuditLogDetails
          logId={selectedLogId}
          onClose={() => setSelectedLogId(null)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Columns                                                                    */
/* -------------------------------------------------------------------------- */

function createAuditColumns(
  onView: (logId: string) => void,
): DataTableColumn<AuditLog>[] {
  return [
    {
      key: "action",
      label: "Action",

      render: (log) => (
        <div>
          <p className="font-semibold text-white">
            {log.action || "Unknown action"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {log.entityType || "Unknown entity"}
          </p>
        </div>
      ),
    },

    {
      key: "entityType",
      label: "Entity",

      render: (log) => (
        <div className="space-y-1">
          <Badge>{log.entityType || "—"}</Badge>

          {log.entityId && (
            <p
              className="max-w-[180px] truncate font-mono text-[11px] text-slate-500"
              title={log.entityId}
            >
              {log.entityId}
            </p>
          )}
        </div>
      ),
    },

    {
      key: "actorId",
      label: "Actor",

      render: (log) => {
        const actorName = getActorName(log.actorId);
        const actorEmail = getActorEmail(log.actorId);
        const actorRole = getActorRole(log.actorId);

        return (
          <div>
            <p className="font-medium text-slate-200">
              {actorName}
            </p>

            {actorEmail && (
              <p className="mt-1 text-xs text-slate-500">
                {actorEmail}
              </p>
            )}

            {actorRole && (
              <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-600">
                {actorRole.replaceAll("_", " ")}
              </p>
            )}
          </div>
        );
      },
    },

    {
      key: "createdAt",
      label: "Timestamp",

      render: (log) => (
        <span className="text-sm text-slate-500">
          {formatTimestamp(log.createdAt)}
        </span>
      ),
    },

    {
      key: "details",
      label: "",

      render: (log) => {
        const id = getAuditId(log);

        return (
          <button
            type="button"
            onClick={() => {
              if (id) {
                onView(id);
              }
            }}
            disabled={!id}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-brand-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eye size={14} />
            View
          </button>
        );
      },
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

function AuditOverview({
  total,
  hasFilters,
}: {
  total: number;
  hasFilters: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
          <ShieldCheck size={19} />
        </div>

        <div>
          <p className="font-semibold text-white">
            Platform activity trail
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Audit events provide a chronological record of important
            administrative and system activity.
          </p>
        </div>
      </div>

      <div className="hidden text-right sm:block">
        <p className="text-2xl font-semibold text-white">
          {total.toLocaleString()}
        </p>

        <p className="text-xs text-slate-500">
          {hasFilters ? "Matching events" : "Total events"}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

interface AuditFiltersProps {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  hasFilters: boolean;
  onActionChange: (value: string) => void;
  onEntityTypeChange: (value: string) => void;
  onEntityIdChange: (value: string) => void;
  onActorIdChange: (value: string) => void;
  onClear: () => void;
}

function AuditFilters({
  action,
  entityType,
  entityId,
  actorId,
  hasFilters,
  onActionChange,
  onEntityTypeChange,
  onEntityIdChange,
  onActorIdChange,
  onClear,
}: AuditFiltersProps) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter size={17} className="text-brand-300" />

          <div>
            <h2 className="font-semibold text-white">
              Filter activity
            </h2>

            <p className="text-xs text-slate-500">
              Narrow the audit trail using the fields supported by the API.
            </p>
          </div>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-white"
          >
            <X size={14} />
            Clear filters
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FilterField
          label="Action"
          placeholder="e.g. USER_CREATED"
          value={action}
          onChange={onActionChange}
        />

        <FilterField
          label="Entity type"
          placeholder="e.g. USER"
          value={entityType}
          onChange={onEntityTypeChange}
        />

        <FilterField
          label="Entity ID"
          placeholder="MongoDB object ID"
          value={entityId}
          onChange={onEntityIdChange}
        />

        <FilterField
          label="Actor ID"
          placeholder="MongoDB object ID"
          value={actorId}
          onChange={onActorIdChange}
        />
      </div>
    </section>
  );
}

function FilterField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>

      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-brand-500/50"
      />
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                 */
/* -------------------------------------------------------------------------- */

function AuditPagination({
  pagination,
  onPrevious,
  onNext,
}: {
  pagination: AuditPagination;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const start =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1;

  const end = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-panel px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Showing{" "}
        <span className="font-medium text-slate-300">
          {start}
        </span>{" "}
        to{" "}
        <span className="font-medium text-slate-300">
          {end}
        </span>{" "}
        of{" "}
        <span className="font-medium text-slate-300">
          {pagination.total}
        </span>{" "}
        events
      </p>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-600">
          Page {pagination.page} of{" "}
          {Math.max(pagination.pages, 1)}
        </span>

        <button
          type="button"
          onClick={onPrevious}
          disabled={pagination.page <= 1}
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-400 transition hover:border-brand-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={
            pagination.pages === 0 ||
            pagination.page >= pagination.pages
          }
          className="grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-400 transition hover:border-brand-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Audit Details                                                              */
/* -------------------------------------------------------------------------- */

function AuditLogDetails({
  logId,
  onClose,
}: {
  logId: string;
  onClose: () => void;
}) {
  const query = useQuery<AuditLog>({
    queryKey: ["audit-log", logId],

    queryFn: async () =>
      unwrap<AuditLog>(
        await api.get(`/audit/${logId}`),
      ),
  });

  const log = query.data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-details-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-300">
              Audit event
            </p>

            <h2
              id="audit-details-title"
              className="mt-1 text-lg font-semibold text-white"
            >
              Event details
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-white"
            aria-label="Close audit details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-80px)] overflow-y-auto p-5">
          {query.isLoading ? (
            <Loading label="Loading audit event..." />
          ) : query.isError || !log ? (
            <ErrorState
              title="Audit event unavailable"
              text="We couldn't load the details for this audit event."
              onRetry={() => query.refetch()}
            />
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Action"
                  value={log.action || "—"}
                />

                <DetailItem
                  label="Entity type"
                  value={log.entityType || "—"}
                />

                <DetailItem
                  label="Entity ID"
                  value={log.entityId || "—"}
                  mono
                />

                <DetailItem
                  label="Timestamp"
                  value={formatTimestamp(log.createdAt)}
                />

                <DetailItem
                  label="Actor"
                  value={getActorName(log.actorId)}
                />

                <DetailItem
                  label="Actor email"
                  value={
                    getActorEmail(log.actorId) || "—"
                  }
                />

                <DetailItem
                  label="Actor role"
                  value={
                    getActorRole(log.actorId) || "—"
                  }
                />

                <DetailItem
                  label="Organization ID"
                  value={log.organizationId || "—"}
                  mono
                />
              </div>

              <div>
                <div className="mb-3">
                  <h3 className="font-semibold text-white">
                    Metadata
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Additional information recorded with this event.
                  </p>
                </div>

                {log.metadata &&
                Object.keys(log.metadata).length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-line bg-surface">
                    <div className="divide-y divide-line">
                      {Object.entries(log.metadata).map(
                        ([key, value]) => (
                          <div
                            key={key}
                            className="grid gap-2 px-4 py-3 sm:grid-cols-[180px_1fr]"
                          >
                            <span className="text-xs font-medium uppercase tracking-wide text-slate-600">
                              {key}
                            </span>

                            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-300">
                              {formatMetadataValue(value)}
                            </pre>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-sm text-slate-600">
                    No metadata was recorded for this event.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail Item                                                                */
/* -------------------------------------------------------------------------- */

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
        {label}
      </p>

      <p
        className={`mt-2 break-words text-sm text-slate-200 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}