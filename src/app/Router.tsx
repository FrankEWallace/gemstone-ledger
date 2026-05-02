import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AppLayout from "@/components/layouts/AppLayout";
import AuthLayout from "@/components/layouts/AuthLayout";
import ProtectedRoute from "@/components/layouts/ProtectedRoute";
import SettingsLayout from "@/components/layouts/SettingsLayout";
import RouteErrorBoundary from "@/components/shared/RouteErrorBoundary";
import PageSkeleton from "@/components/shared/PageSkeleton";

// ─── Eager-loaded (auth critical path — no lazy) ──────────────────────────────
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import AcceptInvite from "@/pages/auth/AcceptInvite";

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────

const Dashboard            = lazy(() => import("@/pages/Dashboard"));
const NotificationsPage    = lazy(() => import("@/pages/notifications/NotificationsPage"));
const InventoryPage     = lazy(() => import("@/pages/inventory/InventoryPage"));
const TransactionsPage  = lazy(() => import("@/pages/transactions/TransactionsPage"));
const TeamPage          = lazy(() => import("@/pages/team/TeamPage"));
const ReportsPage              = lazy(() => import("@/pages/reports/ReportsPage"));
const CustomerReportPage       = lazy(() => import("@/pages/reports/CustomerReportPage"));
const ExpenseBreakdownPage     = lazy(() => import("@/pages/reports/ExpenseBreakdownPage"));
const IncomeBreakdownPage      = lazy(() => import("@/pages/reports/IncomeBreakdownPage"));
const InventoryReportPage      = lazy(() => import("@/pages/reports/InventoryReportPage"));
const MessagesPage      = lazy(() => import("@/pages/messages/MessagesPage"));
const CampaignsPage     = lazy(() => import("@/pages/campaigns/CampaignsPage"));
const SuppliersPage     = lazy(() => import("@/pages/supply-chain/SuppliersPage"));
const ChannelsPage      = lazy(() => import("@/pages/supply-chain/ChannelsPage"));
const OrdersPage        = lazy(() => import("@/pages/supply-chain/OrdersPage"));
const RolesPermissionsPage = lazy(() => import("@/pages/management/RolesPermissionsPage"));
const IntegrationsPage  = lazy(() => import("@/pages/management/IntegrationsPage"));
const SystemSettingsPage = lazy(() => import("@/pages/settings/SystemSettingsPage"));
const HelpCenterPage    = lazy(() => import("@/pages/settings/HelpCenterPage"));
const SupportPage       = lazy(() => import("@/pages/settings/SupportPage"));
const AuditLogPage      = lazy(() => import("@/pages/management/AuditLogPage"));
const AlertRulesPage    = lazy(() => import("@/pages/settings/AlertRulesPage"));
const KpiTargetsPage      = lazy(() => import("@/pages/settings/KpiTargetsPage"));
const SyncHistoryPage     = lazy(() => import("@/pages/settings/SyncHistoryPage"));
const CustomersPage                  = lazy(() => import("@/pages/customers/CustomersPage"));
const CustomerDetailPage             = lazy(() => import("@/pages/customers/CustomerDetailPage"));
const CustomerExpenseBreakdownPage   = lazy(() => import("@/pages/customers/CustomerExpenseBreakdownPage"));
const ExpenseCategoriesPage = lazy(() => import("@/pages/settings/ExpenseCategoriesPage"));
const ProductionLogPage   = lazy(() => import("@/pages/production/ProductionLogPage"));
const TimesheetPage       = lazy(() => import("@/pages/team/TimesheetPage"));
const EquipmentPage     = lazy(() => import("@/pages/equipment/EquipmentPage"));
const SafetyPage        = lazy(() => import("@/pages/safety/SafetyPage"));
const ShiftSchedulePage = lazy(() => import("@/pages/team/ShiftSchedulePage"));
const DocumentsPage     = lazy(() => import("@/pages/documents/DocumentsPage"));
const ActivityPage      = lazy(() => import("@/pages/activity/ActivityPage"));
const ProfilePage       = lazy(() => import("@/pages/settings/ProfilePage"));
const ComingSoon        = lazy(() => import("@/pages/ComingSoon"));
const NotFound          = lazy(() => import("@/pages/NotFound"));

// ─── Wrappers ─────────────────────────────────────────────────────────────────

