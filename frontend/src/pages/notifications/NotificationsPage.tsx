import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { api, errorMessage, unwrap } from "../../api";
import { Badge, Button, Card, EmptyState, ErrorState, Loading, PageHeader } from "../../components/ui";

interface NotificationItem {
  _id: string;
  type: string;
  priority: "LOW" | "NORMAL" | "HIGH";
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  readAt?: string;
  createdAt: string;
}

interface NotificationResponse {
  notifications: NotificationItem[];
  pagination?: { page: number; limit: number; total: number; pages: number };
  unreadCount: number;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function priorityTone(priority: NotificationItem["priority"]) {
  if (priority === "HIGH") return "red" as const;
  if (priority === "LOW") return "slate" as const;
  return "blue" as const;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      unwrap<NotificationResponse>(await api.get("/notifications", { params: { page: 1, limit: 100 } }))
  });

  const readMutation = useMutation({
    mutationFn: async (id: string) =>
      unwrap<NotificationItem>(await api.patch(`/notifications/${id}/read`)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] })
  });

  const readAllMutation = useMutation({
    mutationFn: async () => unwrap(await api.patch("/notifications/read-all")),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] })
  });

  if (query.isLoading) return <Loading label="Loading notifications..." />;

  if (query.isError) {
    return <ErrorState title="Notifications unavailable" text={errorMessage(query.error, "Could not load notifications.")} onRetry={() => query.refetch()} />;
  }

  const notifications = query.data?.notifications ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Updates"
        title="Notifications"
        description="Assessment assignments, submissions, corroboration updates, results and other SkillForge activity appear here."
        actions={
          <>
            <Button variant="secondary" onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button onClick={() => readAllMutation.mutate()} loading={readAllMutation.isPending}>
                <CheckCheck size={15} />
                Mark all read
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">Total notifications</p>
          <p className="mt-2 text-2xl font-bold text-white">{notifications.length}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">Unread</p>
          <p className="mt-2 text-2xl font-bold text-white">{unreadCount}</p>
        </Card>
        <Card padding="sm">
          <p className="text-xs uppercase tracking-wide text-slate-600">Status</p>
          <p className="mt-2 text-sm font-semibold text-emerald-300">Notifications enabled</p>
        </Card>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <EmptyState title="You're all caught up" text="New SkillForge activity will appear here." action={<Bell size={18} className="text-slate-600" />} />
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card key={notification._id} className={notification.readAt ? "opacity-75" : "border-brand-500/20"}>
              <div className="flex gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-300">
                  <Bell size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-white">{notification.title}</h2>
                    <Badge tone={priorityTone(notification.priority)}>{notification.priority}</Badge>
                    {!notification.readAt && <Badge tone="green">Unread</Badge>}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{notification.message}</p>
                  <p className="mt-2 text-xs text-slate-600">{formatDate(notification.createdAt)}</p>
                </div>
                {!notification.readAt && (
                  <Button variant="ghost" onClick={() => readMutation.mutate(notification._id)} loading={readMutation.isPending && readMutation.variables === notification._id}>
                    Mark read
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
