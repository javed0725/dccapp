import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, UserPlus, Wallet, FileCheck, CheckCheck, Banknote, RefreshCw, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { MobileNav } from "@/components/Navigation";
import type { Notification } from "@shared/schema";

type PaymentDetail = {
  id: number;
  studentName: string;
  batchName: string;
  month: string;
  amount: number;
  date: string;
};

function TeacherPaymentDetails({ userId, enabled }: { userId: number; enabled: boolean }) {
  const { data, isLoading } = useQuery<PaymentDetail[]>({
    queryKey: ["/api/collections", userId, "details"],
    enabled,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/collections/${userId}/details`);
      return res.json();
    },
  });

  if (!enabled) return null;

  return (
    <div className="border-t border-blue-100 pt-2 mt-1">
      {isLoading ? (
        <p className="text-[10px] text-muted-foreground text-center py-2">Loading...</p>
      ) : !data || data.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-2">No payments yet.</p>
      ) : (
        <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
          {data.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-1.5 text-[10px] py-1 border-b border-slate-50 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate leading-tight">{item.studentName}</p>
                <p className="text-muted-foreground leading-tight">{item.batchName} · {item.month}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-emerald-600">+৳{item.amount.toLocaleString()}</p>
                <p className="text-muted-foreground">{format(new Date(item.date), "dd MMM")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {data && data.length > 0 && (
        <p className="text-[9px] text-muted-foreground text-right mt-1">{data.length} payment{data.length !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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

type ClearTarget = {
  userId: number;
  amount: number;
  name: string;
};

function CollectionSummaryPanel() {
  const { toast } = useToast();
  const [clearTarget, setClearTarget] = useState<ClearTarget | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTHS[new Date().getMonth()]);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  function toggleDetails(userId: number) {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  }

  const {
    data: collections = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<CollectionRow[]>({
    queryKey: ["/api/collections"],
  });

  const resetMutation = useMutation({
    mutationFn: ({ userId, month }: { userId: number; month: string }) =>
      apiRequest("POST", `/api/collections/${userId}/reset`, { month }),
    onSuccess: async (res, { userId }) => {
      const data = await res.json().catch(() => null);
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deposits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collections", userId, "details"] });
      setExpandedUserId(null);
      const depositAmount = data?.deposit?.amount;
      const depositMonth = data?.deposit?.month;
      toast({
        title: "Collection cleared",
        description: depositAmount
          ? `৳${depositAmount.toLocaleString()} recorded as income for ${depositMonth}.`
          : "Balance reset to ৳0.",
      });
      setClearTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
      setClearTarget(null);
    },
  });

  function handleClearClick(col: CollectionRow) {
    const displayName = col.user?.name || col.user?.username || `Teacher #${col.userId}`;
    setClearTarget({ userId: col.userId, amount: col.runningCollection, name: displayName });
    setSelectedMonth(MONTHS[new Date().getMonth()]);
  }

  function handleConfirmClear() {
    if (!clearTarget) return;
    resetMutation.mutate({ userId: clearTarget.userId, month: selectedMonth });
  }

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
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-6 text-center text-blue-400">
          <Banknote className="w-7 h-7 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No collection data yet</p>
          <p className="text-xs mt-1">Balances appear here as teachers record payments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 items-stretch">
          {collections.map((col) => {
            const displayName = col.user?.name || col.user?.username || `Teacher #${col.userId}`;
            return (
              <div
                key={col.userId}
                data-testid={`card-collection-${col.userId}`}
                className="rounded-xl border border-blue-100 bg-white shadow-sm p-3 flex flex-col justify-between gap-2 h-full"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-blue-700 font-black text-sm">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate text-xs leading-tight" data-testid={`text-teacher-name-${col.userId}`}>
                      {displayName}
                    </p>
                    {col.user?.teacherId && (
                      <p className="text-[10px] text-muted-foreground leading-tight">ID: {col.user.teacherId}</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-0.5">Pending Cash</p>
                  <p
                    className={`text-lg font-black leading-none ${col.runningCollection === 0 ? "text-muted-foreground" : "text-blue-600"}`}
                    data-testid={`text-collection-amount-${col.userId}`}
                  >
                    ৳{col.runningCollection.toLocaleString()}
                  </p>
                  {/* View Collected Payments toggle */}
                  <button
                    onClick={() => toggleDetails(col.userId)}
                    className="mt-1.5 flex items-center gap-0.5 text-[10px] font-semibold text-blue-500 hover:text-blue-700 transition-colors"
                    data-testid={`button-toggle-details-${col.userId}`}
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${expandedUserId === col.userId ? "rotate-180" : ""}`} />
                    {expandedUserId === col.userId ? "Hide" : "View Collected Payments"}
                  </button>
                </div>

                {/* Expandable payment list */}
                <TeacherPaymentDetails userId={col.userId} enabled={expandedUserId === col.userId} />

                <div className="flex items-center justify-between gap-1 pt-1 border-t border-border">
                  <p className="text-[10px] text-muted-foreground leading-tight truncate">
                    {col.lastResetAt
                      ? format(new Date(col.lastResetAt), "dd MMM, h:mm a")
                      : "Never cleared"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={col.runningCollection === 0 || resetMutation.isPending}
                    onClick={() => handleClearClick(col)}
                    data-testid={`button-reset-collection-${col.userId}`}
                    className="h-6 w-6 p-0 rounded-md border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 shrink-0"
                    title="Clear — record as income"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={clearTarget !== null} onOpenChange={(open) => { if (!open) setClearTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Collection & Record Income</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This will record <span className="font-bold text-foreground">৳{clearTarget?.amount.toLocaleString()}</span> collected by <span className="font-bold text-foreground">{clearTarget?.name}</span> as official income, and reset their pending balance to ৳0.
                </p>
                <div className="space-y-1.5">
                  <p className="font-semibold text-foreground">Select month for this income:</p>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full" data-testid="select-clear-month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClear}
              disabled={resetMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-confirm-clear"
            >
              {resetMutation.isPending ? "Recording..." : "Confirm & Record Income"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

      <MobileNav />
    </div>
  );
}
