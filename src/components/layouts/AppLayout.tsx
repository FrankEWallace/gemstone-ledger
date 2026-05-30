import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { FlaskConical, X, ChevronDown, Pickaxe, Search, Plus } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import NotificationBell from "@/components/shared/NotificationBell";
import ThemeToggle from "@/components/shared/ThemeToggle";
import CommandPalette from "@/components/shared/CommandPalette";
import OnboardingWizard from "@/components/shared/OnboardingWizard";
import FirstSiteSetup from "@/components/shared/FirstSiteSetup";
import CreateSiteDialog from "@/components/shared/CreateSiteDialog";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";


const PAGE_TITLES: Record<string, { breadcrumb: string; title: string }> = {
  "/":                   { breadcrumb: "",          title: "Dashboard" },
  "/notifications":      { breadcrumb: "",          title: "Notifications" },
  "/activity":           { breadcrumb: "",          title: "Activity" },
  "/customers":          { breadcrumb: "",          title: "Customers" },
  "/transactions":       { breadcrumb: "",          title: "Transactions" },
  "/inventory":          { breadcrumb: "",          title: "Inventory" },
  "/reports":            { breadcrumb: "",          title: "Reports" },
  "/reports/inventory":  { breadcrumb: "Reports",   title: "Inventory Report" },
  "/supply/suppliers":   { breadcrumb: "Operations", title: "Suppliers" },
  "/supply/orders":      { breadcrumb: "Operations", title: "Orders" },
  "/team":               { breadcrumb: "",          title: "Team" },
  "/management/roles":   { breadcrumb: "Team",      title: "Roles" },
  "/management/audit":   { breadcrumb: "Team",      title: "Audit Log" },
  "/equipment":          { breadcrumb: "Field",     title: "Equipment" },
  "/safety":             { breadcrumb: "Field",     title: "Safety" },
  "/team/schedule":      { breadcrumb: "Team",      title: "Schedules" },
  "/team/timesheet":     { breadcrumb: "Team",      title: "Timesheets" },
  "/production":         { breadcrumb: "Field",     title: "Production" },
  "/documents":          { breadcrumb: "Field",     title: "Documents" },
  "/messages":           { breadcrumb: "",          title: "Messages" },
  "/supply/channels":    { breadcrumb: "Operations", title: "Channels" },
  "/settings":           { breadcrumb: "",          title: "Settings" },
};

function getSidebarDefaultOpen(): boolean {
  if (window.innerWidth < 1024) return false;
  const match = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith("sidebar:state="));
  return !match || match.trim().split("=")[1]?.trim() !== "false";
}

// ─── Site Switcher ────────────────────────────────────────────────────────────

function SiteSwitcher() {
  const { activeSite, sites, setActiveSite } = useSite();
  const { orgRole } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = orgRole === "owner" || orgRole === "admin";

  if (!activeSite) return null;

  // Plain label only when there's nothing to switch to and nothing to add.
  if (sites.length <= 1 && !canCreate) {
    return (
      <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-foreground">
        <Pickaxe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate max-w-32">{activeSite.name}</span>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-foreground hover:bg-accent transition-colors">
            <Pickaxe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate max-w-32">{activeSite.name}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {sites.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => setActiveSite(s.id)}
              className={cn("gap-2", s.id === activeSite.id && "font-medium text-primary")}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold">
                {s.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="truncate">{s.name}</span>
            </DropdownMenuItem>
          ))}
          {canCreate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <span>New site</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canCreate && <CreateSiteDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const { userProfile, sites, isLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const demoActive = isDemoMode();
  const location = useLocation();

  function handleExitDemo() {
    exitDemoMode();
    navigate("/login", { replace: true });
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
      : { breadcrumb: "", title: "" });

  // A signed-in user with no site can't use any site-scoped feature, so guide
  // them through creating one first. Gated on !isLoading so it never flashes
  // during the initial profile/site load.
  if (!demoActive && !isLoading && userProfile && sites.length === 0) {
    return <FirstSiteSetup />;
  }

  return (
    <SidebarProvider defaultOpen={getSidebarDefaultOpen()}>
      <AppSidebar />

      <SidebarInset className="h-svh overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/95 backdrop-blur-sm px-4 lg:px-6 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <SidebarTrigger className="text-muted-foreground hover:bg-accent hover:text-foreground -ml-1" />
            <SiteSwitcher />
            <span className="text-border select-none hidden sm:block">·</span>
            <nav className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
              {pageInfo.breadcrumb && (
                <>
                  <span className="text-muted-foreground/60 truncate">{pageInfo.breadcrumb}</span>
                  {pageInfo.title && <span className="text-muted-foreground/30 select-none">/</span>}
                </>
              )}
              {pageInfo.title && (
                <span className="font-medium text-foreground truncate">{pageInfo.title}</span>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile search icon */}
            <button
              onClick={() => setCmdOpen(true)}
              className="flex md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Desktop search bar */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:border-border/80 hover:bg-accent/50 transition-colors"
            >
              <span className="text-xs">Search…</span>
              <kbd className="hidden lg:inline-flex h-4.5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground/70">
                ⌘K
              </kbd>
            </button>

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
