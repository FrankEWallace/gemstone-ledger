# Plan 002: Close the invite-flow privilege escalations (metadata-trusted role, site_manager minting admins)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 0e0bf99..HEAD -- supabase/functions/invite-user supabase/migrations src/pages/auth/AcceptInvite.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `0e0bf99`, 2026-07-07

## Why this matters

Two related access-control gaps live in the user-invitation flow of this
multi-tenant SaaS:

1. **Escalation by the invitee.** The signup-completion RPC
   `handle_invited_user_signup` (migration 025) reads the role it grants from
   `auth.users.raw_user_meta_data->>'invited_role'`. `raw_user_meta_data` is
   **user-writable**: any authenticated user can call
   `supabase.auth.updateUser({ data: {...} })` and rewrite it. An invited
   `viewer` holds a session before completing signup (the accept page calls
   `updateUser` to set their password), so they can rewrite `invited_role` to
   `admin` — keeping the legitimate `org_id`/`invited_to_site` that pass the
   RPC's consistency checks — and then invoke the RPC to self-provision an
   admin site role.
2. **Escalation by the inviter.** The `invite-user` edge function allows any
   `site_manager` to send invites with `role: "admin"`, i.e. a lower-privilege
   role can mint a higher-privilege account at an email address it controls.

The fix moves the authorization-bearing invite fields to `app_metadata`
(writable only via the service-role admin API, never by the user) and enforces
a role-hierarchy rule on who may invite whom.

## Current state

Relevant files:

- `supabase/functions/invite-user/index.ts` — Deno edge function; validates
  the request, checks the inviter, and calls
  `supabaseAdmin.auth.admin.inviteUserByEmail`.
- `supabase/migrations/025_lockdown_signup_rpcs.sql` — defines
  `handle_invited_user_signup` (SECURITY DEFINER) which currently reads
  `raw_user_meta_data`.
- `src/pages/auth/AcceptInvite.tsx` — the accept page; sets the password then
  calls the RPC. **Should need no changes** (verify at the end).
- `supabase/migrations/023_cron_secret_lockdown.sql` — exemplar for migration
  style (header comment explaining the change, `revoke`/`grant` hygiene).

### The metadata write (invite-user/index.ts:101-110)

```ts
// Send invitation — user_metadata carries org/site/role for handle_invited_user_signup
const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
const { data, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${appUrl}/accept-invite`,
  data: {
    org_id,
    invited_to_site: site_id,
    invited_role: role,
  },
});
```

`inviteUserByEmail`'s `data` option writes to **user_metadata**
(`raw_user_meta_data`). The supabase-js admin API can set app_metadata only
via a separate call: `supabaseAdmin.auth.admin.updateUserById(userId,
{ app_metadata: {...} })`.

### The trusting read (migration 025, function `handle_invited_user_signup`)

```sql
  -- Read invite metadata stored by invite-user edge function
  select
    (raw_user_meta_data->>'org_id')::uuid,
    (raw_user_meta_data->>'invited_to_site')::uuid,
    raw_user_meta_data->>'invited_role'
  into v_org_id, v_site_id, v_role
  from auth.users
  where id = p_user_id;
```

The function otherwise has good guards (caller must be `auth.uid()`, org must
exist, site must belong to org, profile must not already exist) — the only
problem is the source of truth. It ends by inserting into `user_profiles` and
`user_site_roles (user_id, site_id, role)`.

### The role gate (invite-user/index.ts:34-41 and 86-99)

```ts
const ALLOWED_ROLES = ["admin", "site_manager", "worker", "viewer"];
...
// Confirm inviter has admin or site_manager role for the target site
const { data: roleRow } = await supabaseAdmin
  .from("user_site_roles")
  .select("role")
  .eq("user_id", inviter.id)
  .eq("site_id", site_id)
  .single();

