import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPendingActions,
  removePendingAction,
  getPendingCount,
  saveOfflineAction,
  type OfflineActionType,
} from "@/lib/offline-db";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

let _syncListeners: Array<() => void> = [];

export function notifyPendingChanged() {
  _syncListeners.forEach((fn) => fn());
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { toast } = useToast();
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshCount();

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    _syncListeners.push(refreshCount);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      _syncListeners = _syncListeners.filter((fn) => fn !== refreshCount);
    };
  }, [refreshCount]);

  const sync = useCallback(async () => {
    if (syncingRef.current) return;
    const pending = await getPendingActions();
    if (pending.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);

    let succeeded = 0;
    let failed = 0;

    for (const action of pending) {
      try {
        const res = await fetch(action.url, {
          method: action.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
          credentials: "include",
        });
        if (res.ok) {
          await removePendingAction(action.id);
          succeeded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    syncingRef.current = false;
    setIsSyncing(false);
    await refreshCount();

    queryClient.invalidateQueries({ queryKey: ["/api/incomes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/results"] });
    queryClient.invalidateQueries({ queryKey: ["/api/collections/me"] });

    if (succeeded > 0) {
      toast({
        title: `Sync complete`,
        description: `${succeeded} offline record${succeeded !== 1 ? "s" : ""} uploaded successfully.`,
      });
    }
    if (failed > 0) {
      toast({
        variant: "destructive",
        title: "Sync partially failed",
        description: `${failed} record${failed !== 1 ? "s" : ""} could not be synced. Will retry when online.`,
      });
    }
  }, [refreshCount, toast]);

  useEffect(() => {
    if (isOnline) {
      sync();
    }
  }, [isOnline, sync]);

  return { isOnline, isSyncing, pendingCount, sync, refreshCount };
}

export async function saveForOffline(opts: {
  type: OfflineActionType;
  url: string;
  method: string;
  payload: unknown;
  label: string;
}) {
  await saveOfflineAction(opts);
  notifyPendingChanged();
}
