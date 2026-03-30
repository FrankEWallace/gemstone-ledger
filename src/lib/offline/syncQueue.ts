import { offlineDB, type SyncQueueItem } from "./db";

/**
 * Push a mutation to the offline sync queue.
 * Also registers the Background Sync tag so the browser can trigger a sync
 * event in the service worker even when the tab is backgrounded or closed.
 */
export async function enqueue(
  item: Omit<SyncQueueItem, "id" | "retries">
): Promise<number> {
  const id = await offlineDB.sync_queue.add({ ...item, retries: 0 });

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

/** All items not yet synced, ordered oldest-first. */
export async function getPendingItems(): Promise<SyncQueueItem[]> {
  return offlineDB.sync_queue.orderBy("timestamp").toArray();
}

/** Count of items waiting to be synced. */
export async function getPendingCount(): Promise<number> {
  return offlineDB.sync_queue.count();
}

/** Remove items that have exceeded the max retry limit. */
export async function purgeFailed(maxRetries = 5): Promise<void> {
  await offlineDB.sync_queue.where("retries").aboveOrEqual(maxRetries).delete();
}
