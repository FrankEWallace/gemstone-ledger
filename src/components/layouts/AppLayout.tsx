import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Search, Bell, Menu } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";

const PAGE_TITLES: Record<string, { breadcrumb: string; title: string }> = {
  "/": { breadcrumb: "Dashboard", title: "Overview" },
  "/inventory": { breadcrumb: "Inventory", title: "Items" },
  "/transactions": { breadcrumb: "Transactions", title: "All Transactions" },
  "/reports": { breadcrumb: "Reports", title: "Analytics" },
  "/messages": { breadcrumb: "Messages", title: "Team Chat" },
  "/team": { breadcrumb: "Team", title: "Performance" },
  "/campaigns": { breadcrumb: "Campaigns", title: "All Campaigns" },
  "/supply/suppliers": { breadcrumb: "Supply Chain", title: "Suppliers" },
  "/supply/channels": { breadcrumb: "Supply Chain", title: "Channels" },
  "/supply/orders": { breadcrumb: "Supply Chain", title: "Orders" },
  "/management/roles": { breadcrumb: "Management", title: "Roles & Permissions" },
  "/management/billing": { breadcrumb: "Management", title: "Billing & Subscription" },
  "/management/integrations": { breadcrumb: "Management", title: "Integrations" },
  "/settings/support": { breadcrumb: "Settings", title: "Customer Support" },
  "/settings/help": { breadcrumb: "Settings", title: "Help Center" },
  "/settings/system": { breadcrumb: "Settings", title: "System Settings" },
};

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const pageInfo = PAGE_TITLES[location.pathname] ?? { breadcrumb: "App", title: "" };

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm text-muted-foreground">{pageInfo.breadcrumb}</span>
            {pageInfo.title && (
              <>
                <span className="text-muted-foreground text-sm">&gt;</span>
                <span className="text-sm font-semibold">{pageInfo.title}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search..."
                className="bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none w-32"
              />
            </div>
            <button className="rounded-lg p-2 hover:bg-accent">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
