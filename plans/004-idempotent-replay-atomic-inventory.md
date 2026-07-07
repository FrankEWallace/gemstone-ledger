# Plan 004: Make offline create-replays idempotent and inventory consume/write-off atomic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 0e0bf99..HEAD -- src/services/transactions.service.ts src/services/safety.service.ts src/services/inventory.service.ts src/lib/offline supabase/migrations`
> Plan 001 intentionally modifies some of these files — that is expected drift;
> re-read the touched handler blocks before editing. Any OTHER mismatch with
> the "Current state" excerpts is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-offline-sync-hardening.md (handlers must throw on
  error and the drain must be serialized before idempotency semantics hold)
- **Category**: bug
- **Planned at**: commit `0e0bf99`, 2026-07-07

## Why this matters

Two remaining data-integrity gaps after Plan 001:

1. **Duplicate rows from replays.** Offline `create` mutations are replayed
   with plain `.insert()` and no client-supplied primary key. If the server
   commits but the response is lost (flaky reconnect), the handler throws, the
   item is retried, and the same record is inserted twice. Duplicated
   financial transactions are the worst case. Fix: generate the row `id`
   client-side at enqueue time and replay with an upsert keyed on `id`.
2. **Non-atomic stock/ledger writes.** `consumeInventoryItem` and
   `writeOffInventoryItem` each perform two dependent writes (decrement stock,
   then insert an expense transaction / write-off row) as separate requests.
   If the second fails, stock and the financial/audit ledger permanently
   diverge — and the docstring falsely claims the operation is atomic. Fix:
   move each pair into a single Postgres function (one transaction), called
   via `supabase.rpc`.

## Current state

Relevant files:

- `src/services/transactions.service.ts` — `createTransaction` (offline enqueue
  at lines ~80-86), replay handlers at ~152-162 (Plan 001 adds error checks).
- `src/services/safety.service.ts` — `createSafetyIncident` offline enqueue at
  ~49-53, handlers at ~129-140.
- `src/services/inventory.service.ts` — handlers at ~92-102;
  `consumeInventoryItem` at ~148-186; `writeOffInventoryItem` at ~218-244
  (docstring at 148-150 says "Atomically deducts" — currently false).
- `src/lib/offline/syncQueue.ts` / `db.ts` — queue plumbing (`SyncQueueItem`).
- `src/services/production.service.ts` — **exemplar**: its create handler
  already replays idempotently via
  `upsert(item.payload, { onConflict: "site_id,log_date" })`.
- `src/services/contract.service.ts:241-249` — also enqueues
  `entity: "transactions", operation: "create"` items (bulk contract income);
  must get client-side ids too.
- `supabase/migrations/023_cron_secret_lockdown.sql` and
  `025_lockdown_signup_rpcs.sql` — exemplars for migration style
  (`security definer set search_path = public`, explicit revoke/grant).

### The non-idempotent create path (`transactions.service.ts:74-96`)

```ts
export async function createTransaction(siteId, payload, createdBy?): Promise<Transaction> {
  const fullPayload = { ...payload, site_id: siteId, created_by: createdBy ?? null };

  if (!navigator.onLine) {
    const tempId = `offline-${crypto.randomUUID()}`;
    await enqueue({ entity: "transactions", operation: "create", payload: fullPayload, siteId, timestamp: Date.now() });
    return { id: tempId, created_at: new Date().toISOString(), ...fullPayload } as unknown as Transaction;
  }
  ...
}
```

Note: the `tempId` is returned to the UI but **not** stored in the queued
payload — the replay inserts with a server-generated id, so a retry after a
lost response creates a second row. `safety.service.ts:49-53` has the same
shape. The `offline-` prefix matters elsewhere: `checkConflict` in
`syncEngine.ts:35` skips ids starting with `"offline-"`.

### The replay handler (post-Plan-001 shape, `transactions.service.ts`)

```ts
registerHandler("transactions", "create", async (item) => {
  const { error } = await supabase.from("transactions").insert(item.payload as TablesInsert<"transactions">);
  if (error) throw error;
});
```

### The non-atomic inventory operations (`inventory.service.ts:148-186`)

```ts
/**
 * Atomically deducts inventory stock and creates a `source: 'inventory'` expense transaction.
 * Transaction is only created when unit_cost > 0.
 */
export async function consumeInventoryItem(siteId, item, qty, opts = {}): Promise<void> {
  await updateInventoryItem(item.id, { quantity: item.quantity - qty });

  const unitCost = Number(item.unit_cost ?? 0);
  if (unitCost > 0) {
    await createTransaction(siteId, {
      description: `${item.name} usage — ${qty} ${item.unit ?? "units"}${opts.notes ? ` (${opts.notes})` : ""}`,
      type: "expense", status: "success", quantity: qty, unit_price: unitCost,
      transaction_date: opts.transactionDate ?? new Date().toISOString().slice(0, 10),
      customer_id: opts.customerId ?? null, expense_category_id: opts.expenseCategoryId ?? null,
      category: item.category ?? undefined, inventory_item_id: item.id, source: "inventory",
    }, opts.userId);
  }
}
```

