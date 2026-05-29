---
date: 2026-05-29
topic: "Profile settings page redesign"
outcome: "Rebuild ProfilePage as a view-first, card-based layout (shadcn style) with inline-edit account, identity summary, security, preferences (theme + master email toggle), read-only sites/roles, and a UI-only danger zone; add a notification_prefs JSONB migration; keep sign-out on the page since it's the app's only logout path."
---

# Grill Session: Profile Settings Redesign

## Q&A

1. **Q:** What's the core thing that makes it feel "wack"?
   **A:** All of: bad structure/layout, clunky UX/flow, missing functionality. Plus: the table/fields are off (esp. phone field and the box below it not balanced); wants to **show the profile first before directly editing it**; pointed to `htdocs/dashboards` profile settings as a reference.

2. **Q:** I can't find a profile page in `htdocs/dashboardss` source — how should I get the reference look?
   **A:** Use the shadcn dashboard style (adapt the general visual language; no exact ref page exists).

3. **Q:** How should the Profile page be organized, given there's already an outer settings tab bar (Profile/Categories/Targets/Org/Help)?
   **A:** **Summary card + sections below** — identity hero card in view mode, then stacked shadcn Cards. No nested tabs.

4. **Q:** How should editing account info (name, phone) work after the view-first display?
   **A:** **Inline edit toggle** — read-only rows → click Edit → inputs with Save/Cancel → back to read-only.

5. **Q:** Which additional features should the new page include?
   **A:** All four: appearance/theme toggle, account deletion/danger zone, member-since/account meta, notification preferences.

6. **Q:** Notification prefs need storage that doesn't exist — how far to go?
   **A:** **Full wire-up** — add a migration + persist values.

7. **Q:** Account deletion needs an edge function/RPC that doesn't exist — how far to go?
   **A:** **UI + leave-org only** (later refined to UI-only, see Q9).

8. **Q:** Which user-level notification toggles to add?
   **A:** Only **Email notifications (master)** — single toggle (deselected critical alerts, weekly summary, product updates).

9. **Q:** Given no leave-org RPC and you're likely the org owner, what should Danger Zone do now?
   **A:** **Both delete + leave disabled with a "requires backend setup" note** — pure UI, no RPC work this pass.

10. **Q:** Approve the final card stack?
    **A:** **Approved**: Identity (view) → Account (inline edit) → Security → Preferences → Sites & Roles → Danger Zone.

## Key Decisions

- **Layout:** view-first, single-scroll, shadcn `Card`-based. No nested tabs (outer settings tab bar already exists).
- **Identity card (view mode):** avatar + camera button, full name, role/owner badges, email, phone, member-since/last-sign-in meta. This is display-only; editing happens in the Account card.
- **Account card:** name + phone via inline edit toggle (read-only → Edit → inputs + Save/Cancel). Reuses the existing fast local-cache save (`setProfile` from the update result, no refetch).
- **Security card:** change email (show current, edit → send confirmation) + change password.
- **Preferences card:** theme switch (reuse existing `ThemeContext` / `ThemeToggle`) + single master "Email notifications" toggle.
- **Notification prefs storage:** new migration adding a `notification_prefs` JSONB column to `user_profiles`, structured for extensibility (start with `{ email_enabled: bool }`). Wire load + save.
- **Sites & Roles card:** keep current read-only list.
- **Danger Zone card:** "Delete account" and "Leave organization" rendered as **disabled** with a "requires backend setup" note. No RPC/edge function this pass.
- **Sign out:** MUST stay on the page — ProfilePage is the *only* place in the app that calls `signOut()`. Keep a compact sign-out action in the identity card header (corrects the approved "header menu" assumption).
- **Avatar UX cleanup:** remove the always-on amber "requires `user-avatars` bucket" warning; handle a missing bucket gracefully (error toast only on failure).
- **Member-since/meta:** sourced from existing Supabase auth data (`created_at`, `last_sign_in_at`, user id — copyable).
- **Style mandate:** mobile-first, shadcn/ui primitives already available in the repo (card, tabs, avatar, switch, dialog, alert-dialog, etc.). Follow Blueprint token rules (no arbitrary px, no pure black, labels on inputs).
- **Build note:** project builds vite-only (no `tsc`); `supabaseTypes.ts` is corrupted with ~100 latent type errors — don't rely on full typecheck to validate.

## Open Questions

- None blocking. Future follow-ups (out of scope this pass): edge function for real account deletion, leave-org RPC + RLS for non-owner members, ownership-transfer flow, expanding notification_prefs toggles (critical alerts / weekly summary / product updates).
