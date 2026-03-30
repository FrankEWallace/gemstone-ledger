import { useState } from "react";
import { format } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Trash2,
  WifiOff,
  Clock,
  Database,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { usePendingCount, useSyncLog, drainQueue } from "@/lib/offline/syncEngine";
import { offlineDB } from "@/lib/offline/db";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import type { SyncLogEntry } from "@/lib/offline/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function entityLabel(entity: string) {
  return entity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusIcon({ status }: { status: SyncLogEntry["status"] }) {
  if (status === "success")  return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "failed")   return <XCircle className="h-4 w-4 text-red-500" />;
  return <AlertTriangle className="h-4 w-4 text-amber-500" />;
}

function statusBadge(status: SyncLogEntry["status"]) {
  if (status === "success")  return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Synced</Badge>;
  if (status === "failed")   return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Failed</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Conflict</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SyncHistoryPage() {
  const { isOffline } = useOfflineStatus();
  const pending = usePendingCount();
  const log = useSyncLog(100);
  const [syncing, setSyncing] = useState(false);

  const lastSync = log.find((e) => e.status === "success");

  async function handleManualSync() {
    if (isOffline) {
      toast.error("You're offline. Connect to a network first.");
      return;
    }
    setSyncing(true);
    try {
      await drainQueue();
      toast.success("Sync complete.");
    } catch {
      toast.error("Sync failed — check your connection and try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleClearLog() {
    await offlineDB.sync_log.clear();
    toast.success("Sync history cleared.");
  }

  const successCount  = log.filter((e) => e.status === "success").length;
  const failedCount   = log.filter((e) => e.status === "failed").length;
  const conflictCount = log.filter((e) => e.status === "conflict").length;

  return (
    <div className="p-4 lg:p-6 max-w-3xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Offline Sync</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track changes made offline and their sync status.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={isOffline ? <WifiOff className="h-4 w-4" /> : <Database className="h-4 w-4" />}
          label="Status"
          value={isOffline ? "Offline" : "Online"}
          color={isOffline ? "text-amber-600" : "text-green-600"}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pending"
          value={String(pending)}
          color={pending > 0 ? "text-amber-600" : "text-muted-foreground"}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Synced"
          value={String(successCount)}
          color="text-green-600"
        />
        <StatCard
          icon={<XCircle className="h-4 w-4" />}
          label="Failed"
          value={String(failedCount + conflictCount)}
          color={failedCount + conflictCount > 0 ? "text-red-600" : "text-muted-foreground"}
        />
      </div>

      {/* Last sync */}
      {lastSync && (
        <p className="text-xs text-muted-foreground">
          Last successful sync:{" "}
          <span className="font-medium text-foreground">
            {format(new Date(lastSync.syncedAt), "d MMM yyyy, HH:mm:ss")}
          </span>
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={handleManualSync}
          disabled={syncing || isOffline || pending === 0}
          size="sm"
        >
          {syncing ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {syncing ? "Syncing…" : `Sync now${pending > 0 ? ` (${pending})` : ""}`}
        </Button>

        {log.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleClearLog}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear history
          </Button>
        )}
      </div>

      <Separator />

      {/* Sync log */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Sync History
        </h2>

        {log.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Database className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm">No sync history yet.</p>
            <p className="text-xs mt-1">Items will appear here after changes are synced.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <StatusIcon status={entry.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {entityLabel(entry.entity)}
                    </span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {entry.operation}
                    </Badge>
                    {statusBadge(entry.status)}
                    {entry.conflictResolution && (
                      <Badge variant="outline" className="text-xs text-amber-600">
                        server wins
                      </Badge>
                    )}
                  </div>
                  {entry.error && (
                    <p className="text-xs text-red-500 mt-0.5 truncate">{entry.error}</p>
                  )}
                  {entry.status === "conflict" && !entry.error && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Server record was modified — local change discarded to preserve data integrity.
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {format(new Date(entry.syncedAt), "HH:mm:ss")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1">
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground`}>
        {icon}
        {label}
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
