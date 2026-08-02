# Mining OS — iOS / iPad (lean capture app)

A deliberately small native SwiftUI app for the four things field users do daily,
offline-first. Everything else (reports, management, supply chain, team) stays in
the web app.

## What it does

- **Log Production** → `production_logs`
- **Record Sale / Expense** → `transactions`
- **Add Inventory** → `inventory_items`
- **Report Incident** → `safety_incidents`

Every capture is written to a local **outbox** (SwiftData) and returns instantly,
then synced to Supabase in the background — mirroring the web app's Dexie sync
queue. Works with no signal; drains when connectivity returns.

## Requirements

- Xcode 16+ (uses SwiftData, iOS 17 deployment target)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) — `brew install xcodegen`

## Setup

```bash
cd ios
cp Config/Secrets.example.xcconfig Config/Secrets.xcconfig   # then fill in values
xcodegen generate
open MiningOS.xcodeproj
```

`Secrets.xcconfig` is gitignored. It holds `SUPABASE_URL` and `SUPABASE_ANON_KEY`,
injected into Info.plist at build time and read at runtime by `AppConfig`.

> The `.xcodeproj` is generated and gitignored — **`project.yml` is the source of
> truth**. After changing files/targets/packages, re-run `xcodegen generate`.

## Structure

```
MiningOS/
  App/         MiningOSApp, RootView (auth gate), AppState (session + site scoping)
  Services/    Supabase client; Outbox/ (PendingMutation @Model, Outbox flusher)
  Models/      Site, CapturePayloads (match Supabase columns exactly)
  Features/    Auth, Sites, Home, Capture (4 forms), Sync
  Support/     Formatters
```

## Notes / TODO (next passes)

- Screens are **functional stubs** — visual design is the next work item.
- `HomeView` still needs the "Today" glance numbers (reads from Supabase).
- Verify `supabase-swift` API against the resolved package version (pinned `from: 2.0.0`).
- Auth is email/password to match the web flow; no sign-up (accounts are created on web).
