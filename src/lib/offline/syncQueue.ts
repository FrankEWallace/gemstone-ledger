import { offlineDB, type SyncQueueItem } from "./db";

/**
 * Push a mutation to the offline sync queue.
 * Also registers the Background Sync tag so the browser can trigger a sync
 * event in the service worker even when the tab is backgrounded or closed.
 */
export async function enqueue(
  item: Omit<SyncQueueItem, "id" | "retries">
): Promise<number> {
  const id = await offlineDB.sync_queue.add({ ...item, retries: 0, status: "pending" });

  // Register Background Sync tag — browser will fire SW sync event when online
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if ("sync" in registration) {
        await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } })
          .sync.register("fw-mining-sync");
      }
    } catch {
      // Background Sync not supported on this browser — gracefully ignored;
      // the window.online listener in syncEngine will handle it instead.
    }
  }

  return id;
}

/** Remove a successfully synced item from the queue. */
export async function dequeue(id: number): Promise<void> {
  await offlineDB.sync_queue.delete(id);
}

/** Increment retry counter for a failed sync attempt. */
export async function incrementRetry(id: number): Promise<void> {
  await offlineDB.sync_queue
    .where("id")
    .equals(id)
    .modify((item) => {
      item.retries += 1;
    });
}

/** All items not yet synced (excluding dead-lettered ones), ordered oldest-first. */
export async function getPendingItems(): Promise<SyncQueueItem[]> {
  const items = await offlineDB.sync_queue.orderBy("timestamp").toArray();
  return items.filter((item) => item.status !== "dead");
}

/** Count of items still waiting to be synced (excluding dead-lettered ones). */
export async function getPendingCount(): Promise<number> {
  // Existing rows from before the `status` field was introduced won't have
  // it set at all, and IndexedDB does not index undefined key paths — a
  // `.where("status")` query would silently miss them. Filter in-memory
  // instead so both old and new rows are counted correctly.
  const items = await offlineDB.sync_queue.toArray();
  return items.filter((item) => item.status !== "dead").length;
}

/** All items that have been moved to the dead-letter state. */
export async function getDeadItems(): Promise<SyncQueueItem[]> {
  const items = await offlineDB.sync_queue.toArray();
  return items.filter((item) => item.status === "dead");
}

/**
 * Move items that have exceeded the max retry limit into a visible
 * dead-letter state instead of silently deleting them, and record a
 * sync_log entry for each one so SyncHistoryPage can surface it.
 */
export async function purgeFailed(maxRetries = 5): Promise<void> {
  // `retries` is not part of the Dexie index, so filter in-memory rather than
  // using .where() (which throws SchemaError on an unindexed keyPath).
  const exhausted = await offlineDB.sync_queue
    .filter((item) => item.status !== "dead" && item.retries >= maxRetries)
    .toArray();

  if (exhausted.length === 0) return;

  await offlineDB.sync_queue
    .where("id")
    .anyOf(exhausted.map((item) => item.id!))
    .modify((item) => {
      item.status = "dead";
    });

  await offlineDB.sync_log.bulkAdd(
    exhausted.map((item) => ({
      entity: item.entity,
      operation: item.operation,
      status: "failed" as const,
      error: "exceeded max retries — moved to dead letter",
      syncedAt: Date.now(),
    }))
  );
}

/** Permanently discard a dead-lettered item (explicit user action). */
export async function discardDeadItem(id: number): Promise<void> {
  await offlineDB.sync_queue.delete(id);
}
