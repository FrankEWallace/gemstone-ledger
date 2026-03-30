import { offlineDB, type SyncQueueItem } from "./db";

/**
 * Push a mutation to the offline sync queue.
 * Called by service functions when navigator.onLine is false.
 */
export async function enqueue(
  item: Omit<SyncQueueItem, "id" | "retries">
): Promise<number> {
  return offlineDB.sync_queue.add({ ...item, retries: 0 });
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
