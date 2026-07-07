# Plan 003: Scope manual edge-function triggers to the caller's org (and stop logging support PII)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 0e0bf99..HEAD -- supabase/functions src/pages/settings/SystemSettingsPage.tsx src/pages/settings/AlertRulesPage.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `0e0bf99`, 2026-07-07

## Why this matters

The scheduled edge functions `send-weekly-report` and `evaluate-alerts` run on
a **service-role** Supabase client (bypasses RLS). They accept two kinds of
callers: the pg_cron secret (should process ALL orgs) and a signed-in org
owner/admin pressing "Run now" in the UI (should process ONLY their org).
Today the user-JWT path never binds the caller to their org:

- `send-weekly-report` takes `org_id` from the request body and applies it
  unchecked — any org admin can trigger (and receive success/error details
  about) another org's report send, or omit the body and fan out emails for
  every org on the platform.
- `evaluate-alerts` on a manual trigger evaluates **every org's** alert rules,
  writing notifications across tenants.

Separately, `send-support-message` logs the user's name, email, and full
message body to function logs (PII in logs, retention problem).

All three fixes are small and contained in the functions themselves.

## Current state

Relevant files:

- `supabase/functions/send-weekly-report/index.ts` — auth at lines 98-129,
  org targeting at 131-156.
- `supabase/functions/evaluate-alerts/index.ts` — `authorize()` at lines
  18-31, rule fetch at 49-53.
- `supabase/functions/send-support-message/index.ts` — PII log at ~line 63.
- Client callers (context only, likely unchanged):
  `src/pages/settings/SystemSettingsPage.tsx:123` invokes send-weekly-report
  with `body: { org_id: orgId }`; `src/pages/settings/AlertRulesPage.tsx:348`
  invokes evaluate-alerts with no body.
- `supabase/migrations/023_cron_secret_lockdown.sql` — documents the
  cron-secret-OR-user-JWT auth model these functions implement.

### send-weekly-report auth + targeting (index.ts:98-156, abridged)

```ts
const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
let authed = false;
if (token) {
  const { data: isCron } = await supabase.rpc("is_cron_secret", { p_token: token });
  if (isCron === true) {
    authed = true;
  } else {
    // Manual trigger: require an authenticated org owner/admin.
    const supabaseClient = createClient(SUPABASE_URL, ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      const { data: role } = await supabaseClient.rpc("current_org_role");
      authed = role === "owner" || role === "admin";
    }
  }
}
if (!authed) { ...401... }

let targetOrgId: string | null = null;
if (req.method === "POST") {
  try { const body = await req.json(); targetOrgId = body?.org_id ?? null; } catch { }
}
...
const query = supabase              // <-- service-role client
  .from("organizations")
  .select("id, name, weekly_report_email")
  .eq("weekly_report_enabled", true)
  .not("weekly_report_email", "is", null);
if (targetOrgId) query.eq("id", targetOrgId);   // <-- attacker-controlled
```

Note the shape of the fix: the user branch already creates a user-scoped
client (`supabaseClient`); the caller's own org id is available via the
existing `current_org_id()` SQL helper (defined in migration
`001_initial_schema.sql:231`, used throughout the RLS policies), callable as
`supabaseClient.rpc("current_org_id")`.

### evaluate-alerts (index.ts:18-31, 49-53)

```ts
async function authorize(req: Request): Promise<boolean> {
  ...
  const { data: isCron } = await supabase.rpc("is_cron_secret", { p_token: token });
  if (isCron === true) return true;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {...});
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return false;
  const { data: role } = await userClient.rpc("current_org_role");
  return role === "owner" || role === "admin";
}
...
const { data: rules, error: rulesError } = await supabase   // service-role
  .from("alert_rules")
  .select("*")
  .eq("enabled", true);          // <-- no org filter on manual trigger
```

`authorize` returns only a boolean, so the caller's org is discarded. Check
whether `alert_rules` carries `org_id` directly or only `site_id`
(`grep -n "org_id\|site_id" supabase/migrations/008_alert_rules.sql`); if only
`site_id`, scope via the org's site ids (`sites.org_id = callerOrgId`).

### send-support-message (index.ts:~55-63)

```ts
const logEntry = {
  submitted_at: new Date().toISOString(),
  from_name: name,
  from_email: email,
  subject,
  message,
};
console.log("Support request received:", JSON.stringify(logEntry));
```

### Conventions

- Edge functions: Deno; JSON error responses `{ error: string }` with proper
  status codes; CORS headers object at top of file. Match each file's existing
  style.
- No emoji in code/commits. Do not log secrets or PII.
- Deployment of edge functions to prod is the **operator's** step, not yours.

## Commands you will need

| Purpose   | Command                                 | Expected on success |
|-----------|-----------------------------------------|---------------------|
| Typecheck | `npx tsc -p tsconfig.app.json --noEmit` | exit 0              |
| Tests     | `npm run test`                          | all pass            |
| Lint      | `npm run lint`                          | exit 0, 0 errors    |

(These gate the repo overall; the edge functions are Deno and outside tsc's
project. There is no Deno test harness in this repo — verification is by the
done-criteria greps and operator review. Keep diffs minimal.)

## Scope

**In scope** (the only files you should modify):

- `supabase/functions/send-weekly-report/index.ts`
- `supabase/functions/evaluate-alerts/index.ts`
- `supabase/functions/send-support-message/index.ts`

**Out of scope** (do NOT touch, even though they look related):

