import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { offlineDB } from "./db";

/**
 * Wraps Dexie's kv_store as an AsyncStorage interface so that
 * React Query's persist-client can serialise its entire cache
 * into IndexedDB and rehydrate it on the next page load.
 *
 * The entire React Query cache is stored under a single key
 * ("rq-cache") as a JSON string — same approach as localStorage
 * but without the 5 MB size cap.
 */
const dexieAsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const entry = await offlineDB.kv_store.get(key);
    return entry?.value ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await offlineDB.kv_store.put({ key, value });
  },
  removeItem: async (key: string): Promise<void> => {
    await offlineDB.kv_store.delete(key);
  },
};

export const queryPersister = createAsyncStoragePersister({
  storage: dexieAsyncStorage,
  key: "rq-cache",
  // Throttle writes to IndexedDB — avoids hammering the DB on
  // every background refetch. Cache is written at most every 1 s.
  throttleTime: 1000,
});
