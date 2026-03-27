import { Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layouts/AppLayout";
import AuthLayout from "@/components/layouts/AuthLayout";
import ProtectedRoute from "@/components/layouts/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import InventoryPage from "@/pages/inventory/InventoryPage";
import TransactionsPage from "@/pages/transactions/TransactionsPage";
import TeamPage from "@/pages/team/TeamPage";
import SuppliersPage from "@/pages/supply-chain/SuppliersPage";
import ChannelsPage from "@/pages/supply-chain/ChannelsPage";
import OrdersPage from "@/pages/supply-chain/OrdersPage";
import RolesPermissionsPage from "@/pages/management/RolesPermissionsPage";
import IntegrationsPage from "@/pages/management/IntegrationsPage";
import NotFound from "@/pages/NotFound";
import ComingSoon from "@/pages/ComingSoon";

export default function Router() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Protected app routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />

          {/* Phase 2 */}
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/reports" element={<ComingSoon title="Reports & Analytics" />} />
          <Route path="/messages" element={<ComingSoon title="Messages" />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/campaigns" element={<ComingSoon title="Campaigns" />} />

          {/* Phase 3 */}
          <Route path="/supply/suppliers" element={<SuppliersPage />} />
          <Route path="/supply/channels" element={<ChannelsPage />} />
          <Route path="/supply/orders" element={<OrdersPage />} />
          <Route path="/management/roles" element={<RolesPermissionsPage />} />
          <Route
            path="/management/billing"
            element={
              <ComingSoon
                title="Billing & Subscription"
                description="Subscription management is coming soon. You'll be able to manage your plan and payment methods here."
              />
            }
          />
          <Route path="/management/integrations" element={<IntegrationsPage />} />

          {/* Phase 4 */}
          <Route path="/settings/support" element={<ComingSoon title="Customer Support" />} />
          <Route path="/settings/help" element={<ComingSoon title="Help Center" />} />
          <Route path="/settings/system" element={<ComingSoon title="System Settings" />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