- `src/pages/settings/SystemSettingsPage.tsx` and `AlertRulesPage.tsx` — the
  client may keep sending `org_id`; the server now validates it. Only change
  them if a done-criterion forces it (it shouldn't).
- `supabase/functions/invite-user` — covered by `plans/002-*.md`.
- The cron-secret mechanism (migration 023) and `is_cron_secret` — working as
  designed.
- Any SQL migration — no schema change is needed here.

## Git workflow

- Branch: `advisor/003-edge-function-tenant-scoping` (from `main`).
- Commits: short imperative, no emoji — e.g. "Scope manual weekly-report and
  alert triggers to the caller's org".
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: send-weekly-report — bind the user path to the caller's org

Restructure the auth block to capture the caller's org, then constrain
targeting:

```ts
let authed = false;
let callerOrgId: string | null = null;   // null = cron (all orgs)

if (token) {
  const { data: isCron } = await supabase.rpc("is_cron_secret", { p_token: token });
  if (isCron === true) {
    authed = true;
  } else {
    const supabaseClient = createClient(SUPABASE_URL, ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
      const { data: role } = await supabaseClient.rpc("current_org_role");
      if (role === "owner" || role === "admin") {
        const { data: orgId } = await supabaseClient.rpc("current_org_id");
        if (orgId) { authed = true; callerOrgId = orgId; }
      }
    }
  }
}
```

Then in the targeting block: if `callerOrgId` is set, ignore the request-body
`org_id` entirely and force `query.eq("id", callerOrgId)`. Keep body `org_id`
honored only on the cron path (`callerOrgId === null`), preserving future
cron-side targeting.

**Verify**:
`grep -n "callerOrgId" supabase/functions/send-weekly-report/index.ts` →
matches in both the auth block and the query block.

### Step 2: evaluate-alerts — scope manual runs to the caller's org

Change `authorize` to return `{ authed: boolean; callerOrgId: string | null }`
(null for cron), using the same `current_org_id` RPC pattern as Step 1. In the
handler, when `callerOrgId` is non-null, restrict the rules query to that org:

- If `alert_rules` has `org_id`: `.eq("org_id", callerOrgId)`.
- If it only has `site_id`: first fetch
  `supabase.from("sites").select("id").eq("org_id", callerOrgId)`, then
  `.in("site_id", siteIds)` (return `{ triggered: 0 }` early if the org has no
  sites).

**Verify**:
`grep -n "callerOrgId" supabase/functions/evaluate-alerts/index.ts` → matches
in both `authorize` and the rules query.

### Step 3: send-support-message — stop logging PII

Replace the `logEntry` console.log with metadata only:

```ts
console.log("Support request received:", JSON.stringify({
  submitted_at: new Date().toISOString(),
  subject_length: (subject ?? "").length,
  message_length: (message ?? "").length,
}));
```

Do not remove the Resend email path — that is the intended delivery channel.
Check the rest of the file for other `console.log`/`console.error` calls that
include `email`, `name`, or `message` and strip those fields too (keep the
error's own message).

**Verify**:
`grep -n "from_email\|from_name" supabase/functions/send-support-message/index.ts`
→ matches only inside the email-sending payload, none inside any `console.*` call.

### Step 4: Full gate

**Verify**: `npx tsc -p tsconfig.app.json --noEmit` → exit 0; `npm run test` →
all pass; `npm run lint` → 0 errors (no `src/` changes expected — this
confirms nothing else was touched).

## Test plan

No Deno test harness exists in this repo; do not add one for this plan. The
regression protection is: (a) done-criteria greps, (b) this manual checklist
for the operator, to include in the PR description:

1. As an org admin, press "Send now" in System Settings → only your org's
   report is sent; response `results` contains one entry.
2. As an org admin, invoke send-weekly-report with a different org's `org_id`
   in the body → your org's report is sent (the supplied id is ignored).
3. Press "Run now" on Alert Rules → only rules belonging to your org evaluate.
4. Confirm the cron path still processes all orgs (check function logs after
   the next scheduled run — no PII expected in any log line).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Step 1 grep passes (`callerOrgId` in auth + query blocks of send-weekly-report)
- [ ] Step 2 grep passes (`callerOrgId` in authorize + rules query of evaluate-alerts)
- [ ] Step 3 grep passes (no PII fields in any console call of send-support-message)
- [ ] `grep -n "current_org_id" supabase/functions/send-weekly-report/index.ts supabase/functions/evaluate-alerts/index.ts` → ≥1 match per file
- [ ] `npx tsc -p tsconfig.app.json --noEmit` exits 0; `npm run test` passes; `npm run lint` 0 errors
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `current_org_id()` does not exist or is not executable by `authenticated`
  (check `supabase/migrations/001_initial_schema.sql:231` and any later
  migration that alters it) — the org-binding mechanism needs rethinking.
- `alert_rules` has neither `org_id` nor `site_id` (check migration 008) —
  the scoping key is unclear.
- The functions' code doesn't match the excerpts (drift).
- Fixing the scoping appears to require changing the client pages or a
  migration — that's out of scope; report instead.

## Maintenance notes

- If a future "platform superadmin" role needs cross-org manual triggers, add
  an explicit allowlist check — do not re-widen the user path.
- Reviewer should scrutinize: that the cron path (`is_cron_secret` true) still
  processes all orgs, and that a user with `current_org_id` returning null
  (broken profile) gets 401, not all-orgs access.
- Plan 002's operator checklist also deploys edge functions — coordinate
  deployments if both land together.
- Deferred: rate-limiting manual triggers (an org admin can still spam their
  own org's report sends); persisting support messages to a table instead of
  relying on email delivery.
