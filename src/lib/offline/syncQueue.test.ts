import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { offlineDB } from "./db";
import {
  enqueue,
  dequeue,
  incrementRetry,
  getPendingItems,
  getPendingCount,
  purgeFailed,
} from "./syncQueue";

const baseItem = {
  entity: "transactions",
  operation: "create" as const,
  payload: { foo: "bar" },
  siteId: "site-1",
};

describe("offline sync queue", () => {
  beforeEach(async () => {
    await offlineDB.sync_queue.clear();
  });

  it("enqueue adds an item with retries=0 and returns its id", async () => {
    const id = await enqueue({ ...baseItem, timestamp: 1000 });
    expect(typeof id).toBe("number");

    const items = await getPendingItems();
    expect(items).toHaveLength(1);
    expect(items[0].retries).toBe(0);
    expect(items[0].entity).toBe("transactions");
  });

  it("getPendingCount reflects the number queued", async () => {
    expect(await getPendingCount()).toBe(0);
    await enqueue({ ...baseItem, timestamp: 1 });
    await enqueue({ ...baseItem, timestamp: 2 });
    expect(await getPendingCount()).toBe(2);
  });

  it("getPendingItems returns items oldest-first by timestamp", async () => {
    await enqueue({ ...baseItem, timestamp: 300 });
    await enqueue({ ...baseItem, timestamp: 100 });
    await enqueue({ ...baseItem, timestamp: 200 });

    const items = await getPendingItems();
    expect(items.map((i) => i.timestamp)).toEqual([100, 200, 300]);
  });

  it("dequeue removes a synced item", async () => {
    const id = await enqueue({ ...baseItem, timestamp: 1 });
    await dequeue(id);
    expect(await getPendingCount()).toBe(0);
  });

  it("incrementRetry bumps the retry counter", async () => {
    const id = await enqueue({ ...baseItem, timestamp: 1 });
    await incrementRetry(id);
    await incrementRetry(id);

    const item = await offlineDB.sync_queue.get(id);
    expect(item?.retries).toBe(2);
  });

  it("purgeFailed removes only items at or above the retry limit", async () => {
    const keep = await enqueue({ ...baseItem, timestamp: 1 });
    const drop = await enqueue({ ...baseItem, timestamp: 2 });

    // Push `drop` to 5 retries, `keep` stays at 1.
    await incrementRetry(keep);
    for (let i = 0; i < 5; i++) await incrementRetry(drop);

    await purgeFailed(5);

    const remaining = await getPendingItems();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(keep);
  });
});
