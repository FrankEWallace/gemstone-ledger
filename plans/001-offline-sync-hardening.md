# Plan 001: Make the offline sync engine report failures truthfully and drain safely

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 0e0bf99..HEAD -- src/lib/offline src/services/inventory.service.ts src/services/transactions.service.ts src/services/safety.service.ts src/services/production.service.ts src/pages/settings/SyncHistoryPage.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `0e0bf99`, 2026-07-07

## Why this matters

This app is a PWA for mining sites with poor connectivity. Mutations made
offline are queued in IndexedDB (Dexie) and replayed by a sync engine when the
device reconnects. Today the replay path has four defects that combine into
silent, permanent loss of user data — including financial transactions:

1. Replay handlers ignore the `{ error }` result that supabase-js returns
   (supabase-js **resolves, it does not throw**, on RLS denials, constraint
   violations, and other PostgREST errors). A server-rejected replay is
   therefore logged as `"success"` and deleted from the queue.
2. `drainQueue` has no concurrency guard, and four independent triggers can
   start overlapping drains that replay the same items twice.
3. Any error thrown by the per-item conflict check aborts the entire drain
   (`break`), stalling every later item in the queue.
4. Items that fail 5 times are permanently deleted (`purgeFailed`) with no
   user-facing trace.

After this plan lands: server rejections are recorded as failures and retried,
only one drain runs at a time, one flaky item no longer blocks the queue tail,
exhausted items go to a visible dead-letter state instead of vanishing, and all
of this is pinned by unit tests.

## Current state

Relevant files:

- `src/lib/offline/syncEngine.ts` — the drain loop, conflict check, handler
  registry, and `initSyncEngine` triggers. **Main file to change.**
- `src/lib/offline/syncQueue.ts` — Dexie queue helpers (`enqueue`, `dequeue`,
  `incrementRetry`, `getPendingItems`, `purgeFailed`).
- `src/lib/offline/db.ts` — Dexie schema; `SyncQueueItem` has
  `{ id?, entity, operation, payload, siteId, timestamp, retries }`.
- `src/lib/offline/syncQueue.test.ts` — existing Vitest suite for the queue
  helpers; **use as the structural pattern for new tests**.
- Handler registration sites (each service registers replay handlers at module
  load):
  - `src/services/inventory.service.ts:92-102` (create/update/delete)
  - `src/services/transactions.service.ts:152-162` (create/update/delete)
  - `src/services/safety.service.ts:129-140` (create/update/delete)
  - `src/services/production.service.ts:88-105` (create upsert / delete; has
    `isRestActive()` branches)
- `src/pages/settings/SyncHistoryPage.tsx:52-66` — manual "sync now" button
  calling `drainQueue()`.

### Defect 1 — handlers swallow Supabase errors

`syncEngine.ts:8-11` documents the contract the handlers violate:

```ts
// Handlers call the real service / Supabase directly and return on success.
// They throw on failure so the engine can retry.
```

But every handler looks like this (`src/services/inventory.service.ts:92-94`):

```ts
registerHandler("inventory_items", "create", async (item) => {
  await supabase.from("inventory_items").insert(item.payload as TablesInsert<"inventory_items">);
});
```

`supabase.from(...).insert(...)` resolves with `{ data, error }` — it never
throws on a server rejection. The engine then runs (`syncEngine.ts:110-113`):

```ts
try {
  await handler(item);
  await logSync(item, "success");
  await dequeue(item.id!);
}
```

Contrast with the non-handler service functions in the same files, which do
check errors — e.g. `transactions.service.ts` `createTransaction`:

```ts
const { data, error } = await supabase.from("transactions").insert(fullPayload).select().single();
if (error) throw error;
```

Match that convention inside the handlers.

### Defect 2 — no drain mutex

`drainQueue` (`syncEngine.ts:81-124`) can be started concurrently from four
places: the `online` listener, the service-worker `SW_SYNC_REQUESTED` message,
the startup call `handleOnline()` inside `initSyncEngine` (`syncEngine.ts:158`),
and the manual button in `SyncHistoryPage.tsx`. There is no lock; each call
snapshots `getPendingItems()` and replays it.

### Defect 3 — conflict-check failure aborts the whole drain

`syncEngine.ts:96-108`:

```ts
try {
  const hasConflict = await checkConflict(item);
  ...
} catch {
  // If conflict check itself fails (e.g. offline), stop draining
  break;
}
```

