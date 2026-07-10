import { useEffect, useState } from "react";
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
import StatusBadge from "@/components/shared/StatusBadge";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";

import { usePendingCount, useSyncLog, drainQueue } from "@/lib/offline/syncEngine";
import { offlineDB } from "@/lib/offline/db";
import { getDeadItems, discardDeadItem } from "@/lib/offline/syncQueue";
import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import type { SyncLogEntry, SyncQueueItem } from "@/lib/offline/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function entityLabel(entity: string) {
  return entity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusIcon({ status }: { status: SyncLogEntry["status"] }) {
  if (status === "success")  return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "failed")   return <XCircle className="h-4 w-4 text-destructive" />;
  return <AlertTriangle className="h-4 w-4 text-warning" />;
}

function statusBadge(status: SyncLogEntry["status"]) {
  if (status === "success")  return <StatusBadge status="success" label="Synced" />;
  if (status === "failed")   return <StatusBadge status="failed" label="Failed" />;
  return <StatusBadge status="conflict" label="Conflict" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SyncHistoryPage() {
  const { isOffline } = useOfflineStatus();
  const pending = usePendingCount();
  const log = useSyncLog(100);
  const [syncing, setSyncing] = useState(false);
  const [deadItems, setDeadItems] = useState<SyncQueueItem[]>([]);

  const lastSync = log.find((e) => e.status === "success");

  async function refreshDeadItems() {
    setDeadItems(await getDeadItems());
  }

  useEffect(() => {
    refreshDeadItems();
    const onChange = () => { refreshDeadItems(); };
    offlineDB.sync_queue.hook("creating", onChange);
    offlineDB.sync_queue.hook("updating", onChange);
    offlineDB.sync_queue.hook("deleting", onChange);
    return () => {
      offlineDB.sync_queue.hook("creating").unsubscribe(onChange);
      offlineDB.sync_queue.hook("updating").unsubscribe(onChange);
      offlineDB.sync_queue.hook("deleting").unsubscribe(onChange);
    };
  }, []);

  async function handleDiscardDeadItem(id?: number) {
    if (id == null) return;
    await discardDeadItem(id);
    toast.success("Discarded.");
  }

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
          valueClassName={isOffline ? "text-warning" : "text-success"}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Pending"
          value={String(pending)}
          valueClassName={pending > 0 ? "text-warning" : "text-muted-foreground"}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Synced"
          value={String(successCount)}
          valueClassName="text-success"
        />
        <StatCard
          icon={<XCircle className="h-4 w-4" />}
          label="Failed"
          value={String(failedCount + conflictCount)}
          valueClassName={failedCount + conflictCount > 0 ? "text-destructive" : "text-muted-foreground"}
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

      {/* Dead-letter items */}
      {deadItems.length > 0 && (
        <>
          <Separator />
          <div>
            <h2 className="text-sm font-semibold mb-3 text-destructive uppercase tracking-wide">
              Failed permanently ({deadItems.length})
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              These changes could not be synced after repeated attempts and were
              removed from the retry queue. Discard them or contact support if
              this data matters.
            </p>
            <div className="space-y-1">
              {deadItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-card px-4 py-3"
                >
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{entityLabel(item.entity)}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {item.operation}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDiscardDeadItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Discard
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Sync log */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Sync History
        </h2>

        {log.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No sync history yet"
            description="Items will appear here after changes are synced."
          />
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
                      <Badge variant="outline" className="text-xs text-warning">
                        server wins
                      </Badge>
                    )}
                  </div>
                  {entry.error && (
                    <p className="text-xs text-destructive mt-0.5 truncate">{entry.error}</p>
                  )}
                  {entry.status === "conflict" && !entry.error && (
                    <p className="text-xs text-warning mt-0.5">
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
