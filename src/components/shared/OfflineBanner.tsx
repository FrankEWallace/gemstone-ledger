import { WifiOff } from "lucide-react";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";

export function OfflineBanner() {
  const { isOffline } = useOfflineStatus();

  if (!isOffline) return null;

  return (
    <div className="flex items-center gap-2 bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium w-full">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline — showing cached data. Changes will sync when reconnected.</span>
    </div>
  );
}
