import { useEffect, useState } from "react";
import { getPendingItems, getPendingCount, dequeue, incrementRetry, purgeFailed } from "./syncQueue";
import type { SyncQueueItem } from "./db";
import { offlineDB } from "./db";

// ─── Handler registry ─────────────────────────────────────────────────────────
// Each key is `${entity}.${operation}`.
// Handlers receive the queued item and call the real service function.
// They're registered lazily to avoid circular imports at module level.

type Handler = (item: SyncQueueItem) => Promise<void>;
const handlers = new Map<string, Handler>();

export function registerHandler(entity: string, operation: string, fn: Handler) {
  handlers.set(`${entity}.${operation}`, fn);
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
      // No handler registered — skip but don't block other items
      console.warn(`[SyncEngine] No handler for ${key}`);
      continue;
    }

    try {
      await handler(item);
      await dequeue(item.id!);
    } catch (err) {
      console.error(`[SyncEngine] Failed to sync ${key}`, err);
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

  window.addEventListener("online", handleOnline);

  // Attempt a drain immediately in case we came back online between renders
  handleOnline();

  return () => {
    window.removeEventListener("online", handleOnline);
    engineStarted = false;
  };
}

// ─── React hook — reactive pending count ─────────────────────────────────────

export function usePendingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const n = await getPendingCount();
      if (!cancelled) setCount(n);
    }

    refresh();

    // Re-read count whenever the sync_queue table changes
    const subscription = offlineDB.sync_queue.hook("creating", () => {
      refresh();
    });
    const delSub = offlineDB.sync_queue.hook("deleting", () => {
      refresh();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      delSub.unsubscribe();
    };
  }, []);

  return count;
}
