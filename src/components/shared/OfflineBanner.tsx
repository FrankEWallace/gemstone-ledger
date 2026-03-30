import { WifiOff, RefreshCw } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { usePendingCount } from "@/lib/offline/syncEngine";

export function OfflineBanner() {
  const { isOffline } = useOfflineStatus();
  const pending = usePendingCount();

  // Show banner when offline, OR when online but still has pending items syncing
  const visible = isOffline || pending > 0;
  if (!visible) return null;

  if (!isOffline && pending > 0) {
    // Back online — syncing in progress
    return (
      <div className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 text-sm font-medium w-full">
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
        <span>Syncing {pending} pending change{pending !== 1 ? "s" : ""}…</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium w-full">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        You're offline — showing cached data.
        {pending > 0
          ? ` ${pending} change${pending !== 1 ? "s" : ""} will sync when reconnected.`
          : " Changes will sync when reconnected."}
      </span>
    </div>
  );
}
