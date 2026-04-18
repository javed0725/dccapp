import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, UserPlus, Wallet, FileCheck, CheckCheck, Banknote, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@shared/schema";

const TYPE_CONFIG = {
  admission: {
    label: "Admission",
    icon: UserPlus,
    bg: "bg-green-50 border-green-200",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    badge: "bg-green-100 text-green-700",
    dot: "bg-green-500",
  },
  payment: {
    label: "Payment",
    icon: Wallet,
    bg: "bg-blue-50 border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  result: {
    label: "Result",
    icon: FileCheck,
    bg: "bg-orange-50 border-orange-200",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    badge: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
  },
};

type CollectionRow = {
  id: number;
  userId: number;
  runningCollection: number;
  lastResetAt: string | null;
  user: { id: number; name: string | null; username: string; teacherId: string | null };
};

function CollectionSummaryPanel() {
  const { toast } = useToast();

  const {
    data: collections = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<CollectionRow[]>({
    queryKey: ["/api/collections"],
  });

  const resetMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest("POST", `/api/collections/${userId}/reset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({ title: "Collection cleared", description: "Balance reset to ৳0." });
    },
    onError: (err: Error) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    },
  });

  const total = collections.reduce((sum, c) => sum + c.runningCollection, 0);

  return (
    <div className="space-y-4" data-testid="panel-collection-summary">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Banknote className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-blue-700 uppercase tracking-tight">
              Daily Collection Summary
            </h2>
            <p className="text-xs text-muted-foreground">
              Cash collected by each teacher since last hand-over
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-collections"
          className="flex items-center gap-2 rounded-xl text-xs font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Total banner */}
      {collections.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-4 flex items-center justify-between shadow-md"
          data-testid="banner-total-collection"
        >
          <div>
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">Total Pending Cash</p>
            <p className="text-white text-2xl font-black" data-testid="text-total-collection">
              ৳{total.toLocaleString()}
            </p>
          </div>
          <Banknote className="w-8 h-8 text-white/40" />
        </div>
      )}

      {/* Per-teacher cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center text-blue-400">
          <Banknote className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No collection data yet</p>
          <p className="text-xs mt-1">Balances appear here as teachers record payments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {collections.map((col) => {
            const displayName = col.user?.name || col.user?.username || `Teacher #${col.userId}`;
            return (
              <div
                key={col.userId}
                data-testid={`card-collection-${col.userId}`}
                className="rounded-2xl border border-blue-100 bg-white shadow-sm p-4 flex flex-col gap-3"
              >
                {/* Name + amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-blue-700 font-black text-base">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate text-sm" data-testid={`text-teacher-name-${col.userId}`}>
                        {displayName}
                      </p>
                      {col.user?.teacherId && (
                        <p className="text-xs text-muted-foreground">ID: {col.user.teacherId}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Collection</p>
                    <p
                      className={`text-xl font-black ${col.runningCollection === 0 ? "text-muted-foreground" : "text-blue-600"}`}
                      data-testid={`text-collection-amount-${col.userId}`}
                    >
                      ৳{col.runningCollection.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Last reset + Reset button */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <p className="text-[11px] text-muted-foreground">
                    {col.lastResetAt
                      ? `Cleared: ${format(new Date(col.lastResetAt), "dd MMM, hh:mm a")}`
                      : "Never cleared"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={col.runningCollection === 0 || resetMutation.isPending}
                    onClick={() => resetMutation.mutate(col.userId)}
                    data-testid={`button-reset-collection-${col.userId}`}
                    className="h-7 px-3 text-xs font-bold rounded-lg border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Reset
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Notifications() {
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* ── Collection Summary Panel (admin only, always shown) ── */}
      <CollectionSummaryPanel />

      {/* ── Divider ── */}
      <div className="border-t border-border" />

      {/* ── Notifications ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-primary uppercase tracking-tight">Notifications</h1>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-2 rounded-xl text-xs font-bold"
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Bell className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No notifications yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Activity such as admissions, payments, and results will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const config =
                TYPE_CONFIG[notif.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.result;
              const Icon = config.icon;
              return (
                <div
                  key={notif.id}
                  data-testid={`notification-item-${notif.id}`}
                  className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${config.bg} ${
                    !notif.isRead
                      ? "ring-1 ring-inset ring-current/10 shadow-sm"
                      : "opacity-75"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        {notif.message}
                      </p>
                      {!notif.isRead && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${config.dot}`}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${config.badge}`}
                      >
                        {config.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
