import { WifiOff, RefreshCw, CloudUpload } from "lucide-react";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { cn } from "@/lib/utils";

export function NetworkStatus() {
  const { isOnline, isSyncing, pendingCount, sync } = useOfflineSync();

  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  if (!isOnline) {
    return (
      <div
        data-testid="badge-offline"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold select-none"
      >
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>Offline</span>
        {pendingCount > 0 && (
          <span className="bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div
        data-testid="badge-syncing"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold select-none"
      >
        <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
        <span>Syncing…</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <button
        data-testid="badge-pending-sync"
        onClick={sync}
        title="Tap to sync pending records"
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold select-none transition-colors",
          "bg-amber-100 text-amber-700 hover:bg-amber-200 active:bg-amber-300"
        )}
      >
        <CloudUpload className="w-3.5 h-3.5 shrink-0" />
        <span>{pendingCount} pending</span>
      </button>
    );
  }

  return null;
}
