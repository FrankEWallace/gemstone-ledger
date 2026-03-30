import { useEffect, useState } from "react";
import { getPendingItems, getPendingCount, dequeue, incrementRetry, purgeFailed } from "./syncQueue";
import type { SyncQueueItem, SyncLogEntry } from "./db";
import { offlineDB } from "./db";
import { supabase } from "@/lib/supabase";

// ─── Handler registry ─────────────────────────────────────────────────────────
// Each key is `${entity}.${operation}`.
// Handlers call the real service / Supabase directly and return on success.
// They throw on failure so the engine can retry.

type Handler = (item: SyncQueueItem) => Promise<void>;
const handlers = new Map<string, Handler>();

export function registerHandler(entity: string, operation: string, fn: Handler) {
  handlers.set(`${entity}.${operation}`, fn);
}

// ─── Conflict resolution ──────────────────────────────────────────────────────
// Strategy per entity:
//   - safety_incidents / transactions → SERVER_WINS (compliance-critical records)
//   - inventory_items / production_logs → CLIENT_WINS (last-write-wins)
//
// "Server wins" means: if the server record was modified AFTER we queued our
// mutation, we skip applying our local change and log it as a conflict.

const SERVER_WINS_ENTITIES = new Set(["safety_incidents", "transactions"]);

async function checkConflict(item: SyncQueueItem): Promise<boolean> {
  if (!SERVER_WINS_ENTITIES.has(item.entity)) return false;
  if (item.operation === "create") return false; // new records never conflict

  const payload = item.payload as { id?: string };
  if (!payload?.id || payload.id.startsWith("offline-")) return false;

  // Fetch the server record's updated_at (or created_at as fallback)
  const { data } = await supabase
    .from(item.entity)
    .select("updated_at, created_at")
    .eq("id", payload.id)
    .maybeSingle();

  if (!data) return false; // record deleted on server — let the operation proceed

  const serverTs = new Date(data.updated_at ?? data.created_at).getTime();
  return serverTs > item.timestamp;
}

// ─── Sync log helpers ─────────────────────────────────────────────────────────

async function logSync(
  item: SyncQueueItem,
  status: SyncLogEntry["status"],
  opts?: { error?: string; conflictResolution?: SyncLogEntry["conflictResolution"] }
): Promise<void> {
  await offlineDB.sync_log.add({
    entity: item.entity,
    operation: item.operation,
    status,
    error: opts?.error,
    conflictResolution: opts?.conflictResolution,
    syncedAt: Date.now(),
  });

  // Keep log bounded — keep only last 200 entries
  const count = await offlineDB.sync_log.count();
  if (count > 200) {
    const oldest = await offlineDB.sync_log.orderBy("syncedAt").limit(count - 200).toArray();
    await offlineDB.sync_log.bulkDelete(oldest.map((e) => e.id!));
  }
}

// ─── Drain ───────────────────────────────────────────────────────────────────

const MAX_RETRIES = 5;

export async function drainQueue(
  onProgress?: (remaining: number) => void
): Promise<void> {
  await purgeFailed(MAX_RETRIES);
  const items = await getPendingItems();

  for (const item of items) {
    const key = `${item.entity}.${item.operation}`;
    const handler = handlers.get(key);

    if (!handler) {
      console.warn(`[SyncEngine] No handler for ${key} — skipping`);
      continue;
    }

    // Conflict check for server-wins entities
    try {
      const hasConflict = await checkConflict(item);
      if (hasConflict) {
        console.warn(`[SyncEngine] Conflict on ${key} id=${(item.payload as any)?.id} — server wins, discarding local change`);
        await logSync(item, "conflict", { conflictResolution: "server_wins" });
        await dequeue(item.id!);
        continue;
      }
    } catch {
      // If conflict check itself fails (e.g. offline), stop draining
      break;
    }

    try {
      await handler(item);
      await logSync(item, "success");
      await dequeue(item.id!);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[SyncEngine] Failed to sync ${key}:`, message);
      await logSync(item, "failed", { error: message });
      await incrementRetry(item.id!);
    }

    const remaining = await getPendingCount();
    onProgress?.(remaining);
  }
}

// ─── Init (call once at app startup) ─────────────────────────────────────────

let engineStarted = false;

export function initSyncEngine(): () => void {
  if (engineStarted) return () => {};
  engineStarted = true;

  async function handleOnline() {
    if (!navigator.onLine) return;
    const count = await getPendingCount();
    if (count === 0) return;
    console.info(`[SyncEngine] Online — draining ${count} queued mutation(s)`);
    await drainQueue();
  }

  // Listen for service worker Background Sync messages
  // SW fires SW_SYNC_REQUESTED when the browser wakes it up via the sync event
  function handleSwMessage(event: MessageEvent) {
    if (event.data?.type === "SW_SYNC_REQUESTED") {
      console.info("[SyncEngine] SW_SYNC_REQUESTED received — draining queue");
      drainQueue();
    }
  }

  window.addEventListener("online", handleOnline);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", handleSwMessage);
  }

  // Drain immediately in case we came back online between renders
  handleOnline();

  return () => {
    window.removeEventListener("online", handleOnline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    }
    engineStarted = false;
  };
}

// ─── React hooks ─────────────────────────────────────────────────────────────

export function usePendingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const n = await getPendingCount();
      if (!cancelled) setCount(n);
    }

    refresh();

    const addSub = offlineDB.sync_queue.hook("creating", () => { refresh(); });
    const delSub = offlineDB.sync_queue.hook("deleting", () => { refresh(); });

    return () => {
      cancelled = true;
      addSub.unsubscribe();
      delSub.unsubscribe();
    };
  }, []);

  return count;
}

export function useSyncLog(limit = 50): SyncLogEntry[] {
  const [entries, setEntries] = useState<SyncLogEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const rows = await offlineDB.sync_log
        .orderBy("syncedAt")
        .reverse()
        .limit(limit)
        .toArray();
      if (!cancelled) setEntries(rows);
    }

    refresh();

    const addSub = offlineDB.sync_log.hook("creating", () => { refresh(); });
    const delSub = offlineDB.sync_log.hook("deleting", () => { refresh(); });

    return () => {
      cancelled = true;
      addSub.unsubscribe();
      delSub.unsubscribe();
    };
  }, [limit]);

  return entries;
}
