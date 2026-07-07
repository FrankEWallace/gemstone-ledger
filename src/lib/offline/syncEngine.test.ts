import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { offlineDB } from "./db";
import { enqueue, getPendingItems, getPendingCount } from "./syncQueue";

// The engine only touches supabase inside checkConflict (SERVER_WINS_ENTITIES).
// Most tests below register their own fake handlers via registerHandler and
// never exercise the mock; the conflict tests configure it explicitly.
const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn((_table: unknown) => ({ select: selectMock }));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: (arg: unknown) => fromMock(arg) },
}));

// Import after the mock is registered so the engine picks up the mocked client.
import { registerHandler, drainQueue } from "./syncEngine";

const baseItem = {
  entity: "inventory_items",
  operation: "create" as const,
  payload: { foo: "bar" },
  siteId: "site-1",
};

describe("sync engine drain", () => {
  beforeEach(async () => {
    await offlineDB.sync_queue.clear();
    await offlineDB.sync_log.clear();
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
  });

  it("drains items through registered handlers and dequeues on success", async () => {
    const calls: unknown[] = [];
    registerHandler("inventory_items", "create", async (item) => {
      calls.push(item.payload);
    });

    await enqueue({ ...baseItem, timestamp: 1 });
    await drainQueue();

    expect(calls).toHaveLength(1);
    expect(await getPendingCount()).toBe(0);

    const log = await offlineDB.sync_log.toArray();
    expect(log.some((e) => e.status === "success")).toBe(true);
  });

  it("records failed and increments retry when a handler throws", async () => {
    registerHandler("transactions", "create", async () => {
      throw new Error("boom");
    });

    const id = await enqueue({ ...baseItem, entity: "transactions", timestamp: 1 });
    await drainQueue();

    const item = await offlineDB.sync_queue.get(id);
    expect(item?.retries).toBe(1);

    const log = await offlineDB.sync_log.toArray();
    expect(log.some((e) => e.status === "failed" && e.error === "boom")).toBe(true);
  });

  it("a handler that throws does not stop later items from draining", async () => {
    const secondCalls: unknown[] = [];
    registerHandler("safety_incidents", "create", async () => {
      throw new Error("first fails");
    });
    registerHandler("equipment_test_entity", "create", async (item) => {
      secondCalls.push(item.payload);
    });

    await enqueue({ ...baseItem, entity: "safety_incidents", timestamp: 1 });
    await enqueue({ ...baseItem, entity: "equipment_test_entity", timestamp: 2 });

    await drainQueue();

    expect(secondCalls).toHaveLength(1);
    expect(await getPendingCount()).toBe(1); // only the failed item remains queued
  });

  it("exercises the Step 2 error-checking pattern against a mocked supabase client", async () => {
    // Register a handler in the same shape as the real service handlers:
    // it awaits supabase.from(...) and must throw when { error } is set.
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: { message: "rls denied" } });
    fromMock.mockReturnValueOnce({ insert: insertMock } as unknown as ReturnType<typeof fromMock>);

    const { supabase } = await import("@/lib/supabase");
    registerHandler("mocked_entity", "create", async (item) => {
      const { error } = await supabase.from(item.entity as never).insert(item.payload as never);
      if (error) throw error;
    });

    const id = await enqueue({ ...baseItem, entity: "mocked_entity", timestamp: 1 });
    await drainQueue();

    const item = await offlineDB.sync_queue.get(id);
    expect(item?.retries).toBe(1);
  });

  it("concurrent drainQueue calls do not double-replay", async () => {
    const invocations: number[] = [];
    let releaseAll: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseAll = resolve;
    });

    registerHandler("concurrency_entity", "create", async (item) => {
      await gate;
      invocations.push((item.payload as { n: number }).n);
    });

    await enqueue({ ...baseItem, entity: "concurrency_entity", timestamp: 1, payload: { n: 1 } });
    await enqueue({ ...baseItem, entity: "concurrency_entity", timestamp: 2, payload: { n: 2 } });
    await enqueue({ ...baseItem, entity: "concurrency_entity", timestamp: 3, payload: { n: 3 } });

    const drain1 = drainQueue();
    const drain2 = drainQueue();

    releaseAll!();
    await Promise.all([drain1, drain2]);

    expect(invocations.sort()).toEqual([1, 2, 3]);
    expect(await getPendingCount()).toBe(0);
  });

  it("conflict-check failure skips the item but continues the drain", async () => {
    maybeSingleMock.mockRejectedValue(new Error("network down"));

    const calls: unknown[] = [];
    registerHandler("transactions", "create", async (item) => {
      calls.push(item.payload);
    });
    // transactions is a SERVER_WINS entity; use "update" so checkConflict
    // actually performs the network read (create ops never conflict-check).
    registerHandler("transactions", "update", async (item) => {
      calls.push(item.payload);
    });
    registerHandler("inventory_items", "create", async (item) => {
      calls.push(item.payload);
    });

    await enqueue({
      ...baseItem,
      entity: "transactions",
      operation: "update",
      timestamp: 1,
      payload: { id: "server-record-1" },
    });
    await enqueue({ ...baseItem, entity: "inventory_items", timestamp: 2 });

    await drainQueue();

    // The transactions/update item's conflict check failed, so it should be
    // skipped (left queued, retries untouched) while the inventory item still drains.
    expect(calls).toHaveLength(1);
    const remaining = await getPendingItems();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].entity).toBe("transactions");
    expect(remaining[0].retries).toBe(0);
  });
});
