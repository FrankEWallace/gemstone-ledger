import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { FlaskConical, X, LayoutTemplate } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import NotificationBell from "@/components/shared/NotificationBell";
import ThemeToggle from "@/components/shared/ThemeToggle";
import CommandPalette from "@/components/shared/CommandPalette";
import OnboardingWizard from "@/components/shared/OnboardingWizard";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode, exitDemoMode } from "@/lib/demo";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SidebarVariant = "sidebar" | "inset" | "floating";

const PAGE_TITLES: Record<string, { breadcrumb: string; title: string }> = {
  "/":                   { breadcrumb: "Core",           title: "Dashboard" },
  "/notifications":      { breadcrumb: "Core",           title: "Notifications" },
  "/customers":          { breadcrumb: "Core",           title: "Customers" },
  "/transactions":       { breadcrumb: "Core",           title: "Transactions" },
  "/inventory":          { breadcrumb: "Core",           title: "Inventory" },
  "/reports":            { breadcrumb: "Core",           title: "Reports" },
  "/reports/inventory":  { breadcrumb: "Reports",        title: "Inventory Report" },
  "/supply/suppliers":   { breadcrumb: "Operations",     title: "Suppliers" },
  "/supply/orders":      { breadcrumb: "Operations",     title: "Orders" },
  "/team":               { breadcrumb: "Team & System",  title: "Team" },
  "/management/roles":   { breadcrumb: "Team & System",  title: "Roles" },
  "/management/audit":   { breadcrumb: "Team & System",  title: "Audit Log" },
  "/equipment":          { breadcrumb: "Extensions",     title: "Equipment" },
  "/safety":             { breadcrumb: "Extensions",     title: "Safety" },
  "/team/schedule":      { breadcrumb: "Extensions",     title: "Schedules" },
  "/team/timesheet":     { breadcrumb: "Extensions",     title: "Timesheets" },
  "/production":         { breadcrumb: "Extensions",     title: "Production" },
  "/documents":          { breadcrumb: "Extensions",     title: "Documents" },
  "/messages":           { breadcrumb: "Extensions",     title: "Messages" },
  "/campaigns":          { breadcrumb: "Extensions",     title: "Campaigns" },
  "/supply/channels":    { breadcrumb: "Extensions",     title: "Channels" },
  "/settings":           { breadcrumb: "Settings",       title: "" },
};

function getSidebarDefaultOpen(): boolean {
  const match = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith("sidebar:state="));
  return !match || match.trim().split("=")[1]?.trim() !== "false";
}

export default function AppLayout() {
  const { userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [variant, setVariant] = useState<SidebarVariant>(
    () => (localStorage.getItem("sidebarVariant") as SidebarVariant) ?? "sidebar"
  );
  const demoActive = isDemoMode();
  const location = useLocation();

  function handleExitDemo() {
    exitDemoMode();
    navigate("/login", { replace: true });
  }

  function handleVariantChange(v: SidebarVariant) {
    setVariant(v);
    localStorage.setItem("sidebarVariant", v);
  }

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

  const pageInfo =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith("/settings")
      ? { breadcrumb: "Settings", title: "" }
      : { breadcrumb: "App", title: "" });

  return (
    <SidebarProvider defaultOpen={getSidebarDefaultOpen()}>
      <AppSidebar variant={variant} />

      <SidebarInset className="h-svh overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/95 backdrop-blur-sm px-4 lg:px-6 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <SidebarTrigger className="text-muted-foreground hover:bg-accent hover:text-foreground -ml-1" />
            <nav className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-muted-foreground/60 truncate">{pageInfo.breadcrumb}</span>
              {pageInfo.title && (
                <>
                  <span className="text-muted-foreground/30 select-none">/</span>
                  <span className="font-medium text-foreground truncate">{pageInfo.title}</span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:border-border/80 hover:bg-accent/50 transition-colors"
            >
              <span className="text-xs">Search…</span>
              <kbd className="hidden lg:inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground/70">
                ⌘K
              </kbd>
            </button>

            {/* Sidebar layout variant picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title="Sidebar layout"
                  className="hidden lg:flex rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <LayoutTemplate className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {(["sidebar", "inset", "floating"] as SidebarVariant[]).map((v) => (
                  <DropdownMenuItem
                    key={v}
                    onClick={() => handleVariantChange(v)}
                    className={cn("capitalize", variant === v && "font-medium text-primary")}
                  >
                    {v}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <OfflineBanner />

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
      </SidebarInset>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </SidebarProvider>
  );
}
