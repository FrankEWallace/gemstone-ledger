import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import NotificationBell from "@/components/shared/NotificationBell";
import ThemeToggle from "@/components/shared/ThemeToggle";
import CommandPalette from "@/components/shared/CommandPalette";
import OnboardingWizard from "@/components/shared/OnboardingWizard";
import { useAuth } from "@/hooks/useAuth";

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
  "/management/audit": { breadcrumb: "Management", title: "Audit Log" },
  "/settings/support": { breadcrumb: "Settings", title: "Customer Support" },
  "/settings/help": { breadcrumb: "Settings", title: "Help Center" },
  "/settings/system": { breadcrumb: "Settings", title: "System Settings" },
  "/settings/alerts":  { breadcrumb: "Settings", title: "Alert Rules" },
  "/settings/targets": { breadcrumb: "Settings", title: "KPI Targets" },
  "/production":       { breadcrumb: "Operations", title: "Production Log" },
  "/team/timesheet":   { breadcrumb: "Team", title: "Timesheets" },
  "/equipment": { breadcrumb: "Operations", title: "Equipment" },
  "/safety": { breadcrumb: "Operations", title: "Safety Incidents" },
  "/team/schedule": { breadcrumb: "Team", title: "Shift Schedule" },
  "/documents": { breadcrumb: "Operations", title: "Documents" },
};

export default function AppLayout() {
  const { userProfile, refreshProfile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // Show wizard once userProfile is loaded and onboarding isn't done
  useEffect(() => {
    if (userProfile && !userProfile.onboarding_completed) {
      setShowWizard(true);
    }
  }, [userProfile]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
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
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/40 transition-colors"
            >
              <span>Search…</span>
              <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <Outlet />
      </main>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {showWizard && (
        <OnboardingWizard
          onComplete={async () => {
            setShowWizard(false);
            await refreshProfile();
          }}
        />
      )}
    </div>
  );
}