/** Each route gets its own error boundary so one broken page can't crash others. */
function BoundedRoute({ element }: { element: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    // Key the boundary to the pathname so navigating away always resets error state.
    <RouteErrorBoundary key={pathname}>
      <Suspense fallback={<PageSkeleton />}>
        {element}
      </Suspense>
    </RouteErrorBoundary>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function Router() {
  return (
    <Routes>
      {/* Auth routes — eager, no skeleton needed */}
      <Route element={<AuthLayout />}>
        <Route path="/login"           element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Register has its own full-screen split layout */}
      <Route path="/register" element={<Register />} />

      {/* Invite acceptance — user is already authenticated but has no profile yet */}
      <Route path="/accept-invite" element={<AcceptInvite />} />

      {/* Protected app routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>

          {/* Dashboard */}
          <Route path="/" element={<BoundedRoute element={<Dashboard />} />} />
          <Route path="/notifications" element={<BoundedRoute element={<NotificationsPage />} />} />

          {/* Activity */}
          <Route path="/activity" element={<BoundedRoute element={<ActivityPage />} />} />

          {/* Phase 2 */}
          <Route path="/inventory"    element={<BoundedRoute element={<InventoryPage />} />} />
          <Route path="/transactions" element={<BoundedRoute element={<TransactionsPage />} />} />
          <Route path="/customers"                   element={<BoundedRoute element={<CustomersPage />} />} />
          <Route path="/customers/:id"              element={<BoundedRoute element={<CustomerDetailPage />} />} />
          <Route path="/customers/:id/expenses"     element={<BoundedRoute element={<CustomerExpenseBreakdownPage />} />} />
          <Route path="/team"         element={<BoundedRoute element={<TeamPage />} />} />

          {/* Phase 4 */}
          <Route path="/reports"                    element={<BoundedRoute element={<ReportsPage />} />} />
          <Route path="/reports/expenses"           element={<BoundedRoute element={<ExpenseBreakdownPage />} />} />
          <Route path="/reports/income"             element={<BoundedRoute element={<IncomeBreakdownPage />} />} />
          <Route path="/reports/inventory"          element={<BoundedRoute element={<InventoryReportPage />} />} />
          <Route path="/reports/customers/:id"  element={<BoundedRoute element={<CustomerReportPage />} />} />
          <Route path="/messages"   element={<BoundedRoute element={<MessagesPage />} />} />
          <Route path="/campaigns"  element={<BoundedRoute element={<CampaignsPage />} />} />

          {/* Phase 6 */}
          <Route path="/equipment"        element={<BoundedRoute element={<EquipmentPage />} />} />
          <Route path="/safety"           element={<BoundedRoute element={<SafetyPage />} />} />
          <Route path="/team/schedule"    element={<BoundedRoute element={<ShiftSchedulePage />} />} />
          <Route path="/documents"        element={<BoundedRoute element={<DocumentsPage />} />} />

          {/* Phase 3 — Supply Chain */}
          <Route path="/supply/suppliers" element={<BoundedRoute element={<SuppliersPage />} />} />
          <Route path="/supply/channels"  element={<BoundedRoute element={<ChannelsPage />} />} />
          <Route path="/supply/orders"    element={<BoundedRoute element={<OrdersPage />} />} />

          {/* Phase 3 — Management */}
          <Route path="/management/roles"        element={<BoundedRoute element={<RolesPermissionsPage />} />} />
          <Route path="/management/audit"        element={<BoundedRoute element={<AuditLogPage />} />} />
          {/* Legacy redirects — keep old bookmarks working */}
          <Route path="/management/integrations" element={<Navigate to="/settings/integrations" replace />} />
          <Route path="/management/billing"      element={<Navigate to="/settings/billing" replace />} />

          {/* Settings — nested under SettingsLayout for the tab bar */}
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/profile" replace />} />
            <Route path="profile"            element={<BoundedRoute element={<ProfilePage />} />} />
            <Route path="expense-categories" element={<BoundedRoute element={<ExpenseCategoriesPage />} />} />
            <Route path="targets"            element={<BoundedRoute element={<KpiTargetsPage />} />} />
            <Route path="alerts"             element={<BoundedRoute element={<AlertRulesPage />} />} />
            <Route path="integrations"       element={<BoundedRoute element={<IntegrationsPage />} />} />
            <Route path="billing"            element={<BoundedRoute element={<ComingSoon title="Billing & Subscription" description="Subscription management is coming soon. You'll be able to manage your plan and payment methods here." />} />} />
            <Route path="system"             element={<BoundedRoute element={<SystemSettingsPage />} />} />
            <Route path="help"               element={<BoundedRoute element={<HelpCenterPage />} />} />
            <Route path="support"            element={<BoundedRoute element={<SupportPage />} />} />
            <Route path="sync"               element={<BoundedRoute element={<SyncHistoryPage />} />} />
          </Route>
          <Route path="/production"       element={<BoundedRoute element={<ProductionLogPage />} />} />
          <Route path="/team/timesheet"   element={<BoundedRoute element={<TimesheetPage />} />} />

        </Route>
      </Route>

      <Route path="*" element={<BoundedRoute element={<NotFound />} />} />
    </Routes>
  );
}