if (!roleRow || !["admin", "site_manager"].includes(roleRow.role)) { ... 403 ... }
```

No check relates the *invited* role to the *inviter's* role.

### Repo/DB conventions

- Migrations: numbered `NNN_snake_case.sql` in `supabase/migrations/`; each
  starts with a `-- NNN: <what and why>` comment block; functions are
  `security definer set search_path = public` with explicit
  `revoke ... from public, anon; grant execute ... to authenticated, service_role;`
  (see 025 itself, and 023 for the comment style).
- **CRITICAL — migration divergence**: the remote production DB has previously
  diverged from the local migration files. The executor's job is ONLY to write
  the migration file and TypeScript changes. Do NOT attempt to apply the
  migration to any remote database; the operator applies it after verifying
  the live definition of `handle_invited_user_signup` matches migration 025.
- Edge functions: Deno, `Deno.env.get(...)`, JSON responses with
  `CORS_HEADERS`, 4xx for client errors (see the excerpts above; match the
  existing response style).
- No emoji in code, commits, or PR text.

## Commands you will need

| Purpose   | Command                                 | Expected on success |
|-----------|-----------------------------------------|---------------------|
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit` | exit 0              |
| Tests     | `npm run test`                          | all pass            |
| Lint      | `npm run lint`                          | exit 0, 0 errors    |

Note: edge functions are Deno and are NOT covered by `tsc`/vitest here. There
is no local Deno test setup in this repo. Verification for the edge function
and SQL is by the greps in the done criteria plus operator review — keep the
diff small and mechanical.

## Scope

**In scope** (the only files you should modify/create):

- `supabase/functions/invite-user/index.ts`
- `supabase/migrations/026_invite_app_metadata.sql` (create; if 026 is taken
  by the time you execute, use the next free number and update this plan's
  references)

**Out of scope** (do NOT touch, even though they look related):

- `src/pages/auth/AcceptInvite.tsx` — it only sets the password and calls the
  RPC by user id; the metadata change is invisible to it.
- `handle_new_user_signup` / other signup RPCs in migration 025 — different
  flow (self-signup creates its own org), not affected.
- `supabase/functions/send-weekly-report`, `evaluate-alerts`,
  `send-support-message` — covered by `plans/003-*.md`.
- Any retroactive audit of existing `user_site_roles` rows (operator task; see
  Maintenance notes).

## Git workflow

- Branch: `advisor/002-invite-privilege-escalation` (from `main`).
- Commits: short imperative, no emoji — e.g. "Move invite role to
  app_metadata; enforce inviter role hierarchy".
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write invite fields to app_metadata in the edge function

In `supabase/functions/invite-user/index.ts`, after the existing
`inviteUserByEmail` call succeeds (it returns `data.user`), add a second admin
call that stamps the authorization-bearing copy into app_metadata:

```ts
if (data.user) {
  const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { org_id, invited_to_site: site_id, invited_role: role },
  });
  if (metaErr) {
    return new Response(JSON.stringify({ error: `Invite created but metadata stamp failed: ${metaErr.message}` }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}
```

Keep the existing `data:` option on `inviteUserByEmail` (user_metadata) — the
email template or client may read it for display — but it no longer confers
authority.

**Verify**: `grep -n "app_metadata" supabase/functions/invite-user/index.ts`
→ at least one match inside an `updateUserById` call.

### Step 2: Enforce the inviter role hierarchy

In the same file, immediately after the existing `roleRow` check (the
403 "must be admin or site_manager" block), add:

```ts
// site_manager may only invite worker/viewer; only admin may invite admin/site_manager
if (roleRow.role === "site_manager" && !["worker", "viewer"].includes(role)) {
  return new Response(
    JSON.stringify({ error: "Forbidden: site managers may only invite workers or viewers" }),
    { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
}
```

(`admin` inviters keep the full `ALLOWED_ROLES` range; `ALLOWED_ROLES` itself
is unchanged.)

**Verify**: `grep -n "site managers may only invite" supabase/functions/invite-user/index.ts` → one match, located after the `roleRow` 403 block.

### Step 3: Migration — RPC reads app_metadata

Create `supabase/migrations/026_invite_app_metadata.sql`. Content:

1. Header comment block (match 023/025 style): what changed and why —
   "invited_role/org_id/invited_to_site now read from raw_app_meta_data
   because raw_user_meta_data is user-writable via auth.updateUser and must
   not carry authorization."
2. `create or replace function public.handle_invited_user_signup(p_user_id uuid, p_full_name text)`
   — reproduce the **entire existing function body from migration 025 lines
   31-86 verbatim**, changing only the metadata source:

```sql
  select
    (raw_app_meta_data->>'org_id')::uuid,
    (raw_app_meta_data->>'invited_to_site')::uuid,
    raw_app_meta_data->>'invited_role'
  into v_org_id, v_site_id, v_role
  from auth.users
  where id = p_user_id;
```

