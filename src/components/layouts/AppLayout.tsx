import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, FlaskConical, X } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import NotificationBell from "@/components/shared/NotificationBell";
import ThemeToggle from "@/components/shared/ThemeToggle";
import CommandPalette from "@/components/shared/CommandPalette";
import OnboardingWizard from "@/components/shared/OnboardingWizard";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode, exitDemoMode } from "@/lib/demo";
import { OfflineBanner } from "@/components/shared/OfflineBanner";

const PAGE_TITLES: Record<string, { breadcrumb: string; title: string }> = {
  // Core
  "/":             { breadcrumb: "Core",       title: "Dashboard" },
  "/notifications": { breadcrumb: "Core",      title: "Notifications" },
  "/customers":    { breadcrumb: "Core",       title: "Customers" },
  "/transactions": { breadcrumb: "Core",       title: "Transactions" },
  "/inventory":    { breadcrumb: "Core",       title: "Inventory" },
  "/reports":      { breadcrumb: "Core",       title: "Reports" },
  // Operations
  "/supply/suppliers": { breadcrumb: "Operations", title: "Suppliers" },
  "/supply/orders":    { breadcrumb: "Operations", title: "Orders" },
  // Team & System
  "/team":                   { breadcrumb: "Team & System", title: "Team" },
  "/management/roles":       { breadcrumb: "Team & System", title: "Roles" },
  "/management/audit":       { breadcrumb: "Team & System", title: "Audit Log" },
  // Extensions
  "/equipment":      { breadcrumb: "Extensions", title: "Equipment" },
  "/safety":         { breadcrumb: "Extensions", title: "Safety" },
  "/team/schedule":  { breadcrumb: "Extensions", title: "Schedules" },
  "/team/timesheet": { breadcrumb: "Extensions", title: "Timesheets" },
  "/production":     { breadcrumb: "Extensions", title: "Production" },
  "/documents":      { breadcrumb: "Extensions", title: "Documents" },
  "/messages":       { breadcrumb: "Extensions", title: "Messages" },
  "/campaigns":      { breadcrumb: "Extensions", title: "Campaigns" },
  "/supply/channels": { breadcrumb: "Extensions", title: "Channels" },
  // Settings — tab bar inside SettingsLayout handles sub-section context
  "/settings":          { breadcrumb: "Settings", title: "" },
};

export default function AppLayout() {
  const { userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const demoActive = isDemoMode();

  function handleExitDemo() {
    exitDemoMode();
    navigate("/login", { replace: true });
  }

  // Show wizard once userProfile is loaded and onboarding isn't done (never in demo)
  useEffect(() => {
    if (!demoActive && userProfile && !userProfile.onboarding_completed) {
      setShowWizard(true);
    }
  }, [userProfile, demoActive]);

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
  const pageInfo =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith("/settings") ? { breadcrumb: "Settings", title: "" } : { breadcrumb: "App", title: "" });

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto bg-background">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 lg:px-6 py-3">
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

        <OfflineBanner />

        {/* Demo mode banner */}
        {demoActive && (
          <div className="flex items-center gap-3 bg-amber-500 dark:bg-amber-600 px-4 py-2 text-white text-sm">
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span className="flex-1 font-medium">
              Demo mode — you're exploring FW Mining OS with sample data. Nothing is saved.
            </span>
            <button
              onClick={handleExitDemo}
              className="flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1 text-xs font-semibold transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Exit demo
            </button>
          </div>
        )}

        {showWizard && location.pathname === "/" && (
          <OnboardingWizard
            onComplete={async () => {
              setShowWizard(false);
              await refreshProfile();
            }}
          />
        )}

        <Outlet />
      </main>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
