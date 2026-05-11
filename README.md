# Gemstone Ledger

A multi-tenant mining operations management SaaS built for gemstone mining businesses. Covers the full operational lifecycle — from inventory and production logging to safety, supply chain, team management, and financial reporting.

---

## Features

- **Dashboard** — KPI overview with revenue, expenses, production, and inventory summaries
- **Inventory** — Stock tracking, write-offs, low-stock alerts, and usage analytics
- **Production Log** — Daily production entries linked to inventory consumption
- **Transactions** — Income and expense tracking with category breakdowns
- **Customers** — Customer profiles, per-customer expense breakdowns, and customer reports
- **Supply Chain** — Suppliers, sales channels, and purchase orders
- **Team** — Staff directory, shift scheduling, and timesheets
- **Equipment** — Equipment registry and maintenance tracking
- **Safety** — Incident reporting and safety log
- **Documents** — File storage and document management
- **Campaigns** — Marketing campaign tracking
- **Reports** — Expense breakdown, income breakdown, inventory, and per-customer reports (PDF export)
- **Alert Rules** — Configurable threshold alerts for KPIs and stock levels
- **Audit Log** — Full action history across the organisation
- **Roles & Permissions** — Role-based access control per organisation
- **Offline Support** — IndexedDB-backed query persistence with background sync

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Routing | React Router v6 |
| UI | shadcn/ui + Radix UI + Tailwind CSS v4 |
| Data Fetching | TanStack Query v5 |
| Offline | Dexie (IndexedDB) + TanStack Query persister |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions) |
| PDF Export | @react-pdf/renderer |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| PWA | vite-plugin-pwa |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- A [Supabase](https://supabase.com) project

### 1. Clone and install

```bash
git clone <repo-url>
cd gemstone-ledger
npm install
# or
bun install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Supabase project values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these from your [Supabase dashboard](https://supabase.com/dashboard) → project → **Settings → API**.

### 3. Run database migrations

Apply the migrations in order using the Supabase CLI or the SQL editor in your Supabase dashboard:

```
supabase/migrations/
  001_initial_schema.sql
  002_fix_rls_insert_policies.sql
  003_fix_rls_circular_deps.sql
  004_low_stock_notification_trigger.sql
  005_rls_audit.sql
  006_phase6_schema.sql
  007_audit_log.sql
  008_alert_rules.sql
  009_phase8_schema.sql
  010_customers_schema.sql
  011_org_module_config.sql
  012_signup_rpc.sql
  013_inventory_write_offs.sql
```

### 4. Start the dev server

```bash
npm run dev
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

---

## Project Structure

```
src/
  app/          # Router and top-level app shell
  components/   # Shared UI components and layouts
  context/      # React context providers (Auth, Theme, Nav)
  hooks/        # Custom React hooks
  lib/          # Supabase client, query client, offline sync engine
  pages/        # Route-level page components
  services/     # Domain service modules (inventory, production, safety, transactions)
  types/        # TypeScript type definitions
supabase/
  migrations/   # Postgres migration files
  functions/    # Supabase Edge Functions
```

---

## Deployment

The project is configured for Vercel. Push to your connected Git branch and Vercel will build and deploy automatically.

For a manual deploy:

```bash
vercel --prod
```

Make sure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in your Vercel project's environment variables.