3. Also add a role whitelist inside the function (defense in depth against a
   compromised stamping path):

```sql
  if v_role not in ('admin', 'site_manager', 'worker', 'viewer') then
    raise exception 'Invalid invited role';
  end if;
```

4. Re-assert the grants exactly as 025 does:

```sql
revoke all on function public.handle_invited_user_signup(uuid, text) from public, anon;
grant execute on function public.handle_invited_user_signup(uuid, text) to authenticated, service_role;
```

**Verify**: `grep -c "raw_user_meta_data" supabase/migrations/026_invite_app_metadata.sql` → `0`;
`grep -c "raw_app_meta_data" supabase/migrations/026_invite_app_metadata.sql` → `3`.

### Step 4: Confirm the client needs no change

Read `src/pages/auth/AcceptInvite.tsx` `onSubmit` (lines ~42-70): it calls
`supabase.auth.updateUser({ password })` then
`supabase.rpc("handle_invited_user_signup", { p_user_id, p_full_name })`.
Neither references the metadata fields. If it does reference
`invited_role`/`invited_to_site`/`org_id` anywhere (check the whole file), STOP.

**Verify**: `grep -n "invited_role\|invited_to_site" src/pages/auth/AcceptInvite.tsx` → no matches.

### Step 5: Full gate

**Verify**: `npx tsc -p tsconfig.app.json --noEmit` → exit 0 (no src changes
expected, this confirms nothing broke); `npm run test` → all pass;
`npm run lint` → 0 errors.

## Test plan

No runnable test harness covers Deno edge functions or SQL in this repo, so
this plan's safety comes from: (a) the verbatim-body constraint in Step 3 — the
only semantic diff is the metadata source and the role whitelist; (b) the greps
in Done criteria; (c) the operator's deployment checklist below. Do not invent
a new test framework for this plan.

Operator checklist to include at the bottom of the migration file as comments:

```sql
-- Deployment order (operator):
-- 1. Verify prod's current handle_invited_user_signup matches migration 025
--    (SELECT prosrc FROM pg_proc WHERE proname = 'handle_invited_user_signup').
-- 2. Deploy the updated invite-user edge function FIRST (new invites get app_metadata).
-- 3. Apply this migration (RPC switches to app_metadata).
-- 4. Any invite sent between old-function and migration apply will fail with
--    'Missing invite metadata' — re-send those invites.
-- 5. Audit existing user_site_roles for roles that don't match their invites.
```

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `supabase/migrations/026_invite_app_metadata.sql` exists; greps from Step 3 pass
- [ ] `grep -n "app_metadata" supabase/functions/invite-user/index.ts` → match in `updateUserById`
- [ ] Step 2 hierarchy grep passes
- [ ] `grep -n "invited_role" src/` (recursive) → no client code reads it
- [ ] `npx tsc -p tsconfig.app.json --noEmit` exits 0; `npm run test` passes; `npm run lint` 0 errors
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The live function body in migration 025 differs from the excerpt (drift), or
  migration 026 already exists with different content.
- `AcceptInvite.tsx` (or anything under `src/`) reads the invite metadata
  fields — the client contract would change and the plan must be revised.
- You find another RPC or trigger that reads `raw_user_meta_data->>'invited_role'`
  (search: `grep -rn "invited_role" supabase/`) beyond
  `handle_invited_user_signup` — every reader must migrate together.
- You are tempted to apply the migration to a remote database — that is the
  operator's step, never yours.

## Maintenance notes

- **Rollout ordering matters** (see the operator checklist): edge function
  first, then migration; a window where neither matches loses in-flight
  invites (they error safely — "Missing invite metadata" — but need re-sending).
- Operator follow-up: audit existing `user_site_roles` for grants that exceed
  the role the corresponding invite specified (compare against
  `auth.users.raw_user_meta_data->>'invited_role'` for historical invitees —
  the old stamps remain readable for exactly this audit).
- Reviewer should scrutinize: that the 026 function body is byte-identical to
  025 except the three `raw_app_meta_data` reads and the added whitelist.
- If the product later wants org-level owners to invite across sites, the
  Step 2 hierarchy is where that matrix lives.