`checkConflict` only does network work for `safety_incidents` and
`transactions` (`SERVER_WINS_ENTITIES`, `syncEngine.ts:28`). One transient
failure there kills the drain for every remaining item of every entity.
Preserve the intent (if we're offline, stop) but don't let a single flaky
read stall unrelated items: skip the item (leave it queued, do NOT increment
its retry count — a conflict-check failure is not a replay failure) and
continue; only stop the loop when `!navigator.onLine`.

### Defect 4 — purge is a silent black hole

`syncQueue.ts:56-60`:

```ts
export async function purgeFailed(maxRetries = 5): Promise<void> {
  await offlineDB.sync_queue.filter((item) => item.retries >= maxRetries).delete();
}
```

Called at the top of every drain (`syncEngine.ts:84`). Replace deletion with a
dead-letter status plus a `sync_log` entry so `SyncHistoryPage` can show it.

Note on the Dexie comment in `purgeFailed`: `retries` is not indexed, hence
`.filter()` not `.where()`. Keep that constraint in mind for any query you add,
or add the index via a Dexie schema version bump (see `db.ts` for the current
`.version(N).stores({...})` declaration — find it before deciding).

### Repo conventions

- TypeScript strict-ish; no `any` unless the surrounding code already does it.
- Services check `{ error }` and `throw error` (see excerpt above). Match it.
- Tests: Vitest with `fake-indexeddb/auto` imported first — see
  `src/lib/offline/syncQueue.test.ts:1-23` for the setup pattern
  (`beforeEach` clears the Dexie table).
- Console logging uses `[SyncEngine]`-prefixed messages; keep that style.
- No emoji anywhere in code, commits, or PR text.

## Commands you will need

| Purpose   | Command                                        | Expected on success |
|-----------|------------------------------------------------|---------------------|
| Install   | `npm ci`                                       | exit 0              |
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit`        | exit 0, no output   |
| All tests | `npm run test`                                 | all pass            |
| One file  | `npx vitest run src/lib/offline/syncEngine.test.ts` | all pass       |
| Lint      | `npm run lint`                                 | exit 0 (11 pre-existing warnings are OK; 0 errors) |
| Build     | `npm run build`                                | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `src/lib/offline/syncEngine.ts`
- `src/lib/offline/syncQueue.ts`
- `src/lib/offline/db.ts` (only if you add a `status` field / index — schema
  version bump)
- `src/lib/offline/syncEngine.test.ts` (create)
- `src/lib/offline/syncQueue.test.ts` (extend only)
- `src/services/inventory.service.ts`, `src/services/transactions.service.ts`,
  `src/services/safety.service.ts`, `src/services/production.service.ts` —
  **only the `registerHandler` blocks**
- `src/pages/settings/SyncHistoryPage.tsx` — only to surface dead-letter items

**Out of scope** (do NOT touch, even though they look related):

- Replay idempotency / client-generated IDs — that is `plans/004-*.md`.
- The `isRestActive()` / demo-mode branches in the services.
- `src/sw.ts` (service worker) and `src/lib/offline/persister.ts`.
- Conflict-resolution *strategy* (SERVER_WINS list stays as-is).
- Anything under `src/components/ui/`.

## Git workflow

- Branch: `advisor/001-offline-sync-hardening` (branch from `main`).
- Commit style: short imperative sentences, no emoji, no scopes — e.g.
  "Make sync handlers surface Supabase errors" (match `git log --oneline`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Characterization tests for the current engine (write first, they pin behavior)

Create `src/lib/offline/syncEngine.test.ts`. Model setup on
`syncQueue.test.ts` (import `"fake-indexeddb/auto"` first, clear
`offlineDB.sync_queue` and `offlineDB.sync_log` in `beforeEach`).

Mock supabase at the module boundary:
`vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn() } }))` — the
engine imports `supabase` only inside `checkConflict`, and the tests below
should register their own fake handlers via `registerHandler`, so most tests
never hit the mock. For conflict tests, make `from().select().eq().maybeSingle()`
return a controllable value (build a chainable stub).

Tests to write (names indicative):

1. `drains items through registered handlers and dequeues on success`
2. `records failed and increments retry when a handler throws`
3. `a handler that throws does not stop later items from draining` (register
   two entities; first handler throws, second must still run)
4. `concurrent drainQueue calls do not double-replay` — enqueue 3 items with a
   handler that records invocations and awaits a deferred promise; call
   `drainQueue()` twice without awaiting the first; resolve; assert each item
   replayed exactly once. **This test FAILS before Step 3 — write it, confirm
   it fails, then let Step 3 make it pass.** (For the pre-fix commit, mark it
   `it.fails(...)` and flip to `it(...)` in Step 3.)
5. `conflict-check failure skips the item but continues the drain` — same
   pattern: expect current behavior to differ, use `it.fails` until Step 4.

**Verify**: `npx vitest run src/lib/offline/syncEngine.test.ts` → tests 1-2-3
pass; 4-5 pass as `it.fails`.

### Step 2: Make every replay handler throw on Supabase error

In each `registerHandler` callback listed in "Current state", capture and
throw the error. Pattern:

```ts
registerHandler("inventory_items", "create", async (item) => {
  const { error } = await supabase.from("inventory_items").insert(item.payload as TablesInsert<"inventory_items">);
  if (error) throw error;
});
```

Apply to all 11 handlers: 3 in `inventory.service.ts`, 3 in
`transactions.service.ts`, 3 in `safety.service.ts`, 2 in
`production.service.ts` (for production's `isRestActive()` branches, leave the
REST calls as they are — only the supabase calls need the `{ error }` check).

**Verify**:
`grep -n "registerHandler" -A4 src/services/*.service.ts | grep -c "if (error) throw error"` → `11`,
then `npx tsc -p tsconfig.app.json --noEmit` → exit 0.

### Step 3: Serialize drainQueue

In `syncEngine.ts`, add a module-level in-flight guard so a second caller gets
the same promise instead of a second loop:

```ts
let drainInFlight: Promise<void> | null = null;

export function drainQueue(onProgress?: (remaining: number) => void): Promise<void> {
  if (drainInFlight) return drainInFlight;
  drainInFlight = doDrain(onProgress).finally(() => { drainInFlight = null; });
  return drainInFlight;
}
```

Rename the existing function body to `async function doDrain(...)`. Keep the
exported signature identical (callers in `SyncHistoryPage.tsx` and
`initSyncEngine` must not need changes).

**Verify**: flip test 4 from `it.fails` to `it`;
`npx vitest run src/lib/offline/syncEngine.test.ts` → all pass.

### Step 4: Stop aborting the drain on conflict-check failure

Replace the `catch { break; }` at `syncEngine.ts:105-108` with logic that:

- if `!navigator.onLine`, `break` (genuinely offline — stop);
- otherwise `console.warn` with the `[SyncEngine]` prefix and `continue`
  (item stays queued, retry count untouched).

**Verify**: flip test 5 to `it`; run the file → all pass.

### Step 5: Dead-letter instead of silent purge

1. In `db.ts`, bump the Dexie schema version and add `status` to the
   `sync_queue` store's indexed fields (follow the existing
   `.version(N).stores({...})` chain — add version N+1; Dexie migrates
   automatically). Add `status?: "pending" | "dead"` to `SyncQueueItem`.
2. Change `purgeFailed` in `syncQueue.ts` to mark matching items
   `status: "dead"` (via `.modify()`) instead of `.delete()`, and write a
   `sync_log` entry per newly-dead item with status `"failed"` and error
   `"exceeded max retries — moved to dead letter"`. (`logSync` lives in
   `syncEngine.ts` and takes the item; either export it or write the log entry
   inline with `offlineDB.sync_log.add` matching its shape at
   `syncEngine.ts:60-67`.)
3. Update `getPendingItems`/`getPendingCount` to exclude `status === "dead"`
   (remember: unindexed fields need `.filter()`, indexed ones can use
   `.where()`).
4. In `SyncHistoryPage.tsx`, surface dead items: a count plus per-item entity/
   operation and a "Discard" action that deletes them (explicit user action —
   deletion is acceptable there). Two buttons max; follow the page's existing
   toast + button patterns (see `handleManualSync` / `handleClearLog` on that
   page).

Extend `syncQueue.test.ts`: `purgeFailed marks items dead instead of deleting`
and `dead items are excluded from getPendingItems and getPendingCount`.

**Verify**: `npm run test` → all pass, including the new cases.

### Step 6: Full gate

**Verify**: `npx tsc -p tsconfig.app.json --noEmit` → exit 0;
`npm run lint` → 0 errors; `npm run build` → exit 0; `npm run test` → all pass.

## Test plan

Covered in Steps 1 and 5. Summary of new coverage: handler success/failure
paths, error propagation from supabase `{ error }` results (register a real
handler backed by the mocked supabase client for at least one test so the
Step 2 pattern itself is exercised), drain serialization, conflict-check
resilience, dead-letter semantics. Pattern file: `syncQueue.test.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc -p tsconfig.app.json --noEmit` exits 0
- [ ] `npm run test` exits 0; `src/lib/offline/syncEngine.test.ts` exists with ≥5 passing tests (no remaining `it.fails`)
- [ ] All 11 `registerHandler` supabase calls check `{ error }` (grep from Step 2 returns 11)
- [ ] `grep -n "catch {" src/lib/offline/syncEngine.ts` shows no bare `break` on conflict-check failure
- [ ] `grep -n "\.delete()" src/lib/offline/syncQueue.ts` shows no delete inside `purgeFailed`
- [ ] `npm run lint` exits 0 with 0 errors; `npm run build` exits 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the cited locations doesn't match the excerpts (drift).
- The Dexie schema in `db.ts` uses a pattern other than
  `.version(N).stores({...})` chaining, making the Step 5 version bump unclear.
- Making handlers throw causes an existing test or the build to fail in a way
  that suggests something *depends* on the swallow-errors behavior.
- You find handlers registered anywhere other than the four service files
  listed (search: `grep -rn "registerHandler" src/`).
- The deferred-promise concurrency test cannot be made deterministic after two
  attempts — report rather than shipping a flaky test.

## Maintenance notes

- Plan 004 (idempotent replay) builds directly on this: it assumes handlers
  throw on error and that the drain is serialized. Land this first.
- Reviewer should scrutinize: the `finally` reset of `drainInFlight` (a thrown
  drain must not wedge the lock), and that `getPendingCount` exclusion of dead
  items doesn't break the `usePendingCount` badge (`syncEngine.ts:171-197`).
- Deferred: exposing per-item retry/backoff timing; the SERVER_WINS strategy
  review; surfacing sync failures as toasts at failure time (only the history
  page shows them today).