Also note the pre-existing race: `item.quantity - qty` is a client-side
read-modify-write. The RPC fixes this too by decrementing server-side
(`quantity = quantity - p_qty`).

`writeOffInventoryItem` (~218-244) has the same two-write shape with an
`inventory_write_offs` insert; read it fully before writing the RPC.

### Conventions

- Services return typed rows, check `{ error }` and `throw error`.
- Each service function has demo-mode (`isDemoMode()`) and REST
  (`isRestActive()`) branches ABOVE the supabase path — **do not remove or
  reorder them**; your changes apply to the supabase path only.
- Migrations: numbered `NNN_snake_case.sql`, header comment, SECURITY DEFINER
  + `set search_path = public`, explicit revoke/grant (see 023/025).
- **Migration divergence warning**: prod has diverged from local migration
  files before. You only WRITE the migration file; the operator verifies
  the live `transactions` / `inventory_items` / `inventory_write_offs`
  schemas and applies it. Never apply to a remote DB yourself.
- Tests: Vitest; offline tests use `fake-indexeddb/auto`
  (`src/lib/offline/syncQueue.test.ts` is the pattern).
- No emoji in code, commits, or PR text.

## Commands you will need

| Purpose   | Command                                 | Expected on success |
|-----------|-----------------------------------------|---------------------|
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit` | exit 0              |
| Tests     | `npm run test`                          | all pass            |
| Lint      | `npm run lint`                          | exit 0, 0 errors    |
| Build     | `npm run build`                         | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `src/services/transactions.service.ts`
- `src/services/safety.service.ts`
- `src/services/inventory.service.ts`
- `src/services/contract.service.ts` (only the offline enqueue block ~241-249)
- `src/services/inventory.service.test.ts` (create)
- `supabase/migrations/027_atomic_inventory_ops.sql` (create; if 027 is taken,
  use the next free number)

**Out of scope** (do NOT touch):

- `src/lib/offline/*` — Plan 001 owns those files; this plan builds on them
  without modifying them.
- `production.service.ts` — its upsert replay is already idempotent.
- The `updateInventoryItem` function itself and every UI page.
- Demo-mode / REST branches anywhere.
- `restockInventoryItem` (`inventory.service.ts:~140-146`) — same
  read-modify-write smell, but changing it is deferred (note it in the PR).

## Git workflow

- Branch: `advisor/004-idempotent-replay-atomic-inventory` (from `main`,
  after Plan 001 has merged; otherwise branch from Plan 001's branch and say
  so in the PR).
- Commits: short imperative, no emoji.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Client-generated ids for offline creates

In `transactions.service.ts` `createTransaction` and `safety.service.ts`
`createSafetyIncident`, change the offline branch to generate a REAL uuid and
put it IN the payload (both queued and returned):

```ts
if (!navigator.onLine) {
  const id = crypto.randomUUID();
  const queuedPayload = { ...fullPayload, id };
  await enqueue({ entity: "transactions", operation: "create", payload: queuedPayload, siteId, timestamp: Date.now() });
  return { id, created_at: new Date().toISOString(), ...fullPayload } as unknown as Transaction;
}
```

Do the same in `contract.service.ts`'s offline loop (each `insert` gets its
own `id: crypto.randomUUID()`).

Two consequences to handle:

- The `offline-` id prefix disappears. Check every consumer of that prefix:
  `grep -rn '"offline-\|offline-\${' src/`. Known consumer:
  `syncEngine.ts:35` (`payload.id.startsWith("offline-")` skips conflict
  checks for never-synced rows). That guard's purpose — "new records never
  conflict" — is already satisfied by the line above it
  (`if (item.operation === "create") return false;`), and updates/deletes of
  an offline-created row now carry a real uuid that simply won't exist
  server-side yet (`maybeSingle()` returns null → no conflict → proceed).
  Since `src/lib/offline` is out of scope, you may leave the dead prefix check
  in place — but list every other `offline-` consumer you find in the PR
  description. If any consumer's behavior would CHANGE (not just dead code),
  STOP.
- UI code may key optimistic rows by the temp id — the new real uuid serves
  identically; no change needed.

**Verify**: `grep -n "offline-" src/services/*.ts` → no remaining matches;
`npx tsc -p tsconfig.app.json --noEmit` → exit 0.

### Step 2: Upsert-on-id replay handlers

Change the `create` replay handlers in `transactions.service.ts` and
`safety.service.ts` from `.insert(...)` to:

```ts
registerHandler("transactions", "create", async (item) => {
  const { error } = await supabase
    .from("transactions")
    .upsert(item.payload as TablesInsert<"transactions">, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
});
```

(`ignoreDuplicates: true` = `ON CONFLICT DO NOTHING`: a retry after a
committed-but-unacknowledged insert becomes a no-op instead of a duplicate.
The primary key on `id` is the conflict target — no schema change needed.)

Leave `inventory_items`' create handler as insert-or-upsert per the same
pattern **only if** inventory creates also enqueue offline — check
`inventory.service.ts` `createInventoryItem`: if its offline branch enqueues
without an id, apply Steps 1-2 to it identically; if it has no offline branch,
leave the handler alone.

Add a queue-level regression test in a new
`src/services/inventory.service.test.ts`? No — handler behavior for
transactions/safety is engine-agnostic; add these cases to
`src/lib/offline/syncEngine.test.ts`… which is out of scope. Instead: test via
the service test file created in Step 4 (it can import and invoke the handler
functions indirectly is not possible — handlers are registered as closures).
Therefore the replay idempotency test lives at the payload level: assert that
the offline branch of `createTransaction` enqueues a payload containing a
uuid `id` (see Step 4 test list).

**Verify**:
`grep -n 'upsert' src/services/transactions.service.ts src/services/safety.service.ts` →
one match per file inside the create handler, with `onConflict: "id"`.

### Step 3: Migration — atomic consume / write-off RPCs

Create `supabase/migrations/027_atomic_inventory_ops.sql` with two functions.
Before writing, read the live column lists for `transactions`,
`inventory_items`, `inventory_write_offs` from
`src/lib/supabaseTypes.ts` (generated types — search for
`inventory_write_offs: {`) so parameter and insert column names are exact.
Shape:

```sql
-- 027: Atomic inventory operations.
-- consumeInventoryItem/writeOffInventoryItem previously did two client-side
-- writes (stock decrement + ledger insert) with no transaction; a failure
-- between them diverged stock from the financial/audit ledger. These RPCs do
-- both writes in one transaction and decrement server-side (no read-modify-write race).

create or replace function public.consume_inventory(
  p_item_id uuid,
  p_site_id uuid,
  p_qty numeric,
  p_customer_id uuid default null,
  p_expense_category_id uuid default null,
  p_notes text default null,
  p_user_id uuid default null,
  p_transaction_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item inventory_items%rowtype;
begin
  -- Authorization: caller must have access to the site (RLS is bypassed here).
  if not has_site_access(p_site_id) then
    raise exception 'Forbidden';
  end if;

  select * into v_item from inventory_items
  where id = p_item_id and site_id = p_site_id
  for update;
  if not found then raise exception 'Inventory item not found'; end if;
  if p_qty <= 0 then raise exception 'Quantity must be positive'; end if;

  update inventory_items set quantity = quantity - p_qty where id = p_item_id;

  if coalesce(v_item.unit_price, 0) > 0 then
    insert into transactions (site_id, description, type, status, quantity, unit_price,
                              transaction_date, customer_id, expense_category_id, category,
                              inventory_item_id, source, created_by)
    values (p_site_id,
            v_item.name || ' usage — ' || p_qty || ' ' || coalesce(v_item.unit, 'units')
              || case when p_notes is not null then ' (' || p_notes || ')' else '' end,
            'expense', 'success', p_qty, v_item.unit_price,
            p_transaction_date, p_customer_id, p_expense_category_id, v_item.category,
            p_item_id, 'inventory', p_user_id);
  end if;
end;
$$;
```

CAUTION on the cost column: the TS code reads `item.unit_cost` but inserts
`unit_price` into transactions. Check `supabaseTypes.ts` for whether
`inventory_items` has `unit_cost`, `unit_price`, or both, and use the column
the TS path actually reads (`unit_cost ?? 0` at `inventory.service.ts:~167`).
If the generated types show neither, STOP.

Write `write_off_inventory(...)` the same way: lock the row, decrement,
insert into `inventory_write_offs` with the same columns the current TS insert
uses (read `writeOffInventoryItem` fully first), all in one function.

Also check the authorization helper: `has_site_access` is defined in migration
`005_rls_audit.sql` but may reference a legacy `site_roles` table (known
open question — see plans/README.md "considered and rejected" notes). If
`grep -n "site_roles" supabase/migrations/005_rls_audit.sql` shows the helper
querying `site_roles` while later migrations use `user_site_roles`, do NOT use
`has_site_access`; inline the check instead:

```sql
  if not exists (select 1 from user_site_roles where user_id = auth.uid() and site_id = p_site_id) then
    raise exception 'Forbidden';
  end if;
```

End with grants, matching 025's pattern:

```sql
revoke all on function public.consume_inventory(uuid, uuid, numeric, uuid, uuid, text, uuid, date) from public, anon;
grant execute on function public.consume_inventory(uuid, uuid, numeric, uuid, uuid, text, uuid, date) to authenticated, service_role;
-- (repeat for write_off_inventory)
```

**Verify**: file exists; `grep -c "security definer" supabase/migrations/027_atomic_inventory_ops.sql` → 2;
`grep -c "revoke all" supabase/migrations/027_atomic_inventory_ops.sql` → 2.

### Step 4: Switch the TS functions to the RPCs and fix the docstring

In `inventory.service.ts`:

- `consumeInventoryItem` supabase path becomes a single call:

```ts
const { error } = await supabase.rpc("consume_inventory", {
  p_item_id: item.id, p_site_id: siteId, p_qty: qty,
  p_customer_id: opts.customerId ?? null,
  p_expense_category_id: opts.expenseCategoryId ?? null,
  p_notes: opts.notes ?? null, p_user_id: opts.userId ?? null,
  p_transaction_date: opts.transactionDate ?? new Date().toISOString().slice(0, 10),
});
if (error) throw error;
```

  Keep demo/REST branches untouched. The docstring's "Atomically" is now true —
  update it to mention the RPC. NOTE: the generated `supabaseTypes.ts` will not
  know the new RPC until types are regenerated; if `tsc` complains about the
  rpc name, cast the function name once
  (`supabase.rpc("consume_inventory" as never, {...} as never)`) and add a
  `// TODO: regenerate supabaseTypes after migration 027 is applied` — the
  operator regenerates types post-apply.
- Same for `writeOffInventoryItem` → `write_off_inventory`.

Create `src/services/inventory.service.test.ts` (pattern:
`src/lib/offline/syncQueue.test.ts` for structure; mock `@/lib/supabase` with
`vi.mock`). Tests:

1. `consumeInventoryItem calls consume_inventory RPC with the right args`
2. `consumeInventoryItem throws when the RPC returns an error`
3. `writeOffInventoryItem calls write_off_inventory RPC`
4. In a new-or-existing `src/services/transactions.service.test.ts`: offline
   `createTransaction` enqueues a payload whose `id` is a uuid (regex
   `/^[0-9a-f-]{36}$/`) and returns that same id (set
   `Object.defineProperty(navigator, "onLine", { value: false, configurable: true })`
   for the test, restore after).

**Verify**: `npm run test` → all pass including the 4 new tests.

### Step 5: Full gate

**Verify**: `npx tsc -p tsconfig.app.json --noEmit` → exit 0; `npm run lint` →
0 errors; `npm run build` → exit 0; `npm run test` → all pass.

## Test plan

See Steps 2 and 4. Deliberately NOT tested here: the SQL functions themselves
(no SQL test harness in this repo) — their safety rests on the verbatim column
mapping from the current TS writes plus operator verification against prod
schema before applying. State this in the PR.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "offline-" src/services/*.ts` → no matches
- [ ] Create replay handlers for transactions and safety use `upsert(..., { onConflict: "id", ignoreDuplicates: true })`
- [ ] `supabase/migrations/027_atomic_inventory_ops.sql` exists with 2 SECURITY DEFINER functions + grants
- [ ] `consumeInventoryItem` / `writeOffInventoryItem` supabase paths are single `supabase.rpc` calls; no `updateInventoryItem` call remains inside either
- [ ] The word "Atomically" in `inventory.service.ts` now describes a real transaction (RPC)
- [ ] `npm run test` passes with the 4 new tests; `npx tsc -p tsconfig.app.json --noEmit` exits 0; `npm run lint` 0 errors; `npm run build` exits 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 001 has not landed (handlers still swallow errors) — this plan's
  idempotency reasoning assumes 001's semantics.
- `supabaseTypes.ts` shows `transactions.id` or `safety_incidents.id` is not a
  client-suppliable uuid column (e.g. identity/serial) — client-generated ids
  won't work.
- The `unit_cost` vs `unit_price` question (Step 3) can't be resolved from the
  generated types.
- Any consumer of the `offline-` id prefix would change behavior (Step 1).
- You are tempted to apply migration 027 to a remote database — operator step.

## Maintenance notes

- Operator, after applying 027: regenerate `supabaseTypes.ts`
  (`supabase gen types typescript`) and remove any `as never` casts from
  Step 4.
- Reviewer should scrutinize: exact column mapping in the two SQL inserts
  against the previous TS payloads (the description string format must match,
  `status: 'success'`, `source: 'inventory'`), and the `for update` row lock.
- `restockInventoryItem` still does a client-side read-modify-write increment —
  deferred; consider a third RPC or a server-side `quantity = quantity + p_qty`
  later.
- If offline UX later wants optimistic rows to survive reload, the
  client-generated id from Step 1 is the key that makes that possible.
